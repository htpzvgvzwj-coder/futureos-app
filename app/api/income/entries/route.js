import { getIncomeHistory, upsertIncomeEntry } from "../../../../lib/income-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const entries = await getIncomeHistory(userId);
  return Response.json({ entries });
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { entryMonth, amount, note } = body;

  if (typeof entryMonth !== "string" || !MONTH_RE.test(entryMonth)) {
    return Response.json({ error: "invalid_month" }, { status: 400 });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  }

  const entry = await upsertIncomeEntry(userId, {
    entryMonth,
    amount: parsedAmount,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  });
  return Response.json({ entry });
}
