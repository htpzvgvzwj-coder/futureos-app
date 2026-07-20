import { DEFAULT_PROFILE_KEY, getLatestPendingOffer } from "../../../../lib/micro-insurance-store.js";

export const runtime = "nodejs";

export async function GET() {
  const offer = await getLatestPendingOffer(DEFAULT_PROFILE_KEY);
  return Response.json({ offer });
}
