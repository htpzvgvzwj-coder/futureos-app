import { getOpenLoops } from "../../../../lib/open-loops.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const loops = await getOpenLoops(userId);
  return Response.json({ loops });
}
