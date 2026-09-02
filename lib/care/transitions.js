// Phase 6 Round 5 - youth account age-transition proposals.
//
// If the owner records a birth year and the account is a youth account,
// reaching 16 / 18 produces a PROPOSAL to loosen the rules - never an
// automatic change. The owner applies or dismisses it.

import { query } from "../db.js";
import { recordAuditEvent, setAccountType } from "../account-control/store.js";
import { setAuthPolicy } from "../authorization/store.js";

const MILESTONES = [
  {
    key: "turns_16",
    age: 16,
    rationale: "At 16, everyday spending usually no longer needs sign-off, but larger moves still should.",
    proposes: { restrictedNeedApproval: false, approvalOverAmount: 200 },
  },
  {
    key: "turns_18",
    age: 18,
    rationale: "At 18 this can become a normal adult account. Check your local rules first.",
    proposes: { accountType: "individual", restrictedNeedApproval: false, approvalOverAmount: null },
  },
];

export async function setBirthYear(profileKey, year) {
  const y = Number(year);
  const ok = Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear();
  await query(`update user_onboarding set birth_year = $2 where profile_key = $1`, [profileKey, ok ? y : null]);
  return ok ? y : null;
}

async function context(profileKey) {
  const r = await query(`select account_type, birth_year from user_onboarding where profile_key = $1`, [profileKey]);
  const row = r.rows[0] ?? {};
  const birthYear = row.birth_year ?? null;
  const age = birthYear ? new Date().getFullYear() - birthYear : null;
  return { accountType: row.account_type ?? "individual", birthYear, age };
}

// Create any milestone proposals that are now due and not already on file.
export async function refreshTransitions(profileKey) {
  const { accountType, age } = await context(profileKey);
  if (accountType !== "youth" && accountType !== "guardian_managed_child") return [];
  if (age == null) return [];
  const existing = await query(`select milestone, status from care_transitions where profile_key = $1`, [profileKey]);
  const seen = new Set(existing.rows.map((x) => x.milestone));
  const created = [];
  for (const m of MILESTONES) {
    if (age >= m.age && !seen.has(m.key)) {
      const r = await query(
        `insert into care_transitions (profile_key, milestone, proposes, rationale) values ($1,$2,$3,$4) returning *`,
        [profileKey, m.key, JSON.stringify(m.proposes), m.rationale],
      );
      created.push(mapTransition(r.rows[0]));
      await recordAuditEvent(null, profileKey, { kind: "care_transition_proposed", detail: { milestone: m.key } });
    }
  }
  return created;
}

export async function listTransitions(profileKey) {
  await refreshTransitions(profileKey);
  const r = await query(
    `select * from care_transitions where profile_key = $1 and status = 'proposed' order by created_at asc`,
    [profileKey],
  );
  return r.rows.map(mapTransition);
}

export async function decideTransition(profileKey, id, apply) {
  const r = await query(`select * from care_transitions where id = $1 and profile_key = $2 and status = 'proposed'`, [id, profileKey]);
  const row = r.rows[0];
  if (!row) return null;
  const proposes = typeof row.proposes === "string" ? JSON.parse(row.proposes) : row.proposes;
  if (apply) {
    if (proposes.accountType) await setAccountType(profileKey, proposes.accountType);
    const p = {};
    if ("restrictedNeedApproval" in proposes) p.restrictedNeedApproval = proposes.restrictedNeedApproval;
    if ("approvalOverAmount" in proposes) p.approvalOverAmount = proposes.approvalOverAmount;
    if (Object.keys(p).length) await setAuthPolicy(profileKey, p);
  }
  await query(`update care_transitions set status = $3, decided_at = now() where id = $1 and profile_key = $2`, [
    id,
    profileKey,
    apply ? "applied" : "dismissed",
  ]);
  await recordAuditEvent(null, profileKey, { kind: apply ? "care_transition_applied" : "care_transition_dismissed", detail: { milestone: row.milestone } });
  return { milestone: row.milestone, applied: Boolean(apply) };
}

function mapTransition(r) {
  return {
    id: r.id,
    milestone: r.milestone,
    proposes: typeof r.proposes === "string" ? JSON.parse(r.proposes) : r.proposes,
    rationale: r.rationale,
    status: r.status,
    createdAt: r.created_at,
  };
}
