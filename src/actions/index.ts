import type { AstroCookies } from "astro";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import {
  SESSION_COOKIE,
  authCookieOptions,
  createSession,
  createUser,
  findUserByEmail,
  verifyPassword,
} from "../lib/auth";
import { validateCsrfToken } from "../lib/csrf";
import { registerRateLimitHit } from "../lib/rate-limit";

const emailSchema = z.string().email().transform((value) => value.toLowerCase().trim());
const passwordSchema = z.string().min(8);
const csrfSchema = z.string().length(64);

function assertCsrf(cookies: AstroCookies, token: string) {
  const ok = validateCsrfToken(cookies, token);
  if (!ok) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "CSRF invalido.",
    });
  }
}

function assertRateLimit(request: Request, scope: "login" | "register") {
  const rateLimit = registerRateLimitHit(request, scope);
  if (rateLimit.blocked) {
    throw new ActionError({
      code: "TOO_MANY_REQUESTS",
      message: `Demasiados intentos. Reintenta en ${rateLimit.retryAfterSeconds}s.`,
    });
  }
}

export const server = {
  register: defineAction({
    accept: "form",
    input: z.object({
      email: emailSchema,
      password: passwordSchema,
      csrfToken: csrfSchema,
    }),
    handler: async ({ input, cookies, request }) => {
      assertCsrf(cookies, input.csrfToken);
      assertRateLimit(request, "register");

      const existing = await findUserByEmail(input.email);
      if (existing) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Ya existe un usuario con ese correo.",
        });
      }

      const user = await createUser(input.email, input.password);
      const session = await createSession(user.id);
      cookies.set(SESSION_COOKIE, session.token, authCookieOptions(session.expiresAt));
      return { ok: true };
    },
  }),

  login: defineAction({
    accept: "form",
    input: z.object({
      email: emailSchema,
      password: passwordSchema,
      csrfToken: csrfSchema,
    }),
    handler: async ({ input, cookies, request }) => {
      assertCsrf(cookies, input.csrfToken);
      assertRateLimit(request, "login");

      const user = await findUserByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Credenciales invalidas.",
        });
      }

      const session = await createSession(user.id);
      cookies.set(SESSION_COOKIE, session.token, authCookieOptions(session.expiresAt));
      return { ok: true };
    },
  }),
};
