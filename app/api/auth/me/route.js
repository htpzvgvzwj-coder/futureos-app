import { getCurrentUserId, getUserById } from "../../../../lib/auth.js";

export const runtime = "nodejs";

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const user = await getUserById(userId);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  return Response.json({ id: user.id, email: user.email, displayName: user.display_name });
}
