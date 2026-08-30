import { getCurrentUserId } from "../../../../lib/auth.js";
import { query } from "../../../../lib/db.js";
import { buildHandoffCandidate } from "../../../../lib/living-plan/future-handoff.js";
import { validateAllocation } from "../../../../lib/living-plan/allocation.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import { buildHandoverEvent } from "../../../../lib/change-ledger/producers/future-field.js";

export const runtime = "nodejs";

// The customer's real active goal domains - the only valid "goal"-leg
// destinations for a handoff.
async function activeGoalDomains(userId) {
  const { rows } = await query(
    `select distinct domain from goal_commitments where profile_key = $1 and status = 'active'
     union
     select distinct domain from plans where profile_key = $1`,
    [userId],
  );
  return rows.map((r) => r.domain).filter(Boolean);
}

// Future Handoff: a completed or revoked commitment releases its real
// monthly resource. GET lists candidates; POST confirms an allocation of
// one to an EXPLICIT target goal. Nothing is applied to other goals until
// the customer confirms, and goalMonthly never means Home by default.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [{ rows }, activeGoals] = await Promise.all([
    query(
      `select id, domain, monthly_contribution, status, effective_month, revoked_at, source_moment
       from goal_commitments
       where profile_key = $1 and status = 'revoked'
       order by revoked_at desc nulls last limit 20`,
      [userId],
    ),
    activeGoalDomains(userId),
  ]);

  const candidates = rows
    .map((r) =>
      buildHandoffCandidate({
        commitment: {
          id: r.id,
          domain: r.domain,
          monthly_contribution: r.monthly_contribution,
          status: "active", // it WAS active; the release is real
          effectiveMonth: r.effective_month,
          source_moment: r.source_moment,
        },
        reason: "revoked",
        activeGoals,
      }),
    )
    .filter(Boolean);

  return Response.json({ candidates });
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { fromCommitmentId, allocation } = body;
  const targetGoalId = typeof body.targetGoalId === "string" ? body.targetGoalId : null;
  if (!fromCommitmentId) return Response.json({ error: "missing_commitment" }, { status: 400 });

  const [{ rows }, activeGoals] = await Promise.all([
    query(
      `select id, domain, monthly_contribution, effective_month, source_moment from goal_commitments where id = $1 and profile_key = $2`,
      [fromCommitmentId, userId],
    ),
    activeGoalDomains(userId),
  ]);
  const c = rows[0];
  if (!c) return Response.json({ error: "not_found" }, { status: 404 });

  const candidate = buildHandoffCandidate({
    commitment: { id: c.id, domain: c.domain, monthly_contribution: c.monthly_contribution, status: "active", effectiveMonth: c.effective_month, source_moment: c.source_moment },
    reason: "revoked",
    allocation,
    targetGoalId,
    activeGoals,
  });
  if (!candidate) return Response.json({ error: "nothing_released" }, { status: 409 });

  const check = validateAllocation({ freedCashflow: candidate.releasedMonthly, allocation });
  if (!check.ok) return Response.json({ error: check.error, releasedMonthly: candidate.releasedMonthly }, { status: 422 });

  // The "goal" leg requires an explicit, valid target. Without one the
  // whole amount stays Flexible - it is never quietly routed to Home.
  const goalLegFunded = Number(check.allocation.goalMonthly) > 0;
  if (goalLegFunded && !candidate.targetGoalId) {
    return Response.json({ error: "missing_or_invalid_target", targets: candidate.targets }, { status: 422 });
  }
  const resolvedTarget = goalLegFunded
    ? candidate.targetGoalId
    : Number(check.allocation.emergencyMonthly) > 0
      ? "emergency"
      : "flexible";
  const residualAmount = goalLegFunded
    ? Number(check.allocation.goalMonthly)
    : resolvedTarget === "emergency"
      ? Number(check.allocation.emergencyMonthly)
      : Number(check.allocation.flexibleMonthly);

  await query(
    `update goal_commitments set source_moment = source_moment || $1::jsonb where id = $2 and profile_key = $3`,
    [
      JSON.stringify({
        handoff: { allocation: check.allocation, targetGoalId: resolvedTarget, confirmedAt: new Date().toISOString() },
      }),
      fromCommitmentId,
      userId,
    ],
  );

  const ledger = await recordEventSafe(
    buildHandoverEvent({
      profileKey: userId,
      fromDomain: c.domain,
      toDomain: resolvedTarget,
      transitionType: `${c.domain}_handoff`,
      residualAmount,
      transitionId: `${fromCommitmentId}:handoff`,
    }),
  );

  return Response.json({
    handoff: candidate,
    allocation: check.allocation,
    targetGoalId: resolvedTarget,
    unallocated: check.unallocated,
    ledgerEventId: ledger?.event?.id ?? null,
  });
}
