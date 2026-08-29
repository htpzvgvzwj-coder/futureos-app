// Living Plan - Turning Point (pure, no DB/AI).
//
// A Turning Point is NOT a to-do. It is the moment a future is about to
// move from "still fine to think about" to "needs a decision". It comes
// from real dates and real thresholds:
//   - a payment milestone approaching without the funds in place
//   - a budget gap that must be resolved before Seal
//   - the emergency floor about to be touched by a sealed commitment
//   - a branch about to lose feasibility
//   - a Future Fragment about to expire
//   - a commitment about to complete (-> a Handoff)
//
// Each Turning Point answers three questions: why now, what if you wait,
// what futures are still open. State is Approaching / Open / Sealed only.

function monthKey(d) {
  return d.toISOString().slice(0, 7);
}
function monthsUntil(monthStr, now) {
  if (!monthStr) return null;
  const [y, m] = monthStr.split("-").map(Number);
  return (y - now.getUTCFullYear()) * 12 + (m - 1 - now.getUTCMonth());
}

const APPROACHING_WITHIN_MONTHS = 3;

// sources: {
//   paymentMilestones: [{ commitmentId, domain, label, amount, dueMonth,
//                          fundedByDue: boolean }],
//   budgetGaps: [{ domain, planId, gapAmount }],
//   emergencyFloor: { bufferMonths, floorMonths, breachedByDomain? },
//   fragments: [{ branchId, domain, validUntil, state }],
//   completions: [{ commitmentId, domain, endMonth, monthlyReleased }],
// }
export function deriveTurningPoints({ sources = {}, now = new Date() }) {
  const points = [];
  const nowMonth = monthKey(now);

  for (const ms of sources.paymentMilestones ?? []) {
    const mUntil = monthsUntil(ms.dueMonth, now);
    if (mUntil == null || mUntil < 0) continue;
    if (mUntil <= APPROACHING_WITHIN_MONTHS && !ms.fundedByDue) {
      points.push({
        id: `payment:${ms.commitmentId}:${ms.dueMonth}`,
        kind: "payment_due_underfunded",
        domain: ms.domain,
        whenMonth: ms.dueMonth,
        monthsAway: mUntil,
        state: mUntil <= 1 ? "open" : "approaching",
        whyNowKey: "turningPoint.why.payment_due_underfunded",
        whyNowParams: { amount: Math.round(ms.amount), month: ms.dueMonth },
        ifYouWaitKey: "turningPoint.wait.payment_due_underfunded",
        openFutures: ["fund_from_available", "reduce_the_plan", "shift_the_date"],
        evidence: { milestone: ms.label, amount: ms.amount },
      });
    }
  }

  for (const g of sources.budgetGaps ?? []) {
    if (g.gapAmount > 0) {
      points.push({
        id: `gap:${g.domain}:${g.planId ?? "plan"}`,
        kind: "budget_below_core",
        domain: g.domain,
        whenMonth: nowMonth,
        monthsAway: 0,
        state: "open",
        whyNowKey: "turningPoint.why.budget_below_core",
        whyNowParams: { amount: Math.round(g.gapAmount) },
        ifYouWaitKey: "turningPoint.wait.budget_below_core",
        openFutures: ["cut_scope", "change_venue_or_type", "raise_budget"],
        evidence: { gapAmount: g.gapAmount },
      });
    }
  }

  const ef = sources.emergencyFloor;
  if (ef && ef.bufferMonths != null && ef.floorMonths != null) {
    const headroom = ef.bufferMonths - ef.floorMonths;
    if (headroom <= 0.5) {
      points.push({
        id: `emergency_floor`,
        kind: "emergency_floor_near",
        domain: ef.breachedByDomain ?? "emergency",
        whenMonth: nowMonth,
        monthsAway: 0,
        state: headroom < 0 ? "open" : "approaching",
        whyNowKey: "turningPoint.why.emergency_floor_near",
        whyNowParams: { buffer: ef.bufferMonths, floor: ef.floorMonths },
        ifYouWaitKey: "turningPoint.wait.emergency_floor_near",
        openFutures: ["slow_a_plan", "rebuild_from_available", "pause_a_commitment"],
        evidence: { bufferMonths: ef.bufferMonths, floorMonths: ef.floorMonths },
      });
    }
  }

  for (const fr of sources.fragments ?? []) {
    if (fr.state !== "unclaimed" || !fr.validUntil) continue;
    const d = new Date(fr.validUntil);
    const daysAway = Math.ceil((d - now) / 86400000);
    if (daysAway >= 0 && daysAway <= 45) {
      points.push({
        id: `fragment:${fr.branchId}`,
        kind: "fragment_expiring",
        domain: fr.domain,
        whenMonth: monthKey(d),
        monthsAway: Math.max(0, Math.round(daysAway / 30)),
        state: daysAway <= 14 ? "open" : "approaching",
        whyNowKey: "turningPoint.why.fragment_expiring",
        whyNowParams: { days: daysAway },
        ifYouWaitKey: "turningPoint.wait.fragment_expiring",
        openFutures: ["allocate_now", "keep_flexible"],
        evidence: { validUntil: fr.validUntil },
      });
    }
  }

  for (const c of sources.completions ?? []) {
    const mUntil = monthsUntil(c.endMonth, now);
    if (mUntil == null) continue;
    if (mUntil <= APPROACHING_WITHIN_MONTHS) {
      points.push({
        id: `completion:${c.commitmentId}`,
        kind: "commitment_completing",
        domain: c.domain,
        whenMonth: c.endMonth,
        monthsAway: Math.max(0, mUntil),
        state: mUntil <= 0 ? "open" : "approaching",
        whyNowKey: "turningPoint.why.commitment_completing",
        whyNowParams: { amount: Math.round(c.monthlyReleased ?? 0) },
        ifYouWaitKey: "turningPoint.wait.commitment_completing",
        openFutures: ["hand_off_to_a_goal", "rebuild_safety", "keep_flexible"],
        evidence: { endMonth: c.endMonth, monthlyReleased: c.monthlyReleased },
      });
    }
  }

  points.sort((a, b) => {
    const rank = { open: 0, approaching: 1, sealed: 2 };
    return rank[a.state] - rank[b.state] || a.monthsAway - b.monthsAway;
  });

  return {
    points,
    nextDecision: points.find((p) => p.state === "open") ?? points[0] ?? null,
    openCount: points.filter((p) => p.state === "open").length,
    approachingCount: points.filter((p) => p.state === "approaching").length,
  };
}
