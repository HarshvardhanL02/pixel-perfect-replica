// Service layer for the user's already-trained detection models, served by a Python FastAPI backend.
// The frontend never holds model files or private keys — it only uploads an image and shows the backend's JSON.
//
// Expected backend contract (adjust the FastAPI side or `normalize()` below):
//   POST {BASE}/detect/{model}   model = rgb | thermal | person
//   multipart/form-data field "file"
//   -> { detections: [{ label, confidence, bbox: [x1, y1, x2, y2] }], processing_time_ms?, image_width?, image_height?, model_name? }
// `bbox` may be pixel coords [x1,y1,x2,y2] or {x, y, width, height}; values <= 1 are treated as normalized.

export type ModelKind = "rgb" | "thermal" | "person";

export interface ParsedDetection {
  label: string;
  confidence: number | null;
  box: { x1: number; y1: number; x2: number; y2: number } | null;
}

export interface DetectionResult {
  detections: ParsedDetection[];
  processingMs: number | null;
  modelName: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  raw: unknown;
  roundTripMs: number;
}

const STORAGE_KEY = "mediresq.detectionApiUrl";
const DEFAULT_URL = "https://infonitiate-mediresq-ai.hf.space";

export function getDefaultBaseUrl(): string {
  if (typeof process !== "undefined" && process.env?.["BACKEND_URL"]) {
    return process.env["BACKEND_URL"];
  }
  const envUrl = import.meta.env["VITE_DETECTION_API_URL"] as string | undefined;
  return envUrl && envUrl.trim() ? envUrl.trim() : DEFAULT_URL;
}

/** Call only from effects/handlers (reads localStorage). */
export function loadBaseUrl(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored || !stored.trim() || stored.trim() === "http://localhost:8000") {
      return getDefaultBaseUrl();
    }
    return stored.trim();
  } catch {
    return getDefaultBaseUrl();
  }
}

export function saveBaseUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ""));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mediresq:api-url-changed"));
    }
  } catch {
    /* ignore */
  }
}

export class DetectionApiError extends Error {
  constructor(
    message: string,
    readonly hint: string,
    readonly raw?: unknown,
  ) {
    super(message);
  }
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : null;

function parseBox(b: unknown): ParsedDetection["box"] {
  if (Array.isArray(b) && b.length >= 4) {
    const [x1, y1, x2, y2] = b.map(num);
    if (x1 != null && y1 != null && x2 != null && y2 != null) return { x1, y1, x2, y2 };
  }
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    const x1 = num(o["x1"] ?? o["xmin"]);
    const y1 = num(o["y1"] ?? o["ymin"]);
    const x2 = num(o["x2"] ?? o["xmax"]);
    const y2 = num(o["y2"] ?? o["ymax"]);
    if (x1 != null && y1 != null && x2 != null && y2 != null) return { x1, y1, x2, y2 };
    const x = num(o["x"] ?? o["left"]);
    const y = num(o["y"] ?? o["top"]);
    const w = num(o["width"] ?? o["w"]);
    const h = num(o["height"] ?? o["h"]);
    if (x != null && y != null && w != null && h != null)
      return { x1: x, y1: y, x2: x + w, y2: y + h };
  }
  return null;
}

function normalize(raw: unknown, roundTripMs: number): DetectionResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(raw)
    ? raw
    : (o["detections"] ?? o["predictions"] ?? o["results"] ?? o["objects"] ?? []);
  const detections: ParsedDetection[] = (Array.isArray(list) ? list : []).map((d) => {
    const r = (d ?? {}) as Record<string, unknown>;
    return {
      label: String(r["label"] ?? r["class_name"] ?? r["name"] ?? r["class"] ?? "person"),
      confidence: num(r["confidence"] ?? r["score"] ?? r["conf"]),
      box: parseBox(r["bbox"] ?? r["box"] ?? r["bounding_box"] ?? r["xyxy"] ?? r),
    };
  });
  const secs = num(o["processing_time"] ?? o["inference_time"]);
  return {
    detections,
    processingMs:
      num(o["inference_time_ms"] ?? o["processing_time_ms"] ?? o["inference_ms"]) ??
      (secs != null ? secs * 1000 : null),
    modelName:
      typeof o["model"] === "string"
        ? o["model"]
        : typeof o["model_name"] === "string"
          ? o["model_name"]
          : null,
    imageWidth: num(o["image_width"] ?? o["width"]),
    imageHeight: num(o["image_height"] ?? o["height"]),
    raw,
    roundTripMs,
  };
}

export async function analyzeImage(
  baseUrl: string,
  model: ModelKind,
  file: File,
): Promise<DetectionResult> {
  const base = baseUrl.trim().replace(/\/+$/, "") || getDefaultBaseUrl();
  const fd = new FormData();
  fd.append("file", file);
  const started = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout for ZeroGPU hardware allocation

  let res: Response;
  try {
    res = await fetch(`${base}/detect/${model}`, {
      method: "POST",
      body: fd,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new DetectionApiError(
        "Inference Request Timed Out",
        "The AI backend did not respond within 90 seconds. Hugging Face ZeroGPU may be queuing or warming up. Please try again.",
        err,
      );
    }
    throw new DetectionApiError(
      `Could not reach AI detection service at ${base}`,
      "Check your network connection and ensure the backend or Hugging Face Space is active.",
      err,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }

  if (!res.ok) {
    let userMessage = `Backend returned HTTP ${res.status}`;
    let userHint = "The model server rejected the request.";

    if (res.status === 400) {
      userMessage = "Invalid Image (HTTP 400)";
      userHint = "The backend could not process this file. Please upload a valid JPG or PNG image.";
    } else if (res.status === 404) {
      userMessage = "Endpoint Not Found (HTTP 404)";
      userHint = `The detection route /detect/${model} was not found on ${base}.`;
    } else if (res.status === 429) {
      userMessage = "ZeroGPU Quota Exceeded (HTTP 429)";
      userHint =
        "ZeroGPU usage quota has been temporarily reached for this session. Please wait a few minutes before trying again.";
    } else if (res.status === 503) {
      userMessage = "ZeroGPU Cluster Busy (HTTP 503)";
      userHint =
        "The GPU hardware cluster is temporarily busy, cold-starting, or allocating resources. Please retry shortly.";
    } else if (res.status >= 500) {
      userMessage = `Model Inference Error (HTTP ${res.status})`;
      userHint =
        "The AI backend encountered an error while running YOLO inference. Please check backend logs.";
    }

    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) {
        userHint = `${userHint} (${detail})`;
      }
    }

    throw new DetectionApiError(userMessage, userHint, body);
  }

  if (typeof body !== "object" || body === null) {
    throw new DetectionApiError(
      "Malformed API Response",
      "The /detect endpoint did not return valid JSON.",
      body,
    );
  }

  return normalize(body, Math.round(performance.now() - started));
}

export async function checkHealth(baseUrl?: string): Promise<boolean> {
  const base = (baseUrl ?? loadBaseUrl()).trim().replace(/\/+$/, "");
  if (!base) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(`${base}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return r.ok;
  } catch {
    return false;
  }
}
