import { getCurrentUserId } from "../../../lib/auth.js";
import { guard } from "../../../lib/http-guards.js";
import { buildMoneyMoments } from "../../../lib/money-moments/build.js";
import { buildFinancialTwinBundle } from "../../../lib/financial-twin/bundle.js";
import { listEvents } from "../../../lib/change-ledger/store.js";
import { listMySupervisors, listSupervisedByMe } from "../../../lib/care/link-store.js";
import { deriveLifeStage } from "../../../lib/guardian/lifecycle.js";
import { reduceGuardianStatus } from "../../../lib/guardian/status.js";
import { buildProtectionDomains } from "../../../lib/guardian/protection.js";
import { buildGuardianProof } from "../../../lib/guardian/proof.js";
import { getContracts, setContract, resetContracts, contractSummary } from "../../../lib/guardian/contract.js";
import { buildGuardianDecision } from "../../../lib/guardian/decision.js";
import { buildLifeThread } from "../../../lib/life-thread/service.js";
import { buildPromiseShield } from "../../../lib/guardian/promise-shield.js";
import { detectCollision } from "../../../lib/guardian/collision.js";
import { buildRecoveryPlan } from "../../../lib/guardian/recovery.js";
import { applyCollisionPath, applyRecoveryStep } from "../../../lib/guardian/apply.js";

export const runtime = "nodejs";

// GET /api/guardian              -> the three layers + the Guardian Contract
// GET /api/guardian?decision=<id> -> the before/after impact of one parked
//                                    money move, with its evidence + time
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const decisionId = new URL(request.url).searchParams.get("decision");
  if (decisionId) {
    try {
      const d = await buildGuardianDecision(userId, decisionId);
      if (!d) return Response.json({ error: "decision_not_found" }, { status: 404 });
      return Response.json(d);
    } catch (error) {
      console.error("[guardian] decision failed:", error?.message);
      return Response.json({ error: "guardian_unavailable" }, { status: 500 });
    }
  }
  try {
    const [mm, bundle, events, contracts, supervisors, iSupervise, lt] = await Promise.all([
      buildMoneyMoments(userId).catch(() => ({ isEmpty: true, moments: [] })),
      buildFinancialTwinBundle(userId).catch(() => ({ twin: null })),
      listEvents(userId, { filter: "all", limit: 8 }).catch(() => []),
      getContracts(userId),
      listMySupervisors(userId).catch(() => []),
      listSupervisedByMe(userId).catch(() => []),
      buildLifeThread(userId).catch(() => ({ commitments: [], availableMonthlyCashflow: null })),
    ]);
    const mmForGuardian = { ...mm, hasSharedAccess: supervisors.length > 0 };
    return Response.json({
      now: reduceGuardianStatus(mmForGuardian),
      protection: buildProtectionDomains({ twin: bundle.twin, mm: mmForGuardian }),
      stage: deriveLifeStage({
        supervisedByOthers: supervisors.length,
        iSupervise: iSupervise.length,
        commitments: lt.commitments ?? [],
        belowSafetyFloor: Boolean(mm.bankNow?.belowProtectedFloor) || (bundle.rescueCases ?? []).length > 0,
      }),
      proof: buildGuardianProof(events),
      contract: { capabilities: contracts, summary: contractSummary(contracts) },
      promiseShield: buildPromiseShield({ twin: bundle.twin, safeToSpend: bundle.safeToSpend }),
      collision: detectCollision({
        commitments: lt.commitments ?? [],
        // money available for plans = what's left after living costs, before commitments
        availableMonthly: lt.availableMonthlyCashflow == null ? null : lt.availableMonthlyCashflow + (lt.monthlyCommittedTotal ?? 0),
      }),
      recovery: buildRecoveryPlan({ safeToSpend: bundle.safeToSpend, rescueCases: bundle.rescueCases ?? [], commitments: lt.commitments ?? [] }),
    });
  } catch (error) {
    console.error("[guardian] GET failed:", error?.message);
    return Response.json({ error: "guardian_unavailable" }, { status: 500 });
  }
}

// POST /api/guardian
//   { action: "set_contract", capability, level }   -> raise / lower one capability
//   { action: "reset_contract" }                    -> back to defaults (the "revoke")
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "guardian", limit: 40 });
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "set_contract") {
      const contracts = await setContract(userId, body.capability, body.level);
      return Response.json({ contract: { capabilities: contracts, summary: contractSummary(contracts) } });
    }
    if (body.action === "reset_contract") {
      const contracts = await resetContracts(userId);
      return Response.json({ contract: { capabilities: contracts, summary: contractSummary(contracts) } });
    }
    if (body.action === "apply_collision_path") {
      if (!body.pathId) return Response.json({ error: "pathId_required" }, { status: 400 });
      return Response.json(await applyCollisionPath(userId, body.pathId));
    }
    if (body.action === "apply_recovery_step") {
      if (body.order == null) return Response.json({ error: "order_required" }, { status: 400 });
      return Response.json(await applyRecoveryStep(userId, body.order));
    }
    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
