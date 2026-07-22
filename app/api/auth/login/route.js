import { z } from "zod";
import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE_NAME, verifyPassword } from "../../../../lib/auth.js";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  const user = await verifyPassword(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ id: user.id, email: user.email, displayName: user.display_name });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return response;
}
