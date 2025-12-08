import type { APIRoute } from "astro";
import {
  SESSION_COOKIE,
  authCookieOptions,
  createSession,
  findUserByEmail,
  verifyPassword,
} from "../../lib/auth";
import { validateCsrfToken } from "../../lib/csrf";
import { registerRateLimitHit } from "../../lib/rate-limit";

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  const csrfToken = String(form.get("csrfToken") ?? "");

  const rateLimit = registerRateLimitHit(request, "login");
  if (rateLimit.blocked) {
    return new Response("Demasiados intentos, reintenta mas tarde.", {
      status: 429,
      headers: { "Retry-After": rateLimit.retryAfterSeconds.toString() },
    });
  }

  if (!validateCsrfToken(cookies, csrfToken)) {
    return new Response("CSRF invalido.", { status: 403 });
  }

  if (!email || !password) {
    return new Response("Faltan datos", { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return new Response("Credenciales invalidas", { status: 401 });
  }

  const session = await createSession(user.id);
  cookies.set(SESSION_COOKIE, session.token, authCookieOptions(session.expiresAt));
  return new Response(null, { status: 303, headers: { Location: "/dashboard" } });
};
