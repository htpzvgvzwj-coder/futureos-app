import { getCurrentUserId } from "../../../../lib/auth.js";
import { guard } from "../../../../lib/http-guards.js";
import { query } from "../../../../lib/db.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import { evaluatePaymentPause } from "../../../../lib/family-relay/payment-pause.js";

export const runtime = "nodejs";

// POST /api/family-relay/pause   { amount, payee }
//   or                          { action: "continue", eventId }
// A payment is checked before it goes out. Guardian holds it only for a
// concrete signal, derived from this account's real payment history, and
// always records the check (and any override) in the Change Ledger.
const round0 = (n) => Math.round(Number(n) || 0);

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "fr-pause", limit: 30 });
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));

  if (body.action === "continue") {
    await recordEventSafe({
      profileKey: userId, actor: "user", sourceFeature: "family", actionType: "guardian_action", status: "active",
      messageKey: "changeLedger.event.savings_plan_confirmed.headline", messageParams: { domain: "family", amount: 0 },
      relatedGoalIds: [], cause: { trigger: "payment_pause_continue", ref: body.eventId ?? null },
      impactSet: [], uncertaintyNote: "Payment Pause: the account holder chose to continue after seeing why it paused.",
    }).catch(() => null);
    return Response.json({ ok: true, continued: true });
  }

  const amount = round0(body.amount);
  const payee = String(body.payee ?? "").trim();
  if (!(amount > 0)) return Response.json({ error: "no_amount" }, { status: 400 });

  try {
    const txRes = await query(
      `select merchant as payee, amount, posted_at as at from bank_transactions
        where profile_key = $1 and direction = 'debit'
        order by posted_at desc limit 120`,
      [userId],
    ).catch(() => ({ rows: [] }));
    const recentPayments = txRes.rows.map((r) => ({ payee: r.payee, amount: Number(r.amount), at: new Date(r.at).getTime() }));
    const knownPayees = [...new Set(recentPayments.map((p) => p.payee).filter(Boolean))];
    const typicalMax = recentPayments.reduce((m, p) => Math.max(m, round0(p.amount)), 0) || null;

    const evaluation = evaluatePaymentPause({ amount, payee, knownPayees, recentPayments, typicalMax });

    let eventId = null;
    if (evaluation.paused) {
      const res = await recordEventSafe({
        profileKey: userId, actor: "system", sourceFeature: "guardian", actionType: "guardian_action", status: "active",
        messageKey: "changeLedger.event.savings_plan_confirmed.headline", messageParams: { domain: "family", amount },
        relatedGoalIds: [], cause: { trigger: "payment_pause", payee, triggers: evaluation.triggers.map((t) => t.code) },
        impactSet: [],
        uncertaintyNote: `Payment Pause: ${payee || "a payment"} — SGD ${amount.toLocaleString("en-SG")}. ${evaluation.triggers.map((t) => t.text).join(" ")}`,
      }).catch(() => null);
      eventId = res?.event?.id ?? null;
    }

    return Response.json({ ok: true, evaluation, eventId });
  } catch (error) {
    console.error("[family-relay/pause] failed:", error?.message);
    return Response.json({ error: "pause_failed", detail: error?.message ?? null }, { status: 500 });
  }
}
