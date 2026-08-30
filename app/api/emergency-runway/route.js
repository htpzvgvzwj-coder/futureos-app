import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";
import { getStrategicBalanceSnapshot } from "../../../lib/strategic-balance-context.js";
import { computeSafetyRunway, rehearseShock, requiredRebuildForTarget } from "../../../lib/emergency/runway-finance.js";
import { projectRunwayImpact } from "../../../lib/emergency/runway-projector.js";
import { buildImpactSet } from "../../../lib/living-plan/studio-contract.js";

export const runtime = "nodejs";

// The customer's REAL confirmed commitments to place on the runway - active
// goal commitments + confirmed loans. Nothing fabricated.
async function realCommitments(userId) {
  const [{ rows: commits }, strategic] = await Promise.all([
    query(`select id, domain, monthly_contribution from goal_commitments where profile_key = $1 and status = 'active'`, [userId]),
    getStrategicBalanceSnapshot(userId),
  ]);
  const out = commits
    .filter((c) => Number(c.monthly_contribution) > 0)
    .map((c) => ({ id: c.id, domain: c.domain, label: c.domain, monthlyAmount: Number(c.monthly_contribution), essential: false }));
  for (const l of strategic.loans ?? []) {
    out.push({ id: `loan:${l.purpose}`, domain: "loan", label: l.purpose, monthlyAmount: Number(l.monthlyInstallment) || 0, essential: true });
  }
  return out.filter((c) => c.monthlyAmount > 0);
}

// GET /api/emergency-runway[?branchId=&rehearse=1&gap=&expense=&recovery=]
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);

  const context = await loadDomainContext(userId, "emergency");
  if (!context.realityPlanData) {
    return Response.json({ domain: "emergency", hasReality: false, reason: "no_expenses_known", unknowns: ["monthly_expenses", "liquid_assets"] });
  }
  const plan = await ensurePlan(userId, "emergency", context);
  const [branches, constraints, commitments] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain: "emergency" }),
    realCommitments(userId),
  ]);

  const runwayCtx = {
    monthlyExpenses: { value: Number(context.monthlyExpenses) || 0, provenance: context.monthlyExpenses > 0 ? "user_confirmed" : "unknown" },
    liquidAssets: { value: context.availableLiquidSavings != null ? Number(context.availableLiquidSavings) : null, provenance: context.availableLiquidSavings != null ? "bank_confirmed" : "unknown" },
    essentialShare: context.realityPlanData.essential_share,
    commitments,
  };

  const realityData = context.realityPlanData;
  const realityRunway = computeSafetyRunway({ planData: realityData, context: runwayCtx });

  const branchId = url.searchParams.get("branchId");
  const selected = branchId ? branches.find((b) => b.id === branchId) : null;
  const selectedData = selected?.data ?? null;
  const selectedRunway = selectedData ? computeSafetyRunway({ planData: selectedData, context: runwayCtx }) : null;

  const impactSet = selectedData
    ? projectRunwayImpact({ branchData: selectedData, realityData, context: runwayCtx, allocation: selectedData.allocation ?? null })
    : buildImpactSet({ cause: "no branch selected", affectedGoals: [], allocationRequired: false });

  // Shock rehearsal ONLY when the customer explicitly asks (rehearse=1).
  let rehearsal = null;
  if (url.searchParams.get("rehearse") === "1") {
    rehearsal = rehearseShock({
      runway: selectedRunway ?? realityRunway,
      shock: {
        incomeInterruptionMonths: Number(url.searchParams.get("gap")) || 3,
        temporaryMonthlyExpense: Number(url.searchParams.get("expense")) || 0,
        incomeRecoveryRatio: url.searchParams.get("recovery") != null ? Number(url.searchParams.get("recovery")) : 1,
        monthlyIncome: Number(context.monthlyIncome) || 0,
      },
    });
  }

  const targetForSolve = Number((selectedData ?? realityData).target_months) || 6;
  const rebuildForTarget = requiredRebuildForTarget({ runway: selectedRunway ?? realityRunway, targetMonths: targetForSolve, byMonths: 24 });

  const { rows: commitRows } = await query(
    `select id, plan_branch_id, monthly_contribution, source_moment from goal_commitments
     where profile_key = $1 and domain = 'emergency' and plan_id = $2 and status = 'active' order by created_at desc limit 1`,
    [userId, plan.id],
  );
  const sealed = commitRows[0] ?? null;
  const r = selectedRunway ?? realityRunway;
  const freed = impactSet.resourceDelta.freedMonthly;
  const pressure = impactSet.resourceDelta.addedPressureMonthly;

  return Response.json({
    domain: "emergency",
    reality: { data: realityData, runway: realityRunway },
    currentMoment: sealed ? "committed" : selectedData ? "possible" : "reality",
    possibleBranches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, baseVersion: b.base_version })),
    selectedBranch: selected ? { id: selected.id, label: selected.label, data: selectedData, runway: selectedRunway, baseVersion: selected.base_version } : null,
    projection: { rehearsal, requiredRebuildForTarget: rebuildForTarget },
    impactSet,
    futureFragment: freed > 0 ? { releasedMonthly: freed, allocated: null } : null,
    addedPressure: pressure > 0 ? { extraMonthly: pressure, sources: ["flexible_cash", "home", "wedding", "investment", "retirement", "loan"] } : null,
    pins: constraints.map((c) => ({ id: c.id, kind: c.kind, operator: c.operator, value: c.value == null ? null : Number(c.value), scope: c.scope })),
    sealableVerdict: { sealable: Boolean(r?.available && r.sealable), reason: r?.sealableReason ?? "no_reality" },
    turningPoints: runwayTurningPoints({ runway: r }),
    guardianState: sealed
      ? { state: "watching", watching: ["buffer_crossing", "income_expense_changes", "new_commitments"], commitmentId: sealed.id, mayNot: ["auto_pause", "auto_transfer", "auto_rehearse"] }
      : { state: "idle" },
    provenance: {
      monthlyExpenses: context.monthlyExpenses > 0 ? "user_confirmed" : "unknown",
      liquidAssets: context.availableLiquidSavings != null ? "bank_confirmed" : "unknown",
      commitments: "confirmed_goal_commitments_and_loans",
      essentialShare: realityData.essential_share != null ? "user_confirmed" : "system_estimate",
    },
    unknowns: realityRunway.available ? realityRunway.unknowns : ["monthly_expenses", "liquid_assets"],
  });
}

function runwayTurningPoints({ runway }) {
  if (!runway?.available) return [];
  const tps = [];
  if (runway.currentRunwayMonths != null && runway.currentRunwayMonths < runway.floorMonths) {
    tps.push({ id: "runway-below-floor", whyNowKey: "emergencyRunway.tp.belowFloor", whyNowParams: { months: runway.currentRunwayMonths, floor: runway.floorMonths } });
  }
  if (runway.currentRunwayMonths != null && runway.currentRunwayMonths >= runway.floorMonths && runway.currentRunwayMonths < runway.floorMonths + 1) {
    tps.push({ id: "runway-just-recovered", whyNowKey: "emergencyRunway.tp.justRecovered" });
  }
  if (runway.quietZone) {
    tps.push({ id: "runway-quiet-zone", whyNowKey: "emergencyRunway.tp.quietZone" });
  }
  return tps;
}
