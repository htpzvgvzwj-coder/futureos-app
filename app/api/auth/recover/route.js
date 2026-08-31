import { z } from "zod";
import { NextResponse } from "next/server";
import { requestPasswordReset, resetPassword } from "../../../../lib/account-recovery.js";
import { guard } from "../../../../lib/http-guards.js";

export const runtime = "nodejs";

const requestSchema = z.object({ action: z.literal("request"), email: z.string().email() });
const resetSchema = z.object({ action: z.literal("reset"), token: z.string().min(10), password: z.string().min(8) });

// POST /api/auth/recover
//   { action: "request", email }         -> creates a reset token (email
//        delivery is NOT wired - a provider is required; non-prod returns
//        the token for testing). Never reveals whether the email exists.
//   { action: "reset", token, password } -> sets the new password, ends
//        every session.
export async function POST(request) {
  const blocked = guard(request, { bucket: "auth-recover", limit: 5, windowMs: 300_000 });
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  if (body.action === "request") {
    const p = requestSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "validation_failed" }, { status: 422 });
    const result = await requestPasswordReset(p.data.email);
    return NextResponse.json({
      message: "If that email is registered, a reset link has been created.",
      ...(result.token ? { devToken: result.token } : {}),
      emailDelivery: "not_configured",
    });
  }
  if (body.action === "reset") {
    const p = resetSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "validation_failed" }, { status: 422 });
    const result = await resetPassword(p.data.token, p.data.password);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Password updated. Please sign in again." });
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
