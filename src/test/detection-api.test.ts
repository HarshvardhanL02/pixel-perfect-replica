import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDefaultBaseUrl,
  loadBaseUrl,
  saveBaseUrl,
  analyzeImage,
  checkHealth,
  DetectionApiError,
} from "../lib/detection-api";

describe("MediResQ AI Detection API Client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns the production Hugging Face Space URL by default", () => {
    const url = getDefaultBaseUrl();
    expect(url).toContain("infonitiate-mediresq-ai.hf.space");
  });

  it("prioritizes process.env.BACKEND_URL when injected by Vercel services binding", () => {
    process.env["BACKEND_URL"] = "http://internal-backend:8000";
    try {
      const url = getDefaultBaseUrl();
      expect(url).toBe("http://internal-backend:8000");
    } finally {
      delete process.env["BACKEND_URL"];
    }
  });

  it("migrates legacy localhost:8000 in localStorage to production default", () => {
    localStorage.setItem("mediresq.detectionApiUrl", "http://localhost:8000");
    const loaded = loadBaseUrl();
    expect(loaded).toContain("infonitiate-mediresq-ai.hf.space");
  });

  it("persists custom user-specified URLs", () => {
    saveBaseUrl("http://custom-server:9000");
    const loaded = loadBaseUrl();
    expect(loaded).toBe("http://custom-server:9000");
  });

  it("checks backend health successfully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", gpu_available: true }),
    } as Response);

    const healthy = await checkHealth("https://infonitiate-mediresq-ai.hf.space");
    expect(healthy).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://infonitiate-mediresq-ai.hf.space/health",
      expect.any(Object),
    );
  });

  it("correctly parses and normalizes real YOLO backend responses", async () => {
    const mockBackendResponse = {
      success: true,
      model: "C2A YOLO26n (Survivor RGB)",
      image_width: 1024,
      image_height: 768,
      inference_time_ms: 714.7,
      detections: [
        {
          label: "person",
          confidence: 0.324,
          x1: 444.3,
          y1: 296.2,
          x2: 496.5,
          y2: 364.7,
          bbox: [444.3, 296.2, 496.5, 364.7],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockBackendResponse),
    } as Response);

    const testFile = new File(["dummy-content"], "test.jpg", { type: "image/jpeg" });
    const result = await analyzeImage("https://infonitiate-mediresq-ai.hf.space", "rgb", testFile);

    expect(result.modelName).toBe("C2A YOLO26n (Survivor RGB)");
    expect(result.processingMs).toBe(714.7);
    expect(result.imageWidth).toBe(1024);
    expect(result.imageHeight).toBe(768);
    expect(result.detections.length).toBe(1);
    expect(result.detections[0].label).toBe("person");
    expect(result.detections[0].confidence).toBe(0.324);
    expect(result.detections[0].box).toEqual({
      x1: 444.3,
      y1: 296.2,
      x2: 496.5,
      y2: 364.7,
    });
  });

  it("handles ZeroGPU quota exhaustion (HTTP 429) cleanly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ detail: "ZeroGPU rate limit exceeded" }),
    } as Response);

    const testFile = new File(["dummy-content"], "test.jpg", { type: "image/jpeg" });
    await expect(
      analyzeImage("https://infonitiate-mediresq-ai.hf.space", "rgb", testFile),
    ).rejects.toThrow(DetectionApiError);
  });

  it("handles ZeroGPU cluster busy (HTTP 503) cleanly", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ detail: "GPU allocating" }),
    } as Response);

    const testFile = new File(["dummy-content"], "test.jpg", { type: "image/jpeg" });
    await expect(
      analyzeImage("https://infonitiate-mediresq-ai.hf.space", "thermal", testFile),
    ).rejects.toThrow(DetectionApiError);
  });
});
