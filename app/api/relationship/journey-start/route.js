import { DEFAULT_PROFILE_KEY, getOrCreateJourneyStart } from "../../../../lib/relationship-store.js";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = await getOrCreateJourneyStart(DEFAULT_PROFILE_KEY);
  return Response.json({ startedAt });
}
