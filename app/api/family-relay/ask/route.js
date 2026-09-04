import { getCurrentUserId } from "../../../../lib/auth.js";
import { guard } from "../../../../lib/http-guards.js";
import { query } from "../../../../lib/db.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import { evaluateAskToPay } from "../../../../lib/family-relay/ask-to-pay.js";
import { getAuthPolicy, createAuthRequest, hasLinkedApprover } from "../../../../lib/authorization/store.js";

export const runtime = "nodejs";

// POST /api/family-relay/ask   { amount, merchant }
// A child / youth asks to make a payment. The evaluator runs server-side
// off real account data; the decision + its reasons are written to the
// Change Ledger, and a "needs a guardian's yes" outcome also opens a real
// approval request (kind: child_payment) in the queue.
const DAY = 86_400_000;
const round0 = (n) => Math.round(Number(n) || 0);

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "fr-ask", limit: 30 });
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  const amount = round0(body.amount);
  const merchant = String(body.merchant ?? "").trim();
  if (!(amount > 0)) return Response.json({ error: "no_amount" }, { status: 400 });

  try {
    // Real context: merchants this account has paid before, and what has
    // gone out in the last 7 days.
    const txRes = await query(
      `select merchant, amount, posted_at from bank_transactions
        where profile_key = $1 and direction = 'debit'
        order by posted_at desc limit 120`,
      [userId],
    ).catch(() => ({ rows: [] }));
    const knownMerchants = [...new Set(txRes.rows.map((r) => r.merchant).filter(Boolean))];
    const spentThisWeek = txRes.rows
      .filter((r) => Date.now() - new Date(r.posted_at).getTime() <= 7 * DAY)
      .reduce((s, r) => s + round0(r.amount), 0);

    // A weekly ceiling a guardian delegated, if any.
    const lr = await query(
      `select auto_approve_weekly from lifecycle_roles
        where profile_key = $1 and scope = 'approve' and status = 'active' and auto_approve_weekly is not null
        order by auto_approve_weekly desc limit 1`,
      [userId],
    ).catch(() => ({ rows: [] }));
    const weeklyAllowance = lr.rows[0] ? Number(lr.rows[0].auto_approve_weekly) : (body.weeklyAllowance ?? null);

    const policy = await getAuthPolicy(userId);
    const evaluation = evaluateAskToPay({
      amount, merchant,
      weeklyAllowance, spentThisWeek,
      knownMerchants,
      savingsGoals: [],
      policy: {
        autoApproveUnder: policy.autoApproveUnder ?? null,
        alwaysApproveOver: policy.approvalOverAmount ?? null,
        newMerchantNeedsApproval: policy.restrictedNeedApproval !== false,
      },
    });

    let requestId = null;
    if (evaluation.outcome === "needs_approval") {
      const linked = await hasLinkedApprover(userId).catch(() => false);
      const reasonText = (evaluation.reasons.find((r) => r.tone === "watch") ?? evaluation.reasons[0])?.text ?? null;
      if (linked) {
        const req = await createAuthRequest(userId, {
          kind: "child_payment",
          summary: merchant ? `Pay ${merchant} — SGD ${amount.toLocaleString("en-SG")}` : `A payment of SGD ${amount.toLocaleString("en-SG")}`,
          amount,
          payload: { merchant, source: "ask_to_pay" },
          reason: reasonText,
        }).catch(() => null);
        requestId = req?.id ?? null;
      }
    }

    await recordEventSafe({
      profileKey: userId,
      actor: "user",
      sourceFeature: "family",
      actionType: "guardian_action",
      status: "active",
      messageKey: "changeLedger.event.savings_plan_confirmed.headline",
      messageParams: { domain: "family", amount },
      relatedGoalIds: [],
      cause: { trigger: "ask_to_pay", merchant, outcome: evaluation.outcome, requestId },
      impactSet: [],
      uncertaintyNote: `Ask to Pay: ${merchant || "a payment"} — SGD ${amount.toLocaleString("en-SG")}. ${
        { auto_ok: "Went through.", needs_approval: "Sent to a guardian.", blocked: "Held." }[evaluation.outcome]
      } ${evaluation.reasons.map((r) => r.text).join(" ")}`.trim(),
    }).catch(() => null);

    return Response.json({ ok: true, evaluation, requestId });
  } catch (error) {
    console.error("[family-relay/ask] failed:", error?.message);
    return Response.json({ error: "ask_failed", detail: error?.message ?? null }, { status: 500 });
  }
}
