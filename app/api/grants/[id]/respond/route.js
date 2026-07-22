import { z } from "zod";
import { getCurrentUserId } from "../../../../../lib/auth.js";
import { respondToGrant } from "../../../../../lib/access-grant-store.js";

export const runtime = "nodejs";

const respondSchema = z.object({ decision: z.enum(["accept", "decline"]) });

export async function POST(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  const { id } = await params;
  const updated = await respondToGrant(id, userId, parsed.data.decision);
  if (!updated) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({ grant: updated });
}
