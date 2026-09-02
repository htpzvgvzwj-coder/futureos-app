// Financial Twin - the closed vocabularies that keep bank money and Life
// Capital strictly apart (Future Bank round, section 四).
//
// Rule: only FINANCIAL_ASSET_CLASSES contribute to net worth and to any
// cash a Studio may spend. LIFE_CAPITAL_CLASSES (human / social /
// knowledge / ...) are described, never valued into the bank total and
// never offered as funding.
//
// Pure: no DB, no network.

// Assets that enter net worth + the liquidity waterfall.
export const FINANCIAL_ASSET_CLASSES = [
  "bank_account", // current / savings
  "fixed_deposit",
  "foreign_currency",
  "investment", // funds, stocks, bonds, crypto
  "cpf_oa", // usable for housing under scheme rules
  "cpf_sa_ra", // retirement-restricted
  "medisave", // medical-restricted
  "property",
  "business_equity",
  "insurance_cash_value",
  "receivable",
];

export const LIABILITY_CLASSES = [
  "credit_card_statement", // this month's statement balance
  "credit_card_revolving", // carried, interest-bearing
  "mortgage",
  "hdb_loan",
  "education_loan",
  "car_loan",
  "personal_loan",
  "bnpl",
  "tax_payable",
  "other_obligation",
];

// Described, never valued into the bank total.
export const LIFE_CAPITAL_CLASSES = ["human", "social", "knowledge", "digital", "legal"];

// How fast an asset can become spendable cash without a fresh decision.
export const LIQUIDITY_CLASSES = ["cash", "near_cash", "liquid", "restricted", "illiquid"];

// Where a figure comes from. A system estimate must NEVER be presented as a
// bank fact.
export const SOURCE_TYPES = [
  "bank_synced",
  "government_linked", // SGFinDex / CPF
  "insurer_linked",
  "user_confirmed",
  "system_estimated",
  "synthetic_fixture", // test / demo only - flagged, never "bank"
];

// A source the customer's own UI is allowed to treat as a hard fact.
export const AUTHORITATIVE_SOURCES = new Set(["bank_synced", "government_linked", "insurer_linked", "user_confirmed"]);

export const OWNER_TYPES = ["self", "joint", "partner", "household", "business"];

export function isFinancialAssetClass(c) {
  return FINANCIAL_ASSET_CLASSES.includes(c);
}
export function isLiabilityClass(c) {
  return LIABILITY_CLASSES.includes(c);
}
export function isLifeCapitalClass(c) {
  return LIFE_CAPITAL_CLASSES.includes(c);
}
export function isAuthoritative(sourceType) {
  return AUTHORITATIVE_SOURCES.has(sourceType);
}

// CPF SA/RA and MediSave are purpose-locked: they never count as liquid or
// freely-allocatable cash, regardless of their liquidityClass field.
export const ALWAYS_RESTRICTED_CLASSES = new Set(["cpf_sa_ra", "medisave"]);
