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

export function getDefaultBaseUrl(): string {
  return (import.meta.env["VITE_DETECTION_API_URL"] as string | undefined) ?? "";
}

/** Call only from effects/handlers (reads localStorage). */
export function loadBaseUrl(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? getDefaultBaseUrl(); } catch { return getDefaultBaseUrl(); }
}

export function saveBaseUrl(url: string): void {
  try { localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, "")); } catch { /* ignore */ }
}

export class DetectionApiError extends Error {
  constructor(message: string, readonly hint: string, readonly raw?: unknown) { super(message); }
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

function parseBox(b: unknown): ParsedDetection["box"] {
  if (Array.isArray(b) && b.length >= 4) {
    const [x1, y1, x2, y2] = b.map(num);
    if (x1 != null && y1 != null && x2 != null && y2 != null) return { x1, y1, x2, y2 };
  }
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    const x1 = num(o["x1"] ?? o["xmin"]), y1 = num(o["y1"] ?? o["ymin"]), x2 = num(o["x2"] ?? o["xmax"]), y2 = num(o["y2"] ?? o["ymax"]);
    if (x1 != null && y1 != null && x2 != null && y2 != null) return { x1, y1, x2, y2 };
    const x = num(o["x"] ?? o["left"]), y = num(o["y"] ?? o["top"]), w = num(o["width"] ?? o["w"]), h = num(o["height"] ?? o["h"]);
    if (x != null && y != null && w != null && h != null) return { x1: x, y1: y, x2: x + w, y2: y + h };
  }
  return null;
}

function normalize(raw: unknown, roundTripMs: number): DetectionResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(raw) ? raw : (o["detections"] ?? o["predictions"] ?? o["results"] ?? o["objects"] ?? []);
  const detections: ParsedDetection[] = (Array.isArray(list) ? list : []).map((d) => {
    const r = (d ?? {}) as Record<string, unknown>;
    return {
      label: String(r["label"] ?? r["class_name"] ?? r["name"] ?? r["class"] ?? "object"),
      confidence: num(r["confidence"] ?? r["score"] ?? r["conf"]),
      box: parseBox(r["bbox"] ?? r["box"] ?? r["bounding_box"] ?? r["xyxy"]),
    };
  });
  const secs = num(o["processing_time"] ?? o["inference_time"]);
  return {
    detections,
    processingMs: num(o["processing_time_ms"] ?? o["inference_ms"] ?? o["inference_time_ms"]) ?? (secs != null ? secs * 1000 : null),
    modelName: typeof o["model_name"] === "string" ? o["model_name"] : typeof o["model"] === "string" ? o["model"] : null,
    imageWidth: num(o["image_width"] ?? o["width"]),
    imageHeight: num(o["image_height"] ?? o["height"]),
    raw,
    roundTripMs,
  };
}

export async function analyzeImage(baseUrl: string, model: ModelKind, file: File): Promise<DetectionResult> {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) throw new DetectionApiError("No backend URL configured", "Enter your FastAPI server address (e.g. http://localhost:8000) in Backend settings above.");
  const fd = new FormData();
  fd.append("file", file);
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(`${base}/detect/${model}`, { method: "POST", body: fd });
  } catch {
    throw new DetectionApiError(`Could not reach ${base}`, "Check the FastAPI server is running, the URL is correct, and CORS allows this site (add CORSMiddleware). HTTPS pages cannot call plain http:// servers except localhost.");
  }
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) {
    const detail = body && typeof body === "object" && "detail" in body ? JSON.stringify((body as { detail: unknown }).detail) : text.slice(0, 200);
    throw new DetectionApiError(`Backend returned ${res.status}`, detail || "The model server rejected the request.", body);
  }
  if (typeof body !== "object" || body === null) throw new DetectionApiError("Response was not JSON", "The /detect endpoint must return JSON.", body);
  return normalize(body, Math.round(performance.now() - started));
}

export async function checkHealth(baseUrl: string): Promise<boolean> {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) return false;
  try { const r = await fetch(`${base}/health`); return r.ok; } catch { return false; }
}
