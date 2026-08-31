// Generates the nine-Studio flagship completion matrix FROM CODE, so the
// Draft PR's matrix cannot be hand-waved. Run: node scripts/studio-matrix.mjs
//
// The evidence bag below is deliberately conservative: a criterion is only
// `true` when something concrete in the repo already satisfies it. As each
// delivery-order commit lands, its criteria flip here and the matrix moves.

import { assessStudio, FLAGSHIP_CRITERIA } from "../lib/living-plan/studio-contract.js";
import { getLivingPlanSpec, getStudioContract, livingPlanDomains } from "../lib/living-plan/registry.js";

// Round 1 (this commit): shared contract + registry only. No Studio has a
// bespoke flagship scene yet; the seven PR#11 scenes are native surfaces
// but do not meet the strict flagship bar (no unified server impactSet, no
// ghost/solid split, no Future Fragment object, no Memory Scrubber, no
// domain-specific Pins/turning points/replay for most).
const EVIDENCE = {
  wedding: { native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, real_branches: true, seal_consent: true, guardian_in_place: true, guardian_no_execution: true, ledger_causal_chain: true, reload_restores: true, unknown_not_faked: true, two_domain_pins: true, domain_integration_test: true },
  // Living Thread commit 2: Home Horizon.
  home: {
    native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, server_impactset: true,
    two_affected_goals: true, ghost_vs_solid: true, future_fragment: true, added_pressure_source: true, two_domain_pins: true,
    seal_consent: true, guardian_in_place: true, guardian_no_execution: true, ledger_causal_chain: true, reload_restores: true,
    mobile_a11y: true, unknown_not_faked: true, domain_integration_test: true,
    // still open: real_branches (explicit Compare UI), memory_scrub (ThreadMemoryScrubber - commit 12)
  },
  // Living Thread commit 3: Safety Runway.
  emergency: {
    native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, server_impactset: true,
    two_affected_goals: true, ghost_vs_solid: true, future_fragment: true, added_pressure_source: true, two_domain_pins: true,
    seal_consent: true, guardian_in_place: true, guardian_no_execution: true, ledger_causal_chain: true, reload_restores: true,
    mobile_a11y: true, unknown_not_faked: true, domain_integration_test: true,
    // still open: real_branches (explicit Compare UI), memory_scrub (commit 12)
  },
  // Living Thread commit 4: Debt Gravity.
  loan: {
    native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, server_impactset: true,
    two_affected_goals: true, ghost_vs_solid: true, future_fragment: true, added_pressure_source: true, two_domain_pins: true,
    real_branches: true, // explicit "Compare strategies" UI
    seal_consent: true, guardian_in_place: true, guardian_no_execution: true, ledger_causal_chain: true, reload_restores: true,
    mobile_a11y: true, unknown_not_faked: true, domain_integration_test: true,
    // still open: memory_scrub (ThreadMemoryScrubber - commit 12)
  },
  // Living Thread commit 5: Future-Day Loom.
  retirement: {
    native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, server_impactset: true,
    two_affected_goals: true, ghost_vs_solid: true, future_fragment: true, added_pressure_source: true, two_domain_pins: true,
    seal_consent: true, guardian_in_place: true, guardian_no_execution: true, ledger_causal_chain: true, reload_restores: true,
    mobile_a11y: true, unknown_not_faked: true, domain_integration_test: true,
    // still open: real_branches (explicit Compare UI), memory_scrub (ThreadMemoryScrubber - commit 12)
  },
  // Living Thread commit 6: Calendar Orbit.
  travel: {
    native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, server_impactset: true,
    two_affected_goals: true, ghost_vs_solid: true, future_fragment: true, added_pressure_source: true, two_domain_pins: true,
    seal_consent: true, guardian_in_place: true, guardian_no_execution: true, ledger_causal_chain: true, reload_restores: true,
    mobile_a11y: true, unknown_not_faked: true, domain_integration_test: true,
    // still open: real_branches (explicit Compare UI), memory_scrub (ThreadMemoryScrubber - commit 12)
  },
  // Living Thread commit 7: Capital Prism.
  investment: {
    native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, server_impactset: true,
    two_affected_goals: true, ghost_vs_solid: true, future_fragment: true, added_pressure_source: true, two_domain_pins: true,
    seal_consent: true, guardian_in_place: true, guardian_no_execution: true, ledger_causal_chain: true, reload_restores: true,
    mobile_a11y: true, unknown_not_faked: true, domain_integration_test: true,
    // still open: real_branches (explicit Compare UI), memory_scrub (ThreadMemoryScrubber - commit 12)
  },
  // Living Thread commit 8: Living Envelope.
  insurance: {
    native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, server_impactset: true,
    two_affected_goals: true, ghost_vs_solid: true, future_fragment: true, added_pressure_source: true, two_domain_pins: true,
    seal_consent: true, guardian_in_place: true, guardian_no_execution: true, ledger_causal_chain: true, reload_restores: true,
    mobile_a11y: true, unknown_not_faked: true, domain_integration_test: true,
    // still open: real_branches (explicit Compare UI), memory_scrub (ThreadMemoryScrubber - commit 12)
  },
  family: { native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, guardian_no_execution: true, unknown_not_faked: true },
};

const rows = livingPlanDomains().map((d) => {
  const a = assessStudio(getLivingPlanSpec(d), { ...EVIDENCE[d], domain: d });
  const wired = Object.entries(getStudioContract(d) ?? {}).filter(([, v]) => v != null).length;
  return { d, status: a.status, met: a.metCount, total: a.total, wired };
});

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nNine-Studio flagship completion matrix (${FLAGSHIP_CRITERIA.length} criteria each)\n`);
console.log(`${pad("Studio", 12)} ${pad("Status", 10)} ${pad("Criteria met", 14)} Contract slots wired`);
console.log("-".repeat(60));
for (const r of rows) {
  console.log(`${pad(r.d, 12)} ${pad(r.status, 10)} ${pad(`${r.met}/${r.total}`, 14)} ${r.wired}/11`);
}
const complete = rows.filter((r) => r.status === "complete").length;
console.log(`\n${complete}/9 Studios complete. Ready-for-Review requires 9/9.\n`);
