// Dispatcher for the "confirm_wedding_plan" joint action (lib/joint-action-
// dispatch.js) - the write that actually lands once both partners have
// agreed, mirroring lib/hardship-actions.js's applyGoalPause shape (real
// domain-store write + real session status update, nothing left implicit).
//
// Unlike applyGoalPause (which adjusts an EXISTING confirmed_savings_plan
// for a domain the target already owns), this writes the FIRST confirmed
// artifact for the plan-submitting partner's own wedding session - the
// gate is on the initial confirm itself, not a later adjustment. See
// app/api/wedding/stage1/route.js / stage2/route.js for where this is
// proposed instead of saved directly.

import { getOrCreateSession, saveArtifact, updateSessionStatus } from "./wedding-store.js";

export async function applyWeddingJointConfirm(payload, { profileKey }) {
  const { kind, ...data } = payload;
  const session = await getOrCreateSession(profileKey);

  if (kind === "budget") {
    const confirmedAt = await saveArtifact(session.id, "stage1", "confirmed_budget", data);
    await updateSessionStatus(session.id, { stage1Status: "confirmed" });
    return { kind, data, confirmedAt };
  }
  if (kind === "savings_plan") {
    const confirmedAt = await saveArtifact(session.id, "stage2", "confirmed_savings_plan", data);
    await updateSessionStatus(session.id, { stage2Status: "confirmed" });
    // Scoped gap, not a bug: app/api/wedding/stage2/route.js's direct-save
    // path runs triggerCrossGoalCheck (lib/guardian-alert-store.js) right
    // after confirming - this joint-confirm path can't, since the
    // payload here (proposed by the initiator, before the partner's
    // approval) never carried the initiator's income/expenses, only the
    // wedding-specific savings-plan fields. A jointly-confirmed wedding
    // savings plan therefore doesn't trigger a proactive cross-goal alert
    // today.
    return { kind, data, confirmedAt };
  }
  throw new Error(`unknown_wedding_joint_action_kind:${kind}`);
}
