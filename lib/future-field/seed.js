// Studio first-use seed (Studio first-use fix). Creates the FIRST draft
// plan + version + branch for a domain from the StudioEntryBridge answers,
// so a brand-new user is never stuck on a static "no plan" page.
//
// Every seeded value carries provenance: user_confirmed | user_range |
// system_estimate, plus createdAt + sourceStudio. An `estimate` seed is a
// real draft you can explore, but it can never be Sealed until the
// necessary values are user_confirmed.

import { planStore } from "../plan-runtime/index.js";
import { recordEventSafe } from "../change-ledger/store.js";
import { ACTION_TYPES } from "../change-ledger/events.js";
import { buildSeedPatch, getEntryRequirements, ENTRY_DOMAINS } from "../living-scene/studio-entry-requirements.js";

export function seedableDomains() {
  return ENTRY_DOMAINS;
}

// answers: { [questionId]: answerId }
// exactAmounts: { [planField]: number }   (from "I know the exact amount")
// mode: "confirmed" | "estimate"
export async function seedFirstPath(profileKey, domain, { answers = {}, exactAmounts = {}, mode = "confirmed" } = {}) {
  const req = getEntryRequirements(domain);
  if (!req) return { ok: false, error: "unknown_domain" };

  const built = buildSeedPatch(domain, answers, { exactAmounts, mode });
  if (built.error) return { ok: false, error: built.error };
  if (mode === "confirmed" && built.missing.length > 0) {
    return { ok: false, error: "missing_answers", missing: built.missing };
  }
  if (Object.keys(built.patch).length === 0) {
    return { ok: false, error: "no_usable_answers" };
  }

  const now = new Date().toISOString();
  const provenanceMeta = {
    __provenance: built.provenance,
    __seedMode: mode,
    __sourceStudio: domain,
    __seededAt: now,
  };

  const plan = await planStore.getOrCreatePlan(profileKey, { domain, goalKey: domain, title: domain });
  const existing = await planStore.getCurrentPlanVersion(plan.id);

  // append a version with the seeded patch (merged over any prior)
  const version = await planStore.appendPlanVersion(plan.id, profileKey, {
    patch: { ...built.patch, ...provenanceMeta },
    cause: { trigger: "studio_first_path_seed", mode, sourceStudio: domain },
    actor: "user",
  });

  // a first branch so the native scene has something to peel / adjust from
  let branch = null;
  const currentBranches = await planStore.listBranches(plan.id);
  if (currentBranches.length === 0) {
    branch = await planStore.createBranch(plan.id, profileKey, {
      label: "first path",
      baseVersion: String(version?.version ?? "1"),
      data: { ...built.patch },
      delta: {},
      status: "open",
    });
  }

  // Change Ledger: the first real input for this goal (a projected draft,
  // not a real money change).
  await recordEventSafe({
    profileKey,
    actor: "user",
    sourceFeature: domain,
    actionType: existing ? ACTION_TYPES.PLAN_UPDATED : ACTION_TYPES.GOAL_CREATED,
    status: "projected",
    planId: plan.id,
    messageKey: existing ? "ledger.studioPathUpdated" : "ledger.studioFirstPath",
    messageParams: { domain, mode },
    cause: { trigger: "studio_first_path_seed", mode, sourceStudio: domain, fields: Object.keys(built.patch).filter((k) => !k.startsWith("__")) },
    afterSnapshot: built.patch,
    uncertaintyNote:
      mode === "estimate"
        ? `First ${domain} path from estimates - confirm the flagged values before sealing.`
        : `First ${domain} path from your entered details.`,
    dedupeKey: `studio_seed:${domain}:${version?.version ?? "1"}`,
  });

  return {
    ok: true,
    planId: plan.id,
    version: String(version?.version ?? "1"),
    branchId: branch?.id ?? null,
    mode,
    provenance: built.provenance,
    seededAt: now,
    // an estimate path is explorable but NOT sealable
    sealBlockedReason: mode === "estimate" ? "estimate_needs_confirmation" : null,
    needsConfirmation:
      mode === "estimate"
        ? Object.entries(built.provenance)
            .filter(([, p]) => p === "system_estimate")
            .map(([f]) => f)
        : [],
  };
}

// Read the current seeded draft for a domain as a "reality path" the
// living-scene runtime can render. Returns null when nothing seeded.
export async function loadSeededPath(profileKey, domain) {
  const plan = await planStore.getPlan(profileKey, { domain, goalKey: domain }).catch(() => null);
  if (!plan) return null;
  const current = await planStore.getCurrentPlanVersion(plan.id);
  if (!current?.data) return null;
  const data = { ...current.data };
  const provenance = data.__provenance ?? {};
  const seedMode = data.__seedMode ?? null;
  for (const k of Object.keys(data)) if (k.startsWith("__")) delete data[k];
  if (Object.keys(data).length === 0) return null;
  return {
    planId: plan.id,
    data,
    provenance,
    seedMode,
    isSeededDraft: true,
    sealable: seedMode !== "estimate",
    sealBlockedReason: seedMode === "estimate" ? "estimate_needs_confirmation" : null,
  };
}
