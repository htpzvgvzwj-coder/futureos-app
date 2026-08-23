// Fixed, closed asset taxonomy — the customer picks category -> subtype from
// this list, never types a free-text category. Single source of truth
// imported by both the API (server-side validation, lib/asset-store.js) and
// the frontend picker (app/page.jsx AssetProfileScreen), so the two can
// never drift apart. Field shape per category matches what that category's
// items actually need (liquidity/risk for financial, strengthRating for the
// mostly-non-monetary categories 4-8) - see docs comment on each block.

export const ASSET_CATEGORIES = [
  "financial",
  "physical",
  "business",
  "human",
  "social",
  "knowledge",
  "digital",
  "legal",
];

// Categories 4-8: mostly not directly monetizable (e.g. "learning ability"),
// so `value` is optional and `strengthRating` (1-5) is required instead.
export const NON_MONETARY_CATEGORIES = ["human", "social", "knowledge", "digital", "legal"];

export const ASSET_SUBTYPES = {
  financial: ["cash", "checking_deposit", "fixed_deposit", "fund", "stock", "bond", "pension", "insurance_cash_value", "crypto"],
  physical: ["property", "vehicle", "gold", "collectible", "equipment"],
  business: ["equity", "business_shop", "project", "royalty", "brand_account", "course_product"],
  human: ["education", "skill", "experience", "health", "time_energy", "professional_reputation"],
  social: ["network", "credit", "reputation", "circle", "partnership", "family_support"],
  knowledge: ["expertise", "judgment", "learning_ability", "methodology", "info_channel"],
  digital: ["personal_account", "content_work", "followers", "domain", "data", "software_tool", "ai_workflow"],
  legal: ["insurance_policy", "will", "marital_property_agreement", "company_structure", "contract", "ip_registration"],
};

// Fixed enums used inside `details` per category — validated the same way
// subtypes are, so a client can never write a value outside this list.
export const FIELD_ENUMS = {
  liquidity: ["cash", "near_cash", "liquid", "illiquid"],
  risk: ["low", "medium", "high"],
  liquidityDifficulty: ["easy", "medium", "hard"],
  ownerDependency: ["full", "partial", "independent"],
  legalStatus: ["active", "pending", "missing"],
  opportunityType: ["opportunity", "trust", "resource", "info_edge"],
};

// Fixed subtype -> stage mapping for the user's own 保命/增长/放大/传承
// framework. Deliberately at the SUBTYPE level (not category level) since
// e.g. "business" spans grow (equity/business_shop/project) and amplify
// (royalty/brand_account/course_product), and "legal" spans protect
// (insurance_policy) and inherit (everything else legal).
export const STAGE_BY_SUBTYPE = {
  "financial.cash": "protect",
  "financial.checking_deposit": "protect",
  "financial.fixed_deposit": "protect",
  "financial.insurance_cash_value": "protect",
  "legal.insurance_policy": "protect",

  "financial.fund": "grow",
  "financial.stock": "grow",
  "financial.bond": "grow",
  "financial.pension": "grow",
  "financial.crypto": "grow",
  "human.education": "grow",
  "human.skill": "grow",
  "human.experience": "grow",
  "human.health": "grow",
  "human.time_energy": "grow",
  "human.professional_reputation": "grow",
  "knowledge.expertise": "grow",
  "knowledge.judgment": "grow",
  "knowledge.learning_ability": "grow",
  "knowledge.methodology": "grow",
  "knowledge.info_channel": "grow",
  "business.equity": "grow",
  "business.business_shop": "grow",
  "business.project": "grow",
  "physical.property": "grow",
  "physical.vehicle": "grow",
  "physical.gold": "grow",
  "physical.collectible": "grow",
  "physical.equipment": "grow",

  "digital.personal_account": "amplify",
  "digital.content_work": "amplify",
  "digital.followers": "amplify",
  "digital.domain": "amplify",
  "digital.data": "amplify",
  "digital.software_tool": "amplify",
  "digital.ai_workflow": "amplify",
  "social.network": "amplify",
  "social.credit": "amplify",
  "social.reputation": "amplify",
  "social.circle": "amplify",
  "social.partnership": "amplify",
  "social.family_support": "amplify",
  "business.royalty": "amplify",
  "business.brand_account": "amplify",
  "business.course_product": "amplify",

  "legal.will": "inherit",
  "legal.marital_property_agreement": "inherit",
  "legal.company_structure": "inherit",
  "legal.contract": "inherit",
  "legal.ip_registration": "inherit",
};

export const STAGES = ["protect", "grow", "amplify", "inherit"];

export function isValidCategory(category) {
  return ASSET_CATEGORIES.includes(category);
}

export function isValidSubtype(category, subtype) {
  return isValidCategory(category) && (ASSET_SUBTYPES[category] ?? []).includes(subtype);
}

export function getStageForAsset(category, subtype) {
  return STAGE_BY_SUBTYPE[`${category}.${subtype}`] ?? "grow";
}

export function isNonMonetaryCategory(category) {
  return NON_MONETARY_CATEGORIES.includes(category);
}
