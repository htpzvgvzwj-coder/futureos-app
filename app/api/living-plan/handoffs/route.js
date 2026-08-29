import { getCurrentUserId } from "../../../../lib/auth.js";
import { query } from "../../../../lib/db.js";
import { buildHandoffCandidate } from "../../../../lib/living-plan/future-handoff.js";
import { validateAllocation } from "../../../../lib/living-plan/allocation.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import { buildHandoverEvent } from "../../../../lib/change-ledger/producers/future-field.js";

export const runtime = "nodejs";

// Future Handoff: a completed or revoked commitment releases its real
// monthly resource. GET lists the candidates; POST confirms an allocation
// of one. Nothing is applied to other goals until the customer confirms.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Revoked commitments (real released resource). "Completed" would come
  // from a real end-date signal, not yet modelled - only revoked today.
  const { rows } = await query(
    `select id, domain, monthly_contribution, status, effective_month, revoked_at, source_moment
     from goal_commitments
     where profile_key = $1 and status = 'revoked'
     order by revoked_at desc nulls last limit 20`,
    [userId],
  );

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
  if (!fromCommitmentId) return Response.json({ error: "missing_commitment" }, { status: 400 });

  const { rows } = await query(
    `select id, domain, monthly_contribution, effective_month, source_moment from goal_commitments where id = $1 and profile_key = $2`,
    [fromCommitmentId, userId],
  );
  const c = rows[0];
  if (!c) return Response.json({ error: "not_found" }, { status: 404 });

  const candidate = buildHandoffCandidate({
    commitment: { id: c.id, domain: c.domain, monthly_contribution: c.monthly_contribution, status: "active", effectiveMonth: c.effective_month, source_moment: c.source_moment },
    reason: "revoked",
    allocation,
  });
  if (!candidate) return Response.json({ error: "nothing_released" }, { status: 409 });

  const check = validateAllocation({ freedCashflow: candidate.releasedMonthly, allocation });
  if (!check.ok) return Response.json({ error: check.error, releasedMonthly: candidate.releasedMonthly }, { status: 422 });

  // Persist the confirmed handoff allocation on the commitment's own
  // source_moment (no new table). It only becomes real once confirmed here.
  await query(
    `update goal_commitments set source_moment = source_moment || $1::jsonb where id = $2 and profile_key = $3`,
    [JSON.stringify({ handoff: { allocation: check.allocation, confirmedAt: new Date().toISOString() } }), fromCommitmentId, userId],
  );

  const primaryLeg = check.allocation.goalMonthly > 0 ? "home" : check.allocation.emergencyMonthly > 0 ? "emergency" : "flexible";
  const ledger = await recordEventSafe(
    buildHandoverEvent({
      profileKey: userId,
      fromDomain: c.domain,
      toDomain: primaryLeg,
      transitionType: `${c.domain}_handoff`,
      residualAmount: check.allocation[`${primaryLeg === "home" ? "goal" : primaryLeg}Monthly`] ?? check.allocation.flexibleMonthly,
      transitionId: `${fromCommitmentId}:handoff`,
    }),
  );

  return Response.json({ handoff: candidate, allocation: check.allocation, unallocated: check.unallocated, ledgerEventId: ledger?.event?.id ?? null });
}
