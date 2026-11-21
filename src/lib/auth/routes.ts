export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";
export const LOGIN_PATH = "/login";
export const ONBOARDING_PATH = "/onboarding";

/** Pages only meant for signed-out visitors; signed-in users are sent to the app. */
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

/** Reachable without a session. */
const PUBLIC_PATHS = [...GUEST_ONLY_PATHS, "/reset-password", "/auth"];

function matches(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PATHS.some((base) => matches(pathname, base));
}

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.some((base) => matches(pathname, base));
}

/**
 * Accepts only same-origin relative paths for post-login redirects, preventing open
 * redirects such as `//evil.com` or `https://evil.com`.
 */
export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "http://bizflow.local");
    if (parsed.origin !== "http://bizflow.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
