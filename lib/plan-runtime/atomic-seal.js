// Atomic, server-authoritative allocation + Seal (Living Thread,
// causal-spine round - blocker 4).
//
// EVERYTHING happens inside ONE database transaction:
//   1. FOR UPDATE lock the branch
//   2. FOR UPDATE lock the current plan version, check base_version ->
//      a stale branch is a 409, never an overwrite
//   3. recompute feasibility / pins / impactSet / resourceDelta from the
//      LOCKED branch data - the caller's pre-read branchData is never used
//   4. validate the allocation against the SERVER-recomputed freed amount
//   5. write the commitment, Guardian policy, Ledger events
//   6. update the branch status + plan state
// Any throw rolls the whole thing back.

import { withTransaction, query } from "../db.js";
import { recordEvent } from "../change-ledger/store.js";
import { normalizeAllocation, allocationSum } from "../living-plan/allocation.js";
import { buildBranchSealedEvent } from "../change-ledger/producers/future-field.js";
import { buildHomeCommitmentCreatedEvent } from "../change-ledger/producers/home.js";
import { buildSavingsPlanConfirmedEvent } from "../change-ledger/producers/goal-plan.js";

export function resolveAllowedTargets(activeGoalDomains = []) {
  return Array.from(new Set([...(activeGoalDomains ?? []), "emergency"]));
}

// Pure. Still exported for the preview path; confirm re-runs it inside the
// transaction with the server-recomputed freed amount.
export function validateSealAllocation({ allocation, allocationTargetGoalId = null, freedCashflow = 0, addedPressure = 0, allowedTargets = [] }) {
  const a = normalizeAllocation(allocation);
  const sum = allocationSum(a);
  if (sum <= 0) return { ok: true, allocation: null, targetGoalId: null };

  const budget = (Number(freedCashflow) || 0) > 0 ? Number(freedCashflow) : Number(addedPressure) || 0;
  if (budget <= 0) return { ok: false, error: "nothing_to_allocate" };
  if (sum > budget + 0.5) return { ok: false, error: "over_allocated", sum, budget };

  if (a.goalMonthly > 0) {
    if (!allocationTargetGoalId) return { ok: false, error: "missing_allocation_target" };
    if (!allowedTargets.includes(allocationTargetGoalId)) {
      return { ok: false, error: "target_not_active_goal", allowedTargets };
    }
  }
  const targetGoalId = a.goalMonthly > 0 ? allocationTargetGoalId : a.emergencyMonthly > 0 ? "emergency" : "flexible";
  return { ok: true, allocation: a, targetGoalId };
}

// Idempotency is per USER: (profile_key, source_moment->>'idempotencyKey').
export async function findSealByIdempotencyKey(profileKey, idempotencyKey) {
  if (!idempotencyKey) return null;
  const { rows } = await query(
    `select * from goal_commitments
     where profile_key = $1 and status = 'active' and source_moment->>'idempotencyKey' = $2
     order by created_at desc limit 1`,
    [profileKey, String(idempotencyKey)],
  );
  return rows[0] ?? null;
}

function fail(code, extra = {}) {
  const e = new Error(code.toLowerCase());
  e.code = code;
  Object.assign(e, extra);
  return e;
}

