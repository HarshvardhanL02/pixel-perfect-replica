import { describe, expect, it, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import {
  getDroneNavUrl,
  isDroneNavConfigured,
  openDroneNavAI,
  validateDroneNavUrl,
} from "@/lib/drone-nav";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("Drone Nav AI URL Validation", () => {
  it("accepts valid https URLs", () => {
    expect(validateDroneNavUrl("https://drone-nav-ai.example.com")).toBe(
      "https://drone-nav-ai.example.com",
    );
    expect(validateDroneNavUrl("https://drone.example.com:8080/path")).toBe(
      "https://drone.example.com:8080/path",
    );
  });

  it("accepts valid http URLs for local development", () => {
    expect(validateDroneNavUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("strips trailing slashes from URLs", () => {
    expect(validateDroneNavUrl("https://drone-nav-ai.example.com///")).toBe(
      "https://drone-nav-ai.example.com",
    );
  });

  it("rejects malicious or unsupported protocols", () => {
    expect(validateDroneNavUrl("javascript:alert(1)")).toBeNull();
    expect(validateDroneNavUrl("data:text/html,<script>evil()</script>")).toBeNull();
    expect(validateDroneNavUrl("file:///C:/secrets.txt")).toBeNull();
    expect(validateDroneNavUrl("ftp://example.com")).toBeNull();
  });

  it("rejects empty or non-string inputs", () => {
    expect(validateDroneNavUrl("")).toBeNull();
    expect(validateDroneNavUrl("   ")).toBeNull();
    expect(validateDroneNavUrl(undefined)).toBeNull();
    expect(validateDroneNavUrl(null)).toBeNull();
    expect(validateDroneNavUrl("not-a-url")).toBeNull();
  });
});

describe("Drone Nav AI Open Helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an error toast and returns false when URL is unconfigured", () => {
    const originalEnv = import.meta.env["VITE_DRONE_NAV_AI_URL"];
    delete import.meta.env["VITE_DRONE_NAV_AI_URL"];

    const result = openDroneNavAI();
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "Drone Nav AI is not configured.",
      expect.objectContaining({
        description: expect.stringContaining("VITE_DRONE_NAV_AI_URL"),
      }),
    );

    if (originalEnv) {
      import.meta.env["VITE_DRONE_NAV_AI_URL"] = originalEnv;
    }
  });

  it("calls window.open with secure flags when URL is configured", () => {
    import.meta.env["VITE_DRONE_NAV_AI_URL"] = "https://drone.example.com";
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const result = openDroneNavAI();
    expect(result).toBe(true);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://drone.example.com",
      "_blank",
      "noopener,noreferrer",
    );

    windowOpenSpy.mockRestore();
    delete import.meta.env["VITE_DRONE_NAV_AI_URL"];
  });
});
