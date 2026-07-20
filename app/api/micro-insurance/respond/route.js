import { z } from "zod";
import { DEFAULT_PROFILE_KEY, updateOfferStatus } from "../../../../lib/micro-insurance-store.js";

export const runtime = "nodejs";

const respondSchema = z.object({
  offerId: z.string().min(1),
  action: z.enum(["accept", "dismiss"]),
});

export async function POST(request) {
  const body = await request.json();
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const status = parsed.data.action === "accept" ? "accepted" : "dismissed";
  const offer = await updateOfferStatus(parsed.data.offerId, DEFAULT_PROFILE_KEY, status);
  if (!offer) {
    return Response.json({ error: "offer_not_found" }, { status: 404 });
  }
  return Response.json({ offer });
}
