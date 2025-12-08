import type { APIRoute } from "astro";
import { SESSION_COOKIE, clearSession } from "../../lib/auth";
import { validateCsrfToken } from "../../lib/csrf";

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData();
  const csrfToken = String(form.get("csrfToken") ?? "");

  if (!validateCsrfToken(cookies, csrfToken)) {
    return new Response("CSRF invalido.", { status: 403 });
  }

  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await clearSession(token);
  }

  cookies.delete(SESSION_COOKIE, { path: "/" });
  return new Response(null, { status: 303, headers: { Location: "/login" } });
};
