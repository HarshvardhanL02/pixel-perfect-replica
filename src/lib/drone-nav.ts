import { toast } from "sonner";

/**
 * Service and helper layer for linking the external Drone Nav AI application.
 * Reads configuration strictly from environment variables without hardcoded secrets.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validates whether a given URL string is a valid HTTP or HTTPS address.
 * Rejects javascript:, data:, file:, and malformed URIs.
 */
export function validateDroneNavUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * Reads and validates the configured Drone Nav AI base URL from the environment.
 */
export function getDroneNavUrl(): string | null {
  const envUrl = import.meta.env["VITE_DRONE_NAV_AI_URL"] as string | undefined;
  return validateDroneNavUrl(envUrl);
}

/**
 * Checks whether Drone Nav AI has a valid configured URL.
 */
export function isDroneNavConfigured(): boolean {
  return getDroneNavUrl() !== null;
}

/**
 * Opens the external Drone Nav AI mission application in a secure new tab.
 * Displays a graceful notification if the application URL is not configured.
 */
export function openDroneNavAI(): boolean {
  const targetUrl = getDroneNavUrl();

  if (!targetUrl) {
    toast.error("Drone Nav AI is not configured.", {
      description: "Set VITE_DRONE_NAV_AI_URL in your environment or .env file.",
    });
    return false;
  }

  if (typeof window !== "undefined") {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  return false;
}
