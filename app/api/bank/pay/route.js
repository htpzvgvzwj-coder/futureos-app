import { getCurrentUserId } from "../../../../lib/auth.js";
import { recordInternalTransfer, recordCardRepayment } from "../../../../lib/transaction-ledger/store.js";

export const runtime = "nodejs";

// POST /api/bank/pay
//   { type: "internal_transfer", fromAccountId, toAccountId, amount, idempotencyKey }
//   { type: "card_repayment",   fromAccountId, cardAccountId, amount, idempotencyKey }
//   { type: "external", payeeType, ... }  -> honestly refused (no real rail)
//
// FutureOS has NO real external payment rail. An internal move between the
// customer's own accounts is a real double-entry ledger write. Anything
// leaving the bank returns `not_connected` - it is NEVER faked as sent.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const idem = body.idempotencyKey;
  if (!idem) return Response.json({ error: "idempotency_key_required" }, { status: 400 });

  try {
    if (body.type === "internal_transfer") {
      const result = await recordInternalTransfer(userId, {
        fromAccountId: body.fromAccountId,
        toAccountId: body.toAccountId,
        amount: body.amount,
        currency: body.currency ?? "SGD",
        idempotencyKey: idem,
      });
      return Response.json({ status: result.idempotent ? "already_done" : "posted", ...result });
    }
    if (body.type === "card_repayment") {
      const result = await recordCardRepayment(userId, {
        fromAccountId: body.fromAccountId,
        cardAccountId: body.cardAccountId,
        amount: body.amount,
        currency: body.currency ?? "SGD",
        idempotencyKey: idem,
      });
      return Response.json({ status: result.idempotent ? "already_done" : "posted", ...result });
    }
    // External / PayNow-to-someone-else / Scan & Pay to a merchant: no rail.
    return Response.json(
      {
        status: "not_connected",
        canExecute: false,
        canMoveMoney: false,
        message: "FutureOS is not connected to a real payment rail. This transfer cannot be executed.",
        nextStep: "pending_user_connection",
      },
      { status: 200 },
    );
  } catch (error) {
    if (error?.code === "23505") return Response.json({ error: "duplicate_request", status: "already_done" }, { status: 409 });
    return Response.json({ error: error.message, status: "failed" }, { status: 400 });
  }
}
