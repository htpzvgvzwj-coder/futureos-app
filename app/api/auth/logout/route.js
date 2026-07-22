import { NextResponse } from "next/server";
import { revokeSession, SESSION_COOKIE_NAME } from "../../../../lib/auth.js";

export const runtime = "nodejs";

export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) await revokeSession(token);

  const response = NextResponse.json({ loggedOut: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { httpOnly: true, path: "/", expires: new Date(0) });
  return response;
}
