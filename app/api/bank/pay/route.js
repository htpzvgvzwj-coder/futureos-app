import { getCurrentUserId } from "../../../../lib/auth.js";
import { recordInternalTransfer, recordCardRepayment } from "../../../../lib/transaction-ledger/store.js";
import { guard } from "../../../../lib/http-guards.js";
import { query } from "../../../../lib/db.js";
import { getAuthPolicy, evaluateAuthorization, findRequestByIdempotency, createAuthRequest } from "../../../../lib/authorization/store.js";

export const runtime = "nodejs";

// If this account's rules require a guardian's approval for `kind`, park the
// move as a pending authorization request instead of executing it. Returns a
// response body to send back, or null to proceed with the move.
async function approvalGate(userId, { kind, amount, currency, payload, summary }) {
  const existing = await findRequestByIdempotency(userId, payload.idempotencyKey);
  if (existing) {
    if (existing.status === "executed") return null; // already approved + done - let idempotency handle it
    if (existing.status === "pending")
      return { status: "pending_approval", requestId: existing.id, reason: existing.reason, canMoveMoney: false };
    if (existing.status === "declined" || existing.status === "cancelled")
      return { status: existing.status, requestId: existing.id, reason: existing.reason, canMoveMoney: false };
  }
  let accountType = "individual";
  try {
    const r = await query(`select account_type from user_onboarding where profile_key = $1`, [userId]);
    accountType = r.rows[0]?.account_type ?? "individual";
  } catch {
    /* default */
  }
  const policy = await getAuthPolicy(userId);
  const verdict = evaluateAuthorization({ accountType, policy, kind, amount });
  if (!verdict.required) return null;
  const req = await createAuthRequest(userId, { kind, summary, amount, currency, payload, reason: verdict.reason });
  return { status: "pending_approval", requestId: req.id, reason: verdict.reason, canMoveMoney: false };
}

// POST /api/bank/pay
//   { type: "internal_transfer", fromAccountId, toAccountId, amount, idempotencyKey }
//   { type: "card_repayment",   fromAccountId, cardAccountId, amount, idempotencyKey }
//   { type: "external", payeeType, ... }  -> honestly refused (no real rail)
//
// FutureOS has NO real external payment rail. An internal move between the
// customer's own accounts is a real double-entry ledger write. Anything
// leaving the bank returns `not_connected` - it is NEVER faked as sent.
export async function POST(request) {
  const blocked = guard(request, { bucket: "pay", limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const idem = body.idempotencyKey;
  if (!idem) return Response.json({ error: "idempotency_key_required" }, { status: 400 });

  try {
    if (body.type === "internal_transfer") {
      const gate = await approvalGate(userId, {
        kind: "internal_transfer",
        amount: body.amount,
        currency: body.currency ?? "SGD",
        summary: `Move ${body.currency ?? "SGD"} ${Math.round(Number(body.amount) || 0).toLocaleString("en-SG")} between your own accounts`,
        payload: { fromAccountId: body.fromAccountId, toAccountId: body.toAccountId, amount: body.amount, currency: body.currency ?? "SGD", idempotencyKey: idem },
      });
      if (gate) return Response.json(gate, { status: 202 });
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
      const gate = await approvalGate(userId, {
        kind: "card_repayment",
        amount: body.amount,
        currency: body.currency ?? "SGD",
        summary: `Repay ${body.currency ?? "SGD"} ${Math.round(Number(body.amount) || 0).toLocaleString("en-SG")} to a card`,
        payload: { fromAccountId: body.fromAccountId, cardAccountId: body.cardAccountId, amount: body.amount, currency: body.currency ?? "SGD", idempotencyKey: idem },
      });
      if (gate) return Response.json(gate, { status: 202 });
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
