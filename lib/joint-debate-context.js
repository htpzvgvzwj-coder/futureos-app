// Real joint-partner context for Mirror's Bull/Bear/Judge debate - when the
// goal being debated is one this customer jointly manages with a real
// partner (a real view_and_act access grant on file, either direction),
// the partner's own real financial situation is folded into the debate so
// it reasons about a joint decision instead of only the initiator alone.
// Same "AI touches zero numbers" discipline as everything else in this
// codebase - the partner's numbers are real (their own stored preferences +
// Asset Profile ledger), never invented, and simply absent (not guessed)
// when the partner has never filled in a profile.
import { findActGrantor, listGrantsGiven } from "./access-grant-store.js";
import { getPreferences } from "./preferences-store.js";
import { resolveAssetPromptContext } from "./liquid-savings-context.js";
import { computeGoalFeasibility } from "./mirror-finance.js";
import { listAssets } from "./asset-store.js";

// Mirror's goalType values don't map 1:1 onto access_grants' scope enum
// (app/api/grants/route.js) - "custom" (Mirror's label for the Other
// domain, matching lib/mirror-finance.js's LUMP_SUM_FIELDS.custom) is
// granted under scope "other", the same real mismatch already handled in
// lib/goal-plan-actions.js's crossGoalDomain mapping, just the reverse
// direction. Goal types with no real grant scope (investment, family,
// business, car) simply never match below - correctly inert, not broken.
const GOAL_TYPE_TO_GRANT_SCOPE = { custom: "other" };

function grantScopeForGoalType(goalType) {
  return GOAL_TYPE_TO_GRANT_SCOPE[goalType] ?? goalType;
}

// Checks BOTH directions of a real view_and_act relationship on this goal's
// domain: this user may be the one who was granted act permission (they're
// the plan's initiator, the grantor is their partner), or the one who
// granted it to someone else (they're the approving partner, the grantee is
// who actually initiates plans). Either way, that other real person is the
// "joint partner" whose situation belongs in this debate.
export async function getJointPartnerId(userId, goalType) {
  const scope = grantScopeForGoalType(goalType);
  const asGrantee = await findActGrantor(userId, scope);
  if (asGrantee) return asGrantee.grantor_user_id;
  const given = await listGrantsGiven(userId);
  const asGrantor = given.find(
    (grant) => grant.access_level === "view_and_act" && grant.status === "active" && (grant.scope === "all" || grant.scope === scope)
  );
  return asGrantor ? asGrantor.grantee_user_id : null;
}

// The partner's own real feasibility view for the SAME goal, computed from
// their own real stored profile and Asset Profile ledger - never the
// initiator's numbers relabeled. Returns null (not a guess) if the partner
// has never saved a real profile server-side (lib/preferences-store.js) -
// nothing to compute yet, same "insufficient data" honesty as every other
// evidence source Mirror already cites.
export async function getPartnerFeasibilityView(partnerUserId, goalType, inputs) {
  const partnerPrefs = await getPreferences(partnerUserId);
  const partnerProfile = partnerPrefs?.profile;
  if (!partnerProfile || partnerProfile.statedMonthlyIncome == null) return null;

  const partnerInputs = {
    ...inputs,
    monthlyIncome: partnerProfile.statedMonthlyIncome,
    monthlyExpenses: partnerProfile.monthlyExpenses,
    currentSavings: partnerProfile.currentSavings,
  };
  const partnerAssetContext = await resolveAssetPromptContext(
    partnerUserId,
    partnerProfile.currentSavings,
    partnerProfile.monthlyExpenses,
    "flexible"
  );
  const view = computeGoalFeasibility(goalType, partnerInputs, partnerAssetContext);
  // Same honesty-audit fix as the initiator's own numbers (app/api/mirror/
  // debate/route.js) - resolveAssetPromptContext falls back to the partner's
  // stated currentSavings when they've never itemized a real Asset Profile
  // ledger entry; the prompt must not claim that fallback number came from
  // their ledger.
  const partnerAssets = await listAssets(partnerUserId);
  view.liquidSavingsSourcedFromLedger = partnerAssets.length > 0;
  return view;
}
