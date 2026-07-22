import { z } from "zod";
import { NextResponse } from "next/server";
import { createSession, createUser, SESSION_COOKIE_NAME } from "../../../../lib/auth.js";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80),
});

export async function POST(request) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  let user;
  try {
    user = await createUser(parsed.data);
  } catch (error) {
    // Postgres unique_violation on users.email
    if (error?.code === "23505") {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    throw error;
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
