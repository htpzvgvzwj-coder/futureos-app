import { getCurrentUserId } from "../../../../lib/auth.js";
import { listTransactions, appendTransaction, reverseTransaction, getSpendingTotal } from "../../../../lib/transaction-ledger/store.js";
import { recordTransactionRipple } from "../../../../lib/ripple/record.js";

export const runtime = "nodejs";

// GET /api/bank/transactions[?accountId=&limit=]
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const limit = Math.min(200, Number(url.searchParams.get("limit")) || 50);
  try {
    const [transactions, spendingThisPeriod] = await Promise.all([
      listTransactions(userId, { accountId, limit }),
      getSpendingTotal(userId, { from: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10) }).catch(() => 0),
    ]);
    return Response.json({ transactions, spendingLast30Days: spendingThisPeriod });
  } catch (error) {
    console.error("[bank/transactions] failed:", error?.message);
    return Response.json({ error: "transactions_unavailable" }, { status: 500 });
  }
}

// POST /api/bank/transactions
//   { action: "reverse", transactionId, reason }  -> reversal entry
//   otherwise a single entry (a manual record / a scheduled bill)
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "reverse") {
      if (!body.transactionId) return Response.json({ error: "transactionId_required" }, { status: 400 });
      const result = await reverseTransaction(userId, body.transactionId, { reason: body.reason });
      await recordTransactionRipple(userId, { ...result.original, status: "reversed" }).catch(() => {});
      return Response.json(result);
    }
    const txn = await appendTransaction(userId, {
      accountId: body.accountId,
      direction: body.direction,
      amount: body.amount,
      currency: body.currency,
      originalAmount: body.originalAmount,
      originalCurrency: body.originalCurrency,
      fxRate: body.fxRate,
      status: body.status ?? "posted",
      category: body.category,
      channel: body.channel,
      merchant: body.merchant,
      counterpartyMasked: body.counterpartyMasked,
      reference: body.reference,
      recurringGroup: body.recurringGroup,
      idempotencyKey: body.idempotencyKey,
      sourceType: "user_confirmed",
    });
    await recordTransactionRipple(userId, txn).catch(() => {});
    return Response.json({ transaction: txn }, { status: 201 });
  } catch (error) {
    if (error?.code === "23505") return Response.json({ error: "duplicate_idempotency_key" }, { status: 409 });
    return Response.json({ error: error.message }, { status: 400 });
  }
}
