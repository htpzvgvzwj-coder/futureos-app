// Private Constellation - the Family Studio's flagship domain finance
// engine (pure). TWO INDEPENDENT participant identities share one future.
//
// The engine is always run FROM ONE VIEWER'S PERSPECTIVE. It returns that
// viewer's own private view in full, but of the OTHER participant it
// returns only redacted metadata - never their affordability numbers,
// never their per-item marks. The jointly-feasible band and the
// confirmation state are the only shared truths. Nothing is sealable
// until BOTH independent identities have joined and confirmed.

import { blindMerge } from "./constellation-finance.js";
import { PROVENANCE_KINDS } from "../living-plan/studio-contract.js";

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function fig(value, provenance, extra = {}) {
  return { value: value == null ? null : Math.round(value), provenance: PROVENANCE_KINDS.includes(provenance) ? provenance : "system_estimate", ...extra };
}

// The ONLY shape of another participant a viewer may ever see.
export function redactParticipantView(p) {
  const v = p?.private_view ?? {};
  const marks = v.marks && typeof v.marks === "object" ? v.marks : {};
  return {
    role: p?.role ?? "partner",
    displayName: p?.display_name ?? "",
    joined: true,
    confirmed: Boolean(p?.confirmed),
    markCount: Object.keys(marks).length,
    hasRange: v.affordableMin != null && v.affordableMax != null,
  };
}

function viewFromPrivate(v) {
  const marks = v?.marks && typeof v.marks === "object" ? v.marks : {};
  const out = { affordableMin: num(v?.affordableMin), affordableMax: num(v?.affordableMax, num(v?.affordableMin)), mustKeep: [], flexible: [], undecided: [] };
  for (const [id, m] of Object.entries(marks)) {
    if (m === "mustKeep") out.mustKeep.push(id);
    else if (m === "flexible") out.flexible.push(id);
    else if (m === "undecided") out.undecided.push(id);
  }
  return out;
}

// planData: {
//   shared_monthly_contribution, partner_share_ratio (0..1, viewer's share),
//   items: [{ id, category, monthlyCost }],
//   participants: [{ participant_key, role, display_name, private_view, confirmed }]
// }
// viewerKey: which participant is asking. context: { monthlyIncome,
//   monthlyExpenses, otherGoalsMonthlyOutflow, now }
export function computePrivateConstellation({ planData = {}, viewerKey = null, context = {} }) {
  const now = context.now ?? new Date();
  const participants = Array.isArray(planData.participants) ? planData.participants : [];
  const viewer = participants.find((p) => p.participant_key === viewerKey) ?? participants.find((p) => p.role === "initiator") ?? participants[0] ?? null;
  const other = participants.find((p) => p !== viewer) ?? null;

  const items = Array.isArray(planData.items) ? planData.items : [];
  const shared = Math.max(0, num(planData.shared_monthly_contribution));
  const ratio = Math.max(0, Math.min(1, num(planData.partner_share_ratio, 0.5)));
  const viewerShare = Math.round(shared * ratio);
  const otherShare = Math.round(shared * (1 - ratio));

  const bothJoined = participants.length >= 2;
  const bothConfirmed = bothJoined && participants.every((p) => p.confirmed);

  // Blind merge across the two PRIVATE views - never surfaced raw.
  const merge = bothJoined
    ? blindMerge({
        partnerA: viewFromPrivate(viewer?.private_view),
        partnerB: viewFromPrivate(other?.private_view),
        sharedItems: items,
      })
    : null;

  // A shared node "locks into place" only when BOTH marked it mustKeep and
  // BOTH have confirmed.
  const viewerMarks = (viewer?.private_view?.marks) ?? {};
  const lockedNodes = merge && bothConfirmed
    ? (merge.agreedMustKeep ?? [])
    : [];

  const income = num(context.monthlyIncome ?? planData.monthly_income);
  const currentBreathingRoomAfter = income > 0
    ? Math.round(income - num(context.monthlyExpenses ?? planData.monthly_expenses) - num(context.otherGoalsMonthlyOutflow) - viewerShare)
    : null;
  const liquidityConflict = currentBreathingRoomAfter != null && currentBreathingRoomAfter < 0;
  const minBreathing = num(planData.minimum_current_breathing_room, 0);
  const belowBreathing = currentBreathingRoomAfter != null && currentBreathingRoomAfter < minBreathing;

  const committedMonthly = items.reduce((s, i) => s + num(i.monthlyCost), 0);

  const feasibleBand = merge ? merge.feasibleBandExists : null;
  const sealable = bothJoined && bothConfirmed && (feasibleBand !== false) && !liquidityConflict && !belowBreathing;
  const sealableReason = !bothJoined ? "waiting_for_partner_to_join"
    : !bothConfirmed ? "waiting_for_confirmations"
    : feasibleBand === false ? "no_feasible_band"
    : liquidityConflict ? "share_exceeds_cashflow"
    : belowBreathing ? "below_current_breathing_room"
    : "ok";

  return {
    available: true,
    viewerKey: viewer?.participant_key ?? null,
    viewerRole: viewer?.role ?? "initiator",
    // The viewer's OWN view - full detail is fine, it's theirs.
    viewerView: {
      affordableMin: num(viewer?.private_view?.affordableMin) || null,
      affordableMax: num(viewer?.private_view?.affordableMax) || null,
      marks: viewerMarks,
      confirmed: Boolean(viewer?.confirmed),
    },
    // The OTHER participant - redacted. No numbers, no per-item marks.
    otherParticipant: other ? redactParticipantView(other) : null,
    bothJoined,
    bothConfirmed,
    sharedMonthlyContribution: Math.round(shared),
    viewerShare: fig(viewerShare, "user_confirmed"),
    otherShare: fig(otherShare, "system_estimate"),
    committedMonthly: Math.round(committedMonthly),
    surplusMonthly: Math.round(shared - committedMonthly),
    onPace: shared >= committedMonthly,
    // Only the band + agreed nodes + conflict COUNT are shared.
    jointBand: merge?.jointBand ?? null,
    agreedMustKeep: merge?.agreedMustKeep ?? [],
    conflictCount: merge?.conflicts?.length ?? 0,
    lockedNodes,
    currentBreathingRoomAfter: fig(currentBreathingRoomAfter, income > 0 ? "system_estimate" : "unknown"),
    liquidityConflict,
    belowBreathing,
    bothConfirmedRequired: Boolean(merge?.bothConfirmedRequired || !bothConfirmed),
    sealable,
    sealableReason,
    privacyNote: "individual_balances_and_marks_never_shared",
    assumptions: [
      { text: "Each participant is a separate identity - neither can read the other's affordability numbers or per-item marks", confidence: "high", asOf: now.toISOString().slice(0, 7) },
      { text: "Only the overlapping feasible band, the agreed nodes and a conflict count are shared", confidence: "high" },
      { text: "Nothing is sealable until BOTH identities have joined and confirmed separately", confidence: "high" },
    ],
    unknowns: bothJoined ? [] : ["partner_participation"],
  };
}

// Back-solve: the shared contribution at which the viewer's own share hits
// a target monthly (given the split ratio).
export function sharedContributionForViewerShare({ targetViewerShare, ratio }) {
  const r = Math.max(0.01, Math.min(1, num(ratio, 0.5)));
  return Math.round(num(targetViewerShare) / r);
}
