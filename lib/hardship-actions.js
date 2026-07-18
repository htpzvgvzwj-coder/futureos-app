// Cross-goal write layer. Pausing/reducing a goal's savings plan reuses that
// domain's own confirmed_savings_plan artifact type with an adjusted
// payload — writing a new row makes it "the latest" one, so the existing
// ConfirmedSavingsPlanCard on that domain's own screen renders the new
// number and the explanation (already displayed via plan.notes) with no
// frontend changes there. Every action is also logged to
// hardship_actions_applied so the Emergency screen has a real, persisted
// "what we changed and why" record independent of any one domain's data.

import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";
import { recordAppliedAction } from "./hardship-store.js";

const DOMAIN_STORES = { wedding: weddingStore, home: homeStore, retirement: retirementStore };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function applyGoalPause({ domain, hardshipSessionId, newMonthlyContribution, explanation }) {
  const store = DOMAIN_STORES[domain];
  if (!store) throw new Error(`unknown_domain:${domain}`);

  const session = await store.getOrCreateSession(store.DEFAULT_PROFILE_KEY);
  const currentPlan = await store.getLatestArtifact(session.id, "stage2", "confirmed_savings_plan");
  if (!currentPlan) throw new Error(`no_confirmed_savings_plan:${domain}`);

  // Scale each allocation entry proportionally so the vehicle mix is
  // preserved rather than zeroing/dumping the delta into one vehicle.
  const ratio = currentPlan.monthly_contribution > 0 ? newMonthlyContribution / currentPlan.monthly_contribution : 0;
  const updatedPlan = {
    ...currentPlan,
    monthly_contribution: newMonthlyContribution,
    allocation: currentPlan.allocation.map((entry) => ({
      ...entry,
      monthly_amount: Math.round(entry.monthly_amount * ratio * 100) / 100,
    })),
    notes: `${currentPlan.notes}\n\n[Hardship adjustment, ${todayIso()}]: ${explanation}`,
  };

  const amountFreed = Math.round((currentPlan.monthly_contribution - newMonthlyContribution) * 100) / 100;
  await store.saveArtifact(session.id, "stage2", "confirmed_savings_plan", updatedPlan);
  await recordAppliedAction(hardshipSessionId, {
    actionType: "pause_goal_plan",
    targetDomain: domain,
    amount: amountFreed,
    explanation,
  });
  // amountFreed uses the same "monthly amount this action frees up" meaning
  // recorded in the audit trail, so a caller displaying this result
  // immediately shows the same figure a later reload of the audit rows
  // would show, rather than the proposal's "new contribution level" figure.
  return { updatedPlan, amountFreed };
}

// Shared shape for the three actions with no domain to write into - only an
// audit record. drawdown_emergency_fund/invest_excess have no domain owner
// (profile.currentSavings is a client-only localStorage preferences field
// with no server-side counterpart anywhere; the frontend applies the actual
// balance change via setPreferences, same as every other profile edit) and
// no existing domain models "a small conservative investment" as a goal.
// other_ocbc_support is never actually executed - the app can't automate a
// fee waiver or loan restructure - so it's recorded pending_review, not
// applied, so the audit trail doesn't claim something happened that only a
// banker can do.
async function applyAuditOnlyAction(actionType, { hardshipSessionId, amount = null, explanation, status }) {
  await recordAppliedAction(hardshipSessionId, { actionType, targetDomain: null, amount, explanation, status });
  return { amount, explanation };
}

export function applyDrawdownEmergencyFund({ hardshipSessionId, amount, explanation }) {
  return applyAuditOnlyAction("drawdown_emergency_fund", { hardshipSessionId, amount, explanation });
}

export function applyInvestExcess({ hardshipSessionId, amount, explanation }) {
  return applyAuditOnlyAction("invest_excess", { hardshipSessionId, amount, explanation });
}

export function applyOtherOcbcSupport({ hardshipSessionId, explanation }) {
  return applyAuditOnlyAction("other_ocbc_support", { hardshipSessionId, explanation, status: "pending_review" });
}
