import { getCurrentUserId } from "../../../lib/auth.js";
import { loadDomainContext, ensurePlan } from "../../../lib/future-field/service.js";
import { planStore } from "../../../lib/plan-runtime/index.js";
import { query } from "../../../lib/db.js";
import { getPreferences } from "../../../lib/preferences-store.js";
import { listEvents } from "../../../lib/change-ledger/store.js";
import { detectDecisionEchoes } from "../../../lib/living-plan/decision-echo.js";
import { computePrivateConstellation, sharedContributionForViewerShare } from "../../../lib/family/private-constellation-finance.js";
import { projectPrivateConstellationImpact } from "../../../lib/family/private-constellation-projector.js";
import { buildImpactSet } from "../../../lib/living-plan/studio-contract.js";
import { ensureFamilyPlan, listParticipants, ensureParticipant, joinByInviteCode, saveOwnView } from "../../../lib/family/participant-store.js";

export const runtime = "nodejs";

const PLAN_KEYS = ["shared_monthly_contribution", "partner_share_ratio", "items", "monthly_income", "monthly_expenses", "minimum_current_breathing_room"];
function constellationPlan(reality, branchData, participants) {
  const out = { participants };
  for (const k of PLAN_KEYS) {
    if (branchData && branchData[k] != null) out[k] = branchData[k];
    else if (reality[k] != null) out[k] = reality[k];
  }
  return out;
}