// `recompute(lockedBranchData, priorReality)` MUST return
//   { feasibility, constraintCheck, serverFreed, serverAddedPressure }
// computed only from its arguments (server truth). `realityData` is the
// current reality used to reconstruct the branch's prior reality overlay.
export async function sealAtomic({
  profileKey,
  domain,
  planId,
  branchId,
  monthlyAmount,
  effectiveMonth,
  readyMonth = null,
  delayMonths = null,
  priorMonthlyContribution = 0,
  supersededSavingsPlan = null,
  emergencyFloorMonths,
  allocationInput = null,
  allocationTargetGoalId = null,
  allowedTargets = [],
  realityData = {},
  recompute,
  sealPreview,
  idempotencyKey = null,
}) {
  if (typeof recompute !== "function") throw fail("RECOMPUTE_REQUIRED");

  return withTransaction(async (tx) => {
    // 1. lock the branch (reality-path seals have no branch)
    let lockedBranch = null;
    if (branchId) {
      const { rows } = await tx.query(
        `select id, plan_id, profile_key, data, delta, base_version, status
         from plan_branches where id = $1 and profile_key = $2 for update`,
        [branchId, profileKey],
      );
      lockedBranch = rows[0] ?? null;
      if (!lockedBranch) throw fail("BRANCH_NOT_FOUND");
      if (planId && lockedBranch.plan_id && String(lockedBranch.plan_id) !== String(planId)) throw fail("BRANCH_PLAN_MISMATCH");
      if (["discarded", "merged", "sealed", "withdrawn"].includes(lockedBranch.status)) {
        throw fail("BRANCH_NOT_SEALABLE", { branchStatus: lockedBranch.status });
      }
    }

    // 2. lock the current plan version + stale-branch check
    let currentPlanVersion = null;
    if (planId) {
      const { rows } = await tx.query(
        `select version, data from plan_versions where plan_id = $1 order by created_at desc limit 1 for update`,
        [planId],
      );
      currentPlanVersion = rows[0] ?? null;
    }
    if (lockedBranch?.base_version != null && currentPlanVersion?.version != null && String(lockedBranch.base_version) !== String(currentPlanVersion.version)) {
      throw fail("STALE_BRANCH", {
        branchBaseVersion: String(lockedBranch.base_version),
        currentPlanVersion: String(currentPlanVersion.version),
      });
    }

    // 3. recompute feasibility / pins / impactSet SERVER-SIDE from the
    //    LOCKED branch data (never the caller's pre-read copy).
    const lockedBranchData = lockedBranch?.data ?? currentPlanVersion?.data ?? realityData;
    const beforeOverlay = lockedBranch?.delta?.before && typeof lockedBranch.delta.before === "object" ? lockedBranch.delta.before : {};
    const priorReality = { ...(currentPlanVersion?.data ?? realityData), ...beforeOverlay };
    const srv = recompute(lockedBranchData, priorReality) ?? {};
    if (srv.feasibility && srv.feasibility.sealable === false) {
      throw fail("NOT_SEALABLE", { reason: srv.feasibility.sealableReason ?? "not_sealable", budgetGap: srv.feasibility.budgetGap ?? null });
    }
    if (srv.constraintCheck && srv.constraintCheck.ok === false) {
      throw fail("VIOLATES_PINS", { violations: srv.constraintCheck.violations ?? [] });
    }
    const serverFreed = Math.max(0, Math.round(Number(srv.serverFreed) || 0));
    const serverAddedPressure = Math.max(0, Math.round(Number(srv.serverAddedPressure) || 0));

    // 4. validate the allocation against the SERVER freed amount
    const allocCheck = validateSealAllocation({
      allocation: allocationInput,
      allocationTargetGoalId,
      freedCashflow: serverFreed,
      addedPressure: serverAddedPressure,
      allowedTargets,
    });
    if (!allocCheck.ok) throw fail("BAD_ALLOCATION", { allocationError: allocCheck.error, allowedTargets });
    const normAllocation = allocCheck.allocation;
    const hasAllocation = Boolean(normAllocation && allocationSum(normAllocation) > 0);
    const targetGoalId = allocCheck.targetGoalId;

    // 5a. persist the allocation onto the LOCKED branch data
    if (branchId && lockedBranch) {
      const nextData = {
        ...lockedBranchData,
        allocation: hasAllocation ? normAllocation : null,
        allocationGoalId: hasAllocation ? targetGoalId : null,
      };
      await tx.query(`update plan_branches set data = $1::jsonb, updated_at = now() where id = $2 and profile_key = $3`, [
        JSON.stringify(nextData),
        branchId,
        profileKey,
      ]);
    }

    // 5b. create the commitment (per-user idempotency key inside source_moment)
    const sourceMoment = {
      source: "life_thread_atomic_seal",
      branchId: branchId ?? null,
      baseVersion: lockedBranch?.base_version ?? null,
      sealedAgainstPlanVersion: currentPlanVersion?.version ?? null,
      delayMonths,
      serverFreed,
      serverAddedPressure,
      allocation: hasAllocation ? normAllocation : null,
      allocationTargetGoalId: hasAllocation ? targetGoalId : null,
      idempotencyKey: idempotencyKey ?? null,
    };
    let commitment;
    try {
      const { rows } = await tx.query(
        `insert into goal_commitments
           (profile_key, domain, monthly_contribution, effective_month, pause_if_emergency_months_below,
            source_moment, superseded_savings_plan, prior_monthly_contribution, plan_id, plan_branch_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
        [
          profileKey,
          domain,
          monthlyAmount,
          effectiveMonth,
          emergencyFloorMonths,
          JSON.stringify(sourceMoment),
          supersededSavingsPlan ? JSON.stringify(supersededSavingsPlan) : null,
          priorMonthlyContribution,
          planId ?? null,
          branchId ?? null,
        ],
      );
      commitment = rows[0];
    } catch (error) {
      if (error?.code === "23505") {
        // one-active-per-domain OR the per-user idempotency key. Surface
        // an idempotent hit if the key already has an active commitment.
        throw fail("SEAL_UNIQUE_VIOLATION");
      }
      throw error;
    }

    // 6. Guardian policy
    await tx.query(
      `update guardian_policies set active = false, revoked_at = now()
       where profile_key = $1 and active = true and (plan_id is not distinct from $2::uuid)`,
      [profileKey, planId ?? null],
    );
    const pauseConditions = [
      { kind: "emergency_floor_months", operator: "lt", value: emergencyFloorMonths },
      ...(hasAllocation
        ? [{ kind: "tracked_allocation", targetGoalId, goalMonthly: Number(normAllocation.goalMonthly) || 0, emergencyMonthly: Number(normAllocation.emergencyMonthly) || 0 }]
        : []),
    ];
    await tx.query(
      `insert into guardian_policies
         (profile_key, plan_id, commitment_id, can_move_money, can_reschedule, can_notify, pause_conditions, reconfirm_after_days)
       values ($1,$2,$3,false,false,true,$4,180)`,
      [profileKey, planId ?? null, commitment.id, JSON.stringify(pauseConditions)],
    );

    // 7. Ledger events (same tx)
    const sealedDraft = buildBranchSealedEvent({ profileKey, domain, planId, branchId, monthlyAmount, sealPreview });
    sealedDraft.commitmentId = commitment.id;
    if (idempotencyKey) sealedDraft.dedupeKey = `${sealedDraft.dedupeKey ?? "branch_sealed"}:${idempotencyKey}`;
    const sealedRes = await recordEvent(sealedDraft, { client: tx });

    const commitmentDraft =
      domain === "home"
        ? buildHomeCommitmentCreatedEvent({
            profileKey,
            commitmentId: commitment.id,
            priorMonthlyContribution,
            newMonthlyContribution: monthlyAmount,
            effectiveMonth,
            readyMonthBefore: null,
            readyMonthAfter: readyMonth,
            monthsDelta: delayMonths,
            reasonCode: "life_thread_atomic_seal",
            reasonParams: {},
            emergencyFloorMonths,
          })
        : buildSavingsPlanConfirmedEvent({
            profileKey,
            domain,
            monthlyContribution: monthlyAmount,
            priorMonthlyContribution,
            targetCompleteMonth: readyMonth,
          });
    commitmentDraft.commitmentId = commitment.id;
    if (idempotencyKey) commitmentDraft.dedupeKey = `${commitmentDraft.dedupeKey ?? "commitment_created"}:${idempotencyKey}`;
    const commitmentRes = await recordEvent(commitmentDraft, { client: tx });

    // 8. mark the branch sealed + move the plan to scheduled
    if (branchId) {
      await tx.query(`update plan_branches set status = 'sealed', sealed_commitment_id = $1, updated_at = now() where id = $2 and profile_key = $3`, [
        commitment.id,
        branchId,
        profileKey,
      ]);
    }
    if (planId) {
      await tx.query(
        `update plans set state = 'scheduled', updated_at = now()
         where id = $1 and profile_key = $2 and state in ('draft','shadow','proposed')`,
        [planId, profileKey],
      );
    }

    return {
      commitment,
      allocation: hasAllocation ? normAllocation : null,
      targetGoalId: hasAllocation ? targetGoalId : null,
      serverComputed: { freedCashflow: serverFreed, addedPressure: serverAddedPressure, sealedAgainstPlanVersion: currentPlanVersion?.version ?? null },
      ledgerEventIds: [sealedRes?.event?.id ?? null, commitmentRes?.event?.id ?? null].filter(Boolean),
    };
  });
}
