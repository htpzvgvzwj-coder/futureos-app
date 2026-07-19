"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  Award,
  Banknote,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Camera,
  ChartNoAxesColumnIncreasing,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Coffee,
  CreditCard,
  Download,
  FileText,
  Globe2,
  HandCoins,
  HeartHandshake,
  History,
  Home,
  Info,
  Landmark,
  LineChart,
  LockKeyhole,
  LogOut,
  Mic,
  MonitorCog,
  Moon,
  Music,
  PartyPopper,
  PiggyBank,
  QrCode,
  RotateCcw,
  ScanLine,
  Send,
  Settings,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
  Utensils,
  Wine,
  X,
} from "lucide-react";
import { computeHomeFinancials } from "../lib/home-finance.js";
import { recomputeVenueForGuestCount } from "../lib/wedding-finance.js";
import { computeRetirementFinancials } from "../lib/retirement-finance.js";
import { computeAllLoanArchetypes, applyLoanModifiers, LOAN_ARCHETYPE_KEYS, LOAN_MODIFIER_KEYS } from "../lib/loan-finance.js";
import { projectPurchaseMode } from "../lib/investment-finance.js";
import { RISK_BANDS, HOLDINGS_CATEGORIES, PURCHASE_MODES } from "../lib/investment-catalog.js";
import en from "../locales/en.json";
import ms from "../locales/ms.json";
import ta from "../locales/ta.json";
import zh from "../locales/zh.json";

const screens = {
  HOME: "home",
  LIFE_GRAPH: "lifeGraph",
  MIRROR: "mirror",
  GUARDIAN: "guardian",
  PROFILE: "profile",
  NEED_WEDDING: "needWedding",
  NEED_HOME: "needHome",
  NEED_RETIREMENT: "needRetirement",
  NEED_LOAN: "needLoan",
  NEED_EMERGENCY: "needEmergency",
  NEED_INSURANCE: "needInsurance",
  NEED_INVESTMENT: "needInvestment",
  PAYNOW: "paynow",
  SCAN_PAY: "scanPay",
  FX: "fx",
  ACCOUNT_DETAIL: "accountDetail",
  SPENDING_RISK: "spendingRisk",
  LOADING: "loading",
};

const locales = { en, zh, ms, ta };
const languageOptions = [
  { id: "en", labelKey: "language.english" },
  { id: "zh", labelKey: "language.chinese" },
  { id: "ms", labelKey: "language.malay" },
  { id: "ta", labelKey: "language.tamil" },
];

const navItems = [
  { id: screens.HOME, labelKey: "nav.home", icon: Home },
  { id: screens.LIFE_GRAPH, labelKey: "nav.lifeGraph", icon: ChartNoAxesColumnIncreasing },
  { id: screens.MIRROR, labelKey: "nav.mirror", icon: LineChart },
  { id: screens.GUARDIAN, labelKey: "nav.guardian", icon: ShieldCheck },
  { id: screens.PROFILE, labelKey: "nav.profile", icon: UserRound },
];

const detectedNeedDefinitions = [
  { id: "emergency", titleKey: "needs.emergency", screen: screens.NEED_EMERGENCY, icon: LockKeyhole },
  { id: "insurance", titleKey: "needs.insurance", screen: screens.NEED_INSURANCE, icon: ShieldCheck },
  { id: "investment", titleKey: "needs.investment", screen: screens.NEED_INVESTMENT, icon: LineChart },
];

// Life Graph Detected Needs (05_Life_Graph.md "Detected Needs"): a need only appears when there is
// actual evidence - a declared goal, or a health score signal (low buffer, weak protection) - instead
// of always showing the same five cards regardless of the customer's profile.
function getDetectedNeeds(selectedGoalIds, healthScores) {
  const scoreById = Object.fromEntries(healthScores.map((score) => [score.id, score.value]));
  const evidenceById = {
    emergency: selectedGoalIds.includes("emergency") || scoreById.emergency < 60,
    insurance: selectedGoalIds.includes("family") || scoreById.insurance < 60,
    investment:
      selectedGoalIds.includes("investment") || selectedGoalIds.includes("retirement") || scoreById.investment >= 70,
  };
  return detectedNeedDefinitions.filter(({ id }) => evidenceById[id]);
}

const productEcosystem = [
  { productKey: "products.deposits", actionKey: "products.depositsAction", icon: Banknote },
  { productKey: "products.payments", actionKey: "products.paymentsAction", icon: CalendarClock },
  { productKey: "products.wealth", actionKey: "products.wealthAction", icon: LineChart },
  { productKey: "products.insurance", actionKey: "products.insuranceAction", icon: ShieldCheck },
  { productKey: "products.mortgage", actionKey: "products.mortgageAction", icon: Building2 },
  { productKey: "products.credit", actionKey: "products.creditAction", icon: CircleDollarSign },
];

const simulatorGoalOptions = [
  { id: "wedding", labelKey: "simulator.goals.wedding", icon: HeartHandshake },
  { id: "home", labelKey: "simulator.goals.home", icon: Building2 },
  { id: "loan", labelKey: "simulator.goals.loan", icon: HandCoins },
  { id: "emergency", labelKey: "simulator.goals.emergency", icon: LockKeyhole },
  { id: "retirement", labelKey: "simulator.goals.retirement", icon: Landmark },
  { id: "family", labelKey: "simulator.goals.family", icon: Sparkles },
  { id: "investment", labelKey: "simulator.goals.investment", icon: LineChart },
  { id: "business", labelKey: "simulator.goals.business", icon: BriefcaseBusiness },
  { id: "custom", labelKey: "simulator.goals.custom", icon: SlidersHorizontal },
];

// Goal ids that navigate to a dedicated AI-driven planner screen instead of
// toggling a simulator checkbox, from the Life Goal Selection grid.
const DEDICATED_GOAL_SCREENS = {
  wedding: { screen: screens.NEED_WEDDING, badgeKey: "weddingPlanner.newFeatureBadge" },
  home: { screen: screens.NEED_HOME, badgeKey: "homePlanner.newFeatureBadge" },
  loan: { screen: screens.NEED_LOAN, badgeKey: "loanPlanner.newFeatureBadge" },
  retirement: { screen: screens.NEED_RETIREMENT, badgeKey: "retirementPlanner.newFeatureBadge" },
  emergency: { screen: screens.NEED_EMERGENCY, badgeKey: "needDetails.emergency.newFeatureBadge" },
  investment: { screen: screens.NEED_INVESTMENT, badgeKey: "investmentPlanner.newFeatureBadge" },
};

const independenceLevels = [
  { level: 1, titleKey: "simulator.levels.1.title", detailKey: "simulator.levels.1.detail" },
  { level: 2, titleKey: "simulator.levels.2.title", detailKey: "simulator.levels.2.detail" },
  { level: 3, titleKey: "simulator.levels.3.title", detailKey: "simulator.levels.3.detail" },
  { level: 4, titleKey: "simulator.levels.4.title", detailKey: "simulator.levels.4.detail" },
  { level: 5, titleKey: "simulator.levels.5.title", detailKey: "simulator.levels.5.detail" },
];

const simulatorActionCards = [
  { id: "savingsGoal", titleKey: "simulator.actions.savingsGoal", icon: Target },
  { id: "monthlyTransfer", titleKey: "simulator.actions.monthlyTransfer", icon: CalendarClock },
  { id: "emergencyFund", titleKey: "simulator.actions.emergencyFund", icon: LockKeyhole },
  { id: "insuranceReview", titleKey: "simulator.actions.insuranceReview", icon: ShieldCheck },
  { id: "mortgageReadiness", titleKey: "simulator.actions.mortgageReadiness", icon: Building2 },
  { id: "investmentPlan", titleKey: "simulator.actions.investmentPlan", icon: LineChart },
];

const ocbcServiceActions = [
  { id: "open360", icon: Banknote, approvedStatusKey: "status.completed" },
  { id: "creditCardApplication", icon: CreditCard, approvedStatusKey: "status.scheduled" },
  { id: "roboInvest", icon: LineChart, approvedStatusKey: "status.active" },
  { id: "insuranceReviewService", icon: ShieldCheck, approvedStatusKey: "status.scheduled" },
  { id: "homeLoanCheck", icon: Building2, approvedStatusKey: "status.monitoring" },
  { id: "relationshipManager", icon: UserRound, approvedStatusKey: "status.scheduled" },
  { id: "monthlySavingsService", icon: CalendarClock, approvedStatusKey: "status.active" },
  { id: "goalWalletTransfer", icon: Target, approvedStatusKey: "status.active" },
  { id: "portfolioRebalance", icon: ArrowLeftRight, approvedStatusKey: "status.monitoring" },
  { id: "protectionReview", icon: ClipboardCheck, approvedStatusKey: "status.scheduled" },
];

const defaultSimulatorActionStates = {
  savingsGoal: "pending",
  monthlyTransfer: "pending",
  emergencyFund: "pending",
  insuranceReview: "pending",
  mortgageReadiness: "pending",
  investmentPlan: "pending",
  open360: "pending",
  creditCardApplication: "pending",
  roboInvest: "pending",
  insuranceReviewService: "pending",
  homeLoanCheck: "pending",
  relationshipManager: "pending",
  monthlySavingsService: "pending",
  goalWalletTransfer: "pending",
  portfolioRebalance: "pending",
  protectionReview: "pending",
};

const defaultSimulatorInputs = {
  situation: "",
  goals: {
    wedding: false,
    home: false,
    emergency: true,
    retirement: true,
    family: true,
    investment: true,
    business: false,
    custom: false,
  },
  independenceLevel: 4,
  monthlyIncome: "7500",
  currentSavings: "85000",
  plannedSpending: "12000",
  weddingBudget: "35000",
  weddingDate: "2027-06",
  targetHomeYear: "2030",
  targetDownPayment: "150000",
  propertyBudget: "750000",
  mortgageReadiness: "preparing",
  weddingSavingsMonthly: "",
  weddingSavingsStartMonth: "",
  weddingSavingsTargetMonth: "",
  homeSavingsMonthly: "",
  homeSavingsStartMonth: "",
  homeSavingsTargetMonth: "",
  retirementSavingsMonthly: "",
  retirementSavingsStartMonth: "",
  retirementSavingsTargetMonth: "",
  monthlyExpenses: "3600",
  currentEmergencyFund: "21600",
  targetCoverageMonths: "6",
  retirementAge: "62",
  currentInvestment: "15000",
  monthlyInvestment: "500",
  targetReturnGoal: "6",
  familyPlanningYear: "2030",
  familyMonthlyCost: "1800",
  insuranceReadiness: "review",
  startupCapital: "80000",
  launchDate: "2027-01",
  customGoalName: "",
  customTargetAmount: "6000",
  customTargetDate: "2027-01",
  customPriority: "high",
  customCategory: "Lifestyle",
  customNotes: "",
  riskPreference: "balanced",
};

const currentProfileVersion = "karina-demo-profile-2026-07-03";

const defaultProfile = {
  age: "27",
  relationshipStatus: "Married",
  occupation: "Mid-Level Marketing Executive at a retail company",
  responsibilities:
    "Manages campaigns and budgets at work, oversees household finances, and plans for long-term goals.",
  pastExperience: "5 years in marketing, recently promoted",
  lifeStage: "Late 20s, married, considering starting a family",
  monthlyIncome: "7500",
  monthlyExpenses: "3600",
  currentSavings: "85000",
  existingLoans: "18000",
  creditCardOutstanding: "2400",
  investments: "15000",
  insuranceStatus: "Basic",
  riskPreference: "Balanced",
  goals: {
    wedding: false,
    home: false,
    emergency: true,
    retirement: true,
    family: true,
    investment: true,
    business: false,
    custom: false,
  },
};

const defaultCustomGoalDraft = {
  name: "",
  amount: "6000",
  date: "2027-01",
  priority: "High",
  category: "Lifestyle",
  notes: "",
};

const profileGoalOptions = [
  { id: "wedding", labelKey: "simulator.goals.wedding", icon: HeartHandshake },
  { id: "home", labelKey: "simulator.goals.home", icon: Building2 },
  { id: "emergency", labelKey: "simulator.goals.emergency", icon: LockKeyhole },
  { id: "retirement", labelKey: "simulator.goals.retirement", icon: Landmark },
  { id: "family", labelKey: "simulator.goals.family", icon: Sparkles },
  { id: "investment", labelKey: "simulator.goals.investment", icon: LineChart },
  { id: "business", labelKey: "simulator.goals.business", icon: BriefcaseBusiness },
  { id: "custom", labelKey: "simulator.goals.custom", icon: Target },
];

const futureSystems = [
  {
    id: "lifeGraph",
    titleKey: "futureSystems.lifeGraph.title",
    subtitleKey: "futureSystems.lifeGraph.subtitle",
    icon: ChartNoAxesColumnIncreasing,
    screen: screens.LIFE_GRAPH,
  },
  {
    id: "futureMirror",
    titleKey: "futureSystems.futureMirror.title",
    subtitleKey: "futureSystems.futureMirror.subtitle",
    icon: LineChart,
    screen: screens.MIRROR,
  },
  {
    id: "guardian",
    titleKey: "futureSystems.guardian.title",
    subtitleKey: "futureSystems.guardian.subtitle",
    icon: ShieldCheck,
    screen: screens.GUARDIAN,
  },
];

const strategyCards = [
  { id: "savings", titleKey: "lifeGraph.strategy.savings.title", detailKey: "lifeGraph.strategy.savings.detail", icon: Banknote },
  { id: "investment", titleKey: "lifeGraph.strategy.investment.title", detailKey: "lifeGraph.strategy.investment.detail", icon: LineChart },
  { id: "insurance", titleKey: "lifeGraph.strategy.insurance.title", detailKey: "lifeGraph.strategy.insurance.detail", icon: ShieldCheck },
  { id: "credit", titleKey: "lifeGraph.strategy.credit.title", detailKey: "lifeGraph.strategy.credit.detail", icon: CreditCard },
  { id: "mortgage", titleKey: "lifeGraph.strategy.mortgage.title", detailKey: "lifeGraph.strategy.mortgage.detail", icon: Building2 },
  { id: "emergency", titleKey: "lifeGraph.strategy.emergency.title", detailKey: "lifeGraph.strategy.emergency.detail", icon: LockKeyhole },
];

const productRecommendations = [
  {
    id: "ocbc360",
    name: "OCBC 360 Account",
    category: "savings",
    categoryKey: "lifeGraph.productFit.categories.savings",
    whyKey: "lifeGraph.productFit.why.ocbc360",
    supportsKey: "lifeGraph.productFit.supports.ocbc360",
    impactKey: "lifeGraph.productFit.impact.ocbc360",
    relevantGoals: ["emergency", "wedding", "home", "family"],
    icon: Banknote,
  },
  {
    id: "monthlySavings",
    name: "OCBC Monthly Savings Account",
    category: "savings",
    categoryKey: "lifeGraph.productFit.categories.savings",
    whyKey: "lifeGraph.productFit.why.monthlySavings",
    supportsKey: "lifeGraph.productFit.supports.monthlySavings",
    impactKey: "lifeGraph.productFit.impact.monthlySavings",
    relevantGoals: ["wedding", "home", "family", "custom"],
    icon: Target,
  },
  {
    id: "homeLoan",
    name: "OCBC Home Loan",
    category: "loans",
    categoryKey: "lifeGraph.productFit.categories.loans",
    whyKey: "lifeGraph.productFit.why.homeLoan",
    supportsKey: "lifeGraph.productFit.supports.homeLoan",
    impactKey: "lifeGraph.productFit.impact.homeLoan",
    relevantGoals: ["home"],
    icon: Building2,
  },
  {
    id: "roboInvest",
    name: "OCBC RoboInvest",
    category: "wealth",
    categoryKey: "lifeGraph.productFit.categories.wealth",
    whyKey: "lifeGraph.productFit.why.roboInvest",
    supportsKey: "lifeGraph.productFit.supports.roboInvest",
    impactKey: "lifeGraph.productFit.impact.roboInvest",
    relevantGoals: ["investment", "retirement"],
    icon: LineChart,
  },
  {
    id: "greatTerm",
    name: "GREAT Term Guard",
    category: "insurance",
    categoryKey: "lifeGraph.productFit.categories.insurance",
    whyKey: "lifeGraph.productFit.why.greatTerm",
    supportsKey: "lifeGraph.productFit.supports.greatTerm",
    impactKey: "lifeGraph.productFit.impact.greatTerm",
    relevantGoals: ["family", "emergency"],
    icon: ShieldCheck,
  },
  {
    id: "paynowGiro",
    name: "PayNow + GIRO transfers",
    category: "payments",
    categoryKey: "lifeGraph.productFit.categories.payments",
    whyKey: "lifeGraph.productFit.why.payments",
    supportsKey: "lifeGraph.productFit.supports.payments",
    impactKey: "lifeGraph.productFit.impact.payments",
    relevantGoals: ["wedding", "home", "emergency", "retirement", "family", "investment", "business", "custom"],
    icon: CalendarClock,
  },
  {
    id: "ocbc365",
    name: "OCBC 365 Credit Card",
    category: "cards",
    categoryKey: "lifeGraph.productFit.categories.cards",
    whyKey: "lifeGraph.productFit.why.ocbc365",
    supportsKey: "lifeGraph.productFit.supports.ocbc365",
    impactKey: "lifeGraph.productFit.impact.ocbc365",
    relevantGoals: ["wedding", "home", "emergency", "retirement", "family", "investment", "business", "custom"],
    icon: CreditCard,
  },
];

// Product categories that PDR/Build-With-OCBC require a human or licensed-policy review before
// consent can be requested - they can never reach "readyForConsent" on their own.
const productCategoriesRequiringReview = new Set(["loans", "insurance"]);

function getProductConflict(product, healthScores) {
  const scoreOf = (id) => healthScores.find((s) => s.id === id)?.value ?? 0;
  if (product.category === "wealth" && scoreOf("emergency") < 60) {
    return { key: "emergencyBelowTarget", score: scoreOf("emergency") };
  }
  if (product.category === "cards" && scoreOf("debt") < 55) {
    return { key: "highDebtLoad", score: scoreOf("debt") };
  }
  if (product.category === "loans" && scoreOf("savings") < 60) {
    return { key: "mortgageReadinessWeak", score: scoreOf("savings") };
  }
  return null;
}

function getProductState(product, ctx) {
  const { healthScores, selectedGoalIds, added } = ctx;
  const relevantGoal = product.relevantGoals.find((goal) => selectedGoalIds.includes(goal));
  if (!relevantGoal) return { state: "notApplicable", relevantGoal: null, conflict: null };

  const conflict = getProductConflict(product, healthScores);
  if (conflict) return { state: "blocked", relevantGoal, conflict };

  if (added) return { state: "readyForConsent", relevantGoal, conflict: null, accepted: true };

  if (product.category === "insurance") {
    const insuranceScore = healthScores.find((s) => s.id === "insurance")?.value ?? 0;
    if (insuranceScore >= 85) return { state: "watch", relevantGoal, conflict: null };
    return { state: "recommendReview", relevantGoal, conflict: null };
  }

  if (product.category === "loans") return { state: "recommendReview", relevantGoal, conflict: null };

  return { state: "readyForConsent", relevantGoal, conflict: null };
}

function getProductEvidence(product, ctx, t) {
  const { profile, healthScores, resultInfo } = ctx;
  const scoreOf = (id) => healthScores.find((s) => s.id === id)?.value ?? 0;
  const goalLabel = resultInfo.relevantGoal ? t(`simulator.goals.${resultInfo.relevantGoal}`) : t("lifeGraph.productFit.evidence.noGoal");

  return {
    // goalSupported/expectedImpact reuse each product's existing hand-written supports/impact copy
    // (translated in every locale already) instead of duplicating another per-category template.
    goalSupported: `${t("lifeGraph.productFit.evidence.goalSupported", { goal: goalLabel })} ${t(product.supportsKey)}`,
    dataUsed: t(`lifeGraph.productFit.evidence.dataUsed.${product.category}`, {
      income: formatSgd(numberValue(profile.monthlyIncome, 7500)),
      savings: formatSgd(numberValue(profile.currentSavings, 85000)),
    }),
    suitabilityReason: resultInfo.conflict
      ? t(`lifeGraph.productFit.evidence.conflictReason.${resultInfo.conflict.key}`, { score: resultInfo.conflict.score })
      : t(product.whyKey),
    productRisk: t(`lifeGraph.productFit.evidence.risk.${product.category}`),
    alternativeConsidered: t(`lifeGraph.productFit.evidence.alternative.${product.category}`),
    conflictCheck: resultInfo.conflict
      ? t(`lifeGraph.productFit.evidence.conflictCheck.${resultInfo.conflict.key}`, { score: resultInfo.conflict.score })
      : t("lifeGraph.productFit.evidence.noConflict"),
    expectedImpact: `${t(product.impactKey)} (${t("home.futureHealthScore")}: ${scoreOf("future")}/100)`,
    limitation: t("lifeGraph.productFit.evidence.limitation"),
    humanReview: productCategoriesRequiringReview.has(product.category)
      ? t("lifeGraph.productFit.evidence.humanReviewRequired")
      : t("lifeGraph.productFit.evidence.humanReviewNotRequired"),
  };
}

// Guardian Reputation Score: 30% Consent Respect + 25% Goal Protection Rate + 20% Recovery Success
// + 15% Recommendation Outcome Accuracy + 10% Human Escalation Quality (08_Guardian_Operating_Principles.md).
// This prototype has no persistent event ledger yet (that lands with Goal Ledger Lifecycle), so each
// component is derived from the closest real signal already tracked in the app rather than left static.
function getGuardianReputationScore(ctx) {
  const { preferences, healthScores, spendingRisk, approvedCount, decidedCount, approvedServiceCount } = ctx;

  const permissionValues = Object.values(preferences.guardianPermissions ?? {});
  const grantedRatio = permissionValues.length
    ? permissionValues.filter(Boolean).length / permissionValues.length
    : 1;
  // Approved OCBC service executions are direct evidence that the consent-to-execution flow is
  // working end to end (every one of them required an explicit customer approve tap).
  const consentRespect = clampScore(90 + grantedRatio * 10 + (approvedServiceCount > 0 ? 2 : 0));

  const protectionScores = healthScores.filter((score) => score.id !== "future");
  const goalProtectionRate = clampScore(
    (protectionScores.filter((score) => score.value >= 60).length / Math.max(protectionScores.length, 1)) * 100
  );

  const recoverySuccess = spendingRisk.hasRisk ? 55 : 90;

  const recommendationOutcomeAccuracy = decidedCount > 0 ? clampScore((approvedCount / decidedCount) * 100) : 82;

  const humanEscalationQuality = 90;

  const score = clampScore(
    consentRespect * 0.3 +
      goalProtectionRate * 0.25 +
      recoverySuccess * 0.2 +
      recommendationOutcomeAccuracy * 0.15 +
      humanEscalationQuality * 0.1
  );

  return { score, consentRespect, goalProtectionRate, recoverySuccess, recommendationOutcomeAccuracy, humanEscalationQuality };
}

function getReputationBand(score) {
  if (score < 40) return "restricted";
  if (score < 60) return "underReview";
  if (score < 75) return "buildingTrust";
  if (score < 90) return "trusted";
  return "highlyTrusted";
}

// Confidence Model (04_AI_Agent.md "AI confidence must be explicit and meaningful"): confidence
// reflects how much of the profile is customer-confirmed (edited away from an assumed default)
// versus still an unverified assumption, weighted against Guardian's own proven reputation - not a
// fixed constant shown regardless of what data the recommendation is actually built on.
const confidenceTrackedFields = [
  "age",
  "occupation",
  "monthlyIncome",
  "monthlyExpenses",
  "currentSavings",
  "existingLoans",
  "creditCardOutstanding",
  "investments",
  "insuranceStatus",
  "riskPreference",
];

function getAiConfidence(profile, reputationScore) {
  const confirmedCount = confidenceTrackedFields.filter(
    (field) => String(profile?.[field] ?? "") !== String(defaultProfile[field])
  ).length;
  const dataConfirmation = confirmedCount / confidenceTrackedFields.length;
  return clampScore(58 + dataConfirmation * 26 + (reputationScore - 70) * 0.3, 40, 98);
}

function getConfidenceBand(score) {
  if (score < 50) return "restricted";
  if (score < 70) return "low";
  if (score < 88) return "medium";
  return "high";
}

// Guardian State (08_Guardian_Operating_Principles.md "Guardian States" table): a single, explicit,
// customer-visible state derived only from data that already exists - goal ledger states, prepared
// action decisions, and consent - so "Guardian is active" always comes with a reason. "Executing" is
// omitted because actions apply synchronously in this prototype, so there is no observable moment
// between "awaiting approval" and the ledger/action state updating.
function getGuardianState(preferences, ledgerGoalEntries, visibleActionCards, simulatorActionStates) {
  if (preferences.consentWithdrawn) return "paused";
  const ledgerStates = ledgerGoalEntries.map((entry) => preferences.goalLedger?.[entry.id]?.state ?? "draft");
  if (ledgerStates.some((state) => state === "escalated")) return "escalated";
  if (ledgerStates.some((state) => state === "atRisk")) return "atRisk";
  if (ledgerStates.some((state) => state === "recovery")) return "recovery";
  if (visibleActionCards.some(({ id }) => simulatorActionStates[id] === "pending")) return "awaitingApproval";
  if (ledgerStates.every((state) => state === "completed")) return "completed";
  if (ledgerStates.every((state) => state === "draft")) return "planning";
  return "monitoring";
}

// Goal Ledger Lifecycle (07_Relationship_And_Shared_Responsibility.md): every protected goal moves
// through explicit states instead of silently jumping from planning to execution.
const goalLedgerRiskCategory = {
  wedding: "savings",
  home: "savings",
  emergency: "emergency",
  retirement: "investment",
  family: "insurance",
  investment: "investment",
  business: "debt",
  custom: "future",
};

function getLedgerGoalEntries(profile, customGoals, t) {
  const entries = profileGoalOptions
    .filter(({ id }) => id !== "custom" && profile?.goals?.[id])
    .map(({ id }) => ({ id, label: t(`simulator.goals.${id}`), riskCategory: goalLedgerRiskCategory[id] }));
  customGoals.forEach((goal) => {
    entries.push({ id: goal.id, label: goal.name, riskCategory: "custom" });
  });
  if (!entries.length) entries.push({ id: "emergency", label: t("simulator.goals.emergency"), riskCategory: "emergency" });
  return entries;
}

function getGoalRiskScore(riskCategory, healthScores) {
  return healthScores.find((score) => score.id === riskCategory)?.value ?? 70;
}

const goalSignalColors = {
  wedding: "#d71920",
  home: "#203857",
  emergency: "#0f9f84",
  retirement: "#667085",
  family: "#b45309",
  investment: "#0f9f84",
  business: "#667085",
  custom: "#d71920",
};

// Guardian Monitoring goal signals: only the goals the customer actually selected, scored from the
// same health-score dimensions shown everywhere else - not a fixed list of goal names and numbers
// that stay on screen even when the customer never selected them.
function getMonitoredGoalSignals(selectedGoalIds, healthScores, customGoals, t) {
  return selectedGoalIds.map((goalId) => {
    const definition = profileGoalOptions.find((option) => option.id === goalId);
    const riskCategory = goalLedgerRiskCategory[goalId] ?? "future";
    return {
      id: goalId,
      label: getProfileGoalLabel(goalId, customGoals, t),
      value: getGoalRiskScore(riskCategory, healthScores),
      icon: definition?.icon ?? Target,
      color: goalSignalColors[goalId] ?? "#667085",
    };
  });
}

// Only monitoring <-> atRisk toggles automatically (matches the doc's "risk clears" / "threshold
// crossed" triggers) - every other state requires an explicit customer or Guardian action so a goal
// can never silently jump between planning, recovery, pause, or completion.
function deriveAutoLedgerState(currentState, riskScore) {
  if (currentState === "monitoring" && riskScore < 60) return "atRisk";
  if (currentState === "atRisk" && riskScore >= 60) return "monitoring";
  return currentState;
}

function transitionGoalLedger(setPreferences, goalId, nextState, trigger) {
  setPreferences((current) => {
    const ledger = current.goalLedger ?? {};
    const entry = ledger[goalId] ?? { state: "draft", history: [] };
    if (entry.state === nextState) return current;
    const event = { previousState: entry.state, nextState, trigger, at: Date.now() };
    return {
      ...current,
      goalLedger: {
        ...ledger,
        [goalId]: { state: nextState, history: [event, ...entry.history].slice(0, 10) },
      },
    };
  });
}

const goalLedgerActionsByState = {
  draft: [{ action: "commit", nextState: "monitoring", trigger: "customerConfirmedGoal" }],
  committed: [],
  monitoring: [
    { action: "pause", nextState: "paused", trigger: "customerPaused" },
    { action: "complete", nextState: "completed", trigger: "targetAchieved" },
    { action: "abandon", nextState: "abandoned", trigger: "customerAbandoned" },
  ],
  atRisk: [
    { action: "recover", nextState: "recovery", trigger: "customerAcceptedRecoveryPlan" },
    { action: "escalate", nextState: "escalated", trigger: "riskExceededAutonomy" },
  ],
  recovery: [
    { action: "resolveRecovery", nextState: "monitoring", trigger: "recoveryResolved" },
    { action: "escalate", nextState: "escalated", trigger: "riskExceededAutonomy" },
  ],
  paused: [{ action: "resume", nextState: "monitoring", trigger: "customerResumedGoal" }],
  completed: [],
  abandoned: [{ action: "reopen", nextState: "draft", trigger: "customerReopenedGoal" }],
  escalated: [{ action: "resolveEscalation", nextState: "monitoring", trigger: "reviewResolved" }],
};

// Shared Goal Contract (07_Relationship_And_Shared_Responsibility.md): makes the relationship
// explicit per goal instead of leaving it as implied UI copy - every field is derived from data
// that already exists on the ledger entry, autonomy level, and Guardian settings.
const contractPriorityByState = {
  draft: "flexible",
  committed: "important",
  monitoring: "important",
  atRisk: "critical",
  recovery: "critical",
  paused: "paused",
  completed: "important",
  abandoned: "flexible",
  escalated: "critical",
};

const contractBoundaryByCategory = {
  savings: "savings",
  emergency: "emergency",
  investment: "investment",
  insurance: "insurance",
  debt: "debt",
  future: "future",
  custom: "custom",
};

function getSharedGoalContract({ goalEntry, state, preferences, level, selectedLevel, t }) {
  const escalationActive = state === "atRisk" || state === "escalated";
  const boundaryKey = contractBoundaryByCategory[goalEntry.riskCategory] ?? "future";
  return {
    goalStatement: t("guardian.contract.goalStatementValue", { goal: goalEntry.label }),
    priorityLevel: t(`guardian.contract.priority.${contractPriorityByState[state] ?? "flexible"}`),
    protectedBoundaries: t(`guardian.contract.boundaries.${boundaryKey}`),
    guardianRole: t(`guardian.goalLedger.obligation.${state}`),
    customerRole: t(`guardian.contract.customerRole.${state}`),
    autonomyLevel: `${t("simulator.levelLabel", { level })} - ${t(selectedLevel.titleKey)}`,
    reviewRhythm: t(`settings.guardian.review.${preferences.guardianReviewFrequency}`),
    escalationPath: t(escalationActive ? "guardian.contract.escalation.active" : "guardian.contract.escalation.standard"),
    exitCondition: t(`guardian.contract.exitCondition.${state}`),
  };
}

const riskPreferenceOptions = [
  { id: "conservative", labelKey: "simulator.riskPreference.conservative" },
  { id: "balanced", labelKey: "simulator.riskPreference.balanced" },
  { id: "growth", labelKey: "simulator.riskPreference.growth" },
];

const simulatorFieldMeta = {
  weddingBudget: { labelKey: "simulator.inputs.weddingBudget", type: "number" },
  weddingDate: { labelKey: "simulator.inputs.weddingDate", type: "month" },
  monthlyIncome: { labelKey: "simulator.inputs.monthlyIncome", type: "number" },
  currentSavings: { labelKey: "simulator.inputs.currentSavings", type: "number" },
  retirementAge: { labelKey: "simulator.inputs.retirementAge", type: "number" },
  riskPreference: { labelKey: "simulator.inputs.riskPreference", type: "select" },
  targetHomeYear: { labelKey: "simulator.inputs.targetHomeYear", type: "number" },
  targetDownPayment: { labelKey: "simulator.inputs.targetDownPayment", type: "number" },
  propertyBudget: { labelKey: "simulator.inputs.propertyBudget", type: "number" },
  mortgageReadiness: { labelKey: "simulator.inputs.mortgageReadiness", type: "text" },
  monthlyExpenses: { labelKey: "simulator.inputs.monthlyExpenses", type: "number" },
  currentEmergencyFund: { labelKey: "simulator.inputs.currentEmergencyFund", type: "number" },
  targetCoverageMonths: { labelKey: "simulator.inputs.targetCoverageMonths", type: "number" },
  currentInvestment: { labelKey: "simulator.inputs.currentInvestment", type: "number" },
  monthlyInvestment: { labelKey: "simulator.inputs.monthlyInvestment", type: "number" },
  targetReturnGoal: { labelKey: "simulator.inputs.targetReturnGoal", type: "number" },
  familyPlanningYear: { labelKey: "simulator.inputs.familyPlanningYear", type: "number" },
  familyMonthlyCost: { labelKey: "simulator.inputs.familyMonthlyCost", type: "number" },
  insuranceReadiness: { labelKey: "simulator.inputs.insuranceReadiness", type: "text" },
  startupCapital: { labelKey: "simulator.inputs.startupCapital", type: "number" },
  launchDate: { labelKey: "simulator.inputs.launchDate", type: "month" },
  customGoalName: { labelKey: "simulator.inputs.customGoalName", type: "text" },
  customTargetAmount: { labelKey: "simulator.inputs.customTargetAmount", type: "number" },
  customTargetDate: { labelKey: "simulator.inputs.customTargetDate", type: "month" },
  customPriority: { labelKey: "simulator.inputs.customPriority", type: "text" },
  customCategory: { labelKey: "simulator.inputs.customCategory", type: "text" },
  customNotes: { labelKey: "simulator.inputs.customNotes", type: "textarea" },
};

const simulatorFieldGroups = {
  wedding: ["weddingBudget", "weddingDate", "monthlyIncome", "currentSavings", "retirementAge", "riskPreference"],
  home: ["targetHomeYear", "targetDownPayment", "propertyBudget", "mortgageReadiness", "monthlyIncome", "currentSavings"],
  emergency: ["monthlyExpenses", "currentEmergencyFund", "targetCoverageMonths"],
  retirement: ["retirementAge", "currentInvestment", "monthlyInvestment", "riskPreference"],
  family: ["familyPlanningYear", "familyMonthlyCost", "insuranceReadiness"],
  investment: ["currentInvestment", "monthlyInvestment", "riskPreference", "targetReturnGoal"],
  business: ["startupCapital", "launchDate", "monthlyIncome", "currentSavings", "riskPreference"],
  custom: [
    "customGoalName",
    "customTargetAmount",
    "customTargetDate",
    "monthlyIncome",
    "currentSavings",
    "monthlyExpenses",
    "customPriority",
    "customCategory",
    "riskPreference",
    "customNotes",
  ],
};

function numberValue(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function monthCountUntil(targetDate) {
  if (!targetDate) return 6;
  const parsed = new Date(`${targetDate}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 6;
  const now = new Date();
  const months = (parsed.getFullYear() - now.getFullYear()) * 12 + (parsed.getMonth() - now.getMonth());
  return Math.max(1, months);
}

function formatMonthCount(months) {
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years}y ${remainder}m` : `${years} years`;
}

function formatMonthDate(value, fallback) {
  if (!value) return fallback;
  const [year, month] = String(value).split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
}

function getSelectedGoalIds(inputs) {
  const selected = simulatorGoalOptions.filter(({ id }) => inputs.goals?.[id]).map(({ id }) => id);
  return selected.length ? selected : ["wedding"];
}

function getGoalLabel(goalId, inputs, t) {
  if (goalId === "custom") return inputs.customGoalName?.trim() || t("simulator.goals.customFallback");
  return t(`simulator.goals.${goalId}`);
}

function getPrimaryGoal(inputs) {
  const selected = getSelectedGoalIds(inputs);
  const customName = String(inputs.customGoalName || "").toLowerCase();
  if (selected.includes("custom") && customName.includes("car")) return "car";
  if (selected.includes("business")) return "business";
  if (selected.includes("custom")) return "custom";
  if (selected.includes("home")) return "home";
  if (selected.includes("wedding")) return "wedding";
  if (selected.includes("emergency")) return "emergency";
  if (selected.includes("retirement")) return "retirement";
  if (selected.includes("investment")) return "investment";
  if (selected.includes("family")) return "family";
  return selected[0] || "wedding";
}

function getSimulatorFieldGroups(inputs, t) {
  const seen = new Set();
  return getSelectedGoalIds(inputs)
    .map((goalId) => {
      const fields = (simulatorFieldGroups[goalId] ?? simulatorFieldGroups.custom).filter((field) => {
        if (seen.has(field)) return false;
        seen.add(field);
        return true;
      });

      return {
        id: goalId,
        title: getGoalLabel(goalId, inputs, t),
        fields,
      };
    })
    .filter((group) => group.fields.length);
}

function buildScenarioFields(goalType, inputs, variant, t) {
  const amount = numberValue(inputs.customTargetAmount, numberValue(inputs.weddingBudget, 35000));
  const weddingBudget = numberValue(inputs.weddingBudget, 35000);
  const emergencyFund = numberValue(inputs.currentEmergencyFund, 36000);
  const monthlyExpenses = numberValue(inputs.monthlyExpenses, 4500);
  const monthsToTarget = monthCountUntil(inputs.customTargetDate);
  const safeMonthly = Math.ceil(amount / Math.max(monthsToTarget + 2, 1) / 50) * 50;
  const balancedMonthly = Math.ceil(amount / Math.max(monthsToTarget, 1) / 50) * 50;
  const highMonthly = Math.ceil(amount / Math.max(monthsToTarget - 2, 1) / 50) * 50;
  const monthlySaving =
    variant === "conservative" ? safeMonthly : variant === "balanced" ? balancedMonthly : highMonthly;
  const completionMonths =
    variant === "conservative" ? monthsToTarget + 2 : variant === "balanced" ? monthsToTarget : Math.max(1, monthsToTarget - 2);
  const emergencyImpact = variant === "highRisk" ? t("simulator.output.impact.weak") : t("simulator.output.impact.protected");

  if (goalType === "wedding") {
    const confirmedMonthly = numberValue(inputs.weddingSavingsMonthly, 0);
    if (confirmedMonthly > 0) {
      const scaled = Math.round((confirmedMonthly * scenarioMonthlyMultiplier[variant]) / 10) * 10;
      return [
        [t("simulator.output.fields.weddingBudget"), formatSgd(Math.round(weddingBudget))],
        [t("simulator.output.fields.weddingDate"), formatMonthDate(inputs.weddingDate, "12 months")],
        [t("simulator.output.fields.monthlySavingNeeded"), formatSgd(scaled)],
      ];
    }
    const multiplier = variant === "conservative" ? 0.82 : variant === "balanced" ? 1 : 1.35;
    return [
      [t("simulator.output.fields.weddingBudget"), formatSgd(Math.round(weddingBudget * multiplier))],
      [t("simulator.output.fields.weddingDate"), formatMonthDate(inputs.weddingDate, "12 months")],
      [t("simulator.output.fields.savingsNeeded"), formatSgd(Math.max(0, Math.round(weddingBudget * multiplier - numberValue(inputs.currentSavings, 0) * 0.25)))],
    ];
  }

  if (goalType === "home") {
    const downPayment = numberValue(inputs.targetDownPayment, 150000);
    const progress = Math.min(100, Math.round((numberValue(inputs.currentSavings, 0) / downPayment) * 100));
    const confirmedMonthly = numberValue(inputs.homeSavingsMonthly, 0);
    const monthlySavingNeeded =
      confirmedMonthly > 0
        ? Math.round((confirmedMonthly * scenarioMonthlyMultiplier[variant]) / 10) * 10
        : Math.round(downPayment / 36);
    return [
      [t("simulator.output.fields.homeTargetYear"), inputs.targetHomeYear || "2030"],
      [t("simulator.output.fields.downPaymentProgress"), `${progress}%`],
      [
        t("simulator.output.fields.mortgageReadiness"),
        variant === "highRisk" ? t("simulator.output.impact.reviewNeeded") : inputs.mortgageReadiness || t("status.preparing"),
      ],
      [t("simulator.output.fields.monthlySavingNeeded"), formatSgd(monthlySavingNeeded)],
    ];
  }

  if (goalType === "car") {
    const carBudget = amount || 90000;
    return [
      [t("simulator.output.fields.carBudget"), formatSgd(carBudget)],
      [t("simulator.output.fields.monthlyRepayment"), variant === "highRisk" ? formatSgd(1450) : formatSgd(950)],
      [t("simulator.output.fields.cashFlowImpact"), variant === "highRisk" ? t("simulator.output.impact.tight") : t("simulator.output.impact.manageable")],
      [t("simulator.output.fields.emergencyImpact"), emergencyImpact],
    ];
  }

  if (goalType === "business") {
    const capital = numberValue(inputs.startupCapital, 80000);
    return [
      [t("simulator.output.fields.startupCapital"), formatSgd(capital)],
      [t("simulator.output.fields.cashRunway"), variant === "highRisk" ? "3 months" : "6 months"],
      [t("simulator.output.fields.loanReadiness"), variant === "highRisk" ? t("simulator.output.impact.reviewNeeded") : t("status.preparing")],
      [t("simulator.output.fields.emergencyImpact"), emergencyImpact],
    ];
  }

  if (goalType === "emergency") {
    const target = monthlyExpenses * numberValue(inputs.targetCoverageMonths, 6);
    return [
      [t("simulator.output.fields.targetCoverage"), `${inputs.targetCoverageMonths || 6} months`],
      [t("simulator.output.fields.currentEmergencyFund"), formatSgd(emergencyFund)],
      [t("simulator.output.fields.monthlySavingNeeded"), formatSgd(Math.max(0, Math.ceil((target - emergencyFund) / 12 / 50) * 50))],
      [t("simulator.output.fields.emergencyImpact"), variant === "highRisk" ? t("simulator.output.impact.weak") : t("simulator.output.impact.strong")],
    ];
  }

  if (goalType === "retirement") {
    const confirmedMonthly = numberValue(inputs.retirementSavingsMonthly, 0);
    if (confirmedMonthly > 0) {
      const scaled = Math.round((confirmedMonthly * scenarioMonthlyMultiplier[variant]) / 10) * 10;
      return [
        [t("simulator.output.fields.monthlyInvestment"), formatSgd(scaled)],
        [t("simulator.output.fields.targetReturn"), `${inputs.targetReturnGoal || 6}%`],
        [t("simulator.output.fields.retirementImpact"), variant === "highRisk" ? t("simulator.output.impact.delayed") : t("simulator.output.impact.onTrack")],
      ];
    }
  }

  if (goalType === "retirement" || goalType === "investment") {
    return [
      [t("simulator.output.fields.currentInvestment"), formatSgd(numberValue(inputs.currentInvestment, 15000))],
      [t("simulator.output.fields.monthlyInvestment"), formatSgd(numberValue(inputs.monthlyInvestment, 500))],
      [t("simulator.output.fields.targetReturn"), `${inputs.targetReturnGoal || 6}%`],
      [t("simulator.output.fields.retirementImpact"), variant === "highRisk" ? t("simulator.output.impact.delayed") : t("simulator.output.impact.onTrack")],
    ];
  }

  if (goalType === "family") {
    return [
      [t("simulator.output.fields.familyTargetYear"), inputs.familyPlanningYear || "2030"],
      [t("simulator.output.fields.familyMonthlyCost"), formatSgd(numberValue(inputs.familyMonthlyCost, 1800))],
      [t("simulator.output.fields.insuranceReadiness"), inputs.insuranceReadiness || t("status.review")],
      [t("simulator.output.fields.emergencyImpact"), emergencyImpact],
    ];
  }

  return [
    [t("simulator.output.fields.goalName"), inputs.customGoalName?.trim() || t("simulator.goals.customFallback")],
    [t("simulator.output.fields.targetAmount"), formatSgd(amount)],
    [
      t("simulator.output.fields.targetDate"),
      variant === "balanced" ? formatMonthDate(inputs.customTargetDate, formatMonthCount(completionMonths)) : formatMonthCount(completionMonths),
    ],
    [t("simulator.output.fields.monthlySavingNeeded"), formatSgd(monthlySaving)],
    [t("simulator.output.fields.emergencyImpact"), emergencyImpact],
  ];
}

// Future Mirror scenario score (06_Future_Mirror.md): feasibility of each scenario's required
// monthly saving against the customer's actual income minus expenses, so the score - not just the
// field details - moves when the customer edits their numbers instead of only toggling by goal type.
const scenarioMonthlyMultiplier = { conservative: 0.75, balanced: 1, highRisk: 1.4 };
const scenarioVariantBonus = { conservative: 6, balanced: 0, highRisk: -12 };

function getScenarioScore(variant, inputs) {
  const availableMonthly = Math.max(
    numberValue(inputs.monthlyIncome, 7500) - numberValue(inputs.monthlyExpenses, 3600),
    100
  );
  const requiredMonthly = Math.max(getRecommendedMonthlySaving(inputs) * scenarioMonthlyMultiplier[variant], 50);
  const affordabilityRatio = availableMonthly / requiredMonthly;
  // Cap the affordability contribution below 96 before applying the variant bonus/malus, so a very
  // generous income never collapses all three scenarios to the same ceiling - conservative, balanced,
  // and high-risk must stay meaningfully distinct even when every plan is easily affordable.
  const affordabilityScore = clampScore(50 + affordabilityRatio * 20, 50, 90);
  return clampScore(affordabilityScore + scenarioVariantBonus[variant], 35, 96);
}

function getDynamicSimulatorScenarios(inputs, t) {
  const goalType = getPrimaryGoal(inputs);
  return [
    {
      id: "conservative",
      titleKey: "simulator.output.scenarios.conservative.title",
      detailKey: "simulator.output.scenarios.conservative.detail",
      score: getScenarioScore("conservative", inputs),
      riskKey: "risk.low",
      riskClass: "Low",
      fields: buildScenarioFields(goalType, inputs, "conservative", t),
    },
    {
      id: "balanced",
      titleKey: "simulator.output.scenarios.balanced.title",
      detailKey: "simulator.output.scenarios.balanced.detail",
      score: getScenarioScore("balanced", inputs),
      riskKey: "risk.low",
      riskClass: "Low",
      fields: buildScenarioFields(goalType, inputs, "balanced", t),
      recommended: true,
    },
    {
      id: "highRisk",
      titleKey: "simulator.output.scenarios.highRisk.title",
      detailKey: "simulator.output.scenarios.highRisk.detail",
      score: getScenarioScore("highRisk", inputs),
      riskKey: "risk.high",
      riskClass: "High",
      fields: buildScenarioFields(goalType, inputs, "highRisk", t),
    },
  ];
}

function getSimulatorSummary(inputs, t) {
  const selected = getSelectedGoalIds(inputs).map((goalId) => getGoalLabel(goalId, inputs, t));
  const primary = getGoalLabel(getPrimaryGoal(inputs) === "car" ? "custom" : getPrimaryGoal(inputs), inputs, t);
  return t("simulator.output.dynamicSummary", {
    goal: primary,
    goals: selected.join(", "),
  });
}

function getAgentReasoning(inputs, t) {
  const primaryType = getPrimaryGoal(inputs);
  const primaryGoal = getGoalLabel(primaryType === "car" ? "custom" : primaryType, inputs, t);
  const selected = getSelectedGoalIds(inputs).map((goalId) => getGoalLabel(goalId, inputs, t)).join(", ");
  const customAmount = formatSgd(numberValue(inputs.customTargetAmount, numberValue(inputs.weddingBudget, 35000)));
  const monthly = formatSgd(Math.ceil(numberValue(inputs.customTargetAmount, 6000) / Math.max(monthCountUntil(inputs.customTargetDate), 1) / 50) * 50);

  if (primaryType === "custom" || primaryType === "car") {
    return {
      situation: t("simulator.reasoning.situation", { goal: primaryGoal }),
      goals: selected,
      risk: t(primaryType === "car" ? "simulator.reasoning.carRisk" : "simulator.reasoning.customRisk"),
      recommendation: t("simulator.reasoning.customRecommendation", { goal: primaryGoal, amount: customAmount, monthly }),
      action: t("simulator.reasoning.nextActionCustom", { goal: primaryGoal }),
    };
  }

  return {
    situation: t("simulator.reasoning.situation", { goal: primaryGoal }),
    goals: selected,
    risk: t(`simulator.reasoning.${primaryType}Risk`),
    recommendation: t(`simulator.reasoning.${primaryType}Recommendation`),
    action: t(`simulator.reasoning.${primaryType}Action`),
  };
}

function getRecommendedMonthlySaving(inputs) {
  const primaryType = getPrimaryGoal(inputs);
  if (primaryType === "custom" || primaryType === "car") {
    const amount = numberValue(inputs.customTargetAmount, 6000);
    return Math.max(50, Math.ceil(amount / Math.max(monthCountUntil(inputs.customTargetDate), 1) / 50) * 50);
  }
  if (primaryType === "business") return 1200;
  if (primaryType === "home") {
    const confirmed = numberValue(inputs.homeSavingsMonthly, 0);
    if (confirmed > 0) return confirmed;
    return Math.round(numberValue(inputs.targetDownPayment, 150000) / 36 / 50) * 50;
  }
  if (primaryType === "wedding") {
    const confirmed = numberValue(inputs.weddingSavingsMonthly, 0);
    if (confirmed > 0) return confirmed;
  }
  if (primaryType === "retirement") {
    const confirmed = numberValue(inputs.retirementSavingsMonthly, 0);
    if (confirmed > 0) return confirmed;
  }
  return 450;
}

function getGoalTargetAmount(inputs) {
  const primaryType = getPrimaryGoal(inputs);
  if (primaryType === "home") return numberValue(inputs.targetDownPayment, 150000);
  if (primaryType === "business") return numberValue(inputs.startupCapital, 80000);
  if (primaryType === "emergency") {
    return numberValue(inputs.monthlyExpenses, 4500) * numberValue(inputs.targetCoverageMonths, 6);
  }
  if (primaryType === "retirement" || primaryType === "investment") return numberValue(inputs.currentInvestment, 15000);
  if (primaryType === "family") return numberValue(inputs.familyMonthlyCost, 1800) * 12;
  if (primaryType === "custom" || primaryType === "car") return numberValue(inputs.customTargetAmount, 6000);
  return numberValue(inputs.weddingBudget, 35000);
}

function getGoalTargetDisplay(inputs) {
  const primaryType = getPrimaryGoal(inputs);
  if (primaryType === "home") return inputs.targetHomeYear || "2030";
  if (primaryType === "business") return formatMonthDate(inputs.launchDate, "6 months");
  if (primaryType === "family") return inputs.familyPlanningYear || "2030";
  if (primaryType === "custom" || primaryType === "car") return formatMonthDate(inputs.customTargetDate, "6 months");
  if (primaryType === "wedding") return formatMonthDate(inputs.weddingDate, "12 months");
  return "Ongoing";
}

function getSimulatorActionDetail(actionId, inputs, level, t) {
  const primaryType = getPrimaryGoal(inputs);
  const goal = getGoalLabel(primaryType === "car" ? "custom" : primaryType, inputs, t);
  const monthlySaving = formatSgd(getRecommendedMonthlySaving(inputs));
  const emergencyTarget = formatSgd(
    numberValue(inputs.monthlyExpenses, 4500) * numberValue(inputs.targetCoverageMonths, 6)
  );
  const homeYear = inputs.targetHomeYear || "2030";
  const automationMode =
    level >= 5 ? t("simulator.actionReceipt.autonomousMode") : t("simulator.actionReceipt.approvalMode");

  const details = {
    savingsGoal: {
      prepared: t("simulator.actionDetails.savingsGoal.prepared", { goal }),
      safety: t("simulator.actionDetails.savingsGoal.safety"),
      next: t("simulator.actionDetails.savingsGoal.next", { mode: automationMode }),
    },
    monthlyTransfer: {
      prepared: t("simulator.actionDetails.monthlyTransfer.prepared", { amount: monthlySaving }),
      safety: t("simulator.actionDetails.monthlyTransfer.safety"),
      next: t("simulator.actionDetails.monthlyTransfer.next", { mode: automationMode }),
    },
    emergencyFund: {
      prepared: t("simulator.actionDetails.emergencyFund.prepared", { amount: emergencyTarget }),
      safety: t("simulator.actionDetails.emergencyFund.safety"),
      next: t("simulator.actionDetails.emergencyFund.next"),
    },
    insuranceReview: {
      prepared: t("simulator.actionDetails.insuranceReview.prepared"),
      safety: t("simulator.actionDetails.insuranceReview.safety"),
      next: t("simulator.actionDetails.insuranceReview.next"),
    },
    mortgageReadiness: {
      prepared: t("simulator.actionDetails.mortgageReadiness.prepared", { year: homeYear }),
      safety: t("simulator.actionDetails.mortgageReadiness.safety"),
      next: t("simulator.actionDetails.mortgageReadiness.next"),
    },
    investmentPlan: {
      prepared: t("simulator.actionDetails.investmentPlan.prepared"),
      safety: t("simulator.actionDetails.investmentPlan.safety"),
      next: t("simulator.actionDetails.investmentPlan.next"),
    },
  };

  return details[actionId] ?? details.savingsGoal;
}

const defaultPreferences = {
  profileVersion: currentProfileVersion,
  displayName: "Karina",
  profile: defaultProfile,
  customGoals: [],
  futurePlanProducts: [],
  theme: "light",
  notifications: {
    futureRisk: true,
    spending: true,
    goalProgress: true,
    investment: true,
    mortgage: true,
    insurance: true,
    monthlyReport: true,
    promotional: false,
  },
  notificationFrequency: "daily",
  guardianPermissions: {
    autonomousSavings: true,
    investmentSuggestions: true,
    insuranceRecommendations: true,
    mortgagePlanning: true,
    goalRebalancing: true,
    spendingAlerts: true,
  },
  savingsTransfer: "smart",
  investmentRebalancing: "suggested",
  guardianReviewFrequency: "month",
  guardianPersonality: "future",
  privacyPermissions: {
    spending: true,
    lifeGoals: true,
    transactions: true,
    portfolio: true,
    simulations: true,
    executeActions: true,
  },
  consentWithdrawn: false,
  goalLedger: {},
  escalationHistory: [],
  notificationFeedback: {},
  rejectionCounts: {},
  dismissedActions: [],
  quickActionVisibility: {
    paynow: true,
    scanPay: true,
    fx: true,
  },
};

const appearanceOptions = [
  { id: "light", labelKey: "settings.appearance.light", icon: Sun },
  { id: "dark", labelKey: "settings.appearance.dark", icon: Moon },
  { id: "system", labelKey: "settings.appearance.system", icon: MonitorCog },
];

const notificationOptions = [
  { id: "futureRisk", labelKey: "settings.notifications.futureRisk" },
  { id: "spending", labelKey: "settings.notifications.spending" },
  { id: "goalProgress", labelKey: "settings.notifications.goalProgress" },
  { id: "investment", labelKey: "settings.notifications.investment" },
  { id: "mortgage", labelKey: "settings.notifications.mortgage" },
  { id: "insurance", labelKey: "settings.notifications.insurance" },
  { id: "monthlyReport", labelKey: "settings.notifications.monthlyReport" },
  { id: "promotional", labelKey: "settings.notifications.promotional" },
];

const frequencyOptions = [
  { id: "realtime", labelKey: "settings.frequency.realtime" },
  { id: "daily", labelKey: "settings.frequency.daily" },
  { id: "weekly", labelKey: "settings.frequency.weekly" },
  { id: "monthly", labelKey: "settings.frequency.monthly" },
];

const guardianPermissionOptions = [
  { id: "autonomousSavings", labelKey: "settings.guardian.permissions.autonomousSavings" },
  { id: "investmentSuggestions", labelKey: "settings.guardian.permissions.investmentSuggestions" },
  { id: "insuranceRecommendations", labelKey: "settings.guardian.permissions.insuranceRecommendations" },
  { id: "mortgagePlanning", labelKey: "settings.guardian.permissions.mortgagePlanning" },
  { id: "goalRebalancing", labelKey: "settings.guardian.permissions.goalRebalancing" },
  { id: "spendingAlerts", labelKey: "settings.guardian.permissions.spendingAlerts" },
];

const savingsTransferOptions = [
  { id: "manual", labelKey: "settings.guardian.savings.manual" },
  { id: "smart", labelKey: "settings.guardian.savings.smart" },
  { id: "auto", labelKey: "settings.guardian.savings.auto" },
];

const investmentRebalancingOptions = [
  { id: "manual", labelKey: "settings.guardian.investment.manual" },
  { id: "suggested", labelKey: "settings.guardian.investment.suggested" },
  { id: "auto", labelKey: "settings.guardian.investment.auto" },
];

const guardianReviewOptions = [
  { id: "week", labelKey: "settings.guardian.review.week" },
  { id: "month", labelKey: "settings.guardian.review.month" },
  { id: "quarter", labelKey: "settings.guardian.review.quarter" },
];

const guardianPersonalityOptions = [
  { id: "friendly", labelKey: "settings.guardian.personality.friendly" },
  { id: "professional", labelKey: "settings.guardian.personality.professional" },
  { id: "minimal", labelKey: "settings.guardian.personality.minimal" },
  { id: "future", labelKey: "settings.guardian.personality.future" },
];

const privacyPermissionOptions = [
  { id: "spending", labelKey: "settings.privacy.permissions.spending" },
  { id: "lifeGoals", labelKey: "settings.privacy.permissions.lifeGoals" },
  { id: "transactions", labelKey: "settings.privacy.permissions.transactions" },
  { id: "portfolio", labelKey: "settings.privacy.permissions.portfolio" },
  { id: "simulations", labelKey: "settings.privacy.permissions.simulations" },
  { id: "executeActions", labelKey: "settings.privacy.permissions.executeActions" },
];

const consentHistory = [
  { date: "12 Jul 2026", permissionKey: "settings.privacy.history.futureMirror", statusKey: "status.approved" },
  { date: "14 Jul 2026", permissionKey: "settings.privacy.history.autonomousSavings", statusKey: "status.approved" },
];

const defaultGuardianMemoryEvents = [
  {
    id: "emergency-protection",
    year: "2026",
    titleKey: "guardian.memory.events.emergency.title",
    descriptionKey: "guardian.memory.events.emergency.description",
    impactKey: "guardian.memory.events.emergency.impact",
    productKey: "guardian.memory.events.emergency.product",
    actionKey: "guardian.memory.events.emergency.action",
    reasonKey: "guardian.memory.events.emergency.reason",
    dataKey: "guardian.memory.events.emergency.data",
    statusKey: "status.completed",
  },
  {
    id: "home-readiness",
    year: "2027",
    titleKey: "guardian.memory.events.home.title",
    descriptionKey: "guardian.memory.events.home.description",
    impactKey: "guardian.memory.events.home.impact",
    productKey: "guardian.memory.events.home.product",
    actionKey: "guardian.memory.events.home.action",
    reasonKey: "guardian.memory.events.home.reason",
    dataKey: "guardian.memory.events.home.data",
    statusKey: "status.monitoring",
  },
  {
    id: "family-planning",
    year: "2028",
    titleKey: "guardian.memory.events.family.title",
    descriptionKey: "guardian.memory.events.family.description",
    impactKey: "guardian.memory.events.family.impact",
    productKey: "guardian.memory.events.family.product",
    actionKey: "guardian.memory.events.family.action",
    reasonKey: "guardian.memory.events.family.reason",
    dataKey: "guardian.memory.events.family.data",
    statusKey: "status.review",
  },
  {
    id: "salary-increase",
    year: "2029",
    titleKey: "guardian.memory.events.salary.title",
    descriptionKey: "guardian.memory.events.salary.description",
    impactKey: "guardian.memory.events.salary.impact",
    productKey: "guardian.memory.events.salary.product",
    actionKey: "guardian.memory.events.salary.action",
    reasonKey: "guardian.memory.events.salary.reason",
    dataKey: "guardian.memory.events.salary.data",
    statusKey: "status.active",
  },
];

const guardianHubCards = [
  {
    id: "recommendation",
    titleKey: "guardian.hub.cards.recommendation.title",
    subtitleKey: "guardian.hub.cards.recommendation.subtitle",
    icon: ShieldCheck,
  },
  {
    id: "actionCentre",
    titleKey: "guardian.hub.cards.actionCentre.title",
    subtitleKey: "guardian.hub.cards.actionCentre.subtitle",
    icon: ClipboardCheck,
  },
  {
    id: "monitoring",
    titleKey: "guardian.hub.cards.monitoring.title",
    subtitleKey: "guardian.hub.cards.monitoring.subtitle",
    icon: Target,
  },
  {
    id: "financialStrategy",
    titleKey: "guardian.hub.cards.financialStrategy.title",
    subtitleKey: "guardian.hub.cards.financialStrategy.subtitle",
    icon: Banknote,
  },
  {
    id: "aiReasoning",
    titleKey: "guardian.hub.cards.aiReasoning.title",
    subtitleKey: "guardian.hub.cards.aiReasoning.subtitle",
    icon: Bot,
  },
  {
    id: "memory",
    titleKey: "guardian.hub.cards.memory.title",
    subtitleKey: "guardian.hub.cards.memory.subtitle",
    icon: CalendarClock,
  },
  {
    id: "monthlyReview",
    titleKey: "guardian.hub.cards.monthlyReview.title",
    subtitleKey: "guardian.hub.cards.monthlyReview.subtitle",
    icon: LineChart,
  },
  {
    id: "reputation",
    titleKey: "guardian.hub.cards.reputation.title",
    subtitleKey: "guardian.hub.cards.reputation.subtitle",
    icon: Award,
  },
  {
    id: "goalLedger",
    titleKey: "guardian.hub.cards.goalLedger.title",
    subtitleKey: "guardian.hub.cards.goalLedger.subtitle",
    icon: FileText,
  },
  {
    id: "settings",
    titleKey: "guardian.hub.cards.settings.title",
    subtitleKey: "guardian.hub.cards.settings.subtitle",
    icon: Settings,
  },
];

const dataCollectedKeys = ["spending", "savings", "investments", "products", "goals", "preferences"];
const dataPurposeKeys = ["predict", "simulate", "optimise", "protect"];
const dataProtectionKeys = ["aes", "mas", "pdpa", "cloud"];
const customerControlKeys = ["download", "delete", "disable", "withdraw"];

const screenMotion = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.992 },
  transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
};

function lookup(source, key) {
  return key.split(".").reduce((value, segment) => value?.[segment], source);
}

function formatText(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function makeTranslator(language) {
  return (key, params) => {
    const value = lookup(locales[language], key) ?? lookup(locales.en, key) ?? key;
    return formatText(value, params);
  };
}

function formatSgd(value) {
  return `SGD ${value.toLocaleString("en-SG")}`;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mergeDefaults(defaults, stored) {
  if (!stored || typeof stored !== "object") return defaults;
  return Object.entries(defaults).reduce(
    (next, [key, value]) => ({
      ...next,
      [key]:
        value && typeof value === "object" && !Array.isArray(value)
          ? mergeDefaults(value, stored[key])
          : stored[key] ?? value,
    }),
    {}
  );
}

function applyProfileMigration(preferences, storedPreferences) {
  if (storedPreferences?.profileVersion === currentProfileVersion) return preferences;
  // First-ever load (nothing saved yet): seed the default demo profile.
  // Otherwise a customer's own edits must survive future version bumps - only stamp the
  // new version number, never overwrite displayName/profile that mergeDefaults already preserved.
  if (!storedPreferences) {
    return { ...preferences, profileVersion: currentProfileVersion, displayName: "Karina", profile: defaultProfile };
  }
  return { ...preferences, profileVersion: currentProfileVersion };
}

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getUserProfile(preferences) {
  return mergeDefaults(defaultProfile, preferences?.profile);
}

function getCustomGoals(preferences) {
  return Array.isArray(preferences?.customGoals) ? preferences.customGoals : [];
}

function getProfileAmount(profile, key, fallback = 0) {
  return numberValue(profile?.[key], fallback);
}

function getProfileGoalIds(profile, customGoals = []) {
  const ids = profileGoalOptions.filter(({ id }) => profile?.goals?.[id]).map(({ id }) => id);
  if (customGoals.length && !ids.includes("custom")) ids.push("custom");
  return ids.length ? ids : ["emergency"];
}

function getProfileGoalLabel(goalId, customGoals, t) {
  if (goalId === "custom") return customGoals[0]?.name || t("simulator.goals.customFallback");
  return t(`simulator.goals.${goalId}`);
}

function getDetectedLifeStage(profile, customGoals, t) {
  if (profile?.lifeStage) return profile.lifeStage;
  const goals = getProfileGoalIds(profile, customGoals);
  if (goals.includes("wedding") && goals.includes("home")) return t("lifeGraph.stages.marriageHome");
  if (goals.includes("wedding")) return t("lifeGraph.stages.marriage");
  if (goals.includes("home")) return t("lifeGraph.stages.home");
  if (goals.includes("family")) return t("lifeGraph.stages.family");
  if (goals.includes("business")) return t("lifeGraph.stages.business");
  if (goals.includes("retirement")) return t("lifeGraph.stages.retirement");
  if (goals.includes("investment")) return t("lifeGraph.stages.wealth");
  if (goals.includes("custom")) return t("lifeGraph.stages.custom");
  return t("lifeGraph.stages.emergency");
}

function getLifeTimeline(profile, customGoals, t) {
  const goals = getProfileGoalIds(profile, customGoals);
  if (goals.includes("wedding")) {
    return ["engaged", "weddingPlanning", "familyProtection", "longTermWealth"].map((key) =>
      t(`lifeGraph.timeline.${key}`)
    );
  }
  if (goals.includes("home")) {
    return ["saving", "downPayment", "mortgageReadiness", "homeOwnership"].map((key) =>
      t(`lifeGraph.timeline.${key}`)
    );
  }
  if (goals.includes("custom")) {
    return [
      t("lifeGraph.timeline.today"),
      getProfileGoalLabel("custom", customGoals, t),
      t("lifeGraph.timeline.financialImpact"),
      t("lifeGraph.timeline.futurePlan"),
    ];
  }
  return ["today", "selectedGoal", "nextMilestone", "longTermFuture"].map((key) => t(`lifeGraph.timeline.${key}`));
}

function getHealthScores(profile) {
  const income = getProfileAmount(profile, "monthlyIncome", 11500);
  const expenses = getProfileAmount(profile, "monthlyExpenses", 4500);
  const savings = getProfileAmount(profile, "currentSavings", 85000);
  const loans = getProfileAmount(profile, "existingLoans", 18000);
  const card = getProfileAmount(profile, "creditCardOutstanding", 2400);
  const investments = getProfileAmount(profile, "investments", 15000);
  const emergencyTarget = Math.max(expenses * 6, 1);
  const debtLoad = loans + card;
  const savingsStrength = clampScore((savings / emergencyTarget) * 80, 35, 96);
  const debtHealth = clampScore(100 - (debtLoad / Math.max(income * 12, 1)) * 130, 42, 96);
  const emergencyReadiness = clampScore((Math.min(savings, emergencyTarget) / emergencyTarget) * 100, 20, 98);
  const insuranceProtection = /strong|complete|covered|protected/i.test(profile.insuranceStatus) ? 84 : 58;
  const investmentReadiness = clampScore((investments / Math.max(income * 2, 1)) * 82 + 18, 35, 92);
  const futureHealth = clampScore(
    savingsStrength * 0.27 +
      debtHealth * 0.18 +
      emergencyReadiness * 0.22 +
      insuranceProtection * 0.13 +
      investmentReadiness * 0.2,
    35,
    96
  );

  return [
    { id: "future", labelKey: "home.futureHealthScore", value: futureHealth },
    { id: "savings", labelKey: "lifeGraph.health.savings", value: savingsStrength },
    { id: "debt", labelKey: "lifeGraph.health.debt", value: debtHealth },
    { id: "emergency", labelKey: "lifeGraph.health.emergency", value: emergencyReadiness },
    { id: "insurance", labelKey: "lifeGraph.health.insurance", value: insuranceProtection },
    { id: "investment", labelKey: "lifeGraph.health.investment", value: investmentReadiness },
  ];
}

function getSpendingRisk(profile) {
  const income = getProfileAmount(profile, "monthlyIncome", 7500);
  const expenses = getProfileAmount(profile, "monthlyExpenses", 3600);
  const safeBudget = Math.max(0, Math.round((income * 0.42) / 50) * 50);
  const overBudgetAmount = Math.max(0, expenses - safeBudget);
  const spendingRatio = income > 0 ? Math.round((expenses / income) * 100) : 0;
  const riskLevel = overBudgetAmount > 0 ? "high" : spendingRatio > 38 ? "medium" : "low";
  const suggestedReduction = overBudgetAmount > 0 ? Math.max(100, Math.ceil(overBudgetAmount / 50) * 50) : 0;

  return {
    income,
    expenses,
    safeBudget,
    overBudgetAmount,
    spendingRatio,
    riskLevel,
    suggestedReduction,
    hasRisk: overBudgetAmount > 0,
  };
}

function getNotificationHistory(profile, preferences, t) {
  const spendingRisk = getSpendingRisk(profile);
  const spendingAlertsEnabled =
    preferences.notifications?.spending &&
    preferences.guardianPermissions?.spendingAlerts &&
    !preferences.consentWithdrawn;

  const history = [];

  if (spendingAlertsEnabled && spendingRisk.hasRisk) {
    history.push({
      id: "over-budget",
      icon: AlertTriangle,
      tone: "risk",
      title: t("settings.notifications.history.overBudget.title"),
      detail: t("settings.notifications.history.overBudget.detail", {
        amount: formatSgd(spendingRisk.overBudgetAmount),
        spending: formatSgd(spendingRisk.expenses),
        budget: formatSgd(spendingRisk.safeBudget),
      }),
      time: t("settings.notifications.history.now"),
      status: t("settings.notifications.history.sent"),
    });
  }

  if (preferences.notifications?.futureRisk && !preferences.consentWithdrawn) {
    history.push({
      id: "future-risk",
      icon: ShieldCheck,
      tone: "monitoring",
      title: t("settings.notifications.history.futureRisk.title"),
      detail: t("settings.notifications.history.futureRisk.detail"),
      time: t("settings.notifications.history.today"),
      status: t("status.monitoring"),
    });
  }

  if (preferences.notifications?.goalProgress) {
    history.push({
      id: "goal-progress",
      icon: Target,
      tone: "success",
      title: t("settings.notifications.history.goalProgress.title"),
      detail: t("settings.notifications.history.goalProgress.detail"),
      time: t("settings.notifications.history.yesterday"),
      status: t("status.active"),
    });
  }

  if (!history.length) {
    history.push({
      id: "quiet",
      icon: Bell,
      tone: "muted",
      title: t("settings.notifications.history.quiet.title"),
      detail: t("settings.notifications.history.quiet.detail"),
      time: t("settings.notifications.history.today"),
      status: t("common.on"),
    });
  }

  return history;
}

function getSimulatorDefaultsFromProfile(profile, customGoals = []) {
  const customGoal = customGoals[0];
  const selectedGoals = { ...defaultSimulatorInputs.goals };
  Object.keys(selectedGoals).forEach((goal) => {
    selectedGoals[goal] = Boolean(profile.goals?.[goal]);
  });
  if (customGoal) selectedGoals.custom = true;

  return {
    ...defaultSimulatorInputs,
    goals: selectedGoals,
    monthlyIncome: profile.monthlyIncome,
    currentSavings: profile.currentSavings,
    monthlyExpenses: profile.monthlyExpenses,
    currentInvestment: profile.investments,
    currentEmergencyFund: String(Math.min(getProfileAmount(profile, "currentSavings", 85000), getProfileAmount(profile, "monthlyExpenses", 4500) * 6)),
    customGoalName: customGoal?.name ?? defaultSimulatorInputs.customGoalName,
    customTargetAmount: customGoal?.amount ?? defaultSimulatorInputs.customTargetAmount,
    customTargetDate: customGoal?.date ?? defaultSimulatorInputs.customTargetDate,
    customPriority: customGoal?.priority ?? defaultSimulatorInputs.customPriority,
    customCategory: customGoal?.category ?? defaultSimulatorInputs.customCategory,
    customNotes: customGoal?.notes ?? defaultSimulatorInputs.customNotes,
  };
}

function getAccountDetails(profile, customGoals, healthScores, t) {
  const insuranceScore = healthScores.find((score) => score.id === "insurance")?.value ?? 58;
  const futureHealth = healthScores.find((score) => score.id === "future")?.value ?? 86;
  const goalAmount = customGoals[0]
    ? numberValue(customGoals[0].amount, 6000)
    : Math.round(getProfileAmount(profile, "currentSavings", 85000) * 0.26);
  const goalName = customGoals[0]?.name || t("homeBanking.accounts.futureGoal");

  return {
    savings: {
      title: t("homeBanking.accounts.savings"),
      value: formatSgd(getProfileAmount(profile, "currentSavings", 85000)),
      status: t("accountDetails.status.available"),
      icon: Landmark,
      infoBody: t("accountDetails.info.savings"),
      calculation: t("accountDetails.calculation.savings"),
      recommendation: t("accountDetails.recommendations.savings"),
      activity: [
        [t("accountDetails.activity.salary"), `+${formatSgd(getProfileAmount(profile, "monthlyIncome", 11500))}`],
        [t("accountDetails.activity.goalTransfer"), "-SGD 450"],
        [t("accountDetails.activity.emergencyProtected"), t("common.protected")],
      ],
    },
    creditCard: {
      title: t("homeBanking.accounts.creditCard"),
      value: formatSgd(getProfileAmount(profile, "creditCardOutstanding", 2400)),
      status: t("accountDetails.status.paymentDue"),
      icon: CreditCard,
      infoBody: t("accountDetails.info.creditCard"),
      calculation: t("accountDetails.calculation.creditCard"),
      recommendation: t("accountDetails.recommendations.creditCard"),
      activity: [
        [t("accountDetails.activity.cardSpend"), "-SGD 320"],
        [t("accountDetails.activity.paymentScheduled"), "SGD 800"],
        [t("accountDetails.activity.spendingAlert"), t("status.monitoring")],
      ],
    },
    loan: {
      title: t("homeBanking.accounts.personalLoan"),
      value: formatSgd(getProfileAmount(profile, "existingLoans", 18000)),
      status: t("accountDetails.status.repaying"),
      icon: Banknote,
      infoBody: t("accountDetails.info.loan"),
      calculation: t("accountDetails.calculation.loan"),
      recommendation: t("accountDetails.recommendations.loan"),
      activity: [
        [t("accountDetails.activity.monthlyRepayment"), "-SGD 620"],
        [t("accountDetails.activity.nextDue"), "15 Jul 2026"],
        [t("accountDetails.activity.debtHealth"), `${healthScores.find((score) => score.id === "debt")?.value ?? 81}/100`],
      ],
    },
    investments: {
      title: t("homeBanking.accounts.investments"),
      value: formatSgd(getProfileAmount(profile, "investments", 15000)),
      status: t("accountDetails.status.active"),
      icon: LineChart,
      infoBody: t("accountDetails.info.investments"),
      calculation: t("accountDetails.calculation.investments"),
      recommendation: t("accountDetails.recommendations.investments"),
      activity: [
        [t("accountDetails.activity.monthlyInvestment"), "-SGD 500"],
        [t("accountDetails.activity.riskProfile"), profile.riskPreference],
        [t("accountDetails.activity.investmentReadiness"), `${healthScores.find((score) => score.id === "investment")?.value ?? 72}/100`],
      ],
    },
    insurance: {
      title: t("homeBanking.accounts.insuranceScore"),
      value: `${insuranceScore}/100`,
      status: t("accountDetails.status.reviewRecommended"),
      icon: ShieldCheck,
      infoBody: t("accountDetails.info.insurance"),
      calculation: t("accountDetails.calculation.insurance"),
      recommendation: t("accountDetails.recommendations.insurance"),
      activity: [
        [t("accountDetails.activity.currentStatus"), profile.insuranceStatus],
        [t("accountDetails.activity.protectionGap"), t("status.review")],
        [t("accountDetails.activity.familyReadiness"), `${insuranceScore}/100`],
      ],
    },
    futureGoal: {
      title: t("homeBanking.accounts.futureGoal"),
      value: formatSgd(goalAmount),
      status: t("accountDetails.status.futureosMonitoring"),
      icon: Target,
      infoBody: t("accountDetails.info.futureGoal"),
      calculation: t("accountDetails.calculation.futureGoal"),
      recommendation: t("accountDetails.recommendations.futureGoal", { goal: goalName, score: futureHealth }),
      activity: [
        [t("accountDetails.activity.goalName"), goalName],
        [t("accountDetails.activity.monthlyTransfer"), "SGD 450"],
        [t("accountDetails.activity.guardianStatus"), t("common.on")],
      ],
    },
  };
}

function getEffectiveTheme(theme, systemTheme) {
  return theme === "system" ? systemTheme : theme;
}

function getDisplayName(name) {
  const trimmed = String(name ?? "").trim();
  return trimmed && trimmed.toLowerCase() !== "customer" ? trimmed : "Karina";
}

function getInitials(name) {
  const words = getDisplayName(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase()).join("") || "C";
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ProgressRing({ value, size = 92, stroke = 9, color = "#d71920" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="ringWrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e9edf3" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span>{value}%</span>
    </div>
  );
}

function PhoneShell({ children, activeScreen, setActiveScreen, language, setLanguage, theme, t, hideNav = false }) {
  const navScreen = getNavScreen(activeScreen);

  return (
    <main className={`stage theme-${theme}`}>
      <section className={`phone screen-${navScreen}`} aria-label={t("app.prototypeLabel")}>
        <div className="statusBar">
          <span>9:41</span>
          <div>
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="brandBar">
          <div className="brandMark">OCBC</div>
          <div className="brandActions">
            <label className="languageSwitcher" aria-label={t("language.title")}>
              <Globe2 size={13} />
              <select
                data-testid="language-switcher"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {languageOptions.map((option) => (
                  <option value={option.id} key={option.id}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <div className="securePill">
              <LockKeyhole size={12} />
              {t("common.secure")}
            </div>
          </div>
        </div>
        <div className="screenArea">{children}</div>
        {hideNav ? null : (
          <nav className="bottomNav" aria-label={t("nav.primary")}>
            {navItems.map(({ id, labelKey, icon: Icon }) => {
              const active = navScreen === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={active ? "navItem active" : "navItem"}
                  onPointerDown={() => setActiveScreen(id)}
                  onClick={() => setActiveScreen(id)}
                  data-testid={`bottom-nav-${id}`}
                  aria-label={t(labelKey)}
                  title={t(labelKey)}
                >
                  <Icon size={20} />
                  <span>{t(labelKey)}</span>
                </button>
              );
            })}
          </nav>
        )}
      </section>
    </main>
  );
}

function getNavScreen(activeScreen) {
  if ([screens.PAYNOW, screens.SCAN_PAY, screens.FX].includes(activeScreen)) return screens.HOME;
  if (activeScreen === screens.SPENDING_RISK) return screens.HOME;
  if ([screens.NEED_WEDDING, screens.NEED_HOME, screens.NEED_RETIREMENT, screens.NEED_LOAN, screens.NEED_INVESTMENT].includes(activeScreen)) {
    return screens.MIRROR;
  }
  if ([screens.NEED_EMERGENCY, screens.NEED_INSURANCE].includes(activeScreen)) {
    return screens.LIFE_GRAPH;
  }
  if (activeScreen === screens.LOADING) return screens.MIRROR;
  return activeScreen;
}

function Header({ eyebrow, title, subtitle }) {
  return (
    <header className="pageHeader">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}

// Replaces the old Account Overview section. Deliberately narrative, not a
// stat/score tile: reads only memory events with a real confirmedAt
// (wedding/home/retirement/loan/investment confirmations, hardship
// recovery) — the seeded demo memory events (target-year only, no
// confirmedAt) are excluded so this only ever shows things that genuinely
// happened, never fabricated flavor text.
function SharedJourneySection({ memoryEvents, t, setActiveScreen }) {
  const realEvents = memoryEvents
    .filter((event) => event.confirmedAt)
    .sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt))
    .slice(0, 4);

  return (
    <section className="guardianMemoryPanel recommendationPanel">
      <div className="panelHead">
        <div>
          <span className="sectionLabel">{t("homeBanking.sharedJourney.title")}</span>
          <p>{t("homeBanking.sharedJourney.subtitle")}</p>
        </div>
        <CalendarClock size={18} />
      </div>
      {realEvents.length === 0 ? (
        <div className="needHeroCard">
          <p>{t("homeBanking.sharedJourney.emptyBody")}</p>
          <button type="button" className="primaryButton" onClick={() => setActiveScreen(screens.MIRROR)}>
            {t("homeBanking.sharedJourney.emptyCta")}
            <ChevronRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="memoryTimeline">
            {realEvents.map((event) => (
              <button
                type="button"
                className="memoryEventCard"
                key={event.id}
                onClick={() => setActiveScreen(screens.GUARDIAN)}
                aria-label={t("guardian.memory.openEvent", { event: event.title })}
              >
                <span className="memoryYear">{event.year}</span>
                <i aria-hidden="true" />
                <div>
                  <strong>{event.title}</strong>
                  <small>{event.description}</small>
                  <span className="memoryImpact">
                    {t("guardian.memory.impact")}: {event.impact}
                  </span>
                </div>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <button type="button" className="secondaryButton" onClick={() => setActiveScreen(screens.GUARDIAN)}>
            {t("homeBanking.sharedJourney.viewFullJourney")}
            <ChevronRight size={16} />
          </button>
        </>
      )}
    </section>
  );
}

function HomeDashboard({ goWithLoading, setActiveScreen, displayName, preferences, setPreferences, memoryEvents, t }) {
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [noticeModal, setNoticeModal] = useState(null);
  const NoticeIcon = noticeModal?.icon;
  const profile = getUserProfile(preferences);
  const healthScores = getHealthScores(profile);
  const spendingRisk = getSpendingRisk(profile);
  const notificationHistory = getNotificationHistory(profile, preferences, t);
  const futureHealth = healthScores.find((score) => score.id === "future")?.value ?? 86;
  const homeProgress = profile.goals.home ? 72 : 54;
  const weddingProgress = profile.goals.wedding ? 64 : 0;
  const emergencyProgress = healthScores.find((score) => score.id === "emergency")?.value ?? 80;
  const insuranceProgress = healthScores.find((score) => score.id === "insurance")?.value ?? 58;
  const familyProgress = profile.goals.family
    ? clampScore(emergencyProgress * 0.45 + insuranceProgress * 0.55)
    : 0;
  const retirementProgress = profile.goals.retirement ? 61 : 48;
  const lifeGoalMetric = profile.goals.wedding
    ? {
        id: "wedding",
        label: t("goals.wedding"),
        value: `${weddingProgress}%`,
        progress: weddingProgress,
        info: t("homeBanking.info.wedding"),
        methodKey: "homeBanking.method.wedding",
        proofKeys: ["weddingInputs", "weddingMath", "weddingResult"],
      }
    : {
        id: "family",
        label: t("simulator.goals.family"),
        value: `${familyProgress}%`,
        progress: familyProgress,
        info: t("homeBanking.info.family"),
        methodKey: "homeBanking.method.family",
        proofKeys: ["familyInputs", "familyMath", "familyResult"],
      };

  const quickActionVisibility = preferences.quickActionVisibility ?? defaultPreferences.quickActionVisibility;
  const allQuickActions = [
    {
      id: "paynow",
      label: t("homeBanking.quickActions.paynow"),
      icon: CircleDollarSign,
      onClick: () => setActiveScreen(screens.PAYNOW),
    },
    {
      id: "scanPay",
      label: t("homeBanking.quickActions.scanPay"),
      icon: QrCode,
      onClick: () => setActiveScreen(screens.SCAN_PAY),
    },
    {
      id: "fx",
      label: t("homeBanking.quickActions.fx"),
      icon: ArrowLeftRight,
      onClick: () => setActiveScreen(screens.FX),
    },
  ];
  const quickActions = [
    ...allQuickActions.filter(({ id }) => quickActionVisibility[id]),
    {
      id: "customise",
      label: t("homeBanking.quickActions.customise"),
      icon: SlidersHorizontal,
      onClick: () => setCustomiseOpen(true),
      custom: true,
    },
  ];

  function toggleQuickAction(id) {
    setPreferences((current) => {
      const currentVisibility = current.quickActionVisibility ?? defaultPreferences.quickActionVisibility;
      const nextVisibility = { ...currentVisibility, [id]: !currentVisibility[id] };
      // At least one shortcut must stay visible - customise should never be able to empty the row.
      if (!Object.values(nextVisibility).some(Boolean)) return current;
      return { ...current, quickActionVisibility: nextVisibility };
    });
  }

  const futureMetrics = [
    {
      id: "futureScore",
      label: t("home.futureHealthScore"),
      value: `${futureHealth}/100`,
      progress: futureHealth,
      info: t("homeBanking.info.futureScore"),
      methodKey: "homeBanking.method.futureScore",
      proofKeys: ["futureScoreInputs", "futureScoreWeights", "futureScoreResult"],
    },
    lifeGoalMetric,
    {
      id: "selected",
      label: t("homeBanking.selectedGoal"),
      value: `${homeProgress}%`,
      progress: homeProgress,
      info: t("homeBanking.info.selected"),
      methodKey: "homeBanking.method.selected",
      proofKeys: ["selectedInputs", "selectedMath", "selectedResult"],
    },
    {
      id: "emergency",
      label: t("goals.emergency"),
      value: `${emergencyProgress}%`,
      progress: emergencyProgress,
      info: t("homeBanking.info.emergency"),
      methodKey: "homeBanking.method.emergency",
      proofKeys: ["emergencyInputs", "emergencyMath", "emergencyResult"],
    },
    {
      id: "retirement",
      label: t("goals.retirement"),
      value: `${retirementProgress}%`,
      progress: retirementProgress,
      info: t("homeBanking.info.retirement"),
      methodKey: "homeBanking.method.retirement",
      proofKeys: ["retirementInputs", "retirementMath", "retirementResult"],
    },
  ];

  return (
    <Screen>
      <section className="ocbcHome">
        <section className="bankHero" aria-label={t("homeBanking.heroLabel")}>
          <div className="bankHeroTop">
            <button
              type="button"
              className="heroTextButton"
              onClick={() => setActiveScreen(screens.SCAN_PAY)}
              aria-label={t("homeBanking.scan")}
            >
              <ScanLine size={18} />
              <span>{t("homeBanking.scan")}</span>
            </button>
            <div className="heroActions">
              <button
                type="button"
                className="heroIconButton"
                onClick={() =>
                  setNoticeModal({
                    icon: Bell,
                    title: t("homeBanking.notificationsTitle"),
                    listTitle: t("settings.notifications.history.title"),
                    listItems: notificationHistory.map(({ title, detail }) => `${title}: ${detail}`),
                  })
                }
                aria-label={t("homeBanking.notifications")}
              >
                <Bell size={18} />
              </button>
              <button
                type="button"
                className="logoutLink"
                onClick={() =>
                  setNoticeModal({
                    icon: LogOut,
                    title: t("homeBanking.logoutTitle"),
                    body: t("homeBanking.logoutText"),
                  })
                }
              >
                {t("homeBanking.logout")}
              </button>
            </div>
          </div>
          <motion.div
            className="welcomeBlock"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <span>{t("homeBanking.today")}</span>
            <h1>{t("homeBanking.welcome", { name: displayName })}</h1>
          </motion.div>
        </section>

        <motion.section
          className="quickActionCard"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.08, ease: "easeOut" }}
          aria-label={t("homeBanking.quickActionsLabel")}
        >
          {quickActions.map(({ id, label, icon: Icon, onClick, custom }) => (
            <div className="quickActionSlot" key={id}>
              {custom ? <span className="quickDivider" aria-hidden="true" /> : null}
              <button type="button" className="quickAction" data-testid={`quick-action-${id}`} onClick={onClick}>
                <span className={custom ? "quickIcon customIcon" : "quickIcon"}>
                  <Icon size={21} />
                </span>
                <strong>{label}</strong>
              </button>
            </div>
          ))}
        </motion.section>

        <motion.button
          type="button"
          className={spendingRisk.hasRisk ? "futureAlertCard risk" : "futureAlertCard"}
          onClick={() => setActiveScreen(screens.SPENDING_RISK)}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.12, ease: "easeOut" }}
        >
          <span className="futureAlertIcon">
            <AlertTriangle size={18} />
          </span>
          <span>
            <small>{t("spendingRisk.homeLabel")}</small>
            <strong>
              {spendingRisk.hasRisk
                ? t("spendingRisk.homeTitleRisk")
                : t("spendingRisk.homeTitleSafe")}
            </strong>
            <em>
              {spendingRisk.hasRisk
                ? t("spendingRisk.homeDetailRisk", {
                    amount: formatSgd(spendingRisk.overBudgetAmount),
                    budget: formatSgd(spendingRisk.safeBudget),
                  })
                : t("spendingRisk.homeDetailSafe", { budget: formatSgd(spendingRisk.safeBudget) })}
            </em>
          </span>
          <ChevronRight size={17} />
        </motion.button>

        <SharedJourneySection memoryEvents={memoryEvents} t={t} setActiveScreen={setActiveScreen} />

        <section className="futureOsBankCard">
          <div className="futureCardHeader">
            <span className="futureCardIcon">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>{t("home.title")}</strong>
              <small>{t("home.subtitle")}</small>
            </div>
          </div>
          <div className="guardianMini bankGuardian">
            <ShieldCheck size={20} />
            <p>{t("home.guardianStatus")}</p>
            <span className="pulseDot" />
          </div>
          <section className="futureSystemGrid" aria-label={t("home.futureOsSummary")}>
            <span className="sectionLabel fullWidthLabel">{t("home.futureOsSummary")}</span>
            {futureSystems.map(({ id, titleKey, subtitleKey, icon: Icon, screen }) => (
              <button
                type="button"
                className="futureSystemCard"
                data-testid={`future-system-${id}`}
                key={id}
                onClick={() => goWithLoading(screen, `loading.${id === "futureMirror" ? "mirror" : id}`)}
              >
                <span className="iconBubble">
                  <Icon size={16} />
                </span>
                <span>
                  <strong>{t(titleKey)}</strong>
                  <small>{t(subtitleKey)}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </section>
          <div className="futureMetricList">
            {futureMetrics.map((metric) => (
              <article className="futureMetricRow" key={metric.id}>
                <div className="metricLabelRow">
                  <span>{metric.label}</span>
                  <button
                    type="button"
                    className="infoButton"
                    onClick={() =>
                      setInfoModal({
                        title: metric.label,
                        body: metric.info,
                        value: metric.value,
                        method: t(metric.methodKey),
                        proofKeys: metric.proofKeys,
                      })
                    }
                    aria-label={t("homeBanking.infoLabel", { item: metric.label })}
                  >
                    <Info size={13} />
                  </button>
                </div>
                <strong>{metric.value}</strong>
                <div className="track">
                  <motion.i
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.progress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </article>
            ))}
          </div>
          <button
            type="button"
            className="primaryButton futureOsCta"
            onClick={() => goWithLoading(screens.LIFE_GRAPH, "loading.lifeGraph")}
          >
            {t("homeBanking.openFutureOS")}
            <ChevronRight size={18} />
          </button>
        </section>
      </section>

      {customiseOpen ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("homeBanking.customiseTitle")}>
          <motion.div className="confirmModal shortcutModal" {...screenMotion}>
            <SlidersHorizontal size={24} />
            <strong>{t("homeBanking.customiseTitle")}</strong>
            <p>{t("homeBanking.customiseText")}</p>
            {allQuickActions.map(({ id, label, icon: Icon }) => (
              <ToggleRow
                key={id}
                icon={Icon}
                label={label}
                checked={quickActionVisibility[id]}
                onChange={() => toggleQuickAction(id)}
              />
            ))}
            <button type="button" className="primaryButton" onClick={() => setCustomiseOpen(false)}>
              {t("homeBanking.customiseDone")}
            </button>
          </motion.div>
        </section>
      ) : null}

      {infoModal ? (
        <InfoModal
          icon={Info}
          title={infoModal.title}
          body={infoModal.body}
          scoreLabel={t("homeBanking.currentScore")}
          scoreValue={infoModal.value}
          methodLabel={t("homeBanking.howCalculated")}
          methodText={infoModal.method}
          listTitle={t("lifeGraph.scoreInfo.title")}
          listItems={infoModal.proofKeys.map((key) => t(`homeBanking.proof.${key}`))}
          onClose={() => setInfoModal(null)}
          closeLabel={t("homeBanking.gotIt")}
        />
      ) : null}

      {noticeModal ? (
        <InfoModal
          icon={NoticeIcon}
          title={noticeModal.title}
          body={noticeModal.body}
          listTitle={noticeModal.listTitle}
          listItems={noticeModal.listItems}
          onClose={() => setNoticeModal(null)}
          closeLabel={t("homeBanking.gotIt")}
        />
      ) : null}
    </Screen>
  );
}

function QuickActionScreen({ type, setActiveScreen, t }) {
  const configs = {
    paynow: {
      icon: CircleDollarSign,
      eyebrow: t("mockScreens.paynow.eyebrow"),
      title: t("mockScreens.paynow.title"),
      subtitle: t("mockScreens.paynow.subtitle"),
      primary: t("mockScreens.paynow.primary"),
      rows: [
        [t("mockScreens.paynow.recipient"), t("mockScreens.paynow.goalRecipient")],
        [t("mockScreens.paynow.mobile"), "+65 8123 4567"],
        [t("mockScreens.paynow.amount"), "SGD 450.00"],
      ],
      note: t("mockScreens.paynow.note"),
    },
    scanPay: {
      icon: QrCode,
      eyebrow: t("mockScreens.scan.eyebrow"),
      title: t("mockScreens.scan.title"),
      subtitle: t("mockScreens.scan.subtitle"),
      primary: t("mockScreens.scan.primary"),
      rows: [
        [t("mockScreens.scan.merchant"), "FutureOS Demo Merchant"],
        [t("mockScreens.scan.limit"), "SGD 1,000"],
        [t("mockScreens.scan.status"), t("mockScreens.scan.ready")],
      ],
      note: t("mockScreens.scan.note"),
      scanner: true,
    },
    fx: {
      icon: ArrowLeftRight,
      eyebrow: t("mockScreens.fx.eyebrow"),
      title: t("mockScreens.fx.title"),
      subtitle: t("mockScreens.fx.subtitle"),
      primary: t("mockScreens.fx.primary"),
      rows: [
        ["SGD -> USD", "0.74"],
        ["SGD -> MYR", "3.48"],
        ["SGD -> KRW", "1,020"],
      ],
      note: t("mockScreens.fx.note"),
    },
  };
  const config = configs[type];
  const Icon = config.icon;

  return (
    <Screen>
      <section className="mockBankScreen">
        <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
        <header className="mockBankHero">
          <span className="sectionLabel">{config.eyebrow}</span>
          <div>
            <span className="mockBankIcon">
              <Icon size={24} />
            </span>
            <h1>{config.title}</h1>
          </div>
          <p>{config.subtitle}</p>
        </header>

        {config.scanner ? (
          <section className="scannerPanel" aria-label={config.primary}>
            <div className="scannerFrame">
              <span />
              <QrCode size={76} />
            </div>
            <strong>{config.primary}</strong>
          </section>
        ) : (
          <section className="mockBankAmount">
            <span>{config.primary}</span>
            <strong>{type === "fx" ? "SGD 1.00" : "SGD 450.00"}</strong>
          </section>
        )}

        <section className="mockBankDetails">
          {config.rows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <section className="trustNote mockTrustNote">
          <ShieldCheck size={18} />
          <p>{config.note}</p>
        </section>

        <button type="button" className="primaryButton" onClick={() => setActiveScreen(screens.HOME)}>
          {t("mockScreens.common.done")}
          <ChevronRight size={18} />
        </button>
      </section>
    </Screen>
  );
}

function AccountDetailScreen({ activeAccountId, setActiveScreen, preferences, t }) {
  const profile = getUserProfile(preferences);
  const customGoals = getCustomGoals(preferences);
  const healthScores = getHealthScores(profile);
  const accountDetails = getAccountDetails(profile, customGoals, healthScores, t);
  const account = accountDetails[activeAccountId] ?? accountDetails.savings;
  const Icon = account.icon;
  const [notice, setNotice] = useState("");
  const [detailInfoOpen, setDetailInfoOpen] = useState(false);
  const hasScoreInfo = account.value.includes("/") || account.value.includes("%");

  return (
    <Screen>
      <Header eyebrow={t("accountDetails.eyebrow")} title={account.title} subtitle={t("accountDetails.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
      <NoticeBanner text={notice} />

      <section className="accountDetailHero">
        <span className="bankAccountIcon">
          <Icon size={22} />
        </span>
        <div>
          <span>{t("accountDetails.balance")}</span>
          <strong className="detailValueWithInfo">
            {account.value}
            {hasScoreInfo ? (
              <button
                type="button"
                className="infoButton tinyInfoButton"
                onClick={() => setDetailInfoOpen(true)}
                aria-label={t("homeBanking.infoLabel", { item: account.title })}
              >
                <Info size={11} />
              </button>
            ) : null}
          </strong>
          <small>{account.status}</small>
        </div>
      </section>

      <section className="recommendationPanel">
        <div className="panelHead">
          <span className="sectionLabel">{t("accountDetails.recommendationTitle")}</span>
          <ShieldCheck size={17} />
        </div>
        <p>{account.recommendation}</p>
      </section>

      <section className="supportPanel">
        <span className="sectionLabel">{t("accountDetails.recentActivity")}</span>
        <div className="activityList">
          {account.activity.map(([label, value]) => (
            <SummaryRow label={label} value={value} key={`${label}-${value}`} />
          ))}
        </div>
      </section>

      <div className="buttonPair">
        <button type="button" className="secondaryButton" onClick={() => setActiveScreen(screens.MIRROR)}>
          {t("accountDetails.simulateImpact")}
          <LineChart size={17} />
        </button>
        <button
          type="button"
          className="primaryButton"
          onClick={() => setNotice(t("accountDetails.addedToPlan", { account: account.title }))}
        >
          {t("accountDetails.addToFuturePlan")}
          <CheckCircle2 size={17} />
        </button>
      </div>

      {detailInfoOpen ? (
        <InfoModal
          icon={Info}
          title={account.title}
          body={account.infoBody}
          scoreLabel={t("homeBanking.currentScore")}
          scoreValue={account.value}
          methodLabel={t("homeBanking.howCalculated")}
          methodText={account.calculation}
          onClose={() => setDetailInfoOpen(false)}
          closeLabel={t("homeBanking.gotIt")}
        />
      ) : null}
    </Screen>
  );
}

function LifeGraph({ goWithLoading, setActiveScreen, preferences, setPreferences, setSimulatorInputs, t }) {
  const [healthAnalysisOpen, setHealthAnalysisOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [strategyModal, setStrategyModal] = useState(null);
  const [productModal, setProductModal] = useState(null);
  const [customGoalOpen, setCustomGoalOpen] = useState(false);
  const [customGoalDraft, setCustomGoalDraft] = useState(defaultCustomGoalDraft);
  const [notice, setNotice] = useState("");
  const profile = getUserProfile(preferences);
  const customGoals = getCustomGoals(preferences);
  const detectedStage = getDetectedLifeStage(profile, customGoals, t);
  const timelineSteps = getLifeTimeline(profile, customGoals, t);
  const healthScores = getHealthScores(profile);
  const selectedGoalIds = getProfileGoalIds(profile, customGoals);
  const detectedNeeds = getDetectedNeeds(selectedGoalIds, healthScores);
  const StrategyIcon = strategyModal?.icon;
  const ProductIcon = productModal?.icon;
  const visibleProducts = productRecommendations
    .map((product) => {
      const added = Boolean(preferences.futurePlanProducts?.includes(product.id));
      const resultInfo = getProductState(product, { healthScores, selectedGoalIds, added });
      return { product, resultInfo };
    })
    .filter(({ resultInfo }) => resultInfo.state !== "notApplicable");
  const productModalInfo = productModal
    ? getProductState(productModal, {
        healthScores,
        selectedGoalIds,
        added: Boolean(preferences.futurePlanProducts?.includes(productModal.id)),
      })
    : null;
  const productModalEvidence = productModal
    ? getProductEvidence(productModal, { profile, healthScores, resultInfo: productModalInfo }, t)
    : null;

  function saveCustomGoal() {
    const goal = {
      id: `custom-${Date.now()}`,
      name: customGoalDraft.name.trim() || t("lifeGraph.customGoal.defaultName"),
      amount: customGoalDraft.amount || "6000",
      date: customGoalDraft.date || "2027-01",
      priority: customGoalDraft.priority || "High",
      category: customGoalDraft.category || "Lifestyle",
      notes: customGoalDraft.notes || "",
    };

    setPreferences((current) => {
      const currentProfile = getUserProfile(current);
      return {
        ...current,
        customGoals: [goal, ...getCustomGoals(current)],
        profile: {
          ...currentProfile,
          goals: { ...currentProfile.goals, custom: true },
        },
      };
    });
    setSimulatorInputs((current) => ({
      ...current,
      goals: { ...current.goals, custom: true },
      customGoalName: goal.name,
      customTargetAmount: goal.amount,
      customTargetDate: goal.date,
      customPriority: goal.priority,
      customCategory: goal.category,
      customNotes: goal.notes,
    }));
    setNotice(t("lifeGraph.customGoal.added", { goal: goal.name }));
    setCustomGoalDraft(defaultCustomGoalDraft);
    setCustomGoalOpen(false);
  }

  function addProductToPlan(product) {
    setPreferences((current) => {
      const existing = Array.isArray(current.futurePlanProducts) ? current.futurePlanProducts : [];
      return {
        ...current,
        futurePlanProducts: existing.includes(product.id) ? existing : [...existing, product.id],
      };
    });
    setNotice(t("lifeGraph.productFit.added", { product: product.name }));
  }

  // Relationship Manager escalation (04_Build_With_OCBC.md "the handoff should preserve context so
  // the customer does not repeat the full story"): record the evidence already gathered instead of
  // letting it vanish after the toast, so the escalation stays reviewable in the customer's own history.
  function requestRelationshipManagerReview(product, resultInfo, evidence) {
    setPreferences((current) => {
      const existing = Array.isArray(current.escalationHistory) ? current.escalationHistory : [];
      const record = {
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        goal: resultInfo.relevantGoal ? t(`simulator.goals.${resultInfo.relevantGoal}`) : t("lifeGraph.productFit.evidence.noGoal"),
        reason: evidence.suitabilityReason,
        at: Date.now(),
      };
      return { ...current, escalationHistory: [record, ...existing].slice(0, 10) };
    });
    setNotice(t("lifeGraph.productFit.escalatedNotice", { product: product.name }));
  }

  return (
    <Screen>
      <Header title={t("lifeGraph.title")} subtitle={t("lifeGraph.subtitle")} />
      <div className="weddingTopRow">
        <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
        <button
          type="button"
          className="historyButton"
          onClick={() => setHealthAnalysisOpen(true)}
          aria-label={t("lifeGraph.health.title")}
        >
          <ChartNoAxesColumnIncreasing size={16} />
        </button>
      </div>
      <NoticeBanner text={notice} />

      {healthAnalysisOpen ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("lifeGraph.health.title")}>
          <motion.div className="confirmModal" {...screenMotion}>
            <ChartNoAxesColumnIncreasing size={24} />
            <strong>{t("lifeGraph.health.title")}</strong>
            <div className="scoreGrid">
              {healthScores.map((score) => (
                <article className="healthScoreCard" key={score.id}>
                  <div>
                    <strong>{t(score.labelKey)}</strong>
                    <button
                      type="button"
                      className="infoButton"
                      onClick={() => setInfoModal(score)}
                      aria-label={t("homeBanking.infoLabel", { item: t(score.labelKey) })}
                    >
                      <Info size={13} />
                    </button>
                  </div>
                  <ProgressRing value={score.value} size={66} stroke={7} color={score.value >= 75 ? "#0f9f84" : score.value >= 60 ? "#f59e0b" : "#d71920"} />
                  <b>{score.value}/100</b>
                </article>
              ))}
            </div>
            <button type="button" className="primaryButton" onClick={() => setHealthAnalysisOpen(false)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
      ) : null}

      {infoModal ? (
        <InfoModal
          icon={Info}
          title={t(infoModal.labelKey)}
          scoreLabel={t("homeBanking.currentScore")}
          scoreValue={`${infoModal.value}/100`}
          listTitle={t("lifeGraph.scoreInfo.title")}
          listItems={[
            t(`lifeGraph.scoreInfo.${infoModal.id}.meaning`),
            t(`lifeGraph.scoreInfo.${infoModal.id}.method`),
            t(`lifeGraph.scoreInfo.${infoModal.id}.data`),
            t(`lifeGraph.scoreInfo.${infoModal.id}.improve`),
          ]}
          onClose={() => setInfoModal(null)}
          closeLabel={t("homeBanking.gotIt")}
        />
      ) : null}

      <section className="agentReasoningPanel">
        <div className="panelHead">
          <span className="sectionLabel">{t("lifeGraph.futureAnalyst.title")}</span>
          <Bot size={17} />
        </div>
        <SummaryRow label={t("lifeGraph.futureAnalyst.profileSignal")} value={detectedStage} />
        <SummaryRow label={t("lifeGraph.futureAnalyst.goalSignal")} value={selectedGoalIds.map((goalId) => getProfileGoalLabel(goalId, customGoals, t)).join(", ")} />
        <SummaryRow label={t("lifeGraph.futureAnalyst.riskSignal")} value={t("lifeGraph.futureAnalyst.riskValue")} />
        <SummaryRow label={t("lifeGraph.futureAnalyst.nextSignal")} value={t("lifeGraph.futureAnalyst.nextValue")} />
      </section>

      <section className="detectedNeeds">
        <span className="sectionLabel">{t("lifeGraph.detectedNeeds")}</span>
        {detectedNeeds.length ? (
          <div>
            {detectedNeeds.map(({ id, titleKey, screen, icon: Icon }) => (
              <button
                type="button"
                className="needChip"
                key={id}
                data-testid={`need-${id}`}
                onClick={() => setActiveScreen(screen)}
              >
                <Icon size={15} />
                <span>{t(titleKey)}</span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <p className="noDetectedNeeds">{t("lifeGraph.noDetectedNeeds")}</p>
        )}
      </section>

      <section className="timelinePanel">
        <span className="sectionLabel">{t("lifeGraph.timelineTitle")}</span>
        <div className="lifeTimeline">
          {timelineSteps.map((step, index) => (
            <div className="lifeNode" key={step}>
              <i>{index + 1}</i>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="insightCard">
        <Sparkles size={20} />
        <p>{t("lifeGraph.strategySentence")}</p>
      </section>

      <section className="strategyGrid">
        {strategyCards.map(({ id, titleKey, detailKey, icon: Icon }) => (
          <button type="button" className="strategyCard" key={id} onClick={() => setStrategyModal({ titleKey, detailKey, icon: Icon })}>
            <span className="iconBubble">
              <Icon size={16} />
            </span>
            <span>
              <strong>{t(titleKey)}</strong>
              <small>{t(detailKey)}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ))}
      </section>

      <section className="productFitPanel">
        <div className="panelHead">
          <div>
            <span className="sectionLabel">{t("lifeGraph.productFit.title")}</span>
            <p>{t("lifeGraph.productFit.purpose")}</p>
          </div>
          <Landmark size={18} />
        </div>
        <section className="trustNote compactTrustNote">
          <Info size={17} />
          <p>{t("lifeGraph.productFit.disclaimer")}</p>
        </section>
        <div className="productFitList">
          {visibleProducts.map(({ product, resultInfo }) => {
            const Icon = product.icon;
            const evidence = getProductEvidence(product, { profile, healthScores, resultInfo }, t);
            return (
              <article className={resultInfo.accepted ? "productFitCard added" : "productFitCard"} key={product.id}>
                <div className="productFitHead">
                  <span className="iconBubble">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{t(product.categoryKey)}</small>
                  </div>
                  {resultInfo.accepted ? <CheckCircle2 size={16} /> : null}
                </div>
                <div className="productStateRow">
                  <b className={`statePill state-${resultInfo.state}`}>
                    {t(`lifeGraph.productFit.state.${resultInfo.state}`)}
                  </b>
                  <span className="prototypeTag">{t("lifeGraph.productFit.prototypeTag")}</span>
                </div>
                <div className="proofBlock">
                  <strong>{t("lifeGraph.productFit.evidence.suitabilityReasonLabel")}</strong>
                  <p>{evidence.suitabilityReason}</p>
                </div>
                <div className="proofBlock">
                  <strong>{t("lifeGraph.productFit.evidence.goalSupportedLabel")}</strong>
                  <p>{evidence.goalSupported}</p>
                </div>
                <div className="buttonPair compactButtons">
                  <button type="button" className="secondaryButton" onClick={() => setProductModal(product)}>
                    {t("lifeGraph.productFit.viewEvidence")}
                  </button>
                  {resultInfo.state === "blocked" ? (
                    <button type="button" className="primaryButton" disabled>
                      {t("lifeGraph.productFit.blockedCta")}
                    </button>
                  ) : resultInfo.state === "recommendReview" ? (
                    <button type="button" className="primaryButton" onClick={() => requestRelationshipManagerReview(product, resultInfo, evidence)}>
                      {t("lifeGraph.productFit.escalateRm")}
                    </button>
                  ) : (
                    <button type="button" className="primaryButton" onClick={() => addProductToPlan(product)}>
                      {resultInfo.accepted ? t("status.active") : t("lifeGraph.productFit.addToPlan")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {preferences.escalationHistory?.length ? (
          <div className="historyTimeline">
            <span className="sectionLabel">{t("lifeGraph.productFit.escalationHistoryTitle")}</span>
            {preferences.escalationHistory.map((record) => (
              <article key={record.id}>
                <span>{new Date(record.at).toLocaleDateString()}</span>
                <div>
                  <strong>{t("lifeGraph.productFit.escalationHistoryItem", { product: record.productName, goal: record.goal })}</strong>
                  <small>{record.reason}</small>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <button type="button" className="secondaryButton" onClick={() => setCustomGoalOpen(true)}>
        <Target size={18} />
        {t("lifeGraph.customGoal.addButton")}
      </button>

      <button
        type="button"
        className="primaryButton"
        onClick={() => goWithLoading(screens.MIRROR, "loading.mirror")}
      >
        {t("lifeGraph.openMirror")}
        <ChevronRight size={18} />
      </button>

      {strategyModal ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t(strategyModal.titleKey)}>
          <motion.div className="confirmModal" {...screenMotion}>
            {StrategyIcon ? <StrategyIcon size={24} /> : null}
            <strong>{t(strategyModal.titleKey)}</strong>
            <p>{t(strategyModal.detailKey)}</p>
            <p>{t("lifeGraph.strategy.modalDetail")}</p>
            <button type="button" className="primaryButton" onClick={() => setStrategyModal(null)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
      ) : null}

      {productModal ? (
        <InfoModal
          icon={ProductIcon}
          title={productModal.name}
          tag={t("lifeGraph.productFit.prototypeTag")}
          scoreLabel={t("lifeGraph.productFit.evidence.stateLabel")}
          scoreValue={t(`lifeGraph.productFit.state.${productModalInfo.state}`)}
          scoreValueClassName={`statePill state-${productModalInfo.state}`}
          listTitle={t("lifeGraph.productFit.evidence.title")}
          listItems={[
            `${t("lifeGraph.productFit.evidence.goalSupportedLabel")}: ${productModalEvidence.goalSupported}`,
            `${t("lifeGraph.productFit.evidence.dataUsedLabel")}: ${productModalEvidence.dataUsed}`,
            `${t("lifeGraph.productFit.evidence.suitabilityReasonLabel")}: ${productModalEvidence.suitabilityReason}`,
            `${t("lifeGraph.productFit.evidence.productRiskLabel")}: ${productModalEvidence.productRisk}`,
            `${t("lifeGraph.productFit.evidence.alternativeLabel")}: ${productModalEvidence.alternativeConsidered}`,
            `${t("lifeGraph.productFit.evidence.conflictCheckLabel")}: ${productModalEvidence.conflictCheck}`,
            `${t("lifeGraph.productFit.evidence.expectedImpactLabel")}: ${productModalEvidence.expectedImpact}`,
            `${t("lifeGraph.productFit.evidence.limitationLabel")}: ${productModalEvidence.limitation}`,
            `${t("lifeGraph.productFit.evidence.humanReviewLabel")}: ${productModalEvidence.humanReview}`,
          ]}
          footerText={t("lifeGraph.productFit.disclaimer")}
          onClose={() => setProductModal(null)}
          closeLabel={t("homeBanking.gotIt")}
        />
      ) : null}

      {customGoalOpen ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("lifeGraph.customGoal.title")}>
          <motion.div className="confirmModal customGoalModal" {...screenMotion}>
            <Target size={24} />
            <strong>{t("lifeGraph.customGoal.title")}</strong>
            <div className="financialGrid">
              {[
                ["name", "lifeGraph.customGoal.fields.name", "text"],
                ["amount", "lifeGraph.customGoal.fields.amount", "number"],
                ["date", "lifeGraph.customGoal.fields.date", "month"],
                ["priority", "lifeGraph.customGoal.fields.priority", "text"],
                ["category", "lifeGraph.customGoal.fields.category", "text"],
              ].map(([field, labelKey, type]) => (
                <label className="inputField" key={field}>
                  <span>{t(labelKey)}</span>
                  <input
                    value={customGoalDraft[field]}
                    type={type}
                    inputMode={type === "number" ? "decimal" : undefined}
                    onChange={(event) => setCustomGoalDraft((current) => ({ ...current, [field]: event.target.value }))}
                  />
                </label>
              ))}
              <label className="inputField fullWidthField">
                <span>{t("lifeGraph.customGoal.fields.notes")}</span>
                <textarea
                  value={customGoalDraft.notes}
                  onChange={(event) => setCustomGoalDraft((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
            </div>
            <div className="buttonPair">
              <button type="button" className="secondaryButton" onClick={() => setCustomGoalOpen(false)}>
                {t("simulator.modal.cancel")}
              </button>
              <button type="button" className="primaryButton" onClick={saveCustomGoal}>
                {t("lifeGraph.customGoal.save")}
              </button>
            </div>
          </motion.div>
        </section>
      ) : null}
    </Screen>
  );
}

function DynamicSimulatorField({ fieldId, value, onChange, t }) {
  const field = simulatorFieldMeta[fieldId];
  if (!field) return null;

  if (field.type === "select") {
    return (
      <label className="inputField" key={fieldId}>
        <span>{t(field.labelKey)}</span>
        <select value={value} onChange={(event) => onChange(fieldId, event.target.value)}>
          {riskPreferenceOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="inputField fullWidthField" key={fieldId}>
        <span>{t(field.labelKey)}</span>
        <textarea value={value} onChange={(event) => onChange(fieldId, event.target.value)} />
      </label>
    );
  }

  return (
    <label className="inputField" key={fieldId}>
      <span>{t(field.labelKey)}</span>
      <input
        value={value}
        onChange={(event) => onChange(fieldId, event.target.value)}
        type={field.type === "month" ? "month" : "text"}
        inputMode={field.type === "number" ? "decimal" : undefined}
      />
    </label>
  );
}

function FutureMirrorSimulator({
  setActiveScreen,
  preferences,
  simulatorInputs,
  setSimulatorInputs,
  simulatorRan,
  setSimulatorRan,
  resetSimulation,
  t,
}) {
  const [pendingAutonomous, setPendingAutonomous] = useState(false);
  const [scoreInfoModal, setScoreInfoModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [withdrawImpactOpen, setWithdrawImpactOpen] = useState(false);
  const level = Number(simulatorInputs.independenceLevel);
  const selectedLevel = independenceLevels.find((item) => item.level === level) ?? independenceLevels[0];
  const customGoals = getCustomGoals(preferences);
  const fieldGroups = getSimulatorFieldGroups(simulatorInputs, t);
  const scenarios = getDynamicSimulatorScenarios(simulatorInputs, t);
  const reasoning = getAgentReasoning(simulatorInputs, t);
  const recommendedScenario = scenarios.find((scenario) => scenario.recommended) ?? scenarios[1] ?? scenarios[0];
  const primaryType = getPrimaryGoal(simulatorInputs);
  const goalName = getGoalLabel(primaryType === "car" ? "custom" : primaryType, simulatorInputs, t);

  function updateInput(key, value) {
    setSimulatorInputs((current) => ({ ...current, [key]: value }));
  }

  function toggleGoal(goal) {
    setSimulatorInputs((current) => {
      const nextGoals = { ...current.goals, [goal]: !current.goals[goal] };
      if (!Object.values(nextGoals).some(Boolean)) nextGoals[goal] = true;
      return { ...current, goals: nextGoals };
    });
  }

  function requestLevel(nextLevel) {
    if (nextLevel === 5 && level !== 5) {
      setPendingAutonomous(true);
      return;
    }
    updateInput("independenceLevel", nextLevel);
  }

  function runSimulation() {
    setSimulatorRan(true);
  }

  // Autonomous Guardrails safety controls (04_AI_Agent.md "Level 5 requires... Pause control"):
  // pause and adjust must be real, working downgrades, not inert labels next to a locked plan.
  function pauseAutonomousLock() {
    updateInput("independenceLevel", 4);
    setNotice(t("simulator.autonomousLock.pausedNotice"));
  }

  function adjustAutonomousLock() {
    updateInput("independenceLevel", 4);
    setNotice(t("simulator.autonomousLock.adjustNotice"));
  }

  return (
    <Screen>
      <Header title={t("simulator.title")} subtitle={t("simulator.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
      <NoticeBanner text={notice} />

      <section className="trustNote">
        <ShieldCheck size={18} />
        <p>{t("simulator.trustNote")}</p>
      </section>

      <section className="simulatorForm">
        <span className="sectionLabel">{t("simulator.sections.futureSimulator")}</span>
        <label className="textareaField">
          <span className="sectionLabel">{t("simulator.inputs.situation")}</span>
          <textarea
            value={simulatorInputs.situation}
            onChange={(event) => updateInput("situation", event.target.value)}
            placeholder={t("simulator.inputs.situationPlaceholder")}
          />
        </label>

        <div className="settingsGroup">
          <span className="sectionLabel">{t("simulator.inputs.lifeGoals")}</span>
          <div className="checkboxGrid">
            {simulatorGoalOptions.map(({ id, labelKey, icon: Icon }) =>
              DEDICATED_GOAL_SCREENS[id] ? (
                <button
                  type="button"
                  className="checkOption weddingEntryOption"
                  key={id}
                  onClick={() => setActiveScreen(DEDICATED_GOAL_SCREENS[id].screen)}
                >
                  <Icon size={15} />
                  <span>{t(labelKey)}</span>
                  <span className="weddingEntryTrailing">
                    <b className="miniBadge">{t(DEDICATED_GOAL_SCREENS[id].badgeKey)}</b>
                    <ChevronRight size={14} />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className={simulatorInputs.goals[id] ? "checkOption selected" : "checkOption"}
                  key={id}
                  onClick={() => toggleGoal(id)}
                >
                  <Icon size={15} />
                  <span>{id === "custom" && customGoals[0] ? customGoals[0].name : t(labelKey)}</span>
                  {simulatorInputs.goals[id] ? <Check size={14} /> : null}
                </button>
              )
            )}
          </div>
        </div>
      </section>

      <section className="simulatorForm">
        <div className="settingsGroup">
          <span className="sectionLabel">{t("simulator.sections.aiIndependence")}</span>
          <div className="levelSegment">
            {independenceLevels.map((item) => (
              <button
                type="button"
                key={item.level}
                className={level === item.level ? "levelButton active" : "levelButton"}
                onClick={() => requestLevel(item.level)}
                aria-label={t(item.titleKey)}
              >
                {item.level}
              </button>
            ))}
          </div>
          <article className="levelExplainer">
            <strong>
              {t("simulator.levelLabel", { level })} - {t(selectedLevel.titleKey)}
            </strong>
            <span>{t(selectedLevel.detailKey)}</span>
          </article>
          {level === 5 ? (
            <section className="autonomousLockPanel">
              <strong>{t("simulator.autonomousLock.title")}</strong>
              <SummaryRow label={t("simulator.autonomousLock.goal")} value={getGoalLabel(getPrimaryGoal(simulatorInputs) === "car" ? "custom" : getPrimaryGoal(simulatorInputs), simulatorInputs, t)} />
              <SummaryRow label={t("simulator.autonomousLock.target")} value={formatSgd(getGoalTargetAmount(simulatorInputs))} />
              <SummaryRow label={t("simulator.autonomousLock.monthlyLocked")} value={t("common.perMonth", { amount: formatSgd(getRecommendedMonthlySaving(simulatorInputs)) })} />
              <SummaryRow label={t("simulator.autonomousLock.completion")} value={getGoalTargetDisplay(simulatorInputs)} />
              <SummaryRow label={t("simulator.autonomousLock.progress")} value="18%" />
              <div className="approvalCounters">
                <button type="button" className="miniButton" onClick={pauseAutonomousLock}>
                  {t("simulator.autonomousLock.pause")}
                </button>
                <button type="button" className="miniButton" onClick={adjustAutonomousLock}>
                  {t("simulator.autonomousLock.adjust")}
                </button>
                <button type="button" className="miniButton danger" onClick={() => setWithdrawImpactOpen(true)}>
                  {t("simulator.autonomousLock.withdrawImpact")}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <div className="dynamicFieldGroups">
          {fieldGroups.map((group, index) => (
            <details className="dynamicFieldGroup" key={group.id} open={index === 0 || fieldGroups.length < 3}>
              <summary>{group.title}</summary>
              <div className="financialGrid">
                {group.fields.map((fieldId) => (
                  <DynamicSimulatorField
                    key={fieldId}
                    fieldId={fieldId}
                    value={simulatorInputs[fieldId] ?? ""}
                    onChange={updateInput}
                    t={t}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>

        <div className="buttonPair">
          <button type="button" className="primaryButton" onClick={runSimulation}>
            {t("simulator.run")}
            <Sparkles size={18} />
          </button>
          <button type="button" className="secondaryButton" onClick={resetSimulation}>
            {t("simulator.reset")}
            <RotateCcw size={17} />
          </button>
        </div>
      </section>

      {simulatorRan ? (
        <motion.section className="simulatorOutput" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <section className="insightCard">
            <Bot size={20} />
            <p>{simulatorInputs.situation.trim() || getSimulatorSummary(simulatorInputs, t)}</p>
          </section>

          <section className="scenarioStack">
            <span className="sectionLabel">{t("simulator.sections.scenarioComparison")}</span>
            {scenarios.map((scenario) => (
              <article
                className={scenario.recommended ? "scenarioCard simulatorScenario recommended" : "scenarioCard simulatorScenario"}
                key={scenario.id}
              >
                <div className="scenarioHead">
                  <span>{t(scenario.titleKey)}</span>
                  {scenario.recommended ? <b>{t("status.recommended")}</b> : null}
                </div>
                <p>{t(scenario.detailKey)}</p>
                <div className="scenarioStats scenarioStatsWide">
                  {scenario.fields.map(([label, value]) => (
                    <span key={`${scenario.id}-${label}`}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </span>
                  ))}
                  <span>
                    <small className="scoreLabelWithInfo">
                      {t("mirror.futureScore")}
                      <button
                        type="button"
                        className="infoButton tinyInfoButton"
                        onClick={() =>
                          setScoreInfoModal({
                            title: `${t(scenario.titleKey)} ${t("mirror.futureScore")}`,
                            value: `${scenario.score}/100`,
                          })
                        }
                        aria-label={t("homeBanking.infoLabel", { item: t("mirror.futureScore") })}
                      >
                        <Info size={11} />
                      </button>
                    </small>
                    <strong>{scenario.score}</strong>
                  </span>
                  <span>
                    <small>{t("mirror.risk")}</small>
                    <strong className={`risk risk${scenario.riskClass}`}>{t(scenario.riskKey)}</strong>
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="recommendationPanel">
            <span className="sectionLabel">{t("simulator.sections.futureScore")}</span>
            <SummaryRow label={t("mirror.futureScore")} value={`${recommendedScenario.score}/100`} />
            <SummaryRow label={t("mirror.risk")} value={t(recommendedScenario.riskKey)} />
            <SummaryRow label={t("simulator.output.bestRecommendation")} value={reasoning.recommendation} />
          </section>

          <section className="recommendationHero">
            <ShieldCheck size={22} />
            <div>
              <span className="sectionLabel">{t("simulator.output.bestRecommendation")}</span>
              <p>{reasoning.recommendation}</p>
              <small>{t(`simulator.output.tone.${level}`)}</small>
            </div>
          </section>

          {level === 1 ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{t("simulator.output.adviceOnly")}</p>
            </section>
          ) : null}

          {level >= 3 ? (
            <section className="tradeoffPanel">
              <span className="sectionLabel">{t("simulator.sections.tradeoffAnalysis")}</span>
              <div className="balanceScale">
                <span>{goalName}</span>
                <i />
                <span>{t("simulator.output.futureGoalsLabel")}</span>
              </div>
              <p>{t("simulator.output.tradeoffs")}</p>
            </section>
          ) : null}

          <details className="explainPanel">
            <summary>{t("simulator.output.why")}</summary>
            <SupportList
              title={t("simulator.output.explainTitle")}
              items={[
                t("simulator.output.explain.protectedGoals", { goals: reasoning.goals }),
                reasoning.risk,
                t("simulator.output.explain.products"),
                reasoning.action,
              ]}
            />
          </details>

          <section className="agentReasoningPanel">
            <div className="panelHead">
              <span className="sectionLabel">{t("simulator.sections.riskAnalysis")}</span>
              <Bot size={17} />
            </div>
            <SummaryRow label={t("simulator.reasoning.situationUnderstood")} value={reasoning.situation} />
            <SummaryRow label={t("simulator.reasoning.selectedGoals")} value={reasoning.goals} />
            <SummaryRow label={t("simulator.reasoning.mainRisk")} value={reasoning.risk} />
            <SummaryRow label={t("simulator.reasoning.bestRecommendation")} value={reasoning.recommendation} />
            <SummaryRow label={t("simulator.reasoning.nextAction")} value={reasoning.action} />
          </section>

          <button type="button" className="secondaryButton" onClick={() => setActiveScreen(screens.GUARDIAN)}>
            {t("mirror.cta")}
            <ShieldCheck size={18} />
          </button>
        </motion.section>
      ) : null}

      {scoreInfoModal ? (
        <InfoModal
          icon={Info}
          title={scoreInfoModal.title}
          scoreLabel={t("homeBanking.currentScore")}
          scoreValue={scoreInfoModal.value}
          listTitle={t("lifeGraph.scoreInfo.title")}
          listItems={[
            t("homeBanking.method.futureScore"),
            t("homeBanking.proof.futureScoreInputs"),
            t("homeBanking.proof.futureScoreWeights"),
            t("homeBanking.proof.futureScoreResult"),
          ]}
          onClose={() => setScoreInfoModal(null)}
          closeLabel={t("homeBanking.gotIt")}
        />
      ) : null}

      {pendingAutonomous ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("simulator.modal.title")}>
          <motion.div className="confirmModal" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <AlertTriangle size={24} />
            <strong>{t("simulator.modal.title")}</strong>
            <p>{t("simulator.modal.message")}</p>
            <div className="buttonPair">
              <button type="button" className="secondaryButton" onClick={() => setPendingAutonomous(false)}>
                {t("simulator.modal.cancel")}
                <X size={17} />
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => {
                  updateInput("independenceLevel", 5);
                  setPendingAutonomous(false);
                }}
              >
                {t("simulator.modal.enable")}
                <Check size={17} />
              </button>
            </div>
          </motion.div>
        </section>
      ) : null}

      {withdrawImpactOpen ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("simulator.autonomousLock.withdrawImpactTitle")}>
          <motion.div className="confirmModal" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <AlertTriangle size={24} />
            <strong>{t("simulator.autonomousLock.withdrawImpactTitle")}</strong>
            <p>{t("simulator.autonomousLock.withdrawImpactBody")}</p>
            <div className="buttonPair">
              <button type="button" className="secondaryButton" onClick={() => setWithdrawImpactOpen(false)}>
                {t("simulator.modal.cancel")}
                <X size={17} />
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => {
                  setWithdrawImpactOpen(false);
                  setActiveScreen(screens.PROFILE);
                }}
              >
                {t("simulator.autonomousLock.withdrawImpactCta")}
                <ChevronRight size={17} />
              </button>
            </div>
          </motion.div>
        </section>
      ) : null}
    </Screen>
  );
}

function FutureSelfGuardian({
  setActiveScreen,
  preferences,
  setPreferences,
  simulatorInputs,
  simulatorActionStates,
  setSimulatorActionStates,
  memoryEvents,
  t,
}) {
  const [guardianApplied, setGuardianApplied] = useState(false);
  const [protectedScoreInfoOpen, setProtectedScoreInfoOpen] = useState(false);
  const [guardianStateInfoOpen, setGuardianStateInfoOpen] = useState(false);
  const [confidenceInfoOpen, setConfidenceInfoOpen] = useState(false);
  const [selectedMemoryEvent, setSelectedMemoryEvent] = useState(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [selectedContractGoalId, setSelectedContractGoalId] = useState(null);
  const [lastApprovedServiceId, setLastApprovedServiceId] = useState(null);
  const level = Number(simulatorInputs.independenceLevel);
  const selectedLevel = independenceLevels.find((item) => item.level === level) ?? independenceLevels[0];
  const reasoning = getAgentReasoning(simulatorInputs, t);
  const primaryType = getPrimaryGoal(simulatorInputs);
  const goalName = getGoalLabel(primaryType === "car" ? "custom" : primaryType, simulatorInputs, t);
  const selectedGoalIds = getSelectedGoalIds(simulatorInputs);
  const profile = getUserProfile(preferences);
  const customGoals = getCustomGoals(preferences);
  const displayName = getDisplayName(preferences.displayName);
  const visibleActionCards = simulatorActionCards.filter(({ id }) => {
    if (id === "mortgageReadiness") return selectedGoalIds.includes("home");
    if (id === "insuranceReview") return selectedGoalIds.includes("family") || selectedGoalIds.includes("home");
    if (id === "investmentPlan") return selectedGoalIds.includes("investment") || selectedGoalIds.includes("retirement");
    return true;
  });
  const approvedActionCount = visibleActionCards.filter(({ id }) => simulatorActionStates[id] === "approved").length;
  const skippedActionCount = visibleActionCards.filter(({ id }) => simulatorActionStates[id] === "skipped").length;
  const approvedServiceCount = ocbcServiceActions.filter(({ id }) => simulatorActionStates[id] === "approved").length;
  const healthScores = getHealthScores(profile);
  const spendingRisk = getSpendingRisk(profile);
  const monitoredGoalSignals = getMonitoredGoalSignals(selectedGoalIds, healthScores, customGoals, t);
  // "Future Score" / "Protected Score" is the customer's own Future Health Score (Home/Life Graph use
  // the same getHealthScores formula) - it must not diverge into a second, Guardian-only number.
  const futureScore = healthScores.find((score) => score.id === "future")?.value ?? 86;
  const activeGoalCount = selectedGoalIds.length;
  const reputation = getGuardianReputationScore({
    preferences,
    healthScores,
    spendingRisk,
    approvedCount: approvedActionCount,
    decidedCount: approvedActionCount + skippedActionCount,
    approvedServiceCount,
  });
  const reputationBand = getReputationBand(reputation.score);
  const aiConfidence = getAiConfidence(profile, reputation.score);
  const confidenceBand = getConfidenceBand(aiConfidence);
  const ledgerGoalEntries = getLedgerGoalEntries(profile, customGoals, t);
  const guardianState = getGuardianState(preferences, ledgerGoalEntries, visibleActionCards, simulatorActionStates);
  const hardshipTriggered = spendingRisk.riskLevel === "high" || guardianState === "atRisk";

  useEffect(() => {
    ledgerGoalEntries.forEach(({ id, riskCategory }) => {
      const entry = preferences.goalLedger?.[id];
      if (!entry) return;
      const riskScore = getGoalRiskScore(riskCategory, healthScores);
      const nextState = deriveAutoLedgerState(entry.state, riskScore);
      if (nextState !== entry.state) {
        transitionGoalLedger(
          setPreferences,
          id,
          nextState,
          nextState === "atRisk" ? "riskThresholdCrossed" : "riskCleared"
        );
      }
    });
  });

  function handleLedgerAction(goalId, action) {
    const transition = (goalLedgerActionsByState[
      preferences.goalLedger?.[goalId]?.state ?? "draft"
    ] ?? []).find((item) => item.action === action);
    if (!transition) return;
    transitionGoalLedger(setPreferences, goalId, transition.nextState, transition.trigger);
    // "Recover" used to be a no-op ledger-state flip with nothing behind it
    // - give it a real destination: the hardship recovery flow, aware this
    // came from a specific at-risk goal.
    if (action === "recover") {
      setPreferences((current) => ({ ...current, hardshipEntryPoint: "guardianAtRisk" }));
      setActiveScreen(screens.NEED_EMERGENCY);
    }
  }

  const monthlySaving = formatSgd(getRecommendedMonthlySaving(simulatorInputs));
  const targetAmount = formatSgd(getGoalTargetAmount(simulatorInputs));
  const activeGoalText = reasoning.goals || goalName;
  const financialStrategyItems = [
    {
      id: "savings",
      labelKey: "guardian.strategy.savings",
      value: t("common.perMonth", { amount: monthlySaving }),
      detailKey: "guardian.strategy.savingsDetail",
      icon: Banknote,
    },
    {
      id: "investment",
      labelKey: "guardian.strategy.investment",
      value: formatSgd(numberValue(profile.investments, 15000)),
      detailKey: "guardian.strategy.investmentDetail",
      icon: LineChart,
    },
    {
      id: "insurance",
      labelKey: "guardian.strategy.insurance",
      value: profile.insuranceStatus || t("status.review"),
      detailKey: "guardian.strategy.insuranceDetail",
      icon: ShieldCheck,
    },
    {
      id: "debt",
      labelKey: "guardian.strategy.debt",
      value: formatSgd(numberValue(profile.existingLoans, 18000) + numberValue(profile.creditCardOutstanding, 2400)),
      detailKey: "guardian.strategy.debtDetail",
      icon: CreditCard,
    },
    {
      id: "emergency",
      labelKey: "guardian.strategy.emergency",
      value: t("common.protected"),
      detailKey: "guardian.strategy.emergencyDetail",
      icon: LockKeyhole,
    },
  ];
  // Monthly Guardian Report requirements (08_Guardian_Operating_Principles.md): every field below is
  // derived from data already tracked elsewhere (ledger states, decided actions, reputation) so the
  // report stays accountable instead of becoming encouraging copy.
  const recoveryGoalCount = ledgerGoalEntries.filter(
    (entry) => (preferences.goalLedger?.[entry.id]?.state ?? "draft") === "recovery"
  ).length;
  const atRiskGoalCount = ledgerGoalEntries.filter(
    (entry) => (preferences.goalLedger?.[entry.id]?.state ?? "draft") === "atRisk"
  ).length;
  const strategyChangeCount = ledgerGoalEntries.reduce(
    (total, entry) => total + (preferences.goalLedger?.[entry.id]?.history?.length ?? 0),
    0
  );
  const reportItems = [
    { labelKey: "guardian.report.goalsMonitored", value: String(ledgerGoalEntries.length) },
    { labelKey: "guardian.report.risksDetected", value: String(atRiskGoalCount) },
    {
      labelKey: "guardian.report.recommendationsDecided",
      value: t("guardian.report.recommendationsDecidedValue", {
        accepted: approvedActionCount + approvedServiceCount,
        skipped: skippedActionCount,
      }),
    },
    { labelKey: "guardian.report.recoveryPlansCreated", value: String(recoveryGoalCount) },
    { labelKey: "guardian.report.strategyChanges", value: String(strategyChangeCount) },
    { labelKey: "guardian.report.goalProgress", value: t("guardian.report.goalProgressValue", { goal: goalName }), long: true },
    { labelKey: "guardian.report.scoreChange", value: t("guardian.report.scoreChangeValue", { score: futureScore }), long: true },
    { labelKey: "guardian.report.reputationState", value: t(`guardian.reputation.band.${reputationBand}`) },
    { labelKey: "guardian.report.mistakes", value: t("guardian.report.mistakesValue"), long: true },
    { labelKey: "guardian.report.newInsights", value: reasoning.risk, long: true },
    { labelKey: "guardian.report.aiRecommendations", value: reasoning.action, long: true },
    { labelKey: "guardian.report.nextReview", value: t("guardian.memory.metrics.tomorrow") },
  ];
  const approvedHistoryItems = visibleActionCards
    .filter(({ id }) => simulatorActionStates[id] === "approved")
    .map(({ id, titleKey }) => ({
      id,
      date: t("guardian.history.today"),
      title: t(titleKey),
      detail: t("guardian.history.actionApprovedDetail"),
      status: t("status.active"),
    }));
  // Guardian accountability requires history to cover every decision, not only approved ones - a
  // skipped recommendation is customer data (07_Relationship_And_Shared_Responsibility.md "When Users
  // Reject Recommendations"), so it must stay reviewable rather than silently disappearing.
  const skippedHistoryItems = visibleActionCards
    .filter(({ id }) => simulatorActionStates[id] === "skipped")
    .map(({ id, titleKey }) => ({
      id,
      date: t("guardian.history.today"),
      title: t(titleKey),
      detail: t("guardian.history.actionSkippedDetail"),
      status: t("status.skipped"),
    }));
  const historyItems = [
    {
      id: "recommendation",
      date: t("guardian.history.today"),
      title: t("guardian.history.recommendationPrepared"),
      detail: t("guardian.history.recommendationDetail", { goal: goalName }),
      status: t("status.completed"),
    },
    {
      id: "future-score",
      date: t("guardian.history.lastReview"),
      title: t("guardian.history.scoreUpdated"),
      detail: t("guardian.history.scoreDetail", { score: futureScore }),
      status: t("status.monitoring"),
    },
    ...approvedHistoryItems,
    ...skippedHistoryItems,
  ];

  // Three-Rejection Rule (07_Relationship_And_Shared_Responsibility.md "When Users Reject
  // Recommendations"): rejections must persist across simulation resets so a genuine third rejection
  // is detectable, instead of resetting to zero the moment simulatorActionStates is cleared.
  function setGuardianActionState(actionId, state) {
    setGuardianApplied(false);
    setLastApprovedServiceId(null);
    if (state === "skipped" && simulatorActionStates[actionId] !== "skipped") {
      setPreferences((current) => ({
        ...current,
        rejectionCounts: {
          ...current.rejectionCounts,
          [actionId]: (current.rejectionCounts?.[actionId] ?? 0) + 1,
        },
      }));
    }
    setSimulatorActionStates((current) => ({ ...current, [actionId]: state }));
  }

  function dismissActionPermanently(actionId) {
    setPreferences((current) => ({
      ...current,
      dismissedActions: current.dismissedActions?.includes(actionId)
        ? current.dismissedActions
        : [...(current.dismissedActions ?? []), actionId],
    }));
  }

  function approveServiceAction(actionId) {
    setGuardianApplied(false);
    setLastApprovedServiceId(actionId);
    setSimulatorActionStates((current) => ({ ...current, [actionId]: "approved" }));
  }

  const guardianStateInfoModal = guardianStateInfoOpen ? (
    <InfoModal
      icon={ShieldCheck}
      title={t("guardian.state.title")}
      tag={t(`guardian.state.label.${guardianState}`)}
      body={t(`guardian.state.reason.${guardianState}`)}
      onClose={() => setGuardianStateInfoOpen(false)}
      closeLabel={t("homeBanking.gotIt")}
    />
  ) : null;

  const confirmedFieldCount = confidenceTrackedFields.filter(
    (field) => String(profile?.[field] ?? "") !== String(defaultProfile[field])
  ).length;
  const confidenceInfoModal = confidenceInfoOpen ? (
    <InfoModal
      icon={Info}
      title={t("guardian.status.aiConfidence")}
      tag={t(`guardian.confidence.band.${confidenceBand}`)}
      body={t("guardian.confidence.body", {
        confirmed: confirmedFieldCount,
        total: confidenceTrackedFields.length,
      })}
      scoreLabel={t("homeBanking.currentScore")}
      scoreValue={`${aiConfidence}%`}
      methodLabel={t("homeBanking.howCalculated")}
      methodText={t("guardian.confidence.method")}
      onClose={() => setConfidenceInfoOpen(false)}
      closeLabel={t("homeBanking.gotIt")}
    />
  ) : null;

  const protectedScoreModal = protectedScoreInfoOpen ? (
    <InfoModal
      icon={Info}
      title={t("guardian.protectedScore")}
      scoreLabel={t("homeBanking.currentScore")}
      scoreValue={`${futureScore}/100`}
      listTitle={t("lifeGraph.scoreInfo.title")}
      listItems={[
        t("guardian.protectedScoreInfo.meaning"),
        t("guardian.protectedScoreInfo.method"),
        t("guardian.protectedScoreInfo.data"),
        t("guardian.protectedScoreInfo.improve"),
      ]}
      onClose={() => setProtectedScoreInfoOpen(false)}
      closeLabel={t("homeBanking.gotIt")}
    />
  ) : null;

  const memoryDetailModal = selectedMemoryEvent ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={selectedMemoryEvent.title ?? t(selectedMemoryEvent.titleKey)}>
          <motion.div className="confirmModal memoryDetailModal" {...screenMotion}>
            <CalendarClock size={24} />
            <strong>{selectedMemoryEvent.title ?? t(selectedMemoryEvent.titleKey)}</strong>
            <div className="memoryModalMeta">
              <span>{selectedMemoryEvent.year}</span>
              <b>{t(selectedMemoryEvent.statusKey)}</b>
            </div>
            <SummaryRow
              label={t("guardian.memory.modal.guardianAction")}
              value={selectedMemoryEvent.action ?? t(selectedMemoryEvent.actionKey)}
            />
            <SummaryRow
              label={t("guardian.memory.modal.reason")}
              value={selectedMemoryEvent.reason ?? t(selectedMemoryEvent.reasonKey, { customer: displayName })}
            />
            <SummaryRow
              label={t("guardian.memory.modal.dataUsed")}
              value={selectedMemoryEvent.dataUsed ?? t(selectedMemoryEvent.dataKey)}
            />
            <SummaryRow
              label={t("guardian.memory.modal.product")}
              value={selectedMemoryEvent.product ?? t(selectedMemoryEvent.productKey)}
            />
            <SummaryRow
              label={t("guardian.memory.modal.futureScoreImpact")}
              value={selectedMemoryEvent.impact ?? t(selectedMemoryEvent.impactKey)}
            />
            <section className="memoryWhyCard">
              <strong>{t("guardian.memory.modal.whyTitle")}</strong>
              <p>{t("guardian.memory.modal.whyText")}</p>
            </section>
            <button type="button" className="primaryButton" onClick={() => setSelectedMemoryEvent(null)}>
              {t("guardian.memory.modal.close")}
              <Check size={18} />
            </button>
          </motion.div>
        </section>
      ) : null;

  const selectedContractGoalEntry = selectedContractGoalId
    ? ledgerGoalEntries.find((entry) => entry.id === selectedContractGoalId)
    : null;
  const contractModal = selectedContractGoalEntry ? (
    (() => {
      const contractState = preferences.goalLedger?.[selectedContractGoalEntry.id]?.state ?? "draft";
      const contract = getSharedGoalContract({
        goalEntry: selectedContractGoalEntry,
        state: contractState,
        preferences,
        level,
        selectedLevel,
        t,
      });
      return (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("guardian.contract.title")}>
          <motion.div className="confirmModal" {...screenMotion}>
            <FileText size={24} />
            <strong>{t("guardian.contract.title")}</strong>
            <span className="prototypeTag">{selectedContractGoalEntry.label}</span>
            <div className="proofBlock">
              <strong>{t("guardian.contract.fields.goalStatement")}</strong>
              <p>{contract.goalStatement}</p>
            </div>
            <SummaryRow label={t("guardian.contract.fields.priorityLevel")} value={contract.priorityLevel} />
            <div className="proofBlock">
              <strong>{t("guardian.contract.fields.protectedBoundaries")}</strong>
              <p>{contract.protectedBoundaries}</p>
            </div>
            <div className="proofBlock">
              <strong>{t("guardian.contract.fields.guardianRole")}</strong>
              <p>{contract.guardianRole}</p>
            </div>
            <div className="proofBlock">
              <strong>{t("guardian.contract.fields.customerRole")}</strong>
              <p>{contract.customerRole}</p>
            </div>
            <SummaryRow label={t("guardian.contract.fields.autonomyLevel")} value={contract.autonomyLevel} />
            <SummaryRow label={t("guardian.contract.fields.reviewRhythm")} value={contract.reviewRhythm} />
            <div className="proofBlock">
              <strong>{t("guardian.contract.fields.escalationPath")}</strong>
              <p>{contract.escalationPath}</p>
            </div>
            <div className="proofBlock">
              <strong>{t("guardian.contract.fields.exitCondition")}</strong>
              <p>{contract.exitCondition}</p>
            </div>
            <button type="button" className="primaryButton" onClick={() => setSelectedContractGoalId(null)}>
              {t("guardian.contract.close")}
              <Check size={18} />
            </button>
          </motion.div>
        </section>
      );
    })()
  ) : null;

  function renderFeatureDetail() {
    if (selectedFeatureId === "recommendation") {
      return (
        <section className="guardianCard futureGuardian">
          <div className="guardianAgentHead">
            <div className="guardianOrb">
              <ShieldCheck size={34} />
            </div>
            <div>
              <strong>{t("guardian.today.dynamicRecommendation")}</strong>
              <small>{t("simulator.levelLabel", { level })} - {t(selectedLevel.titleKey)}</small>
            </div>
          </div>
          <div className="guardianCopy">
            <p>{reasoning.recommendation}</p>
            <p><b>{t("guardian.today.reason")}</b> {reasoning.risk}</p>
            <p><b>{t("guardian.today.expectedImpact")}</b> {t("guardian.today.expectedImpactValue", { score: futureScore, goal: goalName })}</p>
          </div>
        </section>
      );
    }

    if (selectedFeatureId === "actionCentre") {
      return (
        <section className="actionPlanPanel">
          <div className="guardianActionSummary">
            <span>{t("guardian.actionCentre.approve")}</span>
            <span>{t("guardian.actionCentre.modify")}</span>
            <span>{t("guardian.actionCentre.reject")}</span>
          </div>
          {level === 5 ? (
            <section className="autonomousLockPanel guardianGoalLock">
              <div>
                <strong>{t("simulator.autonomousLock.title")}</strong>
                <span>{t("guardian.actionCentre.goalLockDetail")}</span>
              </div>
              <SummaryRow label={t("simulator.autonomousLock.goal")} value={goalName} />
              <SummaryRow label={t("simulator.autonomousLock.target")} value={targetAmount} />
              <SummaryRow label={t("simulator.autonomousLock.monthlyLocked")} value={t("common.perMonth", { amount: monthlySaving })} />
              <SummaryRow label={t("simulator.autonomousLock.completion")} value={getGoalTargetDisplay(simulatorInputs)} />
            </section>
          ) : null}
          <section className="ocbcExecutePanel">
            <div className="panelHead">
              <div>
                <span className="sectionLabel">{t("guardian.services.title")}</span>
                <p>{t("guardian.services.subtitle")}</p>
              </div>
              <ShieldCheck size={18} />
            </div>
            <SuccessBanner
              show={Boolean(lastApprovedServiceId)}
              text={
                lastApprovedServiceId
                  ? t("guardian.services.success", {
                      action: t(`guardian.services.actions.${lastApprovedServiceId}.title`),
                    })
                  : ""
              }
            />
            <div className="serviceActionList">
              {ocbcServiceActions.map(({ id, icon: Icon, approvedStatusKey }) => {
                const state = simulatorActionStates[id] ?? "pending";
                const approved = state === "approved";
                return (
                  <article className={approved ? "serviceActionCard approved" : "serviceActionCard"} key={id}>
                    <div className="serviceActionHead">
                      <span className="iconBubble">
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong>{t(`guardian.services.actions.${id}.title`)}</strong>
                        <small>{t(`guardian.services.actions.${id}.goal`)}</small>
                      </div>
                      <b className={approved ? "actionStatePill approved" : "actionStatePill"}>
                        {approved ? t(approvedStatusKey) : t("simulator.actionStatus.pending")}
                      </b>
                    </div>
                    <div className="serviceActionDetails">
                      <SummaryRow label={t("guardian.services.what")} value={t(`guardian.services.actions.${id}.what`)} />
                      <SummaryRow label={t("guardian.services.why")} value={t(`guardian.services.actions.${id}.why`, { goal: goalName })} />
                      <SummaryRow label={t("guardian.services.requiredApproval")} value={t("guardian.services.customerApproval")} />
                    </div>
                    <button
                      type="button"
                      className={approved ? "miniButton serviceApprovedButton" : "miniButton"}
                      onClick={() => approveServiceAction(id)}
                    >
                      {approved ? t("guardian.services.approvedCta") : t("guardian.services.approveCta")}
                      <Check size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="aiPreparedActions">
            <div className="panelHead">
              <div>
                <span className="sectionLabel">{t("guardian.actionCentre.preparedTitle")}</span>
                <p>{t("guardian.actionCentre.preparedSubtitle")}</p>
              </div>
              <ClipboardCheck size={18} />
            </div>
          </section>
          {visibleActionCards
            .filter(({ id }) => !preferences.dismissedActions?.includes(id))
            .map(({ id, titleKey, icon: Icon }) => {
            const state = simulatorActionStates[id] ?? "pending";
            const detail = getSimulatorActionDetail(id, simulatorInputs, level, t);
            const rejectionCount = preferences.rejectionCounts?.[id] ?? 0;
            const underReview = state === "skipped" && rejectionCount >= 3;
            return (
              <article className={`actionCard ${state}`} key={id}>
                <div className="actionCardHeader">
                  <span className="iconBubble">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{t(titleKey)}</strong>
                    <small className={`actionStatePill ${state}`}>
                      {state === "approved" ? t("status.active") : t(`simulator.actionStatus.${state}`)}
                    </small>
                  </div>
                </div>
                <section className={`actionOutcome ${state}`}>
                  <strong>{t(`simulator.actionReceipt.state.${state}.title`)}</strong>
                  <p>{t(`simulator.actionReceipt.state.${state}.detail`)}</p>
                  <div className="receiptGrid">
                    <span>
                      <small>{t("simulator.actionReceipt.labels.prepared")}</small>
                      <b>{detail.prepared}</b>
                    </span>
                    <span>
                      <small>{t("simulator.actionReceipt.labels.safety")}</small>
                      <b>{detail.safety}</b>
                    </span>
                    <span>
                      <small>{t("simulator.actionReceipt.labels.next")}</small>
                      <b>{detail.next}</b>
                    </span>
                  </div>
                </section>
                {underReview ? (
                  <section className="rejectionReviewPanel">
                    <AlertTriangle size={16} />
                    <p>{t("guardian.actionCentre.rejectionReview.message", { count: rejectionCount })}</p>
                    <div className="buttonPair compactButtons">
                      <button type="button" className="secondaryButton" onClick={() => setActiveScreen(screens.PROFILE)}>
                        {t("guardian.actionCentre.rejectionReview.adjustPriorities")}
                      </button>
                      <button type="button" className="primaryButton" onClick={() => dismissActionPermanently(id)}>
                        {t("guardian.actionCentre.rejectionReview.stopSuggesting")}
                      </button>
                    </div>
                  </section>
                ) : (
                  <div className="actionButtons">
                    <button type="button" className={state === "approved" ? "selected" : ""} onClick={() => setGuardianActionState(id, "approved")}>
                      {t("simulator.actionButtons.approve")}
                    </button>
                    <button type="button" className={state === "editing" ? "selected" : ""} onClick={() => setGuardianActionState(id, "editing")}>
                      {t("guardian.actionCentre.modify")}
                    </button>
                    <button type="button" className={state === "skipped" ? "selected" : ""} onClick={() => setGuardianActionState(id, "skipped")}>
                      {t("guardian.actionCentre.reject")}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
          <SuccessBanner show={guardianApplied} text={t("simulator.output.success")} />
          <button type="button" className="primaryButton" onClick={() => setGuardianApplied(true)}>
            {approvedActionCount > 0
              ? t("simulator.output.applyApproved", { count: approvedActionCount })
              : t("simulator.output.apply")}
            <CheckCircle2 size={18} />
          </button>
        </section>
      );
    }

    if (selectedFeatureId === "monitoring") {
      return (
        <section className="recommendationPanel">
          <div className="monitoringGrid">
            <article>
              <small>{t("guardian.monitoring.goals")}</small>
              <strong>{activeGoalText}</strong>
            </article>
            <article>
              <small>{t("guardian.monitoring.risks")}</small>
              <strong>{reasoning.risk}</strong>
            </article>
            <article>
              <small>{t("guardian.monitoring.protection")}</small>
              <strong>{t("common.protected")}</strong>
            </article>
          </div>
          <div className="guardianGoalSignals">
            {monitoredGoalSignals.map(({ id, label, value, icon: Icon, color }) => (
              <span key={id}>
                <Icon size={14} style={{ color }} />
                {label}
                <b>{value}</b>
              </span>
            ))}
          </div>
        </section>
      );
    }

    if (selectedFeatureId === "financialStrategy") {
      return (
        <section className="financialStrategyPanel">
          <div className="strategyList">
            {financialStrategyItems.map(({ id, labelKey, value, detailKey, icon: Icon }) => (
              <article className="strategyItem" key={id}>
                <span className="iconBubble">
                  <Icon size={16} />
                </span>
                <div>
                  <strong>{t(labelKey)}</strong>
                  <small>{t(detailKey, { goal: goalName, monthly: monthlySaving, target: targetAmount })}</small>
                </div>
                <b>{value}</b>
              </article>
            ))}
          </div>
          <div className="productStrip" aria-label={t("guardian.strategy.relatedProducts")}>
            <span>{t("guardian.strategy.relatedProducts")}</span>
            {productEcosystem.map(({ productKey, icon: Icon }) => (
              <b key={productKey}>
                <Icon size={13} />
                {t(productKey)}
              </b>
            ))}
          </div>
        </section>
      );
    }

    if (selectedFeatureId === "aiReasoning") {
      return (
        <section className="recommendationPanel">
          <div className="proofBlock">
            <strong>{t("guardian.reasoning.situationAnalysed")}</strong>
            <p>{reasoning.situation}</p>
          </div>
          <div className="proofBlock">
            <strong>{t("guardian.reasoning.risksDetected")}</strong>
            <p>{reasoning.risk}</p>
          </div>
          <div className="proofBlock">
            <strong>{t("guardian.reasoning.tradeoffsConsidered")}</strong>
            <p>{t("guardian.reasoning.tradeoffsValue", { goals: activeGoalText })}</p>
          </div>
          <div className="proofBlock">
            <strong>{t("guardian.reasoning.selectedStrategy")}</strong>
            <p>{reasoning.recommendation}</p>
          </div>
          <SummaryRow label={t("guardian.reasoning.recommendedSavings")} value={t("common.perMonth", { amount: monthlySaving })} />
          <SummaryRow label={t("guardian.reasoning.targetForGoal", { goal: goalName })} value={targetAmount} />
          <SummaryRow
            label={t("guardian.reasoning.emergencyFundStatus")}
            value={healthScores.find((score) => score.id === "emergency")?.value >= 60
              ? t("common.protected")
              : t("status.review")}
          />
        </section>
      );
    }

    if (selectedFeatureId === "memory") {
      return (
        <>
          <section className="guardianMemoryPanel">
            <div className="panelHead">
              <div>
                <span className="sectionLabel">{t("guardian.memory.title")}</span>
                <p>{t("guardian.memory.subtitle")}</p>
              </div>
              <CalendarClock size={18} />
            </div>
            <div className="memoryTimeline">
              {memoryEvents.map((event) => (
                <button
                  type="button"
                  className="memoryEventCard"
                  key={event.id}
                  onClick={() => setSelectedMemoryEvent(event)}
                  aria-label={t("guardian.memory.openEvent", { event: event.title ?? t(event.titleKey) })}
                >
                  <span className="memoryYear">{event.year}</span>
                  <i aria-hidden="true" />
                  <div>
                    <strong>{event.title ?? t(event.titleKey)}</strong>
                    <small>{event.description ?? t(event.descriptionKey)}</small>
                    <span className="memoryImpact">
                      {t("guardian.memory.impact")}: {event.impact ?? t(event.impactKey)}
                    </span>
                    <span className="memoryProduct">
                      {t("guardian.memory.productUsed")}: {event.product ?? t(event.productKey)}
                    </span>
                  </div>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </section>
          <section className="recommendationPanel">
            <span className="sectionLabel">{t("guardian.sections.history")}</span>
            <div className="historyTimeline">
              {historyItems.map((item) => (
                <article key={item.id}>
                  <span>{item.date}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <b>{item.status}</b>
                </article>
              ))}
            </div>
          </section>
        </>
      );
    }

    if (selectedFeatureId === "monthlyReview") {
      return (
        <section className="recommendationPanel">
          {reportItems.map((item) =>
            item.long ? (
              <div className="proofBlock" key={item.labelKey}>
                <strong>{t(item.labelKey)}</strong>
                <p>{item.value}</p>
              </div>
            ) : (
              <SummaryRow key={item.labelKey} label={t(item.labelKey)} value={item.value} />
            )
          )}
        </section>
      );
    }

    if (selectedFeatureId === "reputation") {
      const componentRows = [
        { id: "consentRespect", weight: 30, value: reputation.consentRespect, icon: LockKeyhole },
        { id: "goalProtectionRate", weight: 25, value: reputation.goalProtectionRate, icon: Target },
        { id: "recoverySuccess", weight: 20, value: reputation.recoverySuccess, icon: RotateCcw },
        { id: "recommendationOutcomeAccuracy", weight: 15, value: reputation.recommendationOutcomeAccuracy, icon: Bot },
        { id: "humanEscalationQuality", weight: 10, value: reputation.humanEscalationQuality, icon: UserRound },
      ];
      return (
        <>
          <section className="recommendationPanel">
            <div className="panelHead">
              <span className="sectionLabel">{t("guardian.reputation.scoreLabel")}</span>
              <Award size={17} />
            </div>
            <div className="proofScore">
              <span>{t("guardian.reputation.scoreLabel")}</span>
              <b>{reputation.score}/100</b>
            </div>
            <div className="productStateRow">
              <b className={`statePill state-${reputationBand}`}>{t(`guardian.reputation.band.${reputationBand}`)}</b>
            </div>
            <p>{t(`guardian.reputation.bandDetail.${reputationBand}`)}</p>
          </section>
          <section className="financialStrategyPanel">
            <span className="sectionLabel">{t("guardian.reputation.componentsTitle")}</span>
            <div className="strategyList">
              {componentRows.map((row) => {
                const RowIcon = row.icon;
                return (
                  <article className="strategyItem" key={row.id}>
                    <span className="iconBubble">
                      <RowIcon size={16} />
                    </span>
                    <div>
                      <strong>{t(`guardian.reputation.components.${row.id}`, { weight: row.weight })}</strong>
                    </div>
                    <b>{row.value}/100</b>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="trustNote compactTrustNote">
            <ShieldCheck size={17} />
            <p>{t("guardian.reputation.noViolations")}</p>
          </section>
          <section className="supportPanel">
            <span className="sectionLabel">{t("guardian.reputation.formulaTitle")}</span>
            <p>{t("guardian.reputation.formulaNote")}</p>
          </section>
        </>
      );
    }

    if (selectedFeatureId === "goalLedger") {
      return (
        <section className="recommendationPanel">
          <p>{t("guardian.goalLedger.intro")}</p>
          <div className="strategyList">
            {ledgerGoalEntries.map((goalEntry) => {
              const stored = preferences.goalLedger?.[goalEntry.id];
              const state = stored?.state ?? "draft";
              const history = stored?.history ?? [];
              const actions = goalLedgerActionsByState[state] ?? [];
              return (
                <article className="productFitCard ledgerCard" key={goalEntry.id}>
                  <div className="productFitHead">
                    <div>
                      <strong>{goalEntry.label}</strong>
                    </div>
                  </div>
                  <div className="productStateRow">
                    <b className={`statePill ledgerState-${state}`}>{t(`guardian.goalLedger.state.${state}`)}</b>
                  </div>
                  <p>{t(`guardian.goalLedger.obligation.${state}`)}</p>
                  <div className="buttonPair compactButtons">
                    <button
                      type="button"
                      className="secondaryButton"
                      onClick={() => setSelectedContractGoalId(goalEntry.id)}
                    >
                      {t("guardian.contract.viewCta")}
                    </button>
                  </div>
                  {actions.length ? (
                    <div className="buttonPair compactButtons">
                      {actions.map(({ action }, index) => (
                        <button
                          key={action}
                          type="button"
                          className={index === 0 ? "primaryButton" : "secondaryButton"}
                          onClick={() => handleLedgerAction(goalEntry.id, action)}
                        >
                          {t(`guardian.goalLedger.actions.${action}`)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {history.length ? (
                    <div className="historyTimeline">
                      {history.slice(0, 2).map((event, index) => (
                        <article key={index}>
                          <span>{new Date(event.at).toLocaleDateString()}</span>
                          <div>
                            <strong>
                              {t(`guardian.goalLedger.state.${event.previousState}`)} {"->"}{" "}
                              {t(`guardian.goalLedger.state.${event.nextState}`)}
                            </strong>
                            <small>{t(`guardian.goalLedger.trigger.${event.trigger}`)}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      );
    }

    if (selectedFeatureId === "settings") {
      return (
        <section className="recommendationPanel">
          <SummaryRow label={t("simulator.inputs.aiIndependence")} value={`${t("simulator.levelLabel", { level })} - ${t(selectedLevel.titleKey)}`} />
          <SummaryRow label={t("settings.guardian.savingsTransfer")} value={t(`settings.guardian.savings.${preferences.savingsTransfer}`)} />
          <SummaryRow label={t("settings.guardian.investmentRebalancing")} value={t(`settings.guardian.investment.${preferences.investmentRebalancing}`)} />
          <SummaryRow label={t("settings.guardian.reviewFrequency")} value={t(`settings.guardian.review.${preferences.guardianReviewFrequency}`)} />
          <SummaryRow label={t("settings.guardian.personalityTitle")} value={t(`settings.guardian.personality.${preferences.guardianPersonality}`)} />
          <button type="button" className="secondaryButton" onClick={() => setActiveScreen(screens.PROFILE)}>
            {t("guardian.hub.openSettings")}
            <Settings size={18} />
          </button>
        </section>
      );
    }

    return null;
  }

  const selectedFeature = guardianHubCards.find((card) => card.id === selectedFeatureId);

  if (selectedFeature) {
    return (
      <Screen>
        <Header title={t(selectedFeature.titleKey)} subtitle={t(selectedFeature.subtitleKey)} />
        <button type="button" className="backHomeButton guardianBackButton" onClick={() => setSelectedFeatureId(null)}>
          <ChevronRight size={16} />
          {t("guardian.hub.back")}
        </button>
        <motion.section className="guardianDetailPage" {...screenMotion}>
          {renderFeatureDetail()}
        </motion.section>
        {protectedScoreModal}
        {memoryDetailModal}
        {contractModal}
        {guardianStateInfoModal}
        {confidenceInfoModal}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t("guardian.title")} subtitle={t("guardian.hub.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

      {hardshipTriggered ? (
        <motion.button
          type="button"
          className="futureAlertCard risk"
          onClick={() => {
            setPreferences((current) => ({ ...current, hardshipEntryPoint: "guardianAtRisk" }));
            setActiveScreen(screens.NEED_EMERGENCY);
          }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: "easeOut" }}
        >
          <span className="futureAlertIcon">
            <AlertTriangle size={18} />
          </span>
          <span>
            <small>{t("guardian.hardshipAlert.label")}</small>
            <strong>{t("guardian.hardshipAlert.title")}</strong>
            <em>{t("guardian.hardshipAlert.detail")}</em>
          </span>
          <ChevronRight size={17} />
        </motion.button>
      ) : null}

      <section className="guardianHubStatus">
        <div className="panelHead">
          <span className="sectionLabel">{t("guardian.sections.status")}</span>
          <ShieldCheck size={17} />
        </div>
        <div className="productStateRow">
          <b className={`statePill ledgerState-${guardianState}`}>{t(`guardian.state.label.${guardianState}`)}</b>
          <button
            type="button"
            className="infoButton tinyInfoButton"
            onClick={() => setGuardianStateInfoOpen(true)}
            aria-label={t("homeBanking.infoLabel", { item: t("guardian.state.title") })}
          >
            <Info size={11} />
          </button>
        </div>
        <div className="guardianHubStats">
          <article>
            <small>{t("guardian.status.activeGoals")}</small>
            <strong>{activeGoalCount}</strong>
          </article>
          <article>
            <small>{t("guardian.memory.metrics.memoryEvents")}</small>
            <strong>{memoryEvents.length}</strong>
          </article>
          <article>
            <small className="scoreLabelWithInfo">
              {t("guardian.status.futureScore")}
              <button
                type="button"
                className="infoButton tinyInfoButton"
                onClick={() => setProtectedScoreInfoOpen(true)}
                aria-label={t("homeBanking.infoLabel", { item: t("guardian.protectedScore") })}
              >
                <Info size={11} />
              </button>
            </small>
            <strong>{futureScore}/100</strong>
          </article>
          <article>
            <small className="scoreLabelWithInfo">
              {t("guardian.status.aiConfidence")}
              <button
                type="button"
                className="infoButton tinyInfoButton"
                onClick={() => setConfidenceInfoOpen(true)}
                aria-label={t("homeBanking.infoLabel", { item: t("guardian.status.aiConfidence") })}
              >
                <Info size={11} />
              </button>
            </small>
            <strong>{t(`guardian.confidence.band.${confidenceBand}`)}</strong>
          </article>
          <article>
            <small>{t("guardian.status.nextReview")}</small>
            <strong>{t("guardian.memory.metrics.tomorrow")}</strong>
          </article>
          <article>
            <small>{t("guardian.status.autonomousLevel")}</small>
            <strong>{t("simulator.levelLabel", { level })}</strong>
          </article>
        </div>
      </section>

      <section className="guardianFeatureGrid" aria-label={t("guardian.hub.gridLabel")}>
        {guardianHubCards.map(({ id, titleKey, subtitleKey, icon: Icon }) => (
          <motion.button
            type="button"
            className="guardianFeatureCard"
            key={id}
            onClick={() => setSelectedFeatureId(id)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <span className="iconBubble">
              <Icon size={17} />
            </span>
            <strong>{t(titleKey)}</strong>
            <small>{t(subtitleKey)}</small>
            <ChevronRight size={15} />
          </motion.button>
        ))}
      </section>
      {protectedScoreModal}
      {guardianStateInfoModal}
      {confidenceInfoModal}
    </Screen>
  );
}

function NeedDetailScreen({
  type,
  setActiveScreen,
  successStates,
  setSuccessStates,
  preferences,
  setPreferences,
  simulatorInputs,
  setSimulatorInputs,
  setMemoryEvents,
  language,
  t,
  setLoanPlannerInitialPurpose,
}) {
  const success = Boolean(successStates[type]);
  const setSuccess = () => setSuccessStates((current) => ({ ...current, [type]: true }));
  const profile = getUserProfile(preferences);
  const healthScores = getHealthScores(profile);

  const content = {
    wedding: (
      <WeddingNeedContent
        success={success}
        setSuccess={setSuccess}
        t={t}
        setActiveScreen={setActiveScreen}
        language={language}
        setSimulatorInputs={setSimulatorInputs}
        setMemoryEvents={setMemoryEvents}
        profile={profile}
      />
    ),
    home: (
      <HomeNeedContent
        success={success}
        setSuccess={setSuccess}
        t={t}
        setActiveScreen={setActiveScreen}
        language={language}
        setSimulatorInputs={setSimulatorInputs}
        setMemoryEvents={setMemoryEvents}
        profile={profile}
        setLoanPlannerInitialPurpose={setLoanPlannerInitialPurpose}
      />
    ),
    retirement: (
      <RetirementNeedContent
        success={success}
        setSuccess={setSuccess}
        t={t}
        setActiveScreen={setActiveScreen}
        language={language}
        setSimulatorInputs={setSimulatorInputs}
        setMemoryEvents={setMemoryEvents}
        profile={profile}
        simulatorInputs={simulatorInputs}
      />
    ),
    emergency: (
      <EmergencyNeedContent
        success={success}
        setSuccess={setSuccess}
        t={t}
        setActiveScreen={setActiveScreen}
        language={language}
        preferences={preferences}
        setPreferences={setPreferences}
        profile={profile}
        healthScores={healthScores}
        setMemoryEvents={setMemoryEvents}
      />
    ),
    insurance: (
      <InsuranceNeedContent
        success={success}
        setSuccess={setSuccess}
        t={t}
        setActiveScreen={setActiveScreen}
        profile={profile}
        healthScores={healthScores}
      />
    ),
  }[type];

  return content;
}

const WEDDING_ACTIVITY_CATALOG = [
  { id: "solemnization", labelKey: "weddingPlanner.activities.solemnization", icon: HeartHandshake },
  { id: "teaCeremony", labelKey: "weddingPlanner.activities.teaCeremony", icon: Coffee },
  { id: "gateCrash", labelKey: "weddingPlanner.activities.gateCrash", icon: PartyPopper },
  { id: "cocktailHour", labelKey: "weddingPlanner.activities.cocktailHour", icon: Wine },
  { id: "speeches", labelKey: "weddingPlanner.activities.speeches", icon: Mic },
  { id: "firstDance", labelKey: "weddingPlanner.activities.firstDance", icon: Music },
  { id: "photobooth", labelKey: "weddingPlanner.activities.photobooth", icon: Camera },
  { id: "liveBand", labelKey: "weddingPlanner.activities.liveBand", icon: Music },
  { id: "afterParty", labelKey: "weddingPlanner.activities.afterParty", icon: PartyPopper },
];

function weddingCategoryIcon(category = "") {
  const key = category.toLowerCase();
  if (key.includes("venue") || key.includes("catering") || key.includes("dining")) return Utensils;
  if (key.includes("photo")) return Camera;
  if (key.includes("attire") || key.includes("dress") || key.includes("suit") || key.includes("gown")) return Shirt;
  if (key.includes("entertain") || key.includes("music") || key.includes("band") || key.includes("dj") || key.includes("mc")) return Music;
  if (key.includes("decor") || key.includes("floral") || key.includes("styling")) return Sparkles;
  if (key.includes("stationery") || key.includes("invit")) return FileText;
  if (key.includes("activit")) return PartyPopper;
  return CircleDollarSign;
}

function WeddingLineItemRow({ item }) {
  const Icon = weddingCategoryIcon(item.category);
  return (
    <div className="weddingLineItem">
      <span className="weddingLineIcon">
        <Icon size={15} />
      </span>
      <span>{item.label}</span>
      <strong>{formatSgd(Math.round(item.subtotal))}</strong>
    </div>
  );
}

// The venue line item recomputes via the real table-based formula (never
// linear scaling — see lib/wedding-finance.js). Every other line item whose
// quantity equals the plan's guest_count is treated as guest-scaled (e.g.
// per-pax catering); flat fees (photography, attire, most long-tail items)
// stay fixed when the guest count slider moves.
function recomputeForGuestCount(lineItems, plan, originalGuestCount, newGuestCount) {
  const venueRecomputed = recomputeVenueForGuestCount(
    lineItems,
    { venueTier: plan.venue_tier, venueType: plan.venue_type },
    newGuestCount
  );
  const adjustedItems = venueRecomputed.map((item) => {
    if (item.category === "venue") return item;
    const scales = originalGuestCount > 0 && item.quantity === originalGuestCount;
    if (!scales) return item;
    const quantity = newGuestCount;
    const subtotal = Math.round(item.unit_rate * quantity);
    return { ...item, quantity, subtotal };
  });
  const total = adjustedItems.reduce((sum, item) => sum + item.subtotal, 0);
  return { adjustedItems, total };
}

function formatMinutesOffset(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins ? ` ${mins}m` : ""}`;
}

function formatMonthsOffset(months) {
  if (months <= 0) return "Now";
  if (months < 12) return `M${months}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? `Y${years}M${rem}` : `Y${years}`;
}

function TimelineTable({ timeline, t, offsetKey = "start_offset_minutes", formatOffset = formatMinutesOffset, labelKey = "weddingPlanner.timelineLabel" }) {
  if (!timeline?.length) return null;
  return (
    <section className="supportPanel weddingTimeline">
      <span className="sectionLabel">{t(labelKey)}</span>
      <div className="weddingTimelineTrack">
        {timeline.map((item) => (
          <div className="weddingTimelineItem" key={item.activity_id}>
            <b>{formatOffset(item[offsetKey])}</b>
            <strong>{item.label}</strong>
            {item.notes ? <small>{item.notes}</small> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanEditorPanel({
  plan,
  guestCount,
  onGuestCountChange,
  activitySelections,
  onToggleActivity,
  customActivityText,
  onCustomActivityChange,
  onSubmitActivities,
  onFinalize,
  submitting,
  onBack,
  backLabelKey = "weddingPlanner.backToComparison",
  t,
}) {
  const { adjustedItems, total } = recomputeForGuestCount(plan.line_items, plan, plan.guest_count, guestCount);

  return (
    <section className="recommendationPanel">
      <div className="scenarioHead">
        <span>{plan.name}</span>
        <button type="button" className="secondaryButton" onClick={onBack}>
          {t(backLabelKey)}
        </button>
      </div>

      <div className="needHeroCard">
        <span className="sectionLabel">{t("weddingPlanner.guestCountLabel")}</span>
        <strong>{guestCount}</strong>
        <input
          className="wideSlider"
          type="range"
          min="20"
          max="500"
          step="5"
          value={guestCount}
          onChange={(event) => onGuestCountChange(Number(event.target.value))}
          aria-label={t("weddingPlanner.guestCountLabel")}
        />
      </div>

      <div className="weddingLineItems">
        {adjustedItems.map((item) => (
          <WeddingLineItemRow item={item} key={item.label} />
        ))}
      </div>
      <div className="weddingTotalCost">
        <small>{t("weddingPlanner.updatedTotal")}</small>
        <strong>{formatSgd(Math.round(total))}</strong>
      </div>

      <div className="settingsGroup">
        <span className="sectionLabel">{t("weddingPlanner.activitiesLabel")}</span>
        <div className="checkboxGrid">
          {WEDDING_ACTIVITY_CATALOG.map(({ id, labelKey, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={activitySelections[id] ? "checkOption selected" : "checkOption"}
              onClick={() => onToggleActivity(id)}
            >
              <Icon size={15} />
              <span>{t(labelKey)}</span>
              {activitySelections[id] ? <Check size={14} /> : null}
            </button>
          ))}
        </div>
        <textarea
          className="aiTextInput"
          rows={2}
          value={customActivityText}
          onChange={(event) => onCustomActivityChange(event.target.value)}
          placeholder={t("weddingPlanner.customActivityPlaceholder")}
        />
        <button
          type="button"
          className="secondaryButton"
          onClick={onSubmitActivities}
          disabled={submitting}
        >
          {submitting ? t("weddingPlanner.thinking") : t("weddingPlanner.submitActivityChanges")}
        </button>
      </div>

      <TimelineTable timeline={plan.timeline} t={t} />

      <button type="button" className="primaryButton" onClick={() => onFinalize(guestCount, total)} disabled={submitting}>
        {submitting ? t("weddingPlanner.thinking") : t("weddingPlanner.finalizeThisPlan")}
        <Check size={18} />
      </button>
    </section>
  );
}

function AiTextInputCard({ t, onSubmit, submitting, placeholder, submitLabelKey = "weddingPlanner.send", labelKey = "weddingPlanner.inputLabel" }) {
  const [value, setValue] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!value.trim() || submitting) return;
    onSubmit(value.trim());
    setValue("");
  };

  return (
    <form className="needHeroCard aiTextInputCard" onSubmit={handleSubmit}>
      <span className="sectionLabel">{t(labelKey)}</span>
      <textarea
        className="aiTextInput"
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        disabled={submitting}
      />
      <button type="submit" className="primaryButton" disabled={submitting || !value.trim()}>
        {submitting ? t("weddingPlanner.thinking") : t(submitLabelKey)}
        <Send size={18} />
      </button>
    </form>
  );
}

const WEDDING_VENUE_TIER_LABEL_KEYS = {
  budget: "weddingPlanner.venueTiers.budget",
  mid_range: "weddingPlanner.venueTiers.midRange",
  premium: "weddingPlanner.venueTiers.premium",
  luxury: "weddingPlanner.venueTiers.luxury",
};

const WEDDING_VENUE_TYPE_LABEL_KEYS = {
  hotel: "weddingPlanner.venueTypes.hotel",
  restaurant: "weddingPlanner.venueTypes.restaurant",
  community: "weddingPlanner.venueTypes.community",
};

const WEDDING_PHOTOGRAPHY_TIER_LABEL_KEYS = {
  basic: "weddingPlanner.photographyTiers.basic",
  mid_range: "weddingPlanner.photographyTiers.midRange",
  premium: "weddingPlanner.photographyTiers.premium",
};

const WEDDING_ATTIRE_TIER_LABEL_KEYS = {
  budget: "weddingPlanner.attireTiers.budget",
  mid_range: "weddingPlanner.attireTiers.midRange",
  premium: "weddingPlanner.attireTiers.premium",
};

function WeddingPlanCards({ plans, researchNotes, onSelectPlan, t }) {
  const medianCost = [...plans].map((plan) => plan.total_cost).sort((a, b) => a - b)[Math.floor((plans.length - 1) / 2)];
  return (
    <section className="weddingPlanCarouselWrap">
      <span className="sectionLabel">{t("weddingPlanner.planComparisonLabel")}</span>
      <div className="weddingPlanCarousel">
        {plans.map((plan, index) => {
          const recommended = plan.total_cost === medianCost;
          return (
            <article className={`weddingPlanTile accent-${index % 3}${recommended ? " recommended" : ""}`} key={plan.id}>
              {recommended ? <span className="miniBadge">{t("status.recommended")}</span> : null}
              <h3>{plan.name}</h3>
              <p className="weddingPlanSummary">{plan.summary}</p>
              <div className="weddingTotalCost">
                <small>{t("weddingPlanner.totalCost")}</small>
                <strong>{formatSgd(Math.round(plan.total_cost))}</strong>
              </div>
              <div className="weddingStatChips">
                <span className="statChip">
                  {plan.guest_count} {t("weddingPlanner.guestCount")}
                </span>
                <span className="statChip">{t(WEDDING_VENUE_TYPE_LABEL_KEYS[plan.venue_type] ?? plan.venue_type)}</span>
                {plan.venue_type !== "community" ? (
                  <span className="statChip">{t(WEDDING_VENUE_TIER_LABEL_KEYS[plan.venue_tier] ?? plan.venue_tier)}</span>
                ) : null}
                <span className="statChip">{t(WEDDING_PHOTOGRAPHY_TIER_LABEL_KEYS[plan.photography_tier] ?? plan.photography_tier)}</span>
                <span className="statChip">{t(WEDDING_ATTIRE_TIER_LABEL_KEYS[plan.attire_tier] ?? plan.attire_tier)}</span>
              </div>
              <button type="button" className="primaryButton" onClick={() => onSelectPlan(plan.id)}>
                {t("weddingPlanner.customizePlan")}
              </button>
            </article>
          );
        })}
      </div>
      {plans.length > 1 ? <p className="weddingCarouselHint">{t("weddingPlanner.swipeHint")}</p> : null}
      {researchNotes ? (
        <section className="insightCard">
          <Bot size={20} />
          <p>{researchNotes}</p>
        </section>
      ) : null}
    </section>
  );
}

function adaptConfirmedBudgetToPlan(confirmedBudget, t) {
  return {
    id: confirmedBudget.plan_id,
    name: t("weddingPlanner.adjustSyntheticPlanName"),
    line_items: confirmedBudget.line_items,
    guest_count: confirmedBudget.guest_count,
    timeline: confirmedBudget.timeline,
    venue_tier: confirmedBudget.venue_tier,
    venue_type: confirmedBudget.venue_type,
    photography_tier: confirmedBudget.photography_tier,
    attire_tier: confirmedBudget.attire_tier,
  };
}

function WeddingConfirmedBudgetCard({ budget, t }) {
  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("weddingPlanner.confirmedLabel")}</span>
      <div className="weddingTotalCost">
        <small>{t("weddingPlanner.totalCost")}</small>
        <strong>{formatSgd(Math.round(budget.total_budget))}</strong>
      </div>
      <SummaryRow label={t("weddingPlanner.weddingDate")} value={budget.wedding_date} />
      <SummaryRow label={t("weddingPlanner.guestCount")} value={budget.guest_count} />
      <SummaryRow
        label={t("weddingPlanner.venueType")}
        value={t(WEDDING_VENUE_TYPE_LABEL_KEYS[budget.venue_type] ?? budget.venue_type)}
      />
      {budget.venue_type !== "community" ? (
        <SummaryRow
          label={t("weddingPlanner.venueTier")}
          value={t(WEDDING_VENUE_TIER_LABEL_KEYS[budget.venue_tier] ?? budget.venue_tier)}
        />
      ) : null}
      <SummaryRow
        label={t("weddingPlanner.photographyTier")}
        value={t(WEDDING_PHOTOGRAPHY_TIER_LABEL_KEYS[budget.photography_tier] ?? budget.photography_tier)}
      />
      <SummaryRow
        label={t("weddingPlanner.attireTier")}
        value={t(WEDDING_ATTIRE_TIER_LABEL_KEYS[budget.attire_tier] ?? budget.attire_tier)}
      />
      <div className="weddingLineItems">
        {budget.line_items.map((item) => (
          <WeddingLineItemRow item={item} key={item.label} />
        ))}
      </div>
      <section className="insightCard">
        <Bot size={20} />
        <p>{budget.confirmation_note}</p>
      </section>
      <TimelineTable timeline={budget.timeline} t={t} />
    </section>
  );
}

const SAVINGS_VEHICLE_LABEL_KEYS = {
  savings_account: "weddingPlanner.vehicles.savingsAccount",
  goal_based_deposit: "weddingPlanner.vehicles.goalBasedDeposit",
  robo_invest_conservative: "weddingPlanner.vehicles.roboInvest",
  existing_savings_drawdown: "weddingPlanner.vehicles.existingSavings",
  cpf_ordinary_account: "homePlanner.vehicles.cpfOrdinaryAccount",
  srs_account: "retirementPlanner.vehicles.srsAccount",
};

const SAVINGS_VEHICLE_ICONS = {
  savings_account: Banknote,
  goal_based_deposit: Target,
  robo_invest_conservative: LineChart,
  existing_savings_drawdown: CircleDollarSign,
  cpf_ordinary_account: Landmark,
  srs_account: PiggyBank,
};

function SavingsAllocationRow({ entry, t }) {
  const Icon = SAVINGS_VEHICLE_ICONS[entry.vehicle] ?? CircleDollarSign;
  return (
    <div className="weddingLineItem">
      <span className="weddingLineIcon">
        <Icon size={15} />
      </span>
      <span>{t(SAVINGS_VEHICLE_LABEL_KEYS[entry.vehicle] ?? entry.vehicle)}</span>
      <strong>{formatSgd(Math.round(entry.monthly_amount))}</strong>
    </div>
  );
}

function SavingsStrategyCards({ strategies, t }) {
  return (
    <section className="scenarioStack">
      <span className="sectionLabel">{t("weddingPlanner.savingsStrategyLabel")}</span>
      {strategies.map((strategy) => (
        <article className="scenarioCard simulatorScenario" key={strategy.id}>
          <div className="scenarioHead">
            <span>{strategy.name}</span>
          </div>
          <p>{strategy.summary}</p>
          <div className="weddingTotalCost">
            <small>{t("weddingPlanner.monthlyContribution")}</small>
            <strong>{formatSgd(Math.round(strategy.monthly_contribution))}</strong>
          </div>
          <div className="weddingLineItems">
            {strategy.allocation.map((entry) => (
              <SavingsAllocationRow entry={entry} t={t} key={`${strategy.id}-${entry.vehicle}`} />
            ))}
          </div>
          <SupportList
            title={t("weddingPlanner.suitabilityLabel")}
            items={[strategy.suitability.reason, strategy.suitability.risk, strategy.suitability.alternative_considered, strategy.suitability.limitation].filter(
              Boolean
            )}
          />
        </article>
      ))}
    </section>
  );
}

function monthIndex(yyyyMm) {
  const [y, m] = String(yyyyMm).split("-").map(Number);
  return y * 12 + m;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function computeCheckinProgress(plan, checkins) {
  const totalMonths = Math.max(1, monthIndex(plan.target_complete_month) - monthIndex(plan.start_month) + 1);
  const targetTotal = plan.monthly_contribution * totalMonths;
  const loggedTotal = checkins.reduce((sum, c) => sum + Number(c.amount), 0);
  const pct = targetTotal > 0 ? Math.round((loggedTotal / targetTotal) * 100) : 0;
  return { targetTotal, loggedTotal, pct };
}

function SavingsCheckinForm({ onAddCheckin, submitting, t }) {
  const [checkinMonth, setCheckinMonth] = useState(currentMonthValue());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!checkinMonth || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || submitting) return;
    const ok = await onAddCheckin({ checkinMonth, amount: parsedAmount, note: note.trim() || undefined });
    if (ok) {
      setAmount("");
      setNote("");
    }
  };

  return (
    <form className="settingsGroup" onSubmit={handleSubmit}>
      <span className="sectionLabel">{t("weddingPlanner.checkins.addButton")}</span>
      <input
        type="month"
        className="aiTextInput"
        value={checkinMonth}
        onChange={(event) => setCheckinMonth(event.target.value)}
        aria-label={t("weddingPlanner.checkins.monthLabel")}
      />
      <input
        type="number"
        min="0"
        step="10"
        className="aiTextInput"
        placeholder={t("weddingPlanner.checkins.amountLabel")}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        aria-label={t("weddingPlanner.checkins.amountLabel")}
      />
      <input
        type="text"
        className="aiTextInput"
        placeholder={t("weddingPlanner.checkins.noteLabel")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        aria-label={t("weddingPlanner.checkins.noteLabel")}
      />
      <button type="submit" className="secondaryButton" disabled={submitting}>
        {submitting ? t("weddingPlanner.thinking") : t("weddingPlanner.checkins.addButton")}
      </button>
    </form>
  );
}

function ConfirmedSavingsPlanCard({ plan, checkins = [], onAddCheckin, checkinSubmitting, checkinError, t }) {
  const { targetTotal, loggedTotal, pct } = computeCheckinProgress(plan, checkins);
  const ringColor = pct >= 75 ? "#0f9f84" : pct >= 60 ? "#f59e0b" : "#d71920";

  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("weddingPlanner.savingsConfirmedLabel")}</span>
      <div className="weddingTotalCost">
        <small>{t("weddingPlanner.monthlyContribution")}</small>
        <strong>{formatSgd(Math.round(plan.monthly_contribution))}</strong>
      </div>
      <SummaryRow label={t("weddingPlanner.startMonth")} value={plan.start_month} />
      <SummaryRow label={t("weddingPlanner.targetCompleteMonth")} value={plan.target_complete_month} />
      <div className="weddingLineItems">
        {plan.allocation.map((entry) => (
          <SavingsAllocationRow entry={entry} t={t} key={entry.vehicle} />
        ))}
      </div>
      <section className="insightCard">
        <Bot size={20} />
        <p>{plan.notes}</p>
      </section>

      <div className="needHeroCard">
        <span className="sectionLabel">{t("weddingPlanner.checkins.progressLabel")}</span>
        <ProgressRing value={Math.min(pct, 100)} size={80} stroke={8} color={ringColor} />
        <SummaryRow label={t("weddingPlanner.checkins.loggedLabel")} value={formatSgd(Math.round(loggedTotal))} />
        <SummaryRow label={t("weddingPlanner.checkins.targetLabel")} value={formatSgd(Math.round(targetTotal))} />
      </div>

      {checkins.length ? (
        <div className="weddingLineItems">
          {checkins.map((checkin) => (
            <SummaryRow
              key={checkin.id}
              label={checkin.note ? `${checkin.checkin_month} — ${checkin.note}` : checkin.checkin_month}
              value={formatSgd(Math.round(Number(checkin.amount)))}
            />
          ))}
        </div>
      ) : (
        <p>{t("weddingPlanner.checkins.emptyState")}</p>
      )}

      {checkinError ? (
        <section className="adviceOnlyPanel">
          <AlertTriangle size={18} />
          <p>{checkinError}</p>
        </section>
      ) : null}

      {onAddCheckin ? <SavingsCheckinForm onAddCheckin={onAddCheckin} submitting={checkinSubmitting} t={t} /> : null}
    </section>
  );
}

function ConversationHistoryModal({ entries, loading, onClose, t, titleKey, emptyKey }) {
  return (
    <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t(titleKey)}>
      <motion.div className="confirmModal weddingHistoryModal" {...screenMotion}>
        <History size={24} />
        <strong>{t(titleKey)}</strong>
        {loading ? (
          <p>{t("loading.detail")}</p>
        ) : entries.length ? (
          <div className="chatHistoryLog">
            {entries.map((entry, index) => (
              <div className={entry.role === "user" ? "chatBubbleRow user" : "chatBubbleRow assistant"} key={index}>
                <div className={entry.role === "user" ? "chatBubble user" : "chatBubble assistant"}>{entry.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <p>{t(emptyKey)}</p>
        )}
        <button type="button" className="primaryButton" onClick={onClose}>
          {t("homeBanking.gotIt")}
        </button>
      </motion.div>
    </section>
  );
}

function WeddingNeedContent({ success, setSuccess, t, setActiveScreen, language, setSimulatorInputs, setMemoryEvents, profile }) {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [guestCountOverride, setGuestCountOverride] = useState(null);
  const [activitySelections, setActivitySelections] = useState({});
  const [customActivityText, setCustomActivityText] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exploringNewPlan, setExploringNewPlan] = useState(false);
  const [adjustPlanTarget, setAdjustPlanTarget] = useState(null);
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState("");

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    fetch("/api/wedding/history")
      .then((response) => response.json())
      .then((data) => setHistoryEntries(data.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wedding/session")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setSessionData(data);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage(t("weddingPlanner.genericError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const submitToStage1 = async (intent, message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/wedding/stage1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, message, language }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("weddingPlanner.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        planOptions: data.type === "propose_plans" ? data.data : current?.planOptions,
        confirmedBudget: data.type === "confirm_wedding_budget" ? data.data : current?.confirmedBudget,
        stage1Status: data.type === "confirm_wedding_budget" ? "confirmed" : current?.stage1Status,
      }));
      if (data.type === "confirm_wedding_budget") {
        setSuccess();
        setExploringNewPlan(false);
        setAdjustPlanTarget(null);
        const budget = data.data;
        setSimulatorInputs((current) => ({
          ...current,
          weddingBudget: String(Math.round(budget.total_budget)),
          weddingDate: budget.wedding_date,
        }));
        setMemoryEvents((current) => [
          {
            id: `wedding-confirmed-${budget.plan_id}`,
            year: new Date(budget.wedding_date).getFullYear().toString(),
            title: t("weddingPlanner.memoryEventTitle"),
            description: budget.confirmation_note,
            impact: t("weddingPlanner.memoryEventImpact", { amount: formatSgd(Math.round(budget.total_budget)) }),
            product: t("weddingPlanner.memoryEventProduct"),
            action: t("weddingPlanner.memoryEventAction"),
            reason: t("weddingPlanner.memoryEventReason"),
            dataUsed: t("weddingPlanner.memoryEventDataUsed"),
            statusKey: "status.completed",
            confirmedAt: data.confirmedAt ?? null,
          },
          ...current,
        ]);
      }
      return true;
    } catch {
      setErrorMessage(t("weddingPlanner.genericError"));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (text) => submitToStage1(sessionData?.planOptions ? "refine" : "generate", text);

  const selectedPlan = sessionData?.planOptions?.plans.find((plan) => plan.id === selectedPlanId) ?? null;

  const handleSelectPlan = (planId) => {
    const plan = sessionData?.planOptions?.plans.find((p) => p.id === planId);
    if (!plan) return;
    setSelectedPlanId(planId);
    setGuestCountOverride(plan.guest_count);
    setActivitySelections({});
    setCustomActivityText("");
  };

  const handleSubmitActivities = async () => {
    if (!selectedPlan) return;
    const included = WEDDING_ACTIVITY_CATALOG.filter(({ id }) => activitySelections[id]).map(({ labelKey }) => t(labelKey));
    const parts = [];
    if (included.length) parts.push(`Please make sure the plan includes: ${included.join(", ")}.`);
    if (customActivityText.trim()) parts.push(customActivityText.trim());
    if (!parts.length) return;
    const message = `For the "${selectedPlan.name}" plan: ${parts.join(" ")}`;
    const ok = await submitToStage1("edit_activities", message);
    if (ok) {
      setSelectedPlanId(null);
      setActivitySelections({});
      setCustomActivityText("");
    }
  };

  const handleFinalize = async (guestCount, total) => {
    if (!selectedPlan) return;
    const message = `I'd like to finalize the "${selectedPlan.name}" plan with ${guestCount} guests, for a total budget of approximately SGD ${Math.round(total)}. Please confirm this as the final wedding budget.`;
    await submitToStage1("refine", message);
  };

  const submitToStage2 = async (intent, message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/wedding/stage2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, message, language, profile }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("weddingPlanner.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        savingsPlanOptions: data.type === "propose_savings_plan" ? data.data : current?.savingsPlanOptions,
        confirmedSavingsPlan: data.type === "finalize_savings_plan" ? data.data : current?.confirmedSavingsPlan,
      }));
      if (data.type === "finalize_savings_plan") {
        const plan = data.data;
        setSimulatorInputs((current) => ({
          ...current,
          weddingSavingsMonthly: String(Math.round(plan.monthly_contribution)),
          weddingSavingsStartMonth: plan.start_month,
          weddingSavingsTargetMonth: plan.target_complete_month,
        }));
      }
      return true;
    } catch {
      setErrorMessage(t("weddingPlanner.genericError"));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSavingsPlan = () =>
    submitToStage2("generate", "Please suggest savings strategies for funding this confirmed wedding budget.");

  const handleSavingsSubmit = (text) => submitToStage2(sessionData?.savingsPlanOptions ? "refine" : "generate", text);

  const handleExploreNewPlan = () => {
    setSessionData((current) => ({ ...current, planOptions: null }));
    setSelectedPlanId(null);
    setGuestCountOverride(null);
    setActivitySelections({});
    setCustomActivityText("");
    setExploringNewPlan(true);
  };

  const handleAdjustPlan = () => {
    if (!sessionData?.confirmedBudget) return;
    const adapted = adaptConfirmedBudgetToPlan(sessionData.confirmedBudget, t);
    setAdjustPlanTarget(adapted);
    setGuestCountOverride(adapted.guest_count);
    setActivitySelections({});
    setCustomActivityText("");
  };

  const handleAdjustSubmitActivities = async () => {
    if (!adjustPlanTarget) return;
    const included = WEDDING_ACTIVITY_CATALOG.filter(({ id }) => activitySelections[id]).map(({ labelKey }) => t(labelKey));
    const parts = [];
    if (included.length) parts.push(`Please make sure the plan includes: ${included.join(", ")}.`);
    if (customActivityText.trim()) parts.push(customActivityText.trim());
    if (!parts.length) return;
    const message = `This is an update to my already-confirmed wedding plan: ${parts.join(" ")}`;
    const ok = await submitToStage1("refine", message);
    if (ok) {
      setActivitySelections({});
      setCustomActivityText("");
    }
  };

  const handleAdjustFinalize = async (guestCount, total) => {
    if (!adjustPlanTarget) return;
    const message = `I'd like to update my already-confirmed wedding plan to ${guestCount} guests, for a total budget of approximately SGD ${Math.round(total)}. This replaces the previously confirmed plan - please confirm this as the updated final wedding budget.`;
    await submitToStage1("refine", message);
  };

  const handleAddCheckin = async ({ checkinMonth, amount, note }) => {
    setCheckinSubmitting(true);
    setCheckinError("");
    try {
      const response = await fetch("/api/wedding/savings-checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinMonth, amount, note }),
      });
      const data = await response.json();
      if (!response.ok) {
        setCheckinError(t("weddingPlanner.checkins.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        savingsCheckins: [...(current?.savingsCheckins ?? []), data.checkin],
      }));
      return true;
    } catch {
      setCheckinError(t("weddingPlanner.checkins.genericError"));
      return false;
    } finally {
      setCheckinSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title={t("weddingPlanner.title")} subtitle={t("weddingPlanner.subtitle")} />
      <div className="weddingTopRow">
        <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />
        <button type="button" className="historyButton" onClick={openHistory} aria-label={t("weddingPlanner.historyTitle")}>
          <History size={16} />
        </button>
      </div>
      {historyOpen ? (
        <ConversationHistoryModal
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
          t={t}
          titleKey="weddingPlanner.historyTitle"
          emptyKey="weddingPlanner.historyEmpty"
        />
      ) : null}
      <SuccessBanner show={success} text={t("weddingPlanner.success")} />
      {loading ? (
        <p>{t("loading.detail")}</p>
      ) : adjustPlanTarget ? (
        <>
          <PlanEditorPanel
            plan={adjustPlanTarget}
            guestCount={guestCountOverride ?? adjustPlanTarget.guest_count}
            onGuestCountChange={setGuestCountOverride}
            activitySelections={activitySelections}
            onToggleActivity={(id) => setActivitySelections((current) => ({ ...current, [id]: !current[id] }))}
            customActivityText={customActivityText}
            onCustomActivityChange={setCustomActivityText}
            onSubmitActivities={handleAdjustSubmitActivities}
            onFinalize={handleAdjustFinalize}
            submitting={submitting}
            onBack={() => setAdjustPlanTarget(null)}
            backLabelKey="weddingPlanner.backToConfirmedPlan"
            t={t}
          />
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
        </>
      ) : sessionData?.confirmedBudget && !exploringNewPlan ? (
        <>
          <WeddingConfirmedBudgetCard budget={sessionData.confirmedBudget} t={t} />
          <div className="confirmedPlanActions">
            <button type="button" className="secondaryButton" onClick={handleAdjustPlan}>
              {t("weddingPlanner.adjustPlanLabel")}
            </button>
            <button type="button" className="secondaryButton" onClick={handleExploreNewPlan}>
              {t("weddingPlanner.planAnotherLabel")}
            </button>
          </div>
          {sessionData?.confirmedSavingsPlan ? (
            <ConfirmedSavingsPlanCard
              plan={sessionData.confirmedSavingsPlan}
              checkins={sessionData.savingsCheckins ?? []}
              onAddCheckin={handleAddCheckin}
              checkinSubmitting={checkinSubmitting}
              checkinError={checkinError}
              t={t}
            />
          ) : sessionData?.savingsPlanOptions ? (
            <SavingsStrategyCards strategies={sessionData.savingsPlanOptions.strategies} t={t} />
          ) : (
            <section className="needHeroCard">
              <span className="sectionLabel">{t("weddingPlanner.savingsPlanCtaLabel")}</span>
              <p>{t("weddingPlanner.savingsPlanCtaBody")}</p>
              <button type="button" className="primaryButton" onClick={handleStartSavingsPlan} disabled={submitting}>
                {submitting ? t("weddingPlanner.thinking") : t("weddingPlanner.savingsPlanCtaButton")}
                <Send size={18} />
              </button>
            </section>
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {!sessionData?.confirmedSavingsPlan && sessionData?.savingsPlanOptions ? (
            <AiTextInputCard
              t={t}
              onSubmit={handleSavingsSubmit}
              submitting={submitting}
              placeholder={t("weddingPlanner.savingsInputPlaceholder")}
              submitLabelKey="weddingPlanner.send"
            />
          ) : null}
        </>
      ) : (
        <>
          {sessionData?.confirmedBudget ? (
            <button type="button" className="secondaryButton" onClick={() => setExploringNewPlan(false)}>
              {t("weddingPlanner.backToConfirmedPlan")}
            </button>
          ) : null}
          {selectedPlan ? (
            <PlanEditorPanel
              plan={selectedPlan}
              guestCount={guestCountOverride ?? selectedPlan.guest_count}
              onGuestCountChange={setGuestCountOverride}
              activitySelections={activitySelections}
              onToggleActivity={(id) => setActivitySelections((current) => ({ ...current, [id]: !current[id] }))}
              customActivityText={customActivityText}
              onCustomActivityChange={setCustomActivityText}
              onSubmitActivities={handleSubmitActivities}
              onFinalize={handleFinalize}
              submitting={submitting}
              onBack={() => setSelectedPlanId(null)}
              t={t}
            />
          ) : sessionData?.planOptions ? (
            <WeddingPlanCards
              plans={sessionData.planOptions.plans}
              researchNotes={sessionData.planOptions.research_notes}
              onSelectPlan={handleSelectPlan}
              t={t}
            />
          ) : (
            <section className="weddingHero">
              <span className="weddingHeroBadge">{t("weddingPlanner.newFeatureBadge")}</span>
              <span className="weddingHeroIcon">
                <HeartHandshake size={26} />
              </span>
              <strong>{t("weddingPlanner.emptyStateLabel")}</strong>
              <p>{t("weddingPlanner.emptyStateBody")}</p>
            </section>
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {!selectedPlan ? (
            <AiTextInputCard
              t={t}
              onSubmit={handleSubmit}
              submitting={submitting}
              placeholder={t("weddingPlanner.inputPlaceholder")}
              submitLabelKey={sessionData?.planOptions ? "weddingPlanner.send" : "weddingPlanner.sendFirst"}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const PROPERTY_TYPE_LABEL_KEYS = {
  hdb_new: "homePlanner.propertyTypes.hdbNew",
  hdb_resale: "homePlanner.propertyTypes.hdbResale",
  ec_new: "homePlanner.propertyTypes.ecNew",
  ec_resale: "homePlanner.propertyTypes.ecResale",
  condo: "homePlanner.propertyTypes.condo",
  landed: "homePlanner.propertyTypes.landed",
};

function defaultHomeFinancialContext(profile) {
  return {
    monthlyIncome: numberValue(profile.monthlyIncome, 7500),
    monthlyExpenses: numberValue(profile.monthlyExpenses, 3500),
    buyerType: "singapore_citizen",
    existingPropertyCount: 0,
    annualRatePercent: 3.0,
    tenureYears: 25,
  };
}

function targetYearFromTimeline(timeline) {
  if (!timeline?.length) return new Date().getFullYear().toString();
  const last = timeline[timeline.length - 1];
  const totalMonths = (last.start_offset_months ?? 0) + (last.duration_months ?? 0);
  const target = new Date();
  target.setMonth(target.getMonth() + totalMonths);
  return target.getFullYear().toString();
}

function HomeAffordabilityChip({ plan, t }) {
  return (
    <span className={plan.within_affordability ? "statChip" : "statChip warning"}>
      {plan.within_affordability
        ? t("homePlanner.affordabilityOk")
        : t("homePlanner.affordabilityTight", { factor: plan.affordability_limiting_factor })}
    </span>
  );
}

function HomeFinancialsBreakdown({ financials, t }) {
  return (
    <div className="weddingLineItems">
      <SummaryRow label={t("homePlanner.loanAmount")} value={formatSgd(Math.round(financials.loan_amount))} />
      <SummaryRow label={t("homePlanner.downPayment")} value={formatSgd(Math.round(financials.down_payment_cash_cpf))} />
      <SummaryRow label={t("homePlanner.minCashComponent")} value={formatSgd(Math.round(financials.min_cash_component))} />
      <SummaryRow label={t("homePlanner.monthlyInstallment")} value={formatSgd(Math.round(financials.monthly_installment))} />
      <SummaryRow label={t("homePlanner.stampDuty")} value={formatSgd(Math.round(financials.stamp_duty_total))} />
    </div>
  );
}

function HomePlanCards({ plans, researchNotes, onSelectPlan, t }) {
  const medianPrice = [...plans].map((plan) => plan.price).sort((a, b) => a - b)[Math.floor((plans.length - 1) / 2)];
  return (
    <section className="weddingPlanCarouselWrap">
      <span className="sectionLabel">{t("homePlanner.planComparisonLabel")}</span>
      <div className="weddingPlanCarousel">
        {plans.map((plan, index) => {
          const recommended = plan.price === medianPrice;
          return (
            <article className={`weddingPlanTile accent-${index % 3}${recommended ? " recommended" : ""}`} key={plan.id}>
              {recommended ? <span className="miniBadge">{t("status.recommended")}</span> : null}
              <h3>{plan.name}</h3>
              <p className="weddingPlanSummary">{plan.summary}</p>
              <div className="weddingTotalCost">
                <small>{t("homePlanner.propertyPrice")}</small>
                <strong>{formatSgd(Math.round(plan.price))}</strong>
              </div>
              <div className="weddingStatChips">
                <span className="statChip">{t(PROPERTY_TYPE_LABEL_KEYS[plan.property_type] ?? plan.property_type)}</span>
                <span className="statChip">{plan.district}</span>
                <HomeAffordabilityChip plan={plan} t={t} />
              </div>
              <HomeFinancialsBreakdown financials={plan} t={t} />
              <button type="button" className="primaryButton" onClick={() => onSelectPlan(plan.id)}>
                {t("homePlanner.customizePlan")}
              </button>
            </article>
          );
        })}
      </div>
      {plans.length > 1 ? <p className="weddingCarouselHint">{t("weddingPlanner.swipeHint")}</p> : null}
      {researchNotes ? (
        <section className="insightCard">
          <Bot size={20} />
          <p>{researchNotes}</p>
        </section>
      ) : null}
    </section>
  );
}

function HomePlanEditorPanel({
  plan,
  profile,
  customText,
  onCustomTextChange,
  onSubmitCustom,
  onFinalize,
  submitting,
  onBack,
  backLabelKey = "weddingPlanner.backToComparison",
  t,
}) {
  const [priceOverride, setPriceOverride] = useState(plan.estimated_price ?? plan.price);
  const financials = useMemo(
    () =>
      computeHomeFinancials({
        price: priceOverride,
        propertyType: plan.property_type,
        ...defaultHomeFinancialContext(profile),
      }),
    [priceOverride, plan.property_type, profile]
  );

  return (
    <section className="recommendationPanel">
      <div className="scenarioHead">
        <span>{plan.name}</span>
        <button type="button" className="secondaryButton" onClick={onBack}>
          {t(backLabelKey)}
        </button>
      </div>

      <div className="needHeroCard">
        <span className="sectionLabel">{t("homePlanner.priceAdjustLabel")}</span>
        <strong>{formatSgd(Math.round(priceOverride))}</strong>
        <input
          className="wideSlider"
          type="range"
          min={Math.round((plan.estimated_price ?? plan.price) * 0.7)}
          max={Math.round((plan.estimated_price ?? plan.price) * 1.3)}
          step="5000"
          value={priceOverride}
          onChange={(event) => setPriceOverride(Number(event.target.value))}
          aria-label={t("homePlanner.priceAdjustLabel")}
        />
      </div>

      <HomeFinancialsBreakdown financials={financials} t={t} />
      <div className="weddingStatChips">
        <HomeAffordabilityChip plan={financials} t={t} />
      </div>

      <div className="settingsGroup">
        <span className="sectionLabel">{t("homePlanner.customRequestLabel")}</span>
        <textarea
          className="aiTextInput"
          rows={2}
          value={customText}
          onChange={(event) => onCustomTextChange(event.target.value)}
          placeholder={t("homePlanner.customRequestPlaceholder")}
        />
        <button type="button" className="secondaryButton" onClick={onSubmitCustom} disabled={submitting}>
          {submitting ? t("weddingPlanner.thinking") : t("homePlanner.submitCustomChanges")}
        </button>
      </div>

      <TimelineTable
        timeline={plan.timeline}
        t={t}
        offsetKey="start_offset_months"
        formatOffset={formatMonthsOffset}
        labelKey="homePlanner.timelineLabel"
      />

      <button type="button" className="primaryButton" onClick={() => onFinalize(priceOverride)} disabled={submitting}>
        {submitting ? t("weddingPlanner.thinking") : t("homePlanner.finalizeThisPlan")}
        <Check size={18} />
      </button>
    </section>
  );
}

function adaptConfirmedPlanToPlan(confirmedPlan, t) {
  return {
    id: confirmedPlan.plan_id,
    name: t("homePlanner.adjustSyntheticPlanName"),
    property_type: confirmedPlan.property_type,
    estimated_price: confirmedPlan.price,
    timeline: confirmedPlan.timeline,
  };
}

function HomeConfirmedPlanCard({ plan, t }) {
  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("homePlanner.confirmedLabel")}</span>
      <div className="weddingTotalCost">
        <small>{t("homePlanner.propertyPrice")}</small>
        <strong>{formatSgd(Math.round(plan.price))}</strong>
      </div>
      <SummaryRow label={t("homePlanner.propertyType")} value={t(PROPERTY_TYPE_LABEL_KEYS[plan.property_type] ?? plan.property_type)} />
      <SummaryRow label={t("homePlanner.district")} value={plan.district} />
      <SummaryRow label={t("homePlanner.unitType")} value={plan.unit_type} />
      <HomeFinancialsBreakdown financials={plan} t={t} />
      <div className="weddingStatChips">
        <HomeAffordabilityChip plan={plan} t={t} />
      </div>
      <section className="insightCard">
        <Bot size={20} />
        <p>{plan.confirmation_note}</p>
      </section>
      <TimelineTable
        timeline={plan.timeline}
        t={t}
        offsetKey="start_offset_months"
        formatOffset={formatMonthsOffset}
        labelKey="homePlanner.timelineLabel"
      />
    </section>
  );
}

const LIFESTYLE_CATEGORY_LABEL_KEYS = {
  local_modest: "retirementPlanner.lifestyleCategories.localModest",
  local_comfortable: "retirementPlanner.lifestyleCategories.localComfortable",
  global_travel: "retirementPlanner.lifestyleCategories.globalTravel",
  custom: "retirementPlanner.lifestyleCategories.custom",
};

function RetirementCoverageChip({ plan, t }) {
  const pct = plan.cpf_coverage_percent ?? 0;
  const className = pct >= 75 ? "statChip" : pct >= 40 ? "statChip warning" : "statChip warning";
  return (
    <span className={className}>{t("retirementPlanner.cpfCoveragePercent", { percent: pct })}</span>
  );
}

function RetirementFinancialsBreakdown({ financials, t }) {
  return (
    <div className="weddingLineItems">
      <SummaryRow label={t("retirementPlanner.raAtRetirement")} value={formatSgd(Math.round(financials.ra_at_retirement))} />
      <SummaryRow label={t("retirementPlanner.cpfLifePayout")} value={formatSgd(Math.round(financials.cpf_life_payout))} />
      <SummaryRow label={t("retirementPlanner.gapMonthly")} value={formatSgd(Math.round(financials.gap_monthly))} />
    </div>
  );
}

function RetirementPlanCards({ plans, researchNotes, onSelectPlan, t }) {
  const medianIncome = [...plans].map((plan) => plan.target_monthly_income).sort((a, b) => a - b)[
    Math.floor((plans.length - 1) / 2)
  ];
  return (
    <section className="weddingPlanCarouselWrap">
      <span className="sectionLabel">{t("retirementPlanner.planComparisonLabel")}</span>
      <div className="weddingPlanCarousel">
        {plans.map((plan, index) => {
          const recommended = plan.target_monthly_income === medianIncome;
          return (
            <article className={`weddingPlanTile accent-${index % 3}${recommended ? " recommended" : ""}`} key={plan.id}>
              {recommended ? <span className="miniBadge">{t("status.recommended")}</span> : null}
              <h3>{plan.name}</h3>
              <p className="weddingPlanSummary">{plan.summary}</p>
              <div className="weddingTotalCost">
                <small>{t("retirementPlanner.targetMonthlyIncome")}</small>
                <strong>{formatSgd(Math.round(plan.target_monthly_income))}</strong>
              </div>
              <div className="weddingStatChips">
                <span className="statChip">{t(LIFESTYLE_CATEGORY_LABEL_KEYS[plan.lifestyle_category] ?? plan.lifestyle_category)}</span>
                <RetirementCoverageChip plan={plan} t={t} />
              </div>
              <RetirementFinancialsBreakdown financials={plan} t={t} />
              <button type="button" className="primaryButton" onClick={() => onSelectPlan(plan.id)}>
                {t("retirementPlanner.customizePlan")}
              </button>
            </article>
          );
        })}
      </div>
      {plans.length > 1 ? <p className="weddingCarouselHint">{t("weddingPlanner.swipeHint")}</p> : null}
      {researchNotes ? (
        <section className="insightCard">
          <Bot size={20} />
          <p>{researchNotes}</p>
        </section>
      ) : null}
    </section>
  );
}

function RetirementPlanEditorPanel({
  plan,
  retirementContext,
  customText,
  onCustomTextChange,
  onSubmitCustom,
  onFinalize,
  submitting,
  onBack,
  backLabelKey = "weddingPlanner.backToComparison",
  t,
}) {
  const [incomeOverride, setIncomeOverride] = useState(plan.target_monthly_income);
  const financials = useMemo(
    () =>
      computeRetirementFinancials({
        targetMonthlyIncome: incomeOverride,
        cpfLifePlan: plan.cpf_life_plan,
        payoutAge: plan.payout_age,
        ...retirementContext,
      }),
    [incomeOverride, plan.cpf_life_plan, plan.payout_age, retirementContext]
  );

  return (
    <section className="recommendationPanel">
      <div className="scenarioHead">
        <span>{plan.name}</span>
        <button type="button" className="secondaryButton" onClick={onBack}>
          {t(backLabelKey)}
        </button>
      </div>

      <div className="needHeroCard">
        <span className="sectionLabel">{t("retirementPlanner.incomeAdjustLabel")}</span>
        <strong>{formatSgd(Math.round(incomeOverride))}</strong>
        <input
          className="wideSlider"
          type="range"
          min={Math.round(plan.target_monthly_income * 0.7)}
          max={Math.round(plan.target_monthly_income * 1.3)}
          step="50"
          value={incomeOverride}
          onChange={(event) => setIncomeOverride(Number(event.target.value))}
          aria-label={t("retirementPlanner.incomeAdjustLabel")}
        />
      </div>

      <RetirementFinancialsBreakdown financials={financials} t={t} />
      <div className="weddingStatChips">
        <RetirementCoverageChip plan={financials} t={t} />
      </div>

      <div className="settingsGroup">
        <span className="sectionLabel">{t("retirementPlanner.customRequestLabel")}</span>
        <textarea
          className="aiTextInput"
          rows={2}
          value={customText}
          onChange={(event) => onCustomTextChange(event.target.value)}
          placeholder={t("retirementPlanner.customRequestPlaceholder")}
        />
        <button type="button" className="secondaryButton" onClick={onSubmitCustom} disabled={submitting}>
          {submitting ? t("weddingPlanner.thinking") : t("retirementPlanner.submitCustomChanges")}
        </button>
      </div>

      <button type="button" className="primaryButton" onClick={() => onFinalize(incomeOverride)} disabled={submitting}>
        {submitting ? t("weddingPlanner.thinking") : t("retirementPlanner.finalizeThisPlan")}
        <Check size={18} />
      </button>
    </section>
  );
}

function adaptConfirmedRetirementPlanToPlan(confirmedPlan, t) {
  return {
    id: confirmedPlan.plan_id,
    name: t("retirementPlanner.adjustSyntheticPlanName"),
    target_monthly_income: confirmedPlan.target_monthly_income,
    cpf_life_plan: confirmedPlan.cpf_life_plan,
    payout_age: confirmedPlan.payout_age,
  };
}

function RetirementConfirmedPlanCard({ plan, t }) {
  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("retirementPlanner.confirmedLabel")}</span>
      <div className="weddingTotalCost">
        <small>{t("retirementPlanner.targetMonthlyIncome")}</small>
        <strong>{formatSgd(Math.round(plan.target_monthly_income))}</strong>
      </div>
      <SummaryRow
        label={t("retirementPlanner.lifestyleCategoryLabel")}
        value={t(LIFESTYLE_CATEGORY_LABEL_KEYS[plan.lifestyle_category] ?? plan.lifestyle_category)}
      />
      <SummaryRow label={t("retirementPlanner.cpfLifePlanLabel")} value={t(`retirementPlanner.cpfLifePlans.${plan.cpf_life_plan}`)} />
      <SummaryRow label={t("retirementPlanner.payoutAgeLabel")} value={String(plan.payout_age)} />
      <RetirementFinancialsBreakdown financials={plan} t={t} />
      <div className="weddingStatChips">
        <RetirementCoverageChip plan={plan} t={t} />
      </div>
      <section className="insightCard">
        <Bot size={20} />
        <p>{plan.confirmation_note}</p>
      </section>
    </section>
  );
}

function RetirementCpfInputStep({ profile, simulatorInputs, onSubmit, t }) {
  const [currentAge, setCurrentAge] = useState(String(numberValue(profile.age, 30)));
  const [retirementAge, setRetirementAge] = useState(String(simulatorInputs?.retirementAge ?? "65"));
  const [oa, setOa] = useState("");
  const [sa, setSa] = useState("");
  const [ma, setMa] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    const hasBalances = oa.trim() || sa.trim() || ma.trim();
    onSubmit({
      currentAge: Number(currentAge) || 30,
      retirementAge: Number(retirementAge) || 65,
      cpfBalances: hasBalances
        ? { oa: numberValue(oa, 0), sa: numberValue(sa, 0), ma: numberValue(ma, 0) }
        : null,
    });
  };

  return (
    <form className="needHeroCard aiTextInputCard" onSubmit={handleSubmit}>
      <span className="sectionLabel">{t("retirementPlanner.cpfInputStep.title")}</span>
      <p>{t("retirementPlanner.cpfInputStep.body")}</p>
      <span className="sectionLabel">{t("retirementPlanner.cpfInputStep.ageLabel")}</span>
      <input
        type="number"
        min="18"
        max="80"
        className="aiTextInput"
        value={currentAge}
        onChange={(event) => setCurrentAge(event.target.value)}
        aria-label={t("retirementPlanner.cpfInputStep.ageLabel")}
      />
      <span className="sectionLabel">{t("retirementPlanner.cpfInputStep.retirementAgeLabel")}</span>
      <input
        type="number"
        min="55"
        max="75"
        className="aiTextInput"
        value={retirementAge}
        onChange={(event) => setRetirementAge(event.target.value)}
        aria-label={t("retirementPlanner.cpfInputStep.retirementAgeLabel")}
      />
      <span className="sectionLabel">{t("retirementPlanner.cpfInputStep.balancesLabel")}</span>
      <input
        type="number"
        min="0"
        className="aiTextInput"
        placeholder={t("retirementPlanner.cpfInputStep.oaLabel")}
        value={oa}
        onChange={(event) => setOa(event.target.value)}
        aria-label={t("retirementPlanner.cpfInputStep.oaLabel")}
      />
      <input
        type="number"
        min="0"
        className="aiTextInput"
        placeholder={t("retirementPlanner.cpfInputStep.saLabel")}
        value={sa}
        onChange={(event) => setSa(event.target.value)}
        aria-label={t("retirementPlanner.cpfInputStep.saLabel")}
      />
      <input
        type="number"
        min="0"
        className="aiTextInput"
        placeholder={t("retirementPlanner.cpfInputStep.maLabel")}
        value={ma}
        onChange={(event) => setMa(event.target.value)}
        aria-label={t("retirementPlanner.cpfInputStep.maLabel")}
      />
      <p className="weddingCarouselHint">{t("retirementPlanner.cpfInputStep.skipHint")}</p>
      <button type="submit" className="primaryButton">
        {t("retirementPlanner.cpfInputStep.continueButton")}
        <ChevronRight size={18} />
      </button>
    </form>
  );
}

function HomeNeedContent({ success, setSuccess, t, setActiveScreen, language, setSimulatorInputs, setMemoryEvents, profile, setLoanPlannerInitialPurpose }) {
  const [sessionData, setSessionData] = useState(null);
  const [confirmedLoan, setConfirmedLoan] = useState(null);
  const [loanChecked, setLoanChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [customText, setCustomText] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exploringNewPlan, setExploringNewPlan] = useState(false);
  const [adjustPlanTarget, setAdjustPlanTarget] = useState(null);
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState("");

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    fetch("/api/home/history")
      .then((response) => response.json())
      .then((data) => setHistoryEntries(data.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/home/session")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setSessionData(data);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage(t("homePlanner.genericError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/loan/session?purpose=home")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setConfirmedLoan(data.confirmedLoan ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoanChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitToStage1 = async (intent, message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/home/stage1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          message,
          language,
          profile: { monthlyIncome: profile.monthlyIncome, monthlyExpenses: profile.monthlyExpenses },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("homePlanner.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        planOptions: data.type === "propose_home_plans" ? data.data : current?.planOptions,
        confirmedPlan: data.type === "confirm_home_plan" ? data.data : current?.confirmedPlan,
        stage1Status: data.type === "confirm_home_plan" ? "confirmed" : current?.stage1Status,
      }));
      if (data.type === "confirm_home_plan") {
        setSuccess();
        setExploringNewPlan(false);
        setAdjustPlanTarget(null);
        const plan = data.data;
        setSimulatorInputs((current) => ({
          ...current,
          targetDownPayment: String(Math.round(plan.down_payment_cash_cpf)),
          targetHomeYear: targetYearFromTimeline(plan.timeline),
        }));
        setMemoryEvents((current) => [
          {
            id: `home-confirmed-${plan.plan_id}`,
            year: targetYearFromTimeline(plan.timeline),
            title: t("homePlanner.memoryEventTitle"),
            description: plan.confirmation_note,
            impact: t("homePlanner.memoryEventImpact", { amount: formatSgd(Math.round(plan.down_payment_cash_cpf)) }),
            product: t("homePlanner.memoryEventProduct"),
            action: t("homePlanner.memoryEventAction"),
            reason: t("homePlanner.memoryEventReason"),
            dataUsed: t("homePlanner.memoryEventDataUsed"),
            statusKey: "status.completed",
            confirmedAt: data.confirmedAt ?? null,
          },
          ...current,
        ]);
      }
      return true;
    } catch {
      setErrorMessage(t("homePlanner.genericError"));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (text) => submitToStage1(sessionData?.planOptions ? "refine" : "generate", text);

  const selectedPlan = sessionData?.planOptions?.plans.find((plan) => plan.id === selectedPlanId) ?? null;

  const handleSelectPlan = (planId) => {
    if (!sessionData?.planOptions?.plans.find((p) => p.id === planId)) return;
    setSelectedPlanId(planId);
    setCustomText("");
  };

  const handleSubmitCustom = async () => {
    if (!selectedPlan || !customText.trim()) return;
    const message = `For the "${selectedPlan.name}" plan: ${customText.trim()}`;
    const ok = await submitToStage1("refine", message);
    if (ok) {
      setSelectedPlanId(null);
      setCustomText("");
    }
  };

  const handleFinalize = async (priceOverride) => {
    if (!selectedPlan) return;
    const message = `I'd like to finalize the "${selectedPlan.name}" plan at an estimated price of approximately SGD ${Math.round(
      priceOverride
    )}. Please confirm this as the final home purchase plan.`;
    await submitToStage1("refine", message);
  };

  const submitToStage2 = async (intent, message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/home/stage2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, message, language, profile }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("homePlanner.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        savingsPlanOptions: data.type === "propose_home_savings_plan" ? data.data : current?.savingsPlanOptions,
        confirmedSavingsPlan: data.type === "finalize_home_savings_plan" ? data.data : current?.confirmedSavingsPlan,
      }));
      if (data.type === "finalize_home_savings_plan") {
        const plan = data.data;
        setSimulatorInputs((current) => ({
          ...current,
          homeSavingsMonthly: String(Math.round(plan.monthly_contribution)),
          homeSavingsStartMonth: plan.start_month,
          homeSavingsTargetMonth: plan.target_complete_month,
        }));
      }
      return true;
    } catch {
      setErrorMessage(t("homePlanner.genericError"));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSavingsPlan = () =>
    submitToStage2("generate", "Please suggest savings strategies for funding this confirmed home purchase's down payment.");

  const handleSavingsSubmit = (text) => submitToStage2(sessionData?.savingsPlanOptions ? "refine" : "generate", text);

  const handleExploreNewPlan = () => {
    setSessionData((current) => ({ ...current, planOptions: null }));
    setSelectedPlanId(null);
    setCustomText("");
    setExploringNewPlan(true);
  };

  const handleAdjustPlan = () => {
    if (!sessionData?.confirmedPlan) return;
    const adapted = adaptConfirmedPlanToPlan(sessionData.confirmedPlan, t);
    setAdjustPlanTarget(adapted);
    setCustomText("");
  };

  const handleAdjustSubmitCustom = async () => {
    if (!adjustPlanTarget || !customText.trim()) return;
    const message = `This is an update to my already-confirmed home purchase plan: ${customText.trim()}`;
    const ok = await submitToStage1("refine", message);
    if (ok) setCustomText("");
  };

  const handleAdjustFinalize = async (priceOverride) => {
    if (!adjustPlanTarget) return;
    const message = `I'd like to update my already-confirmed home purchase plan to an estimated price of approximately SGD ${Math.round(
      priceOverride
    )}. This replaces the previously confirmed plan - please confirm this as the updated final home purchase plan.`;
    await submitToStage1("refine", message);
  };

  const handleAddCheckin = async ({ checkinMonth, amount, note }) => {
    setCheckinSubmitting(true);
    setCheckinError("");
    try {
      const response = await fetch("/api/home/savings-checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinMonth, amount, note }),
      });
      const data = await response.json();
      if (!response.ok) {
        setCheckinError(t("weddingPlanner.checkins.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        savingsCheckins: [...(current?.savingsCheckins ?? []), data.checkin],
      }));
      return true;
    } catch {
      setCheckinError(t("weddingPlanner.checkins.genericError"));
      return false;
    } finally {
      setCheckinSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title={t("homePlanner.title")} subtitle={t("homePlanner.subtitle")} />
      <div className="weddingTopRow">
        <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />
        <button type="button" className="historyButton" onClick={openHistory} aria-label={t("homePlanner.historyTitle")}>
          <History size={16} />
        </button>
      </div>
      {historyOpen ? (
        <ConversationHistoryModal
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
          t={t}
          titleKey="homePlanner.historyTitle"
          emptyKey="homePlanner.historyEmpty"
        />
      ) : null}
      <SuccessBanner show={success} text={t("homePlanner.success")} />
      {loading ? (
        <p>{t("loading.detail")}</p>
      ) : adjustPlanTarget ? (
        <>
          <HomePlanEditorPanel
            plan={adjustPlanTarget}
            profile={profile}
            customText={customText}
            onCustomTextChange={setCustomText}
            onSubmitCustom={handleAdjustSubmitCustom}
            onFinalize={handleAdjustFinalize}
            submitting={submitting}
            onBack={() => setAdjustPlanTarget(null)}
            backLabelKey="homePlanner.backToConfirmedPlan"
            t={t}
          />
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
        </>
      ) : sessionData?.confirmedPlan && !exploringNewPlan ? (
        <>
          <HomeConfirmedPlanCard plan={sessionData.confirmedPlan} t={t} />
          <div className="confirmedPlanActions">
            <button type="button" className="secondaryButton" onClick={handleAdjustPlan}>
              {t("homePlanner.adjustPlanLabel")}
            </button>
            <button type="button" className="secondaryButton" onClick={handleExploreNewPlan}>
              {t("homePlanner.planAnotherLabel")}
            </button>
          </div>
          {loanChecked && confirmedLoan ? (
            <section className="needHeroCard">
              <span className="sectionLabel">{t("homePlanner.financingLabel")}</span>
              <div className="weddingStatChips">
                <span className="statChip">
                  {t(LOAN_ARCHETYPE_LABEL_KEYS[confirmedLoan.archetype] ?? confirmedLoan.archetype)}
                </span>
                <span className="statChip">{formatSgd(Math.round(confirmedLoan.monthly_installment))}/mo</span>
                <span className="statChip">{confirmedLoan.tenure_years}y</span>
              </div>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => {
                  setLoanPlannerInitialPurpose("home");
                  setActiveScreen(screens.NEED_LOAN);
                }}
              >
                {t("homePlanner.changeFinancingLabel")}
              </button>
            </section>
          ) : loanChecked ? (
            <section className="needHeroCard">
              <span className="sectionLabel">{t("homePlanner.chooseFinancingLabel")}</span>
              <p>{t("homePlanner.chooseFinancingBody")}</p>
              <button
                type="button"
                className="primaryButton"
                onClick={() => {
                  setLoanPlannerInitialPurpose("home");
                  setActiveScreen(screens.NEED_LOAN);
                }}
              >
                {t("homePlanner.chooseFinancingButton")}
                <Send size={18} />
              </button>
            </section>
          ) : null}
          {!confirmedLoan ? null : sessionData?.confirmedSavingsPlan ? (
            <ConfirmedSavingsPlanCard
              plan={sessionData.confirmedSavingsPlan}
              checkins={sessionData.savingsCheckins ?? []}
              onAddCheckin={handleAddCheckin}
              checkinSubmitting={checkinSubmitting}
              checkinError={checkinError}
              t={t}
            />
          ) : sessionData?.savingsPlanOptions ? (
            <SavingsStrategyCards strategies={sessionData.savingsPlanOptions.strategies} t={t} />
          ) : (
            <section className="needHeroCard">
              <span className="sectionLabel">{t("homePlanner.savingsPlanCtaLabel")}</span>
              <p>{t("homePlanner.savingsPlanCtaBody")}</p>
              <button type="button" className="primaryButton" onClick={handleStartSavingsPlan} disabled={submitting}>
                {submitting ? t("weddingPlanner.thinking") : t("homePlanner.savingsPlanCtaButton")}
                <Send size={18} />
              </button>
            </section>
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {!sessionData?.confirmedSavingsPlan && sessionData?.savingsPlanOptions ? (
            <AiTextInputCard
              t={t}
              onSubmit={handleSavingsSubmit}
              submitting={submitting}
              placeholder={t("homePlanner.savingsInputPlaceholder")}
              submitLabelKey="weddingPlanner.send"
              labelKey="homePlanner.inputLabel"
            />
          ) : null}
        </>
      ) : (
        <>
          {sessionData?.confirmedPlan ? (
            <button type="button" className="secondaryButton" onClick={() => setExploringNewPlan(false)}>
              {t("homePlanner.backToConfirmedPlan")}
            </button>
          ) : null}
          {selectedPlan ? (
            <HomePlanEditorPanel
              plan={selectedPlan}
              profile={profile}
              customText={customText}
              onCustomTextChange={setCustomText}
              onSubmitCustom={handleSubmitCustom}
              onFinalize={handleFinalize}
              submitting={submitting}
              onBack={() => setSelectedPlanId(null)}
              t={t}
            />
          ) : sessionData?.planOptions ? (
            <HomePlanCards
              plans={sessionData.planOptions.plans}
              researchNotes={sessionData.planOptions.research_notes}
              onSelectPlan={handleSelectPlan}
              t={t}
            />
          ) : (
            <section className="weddingHero">
              <span className="weddingHeroBadge">{t("homePlanner.newFeatureBadge")}</span>
              <span className="weddingHeroIcon">
                <Building2 size={26} />
              </span>
              <strong>{t("homePlanner.emptyStateLabel")}</strong>
              <p>{t("homePlanner.emptyStateBody")}</p>
            </section>
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {!selectedPlan ? (
            <AiTextInputCard
              t={t}
              onSubmit={handleSubmit}
              submitting={submitting}
              placeholder={t("homePlanner.inputPlaceholder")}
              submitLabelKey={sessionData?.planOptions ? "weddingPlanner.send" : "homePlanner.sendFirst"}
              labelKey="homePlanner.inputLabel"
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function RetirementNeedContent({
  success,
  setSuccess,
  t,
  setActiveScreen,
  language,
  setSimulatorInputs,
  setMemoryEvents,
  profile,
  simulatorInputs,
}) {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [customText, setCustomText] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exploringNewPlan, setExploringNewPlan] = useState(false);
  const [adjustPlanTarget, setAdjustPlanTarget] = useState(null);
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState("");
  // Persisted client-side (not just React state) so the age/retirement-age/
  // CPF-balance context entered once survives a page reload — without this,
  // "Adjust This Plan" and later refine calls after a reload silently fall
  // back to estimated defaults instead of what the customer actually entered.
  const [retirementProfileInput, setRetirementProfileInputState] = useState(() =>
    typeof window === "undefined" ? null : safeJsonParse(window.localStorage.getItem("futureos-retirement-profile"), null)
  );
  const setRetirementProfileInput = (value) => {
    setRetirementProfileInputState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("futureos-retirement-profile", JSON.stringify(value));
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    fetch("/api/retirement/history")
      .then((response) => response.json())
      .then((data) => setHistoryEntries(data.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/retirement/session")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setSessionData(data);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage(t("retirementPlanner.genericError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const effectiveRetirementProfile =
    retirementProfileInput ?? {
      currentAge: numberValue(profile.age, 30),
      retirementAge: numberValue(simulatorInputs?.retirementAge, 65),
      cpfBalances: null,
    };
  const { currentAge: effCurrentAge, retirementAge: effRetirementAge, cpfBalances: effCpfBalances } = effectiveRetirementProfile;
  const effMonthlyIncome = numberValue(profile.monthlyIncome, 7500);
  // Memoized so RetirementPlanEditorPanel's own useMemo (which depends on
  // this object) only recomputes the CPF projection loop when the
  // underlying values actually change, not on every unrelated re-render.
  const retirementContext = useMemo(
    () => ({
      currentAge: effCurrentAge,
      retirementAge: effRetirementAge,
      currentBalances: effCpfBalances,
      monthlyIncome: effMonthlyIncome,
    }),
    [effCurrentAge, effRetirementAge, effCpfBalances, effMonthlyIncome]
  );

  const submitToStage1 = async (intent, message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/retirement/stage1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          message,
          language,
          profile: { monthlyIncome: profile.monthlyIncome, monthlyExpenses: profile.monthlyExpenses, age: profile.age },
          retirementProfile: effectiveRetirementProfile,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("retirementPlanner.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        planOptions: data.type === "propose_retirement_plans" ? data.data : current?.planOptions,
        confirmedPlan: data.type === "confirm_retirement_plan" ? data.data : current?.confirmedPlan,
        stage1Status: data.type === "confirm_retirement_plan" ? "confirmed" : current?.stage1Status,
      }));
      if (data.type === "confirm_retirement_plan") {
        setSuccess();
        setExploringNewPlan(false);
        setAdjustPlanTarget(null);
        const plan = data.data;
        setSimulatorInputs((current) => ({
          ...current,
          retirementAge: String(effectiveRetirementProfile.retirementAge),
        }));
        setMemoryEvents((current) => [
          {
            id: `retirement-confirmed-${plan.plan_id}`,
            year: String(new Date().getFullYear() + (effectiveRetirementProfile.retirementAge - effectiveRetirementProfile.currentAge)),
            title: t("retirementPlanner.memoryEventTitle"),
            description: plan.confirmation_note,
            impact: t("retirementPlanner.memoryEventImpact", { amount: formatSgd(Math.round(plan.target_monthly_income)) }),
            product: t("retirementPlanner.memoryEventProduct"),
            action: t("retirementPlanner.memoryEventAction"),
            reason: t("retirementPlanner.memoryEventReason"),
            dataUsed: t("retirementPlanner.memoryEventDataUsed"),
            statusKey: "status.completed",
            confirmedAt: data.confirmedAt ?? null,
          },
          ...current,
        ]);
      }
      return true;
    } catch {
      setErrorMessage(t("retirementPlanner.genericError"));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (text) => submitToStage1(sessionData?.planOptions ? "refine" : "generate", text);

  const selectedPlan = sessionData?.planOptions?.plans.find((plan) => plan.id === selectedPlanId) ?? null;

  const handleSelectPlan = (planId) => {
    if (!sessionData?.planOptions?.plans.find((p) => p.id === planId)) return;
    setSelectedPlanId(planId);
    setCustomText("");
  };

  const handleSubmitCustom = async () => {
    if (!selectedPlan || !customText.trim()) return;
    const message = `For the "${selectedPlan.name}" plan: ${customText.trim()}`;
    const ok = await submitToStage1("refine", message);
    if (ok) {
      setSelectedPlanId(null);
      setCustomText("");
    }
  };

  const handleFinalize = async (incomeOverride) => {
    if (!selectedPlan) return;
    const message = `I'd like to finalize the "${selectedPlan.name}" plan at a target monthly retirement income of approximately SGD ${Math.round(
      incomeOverride
    )}. Please confirm this as the final retirement plan.`;
    await submitToStage1("refine", message);
  };

  const submitToStage2 = async (intent, message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/retirement/stage2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, message, language, profile }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("retirementPlanner.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        savingsPlanOptions: data.type === "propose_retirement_savings_plan" ? data.data : current?.savingsPlanOptions,
        confirmedSavingsPlan: data.type === "finalize_retirement_savings_plan" ? data.data : current?.confirmedSavingsPlan,
      }));
      if (data.type === "finalize_retirement_savings_plan") {
        const plan = data.data;
        setSimulatorInputs((current) => ({
          ...current,
          retirementSavingsMonthly: String(Math.round(plan.monthly_contribution)),
          retirementSavingsStartMonth: plan.start_month,
          retirementSavingsTargetMonth: plan.target_complete_month,
        }));
      }
      return true;
    } catch {
      setErrorMessage(t("retirementPlanner.genericError"));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSavingsPlan = () =>
    submitToStage2("generate", "Please suggest savings strategies for funding this confirmed retirement plan's income gap.");

  const handleSavingsSubmit = (text) => submitToStage2(sessionData?.savingsPlanOptions ? "refine" : "generate", text);

  const handleExploreNewPlan = () => {
    setSessionData((current) => ({ ...current, planOptions: null }));
    setSelectedPlanId(null);
    setCustomText("");
    setExploringNewPlan(true);
  };

  const handleAdjustPlan = () => {
    if (!sessionData?.confirmedPlan) return;
    const adapted = adaptConfirmedRetirementPlanToPlan(sessionData.confirmedPlan, t);
    setAdjustPlanTarget(adapted);
    setCustomText("");
  };

  const handleAdjustSubmitCustom = async () => {
    if (!adjustPlanTarget || !customText.trim()) return;
    const message = `This is an update to my already-confirmed retirement plan: ${customText.trim()}`;
    const ok = await submitToStage1("refine", message);
    if (ok) setCustomText("");
  };

  const handleAdjustFinalize = async (incomeOverride) => {
    if (!adjustPlanTarget) return;
    const message = `I'd like to update my already-confirmed retirement plan to a target monthly income of approximately SGD ${Math.round(
      incomeOverride
    )}. This replaces the previously confirmed plan - please confirm this as the updated final retirement plan.`;
    await submitToStage1("refine", message);
  };

  const handleAddCheckin = async ({ checkinMonth, amount, note }) => {
    setCheckinSubmitting(true);
    setCheckinError("");
    try {
      const response = await fetch("/api/retirement/savings-checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinMonth, amount, note }),
      });
      const data = await response.json();
      if (!response.ok) {
        setCheckinError(t("weddingPlanner.checkins.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        savingsCheckins: [...(current?.savingsCheckins ?? []), data.checkin],
      }));
      return true;
    } catch {
      setCheckinError(t("weddingPlanner.checkins.genericError"));
      return false;
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const needsCpfInputStep = !retirementProfileInput && !sessionData?.confirmedPlan && !sessionData?.planOptions;

  return (
    <Screen>
      <Header title={t("retirementPlanner.title")} subtitle={t("retirementPlanner.subtitle")} />
      <div className="weddingTopRow">
        <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />
        <button type="button" className="historyButton" onClick={openHistory} aria-label={t("retirementPlanner.historyTitle")}>
          <History size={16} />
        </button>
      </div>
      {historyOpen ? (
        <ConversationHistoryModal
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
          t={t}
          titleKey="retirementPlanner.historyTitle"
          emptyKey="retirementPlanner.historyEmpty"
        />
      ) : null}
      <SuccessBanner show={success} text={t("retirementPlanner.success")} />
      {loading ? (
        <p>{t("loading.detail")}</p>
      ) : needsCpfInputStep ? (
        <RetirementCpfInputStep
          profile={profile}
          simulatorInputs={simulatorInputs}
          onSubmit={setRetirementProfileInput}
          t={t}
        />
      ) : adjustPlanTarget ? (
        <>
          <RetirementPlanEditorPanel
            plan={adjustPlanTarget}
            retirementContext={retirementContext}
            customText={customText}
            onCustomTextChange={setCustomText}
            onSubmitCustom={handleAdjustSubmitCustom}
            onFinalize={handleAdjustFinalize}
            submitting={submitting}
            onBack={() => setAdjustPlanTarget(null)}
            backLabelKey="retirementPlanner.backToConfirmedPlan"
            t={t}
          />
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
        </>
      ) : sessionData?.confirmedPlan && !exploringNewPlan ? (
        <>
          <RetirementConfirmedPlanCard plan={sessionData.confirmedPlan} t={t} />
          <div className="confirmedPlanActions">
            <button type="button" className="secondaryButton" onClick={handleAdjustPlan}>
              {t("retirementPlanner.adjustPlanLabel")}
            </button>
            <button type="button" className="secondaryButton" onClick={handleExploreNewPlan}>
              {t("retirementPlanner.planAnotherLabel")}
            </button>
          </div>
          {sessionData?.confirmedSavingsPlan ? (
            <ConfirmedSavingsPlanCard
              plan={sessionData.confirmedSavingsPlan}
              checkins={sessionData.savingsCheckins ?? []}
              onAddCheckin={handleAddCheckin}
              checkinSubmitting={checkinSubmitting}
              checkinError={checkinError}
              t={t}
            />
          ) : sessionData?.savingsPlanOptions ? (
            <SavingsStrategyCards strategies={sessionData.savingsPlanOptions.strategies} t={t} />
          ) : (
            <section className="needHeroCard">
              <span className="sectionLabel">{t("retirementPlanner.savingsPlanCtaLabel")}</span>
              <p>{t("retirementPlanner.savingsPlanCtaBody")}</p>
              <button type="button" className="primaryButton" onClick={handleStartSavingsPlan} disabled={submitting}>
                {submitting ? t("weddingPlanner.thinking") : t("retirementPlanner.savingsPlanCtaButton")}
                <Send size={18} />
              </button>
            </section>
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {!sessionData?.confirmedSavingsPlan && sessionData?.savingsPlanOptions ? (
            <AiTextInputCard
              t={t}
              onSubmit={handleSavingsSubmit}
              submitting={submitting}
              placeholder={t("retirementPlanner.savingsInputPlaceholder")}
              submitLabelKey="weddingPlanner.send"
              labelKey="retirementPlanner.inputLabel"
            />
          ) : null}
        </>
      ) : (
        <>
          {sessionData?.confirmedPlan ? (
            <button type="button" className="secondaryButton" onClick={() => setExploringNewPlan(false)}>
              {t("retirementPlanner.backToConfirmedPlan")}
            </button>
          ) : null}
          {selectedPlan ? (
            <RetirementPlanEditorPanel
              plan={selectedPlan}
              retirementContext={retirementContext}
              customText={customText}
              onCustomTextChange={setCustomText}
              onSubmitCustom={handleSubmitCustom}
              onFinalize={handleFinalize}
              submitting={submitting}
              onBack={() => setSelectedPlanId(null)}
              t={t}
            />
          ) : sessionData?.planOptions ? (
            <RetirementPlanCards
              plans={sessionData.planOptions.plans}
              researchNotes={sessionData.planOptions.research_notes}
              onSelectPlan={handleSelectPlan}
              t={t}
            />
          ) : (
            <section className="weddingHero">
              <span className="weddingHeroBadge">{t("retirementPlanner.newFeatureBadge")}</span>
              <span className="weddingHeroIcon">
                <Landmark size={26} />
              </span>
              <strong>{t("retirementPlanner.emptyStateLabel")}</strong>
              <p>{t("retirementPlanner.emptyStateBody")}</p>
            </section>
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {!selectedPlan ? (
            <AiTextInputCard
              t={t}
              onSubmit={handleSubmit}
              submitting={submitting}
              placeholder={t("retirementPlanner.inputPlaceholder")}
              submitLabelKey={sessionData?.planOptions ? "weddingPlanner.send" : "retirementPlanner.sendFirst"}
              labelKey="retirementPlanner.inputLabel"
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const RECOVERY_ACTION_ICONS = {
  pause_goal_plan: PiggyBank,
  reduce_goal_plan: PiggyBank,
  drawdown_emergency_fund: Banknote,
  invest_excess: LineChart,
  other_ocbc_support: ShieldCheck,
};

function RecoveryActionCard({ action, selected, onToggle, t }) {
  const Icon = RECOVERY_ACTION_ICONS[action.action_type] ?? ShieldCheck;
  return (
    <button
      type="button"
      className={selected ? "checkOption selected" : "checkOption"}
      onClick={() => onToggle(action.id)}
    >
      <Icon size={18} />
      <span>
        <strong>{t(`needDetails.emergency.actionTypes.${action.action_type}`)}</strong>
        {action.target_domain ? <em> — {t(`needDetails.emergency.domains.${action.target_domain}`)}</em> : null}
        <p>{action.rationale}</p>
        {action.action_type !== "other_ocbc_support" ? <b>{formatSgd(Math.round(action.amount))}</b> : null}
      </span>
      {selected ? <Check size={16} /> : null}
    </button>
  );
}

const LOAN_PURPOSE_LABEL_KEYS = {
  home: "loanPlanner.purposes.home",
  renovation: "loanPlanner.purposes.renovation",
  personal: "loanPlanner.purposes.personal",
};
const LOAN_PURPOSE_DESC_KEYS = {
  home: "loanPlanner.purposeDescriptions.home",
  renovation: "loanPlanner.purposeDescriptions.renovation",
  personal: "loanPlanner.purposeDescriptions.personal",
};
const LOAN_PURPOSE_ICONS = { home: Building2, renovation: Sparkles, personal: CircleDollarSign };

const LOAN_ARCHETYPE_LABEL_KEYS = {
  safe: "loanPlanner.archetypes.safe",
  balanced: "loanPlanner.archetypes.balanced",
  fast: "loanPlanner.archetypes.fast",
};
const LOAN_ARCHETYPE_DESC_KEYS = {
  safe: "loanPlanner.archetypeDescriptions.safe",
  balanced: "loanPlanner.archetypeDescriptions.balanced",
  fast: "loanPlanner.archetypeDescriptions.fast",
};
const LOAN_ARCHETYPE_ICONS = { safe: ShieldCheck, balanced: Target, fast: LineChart };

const LOAN_MODIFIER_LABEL_KEYS = {
  flexible: "loanPlanner.modifiers.flexible",
  growth: "loanPlanner.modifiers.growth",
  protection: "loanPlanner.modifiers.protection",
};
const LOAN_MODIFIER_DESC_KEYS = {
  flexible: "loanPlanner.modifierDescriptions.flexible",
  growth: "loanPlanner.modifierDescriptions.growth",
  protection: "loanPlanner.modifierDescriptions.protection",
};
const LOAN_MODIFIER_ICONS = { flexible: SlidersHorizontal, growth: LineChart, protection: ShieldCheck };

const EMERGENCY_FUND_IMPACT_LABEL_KEYS = {
  protected: "loanPlanner.emergencyFundImpact.protected",
  healthy: "loanPlanner.emergencyFundImpact.healthy",
  reduced: "loanPlanner.emergencyFundImpact.reduced",
  weak: "loanPlanner.emergencyFundImpact.weak",
};
const OTHER_GOALS_IMPACT_LABEL_KEYS = {
  on_track: "loanPlanner.otherGoalsImpact.onTrack",
  tight: "loanPlanner.otherGoalsImpact.tight",
  at_risk: "loanPlanner.otherGoalsImpact.atRisk",
};

function LoanImpactChip({ impact, labelKeys, t }) {
  const className = impact === "at_risk" || impact === "weak" ? "statChip warning" : "statChip";
  return <span className={className}>{t(labelKeys[impact] ?? impact)}</span>;
}

function LoanArchetypeCard({ archetypeKey, result, selected, recommended, onSelect, t }) {
  const Icon = LOAN_ARCHETYPE_ICONS[archetypeKey] ?? Target;
  return (
    <article className={`weddingPlanTile accent-${archetypeKey === "safe" ? 0 : archetypeKey === "balanced" ? 1 : 2}${selected ? " recommended" : ""}`}>
      {recommended ? <span className="miniBadge">{t("status.recommended")}</span> : null}
      <h3>
        <Icon size={16} /> {t(LOAN_ARCHETYPE_LABEL_KEYS[archetypeKey])}
      </h3>
      <p className="weddingPlanSummary">{t(LOAN_ARCHETYPE_DESC_KEYS[archetypeKey])}</p>
      <div className="weddingTotalCost">
        <small>{t("loanPlanner.monthlyInstallment")}</small>
        <strong>{formatSgd(Math.round(result.monthly_installment))}</strong>
      </div>
      <SummaryRow label={t("loanPlanner.loanAmount")} value={formatSgd(Math.round(result.loan_amount))} />
      <SummaryRow label={t("loanPlanner.tenure")} value={`${result.tenure_years}y`} />
      <SummaryRow label={t("loanPlanner.totalInterest")} value={formatSgd(Math.round(result.total_interest))} />
      <SummaryRow label={t("loanPlanner.futureScore")} value={result.future_score} />
      <div className="weddingStatChips">
        <LoanImpactChip impact={result.emergency_fund_impact} labelKeys={EMERGENCY_FUND_IMPACT_LABEL_KEYS} t={t} />
        <LoanImpactChip impact={result.other_goals_impact} labelKeys={OTHER_GOALS_IMPACT_LABEL_KEYS} t={t} />
        {result.ltv_capped ? <span className="statChip">{t("loanPlanner.ltvCapped")}</span> : null}
        {result.exceeds_serviceability ? <span className="statChip warning">{t("loanPlanner.exceedsServiceability")}</span> : null}
      </div>
      <button type="button" className={selected ? "primaryButton" : "secondaryButton"} onClick={() => onSelect(archetypeKey)}>
        {selected ? t("loanPlanner.selected") : t("loanPlanner.selectStrategy")}
        {selected ? <Check size={16} /> : null}
      </button>
    </article>
  );
}

function LoanModifierToggle({ modifierKey, active, onToggle, t }) {
  const Icon = LOAN_MODIFIER_ICONS[modifierKey] ?? SlidersHorizontal;
  return (
    <button type="button" className={active ? "checkOption selected" : "checkOption"} onClick={() => onToggle(modifierKey)}>
      <Icon size={15} />
      <span>
        {t(LOAN_MODIFIER_LABEL_KEYS[modifierKey])}
        <small style={{ display: "block", fontWeight: 400 }}>{t(LOAN_MODIFIER_DESC_KEYS[modifierKey])}</small>
      </span>
      {active ? <Check size={14} /> : null}
    </button>
  );
}

function LoanStrategySelector({ archetypes, selectedArchetype, onSelectArchetype, selectedModifiers, onToggleModifier, t }) {
  const selectedResult = archetypes[selectedArchetype];
  return (
    <section className="weddingPlanCarouselWrap">
      <span className="sectionLabel">{t("loanPlanner.strategyLabel")}</span>
      <div className="weddingPlanCarousel">
        {LOAN_ARCHETYPE_KEYS.map((key) => (
          <LoanArchetypeCard
            key={key}
            archetypeKey={key}
            result={archetypes[key]}
            selected={selectedArchetype === key}
            recommended={key === "balanced"}
            onSelect={onSelectArchetype}
            t={t}
          />
        ))}
      </div>
      <div className="settingsGroup">
        <span className="sectionLabel">{t("loanPlanner.modifiersLabel")}</span>
        <div className="checkboxGrid">
          {LOAN_MODIFIER_KEYS.map((key) => (
            <LoanModifierToggle key={key} modifierKey={key} active={selectedModifiers.includes(key)} onToggle={onToggleModifier} t={t} />
          ))}
        </div>
        {selectedResult?.insurance_premium_monthly ? (
          <p className="weddingCarouselHint">{t("loanPlanner.protectionNote", { amount: formatSgd(selectedResult.insurance_premium_monthly) })}</p>
        ) : null}
        {selectedResult?.invested_lump_sum ? (
          <p className="weddingCarouselHint">
            {t("loanPlanner.growthNote", {
              amount: formatSgd(selectedResult.invested_lump_sum),
              projected: formatSgd(selectedResult.projected_investment_value),
            })}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function LoanConfirmedCard({ loan, onChangeStrategy, onChangeAmount, t }) {
  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("loanPlanner.confirmedLabel")}</span>
      <div className="weddingTotalCost">
        <small>{t("loanPlanner.monthlyInstallment")}</small>
        <strong>{formatSgd(Math.round(loan.monthly_installment))}</strong>
      </div>
      <SummaryRow label={t("loanPlanner.purposeLabel")} value={t(LOAN_PURPOSE_LABEL_KEYS[loan.purpose] ?? loan.purpose)} />
      <SummaryRow label={t("loanPlanner.strategyLabel")} value={t(LOAN_ARCHETYPE_LABEL_KEYS[loan.archetype] ?? loan.archetype)} />
      <SummaryRow label={t("loanPlanner.loanAmount")} value={formatSgd(Math.round(loan.loan_amount))} />
      <SummaryRow label={t("loanPlanner.tenure")} value={`${loan.tenure_years}y`} />
      <SummaryRow label={t("loanPlanner.totalInterest")} value={formatSgd(Math.round(loan.total_interest))} />
      <SummaryRow label={t("loanPlanner.futureScore")} value={loan.future_score} />
      <div className="weddingStatChips">
        <LoanImpactChip impact={loan.emergency_fund_impact} labelKeys={EMERGENCY_FUND_IMPACT_LABEL_KEYS} t={t} />
        <LoanImpactChip impact={loan.other_goals_impact} labelKeys={OTHER_GOALS_IMPACT_LABEL_KEYS} t={t} />
        {loan.modifiers_applied.map((key) => (
          <span className="statChip" key={key}>
            {t(LOAN_MODIFIER_LABEL_KEYS[key] ?? key)}
          </span>
        ))}
      </div>
      <div className="confirmedPlanActions">
        <button type="button" className="secondaryButton" onClick={onChangeStrategy}>
          {t("loanPlanner.changeStrategyLabel")}
        </button>
        {loan.purpose !== "home" ? (
          <button type="button" className="secondaryButton" onClick={onChangeAmount}>
            {t("loanPlanner.changeAmountLabel")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function LoanPurposeSelector({ onSelect, t }) {
  return (
    <section className="settingsGroup">
      <span className="sectionLabel">{t("loanPlanner.purposeSelectLabel")}</span>
      <div className="checkboxGrid">
        {["home", "renovation", "personal"].map((purposeKey) => {
          const Icon = LOAN_PURPOSE_ICONS[purposeKey];
          return (
            <button type="button" className="checkOption weddingEntryOption" key={purposeKey} onClick={() => onSelect(purposeKey)}>
              <Icon size={15} />
              <span>
                {t(LOAN_PURPOSE_LABEL_KEYS[purposeKey])}
                <small style={{ display: "block", fontWeight: 400 }}>{t(LOAN_PURPOSE_DESC_KEYS[purposeKey])}</small>
              </span>
              <span className="weddingEntryTrailing">
                <ChevronRight size={14} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LoanSizingOptionCard({ option, selected, onSelect, t }) {
  return (
    <article className={`weddingPlanTile accent-0${selected ? " recommended" : ""}`}>
      <h3>{option.label}</h3>
      <div className="weddingTotalCost">
        <small>{t("loanPlanner.estimatedAmount")}</small>
        <strong>{formatSgd(Math.round(option.loan_amount_estimate))}</strong>
      </div>
      <p className="weddingPlanSummary">{option.estimate_basis}</p>
      {option.considerations ? <p className="weddingPlanSummary">{option.considerations}</p> : null}
      <button type="button" className={selected ? "primaryButton" : "secondaryButton"} onClick={() => onSelect(option)}>
        {selected ? t("loanPlanner.selected") : t("loanPlanner.selectThisAmount")}
      </button>
    </article>
  );
}

function LoanPlannerContent({ success, setSuccess, t, setActiveScreen, language, profile, initialPurpose, onConsumeInitialPurpose, setMemoryEvents }) {
  const [purpose, setPurpose] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sizingError, setSizingError] = useState(null);
  const [sizingOptions, setSizingOptions] = useState(null);
  const [researchNotes, setResearchNotes] = useState("");
  const [confirmedLoan, setConfirmedLoan] = useState(null);
  const [principalBasis, setPrincipalBasis] = useState(null);
  const [propertyType, setPropertyType] = useState(null);
  const [otherGoalsMonthlyOutflow, setOtherGoalsMonthlyOutflow] = useState(0);
  const [selectedArchetype, setSelectedArchetype] = useState("balanced");
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (initialPurpose) {
      setPurpose(initialPurpose);
      onConsumeInitialPurpose();
    }
  }, [initialPurpose, onConsumeInitialPurpose]);

  const resetToPurposeSelection = () => {
    setPurpose(null);
    setSizingError(null);
    setSizingOptions(null);
    setConfirmedLoan(null);
    setPrincipalBasis(null);
    setPropertyType(null);
    setEditingStrategy(false);
  };

  useEffect(() => {
    if (!purpose) return;
    let cancelled = false;
    setLoading(true);
    setErrorMessage("");
    setSizingError(null);

    async function load() {
      const sessionResponse = await fetch(`/api/loan/session?purpose=${purpose}`);
      const sessionJson = await sessionResponse.json();
      if (cancelled) return;

      if (sessionJson.confirmedLoan) {
        setConfirmedLoan(sessionJson.confirmedLoan);
        setPrincipalBasis(sessionJson.confirmedLoan.principal_basis);
        setPropertyType(sessionJson.confirmedLoan.property_type);
        setSelectedArchetype(sessionJson.confirmedLoan.archetype);
        setSelectedModifiers(sessionJson.confirmedLoan.modifiers_applied ?? []);
        setLoading(false);
        return;
      }

      setSizingOptions(sessionJson.sizingOptions);

      if (purpose === "home") {
        const contextResponse = await fetch("/api/loan/sizing-context?purpose=home");
        if (cancelled) return;
        if (!contextResponse.ok) {
          setSizingError("no_confirmed_home_plan");
          setLoading(false);
          return;
        }
        const contextJson = await contextResponse.json();
        setPrincipalBasis(contextJson.price);
        setPropertyType(contextJson.propertyType);
        setOtherGoalsMonthlyOutflow(contextJson.otherGoalsMonthlyOutflow);
      }

      setLoading(false);
    }

    load().catch(() => {
      if (!cancelled) {
        setErrorMessage(t("loanPlanner.genericError"));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [purpose, t]);

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    fetch(`/api/loan/history?purpose=${purpose}`)
      .then((response) => response.json())
      .then((data) => setHistoryEntries(data.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  };

  const submitSizing = async (message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/loan/stage1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: sizingOptions ? "refine" : "generate", message, language, purpose }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("loanPlanner.genericError"));
        return;
      }
      setSizingOptions(data.data);
      setResearchNotes(data.data.research_notes ?? "");
    } catch {
      setErrorMessage(t("loanPlanner.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const selectSizingOption = async (option) => {
    setPrincipalBasis(option.loan_amount_estimate);
    setLoading(true);
    try {
      const contextResponse = await fetch(`/api/loan/sizing-context?purpose=${purpose}`);
      const contextJson = await contextResponse.json();
      setOtherGoalsMonthlyOutflow(contextJson.otherGoalsMonthlyOutflow ?? 0);
    } catch {
      setOtherGoalsMonthlyOutflow(0);
    } finally {
      setLoading(false);
    }
  };

  const toggleModifier = (key) => {
    setSelectedModifiers((current) => (current.includes(key) ? current.filter((m) => m !== key) : [...current, key]));
  };

  const confirmStrategy = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/loan/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          principalBasis,
          propertyType,
          archetype: selectedArchetype,
          modifiers: selectedModifiers,
          monthlyIncome: numberValue(profile.monthlyIncome, 7500),
          monthlyExpenses: numberValue(profile.monthlyExpenses, 3500),
          currentSavings: numberValue(profile.currentSavings, 20000),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("loanPlanner.genericError"));
        return;
      }
      setConfirmedLoan(data.data);
      setEditingStrategy(false);
      setSuccess();
      const loan = data.data;
      setMemoryEvents((current) => [
        {
          id: `loan-confirmed-${purpose}-${data.confirmedAt ?? Date.now()}`,
          year: new Date(data.confirmedAt ?? Date.now()).getFullYear().toString(),
          title: t("loanPlanner.memoryEventTitle"),
          description: t(`loanPlanner.purposeDescriptions.${purpose}`),
          impact: t("loanPlanner.memoryEventImpact", { amount: formatSgd(Math.round(loan.loan_amount)) }),
          product: t("loanPlanner.memoryEventProduct"),
          action: t("loanPlanner.memoryEventAction"),
          reason: t("loanPlanner.memoryEventReason"),
          dataUsed: t("loanPlanner.memoryEventDataUsed"),
          statusKey: "status.completed",
          confirmedAt: data.confirmedAt ?? null,
        },
        ...current,
      ]);
    } catch {
      setErrorMessage(t("loanPlanner.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const archetypes =
    principalBasis != null
      ? computeAllLoanArchetypes(purpose, {
          principalBasis,
          propertyType,
          monthlyIncome: numberValue(profile.monthlyIncome, 7500),
          monthlyExpenses: numberValue(profile.monthlyExpenses, 3500),
          currentSavings: numberValue(profile.currentSavings, 20000),
          otherGoalsMonthlyOutflow,
        })
      : null;
  const archetypesWithModifiers = archetypes
    ? Object.fromEntries(
        LOAN_ARCHETYPE_KEYS.map((key) => [
          key,
          selectedModifiers.length
            ? applyLoanModifiers(archetypes[key], key === selectedArchetype ? selectedModifiers : [], {
                monthlyIncome: numberValue(profile.monthlyIncome, 7500),
                monthlyExpenses: numberValue(profile.monthlyExpenses, 3500),
                currentSavings: numberValue(profile.currentSavings, 20000),
                otherGoalsMonthlyOutflow,
              })
            : archetypes[key],
        ])
      )
    : null;

  return (
    <Screen>
      <Header title={t("loanPlanner.title")} subtitle={t("loanPlanner.subtitle")} />
      <div className="weddingTopRow">
        <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />
        {purpose ? (
          <button type="button" className="historyButton" onClick={openHistory} aria-label={t("loanPlanner.historyTitle")}>
            <History size={16} />
          </button>
        ) : null}
      </div>
      {historyOpen ? (
        <ConversationHistoryModal
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
          t={t}
          titleKey="loanPlanner.historyTitle"
          emptyKey="loanPlanner.historyEmpty"
        />
      ) : null}
      <SuccessBanner show={success} text={t("loanPlanner.success")} />
      {errorMessage ? (
        <section className="adviceOnlyPanel">
          <AlertTriangle size={18} />
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!purpose ? (
        <LoanPurposeSelector onSelect={setPurpose} t={t} />
      ) : loading ? (
        <p>{t("loading.detail")}</p>
      ) : sizingError === "no_confirmed_home_plan" ? (
        <section className="needHeroCard">
          <span className="sectionLabel">{t("loanPlanner.needHomePlanLabel")}</span>
          <p>{t("loanPlanner.needHomePlanBody")}</p>
          <button type="button" className="primaryButton" onClick={() => setActiveScreen(screens.NEED_HOME)}>
            {t("loanPlanner.goToHomePlanner")}
          </button>
          <button type="button" className="secondaryButton" onClick={resetToPurposeSelection}>
            {t("loanPlanner.backToPurposes")}
          </button>
        </section>
      ) : confirmedLoan && !editingStrategy ? (
        <LoanConfirmedCard
          loan={confirmedLoan}
          onChangeStrategy={() => setEditingStrategy(true)}
          onChangeAmount={() => {
            setConfirmedLoan(null);
            setPrincipalBasis(null);
            setSizingOptions(null);
          }}
          t={t}
        />
      ) : principalBasis != null ? (
        <>
          <LoanStrategySelector
            archetypes={archetypesWithModifiers}
            selectedArchetype={selectedArchetype}
            onSelectArchetype={setSelectedArchetype}
            selectedModifiers={selectedModifiers}
            onToggleModifier={toggleModifier}
            t={t}
          />
          <button type="button" className="primaryButton" onClick={confirmStrategy} disabled={submitting}>
            {submitting ? t("loanPlanner.thinking") : t("loanPlanner.confirmStrategy")}
            <Check size={18} />
          </button>
          <button type="button" className="secondaryButton" onClick={() => setEditingStrategy(false)}>
            {t("loanPlanner.cancelEdit")}
          </button>
        </>
      ) : sizingOptions ? (
        <>
          <section className="weddingPlanCarouselWrap">
            <span className="sectionLabel">{t("loanPlanner.sizingLabel")}</span>
            <div className="weddingPlanCarousel">
              {sizingOptions.sizing_options.map((option) => (
                <LoanSizingOptionCard key={option.id} option={option} selected={false} onSelect={selectSizingOption} t={t} />
              ))}
            </div>
            {researchNotes || sizingOptions.research_notes ? (
              <section className="insightCard">
                <Bot size={20} />
                <p>{researchNotes || sizingOptions.research_notes}</p>
              </section>
            ) : null}
          </section>
          <AiTextInputCard
            t={t}
            onSubmit={submitSizing}
            submitting={submitting}
            placeholder={t("loanPlanner.sizingRefinePlaceholder")}
            submitLabelKey="weddingPlanner.send"
            labelKey="loanPlanner.sizingRefineLabel"
          />
        </>
      ) : (
        <AiTextInputCard
          t={t}
          onSubmit={submitSizing}
          submitting={submitting}
          placeholder={t(`loanPlanner.sizingPlaceholders.${purpose}`)}
          submitLabelKey="weddingPlanner.sendFirst"
          labelKey="loanPlanner.sizingInputLabel"
        />
      )}
    </Screen>
  );
}

const RISK_LABEL_KEYS = {
  conservative: "investmentPlanner.riskOptions.conservative.label",
  balanced: "investmentPlanner.riskOptions.balanced.label",
  growth: "investmentPlanner.riskOptions.growth.label",
};
const RISK_DESC_KEYS = {
  conservative: "investmentPlanner.riskOptions.conservative.description",
  balanced: "investmentPlanner.riskOptions.balanced.description",
  growth: "investmentPlanner.riskOptions.growth.description",
};
const RISK_ICONS = { conservative: ShieldCheck, balanced: Target, growth: LineChart };

const INVESTMENT_GOAL_CATEGORIES = ["retirement_gap", "general_wealth_building", "custom_target"];
const GOAL_CATEGORY_LABEL_KEYS = {
  retirement_gap: "investmentPlanner.goalCategories.retirementGap.label",
  general_wealth_building: "investmentPlanner.goalCategories.generalWealthBuilding.label",
  custom_target: "investmentPlanner.goalCategories.customTarget.label",
};
const GOAL_CATEGORY_DESC_KEYS = {
  retirement_gap: "investmentPlanner.goalCategories.retirementGap.description",
  general_wealth_building: "investmentPlanner.goalCategories.generalWealthBuilding.description",
  custom_target: "investmentPlanner.goalCategories.customTarget.description",
};
const GOAL_CATEGORY_ICONS = { retirement_gap: Landmark, general_wealth_building: Globe2, custom_target: ClipboardCheck };

const HOLDINGS_LABEL_KEYS = {
  sg_equities: "investmentPlanner.holdingsCategories.sgEquities",
  global_equities: "investmentPlanner.holdingsCategories.globalEquities",
  bonds: "investmentPlanner.holdingsCategories.bonds",
  reits: "investmentPlanner.holdingsCategories.reits",
  cash_like: "investmentPlanner.holdingsCategories.cashLike",
};
const HOLDINGS_ICONS = { sg_equities: Building2, global_equities: Globe2, bonds: ShieldCheck, reits: Home, cash_like: PiggyBank };

const PURCHASE_MODE_LABEL_KEYS = {
  monthly_rsp: "investmentPlanner.purchaseModes.monthlyRsp.label",
  lump_sum: "investmentPlanner.purchaseModes.lumpSum.label",
  daily_micro_dca: "investmentPlanner.purchaseModes.dailyMicroDca.label",
  value_averaging: "investmentPlanner.purchaseModes.valueAveraging.label",
};
const PURCHASE_MODE_DESC_KEYS = {
  monthly_rsp: "investmentPlanner.purchaseModes.monthlyRsp.description",
  lump_sum: "investmentPlanner.purchaseModes.lumpSum.description",
  daily_micro_dca: "investmentPlanner.purchaseModes.dailyMicroDca.description",
  value_averaging: "investmentPlanner.purchaseModes.valueAveraging.description",
};
const PURCHASE_MODE_ICONS = { monthly_rsp: CalendarClock, lump_sum: PiggyBank, daily_micro_dca: ArrowLeftRight, value_averaging: SlidersHorizontal };

const INVESTMENT_EMERGENCY_FUND_IMPACT_LABEL_KEYS = {
  protected: "investmentPlanner.emergencyFundImpact.protected",
  healthy: "investmentPlanner.emergencyFundImpact.healthy",
  reduced: "investmentPlanner.emergencyFundImpact.reduced",
  weak: "investmentPlanner.emergencyFundImpact.weak",
};
const INVESTMENT_CASHFLOW_IMPACT_LABEL_KEYS = {
  on_track: "investmentPlanner.cashflowImpact.onTrack",
  tight: "investmentPlanner.cashflowImpact.tight",
  at_risk: "investmentPlanner.cashflowImpact.atRisk",
};

// profile.riskPreference is a free capitalized string ("Balanced") separate
// from the simulator's own lowercase riskPreference enum — reconciles that
// inconsistency at the one place Investment Planner reads it, rather than
// touching the shared profile shape.
function normalizeRiskPreference(value) {
  const lower = String(value ?? "").toLowerCase();
  return RISK_BANDS.includes(lower) ? lower : "balanced";
}

function InvestmentIntakeForm({
  riskPreference,
  setRiskPreference,
  goalCategory,
  setGoalCategory,
  horizonYears,
  setHorizonYears,
  customTargetAmount,
  setCustomTargetAmount,
  holdingsCategories,
  onToggleHolding,
  purchaseMode,
  setPurchaseMode,
  availableMonthlyCashflow,
  hasRetirementGoal,
  onSubmit,
  submitting,
  t,
}) {
  const goalCategoryOptions = hasRetirementGoal
    ? INVESTMENT_GOAL_CATEGORIES
    : INVESTMENT_GOAL_CATEGORIES.filter((key) => key !== "retirement_gap");

  return (
    <section className="settingsGroup">
      <section className="trustNote compactTrustNote">
        <Info size={17} />
        <p>{t("investmentPlanner.availableCashflowNote", { amount: formatSgd(Math.round(availableMonthlyCashflow)) })}</p>
      </section>

      <span className="sectionLabel">{t("investmentPlanner.riskLabel")}</span>
      <div className="checkboxGrid">
        {RISK_BANDS.map((key) => {
          const Icon = RISK_ICONS[key];
          return (
            <button
              type="button"
              key={key}
              className={riskPreference === key ? "checkOption selected" : "checkOption"}
              onClick={() => setRiskPreference(key)}
            >
              <Icon size={15} />
              <span>
                {t(RISK_LABEL_KEYS[key])}
                <small style={{ display: "block", fontWeight: 400 }}>{t(RISK_DESC_KEYS[key])}</small>
              </span>
              {riskPreference === key ? <Check size={14} /> : null}
            </button>
          );
        })}
      </div>

      <span className="sectionLabel">{t("investmentPlanner.goalCategoryLabel")}</span>
      <div className="checkboxGrid">
        {goalCategoryOptions.map((key) => {
          const Icon = GOAL_CATEGORY_ICONS[key];
          return (
            <button
              type="button"
              key={key}
              className={goalCategory === key ? "checkOption selected" : "checkOption"}
              onClick={() => setGoalCategory(key)}
            >
              <Icon size={15} />
              <span>
                {t(GOAL_CATEGORY_LABEL_KEYS[key])}
                <small style={{ display: "block", fontWeight: 400 }}>{t(GOAL_CATEGORY_DESC_KEYS[key])}</small>
              </span>
              {goalCategory === key ? <Check size={14} /> : null}
            </button>
          );
        })}
      </div>

      <span className="sectionLabel">{t("investmentPlanner.horizonYearsLabel")}</span>
      <input
        type="number"
        min="1"
        max="50"
        className="aiTextInput"
        value={horizonYears}
        onChange={(event) => setHorizonYears(event.target.value)}
        aria-label={t("investmentPlanner.horizonYearsLabel")}
      />

      {goalCategory === "custom_target" ? (
        <>
          <span className="sectionLabel">{t("investmentPlanner.customTargetAmountLabel")}</span>
          <input
            type="number"
            min="0"
            className="aiTextInput"
            value={customTargetAmount}
            onChange={(event) => setCustomTargetAmount(event.target.value)}
            aria-label={t("investmentPlanner.customTargetAmountLabel")}
          />
        </>
      ) : null}

      <span className="sectionLabel">{t("investmentPlanner.holdingsLabel")}</span>
      <div className="checkboxGrid">
        {HOLDINGS_CATEGORIES.map((key) => {
          const Icon = HOLDINGS_ICONS[key];
          const active = holdingsCategories.includes(key);
          return (
            <button type="button" key={key} className={active ? "checkOption selected" : "checkOption"} onClick={() => onToggleHolding(key)}>
              <Icon size={15} />
              <span>{t(HOLDINGS_LABEL_KEYS[key])}</span>
              {active ? <Check size={14} /> : null}
            </button>
          );
        })}
      </div>

      <span className="sectionLabel">{t("investmentPlanner.purchaseModeLabel")}</span>
      <div className="checkboxGrid">
        {PURCHASE_MODES.map((key) => {
          const Icon = PURCHASE_MODE_ICONS[key];
          return (
            <button
              type="button"
              key={key}
              className={purchaseMode === key ? "checkOption selected" : "checkOption"}
              onClick={() => setPurchaseMode(key)}
            >
              <Icon size={15} />
              <span>
                {t(PURCHASE_MODE_LABEL_KEYS[key])}
                <small style={{ display: "block", fontWeight: 400 }}>{t(PURCHASE_MODE_DESC_KEYS[key])}</small>
              </span>
              {purchaseMode === key ? <Check size={14} /> : null}
            </button>
          );
        })}
      </div>
      {purchaseMode === "value_averaging" ? (
        <section className="trustNote compactTrustNote">
          <Info size={17} />
          <p>{t("investmentPlanner.valueAveragingDisclaimer")}</p>
        </section>
      ) : null}

      <button type="button" className="primaryButton" disabled={submitting} onClick={onSubmit}>
        {submitting ? t("investmentPlanner.thinking") : t("investmentPlanner.submitIntake")}
        <Check size={18} />
      </button>
    </section>
  );
}

function InvestmentShortlistCard({
  item,
  narrative,
  purchaseMode,
  horizonYears,
  previewAmount,
  selected,
  onSelect,
  selectionAmount,
  setSelectionAmount,
  selectionHorizonYears,
  setSelectionHorizonYears,
  onConfirm,
  submitting,
  accentIndex,
  t,
}) {
  const InstrumentIcon = item.instrument_type === "fund" ? LineChart : CircleDollarSign;
  const displayAmount = selected ? numberValue(selectionAmount, previewAmount) : previewAmount;
  const displayHorizon = selected ? numberValue(selectionHorizonYears, horizonYears) : horizonYears;
  const projection = projectPurchaseMode({
    mode: purchaseMode,
    entry: { expectedAnnualReturnPercent: item.expected_annual_return_percent },
    amount: displayAmount,
    horizonYears: displayHorizon,
  });

  return (
    <article className={`weddingPlanTile accent-${accentIndex}${selected ? " recommended" : ""}`}>
      <h3>
        <InstrumentIcon size={16} /> {item.name}
      </h3>
      {item.ticker ? <p className="weddingPlanSummary">{item.ticker}</p> : null}
      <div className="weddingStatChips">
        <span className="statChip">{t(item.market === "sg" ? "investmentPlanner.marketLabels.sg" : "investmentPlanner.marketLabels.global")}</span>
        <span className="statChip">
          {t(item.instrument_type === "fund" ? "investmentPlanner.instrumentTypeLabels.fund" : "investmentPlanner.instrumentTypeLabels.stock")}
        </span>
      </div>
      <p className="weddingPlanSummary">{t(item.description_key)}</p>
      <SummaryRow label={t("investmentPlanner.expectedReturnLabel")} value={`${item.expected_annual_return_percent}%`} />
      {item.expense_ratio_percent != null ? (
        <SummaryRow label={t("investmentPlanner.expenseRatioLabel")} value={`${item.expense_ratio_percent}%`} />
      ) : null}
      {item.dividend_yield_percent != null ? (
        <SummaryRow label={t("investmentPlanner.dividendYieldLabel")} value={`${item.dividend_yield_percent}%`} />
      ) : null}

      <div className="weddingTotalCost">
        <small>{t("investmentPlanner.projectedEndValueLabel")}</small>
        <strong>{formatSgd(Math.round(projection.projectedEndValue))}</strong>
      </div>
      <SummaryRow label={t("investmentPlanner.totalContributedLabel")} value={formatSgd(Math.round(projection.totalContributed))} />
      <SummaryRow label={t("investmentPlanner.projectedGrowthLabel")} value={formatSgd(Math.round(projection.projectedGrowth))} />
      {purchaseMode === "value_averaging" && projection.schedule ? (
        <p className="weddingCarouselHint">
          {t("investmentPlanner.valueAveragingScheduleHint", {
            first: formatSgd(Math.round(projection.schedule[0]?.contribution ?? 0)),
            last: formatSgd(Math.round(projection.schedule[projection.schedule.length - 1]?.contribution ?? 0)),
          })}
        </p>
      ) : null}
      {purchaseMode === "daily_micro_dca" && projection.monthlyEquivalentAmount != null ? (
        <p className="weddingCarouselHint">
          {t("investmentPlanner.dailyMonthlyEquivalentHint", { amount: formatSgd(Math.round(projection.monthlyEquivalentAmount)) })}
        </p>
      ) : null}
      {!narrative && item.disclosure_key ? <p className="weddingCarouselHint">{t(item.disclosure_key)}</p> : null}

      {narrative ? (
        <>
          <p className="weddingPlanSummary">
            <strong>{t("investmentPlanner.whyRecommendedLabel")}</strong> {narrative.why_recommended}
          </p>
          <p className="weddingPlanSummary">
            <strong>{t("investmentPlanner.purchaseModeCommentaryLabel")}</strong> {narrative.purchase_mode_commentary}
          </p>
          <p className="weddingPlanSummary">
            <strong>{t("investmentPlanner.riskDisclosureLabel")}</strong> {narrative.risk_disclosure}
          </p>
        </>
      ) : null}

      {selected ? (
        <>
          <span className="sectionLabel">{t("investmentPlanner.amountLabel")}</span>
          <input
            type="number"
            min="0"
            className="aiTextInput"
            value={selectionAmount}
            onChange={(event) => setSelectionAmount(event.target.value)}
            aria-label={t("investmentPlanner.amountLabel")}
          />
          <span className="sectionLabel">{t("investmentPlanner.horizonLabel")}</span>
          <input
            type="number"
            min="1"
            max="50"
            className="aiTextInput"
            value={selectionHorizonYears}
            onChange={(event) => setSelectionHorizonYears(event.target.value)}
            aria-label={t("investmentPlanner.horizonLabel")}
          />
          <button type="button" className="primaryButton" disabled={submitting} onClick={onConfirm}>
            {submitting ? t("investmentPlanner.thinking") : t("investmentPlanner.confirmPick")}
            <Check size={18} />
          </button>
        </>
      ) : (
        <button type="button" className="secondaryButton" onClick={onSelect}>
          {t("investmentPlanner.selectThisInstrument")}
        </button>
      )}
    </article>
  );
}

function InvestmentConfirmedCard({ pick, t }) {
  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("investmentPlanner.confirmedLabel")}</span>
      <div className="weddingTotalCost">
        <small>
          {pick.name}
          {pick.ticker ? ` (${pick.ticker})` : ""}
        </small>
        <strong>{formatSgd(Math.round(pick.projection.projectedEndValue))}</strong>
      </div>
      <SummaryRow label={t("investmentPlanner.purchaseModeLabel")} value={t(PURCHASE_MODE_LABEL_KEYS[pick.purchase_mode] ?? pick.purchase_mode)} />
      <SummaryRow label={t("investmentPlanner.amountLabel")} value={formatSgd(Math.round(pick.amount))} />
      <SummaryRow label={t("investmentPlanner.horizonLabel")} value={`${pick.horizon_years}y`} />
      <SummaryRow label={t("investmentPlanner.totalContributedLabel")} value={formatSgd(Math.round(pick.projection.totalContributed))} />
      <SummaryRow label={t("investmentPlanner.projectedGrowthLabel")} value={formatSgd(Math.round(pick.projection.projectedGrowth))} />
      <SummaryRow label={t("investmentPlanner.futureScoreLabel")} value={pick.future_score} />
      <div className="weddingStatChips">
        <LoanImpactChip impact={pick.emergency_fund_impact} labelKeys={INVESTMENT_EMERGENCY_FUND_IMPACT_LABEL_KEYS} t={t} />
        <LoanImpactChip impact={pick.cashflow_impact} labelKeys={INVESTMENT_CASHFLOW_IMPACT_LABEL_KEYS} t={t} />
      </div>
    </section>
  );
}

function InvestmentPlannerContent({ success, setSuccess, t, setActiveScreen, language, profile, setMemoryEvents }) {
  const [stage, setStage] = useState("intake");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [riskPreference, setRiskPreference] = useState(() => normalizeRiskPreference(profile.riskPreference));
  const [goalCategory, setGoalCategory] = useState("general_wealth_building");
  const [horizonYears, setHorizonYears] = useState("10");
  const [customTargetAmount, setCustomTargetAmount] = useState("");
  const [holdingsCategories, setHoldingsCategories] = useState([]);
  const [purchaseMode, setPurchaseMode] = useState("monthly_rsp");

  const [availableMonthlyCashflow, setAvailableMonthlyCashflow] = useState(0);

  const [shortlist, setShortlist] = useState(null);
  const [previewAmount, setPreviewAmount] = useState(0);
  const [narrative, setNarrative] = useState(null);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [selectionAmount, setSelectionAmount] = useState("");
  const [selectionHorizonYears, setSelectionHorizonYears] = useState("");

  const [confirmedPicks, setConfirmedPicks] = useState([]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage("");

    async function load() {
      const [contextResponse, sessionResponse] = await Promise.all([fetch("/api/investment/context"), fetch("/api/investment/session")]);
      const contextJson = await contextResponse.json();
      const sessionJson = await sessionResponse.json();
      if (cancelled) return;

      const income = numberValue(profile.monthlyIncome, 7500);
      const expenses = numberValue(profile.monthlyExpenses, 3500);
      setAvailableMonthlyCashflow(Math.max(0, income - expenses - (contextJson.otherGoalsMonthlyOutflow ?? 0)));

      if (sessionJson.intake) {
        setRiskPreference(sessionJson.intake.riskPreference);
        setGoalCategory(sessionJson.intake.goalCategory);
        setHorizonYears(String(sessionJson.intake.horizonYears));
        setCustomTargetAmount(sessionJson.intake.customTargetAmount != null ? String(sessionJson.intake.customTargetAmount) : "");
        setHoldingsCategories(sessionJson.intake.holdingsCategories ?? []);
        setPurchaseMode(sessionJson.intake.purchaseMode);
      }
      if (sessionJson.shortlist) {
        setShortlist(sessionJson.shortlist.items);
        setPreviewAmount(sessionJson.shortlist.previewAmount);
      }
      if (sessionJson.narrative) {
        setNarrative(sessionJson.narrative);
      }
      if (sessionJson.confirmedPicks?.length) {
        setConfirmedPicks(sessionJson.confirmedPicks);
        setStage("confirmed");
      } else if (sessionJson.shortlist) {
        setStage("shortlist");
      }

      setLoading(false);
    }

    load().catch(() => {
      if (!cancelled) {
        setErrorMessage(t("investmentPlanner.genericError"));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const toggleHoldingCategory = (key) => {
    setHoldingsCategories((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const submitIntake = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/investment/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskPreference,
          goalCategory,
          horizonYears: numberValue(horizonYears, 10),
          customTargetAmount: goalCategory === "custom_target" ? numberValue(customTargetAmount, 0) || undefined : undefined,
          holdingsCategories,
          purchaseMode,
          monthlyIncome: numberValue(profile.monthlyIncome, 7500),
          monthlyExpenses: numberValue(profile.monthlyExpenses, 3500),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("investmentPlanner.genericError"));
        return;
      }
      setShortlist(data.shortlist);
      setPreviewAmount(data.previewAmount);
      setAvailableMonthlyCashflow(data.availableMonthlyCashflow);
      setNarrative(null);
      setSelectedEntryId(null);
      setStage("shortlist");
    } catch {
      setErrorMessage(t("investmentPlanner.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const requestNarrative = async (message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/investment/stage1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: narrative ? "refine" : "generate", message, language }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("investmentPlanner.genericError"));
        return;
      }
      setNarrative(data.data);
    } catch {
      setErrorMessage(t("investmentPlanner.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const selectEntry = (item) => {
    setSelectedEntryId(item.entry_id);
    setSelectionAmount(String(previewAmount));
    setSelectionHorizonYears(String(horizonYears));
  };

  const confirmPick = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/investment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: selectedEntryId,
          purchaseMode,
          amount: numberValue(selectionAmount, previewAmount),
          horizonYears: numberValue(selectionHorizonYears, horizonYears),
          monthlyIncome: numberValue(profile.monthlyIncome, 7500),
          monthlyExpenses: numberValue(profile.monthlyExpenses, 3500),
          currentSavings: numberValue(profile.currentSavings, 20000),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("investmentPlanner.genericError"));
        return;
      }
      setConfirmedPicks((current) => [...current, data.data]);
      setSelectedEntryId(null);
      setSuccess();
      setStage("confirmed");
      const pick = data.data;
      setMemoryEvents((current) => [
        {
          id: `investment-confirmed-${pick.entry_id}-${data.confirmedAt ?? Date.now()}`,
          year: new Date(data.confirmedAt ?? Date.now()).getFullYear().toString(),
          title: t("investmentPlanner.memoryEventTitle"),
          description: t(pick.instrument_type === "fund" ? "investmentPlanner.instrumentTypeLabels.fund" : "investmentPlanner.instrumentTypeLabels.stock") + ` – ${pick.name}`,
          impact: t("investmentPlanner.memoryEventImpact", { amount: formatSgd(Math.round(pick.amount)) }),
          product: t("investmentPlanner.memoryEventProduct"),
          action: t("investmentPlanner.memoryEventAction"),
          reason: t("investmentPlanner.memoryEventReason"),
          dataUsed: t("investmentPlanner.memoryEventDataUsed"),
          statusKey: "status.completed",
          confirmedAt: data.confirmedAt ?? null,
        },
        ...current,
      ]);
    } catch {
      setErrorMessage(t("investmentPlanner.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    fetch("/api/investment/history")
      .then((response) => response.json())
      .then((data) => setHistoryEntries(data.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  };

  const addAnotherInstrument = () => {
    setSelectedEntryId(null);
    setStage(shortlist ? "shortlist" : "intake");
  };

  return (
    <Screen>
      <Header title={t("investmentPlanner.title")} subtitle={t("investmentPlanner.subtitle")} />
      <div className="weddingTopRow">
        <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />
        <button type="button" className="historyButton" onClick={openHistory} aria-label={t("investmentPlanner.historyTitle")}>
          <History size={16} />
        </button>
      </div>
      {historyOpen ? (
        <ConversationHistoryModal
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
          t={t}
          titleKey="investmentPlanner.historyTitle"
          emptyKey="investmentPlanner.historyEmpty"
        />
      ) : null}
      <SuccessBanner show={success} text={t("investmentPlanner.success")} />
      {errorMessage ? (
        <section className="adviceOnlyPanel">
          <AlertTriangle size={18} />
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {loading ? (
        <p>{t("loading.detail")}</p>
      ) : stage === "confirmed" ? (
        <>
          {confirmedPicks.map((pick, index) => (
            <InvestmentConfirmedCard key={`${pick.entry_id}-${index}`} pick={pick} t={t} />
          ))}
          <button type="button" className="secondaryButton" onClick={addAnotherInstrument}>
            {t("investmentPlanner.addAnotherPick")}
          </button>
        </>
      ) : stage === "shortlist" && shortlist ? (
        <>
          <section className="trustNote compactTrustNote">
            <Info size={17} />
            <p>{t("investmentPlanner.availableCashflowNote", { amount: formatSgd(Math.round(availableMonthlyCashflow)) })}</p>
          </section>
          <section className="weddingPlanCarouselWrap">
            <span className="sectionLabel">{t("investmentPlanner.shortlistLabel")}</span>
            <div className="weddingPlanCarousel">
              {shortlist.map((item, index) => (
                <InvestmentShortlistCard
                  key={item.entry_id}
                  item={item}
                  narrative={narrative?.narratives?.find((entry) => entry.entry_id === item.entry_id)}
                  purchaseMode={purchaseMode}
                  horizonYears={numberValue(horizonYears, 10)}
                  previewAmount={previewAmount}
                  selected={selectedEntryId === item.entry_id}
                  onSelect={() => selectEntry(item)}
                  selectionAmount={selectionAmount}
                  setSelectionAmount={setSelectionAmount}
                  selectionHorizonYears={selectionHorizonYears}
                  setSelectionHorizonYears={setSelectionHorizonYears}
                  onConfirm={confirmPick}
                  submitting={submitting}
                  accentIndex={index % 3}
                  t={t}
                />
              ))}
            </div>
            {narrative?.portfolio_overview ? (
              <section className="insightCard">
                <Bot size={20} />
                <p>{narrative.portfolio_overview}</p>
              </section>
            ) : null}
          </section>
          {!narrative ? (
            <button
              type="button"
              className="primaryButton"
              disabled={submitting}
              onClick={() => requestNarrative("Please explain these investment recommendations.")}
            >
              {submitting ? t("investmentPlanner.thinking") : t("investmentPlanner.explainRecommendations")}
              <Bot size={18} />
            </button>
          ) : (
            <AiTextInputCard
              t={t}
              onSubmit={requestNarrative}
              submitting={submitting}
              placeholder={t("investmentPlanner.refinePlaceholder")}
              submitLabelKey="weddingPlanner.send"
              labelKey="investmentPlanner.refineLabel"
            />
          )}
          <button type="button" className="secondaryButton" onClick={() => setStage("intake")}>
            {t("investmentPlanner.changeIntakeLabel")}
          </button>
        </>
      ) : (
        <InvestmentIntakeForm
          riskPreference={riskPreference}
          setRiskPreference={setRiskPreference}
          goalCategory={goalCategory}
          setGoalCategory={setGoalCategory}
          horizonYears={horizonYears}
          setHorizonYears={setHorizonYears}
          customTargetAmount={customTargetAmount}
          setCustomTargetAmount={setCustomTargetAmount}
          holdingsCategories={holdingsCategories}
          onToggleHolding={toggleHoldingCategory}
          purchaseMode={purchaseMode}
          setPurchaseMode={setPurchaseMode}
          availableMonthlyCashflow={availableMonthlyCashflow}
          hasRetirementGoal={Boolean(profile.goals?.retirement)}
          onSubmit={submitIntake}
          submitting={submitting}
          t={t}
        />
      )}
    </Screen>
  );
}

function EmergencyNeedContent({ success, setSuccess, t, setActiveScreen, language, preferences, setPreferences, profile, healthScores, setMemoryEvents }) {
  const readinessScore = healthScores.find((score) => score.id === "emergency")?.value ?? 80;
  const currentFund = numberValue(profile.currentSavings, 18000);
  const monthlyExpenses = numberValue(profile.monthlyExpenses, 3000);
  const recommendedFund = monthlyExpenses * 6;
  const currentCoverageMonths = monthlyExpenses > 0 ? Math.round((currentFund / monthlyExpenses) * 10) / 10 : 0;
  const statusKey =
    readinessScore >= 80 ? "needDetails.emergency.statusValue" : readinessScore >= 60 ? "status.monitoring" : "status.review";

  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedActionIds, setSelectedActionIds] = useState([]);
  const [applyResults, setApplyResults] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Snapshot once at mount rather than reading the live preference: the
  // marker gets cleared (below) right after mount so future generic visits
  // don't show stale "Guardian flagged you" copy, but this visit's banner
  // should keep showing it for as long as the customer is on this screen.
  const [guardianTriggered] = useState(() => preferences?.hardshipEntryPoint === "guardianAtRisk");

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    fetch("/api/hardship/history")
      .then((response) => response.json())
      .then((data) => setHistoryEntries(data.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hardship/session")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setSessionData(data);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage(t("needDetails.emergency.genericError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    if (preferences?.hardshipEntryPoint === "guardianAtRisk") {
      setPreferences((current) => ({ ...current, hardshipEntryPoint: null }));
    }
    return () => {
      cancelled = true;
    };
  }, [t]);

  const runProposeActions = async () => {
    const proposeResponse = await fetch("/api/hardship/propose-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Please propose a recovery plan based on my situation.",
        language,
        profile: { monthlyIncome: profile.monthlyIncome, monthlyExpenses: profile.monthlyExpenses, currentSavings: profile.currentSavings },
      }),
    });
    const proposeData = await proposeResponse.json();
    if (!proposeResponse.ok) {
      setErrorMessage(t("needDetails.emergency.genericError"));
      return;
    }
    setSessionData((current) => ({ ...current, proposedActions: proposeData.data }));
    // Don't pre-select actions the AI itself flagged as needing human/banker
    // review before anything happens - the customer must opt in explicitly.
    setSelectedActionIds(
      proposeData.data.actions.filter((action) => !action.suitability?.human_review_required).map((action) => action.id)
    );
  };

  const submitAssessment = async (message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const assessResponse = await fetch("/api/hardship/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, language }),
      });
      const assessData = await assessResponse.json();
      if (!assessResponse.ok) {
        setErrorMessage(t("needDetails.emergency.genericError"));
        return;
      }
      setSessionData((current) => ({ ...current, assessment: assessData.data }));
      await runProposeActions();
    } catch {
      setErrorMessage(t("needDetails.emergency.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const retryProposeActions = async () => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      await runProposeActions();
    } catch {
      setErrorMessage(t("needDetails.emergency.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActionSelected = (actionId) => {
    setSelectedActionIds((current) =>
      current.includes(actionId) ? current.filter((id) => id !== actionId) : [...current, actionId]
    );
  };

  const applyRecoveryPlan = async () => {
    if (!selectedActionIds.length) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/hardship/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedActionIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("needDetails.emergency.genericError"));
        return;
      }
      setApplyResults(data.results);
      const drawdownTotal = data.results
        .filter((r) => r.action_type === "drawdown_emergency_fund" && r.status === "applied")
        .reduce((sum, r) => sum + (r.result?.amount ?? 0), 0);
      if (drawdownTotal > 0) {
        setPreferences((current) => ({
          ...current,
          profile: { ...current.profile, currentSavings: String(Math.max(0, currentFund - drawdownTotal)) },
        }));
      }
      setSuccess();
      const appliedNow = data.results.filter((r) => r.status === "applied");
      if (appliedNow.length > 0) {
        const confirmedAt = new Date().toISOString();
        setMemoryEvents((current) => [
          {
            id: `hardship-recovery-${confirmedAt}`,
            year: new Date(confirmedAt).getFullYear().toString(),
            title: t("needDetails.emergency.memoryEventTitle"),
            description: appliedNow.map((r) => r.explanation).filter(Boolean).join(" "),
            impact: t("needDetails.emergency.memoryEventImpact", { count: appliedNow.length }),
            product: t("needDetails.emergency.memoryEventProduct"),
            action: t("needDetails.emergency.memoryEventAction"),
            reason: t("needDetails.emergency.memoryEventReason"),
            dataUsed: t("needDetails.emergency.memoryEventDataUsed"),
            statusKey: "status.completed",
            confirmedAt,
          },
          ...current,
        ]);
      }
    } catch {
      setErrorMessage(t("needDetails.emergency.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const hasAssessment = Boolean(sessionData?.assessment);
  const proposedActions = sessionData?.proposedActions?.actions ?? null;
  const appliedActions = sessionData?.appliedActions ?? [];
  const displayedActions = applyResults ?? appliedActions;
  const stuckAfterAssessment = hasAssessment && !proposedActions && !applyResults;

  return (
    <Screen>
      <Header title={t("needDetails.emergency.title")} subtitle={t("needDetails.emergency.subtitle")} />
      <div className="weddingTopRow">
        <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />
        <button type="button" className="historyButton" onClick={openHistory} aria-label={t("needDetails.emergency.historyTitle")}>
          <History size={16} />
        </button>
      </div>
      {historyOpen ? (
        <ConversationHistoryModal
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
          t={t}
          titleKey="needDetails.emergency.historyTitle"
          emptyKey="needDetails.emergency.historyEmpty"
        />
      ) : null}
      <SuccessBanner show={success} text={t("needDetails.emergency.success")} />
      <ProgressPanel
        label={t("needDetails.emergency.score")}
        value={readinessScore}
        t={t}
        body={t("needDetails.emergency.scoreBody", { score: readinessScore, months: currentCoverageMonths, fund: formatSgd(currentFund) })}
        methodText={t("needDetails.emergency.scoreMethod", { recommendedFund: formatSgd(recommendedFund) })}
      />
      <section className="metricGrid">
        <MetricCard label={t("needDetails.emergency.currentFund")} value={formatSgd(currentFund)} />
        <MetricCard label={t("needDetails.emergency.recommendedFund")} value={formatSgd(recommendedFund)} />
        <MetricCard label={t("needDetails.emergency.currentCoverage")} value={t("needDetails.emergency.monthsValue", { months: currentCoverageMonths })} />
        <MetricCard label={t("needDetails.emergency.recommendedCoverage")} value={t("needDetails.emergency.months6")} />
        <MetricCard label={t("needDetails.emergency.status")} value={t(statusKey)} wide />
      </section>

      {loading ? (
        <p>{t("loading.detail")}</p>
      ) : (
        <>
          <section className="needHeroCard">
            <span className="sectionLabel">
              {guardianTriggered ? t("needDetails.emergency.guardianTriggeredLabel") : t("needDetails.emergency.hardshipCtaLabel")}
            </span>
            <p>{t("needDetails.emergency.hardshipCtaBody")}</p>
          </section>

          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}

          {!hasAssessment ? (
            <AiTextInputCard
              t={t}
              onSubmit={submitAssessment}
              submitting={submitting}
              placeholder={t("needDetails.emergency.hardshipInputPlaceholder")}
              submitLabelKey="needDetails.emergency.hardshipSendLabel"
              labelKey="needDetails.emergency.hardshipInputLabel"
            />
          ) : stuckAfterAssessment ? (
            <button type="button" className="secondaryButton" onClick={retryProposeActions} disabled={submitting}>
              {submitting ? t("weddingPlanner.thinking") : t("needDetails.emergency.retryButton")}
            </button>
          ) : proposedActions && !applyResults && sessionData?.stage2Status !== "applied" ? (
            <>
              <span className="sectionLabel">{t("needDetails.emergency.actionsLabel")}</span>
              <p>{sessionData.proposedActions.summary_note}</p>
              <div className="checkboxGrid">
                {proposedActions.map((action) => (
                  <RecoveryActionCard
                    key={action.id}
                    action={action}
                    selected={selectedActionIds.includes(action.id)}
                    onToggle={toggleActionSelected}
                    t={t}
                  />
                ))}
              </div>
              <button type="button" className="primaryButton" onClick={applyRecoveryPlan} disabled={submitting || !selectedActionIds.length}>
                {submitting ? t("weddingPlanner.thinking") : t("needDetails.emergency.applyButton")}
                <Check size={18} />
              </button>
            </>
          ) : null}

          {displayedActions.length > 0 ? (
            <>
              <span className="sectionLabel">{t("needDetails.emergency.appliedLabel")}</span>
              <div className="weddingLineItems">
                {displayedActions.map((entry) => (
                  <SummaryRow
                    key={entry.id}
                    label={
                      entry.status === "failed"
                        ? `${t("needDetails.emergency.actionFailedLabel")}: ${entry.explanation}`
                        : entry.status === "pending_review"
                          ? `${t("needDetails.emergency.actionPendingReviewLabel")}: ${entry.explanation}`
                          : entry.explanation
                    }
                    value={
                      entry.status === "failed"
                        ? "—"
                        : entry.amount != null
                          ? formatSgd(Math.round(entry.amount))
                          : t(`needDetails.emergency.actionTypes.${entry.action_type}`)
                    }
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function InsuranceNeedContent({ success, setSuccess, t, setActiveScreen, profile, healthScores }) {
  const [reviewScheduled, setReviewScheduled] = useState(success);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const currentScore = healthScores.find((score) => score.id === "insurance")?.value ?? 58;

  function scheduleReview() {
    setReviewScheduled(true);
    setConfirmOpen(true);
    setSuccess();
  }

  return (
    <Screen>
      <Header title={t("needDetails.insurance.title")} subtitle={t("needDetails.insurance.subtitle")} />
      <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />
      <SuccessBanner show={reviewScheduled} text={t("needDetails.insurance.success")} />
      <section className="metricGrid">
        <MetricCard label={t("needDetails.insurance.currentScore")} value={`${currentScore}/100`} t={t} />
        <MetricCard label={t("needDetails.insurance.recommendedScore")} value="85/100" t={t} />
        <MetricCard label={t("needDetails.insurance.life")} value={profile.insuranceStatus || t("needDetails.insurance.notReviewed")} />
        <MetricCard label={t("needDetails.insurance.health")} value={profile.insuranceStatus || t("needDetails.insurance.basic")} />
        <MetricCard label={t("needDetails.insurance.critical")} value={currentScore < 70 ? t("needDetails.insurance.gap") : t("common.protected")} />
        <MetricCard label={t("needDetails.insurance.family")} value={t("status.recommended")} />
      </section>
      <SupportList
        title={t("needDetails.ocbcSupport")}
        items={[
          t("needDetails.insurance.support1"),
          t("needDetails.insurance.support2"),
          t("needDetails.insurance.support3"),
          t("needDetails.insurance.support4"),
        ]}
      />
      {reviewScheduled ? (
        <section className="finalMessage scheduledReview">
          <CheckCircle2 size={20} />
          <p>{t("needDetails.insurance.scheduledDetail")}</p>
        </section>
      ) : null}
      <button
        type="button"
        className={reviewScheduled ? "primaryButton actionConfirmedButton insuranceReviewCta" : "primaryButton insuranceReviewCta"}
        onClick={scheduleReview}
        onPointerUp={(event) => {
          if (event.pointerType === "touch") scheduleReview();
        }}
      >
        {reviewScheduled ? t("needDetails.insurance.scheduledCta") : t("needDetails.insurance.cta")}
        <Check size={18} />
      </button>
      {confirmOpen ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("needDetails.insurance.scheduledCta")}>
          <motion.div className="confirmModal" {...screenMotion}>
            <CheckCircle2 size={24} />
            <strong>{t("needDetails.insurance.scheduledCta")}</strong>
            <p>{t("needDetails.insurance.scheduledDetail")}</p>
            <button type="button" className="primaryButton actionConfirmedButton" onClick={() => setConfirmOpen(false)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
      ) : null}
    </Screen>
  );
}


function SpendingRiskDetailScreen({ setActiveScreen, preferences, successStates, setSuccessStates, t }) {
  const profile = getUserProfile(preferences);
  const spendingRisk = getSpendingRisk(profile);
  const guardrailActive = Boolean(successStates.spendingGuardrail);

  function applyGuardrail() {
    setSuccessStates((current) => ({ ...current, spendingGuardrail: true }));
  }

  const affectedGoals = [
    {
      titleKey: "spendingRisk.goals.emergency.title",
      detailKey: "spendingRisk.goals.emergency.detail",
      icon: LockKeyhole,
    },
    {
      titleKey: "spendingRisk.goals.family.title",
      detailKey: "spendingRisk.goals.family.detail",
      icon: Sparkles,
    },
    {
      titleKey: "spendingRisk.goals.retirement.title",
      detailKey: "spendingRisk.goals.retirement.detail",
      icon: Landmark,
    },
  ];

  const guardrailActions = [
    "spendingRisk.guardrail.actions.cap",
    "spendingRisk.guardrail.actions.alert",
    "spendingRisk.guardrail.actions.protect",
    "spendingRisk.guardrail.actions.review",
  ];

  return (
    <Screen>
      <Header title={t("spendingRisk.title")} subtitle={t("spendingRisk.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
      <SuccessBanner show={guardrailActive} text={t("spendingRisk.guardrail.success")} />

      <section className={spendingRisk.hasRisk ? "spendingRiskHero risk" : "spendingRiskHero"}>
        <span className="futureAlertIcon">
          <AlertTriangle size={20} />
        </span>
        <div>
          <span className="sectionLabel">{t("spendingRisk.detectedLabel")}</span>
          <strong>
            {spendingRisk.hasRisk
              ? t("spendingRisk.detectedTitleRisk", { amount: formatSgd(spendingRisk.overBudgetAmount) })
              : t("spendingRisk.detectedTitleSafe")}
          </strong>
          <p>{t("spendingRisk.detectedText")}</p>
        </div>
      </section>

      <section className="metricGrid">
        <MetricCard label={t("spendingRisk.metrics.monthlyIncome")} value={formatSgd(spendingRisk.income)} />
        <MetricCard label={t("spendingRisk.metrics.currentSpending")} value={formatSgd(spendingRisk.expenses)} />
        <MetricCard label={t("spendingRisk.metrics.safeBudget")} value={formatSgd(spendingRisk.safeBudget)} />
        <MetricCard label={t("spendingRisk.metrics.overBudget")} value={formatSgd(spendingRisk.overBudgetAmount)} />
        <MetricCard label={t("spendingRisk.metrics.spendingRatio")} value={`${spendingRisk.spendingRatio}%`} />
        <MetricCard label={t("spendingRisk.metrics.riskLevel")} value={t(`spendingRisk.riskLevels.${spendingRisk.riskLevel}`)} />
      </section>

      <section className="recommendationPanel">
        <span className="sectionLabel">{t("spendingRisk.affectedTitle")}</span>
        <div className="affectedGoalGrid">
          {affectedGoals.map(({ titleKey, detailKey, icon: Icon }) => (
            <article key={titleKey}>
              <span className="iconBubble">
                <Icon size={15} />
              </span>
              <strong>{t(titleKey)}</strong>
              <small>{t(detailKey)}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="recommendationHero spendingRecommendation">
        <ShieldCheck size={22} />
        <div>
          <span className="sectionLabel">{t("spendingRisk.recommendation.title")}</span>
          <p>
            {t("spendingRisk.recommendation.detail", {
              amount: formatSgd(spendingRisk.suggestedReduction),
            })}
          </p>
          <small>{t("spendingRisk.recommendation.note")}</small>
        </div>
      </section>

      <SupportList
        title={t("spendingRisk.guardrail.title")}
        items={guardrailActions.map((key) =>
          t(key, {
            amount: formatSgd(spendingRisk.suggestedReduction),
            budget: formatSgd(spendingRisk.safeBudget),
          })
        )}
      />

      <button
        type="button"
        className={guardrailActive ? "primaryButton actionConfirmedButton" : "primaryButton"}
        onClick={applyGuardrail}
      >
        {guardrailActive ? t("spendingRisk.guardrail.activeCta") : t("spendingRisk.guardrail.cta")}
        <CheckCircle2 size={18} />
      </button>
    </Screen>
  );
}

function ProfileScreen({
  language,
  setLanguage,
  preferences,
  setPreferences,
  displayName,
  setActiveScreen,
  downloadConsentReport,
  downloadMyData,
  deleteLocalData,
  resetSimulation,
  restoreMockData,
  resetRelationship,
  t,
}) {
  const [notice, setNotice] = useState("");
  const [policyOpen, setPolicyOpen] = useState(false);
  const privacyScore = preferences.consentWithdrawn ? 38 : 92;
  const profile = getUserProfile(preferences);
  const notificationHistory = getNotificationHistory(profile, preferences, t);

  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function updateProfileField(key, value) {
    setPreferences((current) => ({
      ...current,
      profile: { ...getUserProfile(current), [key]: value },
    }));
  }

  function toggleProfileGoal(goal) {
    setPreferences((current) => {
      const currentProfile = getUserProfile(current);
      const nextGoals = { ...currentProfile.goals, [goal]: !currentProfile.goals?.[goal] };
      if (!Object.values(nextGoals).some(Boolean)) nextGoals[goal] = true;
      return { ...current, profile: { ...currentProfile, goals: nextGoals } };
    });
  }

  function updateNested(section, key, value) {
    setPreferences((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  }

  function withdrawConsent() {
    setPreferences((current) => ({
      ...current,
      consentWithdrawn: true,
      savingsTransfer: "manual",
      investmentRebalancing: "manual",
      guardianPermissions: { ...current.guardianPermissions, autonomousSavings: false },
      privacyPermissions: { ...current.privacyPermissions, executeActions: false },
    }));
    setNotice(t("settings.privacy.withdrawnNotice"));
  }

  return (
    <Screen>
      <Header eyebrow={t("settings.eyebrow")} title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <CustomerProfileCard displayName={displayName} profile={profile} t={t} />
      <NoticeBanner text={notice} />

      <button type="button" className="profileQuickAction" onClick={() => setActiveScreen(screens.MIRROR)}>
        <Bot size={18} />
        <span>
          <strong>{t("settings.openSimulator")}</strong>
          <small>{t("settings.openSimulatorDetail")}</small>
        </span>
        <ChevronRight size={16} />
      </button>

      <SettingsCard icon={UserRound} title={t("settings.profile.title")} description={t("settings.profile.description")}>
        <label className="profileNameField">
          <span>{t("settings.profile.displayName")}</span>
          <input
            type="text"
            value={preferences.displayName}
            onChange={(event) => updatePreference("displayName", event.target.value)}
            placeholder={t("settings.profile.placeholder")}
            maxLength={32}
            aria-label={t("settings.profile.displayName")}
          />
        </label>
        <small className="profileSaveHint">{t("settings.profile.savedHint")}</small>
        <div className="profileDataGrid">
          {[
            ["age", "profile.age", "number"],
            ["relationshipStatus", "profile.status", "text"],
            ["occupation", "profile.occupation", "text"],
            ["pastExperience", "profile.pastExperience", "text"],
            ["lifeStage", "profile.lifeStage", "text"],
            ["responsibilities", "profile.responsibilities", "text"],
            ["monthlyIncome", "profile.combinedIncome", "number"],
            ["monthlyExpenses", "profile.monthlyExpenses", "number"],
            ["currentSavings", "profile.currentSavings", "number"],
            ["existingLoans", "profile.existingLoans", "number"],
            ["creditCardOutstanding", "profile.creditCardOutstanding", "number"],
            ["investments", "profile.investments", "number"],
            ["insuranceStatus", "profile.insuranceStatus", "text"],
            ["riskPreference", "profile.riskPreference", "text"],
          ].map(([field, labelKey, type]) => (
            <label className="inputField" key={field}>
              <span>{t(labelKey)}</span>
              <input
                value={profile[field] ?? ""}
                type={type === "number" ? "text" : type}
                inputMode={type === "number" ? "decimal" : undefined}
                onChange={(event) => updateProfileField(field, event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="settingsGroup">
          <span className="sectionLabel">{t("lifeGraph.selectedGoals")}</span>
          <div className="checkboxGrid">
            {profileGoalOptions.map(({ id, labelKey, icon: Icon }) => (
              <button
                type="button"
                className={profile.goals?.[id] ? "checkOption selected" : "checkOption"}
                key={id}
                onClick={() => toggleProfileGoal(id)}
              >
                <Icon size={15} />
                <span>{t(labelKey)}</span>
                {profile.goals?.[id] ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={Globe2} title={t("settings.language.title")} description={t("settings.language.description")}>
        <label className="settingsSelect">
          <Globe2 size={16} />
          <span>{t("language.title")}</span>
          <select
            data-testid="profile-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {languageOptions.map((option) => (
              <option value={option.id} key={option.id}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </SettingsCard>

      <SettingsCard icon={Moon} title={t("settings.appearance.title")} description={t("settings.appearance.description")}>
        <SegmentedControl
          options={appearanceOptions}
          value={preferences.theme}
          onChange={(value) => updatePreference("theme", value)}
          t={t}
        />
      </SettingsCard>

      <SettingsCard icon={Bell} title={t("settings.notifications.title")} description={t("settings.notifications.description")}>
        {notificationOptions.map((option) => (
          <ToggleRow
            key={option.id}
            icon={Bell}
            label={t(option.labelKey)}
            checked={preferences.notifications[option.id]}
            onChange={() => updateNested("notifications", option.id, !preferences.notifications[option.id])}
          />
        ))}
        <div className="settingsGroup">
          <span className="sectionLabel">{t("settings.notifications.frequency")}</span>
          <SegmentedControl
            options={frequencyOptions}
            value={preferences.notificationFrequency}
            onChange={(value) => updatePreference("notificationFrequency", value)}
            t={t}
          />
        </div>
        <section className="notificationHistoryPanel">
          <div className="panelHead">
            <div>
              <span className="sectionLabel">{t("settings.notifications.history.title")}</span>
              <p>{t("settings.notifications.history.description")}</p>
            </div>
            <Bell size={17} />
          </div>
          <div className="notificationHistoryList">
            {notificationHistory.map(({ id, icon: Icon, tone, title, detail, time, status }) => {
              const feedback = preferences.notificationFeedback?.[id];
              return (
                <article className={`notificationHistoryItem ${tone}`} key={id}>
                  <button
                    type="button"
                    className="notificationHistoryOpen"
                    onClick={() => {
                      if (id === "over-budget") {
                        setActiveScreen(screens.SPENDING_RISK);
                        return;
                      }
                      setNotice(detail);
                    }}
                  >
                    <span className="iconBubble">
                      <Icon size={16} />
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <small>{detail}</small>
                      <em>{time}</em>
                    </div>
                    <b>{status}</b>
                  </button>
                  <div className="notificationFeedbackRow">
                    <span>{t("settings.notifications.history.wasThisUseful")}</span>
                    <button
                      type="button"
                      className={feedback === "useful" ? "miniButton active" : "miniButton"}
                      aria-pressed={feedback === "useful"}
                      onClick={() => updateNested("notificationFeedback", id, "useful")}
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      type="button"
                      className={feedback === "notUseful" ? "miniButton active" : "miniButton"}
                      aria-pressed={feedback === "notUseful"}
                      onClick={() => updateNested("notificationFeedback", id, "notUseful")}
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </SettingsCard>

      <SettingsCard icon={Bot} title={t("settings.guardian.title")} description={t("settings.guardian.description")}>
        {guardianPermissionOptions.map((option) => (
          <ToggleRow
            key={option.id}
            icon={ShieldCheck}
            label={t(option.labelKey)}
            checked={preferences.guardianPermissions[option.id]}
            onChange={() =>
              updateNested("guardianPermissions", option.id, !preferences.guardianPermissions[option.id])
            }
          />
        ))}
        <SettingsSubsection title={t("settings.guardian.savingsTransfer")}>
          <SegmentedControl
            options={savingsTransferOptions}
            value={preferences.savingsTransfer}
            onChange={(value) => updatePreference("savingsTransfer", value)}
            t={t}
          />
        </SettingsSubsection>
        <SettingsSubsection title={t("settings.guardian.investmentRebalancing")}>
          <SegmentedControl
            options={investmentRebalancingOptions}
            value={preferences.investmentRebalancing}
            onChange={(value) => updatePreference("investmentRebalancing", value)}
            t={t}
          />
        </SettingsSubsection>
        <SettingsSubsection title={t("settings.guardian.reviewFrequency")}>
          <SegmentedControl
            options={guardianReviewOptions}
            value={preferences.guardianReviewFrequency}
            onChange={(value) => updatePreference("guardianReviewFrequency", value)}
            t={t}
          />
        </SettingsSubsection>
        <SettingsSubsection title={t("settings.guardian.personalityTitle")}>
          <SegmentedControl
            options={guardianPersonalityOptions}
            value={preferences.guardianPersonality}
            onChange={(value) => updatePreference("guardianPersonality", value)}
            t={t}
          />
        </SettingsSubsection>
      </SettingsCard>

      <SettingsCard icon={LockKeyhole} title={t("settings.privacy.title")} description={t("settings.privacy.description")}>
        <section className="privacyScore">
          <div>
            <span className="sectionLabel">{t("settings.privacy.score")}</span>
            <strong>{privacyScore}%</strong>
          </div>
          <ProgressRing value={privacyScore} size={72} stroke={7} color={privacyScore > 70 ? "#0f9f84" : "#d71920"} />
        </section>
        {privacyPermissionOptions.map((option) => (
          <ToggleRow
            key={option.id}
            icon={LockKeyhole}
            label={t(option.labelKey)}
            checked={preferences.privacyPermissions[option.id]}
            onChange={() =>
              updateNested("privacyPermissions", option.id, !preferences.privacyPermissions[option.id])
            }
          />
        ))}
        <section className="consentTable">
          <span className="sectionLabel">{t("settings.privacy.historyTitle")}</span>
          {consentHistory.map((item) => (
            <div key={item.permissionKey}>
              <span>{item.date}</span>
              <strong>{t(item.permissionKey)}</strong>
              <b>{t(item.statusKey)}</b>
            </div>
          ))}
        </section>
        <div className="settingsActions">
          <button
            type="button"
            className="miniButton"
            onClick={() => {
              downloadConsentReport();
              setNotice(t("settings.privacy.downloadedNotice"));
            }}
          >
            <Download size={15} />
            {t("settings.privacy.downloadReport")}
          </button>
          <button type="button" className="miniButton danger" onClick={withdrawConsent}>
            <X size={15} />
            {t("settings.privacy.withdrawConsent")}
          </button>
          <button
            type="button"
            className="miniButton danger"
            onClick={() => {
              resetRelationship();
              setNotice(t("settings.privacy.relationshipResetNotice"));
            }}
          >
            <RotateCcw size={15} />
            {t("settings.privacy.resetRelationship")}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard icon={FileText} title={t("settings.terms.title")} description={t("settings.terms.description")}>
        <TermsList title={t("settings.terms.dataCollected")} keys={dataCollectedKeys} path="settings.terms.data" t={t} />
        <TermsList title={t("settings.terms.purpose")} keys={dataPurposeKeys} path="settings.terms.purposeItems" t={t} />
        <TermsList
          title={t("settings.terms.protection")}
          keys={dataProtectionKeys}
          path="settings.terms.protectionItems"
          t={t}
        />
        <TermsList
          title={t("settings.terms.customerControl")}
          keys={customerControlKeys}
          path="settings.terms.controlItems"
          t={t}
        />
        {policyOpen ? <p className="policyText">{t("settings.terms.policyText")}</p> : null}
        <div className="settingsActions">
          <button type="button" className="miniButton" onClick={() => setPolicyOpen((current) => !current)}>
            <FileText size={15} />
            {t("settings.terms.viewPolicy")}
          </button>
          <button
            type="button"
            className="miniButton"
            onClick={() => {
              downloadMyData();
              setNotice(t("settings.terms.downloadedNotice"));
            }}
          >
            <Download size={15} />
            {t("settings.terms.downloadData")}
          </button>
          <button
            type="button"
            className="miniButton danger"
            onClick={() => {
              deleteLocalData();
              setNotice(t("settings.terms.deletedNotice"));
            }}
          >
            <Trash2 size={15} />
            {t("settings.terms.deleteData")}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={SlidersHorizontal}
        title={t("settings.demo.title")}
        description={t("settings.demo.description")}
      >
        <SummaryRow label={t("settings.demo.version")} value="FutureOS Prototype v1.0" />
        <div className="settingsActions">
          <button
            type="button"
            className="miniButton"
            onClick={() => {
              resetSimulation();
              setNotice(t("settings.demo.clearNotice"));
            }}
          >
            <RotateCcw size={15} />
            {t("settings.demo.clearSimulation")}
          </button>
          <button
            type="button"
            className="miniButton"
            onClick={() => {
              restoreMockData();
              setNotice(t("settings.demo.restoreNotice"));
            }}
          >
            <CheckCircle2 size={15} />
            {t("settings.demo.restoreMock")}
          </button>
          <button
            type="button"
            className="miniButton danger"
            onClick={() => {
              deleteLocalData();
              setNotice(t("settings.terms.deletedNotice"));
            }}
          >
            <Trash2 size={15} />
            {t("common.resetDemo")}
          </button>
        </div>
      </SettingsCard>
    </Screen>
  );
}

function LoadingScreen({ messageKey, t }) {
  return (
    <Screen>
      <section className="loadingCard">
        <motion.div
          className="loadingOrb"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles size={28} />
        </motion.div>
        <strong>{t(messageKey)}</strong>
        <span>{t("loading.detail")}</span>
      </section>
    </Screen>
  );
}

function CustomerProfileCard({ displayName, profile, t }) {
  const showKarinaPhoto = getDisplayName(displayName).toLowerCase().includes("karina");
  return (
    <section className="profileHero">
      <div
        className={showKarinaPhoto ? "coupleAvatar photoAvatar" : "coupleAvatar profileInitialsAvatar"}
        role="img"
        aria-label={displayName}
      >
        {showKarinaPhoto ? null : getInitials(displayName)}
      </div>
      <div>
        <strong>{displayName}, {profile?.age ?? "27"}</strong>
        <span>{profile?.occupation || t("customer.segment")}</span>
        <small>{profile?.lifeStage || t("customer.lifeStage")}</small>
      </div>
    </section>
  );
}

function BackHomeButton({ setActiveScreen, t }) {
  return (
    <button type="button" className="backHomeButton" onClick={() => setActiveScreen(screens.HOME)}>
      <Home size={15} />
      {t("common.backHome")}
    </button>
  );
}

function BackMirrorButton({ setActiveScreen, t }) {
  return (
    <button type="button" className="backHomeButton" onClick={() => setActiveScreen(screens.MIRROR)}>
      <LineChart size={15} />
      {t("common.backMirror")}
    </button>
  );
}

function BackLifeGraphButton({ setActiveScreen, t }) {
  return (
    <button type="button" className="backHomeButton" onClick={() => setActiveScreen(screens.LIFE_GRAPH)}>
      <ChartNoAxesColumnIncreasing size={15} />
      {t("common.backLifeGraph")}
    </button>
  );
}

function SuccessBanner({ show, text }) {
  if (!show) return null;
  return (
    <motion.section className="successBanner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <Check size={18} />
      <p>{text}</p>
    </motion.section>
  );
}

function NoticeBanner({ text }) {
  if (!text) return null;
  return (
    <motion.section className="noticeBanner" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
      <CheckCircle2 size={18} />
      <p>{text}</p>
    </motion.section>
  );
}

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <section className="settingsCard">
      <div className="settingsHeader">
        <span className="iconBubble">
          <Icon size={17} />
        </span>
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
      </div>
      <div className="settingsBody">{children}</div>
    </section>
  );
}

function SettingsSubsection({ title, children }) {
  return (
    <div className="settingsGroup">
      <span className="sectionLabel">{title}</span>
      {children}
    </div>
  );
}

function SegmentedControl({ options, value, onChange, t }) {
  return (
    <div className="segmentedControl">
      {options.map(({ id, labelKey, icon: Icon }) => (
        <button
          type="button"
          className={value === id ? "segmentButton active" : "segmentButton"}
          key={id}
          onClick={() => onChange(id)}
        >
          {Icon ? <Icon size={14} /> : null}
          <span>{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}

function TermsList({ title, keys, path, t }) {
  return (
    <section className="termsList">
      <span className="sectionLabel">{title}</span>
      <div>
        {keys.map((key) => (
          <article key={key}>
            <Check size={14} />
            <span>{t(`${path}.${key}`)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProgressPanel({ label, value, t, body, methodText }) {
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <section className="progressPanel">
      <div>
        <span className="sectionLabel scoreLabelWithInfo">
          {label}
          {t ? (
            <button
              type="button"
              className="infoButton tinyInfoButton"
              onClick={() => setInfoOpen(true)}
              aria-label={t("homeBanking.infoLabel", { item: label })}
            >
              <Info size={11} />
            </button>
          ) : null}
        </span>
        <strong>{value}%</strong>
      </div>
      <ProgressRing value={value} size={76} stroke={7} color="#0f9f84" />
      {infoOpen ? (
        <InfoModal
          icon={Info}
          title={label}
          body={body ?? t("scoreInfo.body", { item: label })}
          scoreLabel={t("homeBanking.currentScore")}
          scoreValue={`${value}%`}
          methodLabel={t("homeBanking.howCalculated")}
          methodText={methodText ?? t("scoreInfo.method")}
          onClose={() => setInfoOpen(false)}
          closeLabel={t("homeBanking.gotIt")}
        />
      ) : null}
    </section>
  );
}

// Shared shape for every "tap the (i) icon" explainer across the app: icon, title, optional tag,
// optional body paragraph, optional proof score row, optional method block, optional evidence list,
// optional trailing note, single close button. Screens with a genuinely different shape (the
// strategy modal, the memory-event detail modal) stay bespoke rather than being forced into this.
function InfoModal({
  icon: Icon,
  title,
  tag,
  body,
  scoreLabel,
  scoreValue,
  scoreValueClassName,
  methodLabel,
  methodText,
  listTitle,
  listItems,
  footerText,
  onClose,
  closeLabel,
}) {
  return (
    <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={title}>
      <motion.div className="confirmModal" {...screenMotion}>
        {Icon ? <Icon size={24} /> : null}
        <strong>{title}</strong>
        {tag ? <span className="prototypeTag">{tag}</span> : null}
        {body ? <p>{body}</p> : null}
        {scoreValue !== undefined && scoreValue !== null ? (
          <div className="proofScore">
            <span>{scoreLabel}</span>
            <b className={scoreValueClassName}>{scoreValue}</b>
          </div>
        ) : null}
        {methodText ? (
          <div className="proofBlock">
            <strong>{methodLabel}</strong>
            <p>{methodText}</p>
          </div>
        ) : null}
        {listItems ? <SupportList title={listTitle} items={listItems} /> : null}
        {footerText ? <p>{footerText}</p> : null}
        <button type="button" className="primaryButton" onClick={onClose}>
          {closeLabel}
        </button>
      </motion.div>
    </section>
  );
}

function SupportList({ title, items }) {
  return (
    <section className="supportPanel">
      <span className="sectionLabel">{title}</span>
      <div>
        {items.map((item) => (
          <article className="supportRow" key={item}>
            <Check size={15} />
            <span>{item}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ToggleRow({ label, checked, onChange, icon: Icon }) {
  return (
    <label className="toggleRow">
      {Icon ? <Icon size={15} /> : null}
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange ?? (() => {})} />
      <i />
    </label>
  );
}

function MetricCard({ label, value, wide = false, t }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const hasScoreInfo = Boolean(t) && (String(value).includes("/100") || String(value).includes("%"));
  return (
    <article className={wide ? "metricCard wide" : "metricCard"}>
      <span className={hasScoreInfo ? "scoreLabelWithInfo" : ""}>
        {label}
        {hasScoreInfo ? (
          <button
            type="button"
            className="infoButton tinyInfoButton"
            onClick={() => setInfoOpen(true)}
            aria-label={t("homeBanking.infoLabel", { item: label })}
          >
            <Info size={11} />
          </button>
        ) : null}
      </span>
      <strong>{value}</strong>
      {infoOpen ? (
        <InfoModal
          icon={Info}
          title={label}
          body={t("scoreInfo.body", { item: label })}
          scoreLabel={t("homeBanking.currentScore")}
          scoreValue={value}
          methodLabel={t("homeBanking.howCalculated")}
          methodText={t("scoreInfo.method")}
          onClose={() => setInfoOpen(false)}
          closeLabel={t("homeBanking.gotIt")}
        />
      ) : null}
    </article>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="summaryRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Screen({ children }) {
  return (
    <motion.div className="screen" {...screenMotion}>
      {children}
    </motion.div>
  );
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState(screens.HOME);
  const [loadingCopyKey, setLoadingCopyKey] = useState("loading.default");
  const [language, setLanguage] = useState("en");
  const [successStates, setSuccessStates] = useState({});
  const [activeAccountId, setActiveAccountId] = useState("savings");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [systemTheme, setSystemTheme] = useState("light");
  const [simulatorInputs, setSimulatorInputs] = useState(defaultSimulatorInputs);
  const [simulatorRan, setSimulatorRan] = useState(false);
  const [simulatorApplied, setSimulatorApplied] = useState(false);
  const [simulatorActionStates, setSimulatorActionStates] = useState(defaultSimulatorActionStates);
  const [memoryEvents, setMemoryEvents] = useState(defaultGuardianMemoryEvents);
  const [loanPlannerInitialPurpose, setLoanPlannerInitialPurpose] = useState(null);

  const t = useMemo(() => makeTranslator(language), [language]);
  const effectiveTheme = getEffectiveTheme(preferences.theme, systemTheme);
  const displayName = getDisplayName(preferences.displayName);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("futureos-language");
    if (storedLanguage && locales[storedLanguage]) setLanguage(storedLanguage);
    const savedPreferences = safeJsonParse(window.localStorage.getItem("futureos-preferences"), null);
    const storedPreferences = {
      ...applyProfileMigration(mergeDefaults(defaultPreferences, savedPreferences), savedPreferences),
      // goalLedger, escalationHistory, notificationFeedback, and rejectionCounts all have dynamic
      // keys (or are lists), so the generic key-by-key merge (which only ever walks the *default*
      // object's own keys - an empty {} or [] default has none) would silently wipe every stored
      // entry - restore them verbatim.
      goalLedger: savedPreferences?.goalLedger ?? {},
      escalationHistory: savedPreferences?.escalationHistory ?? [],
      notificationFeedback: savedPreferences?.notificationFeedback ?? {},
      rejectionCounts: savedPreferences?.rejectionCounts ?? {},
      dismissedActions: savedPreferences?.dismissedActions ?? [],
    };
    setPreferences(storedPreferences);
    setSimulatorInputs(
      mergeDefaults(
        getSimulatorDefaultsFromProfile(getUserProfile(storedPreferences), getCustomGoals(storedPreferences)),
        safeJsonParse(window.localStorage.getItem("futureos-simulator-inputs"), null)
      )
    );
    setSimulatorRan(safeJsonParse(window.localStorage.getItem("futureos-simulator-ran"), false));
    setSimulatorApplied(safeJsonParse(window.localStorage.getItem("futureos-simulator-applied"), false));
    setSimulatorActionStates(
      mergeDefaults(
        defaultSimulatorActionStates,
        safeJsonParse(window.localStorage.getItem("futureos-simulator-actions"), null)
      )
    );
    const savedMemory = safeJsonParse(window.localStorage.getItem("futureos-guardian-memory"), null);
    if (Array.isArray(savedMemory) && savedMemory.length > 0) {
      setMemoryEvents(savedMemory);
    }
  }, []);

  useEffect(() => {
    setSimulatorInputs((current) => ({
      ...getSimulatorDefaultsFromProfile(getUserProfile(preferences), getCustomGoals(preferences)),
      situation: current.situation,
      independenceLevel: current.independenceLevel,
      plannedSpending: current.plannedSpending,
      weddingBudget: current.weddingBudget,
      weddingDate: current.weddingDate,
      targetDownPayment: current.targetDownPayment,
      targetHomeYear: current.targetHomeYear,
      weddingSavingsMonthly: current.weddingSavingsMonthly,
      weddingSavingsStartMonth: current.weddingSavingsStartMonth,
      weddingSavingsTargetMonth: current.weddingSavingsTargetMonth,
      homeSavingsMonthly: current.homeSavingsMonthly,
      homeSavingsStartMonth: current.homeSavingsStartMonth,
      homeSavingsTargetMonth: current.homeSavingsTargetMonth,
      retirementAge: current.retirementAge,
      retirementSavingsMonthly: current.retirementSavingsMonthly,
      retirementSavingsStartMonth: current.retirementSavingsStartMonth,
      retirementSavingsTargetMonth: current.retirementSavingsTargetMonth,
      customGoalName: current.customGoalName,
      customTargetAmount: current.customTargetAmount,
      customTargetDate: current.customTargetDate,
      customPriority: current.customPriority,
      customCategory: current.customCategory,
      customNotes: current.customNotes,
    }));
  }, [preferences.profile, preferences.customGoals]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => setSystemTheme(query.matches ? "dark" : "light");
    syncTheme();
    query.addEventListener("change", syncTheme);
    return () => query.removeEventListener("change", syncTheme);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("futureos-language", language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem("futureos-preferences", JSON.stringify(preferences));
    document.documentElement.dataset.theme = effectiveTheme;
  }, [preferences, effectiveTheme]);

  useEffect(() => {
    window.localStorage.setItem("futureos-simulator-inputs", JSON.stringify(simulatorInputs));
  }, [simulatorInputs]);

  useEffect(() => {
    window.localStorage.setItem("futureos-simulator-ran", JSON.stringify(simulatorRan));
  }, [simulatorRan]);

  useEffect(() => {
    window.localStorage.setItem("futureos-simulator-applied", JSON.stringify(simulatorApplied));
  }, [simulatorApplied]);

  useEffect(() => {
    window.localStorage.setItem("futureos-simulator-actions", JSON.stringify(simulatorActionStates));
  }, [simulatorActionStates]);

  useEffect(() => {
    window.localStorage.setItem("futureos-guardian-memory", JSON.stringify(memoryEvents));
  }, [memoryEvents]);

  function goWithLoading(nextScreen, copyKey) {
    setLoadingCopyKey(copyKey);
    setActiveScreen(screens.LOADING);
    window.setTimeout(() => setActiveScreen(nextScreen), 650);
  }

  function resetSimulation() {
    setSimulatorInputs(getSimulatorDefaultsFromProfile(getUserProfile(preferences), getCustomGoals(preferences)));
    setSimulatorRan(false);
    setSimulatorApplied(false);
    setSimulatorActionStates(defaultSimulatorActionStates);
  }

  function restoreMockData() {
    setPreferences(defaultPreferences);
    setSuccessStates({});
    setActiveAccountId("savings");
    setSimulatorInputs(getSimulatorDefaultsFromProfile(defaultProfile, []));
    setSimulatorRan(false);
    setSimulatorApplied(false);
    setSimulatorActionStates(defaultSimulatorActionStates);
  }

  // Relationship Reset (07_Relationship_And_Shared_Responsibility.md): restarts preferences,
  // permissions, and goal states without deleting the account story - profile, custom goals, and
  // Guardian Memory (futureos-guardian-memory) are left untouched.
  function resetRelationship() {
    setPreferences((current) => ({
      ...current,
      goalLedger: {},
      savingsTransfer: defaultPreferences.savingsTransfer,
      investmentRebalancing: defaultPreferences.investmentRebalancing,
      guardianReviewFrequency: defaultPreferences.guardianReviewFrequency,
      guardianPersonality: defaultPreferences.guardianPersonality,
      privacyPermissions: { ...defaultPreferences.privacyPermissions },
      consentWithdrawn: false,
    }));
    setSimulatorInputs((current) => ({ ...current, independenceLevel: 1 }));
    setSimulatorActionStates(defaultSimulatorActionStates);
  }

  function downloadConsentReport() {
    downloadJsonFile("futureos-consent-report.json", {
      customer: displayName,
      privacyScore: preferences.consentWithdrawn ? 38 : 92,
      consentHistory,
      permissions: preferences.privacyPermissions,
      autonomousBanking: {
        savingsTransfer: preferences.savingsTransfer,
        investmentRebalancing: preferences.investmentRebalancing,
      },
    });
  }

  function downloadMyData() {
    downloadJsonFile("futureos-my-data.json", {
      customer: { names: displayName, initials: getInitials(displayName) },
      preferences,
      simulatorInputs,
      simulatorRan,
      simulatorApplied,
      simulatorActionStates,
    });
  }

  function deleteLocalData() {
    window.localStorage.removeItem("futureos-preferences");
    window.localStorage.removeItem("futureos-simulator-inputs");
    window.localStorage.removeItem("futureos-simulator-ran");
    window.localStorage.removeItem("futureos-simulator-applied");
    window.localStorage.removeItem("futureos-simulator-actions");
    window.localStorage.removeItem("futureos-guardian-memory");
    restoreMockData();
    setActiveScreen(screens.HOME);
  }

  const shared = {
    t,
    language,
    goWithLoading,
    setActiveScreen,
    setActiveAccountId,
    displayName,
    preferences,
    setPreferences,
    simulatorInputs,
    setSimulatorInputs,
    successStates,
    setSuccessStates,
    memoryEvents,
    setMemoryEvents,
    setLoanPlannerInitialPurpose,
  };

  const mirrorSimulatorScreen = (
    <FutureMirrorSimulator
      {...shared}
      simulatorInputs={simulatorInputs}
      setSimulatorInputs={setSimulatorInputs}
      simulatorRan={simulatorRan}
      setSimulatorRan={setSimulatorRan}
      simulatorApplied={simulatorApplied}
      setSimulatorApplied={setSimulatorApplied}
      simulatorActionStates={simulatorActionStates}
      setSimulatorActionStates={setSimulatorActionStates}
      resetSimulation={resetSimulation}
    />
  );

  const currentScreen = {
    [screens.HOME]: <HomeDashboard {...shared} />,
    [screens.LIFE_GRAPH]: <LifeGraph {...shared} />,
    [screens.MIRROR]: mirrorSimulatorScreen,
    [screens.ACCOUNT_DETAIL]: <AccountDetailScreen {...shared} activeAccountId={activeAccountId} />,
    [screens.SPENDING_RISK]: <SpendingRiskDetailScreen {...shared} />,
    [screens.GUARDIAN]: (
      <FutureSelfGuardian
        {...shared}
        preferences={preferences}
        simulatorActionStates={simulatorActionStates}
        setSimulatorActionStates={setSimulatorActionStates}
      />
    ),
    [screens.PROFILE]: (
      <ProfileScreen
        {...shared}
        language={language}
        setLanguage={setLanguage}
        preferences={preferences}
        setPreferences={setPreferences}
        downloadConsentReport={downloadConsentReport}
        downloadMyData={downloadMyData}
        deleteLocalData={deleteLocalData}
        resetSimulation={resetSimulation}
        restoreMockData={restoreMockData}
        resetRelationship={resetRelationship}
      />
    ),
    [screens.NEED_WEDDING]: <NeedDetailScreen {...shared} type="wedding" />,
    [screens.NEED_HOME]: <NeedDetailScreen {...shared} type="home" />,
    [screens.NEED_RETIREMENT]: <NeedDetailScreen {...shared} type="retirement" />,
    [screens.NEED_LOAN]: (
      <LoanPlannerContent
        success={Boolean(successStates.loan)}
        setSuccess={() => setSuccessStates((current) => ({ ...current, loan: true }))}
        t={t}
        setActiveScreen={setActiveScreen}
        language={language}
        profile={getUserProfile(preferences)}
        initialPurpose={loanPlannerInitialPurpose}
        onConsumeInitialPurpose={() => setLoanPlannerInitialPurpose(null)}
        setMemoryEvents={setMemoryEvents}
      />
    ),
    [screens.NEED_EMERGENCY]: <NeedDetailScreen {...shared} type="emergency" />,
    [screens.NEED_INSURANCE]: <NeedDetailScreen {...shared} type="insurance" />,
    [screens.NEED_INVESTMENT]: (
      <InvestmentPlannerContent
        success={Boolean(successStates.investment)}
        setSuccess={() => setSuccessStates((current) => ({ ...current, investment: true }))}
        t={t}
        setActiveScreen={setActiveScreen}
        language={language}
        profile={getUserProfile(preferences)}
        setMemoryEvents={setMemoryEvents}
      />
    ),
    [screens.PAYNOW]: <QuickActionScreen {...shared} type="paynow" />,
    [screens.SCAN_PAY]: <QuickActionScreen {...shared} type="scanPay" />,
    [screens.FX]: <QuickActionScreen {...shared} type="fx" />,
    [screens.LOADING]: <LoadingScreen messageKey={loadingCopyKey} t={t} />,
  }[activeScreen];

  return (
    <PhoneShell
      activeScreen={activeScreen}
      setActiveScreen={setActiveScreen}
      language={language}
      setLanguage={setLanguage}
      theme={effectiveTheme}
      t={t}
    >
      <AnimatePresence mode="wait">{currentScreen}</AnimatePresence>
    </PhoneShell>
  );
}

