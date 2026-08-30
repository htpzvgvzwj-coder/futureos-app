// Atomic allocation + Seal.
//
// Part 0.1: allocation and Seal are ONE server operation inside ONE database
// transaction. Validate branch ownership, allocation total and target goal;
// persist the allocation onto the branch; create the commitment; create the
// Guardian policy; record the Ledger events. If any step throws, the
// transaction rolls back and nothing persists - an allocation failure can
// never leave a sealed commitment behind.

import { withTransaction, query } from "../db.js";
import { recordEvent } from "../change-ledger/store.js";
import { normalizeAllocation, allocationSum } from "../living-plan/allocation.js";
import { buildBranchSealedEvent } from "../change-ledger/producers/future-field.js";
import { buildHomeCommitmentCreatedEvent } from "../change-ledger/producers/home.js";
import { buildSavingsPlanConfirmedEvent } from "../change-ledger/producers/goal-plan.js";

// The goal ids an allocation "goal" leg is allowed to target: the
// customer's real active goal domains, plus emergency. "flexible" and the
// no-goal-leg cases carry no target.
export function resolveAllowedTargets(activeGoalDomains = []) {
  return Array.from(new Set([...(activeGoalDomains ?? []), "emergency"]));
}

// Pure pre-flight. Returns { ok, error } - the route turns a non-ok into a
// 422 BEFORE opening the transaction.
export function validateSealAllocation({ allocation, allocationTargetGoalId = null, freedCashflow = 0, addedPressure = 0, allowedTargets = [] }) {
  const a = normalizeAllocation(allocation);
  const sum = allocationSum(a);
  if (sum <= 0) return { ok: true, allocation: null, targetGoalId: null }; // nothing allocated - stays flexible/unallocated

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

// Look up any already-sealed commitment for this idempotency key so a retry
// / double-submit is a no-op that returns the same commitment.
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

// The one transaction.
export async function sealAtomic({
  profileKey,
  domain,
  planId,
  branchId,
  branchData = null,
  monthlyAmount,
  effectiveMonth,
  readyMonth = null,
  delayMonths = null,
  priorMonthlyContribution = 0,
  supersededSavingsPlan = null,
  emergencyFloorMonths,
  allocation,
  targetGoalId,
  sealPreview,
  idempotencyKey = null,
}) {
  const normAllocation = allocation ? normalizeAllocation(allocation) : null;
  const hasAllocation = normAllocation && allocationSum(normAllocation) > 0;

  return withTransaction(async (tx) => {
    // 1. branch ownership + lock (reality-path seals have no branch)
    let lockedBranch = null;
    if (branchId) {
      const { rows } = await tx.query(
        `select id, plan_id, profile_key, data, base_version, status from plan_branches where id = $1 and profile_key = $2 for update`,
        [branchId, profileKey],
      );
      lockedBranch = rows[0] ?? null;
      if (!lockedBranch) {
        const e = new Error("branch_not_found");
        e.code = "BRANCH_NOT_FOUND";
        throw e;
      }
      if (planId && lockedBranch.plan_id && String(lockedBranch.plan_id) !== String(planId)) {
        const e = new Error("branch_plan_mismatch");
        e.code = "BRANCH_PLAN_MISMATCH";
        throw e;
      }
    }

    // 2. persist the allocation onto the branch data (same tx)
    if (branchId && lockedBranch) {
      const nextData = {
        ...(branchData ?? lockedBranch.data ?? {}),
        allocation: hasAllocation ? normAllocation : null,
        allocationGoalId: hasAllocation ? targetGoalId : null,
      };
      await tx.query(`update plan_branches set data = $1::jsonb, updated_at = now() where id = $2 and profile_key = $3`, [
        JSON.stringify(nextData),
        branchId,
        profileKey,
      ]);
    }

    // 3. create the commitment
    const sourceMoment = {
      source: "life_thread_atomic_seal",
      branchId: branchId ?? null,
      baseVersion: lockedBranch?.base_version ?? null,
      delayMonths,
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
        const e = new Error("active_commitment_exists");
        e.code = "ACTIVE_COMMITMENT_EXISTS";
        throw e;
      }
      throw error;
    }

    // 4. Guardian policy (deactivate any prior for this plan, then insert)
    await tx.query(
      `update guardian_policies set active = false, revoked_at = now()
       where profile_key = $1 and active = true and (plan_id is not distinct from $2::uuid)`,
      [profileKey, planId ?? null],
    );
    const pauseConditions = [
      { kind: "emergency_floor_months", operator: "lt", value: emergencyFloorMonths },
      ...(hasAllocation
        ? [
            {
              kind: "tracked_allocation",
              targetGoalId,
              goalMonthly: Number(normAllocation.goalMonthly) || 0,
              emergencyMonthly: Number(normAllocation.emergencyMonthly) || 0,
            },
          ]
        : []),
    ];
    await tx.query(
      `insert into guardian_policies
         (profile_key, plan_id, commitment_id, can_move_money, can_reschedule, can_notify, pause_conditions, reconfirm_after_days)
       values ($1,$2,$3,false,false,true,$4,180)`,
      [profileKey, planId ?? null, commitment.id, JSON.stringify(pauseConditions)],
    );

    // 5. Ledger events - same tx via recordEvent's client option
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

    // 6. mark the branch sealed + move the plan to scheduled (same tx)
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
      ledgerEventIds: [sealedRes?.event?.id ?? null, commitmentRes?.event?.id ?? null].filter(Boolean),
    };
  });
}
