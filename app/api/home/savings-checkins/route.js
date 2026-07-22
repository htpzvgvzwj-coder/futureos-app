import {
  addSavingsCheckin,
  getLatestArtifact,
  getOrCreateSession,
  getSavingsCheckins,
} from "../../../../lib/home-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const session = await getOrCreateSession(userId);
  const checkins = await getSavingsCheckins(session.id);
  return Response.json({ checkins });
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { checkinMonth, amount, note } = body;

  if (typeof checkinMonth !== "string" || !MONTH_RE.test(checkinMonth)) {
    return Response.json({ error: "invalid_month" }, { status: 400 });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  }

  const session = await getOrCreateSession(userId);
  const confirmedSavingsPlan = await getLatestArtifact(session.id, "stage2", "confirmed_savings_plan");
  if (!confirmedSavingsPlan) {
    return Response.json({ error: "no_confirmed_savings_plan" }, { status: 409 });
  }

  const checkin = await addSavingsCheckin(session.id, {
    checkinMonth,
    amount: parsedAmount,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  });
  return Response.json({ checkin });
}