async function loadFamily(userId) {
  const context = await loadDomainContext(userId, "family");
  if (!context.realityPlanData) return { context, hasReality: false };
  const plan = await ensurePlan(userId, "family", context);
  const familyPlan = await ensureFamilyPlan({ planId: plan.id, createdBy: userId });
  // The creator is auto-seated as the initiator; a partner must join by code.
  await ensureParticipant({ familyPlanId: familyPlan.id, participantKey: userId, role: familyPlan.created_by === userId ? "initiator" : "partner" });
  const participants = await listParticipants(familyPlan.id);
  return { context, plan, familyPlan, participants, hasReality: true };
}

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");

  const f = await loadFamily(userId);
  if (!f.hasReality) {
    return Response.json({ domain: "family", hasReality: false, reason: "no_shared_plan", unknowns: ["partner_participation"] });
  }
  const { context, plan, familyPlan, participants } = f;
  const [branches, constraints, prefs, ledger] = await Promise.all([
    planStore.listBranches(plan.id),
    planStore.getApplicableConstraints(userId, { planId: plan.id, domain: "family" }),
    getPreferences(userId),
    listEvents(userId, { filter: "all", limit: 120 }),
  ]);

  const reality = context.realityPlanData;
  const cCtx = {
    monthlyIncome: Number(context.monthlyIncome) || 0,
    monthlyExpenses: Number(context.monthlyExpenses) || 0,
    otherGoalsMonthlyOutflow: Math.round(context.committedMonthlyTotal || 0),
  };

  const realityConstellation = computePrivateConstellation({ planData: constellationPlan(reality, null, participants), viewerKey: userId, context: cCtx });

  const selected = branchId ? branches.find((b) => b.id === branchId) : null;
  const selPlan = selected ? constellationPlan(reality, selected.data, participants) : null;
  const selectedConstellation = selPlan ? computePrivateConstellation({ planData: selPlan, viewerKey: userId, context: cCtx }) : null;

  const impactSet = selPlan
    ? projectPrivateConstellationImpact({ branchPlan: selPlan, realityPlan: constellationPlan(reality, null, participants), context: cCtx, allocation: selected?.data?.allocation ?? null, viewerKey: userId })
    : buildImpactSet({ cause: "no branch selected", affectedGoals: [], allocationRequired: false });

  const { echoes } = detectDecisionEchoes({ events: ledger, dismissed: new Set(prefs?.dismissedEchoes ?? []) });
  const familyEcho = echoes.find((e) => /family|shared|partner|contribution/i.test(`${e.actionType ?? ""} ${e.domain ?? ""}`)) ?? null;

  const c = selectedConstellation ?? realityConstellation;

  const { rows: commitRows } = await query(
    `select id, plan_branch_id, monthly_contribution, source_moment from goal_commitments
     where profile_key = $1 and domain = 'family' and plan_id = $2 and status = 'active' order by created_at desc limit 1`,
    [userId, plan.id],
  );
  const sealed = commitRows[0] ?? null;
  const freed = impactSet.resourceDelta.freedMonthly;
  const pressure = impactSet.resourceDelta.addedPressureMonthly;

  return Response.json({
    domain: "family",
    inviteCode: familyPlan.created_by === userId ? familyPlan.invite_code : undefined,
    reality: { data: { shared_monthly_contribution: reality.shared_monthly_contribution, partner_share_ratio: reality.partner_share_ratio, items: reality.items ?? [] }, constellation: realityConstellation },
    currentMoment: sealed ? "committed" : selPlan ? "possible" : "reality",
    possibleBranches: branches.map((b) => ({ id: b.id, label: b.label, status: b.status, delta: b.delta, baseVersion: b.base_version })),
    selectedBranch: selected ? { id: selected.id, label: selected.label, plan: { shared_monthly_contribution: selPlan.shared_monthly_contribution, partner_share_ratio: selPlan.partner_share_ratio }, constellation: selectedConstellation } : null,
    projection: { decisionEcho: familyEcho, jointBand: c.jointBand, conflictCount: c.conflictCount, sharedContributionForViewerShare: c.viewerShare.value != null ? sharedContributionForViewerShare({ targetViewerShare: c.viewerShare.value, ratio: reality.partner_share_ratio }) : null },
    impactSet,
    futureFragment: freed > 0 ? { releasedMonthly: freed, allocated: null } : null,
    addedPressure: pressure > 0 ? { extraMonthly: pressure, sources: ["home", "retirement", "flexible_cash"] } : null,
    pins: constraints.map((cc) => ({ id: cc.id, kind: cc.kind, operator: cc.operator, value: cc.value == null ? null : Number(cc.value), scope: cc.scope })),
    sealableVerdict: { sealable: Boolean(c?.available && c.sealable), reason: c?.sealableReason ?? "no_reality" },
    turningPoints: constellationTurningPoints({ constellation: c }),
    guardianState: sealed
      ? { state: "watching", watching: ["shared_contribution", "both_confirmations", "life_thread_changes"], commitmentId: sealed.id, mayNot: ["reveal_partner_balances", "confirm_on_behalf_of_partner", "auto_move_shared_money", "merge_without_both_confirmations"] }
      : { state: "idle" },
    provenance: {
      yourShare: "user_confirmed",
      partnerNumbers: "never_returned",
      jointBand: "system_estimate",
      confirmations: "each_identity_separately",
    },
    unknowns: realityConstellation.available ? realityConstellation.unknowns : ["partner_participation"],
  });
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "";
  const body = await request.json().catch(() => ({}));

  if (action === "join") {
    const res = await joinByInviteCode({ inviteCode: body.inviteCode, participantKey: userId, displayName: String(body.displayName ?? "").slice(0, 60) });
    if (!res.ok) return Response.json({ error: res.error }, { status: 422 });
    return Response.json({ ok: true });
  }

  // set_view / confirm write ONLY the caller's own participant row.
  if (action === "set_view" || action === "confirm") {
    const f = await loadFamily(userId);
    if (!f.hasReality) return Response.json({ error: "no_shared_plan" }, { status: 409 });
    const saved = await saveOwnView({
      familyPlanId: f.familyPlan.id,
      participantKey: userId,
      privateView: {
        affordableMin: Number(body.affordableMin) || 0,
        affordableMax: Number(body.affordableMax) || 0,
        marks: body.marks && typeof body.marks === "object" ? body.marks : {},
      },
      confirm: action === "confirm",
    });
    return Response.json({ ok: Boolean(saved), confirmed: saved?.confirmed ?? false });
  }

  return Response.json({ error: "unknown_action" }, { status: 400 });
}

function constellationTurningPoints({ constellation }) {
  if (!constellation?.available) return [];
  const tps = [];
  if (!constellation.bothJoined) {
    tps.push({ id: "constellation-awaiting-partner", whyNowKey: "privateConstellation.tp.awaitingPartner" });
  } else if (!constellation.bothConfirmed) {
    tps.push({ id: "constellation-awaiting-confirmations", whyNowKey: "privateConstellation.tp.awaitingConfirmations" });
  }
  if (constellation.conflictCount > 0) {
    tps.push({ id: "constellation-conflicts", whyNowKey: "privateConstellation.tp.conflicts", whyNowParams: { n: constellation.conflictCount } });
  }
  if (constellation.liquidityConflict) {
    tps.push({ id: "constellation-liquidity", whyNowKey: "privateConstellation.tp.liquidityConflict" });
  }
  return tps;
}
