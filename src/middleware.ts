import type { MiddlewareHandler } from "astro";
import { SESSION_COOKIE, getSessionUser } from "./lib/auth";
import { ensureCsrfToken } from "./lib/csrf";

const PRIVATE_PREFIXES = ["/dashboard"];
const AUTH_PAGES = ["/login", "/register"];

export const onRequest: MiddlewareHandler = async (context, next) => {
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  context.locals.user = null;
  context.locals.csrfToken = ensureCsrfToken(context.cookies);

  if (token) {
    const user = await getSessionUser(token);
    if (user) {
      context.locals.user = user;
    } else {
      context.cookies.delete(SESSION_COOKIE, { path: "/" });
    }
  }

  const pathname = new URL(context.request.url).pathname;
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.some((prefix) => pathname.startsWith(prefix));

  if (isPrivate && !context.locals.user) {
    return context.redirect("/login");
  }

  if (isAuthPage && context.locals.user) {
    return context.redirect("/dashboard");
  }

  return next();
};
