import { db, eq, Sessions, Users } from "astro:db";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;
export const SESSION_COOKIE = "session";

const SALT_BYTES = 16;
const KEY_LEN = 64;
const SESSION_TOKEN_BYTES = 32;
const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function cookiesShouldBeSecure() {
  return process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqualHex(expectedHex: string, receivedHex: string) {
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LEN, SCRYPT_PARAMS)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hashed] = stored.split(":");
  if (!salt || !hashed) return false;
  const derived = (await scryptAsync(password, salt, KEY_LEN, SCRYPT_PARAMS)) as Buffer;
  return safeEqualHex(hashed, derived.toString("hex"));
}

export async function createUser(email: string, password: string) {
  const passwordHash = await hashPassword(password);
  const user = { id: randomUUID(), email, passwordHash };
  await db.insert(Users).values(user);
  return { id: user.id, email: user.email };
}

export async function findUserByEmail(email: string) {
  const rows = await db.select().from(Users).where(eq(Users.email, email));
  return rows[0] ?? null;
}

export async function createSession(userId: string) {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(Sessions).values({ tokenHash, userId, expiresAt });
  return { token, expiresAt };
}

export async function clearSession(token: string) {
  const tokenHash = hashSessionToken(token);
  await db.delete(Sessions).where(eq(Sessions.tokenHash, tokenHash));
}

export async function getSessionUser(token: string) {
  const tokenHash = hashSessionToken(token);
  const sessions = await db.select().from(Sessions).where(eq(Sessions.tokenHash, tokenHash));
  const session = sessions[0];
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await clearSession(token);
    return null;
  }

  const users = await db.select().from(Users).where(eq(Users.id, session.userId));
  const user = users[0];
  if (!user) return null;

  return { id: user.id, email: user.email };
}

export function authCookieOptions(expiresAt: Date) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "strict" as const,
    secure: cookiesShouldBeSecure(),
    expires: expiresAt,
  };
}
