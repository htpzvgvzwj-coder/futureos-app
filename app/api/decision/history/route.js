import { DEFAULT_PROFILE_KEY, getHistory } from "../../../../lib/decision-store.js";

export const runtime = "nodejs";

export async function GET() {
  const entries = await getHistory(DEFAULT_PROFILE_KEY);
  return Response.json({ entries });
}
