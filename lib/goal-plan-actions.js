// Shared dispatcher for every "confirm_<domain>_plan" joint action (lib/
// joint-action-dispatch.js) - the write that actually lands once both
// partners have agreed. Generalizes what used to be wedding-only
// (lib/wedding-actions.js, now folded in here) across all four goal-planner
// domains, since their *-store.js modules share an identical shape
// (getOrCreateSession/saveArtifact/updateSessionStatus) and their joint
// payloads share the same two real kinds: a stage1 plan/budget confirm and
// a stage2 savings-plan confirm.
//
// Like wedding's original version, a plan confirm writes the FIRST
// confirmed artifact for whichever partner actually submitted it from the
// planner UI - the initiator, not the target. The target is only the
// partner whose separate approval was required (see each domain's stage1/
// stage2 route's findActGrantor gate) - their own session for that domain
// is never touched.
import * as weddingStore from "./wedding-store.js";
import * as homeStore from "./home-store.js";
import * as retirementStore from "./retirement-store.js";
import * as otherStore from "./other-store.js";
import { triggerCrossGoalCheck } from "./guardian-alert-store.js";

// stage1ArtifactType matches each domain's own existing direct-save routes
// exactly (app/api/<domain>/stage1/route.js's `artifactType` for a confirm
// tool call) - never a new naming convention invented for the joint path.
// crossGoalDomain matches each domain's own existing triggerCrossGoalCheck
// call site exactly too (other/stage2 already labels itself "custom" there,
// not "other" - kept consistent so guardian_alerts.domain values read the
// same regardless of which path - direct-save or joint-confirm - created them).
const DOMAIN_CONFIG = {
  wedding: { store: weddingStore, stage1ArtifactType: "confirmed_budget", crossGoalDomain: "wedding" },
  home: { store: homeStore, stage1ArtifactType: "confirmed_plan", crossGoalDomain: "home" },
  retirement: { store: retirementStore, stage1ArtifactType: "confirmed_plan", crossGoalDomain: "retirement" },
  other: { store: otherStore, stage1ArtifactType: "confirmed_goal_plan", crossGoalDomain: "custom" },
};

export async function applyGoalPlanJointConfirm(domain, payload, { profileKey }) {
  const config = DOMAIN_CONFIG[domain];
  if (!config) throw new Error(`unknown_joint_goal_plan_domain:${domain}`);

  const { kind, crossGoalCheckInputs, ...data } = payload;
  const { getOrCreateSession, saveArtifact, updateSessionStatus } = config.store;
  const session = await getOrCreateSession(profileKey);

  // "budget" is wedding's own historical kind name (kept for backward
  // compatibility with its existing joint-action payloads); "plan" is the
  // domain-neutral name every other domain's stage1 confirm uses.
  if (kind === "budget" || kind === "plan") {
    const confirmedAt = await saveArtifact(session.id, "stage1", config.stage1ArtifactType, data);
    await updateSessionStatus(session.id, { stage1Status: "confirmed" });
    return { kind, data, confirmedAt };
  }
  if (kind === "savings_plan") {
    const confirmedAt = await saveArtifact(session.id, "stage2", "confirmed_savings_plan", data);
    await updateSessionStatus(session.id, { stage2Status: "confirmed" });
    // Same proactive check every domain's stage2 direct-save path already
    // runs right after confirming - crossGoalCheckInputs is carried on the
    // joint-action payload (captured at propose-time, from the initiator's
    // own request) since the partner's later confirm has no request body
    // of its own to read income/expenses from.
    if (crossGoalCheckInputs) {
      await triggerCrossGoalCheck(profileKey, config.crossGoalDomain, crossGoalCheckInputs);
    }
    return { kind, data, confirmedAt };
  }
  throw new Error(`unknown_goal_plan_joint_action_kind:${kind}`);
}
