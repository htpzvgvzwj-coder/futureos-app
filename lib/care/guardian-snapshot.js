// Phase 6 Round 3 - the scope-limited view a linked person gets of an
// account they look after. Built from the SAME money-moments aggregator as
// the owner's own app, then projected DOWN to what the scope allows.
//
//   view    -> a health state, a one-line reason, safe-to-spend state,
//              whether a decision is waiting, whether reality has drifted.
//              NO transactions, NO exact amounts.
//   suggest -> same as view (plus the caller may post a suggestion)
//   approve -> the above + the full pending authorization queue detail
//   manage  -> not produced here (guardian-managed child only, later round)

import { buildMoneyMoments } from "../money-moments/build.js";
import { listAuthRequests } from "../authorization/store.js";

function healthFrom(mm) {
  const below = Boolean(mm?.bankNow?.belowProtectedFloor);
  const actionRequired = mm?.counts?.actionRequired ?? 0;
  const watch = mm?.counts?.watch ?? 0;
  if (below || actionRequired > 0) return "attention";
  if (watch > 0) return "tight";
  return "steady";
}

const HEADLINE = {
  attention: "Something needs a decision or the safety buffer is low.",
  tight: "Getting tighter than usual — worth a look.",
  steady: "Money looks steady.",
};

export async function buildGuardianSnapshot(ownerKey, scope) {
  const mm = await buildMoneyMoments(ownerKey).catch(() => null);
  const moments = mm?.moments ?? [];
  const health = healthFrom(mm);
  const driftMoment = moments.find(
    (m) => m.state === "new" && (m.sourceType === "reality_drift" || /drift/i.test(String(m.id))),
  );
  const realityDrift = Boolean(driftMoment);
  // only tell a guardian about drift once it is more than noise
  const driftSeverity = driftMoment?.severity === "action_required" ? "high" : driftMoment ? "watch" : null;

  const base = {
    health, // steady | tight | attention
    headline: HEADLINE[health],
    safeToSpendState: mm?.bankNow?.belowProtectedFloor ? "below_safe_line" : "ok",
    decisionWaiting: (mm?.counts?.actionRequired ?? 0) > 0,
    realityDrift,
    driftSeverity,
    pendingApprovalCount: 0,
    updatedAt: mm?.generatedAt ?? new Date().toISOString(),
    scope,
    // hard guarantee for the client: this projection carries no amounts
    showsAmounts: false,
  };

  const pending = (await listAuthRequests(ownerKey, { status: "pending" }).catch(() => [])).filter(
    (r) => new Date(r.expiresAt).getTime() > Date.now(),
  );
  base.pendingApprovalCount = pending.length;

  if (scope === "approve") {
    return {
      ...base,
      showsAmounts: true, // an approver must see what they are approving
      pendingApprovals: pending.map((r) => ({
        id: r.id,
        kind: r.kind,
        summary: r.summary,
        amount: r.amount,
        currency: r.currency,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
    };
  }
  return base;
}
