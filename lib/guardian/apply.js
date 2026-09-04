// Guardian Phase 3 — the commit side. Choosing a Collision Radar path, or
// confirming a Recovery step, actually changes the plans (pause / reduce a
// commitment) and writes a Change Ledger event, so Today / Life / Guardian
// all move together. Guardian never runs these on its own — a choice from
// the user is the confirmation.

import { buildLifeThread } from "../life-thread/service.js";
import { getActiveCommitment, pauseCommitment, reduceCommitment } from "../goal-commitment-store.js";
import { detectCollision } from "./collision.js";
import { buildRecoveryPlan } from "./recovery.js";
import { buildFinancialTwinBundle } from "../financial-twin/bundle.js";
import { recordEventSafe } from "../change-ledger/store.js";
import { ACTION_TYPES } from "../change-ledger/events.js";
import { recordAuditEvent } from "../account-control/store.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function currentCollision(profileKey) {
  const lt = await buildLifeThread(profileKey);
  return {
    lt,
    collision: detectCollision({
      commitments: lt.commitments ?? [],
      availableMonthly: lt.availableMonthlyCashflow == null ? null : lt.availableMonthlyCashflow + (lt.monthlyCommittedTotal ?? 0),
    }),
  };
}

export async function applyCollisionPath(profileKey, pathId) {
  const { lt, collision } = await currentCollision(profileKey);
  if (!collision.collision) return { ok: false, reason: "no_collision" };
  const path = collision.paths.find((p) => p.id === pathId);
  if (!path) return { ok: false, reason: "unknown_path" };

  const beforeAvailable = round2(lt.availableMonthlyCashflow ?? 0);
  let freed = 0;
  const changed = [];

  const t = path.target;
  if (t.op === "pause") {
    const c = await getActiveCommitment(profileKey, t.domain);
    if (c) {
      await pauseCommitment(c.id, profileKey, { reason: "guardian_collision_path" });
      freed += Number(c.monthly_contribution) || 0;
      changed.push({ domain: t.domain, op: "paused", amount: Number(c.monthly_contribution) || 0 });
    }
  } else if (t.op === "reduce") {
    const c = await getActiveCommitment(profileKey, t.domain);
    if (c) {
      const res = await reduceCommitment(c.id, profileKey, t.to);
      const delta = (Number(c.monthly_contribution) || 0) - (res?.to ?? 0);
      freed += delta;
      changed.push({ domain: t.domain, op: "reduced", from: res?.from, to: res?.to });
    }
  } else if (t.op === "reduce_both") {
    for (const domain of t.domains) {
      const c = await getActiveCommitment(profileKey, domain);
      if (!c) continue;
      const cur = Number(c.monthly_contribution) || 0;
      const to = Math.max(0, round2(cur - t.each));
      const res = await reduceCommitment(c.id, profileKey, to);
      freed += cur - (res?.to ?? to);
      changed.push({ domain, op: "reduced", from: cur, to: res?.to ?? to });
    }
  }

  freed = round2(freed);
  const afterAvailable = round2(beforeAvailable + freed);
  await recordEventSafe({
    profileKey,
    actor: "user",
    sourceFeature: "guardian",
    actionType: ACTION_TYPES.PLAN_UPDATED,
    status: "scheduled",
    messageKey: "ledger.collisionPathChosen",
    messageParams: { pathId, freed },
    cause: { trigger: "guardian_collision_path", pathId, competing: collision.competing, changed },
    impactSet: [
      { goalId: "cashflow", metric: "freeMonthlyCashflow", before: beforeAvailable, after: afterAvailable, unit: "sgd_per_month", direction: "up" },
    ],
    uncertaintyNote: freed > 0 ? null : "Recorded — no commitment was active to change yet.",
    dedupeKey: `guardian_collision:${pathId}:${new Date().toISOString().slice(0, 13)}`,
  }).catch(() => {});
  await recordAuditEvent(null, profileKey, { kind: "guardian_collision_path_applied", detail: { pathId, freed, changed } });

  const after = await currentCollision(profileKey);
  return { ok: true, freed, changed, collision: after.collision };
}

// Confirm one Recovery step (only the pausable-plans step actually changes
// anything; the rest are Guardian holding a line, not an action).
export async function applyRecoveryStep(profileKey, order) {
  const bundle = await buildFinancialTwinBundle(profileKey).catch(() => ({}));
  const lt = await buildLifeThread(profileKey);
  const plan = buildRecoveryPlan({
    safeToSpend: bundle.safeToSpend,
    rescueCases: bundle.rescueCases ?? [],
    commitments: lt.commitments ?? [],
  });
  const step = plan.steps.find((s) => s.order === Number(order));
  if (!step) return { ok: false, reason: "unknown_step" };
  if (step.kind !== "pause_plans" || !(step.targets?.length)) {
    await recordAuditEvent(null, profileKey, { kind: "guardian_recovery_step_ack", detail: { order, kind: step.kind } });
    return { ok: true, acknowledged: true };
  }

  let freed = 0;
  for (const domain of step.targets) {
    const c = await getActiveCommitment(profileKey, domain);
    if (c) {
      await pauseCommitment(c.id, profileKey, { reason: "guardian_recovery" });
      freed += Number(c.monthly_contribution) || 0;
    }
  }
  freed = round2(freed);
  const before = round2(lt.availableMonthlyCashflow ?? 0);
  await recordEventSafe({
    profileKey,
    actor: "user",
    sourceFeature: "guardian",
    actionType: ACTION_TYPES.COMMITMENT_PAUSED,
    status: "paused",
    messageKey: "ledger.recoveryPausedPlans",
    messageParams: { freed },
    cause: { trigger: "guardian_recovery", targets: step.targets },
    impactSet: [
      { goalId: "cashflow", metric: "freeMonthlyCashflow", before, after: round2(before + freed), unit: "sgd_per_month", direction: "up" },
    ],
    uncertaintyNote: freed > 0 ? null : "No pausable plan was active.",
    dedupeKey: `guardian_recovery_pause:${new Date().toISOString().slice(0, 13)}`,
  }).catch(() => {});
  await recordAuditEvent(null, profileKey, { kind: "guardian_recovery_step_applied", detail: { order, freed } });
  return { ok: true, freed };
}
