// Capability Registry (Usable RC, section 九). ONE source of truth for
// what every feature can actually do right now. Explore, Today and every
// CTA read this - there are no clickable buttons that lead nowhere.
//
//   live                    - fully working on real user data
//   limited                 - works but not the full spec (say what is missing)
//   connection_required     - needs a real external connection not yet configured
//   unavailable             - not built / temporarily off
//   restricted_by_age       - the account type is not eligible
//   restricted_by_permission- the viewer lacks the permission scope
//
// Pure: no DB. Dynamic resolution takes a small ctx.

export const CAPABILITY_STATUSES = [
  "live",
  "limited",
  "connection_required",
  "unavailable",
  "restricted_by_age",
  "restricted_by_permission",
];

// Static registry. `baseStatus` is the best case; resolveCapability() may
// downgrade it from ctx (no payment provider, youth account, missing grant).
const REGISTRY = {
  // --- Bank now ---
  accounts: { name: "Accounts", baseStatus: "live", screen: "home", requires: [], note: "Manual entry + CSV import. Bank sync not connected." },
  pay: { name: "Pay", baseStatus: "connection_required", screen: "paynow", requires: ["payment_provider"], note: "Internal transfers between your own accounts work; external payments need a connected rail." },
  scan_pay: { name: "Scan & Pay", baseStatus: "connection_required", screen: "scanPay", requires: ["payment_provider"] },
  transfer: { name: "Transfer", baseStatus: "live", screen: "paynow", requires: [], note: "Real double-entry move between your own accounts." },
  fx: { name: "FX", baseStatus: "limited", screen: "fx", requires: [], note: "Indicative rates only - not a live quote." },
  cards: { name: "Cards", baseStatus: "live", screen: "accountDetail", requires: [] },
  transactions: { name: "Transactions", baseStatus: "live", screen: "changeLedger", requires: [] },
  bills: { name: "Bills & subscriptions", baseStatus: "live", screen: "personalEconomy", requires: [] },

  // --- Understand my money ---
  financial_twin: { name: "Financial Twin", baseStatus: "live", screen: "strategicBalance", requires: [] },
  spending_timeline: { name: "Spending Timeline", baseStatus: "live", screen: "personalEconomy", requires: [] },
  recurring_payments: { name: "Recurring Payments", baseStatus: "live", screen: "personalEconomy", requires: [] },
  spending_patterns: { name: "Spending Patterns", baseStatus: "limited", screen: "personalEconomy", requires: [], note: "Rule-based categorisation; no ML." },
  unusual_changes: { name: "Unusual Changes", baseStatus: "live", screen: "spendingRisk", requires: [] },
  safe_to_spend: { name: "Safe-to-Spend", baseStatus: "live", screen: "home", requires: [] },
  future_balance: { name: "Future Balance", baseStatus: "live", screen: "home", requires: [] },
  cross_bank: { name: "Cross-bank connection", baseStatus: "connection_required", screen: "crossBankData", requires: ["sgfindex"] },
  document_decoder: { name: "Document Decoder", baseStatus: "live", screen: "decodeDocument", requires: [] },

  // --- Solve a money problem ---
  money_rescue: { name: "Money Rescue", baseStatus: "live", screen: "hardship", requires: [] },
  reality_drift: { name: "Reality Drift", baseStatus: "live", screen: "life", requires: [] },

  // --- Plan my life (the nine Studios) ---
  wedding: { name: "Wedding", baseStatus: "live", screen: "weddingLivingPlan", requires: [] },
  home: { name: "Home", baseStatus: "live", screen: "homeHorizon", requires: [] },
  emergency: { name: "Emergency", baseStatus: "live", screen: "emergencyRunway", requires: [] },
  travel: { name: "Travel", baseStatus: "live", screen: "tripOrbit", requires: [] },
  investment: { name: "Investment", baseStatus: "limited", screen: "capitalPaths", requires: [], note: "Planning information only - not investment advice, no execution." },
  retirement: { name: "Retirement", baseStatus: "limited", screen: "futureLifeTimeline", requires: [], note: "Estimates only - CPF LIFE / provider figures not connected." },
  loan: { name: "Loan", baseStatus: "live", screen: "repaymentPath", requires: [] },
  insurance: { name: "Insurance", baseStatus: "limited", screen: "protectionEnvelope", requires: [], note: "Gap estimates only - requires a licensed provider quote to act." },
  family: { name: "Family", baseStatus: "live", screen: "familyConstellation", requires: [] },

  // --- Decide, protect and remember ---
  mirror: { name: "Mirror", baseStatus: "live", screen: "mirror", requires: [] },
  guardian: { name: "Guardian", baseStatus: "live", screen: "guardian", requires: [], note: "Suggests and watches; can_move_money = false." },
  shared_money: { name: "Shared Money", baseStatus: "live", screen: "relationshipLedger", requires: [] },
  financial_history: { name: "Financial History", baseStatus: "live", screen: "changeLedger", requires: [] },
  future_handoff: { name: "Future Handoff", baseStatus: "live", screen: "memoryLens", requires: [] },
  bank_services: { name: "Bank services", baseStatus: "limited", screen: "productFit", requires: [], note: "Informational matches - not an application or approval." },

  // --- Account control ---
  export_data: { name: "Export my data", baseStatus: "live", screen: "profile", requires: [] },
  delete_account: { name: "Delete my account", baseStatus: "live", screen: "profile", requires: [] },
};

// Which capabilities a youth (guardian-managed) account may NOT use itself.
const YOUTH_RESTRICTED = new Set(["pay", "scan_pay", "transfer", "fx", "investment", "loan", "cards", "bank_services"]);

// ctx: { providers?: { payment_provider?: "connected"|"sandbox"|"unavailable", sgfindex?: ..., ... },
//        accountType?: "individual"|"youth"|"guardian_managed_child"|"household",
//        permissions?: Set<string> }
export function resolveCapability(id, ctx = {}) {
  const entry = REGISTRY[id];
  if (!entry) return { id, name: id, status: "unavailable", note: "Unknown capability." };
  const providers = ctx.providers ?? {};
  let status = entry.baseStatus;

  // an external-connection capability is live only when every provider it
  // needs is connected (or sandbox); otherwise it is connection_required.
  if (entry.requires.length > 0) {
    const providersOk = entry.requires.every((req) => {
      const p = providers[req];
      return p === "connected" || p === "sandbox";
    });
    if (!providersOk) status = "connection_required";
    else if (entry.baseStatus === "connection_required") status = "live";
  }
  // age restriction
  if ((ctx.accountType === "youth" || ctx.accountType === "guardian_managed_child") && YOUTH_RESTRICTED.has(id)) {
    status = "restricted_by_age";
  }
  // permission restriction
  if (entry.permission && ctx.permissions && !ctx.permissions.has(entry.permission)) {
    status = "restricted_by_permission";
  }

  return {
    id,
    name: entry.name,
    status,
    screen: entry.screen,
    requires: entry.requires,
    note: entry.note ?? null,
    actionable: status === "live" || status === "limited",
    whatIsRequired:
      status === "connection_required"
        ? `A connected ${entry.requires.join(" / ")} is required.`
        : status === "restricted_by_age"
          ? "This account type is not eligible for this action."
          : status === "restricted_by_permission"
            ? "You do not have permission for this."
            : status === "unavailable"
              ? "This is not available right now."
              : null,
  };
}

export function resolveAllCapabilities(ctx = {}) {
  return Object.fromEntries(Object.keys(REGISTRY).map((id) => [id, resolveCapability(id, ctx)]));
}

export function capabilityIds() {
  return Object.keys(REGISTRY);
}
