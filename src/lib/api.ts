// Integration point for Python FastAPI backend + RGB/thermal person-detection models.
import { analyzeImage, loadBaseUrl, type DetectionResult } from "./detection-api";
import type { EmergencyReport } from "./types";

export const getBaseUrl = () =>
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ||
  (import.meta.env["VITE_DETECTION_API_URL"] as string | undefined) ||
  loadBaseUrl();

export const backendConnected = true;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getBaseUrl().trim().replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  listReports: () => req<EmergencyReport[]>("/reports"),
  createReport: (body: Partial<EmergencyReport>) =>
    req<EmergencyReport>("/reports", { method: "POST", body: JSON.stringify(body) }),
  detect: (file: File, camera: "rgb" | "thermal" | "person"): Promise<DetectionResult> => {
    return analyzeImage(getBaseUrl(), camera, file);
  },
};
