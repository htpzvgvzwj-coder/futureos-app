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
  home: { real_finance_recalc: true, guardian_no_execution: true, unknown_not_faked: true },
  emergency: { real_finance_recalc: true, guardian_no_execution: true, unknown_not_faked: true },
  loan: { native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, guardian_no_execution: true, unknown_not_faked: true, domain_integration_test: true },
  retirement: { native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, guardian_no_execution: true, unknown_not_faked: true, domain_integration_test: true },
  travel: { native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, guardian_no_execution: true, unknown_not_faked: true },
  investment: { native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, guardian_no_execution: true, unknown_not_faked: true, domain_integration_test: true },
  insurance: { native_scene: true, domain_visual: true, not_card_grid: true, real_finance_recalc: true, guardian_no_execution: true, unknown_not_faked: true },
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
