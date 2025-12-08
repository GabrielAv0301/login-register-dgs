import type { AstroCookies } from "astro";
import { randomBytes, timingSafeEqual } from "crypto";
import { cookiesShouldBeSecure } from "./auth";

export const CSRF_COOKIE = "csrfToken";
const CSRF_TOKEN_BYTES = 32;
const CSRF_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function csrfCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "strict" as const,
    secure: cookiesShouldBeSecure(),
    maxAge: CSRF_MAX_AGE_SECONDS,
  };
}

export function ensureCsrfToken(cookies: AstroCookies) {
  const existing = cookies.get(CSRF_COOKIE)?.value;
  if (existing) return existing;

  const token = randomBytes(CSRF_TOKEN_BYTES).toString("hex");
  cookies.set(CSRF_COOKIE, token, csrfCookieOptions());
  return token;
}

export function validateCsrfToken(cookies: AstroCookies, provided?: string | null) {
  const stored = cookies.get(CSRF_COOKIE)?.value;
  if (!stored || !provided) return false;

  const storedBuf = Buffer.from(stored, "hex");
  const providedBuf = Buffer.from(String(provided), "hex");
  if (storedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(storedBuf, providedBuf);
}
