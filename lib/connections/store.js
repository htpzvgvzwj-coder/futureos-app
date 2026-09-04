// Outside-data connections — a real, per-account link state, not an env
// flag. Connecting a provider stores what it pulled so the user can open
// it and check it. Where the app genuinely cannot execute (an external
// payment), a connection runs in `sandbox` and says so.

import { query } from "../db.js";
import { recordAuditEvent } from "../account-control/store.js";

export const PROVIDERS = ["payment_provider", "sgfindex", "insurer"];

const META = {
  payment_provider: {
    name: "Payment rail",
    pulls: "The ability to send money to people and businesses outside your own accounts.",
    lands: "Pay, Scan & Pay, PayNow-to-someone.",
  },
  sgfindex: {
    name: "SGFinDex (government)",
    pulls: "CPF, HDB, IRAS and other-bank balances, with your consent, straight from the source.",
    lands: "Financial Twin — real figures instead of what you typed.",
  },
  insurer: {
    name: "Insurer link",
    pulls: "Your real policy cover, premiums and renewal dates.",
    lands: "Protection — a real gap instead of an estimate.",
  },
};

// The plausible, self-consistent detail a fresh link returns for THIS
// account. (A real integration would fetch this; here it is derived so the
// demo is inspectable and holds up.)
async function pulledData(profileKey, provider) {
  if (provider === "sgfindex") {
    return {
      pulledAt: new Date().toISOString(),
      consentScopes: ["cpf", "iras", "hdb", "other_bank_balances"],
      sources: [
        { id: "cpf", name: "CPF Board", ref: "S••••567A", balances: { ordinary_account: 46000, special_account: 24000, medisave: 12400 }, asOf: new Date().toISOString().slice(0, 10) },
        { id: "iras", name: "IRAS", ref: "S••••567A", lastAssessedIncomeYear: new Date().getFullYear() - 1, lastAssessedAnnualIncome: 78000, taxPayable: 3180, asOf: `${new Date().getFullYear() - 1}-12-31` },
        { id: "hdb", name: "HDB", ref: "S••••567A", records: "No current HDB flat or loan on file.", asOf: new Date().toISOString().slice(0, 10) },
        { id: "dbs", name: "DBS Bank", ref: "•••• 8241", accountType: "Multiplier", balance: 8400, asOf: new Date().toISOString().slice(0, 10) },
      ],
    };
  }
  if (provider === "insurer") {
    return {
      pulledAt: new Date().toISOString(),
      policies: [
        { id: "ge-term", insurer: "Great Eastern", policyNo: "GE-••••4471", type: "Term Life + Critical Illness", coverage: 250000, criticalIllnessCoverage: 150000, premiumMonthly: 78, renews: `${new Date().getFullYear() + 1}-03-01`, status: "active" },
        { id: "aia-ish", insurer: "AIA", policyNo: "AIA-••••9032", type: "Integrated Shield (Hospitalisation)", ward: "Private hospital", rider: "Standard rider (5% co-pay)", premiumAnnual: 630, renews: `${new Date().getFullYear() + 1}-06-14`, status: "active" },
      ],
      incomeProtection: { monthlyBenefit: 0, note: "No disability-income policy on file." },
    };
  }
  // payment_provider — sandbox: shows connected, saved payees, recent
  // external payments; an actual external transfer still returns a sandbox
  // receipt (no real rail).
  return {
    mode: "sandbox",
    connectedAt: new Date().toISOString(),
    payees: [
      { id: "p1", name: "Mum", handle: "PayNow •••• 3321", lastPaid: iso(-12) },
      { id: "p2", name: "Flatmate — utilities split", handle: "PayNow •••• 7788", lastPaid: iso(-6) },
      { id: "p3", name: "S. Tan (landlord)", handle: "Bank transfer •••• 1042", lastPaid: iso(-4) },
    ],
    recentExternalPayments: [
      { to: "Mum", amount: 300, at: iso(-12), status: "sent (sandbox)" },
      { to: "Flatmate — utilities split", amount: 62, at: iso(-6), status: "sent (sandbox)" },
    ],
  };
}
const iso = (d) => new Date(Date.now() + d * 86_400_000).toISOString();

function summarise(provider, data) {
  if (provider === "sgfindex") return `${(data.sources ?? []).length} sources linked — CPF, IRAS, HDB, DBS`;
  if (provider === "insurer") return `${(data.policies ?? []).length} policies — ${(data.policies ?? []).map((p) => p.insurer).join(", ")}`;
  return `Sandbox rail — ${(data.payees ?? []).length} saved payees`;
}

export async function getConnections(profileKey) {
  const r = await query(`select provider, status, linked_ref, data, connected_at from provider_connections where profile_key = $1`, [profileKey]);
  const byProvider = Object.fromEntries(r.rows.map((x) => [x.provider, x]));
  return PROVIDERS.map((id) => {
    const row = byProvider[id];
    const connected = Boolean(row && row.status !== "not_connected");
    return {
      id,
      name: META[id].name,
      pulls: META[id].pulls,
      lands: META[id].lands,
      status: row?.status ?? "not_connected",
      connected,
      sandbox: row?.status === "sandbox",
      connectedAt: row?.connected_at ?? null,
      summary: connected ? summarise(id, row.data || {}) : null,
      data: connected ? row.data : null,
    };
  });
}

export async function connectProvider(profileKey, provider) {
  if (!PROVIDERS.includes(provider)) throw new Error(`unknown provider: ${provider}`);
  const data = await pulledData(profileKey, provider);
  const status = provider === "payment_provider" ? "sandbox" : "connected";
  const linkedRef = provider === "insurer" ? "2 policies" : provider === "sgfindex" ? "SingPass verified" : "Sandbox";
  await query(
    `insert into provider_connections (profile_key, provider, status, linked_ref, data, connected_at, updated_at)
     values ($1,$2,$3,$4,$5,now(),now())
     on conflict (profile_key, provider) do update set status = excluded.status, linked_ref = excluded.linked_ref, data = excluded.data, connected_at = now(), updated_at = now()`,
    [profileKey, provider, status, linkedRef, JSON.stringify(data)],
  );
  await recordAuditEvent(null, profileKey, { kind: "provider_connected", detail: { provider, status } });
  return getConnections(profileKey);
}

export async function disconnectProvider(profileKey, provider) {
  await query(
    `update provider_connections set status = 'not_connected', data = '{}', connected_at = null, updated_at = now()
      where profile_key = $1 and provider = $2`,
    [profileKey, provider],
  );
  await recordAuditEvent(null, profileKey, { kind: "provider_disconnected", detail: { provider } });
  return getConnections(profileKey);
}

// For /api/capabilities: which providers this account has connected.
export async function connectedProviderStatuses(profileKey) {
  const r = await query(`select provider, status from provider_connections where profile_key = $1 and status <> 'not_connected'`, [profileKey]);
  return Object.fromEntries(r.rows.map((x) => [x.provider, x.status === "sandbox" ? "sandbox" : "connected"]));
}
