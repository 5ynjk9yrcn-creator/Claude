// In-process token buckets. Enough for a single-box deployment; swap for a
// shared store only when you actually run more than one node.
const buckets = new Map();

const LIMITS = {
  auth: { windowMs: 15 * 60000, max: 20 },     // login/signup attempts
  api: { windowMs: 60000, max: 120 },          // authenticated API
  write: { windowMs: 60000, max: 30 },         // scans, channel tests
  default: { windowMs: 60000, max: 300 }
};

export function rateLimit(ctx, route) {
  const kind = route.limit || (route.api ? 'api' : 'default');
  const conf = LIMITS[kind] || LIMITS.default;
  const key = `${kind}:${ctx.account?.id || ctx.ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + conf.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  if (bucket.count > conf.max) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: conf.max - bucket.count };
}

// Keep the map from growing without bound in a long-lived process.
export function sweepRateLimits(now = Date.now()) {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  return buckets.size;
}
