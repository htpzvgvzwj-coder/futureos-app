import { getRecentMemories } from "../../../../lib/memory-shelf.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const memories = await getRecentMemories(userId);
  return Response.json({ memories });
}
