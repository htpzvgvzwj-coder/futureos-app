import { z } from "zod";
import { updateOfferStatus } from "../../../../lib/micro-insurance-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

const respondSchema = z.object({
  offerId: z.string().min(1),
  action: z.enum(["accept", "dismiss"]),
});

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const status = parsed.data.action === "accept" ? "accepted" : "dismissed";
  const offer = await updateOfferStatus(parsed.data.offerId, userId, status);
  if (!offer) {
    return Response.json({ error: "offer_not_found" }, { status: 404 });
  }
  return Response.json({ offer });
}
