import type { APIRoute } from "astro";
import {
  SESSION_COOKIE,
  authCookieOptions,
  createSession,
  createUser,
  findUserByEmail,
} from "../../lib/auth";
import { validateCsrfToken } from "../../lib/csrf";
import { registerRateLimitHit } from "../../lib/rate-limit";

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  const csrfToken = String(form.get("csrfToken") ?? "");

  const rateLimit = registerRateLimitHit(request, "register");
  if (rateLimit.blocked) {
    return new Response("Demasiados intentos, reintenta mas tarde.", {
      status: 429,
      headers: { "Retry-After": rateLimit.retryAfterSeconds.toString() },
    });
  }

  if (!validateCsrfToken(cookies, csrfToken)) {
    return new Response("CSRF invalido.", { status: 403 });
  }

  if (!email || !password || password.length < 8) {
    return new Response("Datos invalidos", { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return new Response("Ya existe un usuario con ese correo", { status: 409 });
  }

  const user = await createUser(email, password);
  const session = await createSession(user.id);

  cookies.set(SESSION_COOKIE, session.token, authCookieOptions(session.expiresAt));
  return new Response(null, { status: 303, headers: { Location: "/dashboard" } });
};
