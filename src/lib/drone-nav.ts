/**
 * Service and helper layer for linking the external Drone Nav AI application.
 * Reads configuration strictly from environment variables without hardcoded secrets.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export const DEFAULT_DRONE_NAV_URL = "http://localhost:3000";

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
 * Falls back to DEFAULT_DRONE_NAV_URL ("http://localhost:3000") if not configured.
 */
export function getDroneNavUrl(): string {
  const envUrl = import.meta.env["VITE_DRONE_NAV_AI_URL"] as string | undefined;
  return validateDroneNavUrl(envUrl) ?? DEFAULT_DRONE_NAV_URL;
}

/**
 * Checks whether Drone Nav AI has a valid configured URL in the environment.
 */
export function isDroneNavConfigured(): boolean {
  const envUrl = import.meta.env["VITE_DRONE_NAV_AI_URL"] as string | undefined;
  return validateDroneNavUrl(envUrl) !== null;
}

/**
 * Programmatic helper to open the external Drone Nav AI mission application in a secure new tab.
 */
export function openDroneNavAI(): boolean {
  const targetUrl = getDroneNavUrl();

  if (typeof window !== "undefined") {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  return false;
}
