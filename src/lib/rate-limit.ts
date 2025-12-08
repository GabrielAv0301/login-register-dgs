const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientKeyFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip");
  if (realIp) return realIp;

  const ua = request.headers.get("user-agent");
  return ua ? `ua:${ua}` : "unknown";
}

export function registerRateLimitHit(request: Request, scope = "auth") {
  const now = Date.now();
  const key = `${scope}:${clientKeyFromRequest(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    return { blocked: true, retryAfterSeconds };
  }

  bucket.count += 1;
  return { blocked: false, retryAfterSeconds: 0 };
}
