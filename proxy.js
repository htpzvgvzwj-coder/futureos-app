import { NextResponse } from "next/server";

// Edge proxy - Next 16 convention (Usable RC, section 十二 / 十四):
//  - security headers + a strict-ish CSP on every response
//  - same-origin (CSRF) check for every cookie-authenticated /api mutation
//
// Per-route rate limiting lives in the route handlers (needs Node memory);
// this only does the cheap, universal guards.

const SECURITY_HEADERS = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "cross-origin-opener-policy": "same-origin",
};

// No inline-script hashes are used by the app shell except Next's own; keep
// 'unsafe-inline' only for styles (Next injects style tags). Tighten later
// with nonces if the app moves fully to the App Router streaming model.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function sameOrigin(request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!host) return false;
  const hostOf = (v) => {
    try {
      return v ? new URL(v).host : null;
    } catch {
      return "invalid";
    }
  };
  const o = hostOf(origin);
  const r = hostOf(referer);
  if (o === null && r === null) return false; // cannot verify a mutation
  if (o === "invalid" || r === "invalid") return false;
  return (o === null || o === host) && (r === null || r === host);
}

export default function proxy(request) {
  const { pathname } = request.nextUrl;

  // CSRF / same-origin for API mutations (skip auth endpoints - they carry
  // their own guard and a login form is same-origin anyway).
  if (
    pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !sameOrigin(request)
  ) {
    return NextResponse.json({ error: "csrf_check_failed" }, { status: 403 });
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  res.headers.set("content-security-policy", CSP);
  if (process.env.NODE_ENV === "production") {
    res.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
