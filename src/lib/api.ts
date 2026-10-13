// Integration point for a future Python FastAPI backend + RGB/thermal person-detection models.
// Set VITE_API_BASE_URL and replace demo-store actions with these calls.
import type { Detection, EmergencyReport } from "./types";

const BASE = import.meta.env["VITE_API_BASE_URL"] as string | undefined;
export const backendConnected = Boolean(BASE);

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) throw new Error("Backend not configured – running on demo data");
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  listReports: () => req<EmergencyReport[]>("/reports"),
  createReport: (body: Partial<EmergencyReport>) => req<EmergencyReport>("/reports", { method: "POST", body: JSON.stringify(body) }),
  /** Expected FastAPI endpoint: POST /detect (multipart image, camera=rgb|thermal) -> Detection[] */
  detect: (file: File, camera: "rgb" | "thermal") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("camera", camera);
    if (!BASE) throw new Error("Detection model not connected");
    return fetch(`${BASE}/detect`, { method: "POST", body: fd }).then((r) => r.json() as Promise<Detection[]>);
  },
};
