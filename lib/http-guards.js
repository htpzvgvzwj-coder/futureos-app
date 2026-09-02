// HTTP guards for API routes (Usable RC, section 十二 / 十四). Pure-ish
// helpers a route calls at the top: rate limiting (in-memory, per
// instance), CSRF/same-origin check for cookie-authenticated mutations,
// and a small error-id helper. No dependency.
//
// NOTE: the rate limiter is per-process. On a multi-instance deployment a
// shared store (Redis / Upstash) is required - flagged in the delivery
// report as "needs shared store for production".

const buckets = new Map(); // key -> { count, resetAt }

// Sliding fixed-window limiter. Returns { ok, retryAfter }.
export function rateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  // Test-only escape hatch: an E2E run against a local prod build creates
  // many users/actions in a short window. Off by default; never set in
  // any real deployment.
  if (process.env.E2E_RELAX_LIMITS === "1") return { ok: true, remaining: limit };
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, remaining: limit - b.count };
}

// Occasionally drop stale buckets so the map can't grow unbounded.
if (typeof setInterval === "function") {
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }, 120_000);
  if (t && typeof t.unref === "function") t.unref();
}

export function clientKey(request, suffix = "") {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${suffix}`;
}

// 429 response helper.
export function tooMany(retryAfter) {
  return Response.json({ error: "rate_limited", retryAfter }, { status: 429, headers: { "retry-after": String(retryAfter ?? 60) } });
}

// Same-origin check for a cookie-authenticated mutation (defence against
// CSRF). The session cookie is SameSite=Lax, which already blocks
// cross-site POST from a form; this adds an explicit Origin/Referer check
// for fetch-based requests and rejects a mismatch.
export function sameOriginOk(request) {
  const method = request.method?.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  if (!host) return false;
  const check = (val) => {
    if (!val) return null;
    try {
      return new URL(val).host === host;
    } catch {
      return false;
    }
  };
  const o = check(origin);
  const r = check(referer);
  // If neither header is present we cannot verify - reject the mutation.
  if (o === null && r === null) return false;
  return o !== false && r !== false && (o === true || r === true);
}

export function csrfFail() {
  return Response.json({ error: "csrf_check_failed" }, { status: 403 });
}

export function newErrorId() {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// One call at the top of a sensitive route: rate-limit + (for mutations)
// same-origin. Returns a Response to short-circuit, or null to proceed.
export function guard(request, { bucket, limit, windowMs, requireSameOrigin = true } = {}) {
  if (requireSameOrigin && !sameOriginOk(request)) return csrfFail();
  if (bucket) {
    const rl = rateLimit(clientKey(request, bucket), { limit, windowMs });
    if (!rl.ok) return tooMany(rl.retryAfter);
  }
  return null;
}
