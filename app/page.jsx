"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChangeLedgerScreen, ImpactReceipt } from "./components/change-ledger-screen.jsx";
import { formatEvent } from "../lib/change-ledger/format.js";
import { nodeEvents } from "../lib/life/node-evidence.js";
import { LifeThreadProvider, useLifeThread } from "./components/life-thread/LifeThreadProvider.jsx";
import { ExploreScreen } from "./features/explore/ExploreScreen.jsx";
import { HomeHorizon } from "./features/home/HomeHorizon.jsx";
import { EmergencyRunway } from "./features/emergency/EmergencyRunway.jsx";
import { FutureFieldCanvas } from "./components/future-field-canvas.jsx";
import { WeddingContinuousScene } from "./features/wedding/WeddingContinuousScene.jsx";
import { LivingPlanStatus, GuardianDecisions } from "./components/living-plan-status.jsx";
import { MemoryLensScreen } from "./components/memory-lens-screen.jsx";
import { ShadowGuardianPanel } from "./components/shadow-guardian-panel.jsx";
import { FutureHandoffPanel } from "./components/future-handoff-panel.jsx";
import { DebtGravity } from "./features/loan/DebtGravity.jsx";
import { FutureDayLoom } from "./features/retirement/FutureDayLoom.jsx";
import { CalendarOrbit } from "./features/travel/CalendarOrbit.jsx";
import { CapitalPrism } from "./features/investment/CapitalPrism.jsx";
import { LivingEnvelope } from "./features/insurance/LivingEnvelope.jsx";
import { PrivateConstellation } from "./features/family/PrivateConstellation.jsx";
import {
  Accessibility,
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
  LayoutGrid,
  LineChart,
  LockKeyhole,
  LogOut,
  Mic,
  MonitorCog,
  Moon,
  Music,
  PartyPopper,
  Pencil,
  PiggyBank,
  Plus,
  QrCode,
  RotateCcw,
  Scale,
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
  Search,
  Store,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Utensils,
  Volume2,
  Wallet,
  Wine,
  X,
  Zap,
} from "lucide-react";
import { computeHomeFinancials } from "../lib/home-finance.js";
import { recomputeVenueForGuestCount } from "../lib/wedding-finance.js";
import { computeRetirementFinancials } from "../lib/retirement-finance.js";
import { computeAllLoanArchetypes, applyLoanModifiers, computeLoanAffordabilityPreview, LOAN_ARCHETYPE_KEYS, LOAN_MODIFIER_KEYS } from "../lib/loan-finance.js";
import { projectPurchaseMode, scoreInvestmentCandidate } from "../lib/investment-finance.js";
import { RISK_BANDS, HOLDINGS_CATEGORIES, PURCHASE_MODES, INVESTMENT_CATALOG } from "../lib/investment-catalog.js";
import { computeUtilization } from "../lib/strategic-balance-finance.js";
import { computeExpectedValueAtElapsed, computeAccuracyGuarantee, UNDERPERFORMANCE_THRESHOLD_PERCENT, FEE_CREDIT_PERCENT_OF_SHORTFALL } from "../lib/accuracy-guarantee-finance.js";
import { computePeerBenchmark, getTypicalSavingsRatePercent } from "../lib/peer-benchmark.js";
import { computeShadowAccount } from "../lib/shadow-account-finance.js";
import { computeFamilyPicture } from "../lib/family-cfo-finance.js";
import { computePersonalBufferImpact } from "../lib/sme-cashflow-finance.js";
import { computeSmoothedIncome } from "../lib/income-finance.js";
import { computeSmoothedExpenses } from "../lib/expense-finance.js";
import { computeHomeBudgetRange, computeDownPaymentReadiness, computeReadyDateForMonthlyAmount } from "../lib/home-draft-finance.js";
import { computeInvestmentReadiness } from "../lib/investment-readiness-finance.js";
import { computeWeddingSavingsCapacity, computeProjectedWeddingSavings } from "../lib/wedding-draft-finance.js";
import { computeNetWorthTimeline, computeIncomeGrowth, computePersonalEconomyIndicators } from "../lib/personal-economy-finance.js";
import { extractPdfText } from "../lib/pdf-extract-client.js";
import { ASSET_CATEGORIES, ASSET_SUBTYPES, STAGES, FIELD_ENUMS, isNonMonetaryCategory } from "../lib/asset-taxonomy.js";
import {
  computeNetWorth,
  computeCategoryTotals,
  computeStageRollup,
  computeAssetHealthInputs,
} from "../lib/asset-finance.js";
import en from "../locales/en.json";
import ms from "../locales/ms.json";
import ta from "../locales/ta.json";
import zh from "../locales/zh.json";

// Namespaces every localStorage key by the real logged-in user, so two
// different accounts on one browser never read/write each other's cached
// data. Module-level rather than threaded through props: this is a
// single-page app where exactly one user is ever authenticated per page
// load, set once by App()'s auth-resolution effect before anything reads a
// namespaced key - not meant to support two concurrent identities in one
// loaded page.
let currentSessionUserId = null;
function setCurrentSessionUserId(userId) {
  currentSessionUserId = userId;
}
function storageKey(base) {
  return currentSessionUserId ? `${base}:${currentSessionUserId}` : base;
}

const screens = {
  HOME: "home",
  HOME_FULL: "homeFull",
  LIFE_GRAPH: "lifeGraph",
  MIRROR: "mirror",
  EXPLORE_CHAT: "exploreChat",
  JOINT_DEBATE_RESPONSE: "jointDebateResponse",
  GUARDIAN: "guardian",
  PROFILE: "profile",
  ASSET_PROFILE: "assetProfile",
  NEED_WEDDING: "needWedding",
  NEED_HOME: "needHome",
  NEED_RETIREMENT: "needRetirement",
  NEED_LOAN: "needLoan",
  NEED_EMERGENCY: "needEmergency",
  NEED_INSURANCE: "needInsurance",
  NEED_INVESTMENT: "needInvestment",
  NEED_OTHER: "needOther",
  RELATIONSHIP_LEDGER: "relationshipLedger",
  DECISION_VERDICT: "decisionVerdict",
  FUTURE_COMPARISON: "futureComparison",
  SME_CASHFLOW: "smeCashflow",
  ACTIVITY_CHECK: "activityCheck",
  FAMILY_TRAVEL: "familyTravel",
  SHADOW_ACCOUNT: "shadowAccount",
  FAMILY_CFO: "familyCfo",
  GOAL_MARKETPLACE: "goalMarketplace",
  PERSONAL_ECONOMY: "personalEconomy",
  DEAL_FINDER: "dealFinder",
  DECODE_DOCUMENT: "decodeDocument",
  STRATEGIC_BALANCE: "strategicBalance",
  CHANGE_LEDGER: "changeLedger",
  MEMORY_LENS: "memoryLens",
  FUTURE_FIELD: "futureField",
  HOME_HORIZON: "homeHorizon",
  EMERGENCY_RUNWAY: "emergencyRunway",
  WEDDING_LIVING_PLAN: "weddingLivingPlan",
  REPAYMENT_PATH: "repaymentPath",
  FUTURE_LIFE_TIMELINE: "futureLifeTimeline",
  TRIP_ORBIT: "tripOrbit",
  CAPITAL_PATHS: "capitalPaths",
  PROTECTION_ENVELOPE: "protectionEnvelope",
  FAMILY_CONSTELLATION: "familyConstellation",
  CROSS_BANK_DATA: "crossBankData",
  PRODUCT_FIT: "productFit",
  PEER_BENCHMARK: "peerBenchmark",
  LIFE_JOURNEY: "lifeJourney",
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

// Mirrors app/api/grants/route.js's createGrantSchema.scope enum exactly.
const GRANT_SCOPE_OPTIONS = ["all", "wedding", "home", "retirement", "other", "hardship", "loan", "investment", "travel"];

// Four-entry information architecture: Today (where you stand), Life (the
// causal map), Explore (create/compare futures), Guardian (what needs your
// decision). Profile lives in the Today header, not the nav.
const navItems = [
  { id: screens.HOME, labelKey: "nav.today", icon: Home },
  { id: screens.LIFE_GRAPH, labelKey: "nav.life", icon: ChartNoAxesColumnIncreasing },
  { id: screens.MIRROR, labelKey: "nav.explore", icon: LineChart },
  { id: screens.GUARDIAN, labelKey: "nav.guardian", icon: ShieldCheck },
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
  custom: { screen: screens.NEED_OTHER, badgeKey: "otherPlanner.newFeatureBadge" },
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

const currentProfileVersion = "karina-demo-profile-2026-08-11-income-history";

const defaultProfile = {
  age: "27",
  relationshipStatus: "Married",
  occupation: "Mid-Level Marketing Executive at a retail company",
  responsibilities:
    "Manages campaigns and budgets at work, oversees household finances, and plans for long-term goals.",
  pastExperience: "5 years in marketing, recently promoted",
  lifeStage: "Late 20s, married, considering starting a family",
  // The customer's own manually-typed figure - distinct from `monthlyIncome`,
  // which manualEntryProvider.getProfile() computes as the EFFECTIVE number
  // (smoothed from real incomeHistory when enough exists, this value verbatim
  // otherwise) that every real consumer in the app actually reads.
  statedMonthlyIncome: "7500",
  monthlyExpenses: "3600",
  currentSavings: "85000",
  existingLoans: "18000",
  creditCardOutstanding: "2400",
  investments: "15000",
  insuranceStatus: "Basic",
  insuranceCoverageAmount: "150000",
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

// UI registry for the Asset Profile's fixed, closed taxonomy
// (lib/asset-taxonomy.js) - icon + i18n labelKey per category/subtype, so
// the "add asset" picker only ever offers this designed list, never free
// text. Kept next to lib/asset-taxonomy.js's ASSET_CATEGORIES/ASSET_SUBTYPES
// (imported above) as the single ordering/labeling source for the picker.
const assetCategoryMeta = {
  financial: { labelKey: "assetProfile.categories.financial", icon: Wallet },
  physical: { labelKey: "assetProfile.categories.physical", icon: Building2 },
  business: { labelKey: "assetProfile.categories.business", icon: BriefcaseBusiness },
  human: { labelKey: "assetProfile.categories.human", icon: UserRound },
  social: { labelKey: "assetProfile.categories.social", icon: Sparkles },
  knowledge: { labelKey: "assetProfile.categories.knowledge", icon: Bot },
  digital: { labelKey: "assetProfile.categories.digital", icon: LineChart },
  legal: { labelKey: "assetProfile.categories.legal", icon: ShieldCheck },
};

const assetStageMeta = {
  protect: { labelKey: "assetProfile.stages.protect", icon: LockKeyhole },
  grow: { labelKey: "assetProfile.stages.grow", icon: LineChart },
  amplify: { labelKey: "assetProfile.stages.amplify", icon: Sparkles },
  inherit: { labelKey: "assetProfile.stages.inherit", icon: Landmark },
};

function assetSubtypeLabelKey(category, subtype) {
  return `assetProfile.subtypes.${category}.${subtype}`;
}

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
  {
    id: "relationshipLedger",
    titleKey: "futureSystems.relationshipLedger.title",
    subtitleKey: "futureSystems.relationshipLedger.subtitle",
    icon: Award,
    screen: screens.RELATIONSHIP_LEDGER,
  },
  {
    id: "lifeJourney",
    titleKey: "futureSystems.lifeJourney.title",
    subtitleKey: "futureSystems.lifeJourney.subtitle",
    icon: Sparkles,
    screen: screens.LIFE_JOURNEY,
  },
  {
    id: "familyCfo",
    titleKey: "futureSystems.familyCfo.title",
    subtitleKey: "futureSystems.familyCfo.subtitle",
    icon: Users,
    screen: screens.FAMILY_CFO,
  },
  {
    id: "goalMarketplace",
    titleKey: "futureSystems.goalMarketplace.title",
    subtitleKey: "futureSystems.goalMarketplace.subtitle",
    icon: Store,
    screen: screens.GOAL_MARKETPLACE,
  },
  {
    id: "personalEconomy",
    titleKey: "futureSystems.personalEconomy.title",
    subtitleKey: "futureSystems.personalEconomy.subtitle",
    icon: Banknote,
    screen: screens.PERSONAL_ECONOMY,
  },
  {
    id: "dealFinder",
    titleKey: "futureSystems.dealFinder.title",
    subtitleKey: "futureSystems.dealFinder.subtitle",
    icon: Search,
    screen: screens.DEAL_FINDER,
  },
];

// Life-transition view (人生转折点视图): the SAME dedicated planners already built, just grouped
// by what's actually happening in the customer's life instead of by bank product category - an
// additional way to navigate, not a replacement for the existing product-first Life Goal Selection
// grid on Mirror. Each moment can bundle more than one underlying planner (e.g. buying a home also
// needs financing).
// `statusKey` matches lib/life-journey-context.js's getLifeJourneyStatus()
// response keys (or "emergency", computed client-side from real health
// scores instead - see LifeJourneyScreen) - the real per-planner status
// LifeJourneyScreen renders instead of just a static navigation label.
const LIFE_MOMENTS = [
  {
    id: "gettingMarried",
    icon: HeartHandshake,
    plannerScreens: [{ screen: screens.NEED_WEDDING, labelKey: "weddingPlanner.title", statusKey: "wedding" }],
  },
  {
    id: "buyingHome",
    icon: Building2,
    plannerScreens: [
      { screen: screens.NEED_HOME, labelKey: "homePlanner.title", statusKey: "home" },
      { screen: screens.NEED_LOAN, labelKey: "loanPlanner.title", statusKey: "loan:home" },
    ],
  },
  {
    id: "growingFamily",
    icon: Sparkles,
    plannerScreens: [
      { screen: screens.NEED_INSURANCE, labelKey: "needDetails.insurance.title", statusKey: "insurance" },
      { screen: screens.NEED_EMERGENCY, labelKey: "needDetails.emergency.title", statusKey: "emergency" },
    ],
  },
  {
    id: "buildingWealth",
    icon: LineChart,
    plannerScreens: [
      { screen: screens.NEED_RETIREMENT, labelKey: "retirementPlanner.title", statusKey: "retirement" },
      { screen: screens.NEED_INVESTMENT, labelKey: "investmentPlanner.title", statusKey: "investment" },
    ],
  },
  {
    id: "careerMove",
    icon: BriefcaseBusiness,
    plannerScreens: [{ screen: screens.NEED_LOAN, labelKey: "loanPlanner.title", statusKey: "loan:personal" }],
  },
  {
    id: "somethingElse",
    icon: SlidersHorizontal,
    plannerScreens: [{ screen: screens.NEED_OTHER, labelKey: "otherPlanner.title", statusKey: "other" }],
  },
];

// Strategic Balance (张力全景) replaces the old static strategyGrid — every
// category here reads real confirmed-plan data from
// /api/strategic-balance/snapshot instead of a canned sentence.
const STRATEGIC_CATEGORY_IDS = ["loan", "investment", "savings", "insurance", "credit", "emergency"];
const STRATEGIC_CATEGORY_ICONS = { loan: Building2, investment: LineChart, savings: Banknote, insurance: ShieldCheck, credit: CreditCard, emergency: LockKeyhole };
const STRATEGIC_CATEGORY_SCREENS = {
  loan: screens.NEED_LOAN,
  investment: screens.NEED_INVESTMENT,
  savings: screens.MIRROR,
  insurance: screens.NEED_INSURANCE,
  credit: screens.SPENDING_RISK,
  emergency: screens.NEED_EMERGENCY,
};

// Same 3-band convention as the overall utilization's healthy/tight/at_risk
// (lib/strategic-balance-finance.js), just keyed off a 0-100 score instead
// of a residual-income comparison — one vocabulary for the whole screen.
function scoreBand(score) {
  if (score >= 70) return "healthy";
  if (score >= 40) return "tight";
  return "at_risk";
}

// Every category carries a real 0-100 scoreValue (never null when a health
// score exists) so the UI can always answer "why this band" with an actual
// number, not just a verdict word — this is what was missing before: a
// customer seeing "Tight" had no way to see the score or the threshold
// that produced it.
function buildStrategicCategories(snapshot, healthScores, profile, t) {
  const savingsHealth = healthScores.find((score) => score.id === "savings")?.value ?? 50;
  const debtHealth = healthScores.find((score) => score.id === "debt")?.value ?? 50;
  const insuranceHealth = healthScores.find((score) => score.id === "insurance")?.value ?? 50;
  const emergencyHealth = healthScores.find((score) => score.id === "emergency")?.value ?? 50;

  const loanAvgScore = snapshot.loans.length
    ? Math.round(snapshot.loans.reduce((sum, loan) => sum + loan.futureScore, 0) / snapshot.loans.length)
    : null;
  const investmentAvgScore = snapshot.investments.length
    ? Math.round(snapshot.investments.reduce((sum, pick) => sum + pick.futureScore, 0) / snapshot.investments.length)
    : null;
  const monthsCovered =
    Math.round((numberValue(profile.currentSavings, 18000) / Math.max(numberValue(profile.monthlyExpenses, 3000), 1)) * 10) / 10;

  return {
    loan: {
      id: "loan",
      band: loanAvgScore == null ? "notPlanned" : scoreBand(loanAvgScore),
      scoreValue: loanAvgScore,
      headline:
        loanAvgScore == null
          ? t("lifeGraph.strategicBalance.notPlanned")
          : t("lifeGraph.strategicBalance.headline.loan", { amount: formatSgd(snapshot.loansMonthlyTotal) }),
    },
    investment: {
      id: "investment",
      band: investmentAvgScore == null ? "notPlanned" : scoreBand(investmentAvgScore),
      scoreValue: investmentAvgScore,
      headline:
        investmentAvgScore == null
          ? t("lifeGraph.strategicBalance.notPlanned")
          : t("lifeGraph.strategicBalance.headline.investment", { amount: formatSgd(snapshot.investmentsMonthlyTotal) }),
    },
    savings: {
      id: "savings",
      band: snapshot.savings.length ? scoreBand(savingsHealth) : "notPlanned",
      scoreValue: snapshot.savings.length ? savingsHealth : null,
      headline: snapshot.savings.length
        ? t("lifeGraph.strategicBalance.headline.savings", { count: snapshot.savings.length, amount: formatSgd(snapshot.savingsMonthlyTotal) })
        : t("lifeGraph.strategicBalance.notPlanned"),
    },
    insurance: {
      id: "insurance",
      band: scoreBand(insuranceHealth),
      scoreValue: insuranceHealth,
      headline: t("lifeGraph.strategicBalance.headline.insurance", {
        status: profile.insuranceStatus || t("needDetails.insurance.notReviewed"),
      }),
    },
    credit: {
      id: "credit",
      band: scoreBand(debtHealth),
      scoreValue: debtHealth,
      headline: t("lifeGraph.strategicBalance.headline.credit", {
        amount: formatSgd(numberValue(profile.existingLoans, 18000) + numberValue(profile.creditCardOutstanding, 2400)),
      }),
    },
    emergency: {
      id: "emergency",
      band: scoreBand(emergencyHealth),
      scoreValue: emergencyHealth,
      headline: t("lifeGraph.strategicBalance.headline.emergency", { months: monthsCovered }),
    },
  };
}

// Row + its expanded detail live in one component now — tapping a row
// expands it in place (accordion), rather than opening a small popup
// modal, so the detail content gets the full screen's width to breathe.
function StrategicBalanceAccordionItem({
  category,
  expanded,
  onToggle,
  snapshot,
  profile,
  investmentSlider,
  rebalance,
  rebalancing,
  onSlide,
  onGoToPlanner,
  readOnly = false,
  t,
}) {
  const Icon = STRATEGIC_CATEGORY_ICONS[category.id];
  const sliderMax = Math.max(2000, snapshot.investmentsMonthlyTotal * 2);
  const sliderValue = investmentSlider ?? snapshot.investmentsMonthlyTotal;

  return (
    <div className={expanded ? "strategicAccordionItem expanded" : "strategicAccordionItem"}>
      <button type="button" className="strategicCategoryRow" onClick={onToggle} aria-expanded={expanded}>
        <span className="iconBubble">
          <Icon size={16} />
        </span>
        <span>
          <strong>{t(`lifeGraph.strategicBalance.categories.${category.id}`)}</strong>
          <small>{category.headline}</small>
        </span>
        <b className={`statePill state-${category.band}`}>{t(`lifeGraph.strategicBalance.healthLabel.${category.band}`)}</b>
        <ChevronRight size={15} className={expanded ? "chevronExpanded" : ""} />
      </button>

      {expanded ? (
        <div className="strategicAccordionDetail">
          {category.scoreValue != null ? (
            <div className="scoreExplainer">
              <strong className="numeric">{t("lifeGraph.strategicBalance.scoreLine", { score: category.scoreValue })}</strong>
              <p>
                {category.id === "loan" || category.id === "investment"
                  ? t("lifeGraph.strategicBalance.futureScoreMethod")
                  : t(`lifeGraph.scoreInfo.${category.id === "credit" ? "debt" : category.id}.method`)}
              </p>
            </div>
          ) : null}

          {category.id === "loan" ? (
            snapshot.loans.length ? (
              snapshot.loans.map((loan) => (
                <div className="proofBlock" key={loan.purpose}>
                  <strong>{t(`loanPlanner.purposes.${loan.purpose}`)}</strong>
                  <p>
                    {t("lifeGraph.strategicBalance.loanRateLine", {
                      rate: loan.annualRatePercent,
                      tenure: loan.tenureYears,
                      installment: formatSgd(loan.monthlyInstallment),
                    })}
                  </p>
                  <p>{t(`loanPlanner.archetypeDescriptions.${loan.archetype}`)}</p>
                </div>
              ))
            ) : (
              <p>{t("lifeGraph.strategicBalance.notPlannedDetail.loan")}</p>
            )
          ) : null}

          {category.id === "investment" ? (
            snapshot.investments.length ? (
              <>
                {snapshot.investments.map((pick, index) => (
                  <div className="proofBlock" key={`${pick.name}-${index}`}>
                    <strong>{pick.name}</strong>
                    <p>
                      {t("lifeGraph.strategicBalance.investmentGrowthLine", {
                        contributed: formatSgd(Math.round(pick.totalContributed ?? 0)),
                        end: formatSgd(Math.round(pick.projectedEndValue ?? 0)),
                      })}
                    </p>
                  </div>
                ))}
                {readOnly ? null : (
                  <div className="rebalanceSlider">
                    <span className="sectionLabel">{t("lifeGraph.strategicBalance.tryAdjusting")}</span>
                    <input
                      type="range"
                      min="0"
                      max={sliderMax}
                      step="50"
                      value={sliderValue}
                      onChange={(event) => onSlide(Number(event.target.value))}
                      aria-label={t("lifeGraph.strategicBalance.tryAdjusting")}
                    />
                    <p className="numeric">{t("common.perMonth", { amount: formatSgd(sliderValue) })}</p>
                    {rebalancing ? <p>{t("loading.detail")}</p> : null}
                    {rebalance ? (
                      <div className="rebalanceResult">
                        <SummaryRow label={t("lifeGraph.strategicBalance.newUtilization")} value={`${rebalance.utilization.utilizationPercent}%`} />
                        {rebalance.loans.map((loan) => (
                          <SummaryRow
                            key={loan.purpose}
                            label={`${t(`loanPlanner.purposes.${loan.purpose}`)} ${t("loanPlanner.futureScore")}`}
                            value={`${loan.previousFutureScore} → ${loan.newFutureScore}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <p>{t("lifeGraph.strategicBalance.notPlannedDetail.investment")}</p>
            )
          ) : null}

          {category.id === "savings" ? (
            snapshot.savings.length ? (
              <>
                {snapshot.savings.map((plan) => (
                  <SummaryRow
                    key={plan.label ?? plan.domain}
                    label={plan.label ?? t(`simulator.goals.${plan.domain}`)}
                    value={formatSgd(plan.monthlyContribution)}
                  />
                ))}
                <p>{t("lifeGraph.scoreInfo.savings.data")}</p>
                <p>{t("lifeGraph.strategicBalance.savingsLiteracy")}</p>
              </>
            ) : (
              <p>{t("lifeGraph.strategicBalance.notPlannedDetail.savings")}</p>
            )
          ) : null}

          {category.id === "insurance" ? (
            <>
              <p>
                {t("lifeGraph.strategicBalance.insuranceScoreReason", {
                  status: profile.insuranceStatus || t("needDetails.insurance.notReviewed"),
                  score: category.scoreValue,
                })}
              </p>
              <p>{t("lifeGraph.strategicBalance.insuranceLiteracy")}</p>
              <p>{t("lifeGraph.scoreInfo.insurance.improve")}</p>
            </>
          ) : null}

          {category.id === "credit" ? (
            <>
              <p>{t("lifeGraph.scoreInfo.debt.data")}</p>
              <p>{t("lifeGraph.strategicBalance.creditLiteracy")}</p>
            </>
          ) : null}

          {category.id === "emergency" ? (
            <>
              <p>{t("lifeGraph.scoreInfo.emergency.data")}</p>
              <p>{t("lifeGraph.strategicBalance.emergencyLiteracy")}</p>
              {snapshot.hardshipEvidence.length ? (
                <p>{t("lifeGraph.strategicBalance.hardshipEvidenceLine", { count: snapshot.hardshipEvidence.length })}</p>
              ) : null}
            </>
          ) : null}

          {readOnly ? null : (
            <button type="button" className="primaryButton" onClick={onGoToPlanner}>
              {t("lifeGraph.strategicBalance.nextStep")}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Reached from Life Graph's compact icon entry — a full screen (matching
// every other "go deep on one thing" surface in this app, e.g.
// NeedDetailScreen) instead of a small centered modal, so category detail
// gets real room instead of being cramped into a popup.
function StrategicBalanceScreen({ preferences, t, setActiveScreen }) {
  const profile = getUserProfile(preferences);
  const healthScores = getHealthScores(profile);
  const customGoal = getCustomGoals(preferences)[0];

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openCategory, setOpenCategory] = useState(null);
  const [investmentSlider, setInvestmentSlider] = useState(null);
  const [rebalance, setRebalance] = useState(null);
  const [rebalancing, setRebalancing] = useState(false);
  const rebalanceTimeout = useRef(null);

  const monthlyIncome = numberValue(profile.monthlyIncome, 7500);
  const monthlyExpenses = numberValue(profile.monthlyExpenses, 3500);
  const currentSavings = numberValue(profile.currentSavings, 20000);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ monthlyIncome: String(monthlyIncome), monthlyExpenses: String(monthlyExpenses) });
    // Custom Goal has no server-side session/store like wedding/home/retirement - its confirmed
    // monthly contribution is computed client-side and passed through so Strategic Balance's
    // savings total doesn't silently exclude it.
    if (customGoal?.monthlyContribution) {
      params.set("customGoalMonthly", String(customGoal.monthlyContribution));
      params.set("customGoalName", customGoal.name);
      params.set("customGoalConfirmedAt", customGoal.confirmedAt ?? "");
    }
    fetch(`/api/strategic-balance/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestRebalance = (newAmount) => {
    setInvestmentSlider(newAmount);
    if (rebalanceTimeout.current) clearTimeout(rebalanceTimeout.current);
    rebalanceTimeout.current = setTimeout(() => {
      setRebalancing(true);
      fetch("/api/strategic-balance/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newInvestmentMonthly: newAmount, monthlyIncome, monthlyExpenses, currentSavings }),
      })
        .then((response) => response.json())
        .then((data) => setRebalance(data))
        .catch(() => {})
        .finally(() => setRebalancing(false));
    }, 350);
  };

  const toggleCategory = (id) => {
    setOpenCategory((current) => (current === id ? null : id));
    setRebalance(null);
    setInvestmentSlider(null);
  };

  const categories = snapshot ? buildStrategicCategories(snapshot, healthScores, profile, t) : null;

  return (
    <Screen>
      <Header title={t("lifeGraph.strategicBalance.title")} subtitle={t("lifeGraph.strategicBalance.subtitle")} />
      <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />

      {loading || !snapshot ? (
        <p>{t("loading.detail")}</p>
      ) : (
        <>
          <div className={`utilizationHero band-${snapshot.utilization.healthLabel}`}>
            <div className="utilizationRing">
              <strong className="numeric">{snapshot.utilization.utilizationPercent}%</strong>
            </div>
            <div>
              <span className="utilizationLabel">{t(`lifeGraph.strategicBalance.healthLabel.${snapshot.utilization.healthLabel}`)}</span>
              {snapshot.timeline ? (
                <small className="utilizationTrend">
                  {t("lifeGraph.strategicBalance.trend", { change: Math.abs(snapshot.timeline.changePercentPoints) })}{" "}
                  {snapshot.timeline.direction === "up" ? "↑" : snapshot.timeline.direction === "down" ? "↓" : "→"}
                </small>
              ) : (
                <small className="utilizationTrend">{t("lifeGraph.strategicBalance.noTrendYet")}</small>
              )}
            </div>
          </div>

          <div className="strategicCategoryList">
            {STRATEGIC_CATEGORY_IDS.map((id) => (
              <StrategicBalanceAccordionItem
                key={id}
                category={categories[id]}
                expanded={openCategory === id}
                onToggle={() => toggleCategory(id)}
                snapshot={snapshot}
                profile={profile}
                investmentSlider={investmentSlider}
                rebalance={rebalance}
                rebalancing={rebalancing}
                onSlide={requestRebalance}
                onGoToPlanner={() => setActiveScreen(STRATEGIC_CATEGORY_SCREENS[id])}
                t={t}
              />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

// Concept preview only — no real bank account is connected. Every item here
// is simulated data illustrating what Guardian's existing, already-documented
// promises (avoid harmful product conflicts, avoid over-indebtedness, honest
// drift detection lead time, etc.) would look like with real cross-bank data
// instead of only the OCBC-visible slice.
const crossBankDataIdeas = [
  { id: "spending", icon: CreditCard },
  { id: "insurance", icon: ShieldCheck },
  { id: "debt", icon: AlertTriangle },
  { id: "investment", icon: LineChart },
  { id: "income", icon: FileText },
  { id: "property", icon: Building2 },
  { id: "trend", icon: History },
];

// The "debt" and "investment" cross-bank ideas are the two where this app already has the real
// scoring engine (lib/strategic-balance-finance.js's computeUtilization, lib/investment-finance.js's
// scoreInvestmentCandidate) - so instead of only a hand-written before/after example, these two let
// the customer drive a live "what if" against those real functions, grounded in their actual
// confirmed commitments. The other five items stay illustrative copy, same disclaimer either way:
// no real external bank account is connected.
const DEBT_SLIDER_MAX = 3000;
// A real catalog entry (not a synthetic stub) - scoreInvestmentCandidate reads several fields
// (minInitialInvestmentByMode, suggestedMinHorizonYears) a partial object wouldn't have.
const CONCENTRATION_DEMO_ENTRY = INVESTMENT_CATALOG.find((entry) => entry.id === "global_sp500_etf");

function DebtLiveSimulator({ profile, t }) {
  const [snapshot, setSnapshot] = useState(null);
  const [hypotheticalMonthly, setHypotheticalMonthly] = useState(600);
  const monthlyIncome = numberValue(profile.monthlyIncome, 7500);
  const monthlyExpenses = numberValue(profile.monthlyExpenses, 3500);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ monthlyIncome: String(monthlyIncome), monthlyExpenses: String(monthlyExpenses) });
    fetch(`/api/strategic-balance/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!snapshot) return <p>{t("loading.detail")}</p>;

  const before = snapshot.utilization;
  const after = computeUtilization({
    monthlyIncome,
    monthlyExpenses,
    committedMonthlyTotal: snapshot.committedMonthlyTotal + hypotheticalMonthly,
  });
  const bandChanged = after.healthLabel !== before.healthLabel;

  return (
    <div className="strategicAccordionDetail liveSimBlock">
      <strong className="liveSimTitle">
        <Zap size={14} /> {t("lifeGraph.crossBankData.liveSimLabel")}
      </strong>
      <label className="sectionLabel">
        {t("lifeGraph.crossBankData.hypotheticalDebtLabel", { amount: formatSgd(hypotheticalMonthly) })}
      </label>
      <input
        type="range"
        min="0"
        max={DEBT_SLIDER_MAX}
        step="50"
        value={hypotheticalMonthly}
        onChange={(event) => setHypotheticalMonthly(Number(event.target.value))}
        aria-label={t("lifeGraph.crossBankData.hypotheticalDebtLabel", { amount: formatSgd(hypotheticalMonthly) })}
      />
      <div className="weddingStatChips">
        <span className="statChip">
          {t("lifeGraph.crossBankData.beforeLabel")}: {before.utilizationPercent}% — {t(`lifeGraph.strategicBalance.healthLabel.${before.healthLabel}`)}
        </span>
        <span className={bandChanged ? "statChip warning" : "statChip"}>
          {t("lifeGraph.crossBankData.afterLabel")}: {after.utilizationPercent}% — {t(`lifeGraph.strategicBalance.healthLabel.${after.healthLabel}`)}
        </span>
      </div>
      {bandChanged ? <p className="weddingCarouselHint">{t("lifeGraph.crossBankData.debtBandChangedNote")}</p> : null}
    </div>
  );
}

function InvestmentConcentrationLiveSimulator({ t }) {
  const [concentrationOn, setConcentrationOn] = useState(false);

  const baseScore = scoreInvestmentCandidate(CONCENTRATION_DEMO_ENTRY, {
    riskBand: "balanced",
    holdingsCategories: [],
    availableMonthlyCashflow: 5000,
    horizonYears: 10,
    purchaseMode: "monthly_rsp",
  });
  const concentratedScore = scoreInvestmentCandidate(CONCENTRATION_DEMO_ENTRY, {
    riskBand: "balanced",
    holdingsCategories: ["global_equities"],
    availableMonthlyCashflow: 5000,
    horizonYears: 10,
    purchaseMode: "monthly_rsp",
  });
  const shown = concentrationOn ? concentratedScore : baseScore;
  const scoreDropped = concentrationOn && concentratedScore.suitability_score < baseScore.suitability_score;

  return (
    <div className="strategicAccordionDetail liveSimBlock">
      <strong className="liveSimTitle">
        <Zap size={14} /> {t("lifeGraph.crossBankData.liveSimLabel")}
      </strong>
      <p className="weddingPlanSummary">{t("lifeGraph.crossBankData.concentrationDemoProduct")}</p>
      <button
        type="button"
        className={concentrationOn ? "checkOption selected" : "checkOption"}
        onClick={() => setConcentrationOn((current) => !current)}
      >
        <span>{t("lifeGraph.crossBankData.concentrationToggleLabel")}</span>
        {concentrationOn ? <Check size={14} /> : null}
      </button>
      <div className="weddingStatChips">
        <span className="statChip">
          {t("lifeGraph.crossBankData.diversificationScoreLabel")}: {shown.diversification_score}/100
        </span>
        <span className={scoreDropped ? "statChip warning" : "statChip"}>
          {t("lifeGraph.crossBankData.suitabilityScoreLabel")}: {shown.suitability_score}/100
        </span>
      </div>
      {scoreDropped ? <p className="weddingCarouselHint">{t("lifeGraph.crossBankData.concentrationWithdrawnNote")}</p> : null}
    </div>
  );
}

function CrossBankDataScreen({ t, setActiveScreen, profile }) {
  const [openItem, setOpenItem] = useState(null);

  return (
    <Screen>
      <Header title={t("lifeGraph.crossBankData.title")} subtitle={t("lifeGraph.crossBankData.subtitle")} />
      <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />

      <section className="trustNote compactTrustNote">
        <Info size={17} />
        <p>{t("lifeGraph.crossBankData.disclaimer")}</p>
      </section>

      <section className="financialStrategyPanel">
        <span className="sectionLabel">{t("lifeGraph.dataProviders.title")}</span>
        <div className="strategyList">
          {LIFE_GRAPH_PROVIDERS.map((provider) => (
            <article className="strategyItem" key={provider.id}>
              <span className="iconBubble">
                <CheckCircle2 size={16} />
              </span>
              <div>
                <strong>{t(provider.labelKey)}</strong>
                <small>{t("lifeGraph.dataProviders.activeDetail")}</small>
              </div>
              <b className="statePill state-trusted">{t("lifeGraph.dataProviders.active")}</b>
            </article>
          ))}
          <article className="strategyItem">
            <span className="iconBubble">
              <Landmark size={16} />
            </span>
            <div>
              <strong>{t("lifeGraph.dataProviders.otherBanks")}</strong>
              <small>{t("lifeGraph.dataProviders.otherBanksDetail")}</small>
            </div>
            <b className="statePill">{t("lifeGraph.dataProviders.notConnected")}</b>
          </article>
        </div>
      </section>

      <div className="strategicCategoryList">
        {crossBankDataIdeas.map(({ id, icon: Icon }) => {
          const expanded = openItem === id;
          return (
            <div className={expanded ? "strategicAccordionItem expanded" : "strategicAccordionItem"} key={id}>
              <button
                type="button"
                className="strategicCategoryRow"
                onClick={() => setOpenItem(expanded ? null : id)}
                aria-expanded={expanded}
              >
                <span className="iconBubble">
                  <Icon size={16} />
                </span>
                <span>
                  <strong>{t(`lifeGraph.crossBankData.items.${id}.title`)}</strong>
                  <small>{t(`lifeGraph.crossBankData.items.${id}.linksTo`)}</small>
                </span>
                <ChevronRight size={15} className={expanded ? "chevronExpanded" : ""} />
              </button>

              {expanded ? (
                <div className="strategicAccordionDetail">
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.crossBankData.inputLabel")}</strong>
                    <p>{t(`lifeGraph.crossBankData.items.${id}.input`)}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.crossBankData.processLabel")}</strong>
                    <p>{t(`lifeGraph.crossBankData.items.${id}.process`)}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.crossBankData.outputLabel")}</strong>
                    <p>{t(`lifeGraph.crossBankData.items.${id}.output`)}</p>
                  </div>
                </div>
              ) : null}
              {expanded && id === "debt" ? <DebtLiveSimulator profile={profile} t={t} /> : null}
              {expanded && id === "investment" ? <InvestmentConcentrationLiveSimulator t={t} /> : null}
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

// Rate/fee figures are real, publicly published OCBC numbers (checked July 2026) - not
// placeholders. honestNoteKey is only set where there's a real, sourced comparison to make;
// it is never invented to hit a quota of "honest" cards.
const productRecommendations = [
  {
    id: "ocbc360",
    name: "OCBC 360 Account",
    category: "savings",
    categoryKey: "lifeGraph.productFit.categories.savings",
    whyKey: "lifeGraph.productFit.why.ocbc360",
    supportsKey: "lifeGraph.productFit.supports.ocbc360",
    impactKey: "lifeGraph.productFit.impact.ocbc360",
    rateKey: "lifeGraph.productFit.rates.ocbc360",
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
    rateKey: "lifeGraph.productFit.rates.monthlySavings",
    honestNoteKey: "lifeGraph.productFit.honestNote.monthlySavings",
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
    rateKey: "lifeGraph.productFit.rates.homeLoan",
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
    rateKey: "lifeGraph.productFit.rates.roboInvest",
    honestNoteKey: "lifeGraph.productFit.honestNote.roboInvest",
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
    rateKey: "lifeGraph.productFit.rates.greatTerm",
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
    rateKey: "lifeGraph.productFit.rates.paynowGiro",
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
    rateKey: "lifeGraph.productFit.rates.ocbc365",
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
  const { healthScores, selectedGoalIds, added, benefits } = ctx;
  const relevantGoal = product.relevantGoals.find((goal) => selectedGoalIds.includes(goal));
  if (!relevantGoal) return { state: "notApplicable", relevantGoal: null, conflict: null };

  const conflict = getProductConflict(product, healthScores);
  if (conflict) return { state: "blocked", relevantGoal, conflict };

  if (added) return { state: "readyForConsent", relevantGoal, conflict: null, accepted: true };

  // Anchor tier (both Follow-Through and Guardian Reputation at their top band) skips the
  // mandatory human review on loans/insurance - a real, dual-gated relationship benefit, not a
  // generic "trusted customer" flag.
  const reviewSkipped = Boolean(benefits?.skipReviewCategories) && productCategoriesRequiringReview.has(product.category);
  if (reviewSkipped) return { state: "readyForConsent", relevantGoal, conflict: null, reviewSkipped: true };

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
    humanReview: resultInfo.reviewSkipped
      ? t("lifeGraph.productFit.evidence.humanReviewSkipped")
      : productCategoriesRequiringReview.has(product.category)
        ? t("lifeGraph.productFit.evidence.humanReviewRequired")
        : t("lifeGraph.productFit.evidence.humanReviewNotRequired"),
  };
}

// RoboInvest is the one product with a real, sourced dynamic rate: its fee actually moves with the
// dual-gated relationship tier (see getRelationshipBenefits). At tier 0 this returns the original
// static copy (0.88%, "roughly double Endowus"); at tier 1-3 it returns the discounted rate and an
// honest note that the gap to market is narrowing, not closed, until Anchor tier.
function getRoboInvestBenefitCopy(benefits, t) {
  if (!benefits || benefits.tier === 0) {
    return { rate: t("lifeGraph.productFit.rates.roboInvest"), honestNote: t("lifeGraph.productFit.honestNote.roboInvest") };
  }
  const rateDisplay = benefits.roboInvestFeePercent.toFixed(2);
  return {
    rate: t(`lifeGraph.productFit.rates.roboInvestTier${benefits.tier}`, { rate: rateDisplay }),
    honestNote: t(`lifeGraph.productFit.honestNote.roboInvestTier${benefits.tier}`),
  };
}

// Reached from Life Graph's compact icon entry - a full screen instead of a cramped inline panel,
// so there's room to show the full evidence chain inline (expand-in-place) instead of hiding it
// behind a "View Evidence" modal that most people never open.
const PEER_BENCHMARK_METRIC_IDS = ["emergency", "savingsRate", "debtToIncome", "investmentToIncome"];
const PEER_BENCHMARK_FORMATTERS = {
  emergency: (value) => `${value}mo`,
  savingsRate: (value) => `${value}%`,
  debtToIncome: (value) => `${value}%`,
  investmentToIncome: (value) => `${value}x`,
};

// Anonymous peer comparison concept preview - see lib/peer-benchmark.js's header comment for why
// the "peer" figures are an illustrative model, not a real aggregate customer query.
function PeerBenchmarkScreen({ preferences, t, setActiveScreen }) {
  const profile = getUserProfile(preferences);
  const age = numberValue(profile.age, 28);
  const monthlyIncome = getProfileAmount(profile, "monthlyIncome", 11500);
  const monthlyExpenses = getProfileAmount(profile, "monthlyExpenses", 4500);
  const currentSavings = getProfileAmount(profile, "currentSavings", 85000);
  const loans = getProfileAmount(profile, "existingLoans", 18000);
  const card = getProfileAmount(profile, "creditCardOutstanding", 2400);
  const investments = getProfileAmount(profile, "investments", 15000);
  const benchmark = computePeerBenchmark({ age, monthlyIncome, monthlyExpenses, currentSavings, debtLoad: loans + card, investments });

  return (
    <Screen>
      <Header title={t("lifeGraph.peerBenchmark.title")} subtitle={t("lifeGraph.peerBenchmark.subtitle")} />
      <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />

      <section className="trustNote compactTrustNote">
        <Info size={17} />
        <p>{t("lifeGraph.peerBenchmark.disclaimer")}</p>
      </section>

      <section className="trustNote compactTrustNote">
        <UserRound size={17} />
        <p>
          {t("lifeGraph.peerBenchmark.cohortNote", {
            age: t(`lifeGraph.peerBenchmark.ageBuckets.${benchmark.ageBucket}`),
            income: t(`lifeGraph.peerBenchmark.incomeBuckets.${benchmark.incomeBucket}`),
          })}
        </p>
      </section>

      <div className="strategicCategoryList">
        {PEER_BENCHMARK_METRIC_IDS.map((id) => {
          const data = benchmark[id];
          const format = PEER_BENCHMARK_FORMATTERS[id];
          return (
            <article className="proofBlock" key={id}>
              <strong>{t(`lifeGraph.peerBenchmark.metrics.${id}.label`)}</strong>
              <div className="weddingStatChips">
                <span className="statChip">
                  {t("lifeGraph.peerBenchmark.youLabel")}: {format(data.actual)}
                </span>
                <span className="statChip">
                  {t("lifeGraph.peerBenchmark.peersLabel")}: {format(data.typical)}
                </span>
              </div>
              <p>{t(data.aheadOfPeers ? `lifeGraph.peerBenchmark.metrics.${id}.ahead` : `lifeGraph.peerBenchmark.metrics.${id}.behind`)}</p>
            </article>
          );
        })}
      </div>
    </Screen>
  );
}

// Life-transition view - the same dedicated planners, organized around what's happening in the
// customer's life instead of by bank product category. An additional way to navigate, reachable
// from Home; does not replace Mirror's existing product-first Life Goal Selection grid.
function LifeJourneyScreen({ setActiveScreen, preferences, t }) {
  const profile = getUserProfile(preferences);
  const healthScores = getHealthScores(profile);
  const [openItem, setOpenItem] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/life-journey")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setStatus(data.status);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Emergency readiness has no dedicated session/store (see
  // lib/life-journey-context.js's comment on insurance for why) - the real
  // signal is the same asset-ledger-derived health score every other screen
  // already shows, computed here client-side rather than duplicated
  // server-side.
  const emergencyScore = healthScores.find((score) => score.id === "emergency")?.value ?? null;
  const mergedStatus = {
    ...status,
    emergency:
      emergencyScore == null
        ? null
        : {
            state: emergencyScore >= 80 ? "confirmed" : emergencyScore >= 60 ? "in_progress" : "not_started",
            score: emergencyScore,
          },
  };

  function describePlannerStatus(statusKey) {
    const entry = mergedStatus[statusKey];
    if (!entry) return null;
    if (entry.state === "not_started") return t("lifeJourney.status.notStarted");
    if (statusKey === "emergency") return t("lifeJourney.status.emergencyScore", { score: entry.score });
    if (statusKey === "investment" && entry.count) {
      return t("lifeJourney.status.investmentSummary", { count: entry.count, amount: formatSgd(entry.amount ?? 0) });
    }
    const label = entry.state === "confirmed" ? t("lifeJourney.status.confirmed") : t("lifeJourney.status.inProgress");
    return entry.amount != null ? `${label} — ${formatSgd(Math.round(entry.amount))}` : label;
  }

  return (
    <Screen>
      <Header title={t("lifeJourney.title")} subtitle={t("lifeJourney.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

      <section className="trustNote compactTrustNote">
        <Info size={17} />
        <p>{t("lifeJourney.disclaimer")}</p>
      </section>

      <div className="strategicCategoryList">
        {LIFE_MOMENTS.map(({ id, icon: Icon, plannerScreens }) => {
          const expanded = openItem === id;
          return (
            <div className={expanded ? "strategicAccordionItem expanded" : "strategicAccordionItem"} key={id}>
              <button
                type="button"
                className="strategicCategoryRow"
                onClick={() => setOpenItem(expanded ? null : id)}
                aria-expanded={expanded}
              >
                <span className="iconBubble">
                  <Icon size={16} />
                </span>
                <span>
                  <strong>{t(`lifeJourney.moments.${id}.title`)}</strong>
                  <small>{t(`lifeJourney.moments.${id}.subtitle`)}</small>
                </span>
                <ChevronRight size={15} className={expanded ? "chevronExpanded" : ""} />
              </button>

              {expanded ? (
                <div className="strategicAccordionDetail">
                  <p>{t(`lifeJourney.moments.${id}.body`)}</p>
                  {plannerScreens.map((planner) => {
                    const statusText = describePlannerStatus(planner.statusKey);
                    return (
                      <button type="button" className="secondaryButton" key={planner.screen} onClick={() => setActiveScreen(planner.screen)}>
                        <span>
                          {t(planner.labelKey)}
                          {statusText ? <small style={{ display: "block", fontWeight: 400 }}>{statusText}</small> : null}
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

function ProductFitScreen({ preferences, setPreferences, simulatorInputs, simulatorActionStates, t, setActiveScreen }) {
  const [openProductId, setOpenProductId] = useState(null);
  const [notice, setNotice] = useState("");
  const [followThrough, setFollowThrough] = useState(null);
  const profile = getUserProfile(preferences);
  const customGoals = getCustomGoals(preferences);
  const healthScores = getHealthScores(profile);
  const selectedGoalIds = getProfileGoalIds(profile, customGoals);

  // Same dual-score computation as RelationshipLedgerScreen / FutureSelfGuardian - Product Fit
  // benefits (RoboInvest fee tier, RM-review skip) are gated on the identical two ledgers shown
  // there, not a third parallel calculation.
  const { reputationBand } = computeGuardianReputation(preferences, simulatorInputs, simulatorActionStates);

  useEffect(() => {
    let cancelled = false;
    const params = getFollowThroughQueryParams(preferences);
    fetch(`/api/follow-through/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setFollowThrough(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const followThroughBand = followThrough?.band ?? "newRelationship";
  const benefits = getRelationshipBenefits(followThroughBand, reputationBand);

  const visibleProducts = productRecommendations
    .map((product) => {
      const added = Boolean(preferences.futurePlanProducts?.includes(product.id));
      const resultInfo = getProductState(product, { healthScores, selectedGoalIds, added, benefits });
      return { product, resultInfo };
    })
    .filter(({ resultInfo }) => resultInfo.state !== "notApplicable");

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
        source: "productFit",
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
      <Header title={t("lifeGraph.productFit.title")} subtitle={t("lifeGraph.productFit.purpose")} />
      <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />
      <NoticeBanner text={notice} />

      <section className="trustNote compactTrustNote">
        <Info size={17} />
        <p>{t("lifeGraph.productFit.disclaimer")}</p>
      </section>

      <div className="productFitList">
        {visibleProducts.map(({ product, resultInfo }) => {
          const Icon = product.icon;
          const evidence = getProductEvidence(product, { profile, healthScores, resultInfo }, t);
          const expanded = openProductId === product.id;
          return (
            <article className={resultInfo.accepted ? "productFitCard added" : "productFitCard"} key={product.id}>
              <button
                type="button"
                className="productFitHead"
                onClick={() => setOpenProductId(expanded ? null : product.id)}
                aria-expanded={expanded}
              >
                <span className="iconBubble">
                  <Icon size={16} />
                </span>
                <div>
                  <strong>{product.name}</strong>
                  <small>{t(product.categoryKey)}</small>
                </div>
                {resultInfo.accepted ? <CheckCircle2 size={16} /> : null}
                <ChevronRight size={15} className={expanded ? "chevronExpanded" : ""} />
              </button>

              <div className="productStateRow">
                <b className={`statePill state-${resultInfo.state}`}>
                  {t(`lifeGraph.productFit.state.${resultInfo.state}`)}
                </b>
                <span className="prototypeTag">{t("lifeGraph.productFit.prototypeTag")}</span>
              </div>

              <div className="proofBlock">
                <strong>{t("lifeGraph.productFit.rateLabel")}</strong>
                <p>{product.id === "roboInvest" ? getRoboInvestBenefitCopy(benefits, t).rate : t(product.rateKey)}</p>
              </div>

              {product.id === "roboInvest" ? (
                <section className="adviceOnlyPanel">
                  <AlertTriangle size={18} />
                  <p>{getRoboInvestBenefitCopy(benefits, t).honestNote}</p>
                </section>
              ) : product.honestNoteKey ? (
                <section className="adviceOnlyPanel">
                  <AlertTriangle size={18} />
                  <p>{t(product.honestNoteKey)}</p>
                </section>
              ) : null}

              {product.id === "ocbc360" && benefits.relaxedThreshold ? (
                <section className="trustNote compactTrustNote">
                  <Award size={17} />
                  <p>{t("lifeGraph.productFit.relationshipNote.ocbc360")}</p>
                </section>
              ) : null}

              {expanded ? (
                <>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.productFit.evidence.goalSupportedLabel")}</strong>
                    <p>{evidence.goalSupported}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.productFit.evidence.dataUsedLabel")}</strong>
                    <p>{evidence.dataUsed}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.productFit.evidence.suitabilityReasonLabel")}</strong>
                    <p>{evidence.suitabilityReason}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.productFit.evidence.productRiskLabel")}</strong>
                    <p>{evidence.productRisk}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.productFit.evidence.alternativeLabel")}</strong>
                    <p>{evidence.alternativeConsidered}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.productFit.evidence.conflictCheckLabel")}</strong>
                    <p>{evidence.conflictCheck}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.productFit.evidence.expectedImpactLabel")}</strong>
                    <p>{evidence.expectedImpact}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.productFit.evidence.limitationLabel")}</strong>
                    <p>{evidence.limitation}</p>
                  </div>
                  <div className="proofBlock">
                    <strong>{t("lifeGraph.productFit.evidence.humanReviewLabel")}</strong>
                    <p>{evidence.humanReview}</p>
                  </div>
                </>
              ) : (
                <div className="proofBlock">
                  <strong>{t("lifeGraph.productFit.evidence.suitabilityReasonLabel")}</strong>
                  <p>{evidence.suitabilityReason}</p>
                </div>
              )}

              <button
                type="button"
                className="secondaryButton"
                onClick={() => setOpenProductId(expanded ? null : product.id)}
              >
                {expanded ? t("lifeGraph.productFit.hideEvidence") : t("lifeGraph.productFit.viewEvidence")}
              </button>

              <div className="buttonPair compactButtons">
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
                <strong>
                  {record.source === "hardshipRecovery"
                    ? t("needDetails.emergency.escalation.historyItem", { action: record.title })
                    : t("lifeGraph.productFit.escalationHistoryItem", { product: record.productName, goal: record.goal })}
                </strong>
                <small>{record.reason}</small>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </Screen>
  );
}

// Guardian Reputation Score: 30% Consent Respect + 25% Goal Protection Rate + 20% Recovery Success
// + 15% Recommendation Outcome Accuracy + 10% Human Escalation Quality (08_Guardian_Operating_Principles.md).
// This prototype has no persistent event ledger yet (that lands with Goal Ledger Lifecycle), so each
// component is derived from the closest real signal already tracked in the app rather than left static.
function getGuardianReputationScore(ctx) {
  const {
    preferences,
    healthScores,
    spendingRisk,
    approvedCount,
    decidedCount,
    approvedServiceCount,
    predictiveAccuracy = null,
    investmentAccuracy = null,
  } = ctx;

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

  // Whether Future Mirror's Bull/Bear/Judge debates actually called it right - only
  // present once at least one debate has a real resolved outcome (lib/mirror-outcome-resolver.js);
  // excluded from the weighted average (not defaulted to a guess) until then, same
  // "insufficient data is excluded, not scored as 0" pattern as Follow-Through Score.
  // investmentAccuracy is the same real closed loop for confirmed investment picks
  // (app/api/investment/outcomes) - did the real live price stay within the
  // Accuracy Guarantee's own real threshold of what was projected, not a
  // separate invented bar.
  const components = [
    { value: consentRespect, weight: 0.3 },
    { value: goalProtectionRate, weight: 0.25 },
    { value: recoverySuccess, weight: 0.2 },
    { value: recommendationOutcomeAccuracy, weight: 0.15 },
    { value: humanEscalationQuality, weight: 0.1 },
    { value: predictiveAccuracy, weight: 0.15 },
    { value: investmentAccuracy, weight: 0.15 },
  ].filter((component) => component.value != null);
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const score = clampScore(components.reduce((sum, component) => sum + component.value * component.weight, 0) / totalWeight);

  return {
    score,
    consentRespect,
    goalProtectionRate,
    recoverySuccess,
    recommendationOutcomeAccuracy,
    humanEscalationQuality,
    predictiveAccuracy,
    investmentAccuracy,
  };
}

function getReputationBand(score) {
  if (score < 40) return "restricted";
  if (score < 60) return "underReview";
  if (score < 75) return "buildingTrust";
  if (score < 90) return "trusted";
  return "highlyTrusted";
}

// Dual-gated relationship benefits: Follow-Through Score (did the CUSTOMER keep their word) and
// Guardian Reputation Score (did the AI's own recommendations hold up) are deliberately two
// separate ledgers, not one blended number - a customer's discount should never be dragged down
// by an unrelated AI misjudgment, and Guardian's own track record should never be papered over by
// a customer who happens to save consistently. Every real benefit requires BOTH sides to qualify;
// if either side drops, the benefit drops with it - the relationship has to stay healthy on both
// sides, not just accumulate forever.
const FOLLOW_THROUGH_BAND_RANK = { newRelationship: 0, building: 1, reliable: 2, steadfast: 3, anchor: 4 };
const REPUTATION_BAND_RANK = { restricted: 0, underReview: 1, buildingTrust: 2, trusted: 3, highlyTrusted: 4 };

// Guardian Reputation Score needs the same handful of client-only inputs (visible action cards,
// approved/skipped counts, approved OCBC service count) everywhere it's read - factored out once
// FutureSelfGuardian, ProductFitScreen, RelationshipLedgerScreen, and Home's stat row all needed
// the identical computation rather than re-deriving it four separate times.
// Reads predictiveAccuracy from preferences.mirrorOutcomeStats (real Mirror
// debate accountability data, fetched once at app mount - see the auth-
// resolve effect) rather than taking it as a per-call-site argument, so
// every one of this function's ~6 call sites sees the exact same number
// instead of only the one screen that used to fetch it separately.
function computeGuardianReputation(preferences, simulatorInputs, simulatorActionStates) {
  const predictiveAccuracy = preferences?.mirrorOutcomeStats?.predictiveAccuracy ?? null;
  const investmentAccuracy = preferences?.investmentOutcomeStats?.accuracy?.accuratePercent ?? null;
  const profile = getUserProfile(preferences);
  const healthScores = getHealthScores(profile);
  const spendingRisk = getSpendingRisk(profile);
  const selectedGoalIds = getSelectedGoalIds(simulatorInputs);
  const visibleActionCards = simulatorActionCards.filter(({ id }) => {
    if (id === "mortgageReadiness") return selectedGoalIds.includes("home");
    if (id === "insuranceReview") return selectedGoalIds.includes("family") || selectedGoalIds.includes("home");
    if (id === "investmentPlan") return selectedGoalIds.includes("investment") || selectedGoalIds.includes("retirement");
    return true;
  });
  const approvedActionCount = visibleActionCards.filter(({ id }) => simulatorActionStates[id] === "approved").length;
  const skippedActionCount = visibleActionCards.filter(({ id }) => simulatorActionStates[id] === "skipped").length;
  const approvedServiceCount = ocbcServiceActions.filter(({ id }) => simulatorActionStates[id] === "approved").length;
  const reputation = getGuardianReputationScore({
    preferences,
    healthScores,
    spendingRisk,
    approvedCount: approvedActionCount,
    decidedCount: approvedActionCount + skippedActionCount,
    approvedServiceCount,
    predictiveAccuracy,
    investmentAccuracy,
  });
  return { reputation, reputationBand: getReputationBand(reputation.score) };
}

// Follow-Through Score's query params are client-only signals (everAtRisk from goal ledger state,
// custom goal count) the server can't derive on its own - factored out for the same reason as
// computeGuardianReputation above.
function getFollowThroughQueryParams(preferences) {
  const customGoals = getCustomGoals(preferences);
  const ledgerStates = Object.values(preferences.goalLedger ?? {}).map((entry) => entry.state);
  const everAtRisk = ledgerStates.some((state) => ["atRisk", "recovery", "escalated"].includes(state));
  return new URLSearchParams({ everAtRisk: String(everAtRisk), customGoalCount: String(customGoals.length) });
}

function getRelationshipBenefits(followThroughBand, reputationBand) {
  const ftRank = FOLLOW_THROUGH_BAND_RANK[followThroughBand] ?? 0;
  const repRank = REPUTATION_BAND_RANK[reputationBand] ?? 0;

  if (ftRank >= 4 && repRank >= 4) {
    return { tier: 3, roboInvestFeePercent: 0.45, skipReviewCategories: true, relaxedThreshold: true };
  }
  if (ftRank >= 3 && repRank >= 3) {
    return { tier: 2, roboInvestFeePercent: 0.5, skipReviewCategories: false, relaxedThreshold: true };
  }
  if (ftRank >= 2 && repRank >= 3) {
    return { tier: 1, roboInvestFeePercent: 0.65, skipReviewCategories: false, relaxedThreshold: false };
  }
  return { tier: 0, roboInvestFeePercent: 0.88, skipReviewCategories: false, relaxedThreshold: false };
}

// Shared across every screen that needs to gate a real benefit (Loan Planner's rate discount,
// Guardian Auto Top-Up here) on the dual-gated relationship tier - factored into one hook once a
// fourth savings-plan screen needed the identical fetch-effect + computeGuardianReputation +
// getRelationshipBenefits sequence, rather than copy-pasting it a fourth time.
function useRelationshipTier(preferences, simulatorInputs, simulatorActionStates) {
  const [followThrough, setFollowThrough] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const params = getFollowThroughQueryParams(preferences);
    fetch(`/api/follow-through/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setFollowThrough(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const { reputationBand } = computeGuardianReputation(preferences, simulatorInputs, simulatorActionStates);
  const followThroughBand = followThrough?.band ?? "newRelationship";
  const tier = getRelationshipBenefits(followThroughBand, reputationBand).tier;
  // Real judgment-calibration signal (Follow-Through Score's judgmentCalibration
  // component, lib/follow-through-finance.js) - null until the customer has an
  // actual resolved Mirror rebuttal, same "insufficient data, not a guess"
  // rule the component itself already follows. Exposed alongside tier so
  // Guardian Auto Top-Up can unlock a real stretch amount from it, not just
  // gate on the aggregate Follow-Through band.
  const judgmentCalibrationScore = followThrough?.components?.judgmentCalibration?.value ?? null;
  return { tier, judgmentCalibrationScore };
}

// Confidence Model (04_AI_Agent.md "AI confidence must be explicit and meaningful"): confidence
// reflects how much of the profile is customer-confirmed (edited away from an assumed default)
// versus still an unverified assumption, weighted against Guardian's own proven reputation - not a
// fixed constant shown regardless of what data the recommendation is actually built on.
const confidenceTrackedFields = [
  "age",
  "occupation",
  // statedMonthlyIncome, not monthlyIncome - the latter is now a COMPUTED
  // field (smoothed from real income history), comparing it against a
  // static default would be meaningless; statedMonthlyIncome is the raw
  // customer-typed value mergeDefaults passes through untouched, same as
  // every other field in this list.
  "statedMonthlyIncome",
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

// Same amount/months-remaining division used by getRecommendedMonthlySaving's custom-goal branch,
// pulled out so the Custom Goal modal can show the identical number live, before a simulator run.
function computeCustomGoalMonthlyPlan(amount, targetDate) {
  const monthsRemaining = monthCountUntil(targetDate);
  const monthlyContribution = Math.max(50, Math.ceil(numberValue(amount, 6000) / monthsRemaining / 50) * 50);
  return { monthsRemaining, monthlyContribution };
}

function formatMonthDate(value, fallback) {
  if (!value) return fallback;
  const [year, month] = String(value).split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
}

function shiftMonthString(monthStr, delta) {
  const [year, month] = String(monthStr).split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthAbbrev(monthStr) {
  const [year, month] = String(monthStr).split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-SG", { month: "short" });
}

// Last N calendar months ending today, and whether ANY domain had a check-in
// that month - a plain activity record, not a graded pass/fail. Gaps render as
// neutral empty cells, never a warning colour, per the Constitution's "calm
// language even when warning about risk" and "no fear manipulation" rules.
function getRecentMonthsGrid(timeline, count = 6) {
  const activeMonths = new Set(timeline.map((entry) => entry.month));
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const grid = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    grid.push({ month: shiftMonthString(currentMonth, -i), active: activeMonths.has(shiftMonthString(currentMonth, -i)) });
  }
  return grid;
}

// Counts consecutive months of activity ending at the customer's OWN most
// recent check-in, not today's calendar month - a customer who checked in
// last month but hasn't yet this month still sees their real streak instead
// of an implied "you missed it" state. There is deliberately no "streak
// broken" UI state anywhere this is used - a lapsed streak just quietly
// starts counting again from zero next check-in, never called out.
function computeActiveStreakMonths(timeline) {
  const activeMonths = new Set(timeline.map((entry) => entry.month));
  if (!activeMonths.size) return 0;
  let cursor = [...activeMonths].sort().at(-1);
  let streak = 0;
  while (activeMonths.has(cursor)) {
    streak += 1;
    cursor = shiftMonthString(cursor, -1);
  }
  return streak;
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

function getAgentReasoning(inputs, t) {
  const primaryType = getPrimaryGoal(inputs);
  const primaryGoal = getGoalLabel(primaryType === "car" ? "custom" : primaryType, inputs, t);
  const selected = getSelectedGoalIds(inputs).map((goalId) => getGoalLabel(goalId, inputs, t)).join(", ");
  const customAmount = formatSgd(numberValue(inputs.customTargetAmount, numberValue(inputs.weddingBudget, 35000)));
  const monthly = formatSgd(Math.ceil(numberValue(inputs.customTargetAmount, 6000) / Math.max(monthCountUntil(inputs.customTargetDate), 1) / 50) * 50);

  if (primaryType === "custom" || primaryType === "car") {
    const category = inputs.customCategory?.trim() || "Lifestyle";
    const notes = inputs.customNotes?.trim();
    // Category and notes used to be captured on the form and then never read again by anything -
    // the customer's own context vanished the moment they hit Run. Feeding them into the situation
    // line is what actually proves they were read, instead of just stored and discarded.
    const situation = notes
      ? t("simulator.reasoning.situationCustomWithNotes", { goal: primaryGoal, category, notes })
      : t("simulator.reasoning.situationCustom", { goal: primaryGoal, category });
    return {
      situation,
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
  accessibility: {
    simpleMode: false,
  },
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
  // Client-side mirror of the real income_entries DB table (lib/income-store.js) -
  // the table is the source of truth, this is refreshed from it on every
  // auth-resolve (see the fetch alongside /api/preferences). Living inside
  // `preferences` (rather than a separate prop threaded through every screen)
  // means every one of the ~20 real getUserProfile() consumers picks up real
  // income history for free, since preferences already reaches all of them.
  incomeHistory: [],
  // Client-side mirror of the real expense_entries DB table (lib/expense-
  // store.js) - same reasoning as incomeHistory above.
  expenseHistory: [],
  // Client-side mirror of the real `assets` DB table (lib/asset-store.js) -
  // same reasoning as incomeHistory above: the table is the source of truth,
  // refreshed on every auth-resolve, and living inside `preferences` means
  // getUserProfile()'s manualEntryProvider can fold real asset-derived sums
  // into the computed profile for every one of its ~20 consumers for free.
  assets: [],
  // Real Mirror debate accountability stats (lib/mirror-outcome-resolver.js's
  // resolveDebateOutcomes, via /api/mirror/outcomes) - refreshed on every
  // auth-resolve so resolution runs on real app load, not only when the
  // customer happens to visit Relationship Ledger. Living inside
  // `preferences` means computeGuardianReputation reads the same number
  // everywhere it's called, instead of the 5 different call sites each
  // deciding independently whether to fetch it.
  mirrorOutcomeStats: null,
  // Real confirmed-investment-pick accuracy (app/api/investment/outcomes) -
  // same caching rationale as mirrorOutcomeStats above.
  investmentOutcomeStats: null,
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

// Standalone (was previously a ProfileScreen-local closure) so Goal
// Marketplace can toggle the same real profile.goals signal the settings
// checkbox grid always has, instead of duplicating the merge logic.
function toggleProfileGoal(setPreferences, goal) {
  setPreferences((current) => {
    // Raw stored profile, not getUserProfile(current) - see updateProfileField.
    const currentProfile = mergeDefaults(defaultProfile, current.profile);
    const nextGoals = { ...currentProfile.goals, [goal]: !currentProfile.goals?.[goal] };
    if (!Object.values(nextGoals).some(Boolean)) nextGoals[goal] = true;
    return { ...current, profile: { ...currentProfile, goals: nextGoals } };
  });
}

function applyProfileMigration(preferences, storedPreferences) {
  if (storedPreferences?.profileVersion === currentProfileVersion) return preferences;
  // First-ever load (nothing saved yet): seed the default demo profile.
  // Otherwise a customer's own edits must survive future version bumps - only stamp the
  // new version number, never overwrite displayName/profile that mergeDefaults already preserved.
  if (!storedPreferences) {
    return { ...preferences, profileVersion: currentProfileVersion, displayName: "Karina", profile: defaultProfile };
  }
  // A profile stored before the income-history feature still has the old
  // `monthlyIncome` key (the customer's own typed figure) and no
  // `statedMonthlyIncome` yet - carry the real value over so it isn't
  // silently lost. Additive on top of everything mergeDefaults already
  // preserved, not a full profile replace.
  const oldProfile = storedPreferences.profile;
  if (oldProfile && oldProfile.monthlyIncome != null && oldProfile.statedMonthlyIncome == null) {
    return {
      ...preferences,
      profileVersion: currentProfileVersion,
      profile: { ...preferences.profile, statedMonthlyIncome: oldProfile.monthlyIncome },
    };
  }
  return { ...preferences, profileVersion: currentProfileVersion };
}

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

// Life Graph data-provider abstraction (OpenBB pattern): Life Graph reads customer
// data through a registry of providers implementing a common shape, not one
// hardcoded source. Today there is exactly one REAL provider - the customer's own
// manually entered profile (no external bank aggregation exists in this prototype,
// despite the "SGFinDex" framing in the product docs - CrossBankDataScreen's ideas
// are disclosed concept-previews, not a live integration). Adding a second real
// source later means implementing this same { getProfile, getCustomGoals } shape
// and registering it below - not rewriting the ~20 call sites that read through
// getUserProfile()/getCustomGoals() throughout this file.
const manualEntryProvider = {
  id: "manualEntry",
  labelKey: "lifeGraph.dataProviders.manualEntry",
  getProfile: (preferences) => {
    const merged = mergeDefaults(defaultProfile, preferences?.profile);
    // `monthlyIncome` here is the EFFECTIVE number every real consumer in the
    // app reads (Life Graph health scores, peer benchmark, Mirror, every
    // domain's stage1/stage2 conversation, hardship, loan confirm) - smoothed
    // from real preferences.incomeHistory once enough real entries exist,
    // the customer's own statedMonthlyIncome verbatim otherwise (zero
    // behavior change for a customer who never logs a single entry).
    const smoothed = computeSmoothedIncome(preferences?.incomeHistory, numberValue(merged.statedMonthlyIncome, 7500));
    // Same real technique, mirrored for the expense side (lib/expense-
    // finance.js) - every real consumer of profile.monthlyExpenses picks
    // up the real smoothed figure for free once expense history exists,
    // zero behavior change for a customer who never logs one.
    const smoothedExpenses = computeSmoothedExpenses(preferences?.expenseHistory, numberValue(merged.monthlyExpenses, 3600));
    // Same technique as monthlyIncome smoothing above, applied to the Asset
    // Profile ledger (lib/asset-store.js, cached client-side as
    // preferences.assets): once the customer has logged at least one real
    // itemized asset, `currentSavings`/`investments`/`insuranceStatus`/
    // `insuranceCoverageAmount` become the REAL computed sums instead of the
    // old flat manually-typed numbers - every one of getHealthScores()'s ~10
    // call sites picks this up for free since they all read through
    // getUserProfile(). Falls back to the flat fields verbatim when no
    // assets exist yet (brand-new / not-yet-migrated profile) - zero
    // behavior change until the customer actually uses the ledger.
    const assets = Array.isArray(preferences?.assets) ? preferences.assets : [];
    const assetOverrides =
      assets.length > 0
        ? (() => {
            const inputs = computeAssetHealthInputs(assets);
            return {
              currentSavings: String(inputs.savings),
              investments: String(inputs.investments),
              insuranceStatus: inputs.hasActiveInsurance ? "Covered" : merged.insuranceStatus,
              insuranceCoverageAmount: inputs.hasActiveInsurance ? String(inputs.insuranceCoverage) : merged.insuranceCoverageAmount,
            };
          })()
        : {};
    return {
      ...merged,
      monthlyIncome: String(smoothed.effectiveMonthlyIncome),
      isIncomeIrregular: smoothed.isIrregular,
      incomeSampleSize: smoothed.sampleSize,
      monthlyExpenses: String(smoothedExpenses.effectiveMonthlyExpenses),
      isExpensesIrregular: smoothedExpenses.isIrregular,
      expenseSampleSize: smoothedExpenses.sampleSize,
      ...assetOverrides,
    };
  },
  getCustomGoals: (preferences) => (Array.isArray(preferences?.customGoals) ? preferences.customGoals : []),
};

// The only provider registered today - see comment above. Deliberately not
// padded with a fake second entry just to look more "integrated" than this
// prototype actually is.
const LIFE_GRAPH_PROVIDERS = [manualEntryProvider];

function getActiveLifeGraphProvider() {
  return LIFE_GRAPH_PROVIDERS[0];
}

function getUserProfile(preferences) {
  return getActiveLifeGraphProvider().getProfile(preferences);
}

function getCustomGoals(preferences) {
  return getActiveLifeGraphProvider().getCustomGoals(preferences);
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
  // Same real gap as HomeDashboard's spendingRisk card - a customer who
  // hasn't entered their real income/expenses yet must never see a
  // fabricated "over budget" notification computed from the default
  // demo persona's numbers.
  const hasRealProfile = String(profile?.statedMonthlyIncome ?? "") !== String(defaultProfile.statedMonthlyIncome);

  const history = [];

  if (hasRealProfile && spendingAlertsEnabled && spendingRisk.hasRisk) {
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
    isIncomeIrregular: profile.isIncomeIrregular,
    incomeSampleSize: profile.incomeSampleSize,
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

function PhoneShell({ children, activeScreen, setActiveScreen, language, setLanguage, theme, simpleMode = false, t, hideNav = false }) {
  const navScreen = getNavScreen(activeScreen);

  return (
    <main className={`stage theme-${theme}${simpleMode ? " simple-mode" : ""}`}>
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
  if ([screens.PAYNOW, screens.SCAN_PAY, screens.FX, screens.HOME_FULL].includes(activeScreen)) return screens.HOME;
  if (activeScreen === screens.SPENDING_RISK) return screens.HOME;
  if ([screens.NEED_WEDDING, screens.NEED_HOME, screens.NEED_RETIREMENT, screens.NEED_LOAN, screens.NEED_INVESTMENT].includes(activeScreen)) {
    return screens.MIRROR;
  }
  if ([screens.NEED_EMERGENCY, screens.NEED_INSURANCE, screens.STRATEGIC_BALANCE, screens.CHANGE_LEDGER, screens.MEMORY_LENS].includes(activeScreen)) {
    return screens.LIFE_GRAPH;
  }
  if (activeScreen === screens.LOADING) return screens.MIRROR;
  if (activeScreen === screens.EXPLORE_CHAT) return screens.MIRROR;
  if (activeScreen === screens.FUTURE_FIELD) return screens.MIRROR;
  if (activeScreen === screens.HOME_HORIZON) return screens.MIRROR;
  if (activeScreen === screens.EMERGENCY_RUNWAY) return screens.MIRROR;
  if (activeScreen === screens.WEDDING_LIVING_PLAN) return screens.MIRROR;
  if (activeScreen === screens.REPAYMENT_PATH) return screens.MIRROR;
  if (activeScreen === screens.FUTURE_LIFE_TIMELINE) return screens.MIRROR;
  if (activeScreen === screens.TRIP_ORBIT) return screens.MIRROR;
  if (activeScreen === screens.CAPITAL_PATHS) return screens.MIRROR;
  if (activeScreen === screens.PROTECTION_ENVELOPE) return screens.MIRROR;
  if (activeScreen === screens.FAMILY_CONSTELLATION) return screens.MIRROR;
  return activeScreen;
}

// Explore is intent-first (app/features/explore/ExploreScreen.jsx). It reads
// the canonical Life Thread for "Continue your future" and the one tension.

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
  const [journeyStartedAt, setJourneyStartedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/relationship/journey-start")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setJourneyStartedAt(data.startedAt);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const realEvents = memoryEvents
    .filter((event) => event.confirmedAt)
    .sort((a, b) => new Date(b.confirmedAt) - new Date(a.confirmedAt))
    .slice(0, 3);

  // A real, backend-recorded anchor for "when did our relationship begin" —
  // always the oldest entry, so it appears last in this newest-first list.
  // Shown alone (still fetched, not fabricated client-side) when there are
  // no other real events yet, so the section always explains itself instead
  // of reading as broken/empty on a customer's first visit.
  const anchorEvent = journeyStartedAt
    ? {
        id: "journey-started",
        year: new Date(journeyStartedAt).getFullYear().toString(),
        title: t("homeBanking.sharedJourney.anchorTitle"),
        description: t("homeBanking.sharedJourney.anchorDescription"),
        impact: null,
      }
    : null;

  const timelineEvents = [...realEvents, ...(anchorEvent ? [anchorEvent] : [])];

  return (
    <section className="guardianMemoryPanel recommendationPanel">
      <div className="panelHead">
        <div>
          <span className="sectionLabel">{t("homeBanking.sharedJourney.title")}</span>
          <p>{t("homeBanking.sharedJourney.subtitle")}</p>
        </div>
        <CalendarClock size={18} />
      </div>
      {timelineEvents.length === 0 ? null : (
        <>
          <div className="memoryTimeline">
            {timelineEvents.map((event) => (
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
                  {event.impact ? (
                    <span className="memoryImpact">
                      {t("guardian.memory.impact")}: {event.impact}
                    </span>
                  ) : null}
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

// Real, DB-backed events (lib/guardian-alert-store.js's guardian_alerts,
// lib/mirror-open-loops.js's open loops) reshaped into the same "nudge"
// object the Home alert card already used for just its single top pick -
// factored out so the full notification center (every real open item, not
// just the highest-priority one) and the top card share one real mapping,
// not two copies of the same logic.
function alertToNudge(alert) {
  if (alert.alert_type === "joint_debate_pending") {
    return { kind: "jointDebatePending", alertId: alert.id, domain: alert.domain, detail: alert.detail };
  }
  if (alert.alert_type === "joint_action_resolved") {
    return { kind: "jointActionResolved", alertId: alert.id, domain: alert.domain, detail: alert.detail };
  }
  return { kind: "crossGoalRisk", alertId: alert.id, domain: alert.domain, detail: alert.detail, severity: alert.severity };
}

function openLoopToNudge(loop) {
  return { kind: "openLoop", type: loop.type, domain: loop.domain };
}

// Same real label/title/detail text the Home alert card already computed
// inline, now callable once per nudge instead of duplicated for a full
// list. Returns null fields gracefully - callers decide fallbacks.
function describeGuardianNudge(nudge, t) {
  const Icon =
    nudge.kind === "crossGoalRisk"
      ? AlertTriangle
      : nudge.kind === "jointDebatePending"
        ? HeartHandshake
        : nudge.kind === "jointActionResolved"
          ? nudge.detail.outcome === "confirmed"
            ? CheckCircle2
            : X
          : Sparkles;

  const label =
    nudge.kind === "crossGoalRisk"
      ? t("guardianAlert.label")
      : nudge.kind === "openLoop"
        ? t("mirrorChat.openLoopsLabel")
        : nudge.kind === "jointDebatePending"
          ? t("jointDebateResponse.alertLabel")
          : nudge.kind === "jointActionResolved"
            ? t("jointActionResolved.alertLabel")
            : t("guardianNudge.label");

  const title =
    nudge.kind === "crossGoalRisk"
      ? t("guardianAlert.title", { utilization: nudge.detail.utilizationPercent })
      : nudge.kind === "openLoop"
        ? t("guardianNudge.openLoopTitle", { domain: t(`simulator.goals.${nudge.domain}`), loopType: t(`mirrorChat.openLoopTypes.${nudge.type}`) })
        : nudge.kind === "jointDebatePending"
          ? t("jointDebateResponse.alertTitle", { name: nudge.detail.initiatorDisplayName || t("jointDebateResponse.yourPartnerFallback") })
          : nudge.kind === "jointActionResolved"
            ? t(nudge.detail.outcome === "confirmed" ? "jointActionResolved.confirmedTitle" : "jointActionResolved.declinedTitle", {
                name: nudge.detail.targetDisplayName || t("jointDebateResponse.yourPartnerFallback"),
              })
            : t("guardianNudge.title", { need: t(nudge.titleKey) });

  const detail =
    nudge.kind === "crossGoalRisk"
      ? nudge.detail.worseningLoans?.length
        ? t("guardianAlert.detailLoanImpact", {
            purpose: t(`loanPlanner.purposes.${nudge.detail.worseningLoans[0].purpose}`),
            before: nudge.detail.worseningLoans[0].scoreBefore,
            after: nudge.detail.worseningLoans[0].scoreAfter,
          })
        : nudge.detail.worseningInvestments?.length
          ? t("guardianAlert.detailInvestmentImpact", {
              name: nudge.detail.worseningInvestments[0].name,
              before: nudge.detail.worseningInvestments[0].scoreBefore,
              after: nudge.detail.worseningInvestments[0].scoreAfter,
            })
          : t("guardianAlert.detailUtilizationOnly")
      : nudge.kind === "jointDebatePending"
        ? t("jointDebateResponse.alertDetail", { domain: t(`simulator.goals.${nudge.detail.goalType}`) })
        : nudge.kind === "jointActionResolved"
          ? nudge.detail.outcome === "declined" && nudge.detail.declineReason
            ? t("jointActionResolved.declinedDetailWithReason", { reason: nudge.detail.declineReason })
            : t(nudge.detail.outcome === "confirmed" ? "jointActionResolved.confirmedDetail" : "jointActionResolved.declinedDetail")
          : t("guardianNudge.detail");

  const dismissable = nudge.kind === "crossGoalRisk" || nudge.kind === "jointDebatePending" || nudge.kind === "jointActionResolved";

  return { Icon, label, title, detail, dismissable };
}

function NotificationCenterModal({ nudges, spendingRiskEntry, dismissingAlertId, onNudgeClick, onDismiss, onClose, t }) {
  return (
    <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("homeBanking.notificationsTitle")}>
      <motion.div className="confirmModal weddingHistoryModal" {...screenMotion}>
        <Bell size={24} />
        <strong>{t("homeBanking.notificationsTitle")}</strong>
        <div className="strategyList">
          {spendingRiskEntry ? (
            <article className="strategyItem" onClick={spendingRiskEntry.onClick} style={{ cursor: "pointer" }}>
              <span className="iconBubble">
                <AlertTriangle size={16} />
              </span>
              <div>
                <strong>{spendingRiskEntry.title}</strong>
                <small>{spendingRiskEntry.detail}</small>
              </div>
              <ChevronRight size={15} />
            </article>
          ) : null}
          {nudges.map((nudge, index) => {
            const described = describeGuardianNudge(nudge, t);
            const Icon = described.Icon;
            return (
              <article className="strategyItem" key={nudge.alertId ?? `${nudge.kind}-${index}`}>
                <span className="iconBubble">
                  <Icon size={16} />
                </span>
                <button type="button" className="linkButton" style={{ textAlign: "left", flex: 1 }} onClick={() => onNudgeClick(nudge)}>
                  <strong style={{ display: "block" }}>{described.title}</strong>
                  <small>{described.detail}</small>
                </button>
                {described.dismissable ? (
                  <button
                    type="button"
                    className="chatIconButton"
                    disabled={dismissingAlertId === nudge.alertId}
                    onClick={(event) => onDismiss(event, nudge.alertId)}
                    aria-label={t("guardianAlert.dismiss")}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </article>
            );
          })}
          {!spendingRiskEntry && !nudges.length ? <p>{t("settings.notifications.history.quiet.detail")}</p> : null}
        </div>
        <button type="button" className="secondaryButton" onClick={onClose}>
          {t("homeBanking.gotIt")}
        </button>
      </motion.div>
    </section>
  );
}

// Home Goal Shift V2 - one focus, one living visual, one variable, one
// real decision. Replaces the earlier generic slider+card treatment: the
// timeline fill IS the result (not a text readout beside a slider), the
// cross-goal tradeoff is real (a genuine emergency-buffer cost, not a
// generic warning), and "adopt" writes a real structured commitment
// (app/api/home/goal-commitment) instead of sending AI text - see
// lib/moment-engine.js for the real detection math this renders.
function HomeGoalShiftMomentCard({ moment, language, t, onAdopted, onDismissed }) {
  const data = moment.data;
  const [amount, setAmount] = useState(data.catchUpAmount ?? data.originalMonthlyContribution);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const preview = computeReadyDateForMonthlyAmount({ downPaymentNeeded: data.downPaymentNeeded, currentSavings: data.currentSavings, monthlyAmount: amount });
  // Timeline span = months-to-ready at the slowest pace on the slider - so
  // the fill always lands within 0-100% regardless of where the customer
  // drags, and "further right" always means "sooner", never a fixed date
  // scale that could run off the end.
  const readyAtSlowestPace = computeReadyDateForMonthlyAmount({ downPaymentNeeded: data.downPaymentNeeded, currentSavings: data.currentSavings, monthlyAmount: data.sliderMin });
  const spanMonths = Math.max(1, readyAtSlowestPace.monthsToReady ?? 1);
  const fillPercent = preview.monthsToReady == null ? 6 : Math.max(6, Math.min(100, Math.round((1 - preview.monthsToReady / spanMonths) * 100)));

  const handleAdopt = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/home/goal-commitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyContribution: amount, language }),
      });
      const result = await response.json();
      if (!response.ok) {
        const key = `todayMoment.homeGoalShift.error_${result?.error}`;
        const mapped = t(key);
        setError(mapped === key ? t("todayMoment.homeGoalShift.adoptError") : mapped);
        return;
      }
      onAdopted?.(result);
    } catch {
      setError(t("todayMoment.homeGoalShift.adoptError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.section className="momentFocus" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, ease: "easeOut" }}>
      <strong className="momentHeadline">{t("todayMoment.homeGoalShift.headline", { months: data.delayMonths ?? 0 })}</strong>

      <div className="momentTimeline">
        <div className="momentTimelineTrack">
          <motion.div className="momentTimelineFill" animate={{ width: `${fillPercent}%` }} transition={{ duration: 0.25, ease: "easeOut" }} />
          <motion.div className="momentTimelineMarker" animate={{ left: `${fillPercent}%` }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <Home size={16} />
          </motion.div>
        </div>
        <div className="momentTimelineLabels">
          <span>{t("todayMoment.homeGoalShift.todayLabel")}</span>
          <span>
            {preview.readyNow
              ? t("todayMoment.homeGoalShift.readyNow")
              : preview.readyMonth
                ? t("todayMoment.homeGoalShift.readyBy", { month: preview.readyMonth })
                : t("todayMoment.homeGoalShift.notOnTrack")}
          </span>
        </div>
        <input
          type="range"
          className="wideSlider"
          min={data.sliderMin}
          max={data.sliderMax}
          step="10"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
          aria-label={t("todayMoment.homeGoalShift.sliderLabel")}
        />
        <div className="momentSliderReadout">
          <span>{t("common.perMonth", { amount: formatSgd(amount) })}</span>
        </div>
      </div>

      {data.bufferImpactMonths != null && data.bufferImpactMonths > 0 ? (
        <p className="momentTradeoff">
          {t("todayMoment.homeGoalShift.tradeoff", {
            amount: formatSgd(data.catchUpAmount),
            months: data.bufferImpactMonths,
            horizon: data.bufferImpactHorizonMonths,
          })}
        </p>
      ) : null}

      {error ? (
        <section className="adviceOnlyPanel">
          <AlertTriangle size={18} />
          <p>{error}</p>
        </section>
      ) : null}

      <button type="button" className="primaryButton" onClick={handleAdopt} disabled={submitting}>
        {submitting ? t("weddingPlanner.thinking") : t("todayMoment.homeGoalShift.adopt", { amount: formatSgd(amount) })}
        <Check size={18} />
      </button>
      <button type="button" className="linkButton" onClick={onDismissed} disabled={submitting}>
        {t("todayMoment.homeGoalShift.keep")}
      </button>
      <button type="button" className="linkButton" onClick={() => setExpanded((current) => !current)}>
        {t("todayMoment.homeGoalShift.why")}
      </button>
      {expanded ? (
        <p className="riskText">
          {moment.reasonCode === "expense_increase"
            ? t("todayMoment.homeGoalShift.reasonExpenseIncrease", { amount: formatSgd(moment.reasonParams.changeAmount) })
            : t("todayMoment.homeGoalShift.reasonBehindPace")}
        </p>
      ) : null}
    </motion.section>
  );
}

// Phase 3: the real result closing the loop, not a generic notification -
// only ever rendered when computeHomeGoalRecoveryMoment found real logged
// check-ins actually matching or beating the committed pace.
function HomeGoalRecoveryMomentCard({ moment, t, onDismissed }) {
  return (
    <motion.section className="momentFocus momentFocusPositive" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, ease: "easeOut" }}>
      <strong className="momentHeadline">{t("todayMoment.homeGoalRecovery.headline", { months: moment.data.recoveredMonths })}</strong>
      <p>
        {moment.data.remainingGapMonths > 0
          ? t("todayMoment.homeGoalRecovery.stillGap", { months: moment.data.remainingGapMonths })
          : t("todayMoment.homeGoalRecovery.onTrack")}
      </p>
      <button type="button" className="linkButton" onClick={onDismissed}>
        {t("todayMoment.homeGoalRecovery.acknowledge")}
      </button>
    </motion.section>
  );
}

// Phase 2: "确认后界面直接转成执行状态" - persistent, not a one-time
// confirmation toast. Shown whenever a real active goal_commitment exists
// (see lib/goal-commitment-store.js), independent of whether a new Moment
// is also present. Every field is real: executionState is derived live
// against the customer's current real emergency buffer
// (lib/goal-commitment-finance.js), never a stored flag that could drift.
function GuardianExecutionStatusCard({ commitment, t, onRevoked }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleRevoke = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/home/goal-commitment/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: commitment.id }),
      });
      if (!response.ok) {
        setError(t("todayMoment.execution.revokeError"));
        return;
      }
      const result = await response.json().catch(() => null);
      onRevoked?.(result);
    } catch {
      setError(t("todayMoment.execution.revokeError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.section className="momentFocus momentFocusQuiet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      <span className={commitment.executionState === "paused" ? "statChip warning" : "statChip"}>
        {t(`todayMoment.execution.state.${commitment.executionState}`)}
      </span>
      <p>{t("todayMoment.execution.summary", { amount: formatSgd(Number(commitment.monthly_contribution)), month: commitment.effective_month })}</p>
      <p className="riskText">
        {commitment.executionState === "paused"
          ? t("todayMoment.execution.pausedDetail", {
              threshold: Number(commitment.pause_if_emergency_months_below),
              current: commitment.emergencyBufferMonths,
            })
          : t("todayMoment.execution.pauseCondition", { threshold: Number(commitment.pause_if_emergency_months_below) })}
      </p>
      {error ? (
        <section className="adviceOnlyPanel">
          <AlertTriangle size={18} />
          <p>{error}</p>
        </section>
      ) : null}
      <button type="button" className="linkButton" onClick={handleRevoke} disabled={submitting}>
        {submitting ? t("weddingPlanner.thinking") : t("todayMoment.execution.revoke")}
      </button>
    </motion.section>
  );
}

// Today - not a dashboard. Where the customer is standing right now, in
// three layers: Bank Now (balance + one thing to handle + Pay/Transfer/
// Scan), the Active Living Plan (its current tension + next step, via
// LivingPlanStatus), and Latest Change (one line -> Change Replay).
// "Everything on your accounts" opens the full account view.
function TodayScreen({ setActiveScreen, displayName, preferences, t }) {
  // Part 7: Today's main state is the canonical Life Thread. The old
  // profile-derived values are only a fallback while the snapshot loads.
  const { thread } = useLifeThread();
  const profile = getUserProfile(preferences);
  const hasRealProfile = String(profile?.statedMonthlyIncome ?? "") !== String(defaultProfile.statedMonthlyIncome);

  const threadBank = thread?.bankNow ?? null;
  const balanceKnown = threadBank ? threadBank.known : hasRealProfile;
  const balance = threadBank && threadBank.known ? threadBank.availableBalance : getProfileAmount(profile, "currentSavings", 85000);
  const cardDue = threadBank?.oneThingThisWeek?.kind === "card_payment" ? threadBank.oneThingThisWeek.amount : getProfileAmount(profile, "creditCardOutstanding", 0);

  const [latestChangeFallback, setLatestChangeFallback] = useState(null);
  useEffect(() => {
    if (thread) return; // the thread carries latestChange - no separate fetch
    let alive = true;
    fetch("/api/change-ledger?filter=all")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.events?.length) return;
        setLatestChangeFallback(formatEvent(d.events[0], t));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [t, thread]);
  const latestChange = thread?.latestChange
    ? { headline: thread.latestChange.headline }
    : latestChangeFallback;

  const bankTask = cardDue > 0
    ? { label: t("today.bankNow.cardDue", { amount: formatSgd(cardDue) }), onClick: () => setActiveScreen(screens.ACCOUNT_DETAIL) }
    : null;

  const plans = [
    { id: "wedding", screen: screens.WEDDING_LIVING_PLAN, icon: HeartHandshake },
    { id: "home", screen: screens.HOME_HORIZON, icon: Building2 },
    { id: "emergency", screen: screens.EMERGENCY_RUNWAY, icon: LockKeyhole },
  ];

  return (
    <Screen>
      <section className="todayScreen">
        <header className="todayHead">
          <div>
            <span className="todayEyebrow">{t("homeBanking.today")}</span>
            <h1>{t("homeBanking.welcome", { name: displayName })}</h1>
          </div>
          <button type="button" className="todayProfileBtn" onClick={() => setActiveScreen(screens.PROFILE)} aria-label={t("nav.profile")}>
            <UserRound size={18} />
          </button>
        </header>

        {/* A. Bank Now */}
        <section className="todayBankNow" aria-label={t("today.bankNow.label")}>
          <button type="button" className="todayBalance" onClick={() => setActiveScreen(screens.ACCOUNT_DETAIL)}>
            <span>{t("today.bankNow.available")}</span>
            <strong>{balanceKnown ? formatSgd(balance) : t("today.bankNow.unknown")}</strong>
          </button>
          {bankTask ? (
            <button type="button" className="todayBankTask" onClick={bankTask.onClick}>
              <AlertTriangle size={15} /> {bankTask.label}
            </button>
          ) : (
            <p className="todayBankClear">{t("today.bankNow.clear")}</p>
          )}
          <div className="todayActions">
            <button type="button" onClick={() => setActiveScreen(screens.PAYNOW)}><CircleDollarSign size={18} /><span>{t("homeBanking.quickActions.paynow")}</span></button>
            <button type="button" onClick={() => setActiveScreen(screens.FX)}><ArrowLeftRight size={18} /><span>{t("homeBanking.quickActions.fx")}</span></button>
            <button type="button" onClick={() => setActiveScreen(screens.SCAN_PAY)}><QrCode size={18} /><span>{t("homeBanking.quickActions.scanPay")}</span></button>
          </div>
        </section>

        {/* B. Active Living Plan - its current tension + next step */}
        {hasRealProfile ? <LivingPlanStatus t={t} setActiveScreen={setActiveScreen} /> : null}

        <nav className="todayPlans" aria-label={t("today.plans.label")}>
          {plans.map(({ id, screen, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveScreen(screen)}>
              <Icon size={16} />
              <span>{t(`memoryLens.goal.${id}`)}</span>
            </button>
          ))}
          <button type="button" className="todayPlansExplore" onClick={() => setActiveScreen(screens.MIRROR)}>
            {t("today.plans.exploreAll")} <ChevronRight size={14} />
          </button>
        </nav>

        {/* C. Latest Change - one line -> replay */}
        {latestChange ? (
          <button type="button" className="todayLatestChange" onClick={() => setActiveScreen(screens.CHANGE_LEDGER)}>
            <span className="todayChangeLabel">{t("today.latestChange.label")}</span>
            <span className="todayChangeLine">{latestChange.headline}</span>
            <ChevronRight size={15} />
          </button>
        ) : null}

        <button type="button" className="linkButton todayEverything" onClick={() => setActiveScreen(screens.HOME_FULL)}>
          {t("today.everything")} <ChevronRight size={14} />
        </button>
      </section>
    </Screen>
  );
}

function HomeDashboard({ goWithLoading, setActiveScreen, displayName, preferences, setPreferences, memoryEvents, setMirrorChatSeed, setJointDebateViewId, language, t }) {
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [noticeModal, setNoticeModal] = useState(null);
  const [followThrough, setFollowThrough] = useState(null);
  const NoticeIcon = noticeModal?.icon;
  const profile = getUserProfile(preferences);
  const healthScores = getHealthScores(profile);
  const spendingRisk = getSpendingRisk(profile);

  // Real gap found by looking at what a brand-new signup actually sees:
  // every field in `profile` silently falls back to `defaultProfile` (a
  // fictional demo persona - 27yo married marketing exec, $7500 income,
  // $85000 savings) until the customer edits it in Profile/Life Graph.
  // spendingRisk and detectedNeeds below are both computed from those
  // fictional numbers for a customer who hasn't entered anything yet, and
  // were being presented as real findings ("1 financial risk detected
  // today") with zero disclosure - reusing the same "confirmed away from
  // default" signal getAiConfidence already established for exactly this
  // purpose (see confidenceTrackedFields above), not inventing a new one.
  const hasRealProfile = String(profile?.statedMonthlyIncome ?? "") !== String(defaultProfile.statedMonthlyIncome);
  const spendingAlertsEnabled =
    preferences.notifications?.spending && preferences.guardianPermissions?.spendingAlerts && !preferences.consentWithdrawn;

  // Same real "detected need" evidence already shown passively on the Life
  // Graph screen (a declared goal, or a health score below a real
  // threshold) - surfaced here too so a customer who never opens Life Graph
  // still gets nudged. Only the first (deterministic, not arbitrary) need
  // is shown - this is a nudge, not a report. Excluded (not computed at
  // all) until hasRealProfile, since it's otherwise a "need" inferred from
  // the fictional default persona's numbers, not this customer's own.
  const customGoals = getCustomGoals(preferences);
  const detectedNeeds = hasRealProfile ? getDetectedNeeds(getProfileGoalIds(profile, customGoals), healthScores) : [];
  const topDetectedNeed = detectedNeeds[0] ?? null;

  // Same real open-loops signal already surfaced inside Mirror chat
  // (missing this-month check-ins, unresolved debate predictions) - a
  // customer with an already-confirmed plan that needs follow-up never saw
  // this unless they opened chat themselves. Takes priority over a
  // detected need below: following up on something already committed to
  // is more time-sensitive than suggesting something new.
  const [openLoops, setOpenLoops] = useState([]);
  const topOpenLoop = openLoops[0] ?? null;

  // Real, persisted, screen-independent proactive alerts (lib/guardian-
  // alert-store.js) - a real risk to something ALREADY confirmed (a loan's
  // outlook worsening, total commitment utilization crossing a threshold)
  // outranks both open loops and a generic detected need, since it's about
  // money already committed rather than a suggestion.
  const [crossGoalAlerts, setCrossGoalAlerts] = useState([]);
  const topCrossGoalAlert = crossGoalAlerts[0] ?? null;
  const [dismissingAlertId, setDismissingAlertId] = useState(null);

  // Real Moments (lib/moment-engine.js) - outranks every other nudge below
  // since it's a fully-computed real change with a real decision attached,
  // not just a pointer into a chat conversation. momentsFetchNonce forces a
  // refetch after adopting/revoking a commitment, since that changes both
  // which Moment (if any) should show next AND the persistent execution
  // status card.
  const [momentsPayload, setMomentsPayload] = useState(null);
  const [dismissedMomentIds, setDismissedMomentIds] = useState([]);
  const [momentsFetchNonce, setMomentsFetchNonce] = useState(0);
  // Impact Receipt: the compact "here is what actually changed" card shown
  // right after adopt/revoke, sourced from the real Change Ledger event the
  // action produced (never fabricated client-side).
  const [receiptEvent, setReceiptEvent] = useState(null);
  const refetchMoments = (result) => {
    setMomentsFetchNonce((current) => current + 1);
    const ledgerEventId = result?.ledgerEventId ?? (Array.isArray(result?.ledgerEventIds) ? result.ledgerEventIds[0] : null);
    if (ledgerEventId) {
      fetch(`/api/change-ledger/${ledgerEventId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.event && setReceiptEvent(d.event))
        .catch(() => {});
    }
  };
  const visibleMoments = (momentsPayload?.moments ?? []).filter((moment) => !dismissedMomentIds.includes(moment.id));
  const topMoment = visibleMoments[0] ?? null;
  const activeCommitment = momentsPayload?.commitment ?? null;
  useEffect(() => {
    if (!hasRealProfile) return;
    let cancelled = false;
    fetch("/api/moments")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setMomentsPayload(data);
          setDismissedMomentIds([]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasRealProfile, momentsFetchNonce]);

  const guardianNudge = topCrossGoalAlert
    ? alertToNudge(topCrossGoalAlert)
    : topOpenLoop
      ? openLoopToNudge(topOpenLoop)
      : topDetectedNeed
        ? { kind: "detectedNeed", id: topDetectedNeed.id, titleKey: topDetectedNeed.titleKey }
        : null;

  // Every real open item, not just the single highest-priority one - the
  // real content of the notification center (see notificationsOpen below),
  // replacing the old toggle-driven canned text that never reflected what
  // was actually happening.
  const allNudges = [...crossGoalAlerts.map(alertToNudge), ...openLoops.map(openLoopToNudge)];
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const dismissCrossGoalAlert = async (event, alertId) => {
    event.stopPropagation();
    setDismissingAlertId(alertId);
    try {
      await fetch(`/api/guardian-alerts/${alertId}/dismiss`, { method: "POST" });
      setCrossGoalAlerts((current) => current.filter((alert) => alert.id !== alertId));
    } finally {
      setDismissingAlertId(null);
    }
  };

  // Shared by the top alert card and every row in the full notification
  // center - same real action per real event kind, not a second copy.
  const handleNudgeClick = (nudge) => {
    if (nudge.kind === "jointDebatePending") {
      setJointDebateViewId(nudge.detail.debateId);
      goWithLoading(screens.JOINT_DEBATE_RESPONSE, "loading.mirror");
      return;
    }
    if (nudge.kind === "jointActionResolved") {
      window.location.assign("/grants");
      return;
    }
    setMirrorChatSeed(nudge);
    goWithLoading(screens.MIRROR, "loading.mirror");
  };

  useEffect(() => {
    let cancelled = false;
    const params = getFollowThroughQueryParams(preferences);
    fetch(`/api/follow-through/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setFollowThrough(data);
      })
      .catch(() => {});
    fetch("/api/mirror/open-loops")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setOpenLoops(data.loops ?? []);
      })
      .catch(() => {});
    fetch("/api/guardian-alerts")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setCrossGoalAlerts(data.alerts ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const followThroughBand = followThrough?.band ?? "newRelationship";
  const followThroughScore = followThrough?.score ?? 0;
  const futureHealth = healthScores.find((score) => score.id === "future")?.value ?? 86;
  const homeProgress = profile.goals.home ? 72 : 54;
  const emergencyProgress = healthScores.find((score) => score.id === "emergency")?.value ?? 80;
  const retirementProgress = profile.goals.retirement ? 61 : 48;

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
    {
      id: "followThrough",
      label: t("homeBanking.followThroughLabel"),
      value: followThrough
        ? `${t(`relationshipLedger.followThrough.band.${followThroughBand}`)} · ${followThroughScore}/100`
        : t("loading.detail"),
      progress: followThroughScore,
      info: t("homeBanking.info.followThrough"),
      methodKey: "homeBanking.method.followThrough",
      proofKeys: ["followThroughInputs", "followThroughMath", "followThroughResult"],
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
                onClick={() => setNotificationsOpen(true)}
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

        <LivingPlanStatus t={t} setActiveScreen={setActiveScreen} />

        {topMoment?.id === "home-goal-shift" ? (
          <HomeGoalShiftMomentCard
            key={topMoment.id}
            moment={topMoment}
            language={language}
            t={t}
            onAdopted={refetchMoments}
            onDismissed={() => setDismissedMomentIds((current) => [...current, topMoment.id])}
          />
        ) : topMoment?.id === "home-goal-recovery" ? (
          <HomeGoalRecoveryMomentCard
            key={topMoment.id}
            moment={topMoment}
            t={t}
            onDismissed={() => setDismissedMomentIds((current) => [...current, topMoment.id])}
          />
        ) : null}

        {receiptEvent ? (
          <ImpactReceipt
            event={receiptEvent}
            t={t}
            onViewFull={() => {
              setReceiptEvent(null);
              setActiveScreen(screens.CHANGE_LEDGER);
            }}
          />
        ) : null}

        {activeCommitment ? <GuardianExecutionStatusCard commitment={activeCommitment} t={t} onRevoked={refetchMoments} /> : null}

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
          className={hasRealProfile && spendingRisk.hasRisk ? "futureAlertCard risk" : "futureAlertCard"}
          onClick={() => setActiveScreen(hasRealProfile ? screens.SPENDING_RISK : screens.PROFILE)}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.12, ease: "easeOut" }}
        >
          <span className="futureAlertIcon">{hasRealProfile ? <AlertTriangle size={18} /> : <Info size={18} />}</span>
          <span>
            <small>{hasRealProfile ? t("spendingRisk.homeLabel") : t("spendingRisk.homeNoProfileLabel")}</small>
            <strong>
              {hasRealProfile
                ? spendingRisk.hasRisk
                  ? t("spendingRisk.homeTitleRisk")
                  : t("spendingRisk.homeTitleSafe")
                : t("spendingRisk.homeNoProfileTitle")}
            </strong>
            <em>
              {hasRealProfile
                ? spendingRisk.hasRisk
                  ? t("spendingRisk.homeDetailRisk", {
                      amount: formatSgd(spendingRisk.overBudgetAmount),
                      budget: formatSgd(spendingRisk.safeBudget),
                    })
                  : t("spendingRisk.homeDetailSafe", { budget: formatSgd(spendingRisk.safeBudget) })
                : t("spendingRisk.homeNoProfileDetail")}
            </em>
          </span>
          <ChevronRight size={17} />
        </motion.button>

        {guardianNudge
          ? (() => {
              const described = describeGuardianNudge(guardianNudge, t);
              const NudgeIcon = described.Icon;
              return (
                <motion.button
                  type="button"
                  className={guardianNudge.kind === "crossGoalRisk" && guardianNudge.severity === "atRisk" ? "futureAlertCard risk" : "futureAlertCard guardianNudgeCard"}
                  data-testid="guardian-nudge-card"
                  onClick={() => handleNudgeClick(guardianNudge)}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.36, delay: 0.16, ease: "easeOut" }}
                >
                  <span className="futureAlertIcon">
                    <NudgeIcon size={18} />
                  </span>
                  <span>
                    <small>{described.label}</small>
                    <strong>{described.title}</strong>
                    <em>{described.detail}</em>
                  </span>
                  {described.dismissable ? (
                    <button
                      type="button"
                      className="miniButton"
                      disabled={dismissingAlertId === guardianNudge.alertId}
                      onClick={(event) => dismissCrossGoalAlert(event, guardianNudge.alertId)}
                      aria-label={t("guardianAlert.dismiss")}
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <ChevronRight size={17} />
                  )}
                </motion.button>
              );
            })()
          : null}

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

      {notificationsOpen ? (
        <NotificationCenterModal
          nudges={allNudges}
          spendingRiskEntry={
            hasRealProfile && spendingAlertsEnabled && spendingRisk.hasRisk
              ? {
                  title: t("settings.notifications.history.overBudget.title"),
                  detail: t("settings.notifications.history.overBudget.detail", {
                    amount: formatSgd(spendingRisk.overBudgetAmount),
                    spending: formatSgd(spendingRisk.expenses),
                    budget: formatSgd(spendingRisk.safeBudget),
                  }),
                  onClick: () => {
                    setNotificationsOpen(false);
                    setActiveScreen(screens.SPENDING_RISK);
                  },
                }
              : null
          }
          dismissingAlertId={dismissingAlertId}
          onNudgeClick={(nudge) => {
            setNotificationsOpen(false);
            handleNudgeClick(nudge);
          }}
          onDismiss={dismissCrossGoalAlert}
          onClose={() => setNotificationsOpen(false)}
          t={t}
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

// The six life nodes - a causal map, not a data list. Each reads from real
// health scores / profile and links to where the customer can act on it.
function getLifeNodes(profile, healthScores, selectedGoalIds) {
  const score = (id) => healthScores.find((s) => s.id === id)?.value ?? null;
  return [
    { id: "income", value: score("stability") ?? score("savings"), screen: screens.PROFILE },
    { id: "safety", value: score("emergency"), screen: screens.EMERGENCY_RUNWAY },
    { id: "home", value: selectedGoalIds.includes("home") ? score("savings") : null, screen: screens.HOME_HORIZON },
    { id: "relationships", value: selectedGoalIds.includes("family") || selectedGoalIds.includes("wedding") ? score("future") : null, screen: screens.FAMILY_CONSTELLATION },
    { id: "freedom", value: score("investment"), screen: screens.CAPITAL_PATHS },
    { id: "future", value: score("future"), screen: screens.FUTURE_LIFE_TIMELINE },
  ];
}

// Which profile fields sit behind each life node, and whether each is a
// user-confirmed value or still the starting assumption (defaultProfile).
const LIFE_NODE_FIELDS = {
  income: ["statedMonthlyIncome", "monthlyExpenses"],
  safety: ["currentSavings", "monthlyExpenses"],
  home: ["homeTargetPrice", "currentSavings"],
  relationships: ["weddingBudget", "partnerName"],
  freedom: ["monthlyInvestment", "creditCardOutstanding"],
  future: ["retirementTargetIncome", "currentAge"],
};
const LIFE_NODE_RELATED = {
  income: [screens.PROFILE, screens.PERSONAL_ECONOMY],
  safety: [screens.EMERGENCY_RUNWAY, screens.STRATEGIC_BALANCE],
  home: [screens.HOME_HORIZON, screens.NEED_HOME],
  relationships: [screens.FAMILY_CONSTELLATION, screens.WEDDING_LIVING_PLAN],
  freedom: [screens.CAPITAL_PATHS, screens.REPAYMENT_PATH],
  future: [screens.FUTURE_LIFE_TIMELINE, screens.NEED_RETIREMENT],
};
function LifeNodeEvidence({ node, profile, t, setActiveScreen }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/change-ledger?filter=all")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setEvents(nodeEvents(d?.events, node.id, 3));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [node.id]);

  const fields = LIFE_NODE_FIELDS[node.id] ?? [];
  const confirmed = [];
  const estimates = [];
  const unknowns = [];
  for (const key of fields) {
    const val = profile?.[key];
    const def = defaultProfile?.[key];
    if (val == null || val === "") unknowns.push(key);
    else if (def != null && val === def) estimates.push(key);
    else confirmed.push(key);
  }

  return (
    <div className="lifeEvidence">
      <p className="lifeEvidenceState">
        {t("life.evidence.state")}: <b>{node.value == null ? t("life.node.notYet") : `${node.value}/100`}</b>
      </p>

      <dl className="lifeEvidenceCols">
        <div>
          <dt>{t("life.evidence.confirmed")}</dt>
          <dd>{confirmed.length ? confirmed.map((k) => t(`life.field.${k}`)).join(", ") : t("life.evidence.none")}</dd>
        </div>
        <div>
          <dt>{t("life.evidence.estimate")}</dt>
          <dd>{estimates.length ? estimates.map((k) => t(`life.field.${k}`)).join(", ") : t("life.evidence.none")}</dd>
        </div>
        <div>
          <dt>{t("life.evidence.unknown")}</dt>
          <dd>{unknowns.length ? unknowns.map((k) => t(`life.field.${k}`)).join(", ") : t("life.evidence.none")}</dd>
        </div>
      </dl>

      <p className="lifeEvidenceData">
        {t("life.evidence.dataUsed")}: {fields.map((k) => t(`life.field.${k}`)).join(", ") || t("life.evidence.none")}
      </p>
      <p className="lifeEvidenceData">
        {t("life.evidence.goalsAffected")}: {(LIFE_NODE_RELATED[node.id] ?? [node.screen]).map((sc) => t(`life.related.${sc}`)).join(", ")}
      </p>

      <div className="lifeEvidenceChanges">
        <p>{t("life.evidence.recentChanges")}</p>
        {events.length ? (
          <ul>
            {events.map((e) => (
              <li key={e.id}>{formatEvent(e, t)?.headline ?? e.kind ?? ""}</li>
            ))}
          </ul>
        ) : (
          <p className="lifeEvidenceEmpty">{t("life.evidence.noNodeChanges")}</p>
        )}
      </div>

      <div className="lifeEvidenceRelated">
        <button type="button" className="lsPrimaryBtn" onClick={() => setActiveScreen(node.screen)}>
          {t("life.evidence.nextAction")}
        </button>
        <button type="button" className="linkButton" onClick={() => setActiveScreen(screens.MEMORY_LENS)}>
          {t("life.evidence.memoryLens")}
        </button>
      </div>
    </div>
  );
}

function LifeGraph({ setActiveScreen, preferences, t }) {
  const [healthAnalysisOpen, setHealthAnalysisOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [openNodeId, setOpenNodeId] = useState(null);
  const profile = getUserProfile(preferences);
  const customGoals = getCustomGoals(preferences);
  const healthScores = getHealthScores(profile);
  const selectedGoalIds = getProfileGoalIds(profile, customGoals);
  const lifeNodes = getLifeNodes(profile, healthScores, selectedGoalIds);
  const openNode = lifeNodes.find((n) => n.id === openNodeId) ?? null;

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

      <section className="lifeNodeMap" aria-label={t("life.map.label")}>
        <p className="lifeNodeIntro">{t("life.map.introEvidence")}</p>
        <div className="lifeNodeGrid">
          {lifeNodes.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`lifeNode lifeNode-${n.value == null ? "unknown" : n.value >= 70 ? "ok" : n.value >= 50 ? "watch" : "attention"} ${openNodeId === n.id ? "is-open" : ""}`}
              onClick={() => setOpenNodeId(openNodeId === n.id ? null : n.id)}
              aria-expanded={openNodeId === n.id}
            >
              <strong>{t(`life.node.${n.id}`)}</strong>
              <span>{n.value == null ? t("life.node.notYet") : `${n.value}/100`}</span>
            </button>
          ))}
        </div>
        {openNode ? <LifeNodeEvidence node={openNode} profile={profile} t={t} setActiveScreen={setActiveScreen} /> : null}
      </section>

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

      {/* Part 4: the default Life screen is ONLY the living Life Field.
          Future Analyst, Asset Profile, Detected Needs, Strategic Balance,
          Change Ledger, Memory Lens, Cross-bank Data, Product Fit and Peer
          Benchmark are no longer permanent entries here - they are reached
          contextually through a selected node's Evidence drawer, or through
          Profile / Data settings and the Memory drawer. Their engines and
          routes are untouched. */}
    </Screen>
  );
}

// Bull/Bear/Judge cards + evidence panel + confirm/escalate buttons - the
// exact same rendering the old standalone debate form used, extracted so it
// can render inline inside a chat bubble instead. Nothing about this UI
// changed, only where it's mounted from.
// Each argument reveals a beat after the last (real debate pacing, not
// everything landing on screen at once) - framer-motion stagger via
// increasing `delay`, same `motion.section` primitive already used
// throughout this file.
function DebateBeat({ delay, className, icon: Icon, children }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <Icon size={22} />
      <div>{children}</div>
    </motion.section>
  );
}

// Real before -> after Future Score comparison for one already-confirmed
// commitment (loan or investment), two ProgressRings side by side - the
// same real numbers lib/mirror-prompts.js's whole-picture section cites in
// text, made visible instead of only read.
function ImpactRing({ item, label }) {
  const ringColor = (score) => (score >= 70 ? "#0f9f84" : score >= 45 ? "#f59e0b" : "#d71920");
  const worsened = item.delta <= -10;
  return (
    <div className={worsened ? "impactRingRow worsened" : "impactRingRow"}>
      <span className="impactRingLabel">{label}</span>
      <div className="impactRingPair">
        <ProgressRing value={item.scoreBefore} size={52} stroke={5} color={ringColor(item.scoreBefore)} />
        <ChevronRight size={16} className={worsened ? "impactArrow worsened" : "impactArrow"} />
        <ProgressRing value={item.scoreAfter} size={52} stroke={5} color={ringColor(item.scoreAfter)} />
      </div>
    </div>
  );
}

function MirrorDebateResultCard({ debate, confirmed, onConfirm, escalated, onEscalate, t }) {
  const [rebuttal, setRebuttal] = useState("");
  const wholePicture = debate.computed?.wholePicture;
  const utilizationColor = wholePicture
    ? wholePicture.wholePictureUtilizationPercent > 80
      ? "#d71920"
      : wholePicture.wholePictureUtilizationPercent > 60
        ? "#f59e0b"
        : "#0f9f84"
    : "#0f9f84";

  return (
    <motion.section className="simulatorOutput" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <motion.section
        className="recommendationPanel"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <span className="sectionLabel">{t("simulator.sections.futureScore")}</span>
        <SummaryRow label={t("mirror.futureScore")} value={`${debate.futureScore}/100`} />
        <SummaryRow label={t("mirror.risk")} value={t(`risk.${debate.riskLevel}`)} />
        <SummaryRow label={t("simulator.output.confidence")} value={t(`simulator.output.confidenceLevel.${debate.confidence}`)} />
      </motion.section>

      <DebateBeat delay={0.15} className="recommendationHero debateBullCase" icon={ThumbsUp}>
        <span className="sectionLabel">{t("simulator.output.bullCase")}</span>
        <p>{debate.bullCase}</p>
      </DebateBeat>

      <DebateBeat delay={0.3} className="recommendationHero debateBearCase" icon={ThumbsDown}>
        <span className="sectionLabel">{t("simulator.output.bearCase")}</span>
        <p>{debate.bearCase}</p>
      </DebateBeat>

      {debate.bullRebuttal ? (
        <DebateBeat delay={0.45} className="recommendationHero debateBullCase" icon={RotateCcw}>
          <span className="sectionLabel">{t("simulator.output.bullRebuttal")}</span>
          <p>{debate.bullRebuttal}</p>
        </DebateBeat>
      ) : null}

      <DebateBeat delay={debate.bullRebuttal ? 0.6 : 0.45} className="recommendationHero debateJudge" icon={ShieldCheck}>
        <span className="sectionLabel">{t("simulator.output.judgeSynthesis")}</span>
        <p>{debate.judgeSynthesis}</p>
        <small>{t(`simulator.output.recommendedAction.${debate.recommendedAction}`)}</small>
      </DebateBeat>

      {debate.computed ? (
        <section className="recommendationPanel">
          <span className="sectionLabel">{t("simulator.output.evidence.title")}</span>
          <SummaryRow label={t("simulator.output.evidence.income")} value={`SGD ${debate.computed.monthlyIncome}`} />
          <SummaryRow label={t("simulator.output.evidence.expenses")} value={`SGD ${debate.computed.monthlyExpenses}`} />
          <SummaryRow label={t("simulator.output.evidence.available")} value={`SGD ${debate.computed.availableMonthly}`} />
          <SummaryRow label={t("simulator.output.evidence.required")} value={`SGD ${debate.computed.requiredMonthly}`} />
          {debate.computed.availableLiquidSavings != null ? (
            <SummaryRow
              label={t(
                debate.computed.liquidSavingsSourcedFromLedger
                  ? "simulator.output.evidence.liquidSavings"
                  : "simulator.output.evidence.liquidSavingsStated"
              )}
              value={`SGD ${debate.computed.availableLiquidSavings}`}
            />
          ) : null}
          {debate.computed.emergencyBufferMonths != null ? (
            <SummaryRow
              label={t("simulator.output.evidence.emergencyBuffer")}
              value={t("simulator.output.evidence.emergencyBufferValue", { months: debate.computed.emergencyBufferMonths })}
            />
          ) : null}
          {debate.aiProvider ? (
            <SummaryRow
              label={t("simulator.output.evidence.answeredBy")}
              value={t(`simulator.output.evidence.provider.${debate.aiProvider}`)}
            />
          ) : null}
          {debate.history?.resolvedDebates?.length ? (
            <SummaryRow
              label={t("simulator.output.evidence.historyCited")}
              value={t("simulator.output.evidence.historyCitedValue", { count: debate.history.resolvedDebates.length })}
            />
          ) : null}
          {debate.history?.predictiveAccuracy != null ? (
            <SummaryRow
              label={t("simulator.output.evidence.predictiveAccuracy")}
              value={t("simulator.output.evidence.predictiveAccuracyValue", { percent: debate.history.predictiveAccuracy })}
            />
          ) : null}
          {debate.history?.customerCalibration != null ? (
            <SummaryRow
              label={t("simulator.output.evidence.customerCalibration")}
              value={t("simulator.output.evidence.customerCalibrationValue", { percent: debate.history.customerCalibration })}
            />
          ) : null}
          {debate.partnerComputed ? (
            <>
              <SummaryRow
                label={t("simulator.output.evidence.jointPartner")}
                value={t("simulator.output.evidence.jointPartnerValue", { score: debate.partnerComputed.feasibilityScore })}
              />
              <SummaryRow
                label={t("simulator.output.evidence.jointPartnerAvailable")}
                value={`SGD ${debate.partnerComputed.availableMonthly}`}
              />
            </>
          ) : null}
          <small>{t("simulator.output.evidence.note")}</small>
        </section>
      ) : null}

      {wholePicture ? (
        <motion.section
          className="recommendationPanel"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: debate.bullRebuttal ? 0.75 : 0.6, ease: "easeOut" }}
        >
          <span className="sectionLabel">{t("simulator.output.wholePicture.title")}</span>
          <div className="wholePictureGauge">
            <ProgressRing value={wholePicture.wholePictureUtilizationPercent} size={88} stroke={8} color={utilizationColor} />
            <small>{t("simulator.output.wholePicture.utilization")}</small>
          </div>
          <SummaryRow
            label={t("simulator.output.wholePicture.committedTotal")}
            value={`SGD ${wholePicture.committedMonthlyTotal}`}
          />
          <SummaryRow
            label={t("simulator.output.wholePicture.residual")}
            value={`SGD ${wholePicture.residualAfterAllCommitments}`}
          />
          {wholePicture.loanImpact.length || wholePicture.investmentImpact.length ? (
            <div className="impactRingList">
              {wholePicture.loanImpact.map((loan) => (
                <ImpactRing key={`loan-${loan.purpose}`} item={loan} label={t(`loanPlanner.purposes.${loan.purpose}`)} />
              ))}
              {wholePicture.investmentImpact.map((pick) => (
                <ImpactRing key={`investment-${pick.name}`} item={pick} label={pick.name} />
              ))}
            </div>
          ) : null}
        </motion.section>
      ) : null}

      <MirrorWhatIfExplorer debate={debate} t={t} />

      {!confirmed ? (
        <div className="settingsGroup">
          <textarea
            className="aiTextInput"
            rows={2}
            maxLength={1000}
            value={rebuttal}
            onChange={(event) => setRebuttal(event.target.value)}
            placeholder={t("simulator.output.customerRebuttalPlaceholder")}
            aria-label={t("simulator.output.customerRebuttalLabel")}
          />
          <small>{t("simulator.output.customerRebuttalHint")}</small>
        </div>
      ) : null}

      <button type="button" className="secondaryButton" onClick={() => onConfirm(rebuttal)} disabled={confirmed}>
        {confirmed ? t("simulator.output.confirmed") : t("simulator.output.confirmPlan")}
        <ShieldCheck size={18} />
      </button>

      {debate.confidence === "low" ? (
        <section className="adviceOnlyPanel">
          <AlertTriangle size={18} />
          <div>
            <p>{t("simulator.output.lowConfidenceNote")}</p>
            <button type="button" className="secondaryButton" onClick={onEscalate} disabled={escalated}>
              {escalated ? t("simulator.output.escalatedToRm") : t("simulator.output.escalateToRm")}
              <UserRound size={18} />
            </button>
          </div>
        </section>
      ) : null}
    </motion.section>
  );
}

// Instant what-if branching: drag a slider, get a real recomputed Future
// Score and whole-picture impact back from /api/mirror/whatif - zero new AI
// call, same "AI touches zero numbers" discipline, same debounced-slider
// pattern already established for Strategic Balance's rebalance explorer
// (see requestRebalance above). Only rendered once a real requiredMonthly
// baseline exists on the debate.
function MirrorWhatIfExplorer({ debate, t }) {
  const baseRequired = debate.computed?.requiredMonthly ?? 0;
  const isLumpSum = debate.computed?.targetAmount != null;
  const [delayMonths, setDelayMonths] = useState(0);
  const [monthlyAmount, setMonthlyAmount] = useState(baseRequired);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const isDefault = delayMonths === 0 && monthlyAmount === baseRequired;

  const runWhatIf = (nextDelayMonths, nextMonthlyAmount) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (nextDelayMonths === 0 && nextMonthlyAmount === baseRequired) {
      setResult(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch("/api/mirror/whatif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debateId: debate.debateId, delayMonths: nextDelayMonths, monthlyOverride: nextMonthlyAmount }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data) setResult(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 350);
  };

  if (baseRequired <= 0) return null;

  const minMonthly = Math.max(50, Math.round((baseRequired * 0.5) / 50) * 50);
  const maxMonthly = Math.round((baseRequired * 1.5) / 50) * 50;
  const computedAfter = result?.computed;
  const utilizationBefore = debate.computed?.wholePicture?.wholePictureUtilizationPercent ?? null;
  const utilizationAfter = computedAfter?.wholePicture?.wholePictureUtilizationPercent ?? null;

  return (
    <section className="recommendationPanel">
      <div className="panelHead">
        <span className="sectionLabel">{t("simulator.output.whatIf.title")}</span>
        <SlidersHorizontal size={17} />
      </div>
      <p>{t("simulator.output.whatIf.hint")}</p>

      {isLumpSum ? (
        <div className="rebalanceSlider">
          <span className="sectionLabel">{t("simulator.output.whatIf.delayLabel", { months: delayMonths })}</span>
          <input
            type="range"
            min={0}
            max={12}
            step={1}
            value={delayMonths}
            onChange={(event) => {
              const next = Number(event.target.value);
              setDelayMonths(next);
              runWhatIf(next, monthlyAmount);
            }}
            aria-label={t("simulator.output.whatIf.delayLabel", { months: delayMonths })}
          />
        </div>
      ) : null}

      <div className="rebalanceSlider">
        <span className="sectionLabel">{t("simulator.output.whatIf.monthlyLabel", { amount: monthlyAmount })}</span>
        <input
          type="range"
          min={minMonthly}
          max={maxMonthly}
          step={50}
          value={monthlyAmount}
          onChange={(event) => {
            const next = Number(event.target.value);
            setMonthlyAmount(next);
            runWhatIf(delayMonths, next);
          }}
          aria-label={t("simulator.output.whatIf.monthlyLabel", { amount: monthlyAmount })}
        />
        {loading ? <p>{t("loading.detail")}</p> : null}
        {!isDefault && computedAfter ? (
          <div className="rebalanceResult">
            <ImpactRing
              item={{
                scoreBefore: debate.futureScore,
                scoreAfter: computedAfter.feasibilityScore,
                delta: computedAfter.feasibilityScore - debate.futureScore,
              }}
              label={t("simulator.output.whatIf.futureScoreLabel")}
            />
            {utilizationBefore != null && utilizationAfter != null ? (
              <SummaryRow
                label={t("simulator.output.whatIf.utilizationLabel")}
                value={`${utilizationBefore}% -> ${utilizationAfter}%`}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// Joint Debate v2's real second-side screen: what a partner actually lands
// on after tapping the joint_debate_pending alert on their own Home. Reads
// the real original debate (bull/bear/judge, unchanged - see app/api/mirror/
// debate/[id]/route.js's real authorization: only the initiator or this
// exact partner_id can fetch it), lets the partner submit their own real
// typed response exactly once, then shows the real joint synthesis a
// separate AI call produces from BOTH people's actual words - never a
// silent restatement of the original debate with the partner's numbers
// quietly folded in.
function JointDebateResponseScreen({ t, setActiveScreen, debateId }) {
  const [debate, setDebate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rebuttalText, setRebuttalText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!debateId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    fetch(`/api/mirror/debate/${debateId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => {
        if (!cancelled) setDebate(data.debate);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debateId]);

  const submitResponse = async () => {
    if (!rebuttalText.trim()) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/mirror/debate/${debateId}/partner-respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rebuttal: rebuttalText.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("jointDebateResponse.submitError"));
        if (data.debate) setDebate(data.debate);
        return;
      }
      setDebate(data.debate);
    } catch {
      setErrorMessage(t("jointDebateResponse.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title={t("jointDebateResponse.title")} subtitle={t("jointDebateResponse.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

      {loading ? (
        <p>{t("loading.detail")}</p>
      ) : notFound || !debate ? (
        <section className="adviceOnlyPanel">
          <AlertTriangle size={18} />
          <p>{t("jointDebateResponse.notFound")}</p>
        </section>
      ) : (
        <>
          <section className="recommendationPanel">
            <span className="sectionLabel">{t("jointDebateResponse.originalDebateTitle")}</span>
            <p>{debate.situation || t(`simulator.goals.${debate.goal_type}`)}</p>
          </section>

          <DebateBeat delay={0} className="recommendationHero debateBullCase" icon={ThumbsUp}>
            <span className="sectionLabel">{t("simulator.output.bullCase")}</span>
            <p>{debate.bull_case}</p>
          </DebateBeat>
          <DebateBeat delay={0.1} className="recommendationHero debateBearCase" icon={ThumbsDown}>
            <span className="sectionLabel">{t("simulator.output.bearCase")}</span>
            <p>{debate.bear_case}</p>
          </DebateBeat>
          <DebateBeat delay={0.2} className="recommendationHero debateJudge" icon={ShieldCheck}>
            <span className="sectionLabel">{t("simulator.output.judgeSynthesis")}</span>
            <p>{debate.judge_synthesis}</p>
          </DebateBeat>

          {debate.partner_rebuttal ? (
            <>
              <section className="recommendationPanel">
                <span className="sectionLabel">{t("jointDebateResponse.yourResponseLabel")}</span>
                <p>{debate.partner_rebuttal}</p>
              </section>
              {debate.joint_synthesis ? (
                <DebateBeat delay={0.3} className="recommendationHero debateJudge" icon={Sparkles}>
                  <span className="sectionLabel">{t("jointDebateResponse.jointSynthesisTitle")}</span>
                  <p>{debate.joint_synthesis}</p>
                  <small>{t(`jointDebateResponse.alignment.${debate.joint_synthesis_alignment}`)}</small>
                </DebateBeat>
              ) : (
                <section className="trustNote compactTrustNote">
                  <Info size={17} />
                  <p>{t("jointDebateResponse.synthesisPending")}</p>
                </section>
              )}
            </>
          ) : (
            <div className="settingsGroup">
              <textarea
                className="aiTextInput"
                rows={3}
                maxLength={1000}
                value={rebuttalText}
                onChange={(event) => setRebuttalText(event.target.value)}
                placeholder={t("jointDebateResponse.responsePlaceholder")}
                aria-label={t("jointDebateResponse.responseLabel")}
              />
              <small>{t("jointDebateResponse.responseHint")}</small>
              {errorMessage ? (
                <section className="adviceOnlyPanel">
                  <AlertTriangle size={18} />
                  <p>{errorMessage}</p>
                </section>
              ) : null}
              <button type="button" className="primaryButton" disabled={submitting || !rebuttalText.trim()} onClick={submitResponse}>
                {submitting ? t("jointDebateResponse.submitting") : t("jointDebateResponse.submitButton")}
                <Zap size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </Screen>
  );
}

// FutureOS's first real chat interface (replaces the old FutureMirrorSimulator
// form - manual situation textarea + goal checkboxes + one Run button). The
// Bull/Bear/Judge debate is now a real tool the chat can invoke mid-
// conversation (lib/mirror-chat-tools.js's run_debate, via the new
// lib/chat-tool-loop.js), not the only thing this screen does - the model is
// free to just talk (tool_choice: "auto", the first place in this codebase
// doing that) and only runs a real debate when the customer actually wants
// one assessed.
// A dedicated input for Mirror chat (NOT a change to the shared
// AiTextInputCard, which 10+ other domain screens depend on unchanged) -
// text + real voice input (reuses DecisionVerdictScreen's exact
// MediaRecorder -> /api/decision/voice/transcribe flow, never auto-sends)
// + real inline PDF attach (reuses extractPdfText from Decode This - only
// extracted text ever leaves the browser, same as the standalone screen).
function MirrorChatInputCard({ t, onSubmit, submitting, errorMessage: sendErrorMessage }) {
  const [value, setValue] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        transcribeRecording(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setErrorMessage(t("mirrorChat.voice.micError"));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeRecording = async (blob) => {
    setTranscribing(true);
    try {
      const audioBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const response = await fetch("/api/decision/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "voice_not_configured" ? t("mirrorChat.voice.notConfigured") : t("mirrorChat.voice.transcribeError"));
        return;
      }
      setValue((current) => (current.trim() ? `${current.trim()} ${data.transcript}` : data.transcript));
    } catch {
      setErrorMessage(t("mirrorChat.voice.transcribeError"));
    } finally {
      setTranscribing(false);
    }
  };

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    setErrorMessage("");
    setAttachedFile({ name: selected.name, text: null, extracting: true, error: null });
    try {
      const extraction = await extractPdfText(selected);
      if (extraction.error === "no_text_layer") {
        setAttachedFile({ name: selected.name, text: null, extracting: false, error: t("mirrorChat.pdf.noTextLayerError") });
        return;
      }
      setAttachedFile({ name: selected.name, text: extraction.text, extracting: false, error: null });
    } catch {
      setAttachedFile({ name: selected.name, text: null, extracting: false, error: t("mirrorChat.pdf.extractError") });
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting || attachedFile?.extracting || (!value.trim() && !attachedFile?.text)) return;
    const messageText = attachedFile?.text
      ? `${value.trim()}\n\n[Attached document text]\n${attachedFile.text}`.trim()
      : value.trim();
    onSubmit(messageText);
    setValue("");
    setAttachedFile(null);
  };

  return (
    <div className="chatComposerWrap">
      {attachedFile ? (
        <div className="chatAttachmentChip">
          <FileText size={13} />
          <span>{attachedFile.extracting ? t("mirrorChat.pdf.extracting") : attachedFile.name}</span>
          <button
            type="button"
            className="chatAttachmentRemove"
            onClick={() => setAttachedFile(null)}
            aria-label={t("mirrorChat.pdf.remove")}
          >
            <X size={12} />
          </button>
        </div>
      ) : null}
      {attachedFile?.error ? <small className="chatComposerError">{attachedFile.error}</small> : null}
      {errorMessage ? <small className="chatComposerError">{errorMessage}</small> : null}
      {sendErrorMessage ? <small className="chatComposerError">{sendErrorMessage}</small> : null}

      <form className="chatComposerBar" onSubmit={handleSubmit}>
        <label className="chatIconButton" aria-label={t("mirrorChat.pdf.attach")}>
          <FileText size={16} />
          <input type="file" accept="application/pdf" onChange={handleFileChange} style={{ display: "none" }} disabled={submitting} />
        </label>
        <textarea
          className="chatComposerInput"
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("mirrorChat.inputPlaceholder")}
          aria-label={t("mirrorChat.inputLabel")}
          disabled={submitting}
        />
        <button
          type="button"
          className={recording ? "chatIconButton recording" : "chatIconButton"}
          onClick={recording ? stopRecording : startRecording}
          disabled={transcribing || submitting}
          aria-label={transcribing ? t("mirrorChat.voice.transcribing") : recording ? t("mirrorChat.voice.stop") : t("mirrorChat.voice.speak")}
        >
          <Mic size={16} />
        </button>
        <button
          type="submit"
          className="chatSendButton"
          disabled={submitting || attachedFile?.extracting || (!value.trim() && !attachedFile?.text)}
          aria-label={submitting ? t("mirrorChat.thinking") : t("mirrorChat.send")}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

// Everything that isn't the chat itself (quick planners, Quick Verdict,
// Decode Document, open loops, what Guardian remembers) - previously
// stacked permanently below the chat input, competing with the actual
// conversation for space on every single screen. A real chatroom's primary
// surface is just messages + a composer; secondary tools belong behind a
// menu, not inline clutter. Nothing here was deleted, only moved - every
// entry point below is unchanged.
// Inline panel, not a modal - this is Mirror's default landing view (see
// MirrorChatScreen's `view` state), swapped for the chat view via the
// "Ask Future Mirror" / "Tools" toggle button in the header row.
function MirrorToolsPanel({ t, setActiveScreen, openLoops, memories }) {
  return (
    <div className="settingsGroup">
        <div className="settingsGroup">
          <span className="sectionLabel">{t("mirrorChat.quickPlannersLabel")}</span>
          <div className="checkboxGrid">
            {simulatorGoalOptions
              .filter(({ id }) => DEDICATED_GOAL_SCREENS[id])
              .map(({ id, labelKey, icon: Icon }) => (
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
              ))}
          </div>
        </div>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.WEDDING_LIVING_PLAN)}>
          <HeartHandshake size={15} />
          <span>
            {t("weddingLivingPlan.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("weddingLivingPlan.entryBody")}</small>
          </span>
          <ChevronRight size={14} />
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.FUTURE_FIELD)}>
          <LineChart size={15} />
          <span>
            {t("futureField.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("futureField.entryBody")}</small>
          </span>
          <ChevronRight size={14} />
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.REPAYMENT_PATH)}>
          <HandCoins size={15} />
          <span>
            {t("repaymentPath.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("repaymentPath.entryBody")}</small>
          </span>
          <ChevronRight size={14} />
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.FUTURE_LIFE_TIMELINE)}>
          <Landmark size={15} />
          <span>
            {t("futureLifeTimeline.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("futureLifeTimeline.entryBody")}</small>
          </span>
          <ChevronRight size={14} />
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.TRIP_ORBIT)}>
          <Globe2 size={15} />
          <span>
            {t("tripOrbit.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("tripOrbit.entryBody")}</small>
          </span>
          <ChevronRight size={14} />
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.CAPITAL_PATHS)}>
          <LineChart size={15} />
          <span>
            {t("capitalPaths.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("capitalPaths.entryBody")}</small>
          </span>
          <ChevronRight size={14} />
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.PROTECTION_ENVELOPE)}>
          <ShieldCheck size={15} />
          <span>
            {t("protectionEnvelope.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("protectionEnvelope.entryBody")}</small>
          </span>
          <ChevronRight size={14} />
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.FAMILY_CONSTELLATION)}>
          <Sparkles size={15} />
          <span>
            {t("familyConstellation.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("familyConstellation.entryBody")}</small>
          </span>
          <ChevronRight size={14} />
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.DECISION_VERDICT)}>
          <Zap size={15} />
          <span>
            {t("decisionVerdict.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("decisionVerdict.entryBody")}</small>
          </span>
          <span className="weddingEntryTrailing">
            <ChevronRight size={14} />
          </span>
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.DECODE_DOCUMENT)}>
          <FileText size={15} />
          <span>
            {t("decodeDocument.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("decodeDocument.entryBody")}</small>
          </span>
          <span className="weddingEntryTrailing">
            <ChevronRight size={14} />
          </span>
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.FUTURE_COMPARISON)}>
          <ArrowLeftRight size={15} />
          <span>
            {t("futureComparison.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("futureComparison.entryBody")}</small>
          </span>
          <span className="weddingEntryTrailing">
            <ChevronRight size={14} />
          </span>
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.SME_CASHFLOW)}>
          <BriefcaseBusiness size={15} />
          <span>
            {t("smeCashflow.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("smeCashflow.entryBody")}</small>
          </span>
          <span className="weddingEntryTrailing">
            <ChevronRight size={14} />
          </span>
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.ACTIVITY_CHECK)}>
          <ShieldCheck size={15} />
          <span>
            {t("activityCheck.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("activityCheck.entryBody")}</small>
          </span>
          <span className="weddingEntryTrailing">
            <ChevronRight size={14} />
          </span>
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.FAMILY_TRAVEL)}>
          <Globe2 size={15} />
          <span>
            {t("familyTravel.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("familyTravel.entryBody")}</small>
          </span>
          <span className="weddingEntryTrailing">
            <ChevronRight size={14} />
          </span>
        </button>

        <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.SHADOW_ACCOUNT)}>
          <History size={15} />
          <span>
            {t("shadowAccount.entryTitle")}
            <small style={{ display: "block", fontWeight: 400 }}>{t("shadowAccount.entryBody")}</small>
          </span>
          <span className="weddingEntryTrailing">
            <ChevronRight size={14} />
          </span>
        </button>

        {openLoops.length ? (
          <div className="settingsGroup">
            <span className="sectionLabel">{t("mirrorChat.openLoopsLabel")}</span>
            <div className="workbenchScrollRow">
              {openLoops.map((loop, index) => (
                <div className="workbenchScrollCard" key={index}>
                  <strong>{t(`mirrorChat.openLoopTypes.${loop.type}`)}</strong>
                  <small>{t(`simulator.goals.${loop.domain}`)}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {memories.length ? (
          <div className="settingsGroup">
            <span className="sectionLabel">{t("mirrorChat.memoryShelfLabel")}</span>
            <div className="workbenchScrollRow">
              {memories.map((memory, index) => (
                <div className="workbenchScrollCard" key={index}>
                  <strong>{t(`mirrorChat.memoryTypes.${memory.type}`)}</strong>
                  <small>{memory.detail}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
    </div>
  );
}

// Deliberately NOT another copy of the standalone screens' verdict-card
// template (.futureCompareGrid + .insightCard/.adviceOnlyPanel repeated
// for every tool) - the chat's own reply already narrates each result in
// its own voice, so these are just light real-number receipts, each
// shaped differently, not a fourth identical card design.
function ChatActivityCheckChip({ check, t }) {
  if (!check.hasHistory) return <p className="weddingCarouselHint">{t("mirrorChat.tools.activityCheckNoHistory")}</p>;
  return (
    <p className="weddingCarouselHint">
      {t(check.unusual ? "mirrorChat.tools.activityCheckUnusual" : "mirrorChat.tools.activityCheckNormal", {
        amount: formatSgd(check.amount),
        max: formatSgd(check.maxHistoricalAmount),
      })}
    </p>
  );
}

function ChatFutureComparisonChip({ numbers, t }) {
  return (
    <div className="weddingStatChips">
      <span className="statChip">{t("mirrorChat.tools.buyNowChip", { amount: formatSgd(numbers.buyNow.savingsAtHorizon) })}</span>
      <span className="statChip">{t("mirrorChat.tools.waitInsteadChip", { amount: formatSgd(numbers.waitInstead.savingsAtHorizon) })}</span>
    </div>
  );
}

function ChatShadowAccountChip({ result, t }) {
  if (!result.hasHistory) return <p className="weddingCarouselHint">{t("mirrorChat.tools.shadowNoHistory")}</p>;
  return (
    <p className="weddingCarouselHint">
      {t("mirrorChat.tools.shadowSummary", { shadow: formatSgd(result.shadowBalance), actual: formatSgd(result.actualSavings) })}
    </p>
  );
}

const OPEN_SCREEN_TITLE_KEYS = {
  familyCfo: "familyCfo.title",
  goalMarketplace: "goalMarketplace.title",
  personalEconomy: "personalEconomy.title",
  dealFinder: "dealFinder.title",
  smeCashflow: "smeCashflow.title",
  familyTravel: "familyTravel.title",
  shadowAccount: "shadowAccount.title",
  activityCheck: "activityCheck.title",
  futureComparison: "futureComparison.title",
  assetProfile: "assetProfile.title",
  strategicBalance: "lifeGraph.strategicBalance.title",
};

function ChatOpenScreenButton({ openScreen, t, setActiveScreen }) {
  const titleKey = OPEN_SCREEN_TITLE_KEYS[openScreen.screen];
  if (!titleKey) return null;
  return (
    <button type="button" className="secondaryButton" onClick={() => setActiveScreen(openScreen.screen)}>
      {t("mirrorChat.tools.openScreen", { screen: t(titleKey) })}
      <ChevronRight size={14} />
    </button>
  );
}

function MirrorChatScreen({
  setActiveScreen,
  simulatorInputs,
  preferences,
  language,
  t,
  mirrorChatSeed,
  onConsumeMirrorChatSeed,
  initialView = "tools",
}) {
  const [messages, setMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmedDebateIds, setConfirmedDebateIds] = useState(() => new Set());
  const [escalatedDebateIds, setEscalatedDebateIds] = useState(() => new Set());
  const [openLoops, setOpenLoops] = useState([]);
  const [memories, setMemories] = useState([]);
  const [contextModalIndex, setContextModalIndex] = useState(null);
  // "Talk it through" from Explore opens straight in chat (initialView =
  // "chat"); the standalone Mirror entry still lands on tools.
  const [view, setView] = useState(initialView === "chat" ? "chat" : "tools");
  const logEndRef = useRef(null);

  const profile = getUserProfile(preferences);
  const customGoals = getCustomGoals(preferences);

  // Real signals for a customer who doesn't know what to plan for yet -
  // both already exist and are already shown passively on the Life Graph
  // screen, just never fed into the chat before. getDetectedNeeds only
  // flags something when there's real evidence (a declared goal, or a
  // health score below a real threshold) - never a guess dressed as one.
  const healthScores = getHealthScores(profile);
  const detectedLifeStage = getDetectedLifeStage(profile, customGoals, t);
  const detectedNeeds = getDetectedNeeds(getProfileGoalIds(profile, customGoals), healthScores).map((need) => t(need.titleKey));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mirror/chat/history")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setMessages(data.entries ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    fetch("/api/mirror/open-loops")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setOpenLoops(data.loops ?? []);
      })
      .catch(() => {});
    fetch("/api/mirror/memory-shelf")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setMemories(data.memories ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Real chatroom behavior: always land on the newest message, matching
  // every real chat app - previously this screen just scrolled like any
  // other stacked form, so a new reply could land off-screen below the
  // fold.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, sending]);

  const sendMessage = async (text) => {
    setSending(true);
    setErrorMessage("");
    setMessages((current) => [...current, { role: "user", text }]);
    try {
      const response = await fetch("/api/mirror/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language, baseInputs: { ...simulatorInputs, detectedLifeStage, detectedNeeds } }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("mirrorChat.genericError"));
        return;
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.reply,
          debate: data.debate,
          activityCheck: data.activityCheck,
          futureComparison: data.futureComparison,
          shadowAccount: data.shadowAccount,
          openScreen: data.openScreen,
          context: data.context,
        },
      ]);
    } catch {
      setErrorMessage(t("mirrorChat.genericError"));
    } finally {
      setSending(false);
    }
  };

  // Coming from the Home nudge card: auto-open with the flagged need already
  // on the table, instead of dropping the customer into a blank chat after
  // they already saw why they're here. Only fires into a genuinely fresh
  // conversation (never interrupts one already in progress) and only once
  // per seed, even under React double-invoke.
  const seedConsumedRef = useRef(false);
  useEffect(() => {
    if (!mirrorChatSeed || historyLoading || seedConsumedRef.current) return;
    seedConsumedRef.current = true;
    onConsumeMirrorChatSeed();
    setView("chat");
    if (messages.length === 0) {
      const seedText =
        mirrorChatSeed.kind === "crossGoalRisk"
          ? t("mirrorChat.seedPromptCrossGoalRisk", {
              domain: t(`simulator.goals.${mirrorChatSeed.domain}`),
              utilization: mirrorChatSeed.detail?.utilizationPercent,
            })
          : mirrorChatSeed.kind === "openLoop"
            ? t("mirrorChat.seedPromptOpenLoop", {
                domain: t(`simulator.goals.${mirrorChatSeed.domain}`),
                loopType: t(`mirrorChat.openLoopTypes.${mirrorChatSeed.type}`),
              })
            : t("mirrorChat.seedPrompt", { need: t(mirrorChatSeed.titleKey) });
      sendMessage(seedText);
    }
  }, [mirrorChatSeed, historyLoading, messages.length]);

  const confirmDebate = async (debateId, customerRebuttal) => {
    try {
      const response = await fetch("/api/mirror/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debateId, customerRebuttal: customerRebuttal?.trim() || null }),
      });
      if (response.ok) setConfirmedDebateIds((current) => new Set(current).add(debateId));
    } catch {
      // Same non-blocking treatment as the old form's confirmPlan.
    }
  };

  const escalateDebate = async (debateId) => {
    try {
      const response = await fetch("/api/mirror/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debateId }),
      });
      if (response.ok) setEscalatedDebateIds((current) => new Set(current).add(debateId));
    } catch {
      // Same non-blocking treatment as the old form's escalateToRm.
    }
  };

  return (
    <Screen className="chatScreenRoot">
      <div className="chatScreenHeaderRow">
        <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
        <h1>{t("mirrorChat.title")}</h1>
        {view === "tools" ? (
          <button type="button" className="chatIconButton chatToolsButton" onClick={() => setView("chat")}>
            <Bot size={16} />
            {t("mirrorChat.askButtonLabel")}
          </button>
        ) : (
          <button
            type="button"
            className="chatIconButton chatToolsButton"
            onClick={() => setView("tools")}
            aria-label={t("mirrorChat.toolsMenuLabel")}
          >
            <LayoutGrid size={16} />
            {t("mirrorChat.toolsButtonLabel")}
          </button>
        )}
      </div>

      {view === "tools" ? (
        <MirrorToolsPanel t={t} setActiveScreen={setActiveScreen} openLoops={openLoops} memories={memories} />
      ) : (
        <>
          <div className="chatScreenLog">
            {historyLoading ? (
              <p>{t("loading.detail")}</p>
            ) : messages.length === 0 ? (
              <p className="chatEmptyState">{t("mirrorChat.emptyState")}</p>
            ) : (
              messages.map((entry, index) => (
                <div key={index}>
                  {entry.text ? (
                    <div className={entry.role === "user" ? "chatBubbleRow user" : "chatBubbleRow assistant"}>
                      <div className={entry.role === "user" ? "chatBubble user" : "chatBubble assistant"}>
                        {entry.text}
                        {entry.role === "assistant" && entry.context ? (
                          <button type="button" className="linkButton" onClick={() => setContextModalIndex(index)}>
                            {t("mirrorChat.whyDidISayThat")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {entry.debate ? (
                    <MirrorDebateResultCard
                      debate={entry.debate}
                      confirmed={confirmedDebateIds.has(entry.debate.debateId)}
                      onConfirm={(rebuttal) => confirmDebate(entry.debate.debateId, rebuttal)}
                      escalated={escalatedDebateIds.has(entry.debate.debateId)}
                      onEscalate={() => escalateDebate(entry.debate.debateId)}
                      t={t}
                    />
                  ) : null}
                  {entry.activityCheck ? <ChatActivityCheckChip check={entry.activityCheck.check} t={t} /> : null}
                  {entry.futureComparison ? <ChatFutureComparisonChip numbers={entry.futureComparison.numbers} t={t} /> : null}
                  {entry.shadowAccount ? <ChatShadowAccountChip result={entry.shadowAccount.result} t={t} /> : null}
                  {entry.openScreen ? <ChatOpenScreenButton openScreen={entry.openScreen} t={t} setActiveScreen={setActiveScreen} /> : null}
                </div>
              ))
            )}
            {sending ? (
              <div className="chatBubbleRow assistant">
                <div className="chatBubble assistant chatTypingBubble" aria-label={t("mirrorChat.thinking")}>
                  <span className="chatTypingDot" />
                  <span className="chatTypingDot" />
                  <span className="chatTypingDot" />
                </div>
              </div>
            ) : null}
            <div ref={logEndRef} />
          </div>

          {contextModalIndex !== null && messages[contextModalIndex]?.context ? (
            <InfoModal
              icon={Info}
              title={t("mirrorChat.whyDidISayThatTitle")}
              body={t("mirrorChat.whyDidISayThatBody")}
              listTitle={t("mirrorChat.whyDidISayThatListTitle")}
              listItems={[
                t("mirrorChat.whyDidISayThatIncome", { amount: messages[contextModalIndex].context.baseInputs?.monthlyIncome }),
                t("mirrorChat.whyDidISayThatExpenses", { amount: messages[contextModalIndex].context.baseInputs?.monthlyExpenses }),
                t("mirrorChat.whyDidISayThatLanguage", { language: messages[contextModalIndex].context.language }),
              ]}
              onClose={() => setContextModalIndex(null)}
              closeLabel={t("homeBanking.gotIt")}
            />
          ) : null}

          <MirrorChatInputCard t={t} onSubmit={sendMessage} submitting={sending || historyLoading} errorMessage={errorMessage} />
        </>
      )}
    </Screen>
  );
}

const followThroughComponentOrder = ["checkInConsistency", "amountFidelity", "recoveryHonesty", "multiGoalDepth", "judgmentCalibration"];
const followThroughComponentIcons = {
  checkInConsistency: CalendarClock,
  amountFidelity: Target,
  recoveryHonesty: ShieldCheck,
  multiGoalDepth: Award,
  judgmentCalibration: Scale,
};

// Reached from Home's entry card and stat row. Shows two deliberately separate ledgers side by
// side - Follow-Through Score (did the customer keep their own word) and Guardian Reputation Score
// (did the AI's recommendations hold up) - then the benefit ladder that requires BOTH to qualify.
function RelationshipLedgerScreen({ preferences, setPreferences, simulatorInputs, simulatorActionStates, t, setActiveScreen }) {
  const [followThrough, setFollowThrough] = useState(null);
  const [loading, setLoading] = useState(true);
  const [credential, setCredential] = useState(null);
  const [issuingCredential, setIssuingCredential] = useState(false);

  const { reputation, reputationBand } = computeGuardianReputation(preferences, simulatorInputs, simulatorActionStates);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = getFollowThroughQueryParams(preferences);
    fetch(`/api/follow-through/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setFollowThrough(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Checks any of Future Mirror's confirmed debates for a resolvable real-world
    // outcome every time this screen loads (no cron infra in this app - same
    // recompute-on-read pattern as follow-through/strategic-balance). Written
    // into the shared preferences.mirrorOutcomeStats cache (not local state) so
    // every other screen's computeGuardianReputation call also picks up a
    // fresher result, not just this one.
    fetch("/api/mirror/outcomes")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setPreferences((current) => ({ ...current, mirrorOutcomeStats: data }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const followThroughBand = followThrough?.band ?? "newRelationship";
  const benefits = getRelationshipBenefits(followThroughBand, reputationBand);

  const knownComponents = followThrough
    ? followThroughComponentOrder
        .map((key) => ({ key, ...followThrough.components[key] }))
        .filter((c) => c.value != null)
    : [];
  const weakestComponent = knownComponents.length
    ? knownComponents.reduce((weakest, c) => (c.value < weakest.value ? c : weakest))
    : null;

  const customerCalibration = preferences?.mirrorOutcomeStats?.customerCalibration ?? null;

  const timeline = followThrough
    ? followThrough.domains
        .flatMap((domain) =>
          domain.checkins.map((checkin) => ({
            domain: domain.domain,
            month: checkin.month,
            amount: checkin.amount,
            target: domain.monthlyContribution,
          }))
        )
        .sort((a, b) => (a.month < b.month ? 1 : -1))
    : [];
  const recentMonthsGrid = getRecentMonthsGrid(timeline, 6);
  const activeStreakMonths = computeActiveStreakMonths(timeline);

  const benefitTiers = [0, 1, 2, 3];

  const handleIssueCredential = async () => {
    if (!followThrough) return;
    setIssuingCredential(true);
    try {
      const response = await fetch("/api/credential/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followThroughScore: followThrough.score,
          followThroughBand,
          reputationScore: reputation.score,
          reputationBand,
          relationshipTier: benefits.tier,
        }),
      });
      if (response.ok) setCredential(await response.json());
    } catch {
      // Non-critical - the issue button stays available to retry.
    } finally {
      setIssuingCredential(false);
    }
  };

  const downloadCredential = () => {
    if (!credential) return;
    downloadJsonFile(`futureos-credential-${credential.id}.json`, credential);
  };

  const credentialVerifyUrl =
    credential && typeof window !== "undefined" ? `${window.location.origin}/api/credential/${credential.id}` : "";

  return (
    <Screen>
      <Header title={t("relationshipLedger.title")} subtitle={t("relationshipLedger.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

      {loading || !followThrough ? (
        <p>{t("loading.detail")}</p>
      ) : (
        <>
          <section className="recommendationPanel">
            <div className="panelHead">
              <span className="sectionLabel">{t("relationshipLedger.followThrough.title")}</span>
              <Target size={17} />
            </div>
            <div className="proofScore">
              <span>{t("relationshipLedger.scoreLabel")}</span>
              <b>{followThrough.score}/100</b>
            </div>
            <div className="productStateRow">
              <b className={`statePill state-${followThroughBand}`}>{t(`relationshipLedger.followThrough.band.${followThroughBand}`)}</b>
            </div>
            <p>{t(`relationshipLedger.followThrough.bandDetail.${followThroughBand}`)}</p>
          </section>

          <section className="financialStrategyPanel">
            <span className="sectionLabel">{t("relationshipLedger.followThrough.componentsTitle")}</span>
            <div className="strategyList">
              {followThroughComponentOrder.map((key) => {
                const component = followThrough.components[key];
                const RowIcon = followThroughComponentIcons[key];
                return (
                  <article className="strategyItem" key={key}>
                    <span className="iconBubble">
                      <RowIcon size={16} />
                    </span>
                    <div>
                      <strong>{t(`relationshipLedger.followThrough.components.${key}`, { weight: Math.round(component.weight * 100) })}</strong>
                      <small>
                        {t(
                          key === "recoveryHonesty"
                            ? `relationshipLedger.followThrough.detail.recoveryHonesty.${component.reason}`
                            : `relationshipLedger.followThrough.detail.${key}`,
                          component
                        )}
                      </small>
                    </div>
                    <b>{component.value == null ? t("relationshipLedger.notYet") : `${component.value}/100`}</b>
                  </article>
                );
              })}
            </div>
          </section>

          {weakestComponent ? (
            <section className="trustNote compactTrustNote">
              <Info size={17} />
              <p>{t(`relationshipLedger.nextStep.${weakestComponent.key}`)}</p>
            </section>
          ) : null}

          {customerCalibration && customerCalibration.resolvedCount > 0 ? (
            <section className="recommendationPanel">
              <div className="panelHead">
                <span className="sectionLabel">{t("relationshipLedger.calibration.title")}</span>
                <Scale size={17} />
              </div>
              <p>
                {t("relationshipLedger.calibration.summary", {
                  heldUpCount: customerCalibration.heldUpCount,
                  resolvedCount: customerCalibration.resolvedCount,
                })}
              </p>
              <div className="strategyList">
                {customerCalibration.recent.map((entry) => {
                  const heldUp = entry.resolvedOutcome === "risk_did_not_materialize";
                  return (
                    <article className="strategyItem" key={entry.id}>
                      <span className="iconBubble">{heldUp ? <Check size={16} /> : <AlertTriangle size={16} />}</span>
                      <div>
                        <strong>{t(`simulator.goals.${entry.goalType}`)}</strong>
                        <small>{entry.bearCase}</small>
                        <small className="calibrationRebuttalQuote">&ldquo;{entry.customerRebuttal}&rdquo;</small>
                      </div>
                      <b className={heldUp ? "statePill state-healthy" : "statePill state-at_risk"}>
                        {t(`relationshipLedger.calibration.outcome.${entry.resolvedOutcome}`)}
                      </b>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="recommendationPanel">
            <div className="panelHead">
              <span className="sectionLabel">{t("relationshipLedger.reputation.title")}</span>
              <Bot size={17} />
            </div>
            <div className="proofScore">
              <span>{t("guardian.reputation.scoreLabel")}</span>
              <b>{reputation.score}/100</b>
            </div>
            <div className="productStateRow">
              <b className={`statePill state-${reputationBand}`}>{t(`guardian.reputation.band.${reputationBand}`)}</b>
            </div>
            <p>{t("relationshipLedger.reputation.note")}</p>
            <button type="button" className="secondaryButton" onClick={() => setActiveScreen(screens.GUARDIAN)}>
              {t("relationshipLedger.reputation.viewGuardian")}
            </button>
          </section>

          <section className="strategicCategoryList">
            <span className="sectionLabel">{t("relationshipLedger.benefitsTitle")}</span>
            {benefitTiers.map((tier) => (
              <div className={tier === benefits.tier ? "strategicAccordionItem expanded" : "strategicAccordionItem"} key={tier}>
                <div className="strategicCategoryRow">
                  <span className="iconBubble">
                    <Award size={16} />
                  </span>
                  <span>
                    <strong>{t(`relationshipLedger.benefits.tier${tier}.title`)}</strong>
                    <small>{t(`relationshipLedger.benefits.tier${tier}.requirement`)}</small>
                  </span>
                  {tier === benefits.tier ? (
                    <b className="statePill state-trusted">{t("relationshipLedger.benefits.currentTierLabel")}</b>
                  ) : null}
                </div>
                <div className="strategicAccordionDetail">
                  <p>{t(`relationshipLedger.benefits.tier${tier}.unlocks`)}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="recommendationPanel">
            <span className="sectionLabel">{t("relationshipLedger.credential.title")}</span>
            <p>{t("relationshipLedger.credential.body")}</p>
            {credential ? (
              <>
                <SummaryRow label={t("relationshipLedger.credential.issuedLabel")} value={new Date(credential.issuedAt).toLocaleString()} />
                {credential.snapshot?.decisionQuality?.resolvedDebateCount > 0 ? (
                  <>
                    <SummaryRow
                      label={t("relationshipLedger.credential.resolvedDebateCount")}
                      value={String(credential.snapshot.decisionQuality.resolvedDebateCount)}
                    />
                    {credential.snapshot.decisionQuality.aiPredictiveAccuracy != null ? (
                      <SummaryRow
                        label={t("relationshipLedger.credential.aiPredictiveAccuracy")}
                        value={`${credential.snapshot.decisionQuality.aiPredictiveAccuracy}%`}
                      />
                    ) : null}
                    {credential.snapshot.decisionQuality.customerCalibrationAccuracy != null ? (
                      <SummaryRow
                        label={t("relationshipLedger.credential.customerCalibrationAccuracy")}
                        value={`${credential.snapshot.decisionQuality.customerCalibrationAccuracy}%`}
                      />
                    ) : null}
                  </>
                ) : null}
                <div className="proofBlock">
                  <strong>{t("relationshipLedger.credential.hashLabel")}</strong>
                  <p className="credentialHash">{credential.contentHash}</p>
                </div>
                <div className="proofBlock">
                  <strong>{t("relationshipLedger.credential.verifyLabel")}</strong>
                  <p className="credentialHash">{credentialVerifyUrl}</p>
                </div>
                <button type="button" className="secondaryButton" onClick={downloadCredential}>
                  {t("relationshipLedger.credential.downloadButton")}
                  <Download size={16} />
                </button>
              </>
            ) : (
              <button type="button" className="primaryButton" disabled={issuingCredential} onClick={handleIssueCredential}>
                {issuingCredential ? t("loading.detail") : t("relationshipLedger.credential.issueButton")}
                <Award size={18} />
              </button>
            )}
          </section>

          <section className="checkinConsistencyPanel">
            <span className="sectionLabel">{t("relationshipLedger.consistency.title")}</span>
            <div className="consistencyGrid">
              {recentMonthsGrid.map(({ month, active }) => (
                <div className={active ? "consistencyCell active" : "consistencyCell"} key={month} title={month}>
                  <span>{formatMonthAbbrev(month)}</span>
                </div>
              ))}
            </div>
            <p className="consistencyNote">
              {activeStreakMonths >= 2
                ? t("relationshipLedger.consistency.streak", { count: activeStreakMonths })
                : t("relationshipLedger.consistency.encouragement")}
            </p>
          </section>

          <section className="historyTimeline">
            <span className="sectionLabel">{t("relationshipLedger.timelineTitle")}</span>
            {timeline.length ? (
              timeline.map((entry, index) => (
                <article key={`${entry.domain}-${entry.month}-${index}`}>
                  <span>{entry.month}</span>
                  <div>
                    <strong>{t(`simulator.goals.${entry.domain}`)}</strong>
                    <small>{t("relationshipLedger.timelineLine", { amount: formatSgd(entry.amount), target: formatSgd(entry.target) })}</small>
                  </div>
                </article>
              ))
            ) : (
              <p>{t("relationshipLedger.noCheckinsYet")}</p>
            )}
          </section>
        </>
      )}
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
  const { reputation, reputationBand } = computeGuardianReputation(preferences, simulatorInputs, simulatorActionStates);
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

      {/* Part 5: the default page is one decision that needs the customer
          now, or a calm "nothing needs a decision" state. Future Handoff
          shows only when it has a real candidate; Hardship only when
          triggered; Shadow Guardian only from inside the secondary drawer
          on an explicit request. The six-stat dashboard and ten-card grid
          move into "Trust, history & controls". No engine or route
          removed. */}
      <GuardianDecisions t={t} setActiveScreen={setActiveScreen} />
      <FutureHandoffPanel t={t} />

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

      <details className="guardianTrustControls">
      <summary>{t("guardian.trustControls")}</summary>

      <ShadowGuardianPanel t={t} setActiveScreen={setActiveScreen} />

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
      </details>
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
  simulatorActionStates,
  setMemoryEvents,
  language,
  t,
  setLoanPlannerInitialPurpose,
  otherGoalSeed,
  onConsumeOtherGoalSeed,
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
        preferences={preferences}
        simulatorInputs={simulatorInputs}
        simulatorActionStates={simulatorActionStates}
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
        preferences={preferences}
        simulatorInputs={simulatorInputs}
        simulatorActionStates={simulatorActionStates}
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
        preferences={preferences}
        simulatorActionStates={simulatorActionStates}
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
    other: (
      <OtherNeedContent
        success={success}
        setSuccess={setSuccess}
        t={t}
        setActiveScreen={setActiveScreen}
        language={language}
        setPreferences={setPreferences}
        setSimulatorInputs={setSimulatorInputs}
        setMemoryEvents={setMemoryEvents}
        profile={profile}
        preferences={preferences}
        simulatorInputs={simulatorInputs}
        simulatorActionStates={simulatorActionStates}
        initialGoalSeed={otherGoalSeed}
        onConsumeGoalSeed={onConsumeOtherGoalSeed}
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

function AiTextInputCard({
  t,
  onSubmit,
  submitting,
  placeholder,
  submitLabelKey = "weddingPlanner.send",
  labelKey = "weddingPlanner.inputLabel",
  initialValue = "",
}) {
  const [value, setValue] = useState(initialValue);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!value.trim() || submitting) return;
    onSubmit(value.trim());
    setValue("");
  };

  return (
    <form className="needHeroCard aiTextInputCard" onSubmit={handleSubmit}>
      <textarea
        className="aiTextInput"
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={t(labelKey)}
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

// Fixed set of milestone ids computePaymentSchedule can produce
// (lib/wedding-finance.js) - a closed taxonomy, not free text.
const WEDDING_PAYMENT_MILESTONE_LABEL_KEYS = {
  deposit: "weddingPlanner.paymentSchedule.milestones.deposit",
  progress: "weddingPlanner.paymentSchedule.milestones.progress",
  balance: "weddingPlanner.paymentSchedule.milestones.balance",
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
                {plan.venue_type ? (
                  <span className="statChip">{t(WEDDING_VENUE_TYPE_LABEL_KEYS[plan.venue_type] ?? "common.notAvailable")}</span>
                ) : null}
                {plan.venue_type && plan.venue_type !== "community" && plan.venue_tier ? (
                  <span className="statChip">{t(WEDDING_VENUE_TIER_LABEL_KEYS[plan.venue_tier] ?? "common.notAvailable")}</span>
                ) : null}
                {plan.photography_tier ? (
                  <span className="statChip">{t(WEDDING_PHOTOGRAPHY_TIER_LABEL_KEYS[plan.photography_tier] ?? "common.notAvailable")}</span>
                ) : null}
                {plan.attire_tier ? (
                  <span className="statChip">{t(WEDDING_ATTIRE_TIER_LABEL_KEYS[plan.attire_tier] ?? "common.notAvailable")}</span>
                ) : null}
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
      {budget.venue_type ? (
        <SummaryRow
          label={t("weddingPlanner.venueType")}
          value={t(WEDDING_VENUE_TYPE_LABEL_KEYS[budget.venue_type] ?? "common.notAvailable")}
        />
      ) : null}
      {budget.venue_type && budget.venue_type !== "community" && budget.venue_tier ? (
        <SummaryRow
          label={t("weddingPlanner.venueTier")}
          value={t(WEDDING_VENUE_TIER_LABEL_KEYS[budget.venue_tier] ?? "common.notAvailable")}
        />
      ) : null}
      {budget.photography_tier ? (
        <SummaryRow
          label={t("weddingPlanner.photographyTier")}
          value={t(WEDDING_PHOTOGRAPHY_TIER_LABEL_KEYS[budget.photography_tier] ?? "common.notAvailable")}
        />
      ) : null}
      {budget.attire_tier ? (
        <SummaryRow
          label={t("weddingPlanner.attireTier")}
          value={t(WEDDING_ATTIRE_TIER_LABEL_KEYS[budget.attire_tier] ?? "common.notAvailable")}
        />
      ) : null}
      <div className="weddingLineItems">
        {budget.line_items.map((item) => (
          <WeddingLineItemRow item={item} key={item.label} />
        ))}
      </div>
      {Array.isArray(budget.payment_schedule) && budget.payment_schedule.length ? (
        <>
          <span className="sectionLabel">{t("weddingPlanner.paymentSchedule.title")}</span>
          <div className="weddingLineItems">
            {budget.payment_schedule.map((milestone) => (
              <SummaryRow
                key={milestone.id}
                label={`${t(WEDDING_PAYMENT_MILESTONE_LABEL_KEYS[milestone.id] ?? milestone.id)} — ${new Date(milestone.dueDate).toLocaleDateString()}`}
                value={formatSgd(Math.round(milestone.amount))}
              />
            ))}
          </div>
        </>
      ) : null}
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

// Judgment Calibration (Follow-Through Score's 5th component, real data
// only once a Mirror rebuttal has actually resolved - lib/follow-through-
// finance.js) unlocking a real stretch amount on top of Auto Top-Up's
// existing tier-2 gate, not just another number on a screen. 20%, rounded
// to the nearest $50 like every other monthly figure in this app - a
// deliberately modest stretch, not a reckless one.
const AUTO_TOP_UP_STRETCH_THRESHOLD = 80;
const AUTO_TOP_UP_STRETCH_MULTIPLIER = 1.2;

function ConfirmedSavingsPlanCard({
  plan,
  checkins = [],
  onAddCheckin,
  checkinSubmitting,
  checkinError,
  relationshipTier = 0,
  judgmentCalibrationScore = null,
  autonomousSavingsEnabled = false,
  t,
}) {
  const { targetTotal, loggedTotal, pct } = computeCheckinProgress(plan, checkins);
  const ringColor = pct >= 75 ? "#0f9f84" : pct >= 60 ? "#f59e0b" : "#d71920";

  // Tier 2+ (Steadfast+/Trusted+) is where the dual-gated relationship score starts unlocking real
  // autonomy, not just a rate discount (see RELATIONSHIP_RATE_DISCOUNT_PERCENT in
  // lib/loan-finance.js for the other half of this). Requires the customer's own standing
  // guardianPermissions.autonomousSavings grant on top of the tier - trust unlocks the ABILITY, the
  // customer's own permission still has to be on.
  const hasCheckinThisMonth = checkins.some((checkin) => checkin.checkin_month === currentMonthValue());
  const autoTopUpAvailable = Boolean(onAddCheckin) && relationshipTier >= 2 && autonomousSavingsEnabled && !hasCheckinThisMonth;
  const autoTopUpStretchAvailable =
    autoTopUpAvailable && judgmentCalibrationScore != null && judgmentCalibrationScore >= AUTO_TOP_UP_STRETCH_THRESHOLD;
  const autoTopUpAmount = autoTopUpStretchAvailable
    ? Math.ceil((plan.monthly_contribution * AUTO_TOP_UP_STRETCH_MULTIPLIER) / 50) * 50
    : plan.monthly_contribution;

  const handleAutoTopUp = () => {
    onAddCheckin({
      checkinMonth: currentMonthValue(),
      amount: autoTopUpAmount,
      note: autoTopUpStretchAvailable
        ? t("weddingPlanner.checkins.guardianAutoAppliedStretchNote")
        : t("weddingPlanner.checkins.guardianAutoAppliedNote"),
    });
  };

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
      {Array.isArray(plan.milestone_feasibility) && plan.milestone_feasibility.length ? (
        <>
          <span className="sectionLabel">{t("weddingPlanner.paymentSchedule.feasibilityTitle")}</span>
          <div className="weddingStatChips">
            {plan.milestone_feasibility.map((milestone) => (
              <span className={milestone.funded ? "statChip" : "statChip warning"} key={milestone.id}>
                {t(WEDDING_PAYMENT_MILESTONE_LABEL_KEYS[milestone.id] ?? milestone.id)}:{" "}
                {milestone.funded
                  ? t("weddingPlanner.paymentSchedule.funded")
                  : t("weddingPlanner.paymentSchedule.shortfall", { amount: formatSgd(milestone.shortfallAmount) })}
              </span>
            ))}
          </div>
        </>
      ) : null}
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

      {autoTopUpAvailable ? (
        <div className="needHeroCard">
          <span className="sectionLabel">{t("weddingPlanner.checkins.guardianAutoTopUpLabel")}</span>
          <p>{t("weddingPlanner.checkins.guardianAutoTopUpBody", { amount: formatSgd(Math.round(autoTopUpAmount)) })}</p>
          {autoTopUpStretchAvailable ? (
            <p className="calibrationRebuttalQuote">
              {t("weddingPlanner.checkins.guardianAutoTopUpStretchNote", { score: judgmentCalibrationScore })}
            </p>
          ) : null}
          <button type="button" className="primaryButton" disabled={checkinSubmitting} onClick={handleAutoTopUp}>
            {checkinSubmitting ? t("weddingPlanner.thinking") : t("weddingPlanner.checkins.guardianAutoTopUpButton")}
            <Zap size={18} />
          </button>
        </div>
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

// Third pilot of the zero-input draft pattern. Unlike Home, a wedding has
// no regulatory ceiling to derive a real "safe budget" from - there is no
// verified real Singapore benchmark this app can honestly cite for what a
// wedding "should" cost. So this shows what IS real and computable
// without asking anything (a real monthly savings capacity, from real
// income/expenses/already-confirmed commitments), then asks only the 2
// things the bank genuinely can't know: timeline and rough scale. See
// lib/wedding-draft-finance.js.
const WEDDING_DRAFT_TIMELINE_OPTIONS = [
  { id: "asap", labelKey: "homePlanner.draft.timeline.asap", months: 6, seedText: "within the next 6 months" },
  { id: "oneYear", labelKey: "homePlanner.draft.timeline.oneYear", months: 12, seedText: "within about a year" },
  { id: "twoYears", labelKey: "homePlanner.draft.timeline.twoYears", months: 18, seedText: "in 1-2 years" },
  { id: "exploring", labelKey: "homePlanner.draft.timeline.exploring", months: null, seedText: "just exploring for now, no firm date" },
];
const WEDDING_DRAFT_SCALE_OPTIONS = [
  { id: "intimate", labelKey: "weddingPlanner.draft.scale.intimate", seedText: "an intimate wedding, under 50 guests" },
  { id: "moderate", labelKey: "weddingPlanner.draft.scale.moderate", seedText: "a moderate wedding, 50-150 guests" },
  { id: "grand", labelKey: "weddingPlanner.draft.scale.grand", seedText: "a grand wedding, 150+ guests" },
];

function WeddingRealDraft({ profile, t, onStartWithSeed, submitting }) {
  const [committedMonthlyTotal, setCommittedMonthlyTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState(null);
  const [scale, setScale] = useState(null);

  const monthlyIncome = numberValue(profile.monthlyIncome, 0);
  const monthlyExpenses = numberValue(profile.monthlyExpenses, 0);
  const currentSavings = numberValue(profile.currentSavings, 0);
  const hasRealProfile = String(profile?.statedMonthlyIncome ?? "") !== String(defaultProfile.statedMonthlyIncome);

  useEffect(() => {
    if (!hasRealProfile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ monthlyIncome: String(monthlyIncome), monthlyExpenses: String(monthlyExpenses) });
    fetch(`/api/strategic-balance/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setCommittedMonthlyTotal(data.committedMonthlyTotal ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCommittedMonthlyTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasRealProfile]);

  if (!hasRealProfile) {
    return (
      <section className="weddingHero">
        <span className="weddingHeroIcon">
          <HeartHandshake size={26} />
        </span>
        <strong>{t("weddingPlanner.draft.noProfileLabel")}</strong>
        <p>{t("weddingPlanner.draft.noProfileBody")}</p>
      </section>
    );
  }

  if (loading || committedMonthlyTotal === null) {
    return <p>{t("loading.detail")}</p>;
  }

  const capacity = computeWeddingSavingsCapacity({ monthlyIncome, monthlyExpenses, committedMonthlyTotal });
  const selectedTimeline = WEDDING_DRAFT_TIMELINE_OPTIONS.find((option) => option.id === timeline);
  const projection = selectedTimeline
    ? computeProjectedWeddingSavings({ currentSavings, monthlyCapacity: capacity.monthlyCapacity, timelineMonths: selectedTimeline.months })
    : null;

  const canStart = Boolean(timeline && scale);

  const handleStart = () => {
    if (!canStart) return;
    const timelineText = selectedTimeline?.seedText;
    const scaleText = WEDDING_DRAFT_SCALE_OPTIONS.find((option) => option.id === scale)?.seedText;
    onStartWithSeed(`We're planning ${scaleText}, ${timelineText}.`);
  };

  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("weddingPlanner.draft.title")}</span>
      {capacity.hasCapacity ? (
        <p>{t("weddingPlanner.draft.capacity", { amount: formatSgd(capacity.monthlyCapacity) })}</p>
      ) : (
        <p>{t("weddingPlanner.draft.noCapacity")}</p>
      )}
      {projection ? (
        <p>{t("weddingPlanner.draft.projection", { amount: formatSgd(projection.projectedSavings) })}</p>
      ) : null}
      <small className="riskText">{t("weddingPlanner.draft.basedOn")}</small>

      <div className="settingsGroup">
        <span className="sectionLabel">{t("homePlanner.draft.timelineQuestion")}</span>
        <div className="checkboxGrid">
          {WEDDING_DRAFT_TIMELINE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={timeline === option.id ? "checkOption selected" : "checkOption"}
              onClick={() => setTimeline(option.id)}
            >
              <span>{t(option.labelKey)}</span>
            </button>
          ))}
        </div>

        <span className="sectionLabel">{t("weddingPlanner.draft.scaleQuestion")}</span>
        <div className="checkboxGrid">
          {WEDDING_DRAFT_SCALE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={scale === option.id ? "checkOption selected" : "checkOption"}
              onClick={() => setScale(option.id)}
            >
              <span>{t(option.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="primaryButton" disabled={!canStart || submitting} onClick={handleStart}>
        {submitting ? t("weddingPlanner.thinking") : t("weddingPlanner.draft.startButton")}
        <Send size={18} />
      </button>
    </section>
  );
}

// Fourth pilot of the zero-input draft pattern. Unlike Wedding/Home, this
// one has a genuinely real, fully computed number available with ZERO
// input at all: CPF LIFE math (lib/retirement-finance.js) only needs real
// age + real income, both already on file, plus a default retirement age
// (65) and a deterministic CPF-balance estimate (estimateCurrentCpfBalances)
// when the customer hasn't entered real balances - so the projected
// payout below updates live as the customer taps a retirement-age tier,
// before they've answered anything. The one thing this app genuinely
// cannot know is the lifestyle they want in retirement (there's no real
// Singapore benchmark for "a comfortable retirement costs X" the way
// there's no benchmark for wedding cost) - that's the one real ask, same
// honesty as WeddingRealDraft.
const RETIREMENT_DRAFT_AGE_OPTIONS = [
  { id: "age60", labelKey: "retirementPlanner.draft.age.age60", age: 60, seedText: "retire at age 60" },
  { id: "age62", labelKey: "retirementPlanner.draft.age.age62", age: 62, seedText: "retire at age 62" },
  { id: "age65", labelKey: "retirementPlanner.draft.age.age65", age: 65, seedText: "retire at age 65" },
  { id: "age68", labelKey: "retirementPlanner.draft.age.age68", age: 68, seedText: "retire at age 68" },
];
const RETIREMENT_DRAFT_LIFESTYLE_OPTIONS = [
  { id: "modest", labelKey: "retirementPlanner.draft.lifestyle.modest", seedText: "living a modest, basic-needs lifestyle" },
  { id: "comfortable", labelKey: "retirementPlanner.draft.lifestyle.comfortable", seedText: "living comfortably, about like now" },
  { id: "premium", labelKey: "retirementPlanner.draft.lifestyle.premium", seedText: "a premium lifestyle with travel and indulgences" },
];

function RetirementRealDraft({ profile, t, onStartWithSeed, submitting, onOpenCpfInput }) {
  const [ageTier, setAgeTier] = useState(null);
  const [lifestyle, setLifestyle] = useState(null);

  const hasRealProfile = String(profile?.statedMonthlyIncome ?? "") !== String(defaultProfile.statedMonthlyIncome);

  if (!hasRealProfile) {
    return (
      <section className="weddingHero">
        <span className="weddingHeroIcon">
          <Landmark size={26} />
        </span>
        <strong>{t("retirementPlanner.draft.noProfileLabel")}</strong>
        <p>{t("retirementPlanner.draft.noProfileBody")}</p>
      </section>
    );
  }

  const currentAge = numberValue(profile.age, 27);
  const monthlyIncome = numberValue(profile.monthlyIncome, 0);
  const selectedAge = RETIREMENT_DRAFT_AGE_OPTIONS.find((option) => option.id === ageTier);
  const previewRetirementAge = selectedAge?.age ?? 65;
  const preview = computeRetirementFinancials({
    targetMonthlyIncome: 0,
    currentAge,
    retirementAge: previewRetirementAge,
    monthlyIncome,
    cpfLifePlan: "standard",
    payoutAge: 65,
  });

  const canStart = Boolean(ageTier && lifestyle);

  const handleStart = () => {
    if (!canStart) return;
    const ageText = selectedAge?.seedText;
    const lifestyleText = RETIREMENT_DRAFT_LIFESTYLE_OPTIONS.find((option) => option.id === lifestyle)?.seedText;
    onStartWithSeed(`I'd like to ${ageText}, ${lifestyleText}.`);
  };

  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("retirementPlanner.draft.title")}</span>
      <p>{t("retirementPlanner.draft.projection", { age: previewRetirementAge, amount: formatSgd(preview.cpf_life_payout) })}</p>
      <small className="riskText">{t("retirementPlanner.draft.basedOn")}</small>
      <button type="button" className="linkButton" onClick={onOpenCpfInput}>
        {t("retirementPlanner.draft.enterRealBalances")}
      </button>

      <div className="settingsGroup">
        <span className="sectionLabel">{t("retirementPlanner.draft.ageQuestion")}</span>
        <div className="checkboxGrid">
          {RETIREMENT_DRAFT_AGE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={ageTier === option.id ? "checkOption selected" : "checkOption"}
              onClick={() => setAgeTier(option.id)}
            >
              <span>{t(option.labelKey)}</span>
            </button>
          ))}
        </div>

        <span className="sectionLabel">{t("retirementPlanner.draft.lifestyleQuestion")}</span>
        <div className="checkboxGrid">
          {RETIREMENT_DRAFT_LIFESTYLE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={lifestyle === option.id ? "checkOption selected" : "checkOption"}
              onClick={() => setLifestyle(option.id)}
            >
              <span>{t(option.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="primaryButton" disabled={!canStart || submitting} onClick={handleStart}>
        {submitting ? t("weddingPlanner.thinking") : t("retirementPlanner.draft.startButton")}
        <Send size={18} />
      </button>
    </section>
  );
}

function WeddingNeedContent({
  success,
  setSuccess,
  t,
  setActiveScreen,
  language,
  setSimulatorInputs,
  setMemoryEvents,
  profile,
  preferences,
  simulatorInputs,
  simulatorActionStates,
}) {
  const { tier: relationshipTier, judgmentCalibrationScore } = useRelationshipTier(preferences, simulatorInputs, simulatorActionStates);
  const autonomousSavingsEnabled = Boolean(preferences?.guardianPermissions?.autonomousSavings);
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
      // A partner with "view_and_act" access must separately confirm before
      // this becomes real - not saved yet, so none of the normal
      // confirmed-budget state/side-effects below apply.
      if (data.status === "pending_partner_confirmation") {
        setSessionData((current) => ({ ...current, pendingPartnerConfirmation: { kind: "budget" } }));
        return true;
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
      if (data.status === "pending_partner_confirmation") {
        setSessionData((current) => ({ ...current, pendingPartnerConfirmation: { kind: "savings_plan" } }));
        return true;
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
      ) : sessionData?.pendingPartnerConfirmation ? (
        <section className="needHeroCard">
          <Bot size={20} />
          <span className="sectionLabel">{t("weddingPlanner.jointConfirmation.pendingTitle")}</span>
          <p>
            {sessionData.pendingPartnerConfirmation.kind === "budget"
              ? t("weddingPlanner.jointConfirmation.pendingBudgetBody")
              : t("weddingPlanner.jointConfirmation.pendingSavingsPlanBody")}
          </p>
        </section>
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
              relationshipTier={relationshipTier}
              judgmentCalibrationScore={judgmentCalibrationScore}
              autonomousSavingsEnabled={autonomousSavingsEnabled}
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
            <WeddingRealDraft profile={profile} t={t} onStartWithSeed={handleSubmit} submitting={submitting} />
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {!selectedPlan && sessionData?.planOptions ? (
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
        <textarea
          className="aiTextInput"
          rows={2}
          value={customText}
          onChange={(event) => onCustomTextChange(event.target.value)}
          placeholder={t("homePlanner.customRequestPlaceholder")}
          aria-label={t("homePlanner.customRequestLabel")}
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
        <textarea
          className="aiTextInput"
          rows={2}
          value={customText}
          onChange={(event) => onCustomTextChange(event.target.value)}
          placeholder={t("retirementPlanner.customRequestPlaceholder")}
          aria-label={t("retirementPlanner.customRequestLabel")}
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

// "Other" is the catch-all planner for any goal that doesn't fit an existing category (a trip, a
// big purchase, an event, anything) - same two-stage AI-conversation architecture as Wedding
// (lib/other-*.js, app/api/other/*), just without Wedding's deterministic venue/photography/attire
// categories, since there's no fixed domain here. Confirming a plan/savings strategy writes into
// preferences.customGoals and simulatorInputs.custom* the same shape the old standalone Custom Goal
// modal used, so Strategic Balance, the Follow-Through Score, and Mirror's own reasoning all keep
// working against this richer planner without any changes on their end.
function OtherNeedContent({
  success,
  setSuccess,
  t,
  setActiveScreen,
  language,
  setPreferences,
  setSimulatorInputs,
  setMemoryEvents,
  profile,
  initialGoalSeed,
  onConsumeGoalSeed,
}) {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [checkinDraft, setCheckinDraft] = useState({ checkinMonth: "", amount: "", note: "" });
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState("");
  const [exploringPlan, setExploringPlan] = useState(false);
  const [exploringSavings, setExploringSavings] = useState(false);

  // Consume the seed once - AiTextInputCard only reads initialValue on its
  // own first mount, so this just clears the app-level state (see App())
  // so a later, unrelated visit to this screen doesn't see a stale kids-
  // goal starter text reappear.
  useEffect(() => {
    if (initialGoalSeed) onConsumeGoalSeed?.();
  }, []);

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    fetch("/api/other/history")
      .then((response) => response.json())
      .then((data) => setHistoryEntries(data.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/other/session")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setSessionData(data);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage(t("otherPlanner.genericError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  function syncCustomGoal(confirmedPlan, monthlyContribution) {
    const dateMonth = confirmedPlan.target_date?.slice(0, 7) || defaultCustomGoalDraft.date;
    const plan = computeCustomGoalMonthlyPlan(String(confirmedPlan.total_budget), dateMonth);
    const goal = {
      id: `other-${confirmedPlan.plan_id}`,
      name: confirmedPlan.goal_name,
      amount: String(Math.round(confirmedPlan.total_budget)),
      date: dateMonth,
      priority: "High",
      category: "Other",
      notes: confirmedPlan.confirmation_note ?? "",
      monthlyContribution: monthlyContribution ?? plan.monthlyContribution,
      monthsRemaining: plan.monthsRemaining,
      confirmedAt: new Date().toISOString(),
    };
    setPreferences((current) => {
      // Raw stored profile, not getUserProfile(current) - same leak this
      // needs to avoid as updateProfileField (computed fields like the
      // smoothed monthlyIncome must never get baked into persisted storage).
      const currentProfile = mergeDefaults(defaultProfile, current.profile);
      const existing = getCustomGoals(current).filter((g) => g.id !== goal.id);
      return {
        ...current,
        customGoals: [goal, ...existing],
        profile: { ...currentProfile, goals: { ...currentProfile.goals, custom: true } },
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
  }

  const submitToStage1 = async (intent, message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/other/stage1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, message, language }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("otherPlanner.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        planOptions: data.type === "propose_plans" ? data.data : current?.planOptions,
        confirmedPlan: data.type === "confirm_goal_plan" ? data.data : current?.confirmedPlan,
        stage1Status: data.type === "confirm_goal_plan" ? "confirmed" : current?.stage1Status,
      }));
      if (data.type === "confirm_goal_plan") {
        setSuccess();
        setExploringPlan(false);
        const plan = data.data;
        syncCustomGoal(plan, null);
        setMemoryEvents((current) => [
          {
            id: `other-confirmed-${plan.plan_id}`,
            year: new Date(plan.target_date).getFullYear().toString(),
            title: t("otherPlanner.memoryEventTitle", { goal: plan.goal_name }),
            description: plan.confirmation_note,
            impact: t("otherPlanner.memoryEventImpact", { amount: formatSgd(Math.round(plan.total_budget)) }),
            product: t("otherPlanner.memoryEventProduct"),
            action: t("otherPlanner.memoryEventAction"),
            reason: t("otherPlanner.memoryEventReason"),
            dataUsed: t("otherPlanner.memoryEventDataUsed"),
            statusKey: "status.completed",
            confirmedAt: data.confirmedAt ?? null,
          },
          ...current,
        ]);
      }
      return true;
    } catch {
      setErrorMessage(t("otherPlanner.genericError"));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (text) =>
    submitToStage1(sessionData?.planOptions || sessionData?.confirmedPlan ? "refine" : "generate", text);

  const handleChoosePlan = (plan) => submitToStage1("refine", t("otherPlanner.choosePlanMessage", { plan: plan.name }));

  const submitToStage2 = async (intent, message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/other/stage2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, message, language, profile }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "inconclusive" && data.detail ? data.detail : t("otherPlanner.genericError"));
        return false;
      }
      setSessionData((current) => ({
        ...current,
        savingsPlanOptions: data.type === "propose_savings_plan" ? data.data : current?.savingsPlanOptions,
        confirmedSavingsPlan: data.type === "finalize_savings_plan" ? data.data : current?.confirmedSavingsPlan,
        goalFeasibility: data.goalFeasibility ?? current?.goalFeasibility,
      }));
      if (data.type === "finalize_savings_plan" && sessionData?.confirmedPlan) {
        setExploringSavings(false);
        const plan = data.data;
        syncCustomGoal(sessionData.confirmedPlan, plan.monthly_contribution);
      }
      return true;
    } catch {
      setErrorMessage(t("otherPlanner.genericError"));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSavingsPlan = () => submitToStage2("generate", t("otherPlanner.startSavingsMessage"));
  const handleSavingsSubmit = (text) =>
    submitToStage2(sessionData?.savingsPlanOptions || sessionData?.confirmedSavingsPlan ? "refine" : "generate", text);
  const handleChooseStrategy = (strategy) => submitToStage2("refine", t("otherPlanner.chooseStrategyMessage", { strategy: strategy.name }));

  const handleExplorePlan = () => {
    setSessionData((current) => ({ ...current, planOptions: null }));
    setExploringPlan(true);
  };
  const handleExploreSavings = () => {
    setSessionData((current) => ({ ...current, savingsPlanOptions: null }));
    setExploringSavings(true);
  };

  const handleAddCheckin = async (event) => {
    event.preventDefault();
    if (!checkinDraft.checkinMonth || !checkinDraft.amount) return;
    setCheckinSubmitting(true);
    setCheckinError("");
    try {
      const response = await fetch("/api/other/savings-checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkinDraft),
      });
      const data = await response.json();
      if (!response.ok) {
        setCheckinError(t("otherPlanner.checkins.genericError"));
        return;
      }
      setSessionData((current) => ({
        ...current,
        savingsCheckins: [...(current?.savingsCheckins ?? []), data.checkin],
      }));
      setCheckinDraft({ checkinMonth: "", amount: "", note: "" });
    } catch {
      setCheckinError(t("otherPlanner.checkins.genericError"));
    } finally {
      setCheckinSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title={t("otherPlanner.title")} subtitle={t("otherPlanner.subtitle")} />
      <div className="weddingTopRow">
        <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />
        <button type="button" className="historyButton" onClick={openHistory} aria-label={t("otherPlanner.historyTitle")}>
          <History size={16} />
        </button>
      </div>
      {historyOpen ? (
        <ConversationHistoryModal
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
          t={t}
          titleKey="otherPlanner.historyTitle"
          emptyKey="otherPlanner.historyEmpty"
        />
      ) : null}
      <SuccessBanner show={success} text={t("otherPlanner.success")} />

      {loading ? (
        <p>{t("loading.detail")}</p>
      ) : (
        <>
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}

          {!sessionData?.confirmedPlan || exploringPlan ? (
            <>
              {sessionData?.confirmedPlan ? (
                <section className="trustNote compactTrustNote">
                  <Info size={17} />
                  <p>{t("otherPlanner.exploringNote")}</p>
                </section>
              ) : null}

              <AiTextInputCard
                t={t}
                onSubmit={handleSubmit}
                submitting={submitting}
                placeholder={t("otherPlanner.inputPlaceholder")}
                submitLabelKey={sessionData?.planOptions ? "otherPlanner.refine" : "otherPlanner.send"}
                labelKey="otherPlanner.inputLabel"
                initialValue={initialGoalSeed ?? ""}
              />

              {sessionData?.planOptions ? (
                <>
                  {sessionData.planOptions.research_notes ? (
                    <section className="trustNote compactTrustNote">
                      <Info size={17} />
                      <p>{sessionData.planOptions.research_notes}</p>
                    </section>
                  ) : null}
                  {sessionData.planOptions.plans.map((plan, index) => (
                    <article className={index === 0 ? "weddingPlanTile accent-1" : "weddingPlanTile accent-2"} key={plan.id}>
                      <h3>{plan.name}</h3>
                      <p>{plan.summary}</p>
                      <div className="weddingLineItems">
                        {plan.line_items.map((item) => (
                          <WeddingLineItemRow item={{ category: item.category, label: `${item.label} (${item.quantity} ${item.unit})`, subtotal: item.subtotal }} key={item.label} />
                        ))}
                      </div>
                      <SummaryRow label={t("otherPlanner.totalCost")} value={formatSgd(Math.round(plan.total_cost))} />
                      <SummaryRow label={t("otherPlanner.targetDate")} value={plan.target_date} />
                      <button type="button" className="primaryButton" onClick={() => handleChoosePlan(plan)} disabled={submitting}>
                        {t("otherPlanner.choosePlan")}
                        <ChevronRight size={18} />
                      </button>
                    </article>
                  ))}
                </>
              ) : null}

              {sessionData?.confirmedPlan && exploringPlan ? (
                <button type="button" className="secondaryButton" onClick={() => setExploringPlan(false)} disabled={submitting}>
                  {t("otherPlanner.cancelExplore")}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <section className="recommendationPanel">
                <span className="sectionLabel">{t("otherPlanner.confirmedTitle")}</span>
                <SummaryRow label={t("otherPlanner.goalName")} value={sessionData.confirmedPlan.goal_name} />
                <SummaryRow label={t("otherPlanner.totalCost")} value={formatSgd(Math.round(sessionData.confirmedPlan.total_budget))} />
                <SummaryRow label={t("otherPlanner.targetDate")} value={sessionData.confirmedPlan.target_date} />
                <div className="weddingLineItems">
                  {sessionData.confirmedPlan.line_items.map((item) => (
                    <WeddingLineItemRow item={{ category: item.category, label: `${item.label} (${item.quantity} ${item.unit})`, subtotal: item.subtotal }} key={item.label} />
                  ))}
                </div>
              </section>

              <button type="button" className="secondaryButton" onClick={handleExplorePlan}>
                {t("otherPlanner.changePlan")}
              </button>

              {!sessionData.confirmedSavingsPlan || exploringSavings ? (
                !sessionData.savingsPlanOptions && !exploringSavings ? (
                  <button type="button" className="primaryButton" onClick={handleStartSavingsPlan} disabled={submitting}>
                    {t("otherPlanner.startSavingsPlan")}
                    <Sparkles size={18} />
                  </button>
                ) : (
                  <>
                    {sessionData.confirmedSavingsPlan && exploringSavings ? (
                      <section className="trustNote compactTrustNote">
                        <Info size={17} />
                        <p>{t("otherPlanner.exploringNote")}</p>
                      </section>
                    ) : null}
                    {sessionData.goalFeasibility ? (
                      <section className="recommendationPanel">
                        <span className="sectionLabel">{t("otherPlanner.feasibility.title")}</span>
                        <SummaryRow label={t("otherPlanner.feasibility.score")} value={`${sessionData.goalFeasibility.feasibilityScore}/100`} />
                        <SummaryRow label={t("otherPlanner.feasibility.risk")} value={t(`risk.${sessionData.goalFeasibility.riskLevel}`)} />
                        <SummaryRow label={t("otherPlanner.feasibility.requiredMonthly")} value={t("common.perMonth", { amount: formatSgd(sessionData.goalFeasibility.requiredMonthly) })} />
                        {sessionData.goalFeasibility.availableLiquidSavings > 0 ? (
                          <SummaryRow label={t("otherPlanner.feasibility.liquidSavings")} value={formatSgd(sessionData.goalFeasibility.availableLiquidSavings)} />
                        ) : null}
                      </section>
                    ) : null}
                    <AiTextInputCard
                      t={t}
                      onSubmit={handleSavingsSubmit}
                      submitting={submitting}
                      placeholder={t("otherPlanner.savingsInputPlaceholder")}
                      submitLabelKey="otherPlanner.refine"
                      labelKey="otherPlanner.savingsInputLabel"
                    />
                    {sessionData.savingsPlanOptions?.strategies.map((strategy) => (
                      <article className="weddingPlanTile accent-1" key={strategy.id}>
                        <h3>{strategy.name}</h3>
                        <p>{strategy.summary}</p>
                        <SummaryRow label={t("otherPlanner.monthlyContribution")} value={t("common.perMonth", { amount: formatSgd(strategy.monthly_contribution) })} />
                        {strategy.allocation.map((entry) => (
                          <SummaryRow key={entry.vehicle} label={entry.product_ref || entry.vehicle} value={t("common.perMonth", { amount: formatSgd(entry.monthly_amount) })} />
                        ))}
                        <div className="proofBlock">
                          <strong>{t("otherPlanner.suitabilityReason")}</strong>
                          <p>{strategy.suitability.reason}</p>
                        </div>
                        <button type="button" className="primaryButton" onClick={() => handleChooseStrategy(strategy)} disabled={submitting}>
                          {t("otherPlanner.chooseStrategy")}
                          <ChevronRight size={18} />
                        </button>
                      </article>
                    ))}
                    {sessionData.confirmedSavingsPlan && exploringSavings ? (
                      <button type="button" className="secondaryButton" onClick={() => setExploringSavings(false)} disabled={submitting}>
                        {t("otherPlanner.cancelExplore")}
                      </button>
                    ) : null}
                  </>
                )
              ) : (
                <>
                  <section className="recommendationPanel">
                    <span className="sectionLabel">{t("otherPlanner.confirmedSavingsTitle")}</span>
                    <SummaryRow
                      label={t("otherPlanner.monthlyContribution")}
                      value={t("common.perMonth", { amount: formatSgd(sessionData.confirmedSavingsPlan.monthly_contribution) })}
                    />
                    <SummaryRow label={t("otherPlanner.startMonth")} value={sessionData.confirmedSavingsPlan.start_month} />
                    <SummaryRow label={t("otherPlanner.targetCompleteMonth")} value={sessionData.confirmedSavingsPlan.target_complete_month} />
                    {sessionData.confirmedSavingsPlan.savings_plan_feasibility ? (
                      <div className="weddingStatChips">
                        <span className={sessionData.confirmedSavingsPlan.savings_plan_feasibility.funded ? "statChip" : "statChip warning"}>
                          {sessionData.confirmedSavingsPlan.savings_plan_feasibility.funded
                            ? t("otherPlanner.feasibility.funded")
                            : t("otherPlanner.feasibility.shortfall", {
                                amount: formatSgd(sessionData.confirmedSavingsPlan.savings_plan_feasibility.shortfallAmount),
                              })}
                        </span>
                      </div>
                    ) : null}
                  </section>

                  <button type="button" className="secondaryButton" onClick={handleExploreSavings}>
                    {t("otherPlanner.changeSavingsPlan")}
                  </button>

                  <form className="needHeroCard" onSubmit={handleAddCheckin}>
                    <span className="sectionLabel">{t("otherPlanner.checkins.title")}</span>
                    {checkinError ? <p className="errorText">{checkinError}</p> : null}
                    <div className="financialGrid">
                      <label className="inputField">
                        <span>{t("otherPlanner.checkins.month")}</span>
                        <input
                          type="month"
                          value={checkinDraft.checkinMonth}
                          onChange={(event) => setCheckinDraft((current) => ({ ...current, checkinMonth: event.target.value }))}
                        />
                      </label>
                      <label className="inputField">
                        <span>{t("otherPlanner.checkins.amount")}</span>
                        <input
                          type="number"
                          min="0"
                          value={checkinDraft.amount}
                          onChange={(event) => setCheckinDraft((current) => ({ ...current, amount: event.target.value }))}
                        />
                      </label>
                    </div>
                    <button type="submit" className="primaryButton" disabled={checkinSubmitting}>
                      {t("otherPlanner.checkins.submit")}
                      <Check size={17} />
                    </button>
                  </form>
                  {sessionData.savingsCheckins?.length ? (
                    <div className="historyTimeline">
                      <span className="sectionLabel">{t("otherPlanner.checkins.historyTitle")}</span>
                      {sessionData.savingsCheckins.map((checkin) => (
                        <article key={checkin.id}>
                          <span>{checkin.checkin_month}</span>
                          <div>
                            <strong>{formatSgd(Number(checkin.amount))}</strong>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

// The real "zero input" entry point: instead of a blank "tell us about
// the home you want" box, computes a real safe budget range and a real
// down-payment readiness date from data the bank already has (real
// income/expenses, via lib/home-draft-finance.js's real MAS/IRAS-grounded
// math - the same calculateMaxLoan the confirm-time calculation uses),
// then asks only the 3 things the bank genuinely can't know. Tapping
// through them constructs a real starter message and submits straight
// into the existing, unchanged AI planner - this replaces what produces
// the FIRST message, not the planner itself.
const HOME_DRAFT_TIMELINE_OPTIONS = [
  { id: "asap", labelKey: "homePlanner.draft.timeline.asap", seedText: "within the next 6 months" },
  { id: "oneYear", labelKey: "homePlanner.draft.timeline.oneYear", seedText: "within about a year" },
  { id: "twoYears", labelKey: "homePlanner.draft.timeline.twoYears", seedText: "in 1-2 years" },
  { id: "exploring", labelKey: "homePlanner.draft.timeline.exploring", seedText: "just exploring for now, no firm date" },
];
const HOME_DRAFT_PROPERTY_TYPE_OPTIONS = [
  { id: "hdbNew", labelKey: "homePlanner.draft.propertyType.hdbNew", seedText: "a new BTO flat" },
  { id: "hdbResale", labelKey: "homePlanner.draft.propertyType.hdbResale", seedText: "a resale HDB flat" },
  { id: "private", labelKey: "homePlanner.draft.propertyType.private", seedText: "a private condo" },
];

function HomeRealDraft({ profile, t, onStartWithSeed, submitting }) {
  const [committedMonthlyTotal, setCommittedMonthlyTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState(null);
  const [propertyType, setPropertyType] = useState(null);
  const [withPartner, setWithPartner] = useState(null);

  const monthlyIncome = numberValue(profile.monthlyIncome, 0);
  const monthlyExpenses = numberValue(profile.monthlyExpenses, 0);
  const currentSavings = numberValue(profile.currentSavings, 0);
  const hasRealProfile = String(profile?.statedMonthlyIncome ?? "") !== String(defaultProfile.statedMonthlyIncome);

  useEffect(() => {
    if (!hasRealProfile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ monthlyIncome: String(monthlyIncome), monthlyExpenses: String(monthlyExpenses) });
    fetch(`/api/strategic-balance/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setCommittedMonthlyTotal(data.committedMonthlyTotal ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCommittedMonthlyTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasRealProfile]);

  if (!hasRealProfile) {
    return (
      <section className="weddingHero">
        <span className="weddingHeroIcon">
          <Building2 size={26} />
        </span>
        <strong>{t("homePlanner.draft.noProfileLabel")}</strong>
        <p>{t("homePlanner.draft.noProfileBody")}</p>
      </section>
    );
  }

  if (loading || committedMonthlyTotal === null) {
    return <p>{t("loading.detail")}</p>;
  }

  const budgetRange = computeHomeBudgetRange({ monthlyIncome, monthlyExpenses, committedMonthlyTotal });
  const readiness = budgetRange
    ? computeDownPaymentReadiness({ targetPrice: budgetRange.lowPrice, currentSavings, monthlyIncome, monthlyExpenses, committedMonthlyTotal })
    : null;

  const canStart = Boolean(timeline && propertyType && withPartner !== null);

  const handleStart = () => {
    if (!canStart) return;
    const timelineText = HOME_DRAFT_TIMELINE_OPTIONS.find((option) => option.id === timeline)?.seedText;
    const propertyText = HOME_DRAFT_PROPERTY_TYPE_OPTIONS.find((option) => option.id === propertyType)?.seedText;
    const partnerText = withPartner ? "I'm buying together with my partner." : "I'm buying on my own.";
    onStartWithSeed(`I'm looking to buy ${propertyText}, ${timelineText}. ${partnerText}`);
  };

  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("homePlanner.draft.title")}</span>
      {budgetRange ? (
        <>
          <p>{t("homePlanner.draft.budgetRange", { low: formatSgd(budgetRange.lowPrice), high: formatSgd(budgetRange.highPrice) })}</p>
          {readiness.readyNow ? (
            <p>{t("homePlanner.draft.readyNow", { amount: formatSgd(readiness.downPaymentNeeded) })}</p>
          ) : readiness.monthsToReady != null ? (
            <p>{t("homePlanner.draft.readyBy", { month: readiness.readyMonth, amount: formatSgd(readiness.downPaymentNeeded) })}</p>
          ) : (
            <p>{t("homePlanner.draft.notOnTrack", { amount: formatSgd(readiness.downPaymentNeeded) })}</p>
          )}
          <small className="riskText">{t("homePlanner.draft.basedOn")}</small>
        </>
      ) : (
        <p>{t("homePlanner.draft.notEnoughIncome")}</p>
      )}

      <div className="settingsGroup">
        <span className="sectionLabel">{t("homePlanner.draft.timelineQuestion")}</span>
        <div className="checkboxGrid">
          {HOME_DRAFT_TIMELINE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={timeline === option.id ? "checkOption selected" : "checkOption"}
              onClick={() => setTimeline(option.id)}
            >
              <span>{t(option.labelKey)}</span>
            </button>
          ))}
        </div>

        <span className="sectionLabel">{t("homePlanner.draft.propertyTypeQuestion")}</span>
        <div className="checkboxGrid">
          {HOME_DRAFT_PROPERTY_TYPE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={propertyType === option.id ? "checkOption selected" : "checkOption"}
              onClick={() => setPropertyType(option.id)}
            >
              <span>{t(option.labelKey)}</span>
            </button>
          ))}
        </div>

        <span className="sectionLabel">{t("homePlanner.draft.withPartnerQuestion")}</span>
        <div className="checkboxGrid">
          <button type="button" className={withPartner === true ? "checkOption selected" : "checkOption"} onClick={() => setWithPartner(true)}>
            <span>{t("common.yes")}</span>
          </button>
          <button type="button" className={withPartner === false ? "checkOption selected" : "checkOption"} onClick={() => setWithPartner(false)}>
            <span>{t("common.no")}</span>
          </button>
        </div>
      </div>

      <button type="button" className="primaryButton" disabled={!canStart || submitting} onClick={handleStart}>
        {submitting ? t("weddingPlanner.thinking") : t("homePlanner.draft.startButton")}
        <Send size={18} />
      </button>
    </section>
  );
}

function HomeNeedContent({
  success,
  setSuccess,
  t,
  setActiveScreen,
  language,
  setSimulatorInputs,
  setMemoryEvents,
  profile,
  setLoanPlannerInitialPurpose,
  preferences,
  simulatorInputs,
  simulatorActionStates,
}) {
  const { tier: relationshipTier, judgmentCalibrationScore } = useRelationshipTier(preferences, simulatorInputs, simulatorActionStates);
  const autonomousSavingsEnabled = Boolean(preferences?.guardianPermissions?.autonomousSavings);
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
              relationshipTier={relationshipTier}
              judgmentCalibrationScore={judgmentCalibrationScore}
              autonomousSavingsEnabled={autonomousSavingsEnabled}
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
            <HomeRealDraft profile={profile} t={t} onStartWithSeed={handleSubmit} submitting={submitting} />
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {!selectedPlan && sessionData?.planOptions ? (
            <AiTextInputCard
              t={t}
              onSubmit={handleSubmit}
              submitting={submitting}
              placeholder={t("homePlanner.inputPlaceholder")}
              submitLabelKey="weddingPlanner.send"
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
  preferences,
  simulatorActionStates,
}) {
  const { tier: relationshipTier, judgmentCalibrationScore } = useRelationshipTier(preferences, simulatorInputs, simulatorActionStates);
  const autonomousSavingsEnabled = Boolean(preferences?.guardianPermissions?.autonomousSavings);
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
    typeof window === "undefined"
      ? null
      : safeJsonParse(window.localStorage.getItem(storageKey("futureos-retirement-profile")), null)
  );
  const setRetirementProfileInput = (value) => {
    setRetirementProfileInputState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey("futureos-retirement-profile"), JSON.stringify(value));
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

  // Real CPF balances are optional precision, not a required first step -
  // the real draft below already computes a real payout preview from
  // deterministic defaults (see RetirementRealDraft) without asking
  // anything, so this form is opt-in via its own "enter real balances" link.
  const [showCpfInputStep, setShowCpfInputStep] = useState(false);
  const handleCpfInputSubmit = (value) => {
    setRetirementProfileInput(value);
    setShowCpfInputStep(false);
  };

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
      ) : showCpfInputStep ? (
        <RetirementCpfInputStep
          profile={profile}
          simulatorInputs={simulatorInputs}
          onSubmit={handleCpfInputSubmit}
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
              relationshipTier={relationshipTier}
              judgmentCalibrationScore={judgmentCalibrationScore}
              autonomousSavingsEnabled={autonomousSavingsEnabled}
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
            <RetirementRealDraft
              profile={profile}
              t={t}
              onStartWithSeed={handleSubmit}
              submitting={submitting}
              onOpenCpfInput={() => setShowCpfInputStep(true)}
            />
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {!selectedPlan && sessionData?.planOptions ? (
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

// Four-state approval, not a single checkbox: the customer explicitly approves,
// edits the amount, or declines with a reason - a decline is a recorded answer,
// not silence (app/api/hardship/apply/route.js persists it as evidence either way).
function RecoveryActionCard({ action, decision, onDecisionChange, escalated, onEscalate, t }) {
  const Icon = RECOVERY_ACTION_ICONS[action.action_type] ?? ShieldCheck;
  const current = decision?.decision ?? null;
  const needsHumanReview = Boolean(action.suitability?.human_review_required);

  return (
    <div className={current ? `checkOption decisionCard decision-${current}` : "checkOption decisionCard"}>
      <Icon size={18} />
      <span>
        <strong>{t(`needDetails.emergency.actionTypes.${action.action_type}`)}</strong>
        {action.target_domain ? <em> — {t(`needDetails.emergency.domains.${action.target_domain}`)}</em> : null}
        <p>{action.rationale}</p>
        {action.action_type !== "other_ocbc_support" ? <b>{formatSgd(Math.round(action.amount))}</b> : null}

        {needsHumanReview ? (
          <section className="adviceOnlyPanel">
            <UserRound size={18} />
            <div>
              <p>{t("needDetails.emergency.escalation.note")}</p>
              <button type="button" className="secondaryButton" onClick={onEscalate} disabled={escalated}>
                {escalated ? t("needDetails.emergency.escalation.escalated") : t("needDetails.emergency.escalation.button")}
                <UserRound size={16} />
              </button>
            </div>
          </section>
        ) : null}

        <div className="decisionButtonRow">
          <button
            type="button"
            className={current === "approve" ? "miniToggle selected" : "miniToggle"}
            onClick={() => onDecisionChange(action.id, { decision: "approve" })}
          >
            {t("needDetails.emergency.decision.approve")}
          </button>
          <button
            type="button"
            className={current === "edit" ? "miniToggle selected" : "miniToggle"}
            onClick={() => onDecisionChange(action.id, { decision: "edit", editedAmount: decision?.editedAmount ?? action.amount })}
          >
            {t("needDetails.emergency.decision.edit")}
          </button>
          <button
            type="button"
            className={current === "reject" ? "miniToggle selected" : "miniToggle"}
            onClick={() => onDecisionChange(action.id, { decision: "reject", reason: decision?.reason ?? "" })}
          >
            {t("needDetails.emergency.decision.reject")}
          </button>
        </div>

        {current === "edit" ? (
          <label className="inputField">
            <span>{t("needDetails.emergency.decision.editAmountLabel")}</span>
            <input
              value={decision.editedAmount ?? ""}
              onChange={(event) => onDecisionChange(action.id, { decision: "edit", editedAmount: Number(event.target.value) })}
              type="number"
              inputMode="decimal"
            />
          </label>
        ) : null}

        {current === "reject" ? (
          <label className="inputField fullWidthField">
            <span>{t("needDetails.emergency.decision.rejectReasonLabel")}</span>
            <textarea
              value={decision.reason ?? ""}
              onChange={(event) => onDecisionChange(action.id, { decision: "reject", reason: event.target.value })}
              placeholder={t("needDetails.emergency.decision.rejectReasonPlaceholder")}
            />
          </label>
        ) : null}
      </span>
    </div>
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
      {selectedResult?.relationship_discount_percent > 0 ? (
        <section className="trustNote compactTrustNote">
          <Award size={17} />
          <p>{t("loanPlanner.relationshipDiscountNote", { percent: selectedResult.relationship_discount_percent.toFixed(2) })}</p>
        </section>
      ) : null}
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
      {loan.relationship_discount_percent > 0 ? (
        <section className="trustNote compactTrustNote">
          <Award size={17} />
          <p>{t("loanPlanner.relationshipDiscountNote", { percent: loan.relationship_discount_percent.toFixed(2) })}</p>
        </section>
      ) : null}
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

// Event-triggered dynamic micro-insurance (see lib/micro-insurance-finance.js): this loan
// confirmation was the trigger event. No AI involved - the offer is pure arithmetic, computed and
// persisted server-side before the customer ever sees it, so this card only ever displays and
// records a response, never invents a number.
function MicroInsuranceOfferCard({ offer, onRespond, submitting, t }) {
  if (!offer) return null;

  if (offer.status === "accepted") {
    return (
      <section className="trustNote compactTrustNote">
        <ShieldCheck size={17} />
        <p>
          {t("loanPlanner.microInsurance.acceptedNote", {
            amount: formatSgd(Math.round(offer.gapAmount)),
            date: new Date(offer.expiresAt).toLocaleDateString(),
          })}
        </p>
      </section>
    );
  }

  if (offer.status !== "offered") return null;

  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("loanPlanner.microInsurance.title")}</span>
      <p>{t("loanPlanner.microInsurance.body", { amount: formatSgd(Math.round(offer.gapAmount)) })}</p>
      <div className="weddingTotalCost">
        <small>{t("loanPlanner.microInsurance.monthlyPremiumLabel")}</small>
        <strong>{formatSgd(offer.monthlyPremium)}</strong>
      </div>
      <SummaryRow label={t("loanPlanner.microInsurance.durationLabel")} value={t("loanPlanner.microInsurance.durationValue", { months: offer.durationMonths })} />
      <SummaryRow label={t("loanPlanner.microInsurance.totalPremiumLabel")} value={formatSgd(offer.totalPremium)} />
      <div className="buttonPair compactButtons">
        <button type="button" className="primaryButton" disabled={submitting} onClick={() => onRespond("accept")}>
          {t("loanPlanner.microInsurance.acceptButton")}
          <Check size={16} />
        </button>
        <button type="button" className="secondaryButton" disabled={submitting} onClick={() => onRespond("dismiss")}>
          {t("loanPlanner.microInsurance.dismissButton")}
        </button>
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

function LoanPlannerContent({
  success,
  setSuccess,
  t,
  setActiveScreen,
  language,
  profile,
  initialPurpose,
  onConsumeInitialPurpose,
  setMemoryEvents,
  preferences,
  simulatorInputs,
  simulatorActionStates,
}) {
  const [purpose, setPurpose] = useState(null);
  const [followThrough, setFollowThrough] = useState(null);

  // Same dual-score computation as ProductFitScreen/RelationshipLedgerScreen - the discount this
  // tier unlocks isn't just advertised copy here, it's threaded into the real rate used to compute
  // the customer's actual monthly installment (see lib/loan-finance.js's RELATIONSHIP_RATE_DISCOUNT_PERCENT).
  useEffect(() => {
    let cancelled = false;
    const params = getFollowThroughQueryParams(preferences);
    fetch(`/api/follow-through/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setFollowThrough(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const { reputationBand } = computeGuardianReputation(preferences, simulatorInputs, simulatorActionStates);
  const followThroughBand = followThrough?.band ?? "newRelationship";
  const relationshipBenefits = getRelationshipBenefits(followThroughBand, reputationBand);
  const relationshipTier = relationshipBenefits.tier;
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
  const [microInsuranceOffer, setMicroInsuranceOffer] = useState(null);
  const [microInsuranceSubmitting, setMicroInsuranceSubmitting] = useState(false);

  useEffect(() => {
    if (initialPurpose) {
      setPurpose(initialPurpose);
      onConsumeInitialPurpose();
    }
  }, [initialPurpose, onConsumeInitialPurpose]);

  // Catches an offer triggered by a PAST loan confirmation that was never addressed - the trigger
  // only fires inside /api/loan/confirm's response, so a customer who navigates away before
  // responding would otherwise never see it again.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/micro-insurance/latest")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.offer) setMicroInsuranceOffer(data.offer);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const respondToMicroInsuranceOffer = async (action) => {
    if (!microInsuranceOffer) return;
    setMicroInsuranceSubmitting(true);
    try {
      const response = await fetch("/api/micro-insurance/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: microInsuranceOffer.id, action }),
      });
      if (response.ok) {
        const data = await response.json();
        setMicroInsuranceOffer(data.offer);
      }
    } catch {
      // Non-critical - the offer stays visible and can be retried.
    } finally {
      setMicroInsuranceSubmitting(false);
    }
  };

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
      } else {
        // renovation/personal have no principal to pre-fill (genuinely
        // unknown - only the customer knows how much they need), but real
        // cross-goal commitments ARE known, so fetch them early to ground
        // the affordability preview shown before the amount ask, instead
        // of leaving that ask completely blank.
        const contextResponse = await fetch(`/api/loan/sizing-context?purpose=${purpose}`);
        if (cancelled) return;
        if (contextResponse.ok) {
          const contextJson = await contextResponse.json();
          setOtherGoalsMonthlyOutflow(contextJson.otherGoalsMonthlyOutflow ?? 0);
        }
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
          relationshipTier,
          insuranceCoverageAmount: numberValue(profile.insuranceCoverageAmount, 150000),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("loanPlanner.genericError"));
        return;
      }
      setConfirmedLoan(data.data);
      setMicroInsuranceOffer(data.microInsuranceOffer ?? null);
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
          relationshipTier,
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
        <>
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
          <MicroInsuranceOfferCard
            offer={microInsuranceOffer}
            onRespond={respondToMicroInsuranceOffer}
            submitting={microInsuranceSubmitting}
            t={t}
          />
        </>
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
        <>
          <LoanAffordabilityPreview
            purpose={purpose}
            monthlyIncome={numberValue(profile.monthlyIncome, 7500)}
            otherGoalsMonthlyOutflow={otherGoalsMonthlyOutflow}
            t={t}
          />
          <AiTextInputCard
            t={t}
            onSubmit={submitSizing}
            submitting={submitting}
            placeholder={t(`loanPlanner.sizingPlaceholders.${purpose}`)}
            submitLabelKey="weddingPlanner.sendFirst"
            labelKey="loanPlanner.sizingInputLabel"
          />
        </>
      )}
    </Screen>
  );
}

function LoanAffordabilityPreview({ purpose, monthlyIncome, otherGoalsMonthlyOutflow, t }) {
  const preview = computeLoanAffordabilityPreview({ purposeKey: purpose, monthlyIncome, otherGoalsMonthlyOutflow });
  return (
    <section className="trustNote compactTrustNote">
      <Info size={17} />
      <p>
        {preview.maxLoanAmount > 0
          ? t("loanPlanner.affordabilityPreview.body", {
              amount: formatSgd(preview.maxLoanAmount),
              years: preview.tenureYears,
              monthly: formatSgd(preview.monthlyCeiling),
            })
          : t("loanPlanner.affordabilityPreview.noRoom")}
      </p>
    </section>
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
      {item.live_quote ? (
        <SummaryRow
          label={t("investmentPlanner.liveQuoteLabel")}
          value={t("investmentPlanner.liveQuoteValue", {
            currency: item.live_quote.currency ?? "",
            price: item.live_quote.price,
            time: new Date(item.live_quote.asOf).toLocaleTimeString(),
          })}
        />
      ) : item.ticker ? (
        <SummaryRow label={t("investmentPlanner.liveQuoteLabel")} value={t("investmentPlanner.liveQuoteUnavailable")} />
      ) : null}
      <SummaryRow label={t("investmentPlanner.expectedReturnLabel")} value={`${item.expected_annual_return_percent}%`} />
      <small className="calibrationRebuttalQuote">{t("investmentPlanner.expectedReturnDisclaimer")}</small>
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

function InvestmentConfirmedCard({ pick, outcome, t }) {
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
      {outcome?.hasRealData ? <RealAccuracyCheck outcome={outcome} t={t} /> : null}
      <AccuracyGuaranteeExplorer pick={pick} t={t} />
    </section>
  );
}

// The real counterpart to AccuracyGuaranteeExplorer below - same formula
// (lib/accuracy-guarantee-finance.js), but fed real elapsed time and a real
// actual-value estimate derived from a live market quote
// (app/api/investment/outcomes/route.js), not a hypothetical typed-in
// number. Only rendered once a real baseline quote exists (captured at
// confirm time) and a real current quote was just fetched - never a guess
// standing in for either.
function RealAccuracyCheck({ outcome, t }) {
  const result = computeAccuracyGuarantee({ expectedValueAtElapsed: outcome.expectedValueAtElapsed, actualValue: outcome.actualValue });
  return (
    <div className="strategicAccordionItem expanded">
      <span className="sectionLabel">{t("investmentPlanner.accuracyGuarantee.realTitle")}</span>
      <p className="weddingCarouselHint">
        {t("investmentPlanner.accuracyGuarantee.realExplainer", {
          months: outcome.elapsedMonths,
          entryPrice: outcome.quoteAtConfirmPrice,
          currentPrice: outcome.currentPrice,
          asOf: new Date(outcome.currentPriceAsOf).toLocaleString(),
        })}
      </p>
      <div className="weddingStatChips">
        <span className="statChip">
          {t("investmentPlanner.accuracyGuarantee.expectedLabel")}: {formatSgd(outcome.expectedValueAtElapsed)}
        </span>
        <span className="statChip">
          {t("investmentPlanner.accuracyGuarantee.realActualLabel")}: {formatSgd(outcome.actualValue)}
        </span>
        <span className={result.triggered ? "statChip warning" : "statChip"}>
          {t("investmentPlanner.accuracyGuarantee.shortfallLabel")}: {result.shortfallPercent}%
        </span>
      </div>
      {result.triggered ? (
        <p className="weddingCarouselHint">{t("investmentPlanner.accuracyGuarantee.triggeredNote", { amount: formatSgd(result.creditAmount) })}</p>
      ) : (
        <p className="weddingCarouselHint">{t("investmentPlanner.accuracyGuarantee.realNotTriggeredNote")}</p>
      )}
    </div>
  );
}

// "Recommendation accuracy accountability" concept preview (see lib/accuracy-guarantee-finance.js's
// header comment for why this is explorable-but-hypothetical rather than backed by a real elapsed-
// time market feed). The formula and every number it computes are real; only "actual value" is a
// hypothetical the customer types in to see how the policy would apply. RealAccuracyCheck above
// shows the real version when real data exists - this explorer stays available regardless, since
// "what if it dropped further" is still a meaningful question even with real data on hand.
function AccuracyGuaranteeExplorer({ pick, t }) {
  const [open, setOpen] = useState(false);
  const horizonMonths = pick.horizon_years * 12;
  const [elapsedMonths, setElapsedMonths] = useState(Math.min(12, horizonMonths));
  const [actualValue, setActualValue] = useState(String(pick.projection.totalContributed));

  const expectedValueAtElapsed = computeExpectedValueAtElapsed({
    projectedEndValue: pick.projection.projectedEndValue,
    totalContributed: pick.projection.totalContributed,
    elapsedMonths,
    horizonMonths,
    purchaseMode: pick.purchase_mode,
  });
  const result = computeAccuracyGuarantee({ expectedValueAtElapsed, actualValue: numberValue(actualValue, expectedValueAtElapsed) });

  return (
    <div className="strategicAccordionItem">
      <button type="button" className="secondaryButton" onClick={() => setOpen((current) => !current)}>
        {open ? t("investmentPlanner.accuracyGuarantee.hideLabel") : t("investmentPlanner.accuracyGuarantee.showLabel")}
      </button>
      {open ? (
        <div className="strategicAccordionDetail">
          <p>{t("investmentPlanner.accuracyGuarantee.explainer", { threshold: UNDERPERFORMANCE_THRESHOLD_PERCENT, credit: FEE_CREDIT_PERCENT_OF_SHORTFALL })}</p>
          <span className="sectionLabel">{t("investmentPlanner.accuracyGuarantee.elapsedLabel", { months: elapsedMonths })}</span>
          <input
            type="range"
            min="1"
            max={horizonMonths}
            step="1"
            value={elapsedMonths}
            onChange={(event) => setElapsedMonths(Number(event.target.value))}
            aria-label={t("investmentPlanner.accuracyGuarantee.elapsedLabel", { months: elapsedMonths })}
          />
          <span className="sectionLabel">{t("investmentPlanner.accuracyGuarantee.actualValueLabel")}</span>
          <input
            type="number"
            min="0"
            className="aiTextInput"
            value={actualValue}
            onChange={(event) => setActualValue(event.target.value)}
            aria-label={t("investmentPlanner.accuracyGuarantee.actualValueLabel")}
          />
          <div className="weddingStatChips">
            <span className="statChip">
              {t("investmentPlanner.accuracyGuarantee.expectedLabel")}: {formatSgd(expectedValueAtElapsed)}
            </span>
            <span className={result.triggered ? "statChip warning" : "statChip"}>
              {t("investmentPlanner.accuracyGuarantee.shortfallLabel")}: {result.shortfallPercent}%
            </span>
          </div>
          {result.triggered ? (
            <p className="weddingCarouselHint">
              {t("investmentPlanner.accuracyGuarantee.triggeredNote", { amount: formatSgd(result.creditAmount) })}
            </p>
          ) : (
            <p className="weddingCarouselHint">{t("investmentPlanner.accuracyGuarantee.notTriggeredNote")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// The real gate before any product is shown - per the user's own spec:
// "don't show investment products first, first judge whether this money
// is suitable to invest right now." Never blocks the form below (the
// customer still decides), just tells them the real answer to the actual
// question they have before asking them to configure anything.
function InvestmentReadinessPanel({ readiness, t }) {
  const isReady = readiness.readiness === "readyToInvest";
  return (
    <section className={isReady ? "insightCard" : "adviceOnlyPanel"}>
      {isReady ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
      <p>{t(`investmentPlanner.readiness.${readiness.readiness}`, { amount: formatSgd(readiness.availableMonthlyCashflow), debt: formatSgd(readiness.creditCardOutstanding) })}</p>
      <small className="riskText">
        {t("investmentPlanner.readiness.emergencyFundStatus", { months: readiness.emergencyFundMonths, target: readiness.emergencyFundTarget })}
      </small>
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
  const [outcomesByKey, setOutcomesByKey] = useState({});

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
        // Real predicted-vs-actual data (app/api/investment/outcomes) - only
        // fetched once there's actually a confirmed pick to check. A failed
        // fetch just leaves outcomesByKey empty - every card falls back to
        // hasRealData: false (the existing hypothetical explorer), never a
        // broken screen.
        fetch("/api/investment/outcomes")
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => {
            if (cancelled || !data) return;
            setOutcomesByKey(Object.fromEntries(data.outcomes.map((entry) => [entry.key, entry])));
          })
          .catch(() => {});
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
            <InvestmentConfirmedCard
              key={`${pick.entry_id}-${index}`}
              pick={pick}
              outcome={outcomesByKey[`${pick.entry_id}:${pick.confirmedAt}`] ?? null}
              t={t}
            />
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
        <>
          <InvestmentReadinessPanel
            readiness={computeInvestmentReadiness({
              currentSavings: numberValue(profile.currentSavings, 0),
              monthlyExpenses: numberValue(profile.monthlyExpenses, 0),
              creditCardOutstanding: numberValue(profile.creditCardOutstanding, 0),
              availableMonthlyCashflow,
            })}
            t={t}
          />
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
        </>
      )}
    </Screen>
  );
}

// Mirror's point-of-decision "Quick Verdict" tool: unlike every other planner in this app, this is
// a single-question, single-answer interaction meant to be used standing in a shop or at a vendor
// meeting, not a multi-turn plan-then-confirm conversation. The verdict category and every number
// come from lib/decision-finance.js's deterministic cashflow math BEFORE any AI call, so this
// answers instantly even on the mock fallback path - see app/api/decision/check/route.js.
const DECISION_VERDICT_ICONS = { go_ahead: ThumbsUp, proceed_with_caution: AlertTriangle, reconsider: ThumbsDown };
const DECISION_VERDICT_PANEL_CLASS = { go_ahead: "insightCard", proceed_with_caution: "adviceOnlyPanel", reconsider: "adviceOnlyPanel" };

function DecisionHistoryModal({ entries, loading, onClose, t }) {
  return (
    <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("decisionVerdict.historyTitle")}>
      <motion.div className="confirmModal weddingHistoryModal" {...screenMotion}>
        <History size={24} />
        <strong>{t("decisionVerdict.historyTitle")}</strong>
        {loading ? (
          <p>{t("loading.detail")}</p>
        ) : entries.length ? (
          <div className="historyTimeline">
            {entries.map((entry) => {
              const Icon = DECISION_VERDICT_ICONS[entry.verdict] ?? AlertTriangle;
              return (
                <article key={entry.id}>
                  <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                  <div>
                    <strong>
                      <Icon size={14} /> {t(`decisionVerdict.verdictLabels.${entry.verdict}`)} — {entry.description}
                    </strong>
                    <small>{entry.narrative}</small>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p>{t("decisionVerdict.historyEmpty")}</p>
        )}
        <button type="button" className="primaryButton" onClick={onClose}>
          {t("homeBanking.gotIt")}
        </button>
      </motion.div>
    </section>
  );
}

function DecisionVerdictResultCard({ result, t, onCheckAnother, onSpeak, speaking }) {
  const { verdict, narrative, keyConsideration, mocked } = result;
  const Icon = DECISION_VERDICT_ICONS[verdict.verdict] ?? AlertTriangle;
  const panelClass = DECISION_VERDICT_PANEL_CLASS[verdict.verdict] ?? "insightCard";

  return (
    <>
      <section className={panelClass}>
        <Icon size={20} />
        <p>
          <strong>{t(`decisionVerdict.verdictLabels.${verdict.verdict}`)}</strong> — {narrative}
        </p>
      </section>
      {onSpeak ? (
        <button
          type="button"
          className="secondaryButton"
          onClick={() => onSpeak(`${t(`decisionVerdict.verdictLabels.${verdict.verdict}`)}. ${narrative} ${keyConsideration}`)}
          disabled={speaking}
        >
          <Volume2 size={18} />
          {speaking ? t("decisionVerdict.voice.speaking") : t("decisionVerdict.voice.listen")}
        </button>
      ) : null}
      <div className="proofBlock">
        <strong>{t("decisionVerdict.residualLabel")}</strong>
        <p>{formatSgd(verdict.residual_monthly_after)}/mo</p>
      </div>
      <div className="proofBlock">
        <strong>{t("decisionVerdict.emergencyFundLabel")}</strong>
        <p>{t("decisionVerdict.emergencyFundValue", { before: verdict.emergency_fund_months_before, after: verdict.emergency_fund_months_after })}</p>
      </div>
      <div className="proofBlock">
        <strong>{t("decisionVerdict.otherGoalsLabel")}</strong>
        <p>{formatSgd(verdict.other_goals_monthly_outflow)}/mo</p>
      </div>
      <div className="proofBlock">
        <strong>{t("decisionVerdict.keyConsiderationLabel")}</strong>
        <p>{keyConsideration}</p>
      </div>
      {mocked ? <p className="weddingCarouselHint">{t("decisionVerdict.mockedNote")}</p> : null}
      <button type="button" className="primaryButton" onClick={onCheckAnother}>
        {t("decisionVerdict.checkAnother")}
        <Zap size={18} />
      </button>
    </>
  );
}

function DecisionVerdictScreen({ t, setActiveScreen, language, profile }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [recurringMonthly, setRecurringMonthly] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Point-of-decision voice mode (Pipecat-inspired): captures a real recording
  // in the browser (no API key needed for this part), sends it to the server
  // for transcription, and pre-fills - never auto-submits - the same
  // description/amount fields the typed form uses, so a misheard number is
  // always something the customer sees and can correct before the verdict runs.
  const startRecording = async () => {
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        transcribeRecording(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setErrorMessage(t("decisionVerdict.voice.micError"));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeRecording = async (blob) => {
    setTranscribing(true);
    try {
      const audioBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const response = await fetch("/api/decision/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error === "voice_not_configured" ? t("decisionVerdict.voice.notConfigured") : t("decisionVerdict.voice.transcribeError"));
        return;
      }
      setDescription(data.transcript);
      if (data.detectedAmount != null) setAmount(String(data.detectedAmount));
    } catch {
      setErrorMessage(t("decisionVerdict.voice.transcribeError"));
    } finally {
      setTranscribing(false);
    }
  };

  const speakNarrative = async (text) => {
    setSpeaking(true);
    try {
      const response = await fetch("/api/decision/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        setErrorMessage(t("decisionVerdict.voice.notConfigured"));
        return;
      }
      const audioBlob = await response.blob();
      const audio = new Audio(URL.createObjectURL(audioBlob));
      await audio.play();
    } catch {
      setErrorMessage(t("decisionVerdict.voice.notConfigured"));
    } finally {
      setSpeaking(false);
    }
  };

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    fetch("/api/decision/history")
      .then((response) => response.json())
      .then((data) => setHistoryEntries(data.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  };

  const submitCheck = async () => {
    if (!description.trim() || !amount) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/decision/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: numberValue(amount, 0),
          recurringMonthly: numberValue(recurringMonthly, 0),
          monthlyIncome: numberValue(profile.monthlyIncome, 7500),
          monthlyExpenses: numberValue(profile.monthlyExpenses, 3500),
          currentSavings: numberValue(profile.currentSavings, 20000),
          language,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("decisionVerdict.genericError"));
        return;
      }
      setResult(data);
    } catch {
      setErrorMessage(t("decisionVerdict.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const checkAnother = () => {
    setResult(null);
    setDescription("");
    setAmount("");
    setRecurringMonthly("");
  };

  return (
    <Screen>
      <Header title={t("decisionVerdict.title")} subtitle={t("decisionVerdict.subtitle")} />
      <div className="weddingTopRow">
        <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />
        <button type="button" className="historyButton" onClick={openHistory} aria-label={t("decisionVerdict.historyTitle")}>
          <History size={16} />
        </button>
      </div>
      {historyOpen ? (
        <DecisionHistoryModal entries={historyEntries} loading={historyLoading} onClose={() => setHistoryOpen(false)} t={t} />
      ) : null}

      {result ? (
        <DecisionVerdictResultCard result={result} t={t} onCheckAnother={checkAnother} onSpeak={speakNarrative} speaking={speaking} />
      ) : (
        <section className="settingsGroup">
          <section className="trustNote compactTrustNote">
            <Zap size={17} />
            <p>{t("decisionVerdict.instructions")}</p>
          </section>

          <button
            type="button"
            className={recording ? "primaryButton" : "secondaryButton"}
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
          >
            <Mic size={18} />
            {transcribing ? t("decisionVerdict.voice.transcribing") : recording ? t("decisionVerdict.voice.stop") : t("decisionVerdict.voice.speakInstead")}
          </button>

          <label className="textareaField">
            <span className="sectionLabel">{t("decisionVerdict.descriptionLabel")}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("decisionVerdict.descriptionPlaceholder")}
            />
          </label>
          <span className="sectionLabel">{t("decisionVerdict.amountLabel")}</span>
          <input
            type="number"
            min="0"
            className="aiTextInput"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label={t("decisionVerdict.amountLabel")}
          />
          <span className="sectionLabel">{t("decisionVerdict.recurringLabel")}</span>
          <input
            type="number"
            min="0"
            className="aiTextInput"
            value={recurringMonthly}
            onChange={(event) => setRecurringMonthly(event.target.value)}
            aria-label={t("decisionVerdict.recurringLabel")}
          />
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          <button type="button" className="primaryButton" disabled={submitting || !description.trim() || !amount} onClick={submitCheck}>
            {submitting ? t("decisionVerdict.thinking") : t("decisionVerdict.submit")}
            <Zap size={18} />
          </button>
        </section>
      )}
    </Screen>
  );
}

// "Future Comparison" ("Time Machine") - two real, already-computed futures
// (buy now vs wait), never narrated fiction. See lib/future-comparison-finance.js.
function FutureComparisonResultCard({ result, t, onCompareAnother }) {
  const { comparison, narrative, keyConsideration, mocked } = result;
  const waitingIsBetter = comparison.savingsDelta > 0;

  return (
    <>
      <section className={waitingIsBetter ? "adviceOnlyPanel" : "insightCard"}>
        {waitingIsBetter ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
        <p>{narrative}</p>
      </section>

      <div className="futureCompareGrid">
        <div className="futureCompareCard">
          <span className="sectionLabel">{t("futureComparison.buyNowLabel")}</span>
          <strong>{formatSgd(comparison.buyNow.savingsAtHorizon)}</strong>
          <small>{t("futureComparison.savingsAtHorizon", { months: comparison.horizonMonths })}</small>
          <p>{t("futureComparison.emergencyBufferValue", { months: comparison.buyNow.emergencyFundMonthsAtHorizon })}</p>
        </div>
        <div className="futureCompareCard highlight">
          <span className="sectionLabel">{t("futureComparison.waitLabel")}</span>
          <strong>{formatSgd(comparison.waitInstead.savingsAtHorizon)}</strong>
          <small>{t("futureComparison.savingsAtHorizon", { months: comparison.horizonMonths })}</small>
          <p>{t("futureComparison.emergencyBufferValue", { months: comparison.waitInstead.emergencyFundMonthsAtHorizon })}</p>
        </div>
      </div>

      <div className="proofBlock">
        <strong>{t("futureComparison.keyConsiderationLabel")}</strong>
        <p>{keyConsideration}</p>
      </div>

      {comparison.worseningGoals.length ? (
        <section className="adviceOnlyPanel">
          <AlertTriangle size={18} />
          <p>
            {t("futureComparison.worseningGoals", {
              items: comparison.worseningGoals.map((item) => `${item.name ?? item.purpose} (${item.scoreBefore} → ${item.scoreAfter})`).join(", "),
            })}
          </p>
        </section>
      ) : null}

      {mocked ? <p className="weddingCarouselHint">{t("futureComparison.mockedNote")}</p> : null}
      <button type="button" className="primaryButton" onClick={onCompareAnother}>
        {t("futureComparison.compareAnother")}
        <Zap size={18} />
      </button>
    </>
  );
}

function FutureComparisonScreen({ t, setActiveScreen, language, profile }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [recurringMonthly, setRecurringMonthly] = useState("");
  const [horizonMonths, setHorizonMonths] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);

  const submitComparison = async () => {
    if (!description.trim() || !amount) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/decision/future-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: numberValue(amount, 0),
          recurringMonthly: numberValue(recurringMonthly, 0),
          horizonMonths,
          monthlyIncome: numberValue(profile.monthlyIncome, 7500),
          monthlyExpenses: numberValue(profile.monthlyExpenses, 3500),
          currentSavings: numberValue(profile.currentSavings, 20000),
          language,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("futureComparison.genericError"));
        return;
      }
      setResult(data);
    } catch {
      setErrorMessage(t("futureComparison.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const compareAnother = () => {
    setResult(null);
    setDescription("");
    setAmount("");
    setRecurringMonthly("");
  };

  return (
    <Screen>
      <Header title={t("futureComparison.title")} subtitle={t("futureComparison.subtitle")} />
      <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />

      {result ? (
        <FutureComparisonResultCard result={result} t={t} onCompareAnother={compareAnother} />
      ) : (
        <section className="settingsGroup">
          <label className="textareaField">
            <span className="sectionLabel">{t("futureComparison.descriptionLabel")}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("futureComparison.descriptionPlaceholder")}
            />
          </label>
          <span className="sectionLabel">{t("futureComparison.amountLabel")}</span>
          <input
            type="number"
            min="0"
            className="aiTextInput"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label={t("futureComparison.amountLabel")}
          />
          <span className="sectionLabel">{t("futureComparison.recurringLabel")}</span>
          <input
            type="number"
            min="0"
            className="aiTextInput"
            value={recurringMonthly}
            onChange={(event) => setRecurringMonthly(event.target.value)}
            aria-label={t("futureComparison.recurringLabel")}
          />
          <span className="sectionLabel">{t("futureComparison.horizonLabel")}</span>
          <div className="decisionButtonRow">
            {[1, 3, 6, 12].map((months) => (
              <button
                key={months}
                type="button"
                className={horizonMonths === months ? "segmentButton active" : "segmentButton"}
                onClick={() => setHorizonMonths(months)}
              >
                {t("futureComparison.horizonMonths", { count: months })}
              </button>
            ))}
          </div>
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          <button type="button" className="primaryButton" disabled={submitting || !description.trim() || !amount} onClick={submitComparison}>
            {submitting ? t("futureComparison.computing") : t("futureComparison.compareButton")}
            <Zap size={18} />
          </button>
        </section>
      )}
    </Screen>
  );
}

// SME Cash Flow Copilot - real day-by-day forecast from the owner's own
// entered events. See lib/sme-cashflow-finance.js.
function SmeCashflowScreen({ t, setActiveScreen, language, preferences }) {
  const [businessName, setBusinessName] = useState("");
  const [startingCash, setStartingCash] = useState("");
  const [events, setEvents] = useState([{ label: "", amount: "", dayOfMonth: "1" }]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);
  const [checkinAccuracy, setCheckinAccuracy] = useState({ hasCheckins: false, count: 0 });
  const [checkinDate, setCheckinDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkinActual, setCheckinActual] = useState("");
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState("");

  const loadProfile = (onDone) => {
    fetch("/api/sme/cashflow")
      .then((response) => response.json())
      .then((data) => {
        if (!data.profile) return;
        setBusinessName(data.profile.businessName);
        setStartingCash(String(data.profile.startingCash));
        setEvents(data.profile.events.map((event) => ({ label: event.label, amount: String(event.amount), dayOfMonth: String(event.dayOfMonth) })));
        setResult({ forecast: data.forecast, narrative: data.narrative, keyConsideration: data.keyConsideration, mocked: data.mocked });
        setCheckinAccuracy(data.checkinAccuracy ?? { hasCheckins: false, count: 0 });
      })
      .catch(() => {})
      .finally(() => onDone?.());
  };

  useEffect(() => {
    loadProfile(() => setLoading(false));
  }, []);

  const submitCheckin = async () => {
    if (!checkinDate || checkinActual === "") return;
    setCheckinSubmitting(true);
    setCheckinError("");
    try {
      const response = await fetch("/api/sme/cashflow/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinDate, actualBalance: numberValue(checkinActual, 0), note: checkinNote.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        setCheckinError(
          data.error === "outside_forecast_window"
            ? t("smeCashflow.checkins.outsideWindow", { days: data.detail?.horizonDays ?? 30 })
            : t("smeCashflow.checkins.genericError")
        );
        return;
      }
      setCheckinActual("");
      setCheckinNote("");
      loadProfile();
    } catch {
      setCheckinError(t("smeCashflow.checkins.genericError"));
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const personalProfile = getUserProfile(preferences);
  const personalBufferImpact =
    result?.forecast?.hasGap && Math.min(0, result.forecast.minBalance) < 0
      ? computePersonalBufferImpact({
          gapAmount: Math.abs(Math.min(0, result.forecast.minBalance)),
          personalCurrentSavings: numberValue(personalProfile.currentSavings, 0),
          personalMonthlyExpenses: numberValue(personalProfile.monthlyExpenses, 0),
        })
      : null;

  const updateEvent = (index, field, value) => {
    setEvents((current) => current.map((event, i) => (i === index ? { ...event, [field]: value } : event)));
  };

  const addEvent = () => setEvents((current) => [...current, { label: "", amount: "", dayOfMonth: "1" }]);
  const removeEvent = (index) => setEvents((current) => current.filter((_, i) => i !== index));

  const submitForecast = async () => {
    const cleanEvents = events
      .filter((event) => event.label.trim() && event.amount !== "")
      .map((event) => ({ label: event.label.trim(), amount: numberValue(event.amount, 0), dayOfMonth: Math.min(30, Math.max(1, numberValue(event.dayOfMonth, 1))) }));
    if (!businessName.trim() || !startingCash || !cleanEvents.length) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/sme/cashflow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          startingCash: numberValue(startingCash, 0),
          events: cleanEvents,
          horizonDays: 30,
          language,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("smeCashflow.genericError"));
        return;
      }
      setResult({ forecast: data.forecast, narrative: data.narrative, keyConsideration: data.keyConsideration, mocked: data.mocked });
    } catch {
      setErrorMessage(t("smeCashflow.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title={t("smeCashflow.title")} subtitle={t("smeCashflow.subtitle")} />
      <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />

      {loading ? (
        <p>{t("loading.detail")}</p>
      ) : (
        <>
          {result ? (
            <section className={result.forecast.hasGap ? "adviceOnlyPanel" : "insightCard"}>
              {result.forecast.hasGap ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
              <p>{result.narrative}</p>
            </section>
          ) : null}
          {result ? (
            <>
              <div className="futureCompareGrid">
                <div className="futureCompareCard">
                  <span className="sectionLabel">{t("smeCashflow.lowestPointLabel")}</span>
                  <strong>{formatSgd(result.forecast.minBalance)}</strong>
                  <small>
                    {result.forecast.hasGap
                      ? t("smeCashflow.gapDayValue", { day: result.forecast.firstGapDay })
                      : t("smeCashflow.noGap")}
                  </small>
                </div>
                <div className="futureCompareCard highlight">
                  <span className="sectionLabel">{t("smeCashflow.endingBalanceLabel")}</span>
                  <strong>{formatSgd(result.forecast.endingBalance)}</strong>
                  <small>{t("smeCashflow.horizonValue", { days: result.forecast.horizonDays })}</small>
                </div>
              </div>
              <div className="proofBlock">
                <strong>{t("smeCashflow.keyConsiderationLabel")}</strong>
                <p>{result.keyConsideration}</p>
              </div>
              {result.mocked ? <p className="weddingCarouselHint">{t("smeCashflow.mockedNote")}</p> : null}

              {personalBufferImpact ? (
                <section className={personalBufferImpact.canSafelyCover ? "insightCard" : "adviceOnlyPanel"}>
                  {personalBufferImpact.canSafelyCover ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                  <p>
                    {t(
                      personalBufferImpact.canSafelyCover
                        ? "smeCashflow.personalBuffer.canCover"
                        : "smeCashflow.personalBuffer.cannotSafelyCover",
                      {
                        gap: formatSgd(personalBufferImpact.gapAmount),
                        before: personalBufferImpact.monthsCoveredBefore,
                        after: personalBufferImpact.monthsCoveredAfter,
                      }
                    )}
                  </p>
                </section>
              ) : result.forecast.hasGap ? (
                <p className="weddingCarouselHint">{t("smeCashflow.personalBuffer.noRealPersonalData")}</p>
              ) : null}

              <section className="financialStrategyPanel">
                <span className="sectionLabel">{t("smeCashflow.checkins.title")}</span>
                {checkinAccuracy.hasCheckins ? (
                  <>
                    <p className="weddingCarouselHint">{t("smeCashflow.checkins.accuracySummary", { amount: formatSgd(checkinAccuracy.avgAbsVariance), count: checkinAccuracy.count })}</p>
                    <div className="strategyList">
                      {checkinAccuracy.entries.map((entry) => (
                        <article className="strategyItem" key={entry.id}>
                          <div>
                            <strong>{entry.checkinDate}</strong>
                            <small>{t("smeCashflow.checkins.entryDetail", { predicted: formatSgd(entry.predictedBalance), actual: formatSgd(entry.actualBalance) })}</small>
                          </div>
                          <b className={entry.variance >= 0 ? "statePill state-healthy" : "statePill state-tight"}>
                            {entry.variance >= 0 ? "+" : ""}
                            {formatSgd(entry.variance)}
                          </b>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <p>{t("smeCashflow.checkins.empty")}</p>
                )}
                <div className="decisionButtonRow">
                  <input
                    type="date"
                    className="aiTextInput"
                    style={{ flex: 1 }}
                    value={checkinDate}
                    onChange={(event) => setCheckinDate(event.target.value)}
                    aria-label={t("smeCashflow.checkins.dateLabel")}
                  />
                  <input
                    type="number"
                    className="aiTextInput"
                    style={{ flex: 1 }}
                    value={checkinActual}
                    onChange={(event) => setCheckinActual(event.target.value)}
                    placeholder={t("smeCashflow.checkins.actualPlaceholder")}
                    aria-label={t("smeCashflow.checkins.actualPlaceholder")}
                  />
                </div>
                <input
                  type="text"
                  className="aiTextInput"
                  value={checkinNote}
                  onChange={(event) => setCheckinNote(event.target.value)}
                  placeholder={t("smeCashflow.checkins.notePlaceholder")}
                  aria-label={t("smeCashflow.checkins.notePlaceholder")}
                />
                {checkinError ? (
                  <section className="adviceOnlyPanel">
                    <AlertTriangle size={18} />
                    <p>{checkinError}</p>
                  </section>
                ) : null}
                <button type="button" className="secondaryButton" disabled={checkinSubmitting || checkinActual === ""} onClick={submitCheckin}>
                  {checkinSubmitting ? t("smeCashflow.checkins.logging") : t("smeCashflow.checkins.logButton")}
                </button>
              </section>
            </>
          ) : null}

          <div className="settingsGroup">
            <span className="sectionLabel">{t("smeCashflow.businessNameLabel")}</span>
            <input
              type="text"
              className="aiTextInput"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder={t("smeCashflow.businessNamePlaceholder")}
              aria-label={t("smeCashflow.businessNameLabel")}
            />
            <span className="sectionLabel">{t("smeCashflow.startingCashLabel")}</span>
            <input
              type="number"
              min="0"
              className="aiTextInput"
              value={startingCash}
              onChange={(event) => setStartingCash(event.target.value)}
              aria-label={t("smeCashflow.startingCashLabel")}
            />

            <span className="sectionLabel">{t("smeCashflow.eventsLabel")}</span>
            {events.map((event, index) => (
              <div key={index} className="decisionButtonRow">
                <input
                  type="text"
                  className="aiTextInput"
                  style={{ flex: 2 }}
                  value={event.label}
                  onChange={(e) => updateEvent(index, "label", e.target.value)}
                  placeholder={t("smeCashflow.eventLabelPlaceholder")}
                  aria-label={t("smeCashflow.eventLabelPlaceholder")}
                />
                <input
                  type="number"
                  className="aiTextInput"
                  style={{ flex: 1 }}
                  value={event.amount}
                  onChange={(e) => updateEvent(index, "amount", e.target.value)}
                  placeholder={t("smeCashflow.eventAmountPlaceholder")}
                  aria-label={t("smeCashflow.eventAmountPlaceholder")}
                />
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="aiTextInput"
                  style={{ flex: 1 }}
                  value={event.dayOfMonth}
                  onChange={(e) => updateEvent(index, "dayOfMonth", e.target.value)}
                  placeholder={t("smeCashflow.eventDayPlaceholder")}
                  aria-label={t("smeCashflow.eventDayPlaceholder")}
                />
                <button type="button" className="chatIconButton" onClick={() => removeEvent(index)} aria-label={t("smeCashflow.removeEvent")}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button type="button" className="secondaryButton" onClick={addEvent}>
              <Plus size={16} />
              {t("smeCashflow.addEvent")}
            </button>

            {errorMessage ? (
              <section className="adviceOnlyPanel">
                <AlertTriangle size={18} />
                <p>{errorMessage}</p>
              </section>
            ) : null}
            <button
              type="button"
              className="primaryButton"
              disabled={submitting || !businessName.trim() || !startingCash}
              onClick={submitForecast}
            >
              {submitting ? t("smeCashflow.computing") : t("smeCashflow.forecastButton")}
              <Zap size={18} />
            </button>
          </div>
        </>
      )}
    </Screen>
  );
}

// Real "is this unusual for you" check - compared against the customer's
// own real confirmed history, never a population-level fraud model. See
// lib/activity-check-finance.js.
function ActivityCheckScreen({ t, setActiveScreen, language, profile }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);

  const submitCheck = async () => {
    if (!description.trim() || !amount) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/decision/activity-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: numberValue(amount, 0),
          monthlyIncome: numberValue(profile.monthlyIncome, 7500),
          language,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("activityCheck.genericError"));
        return;
      }
      setResult(data);
    } catch {
      setErrorMessage(t("activityCheck.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const checkAnother = () => {
    setResult(null);
    setDescription("");
    setAmount("");
  };

  return (
    <Screen>
      <Header title={t("activityCheck.title")} subtitle={t("activityCheck.subtitle")} />
      <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />

      {result ? (
        <>
          <section className={result.check.unusual ? "adviceOnlyPanel" : "insightCard"}>
            {result.check.unusual ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
            <p>{result.narrative}</p>
          </section>
          {result.check.hasHistory ? (
            <div className="futureCompareGrid">
              <div className="futureCompareCard">
                <span className="sectionLabel">{t("activityCheck.thisAmountLabel")}</span>
                <strong>{formatSgd(result.check.amount)}</strong>
              </div>
              <div className="futureCompareCard">
                <span className="sectionLabel">{t("activityCheck.largestBeforeLabel")}</span>
                <strong>{formatSgd(result.check.maxHistoricalAmount)}</strong>
                <small>{t("activityCheck.basedOn", { count: result.check.historicalActionCount })}</small>
              </div>
            </div>
          ) : (
            <p className="weddingCarouselHint">{t("activityCheck.noHistory")}</p>
          )}
          <div className="proofBlock">
            <strong>{t("activityCheck.keyConsiderationLabel")}</strong>
            <p>{result.keyConsideration}</p>
          </div>
          {result.mocked ? <p className="weddingCarouselHint">{t("activityCheck.mockedNote")}</p> : null}
          <button type="button" className="primaryButton" onClick={checkAnother}>
            {t("activityCheck.checkAnother")}
            <Zap size={18} />
          </button>
        </>
      ) : (
        <section className="settingsGroup">
          <label className="textareaField">
            <span className="sectionLabel">{t("activityCheck.descriptionLabel")}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("activityCheck.descriptionPlaceholder")}
            />
          </label>
          <span className="sectionLabel">{t("activityCheck.amountLabel")}</span>
          <input
            type="number"
            min="0"
            className="aiTextInput"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label={t("activityCheck.amountLabel")}
          />
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          <button type="button" className="primaryButton" disabled={submitting || !description.trim() || !amount} onClick={submitCheck}>
            {submitting ? t("activityCheck.checking") : t("activityCheck.checkButton")}
            <ShieldCheck size={18} />
          </button>
        </section>
      )}
    </Screen>
  );
}

// Shadow Account - fully client-side, same shape as PeerBenchmarkScreen:
// preferences.incomeHistory is already real, already loaded at app init
// (see the initial-load effect that fetches /api/income/entries), so no
// new API route is needed - computeShadowAccount and
// getTypicalSavingsRatePercent are both pure and importable directly.
function ShadowAccountScreen({ preferences, t, setActiveScreen }) {
  const profile = getUserProfile(preferences);
  const monthlyIncome = getProfileAmount(profile, "monthlyIncome", 7500);
  const currentSavings = getProfileAmount(profile, "currentSavings", 0);
  const guidelineRatePercent = getTypicalSavingsRatePercent(monthlyIncome);
  const result = computeShadowAccount(preferences.incomeHistory ?? [], { currentSavings, guidelineRatePercent });

  return (
    <Screen>
      <Header title={t("shadowAccount.title")} subtitle={t("shadowAccount.subtitle")} />
      <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />

      {result.hasHistory ? (
        <>
          <div className="futureCompareGrid">
            <div className="futureCompareCard">
              <span className="sectionLabel">{t("shadowAccount.shadowBalanceLabel")}</span>
              <strong>{formatSgd(result.shadowBalance)}</strong>
              <small>{t("shadowAccount.guidelineNote", { rate: result.guidelineRatePercent, months: result.sampleSize })}</small>
            </div>
            <div className="futureCompareCard">
              <span className="sectionLabel">{t("shadowAccount.actualBalanceLabel")}</span>
              <strong>{formatSgd(result.actualSavings)}</strong>
            </div>
          </div>
          <section className={result.aheadOfShadow ? "insightCard" : "adviceOnlyPanel"}>
            {result.aheadOfShadow ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            <p>
              {result.aheadOfShadow
                ? t("shadowAccount.aheadNote", { amount: formatSgd(Math.abs(result.gap)) })
                : t("shadowAccount.behindNote", { amount: formatSgd(Math.abs(result.gap)) })}
            </p>
          </section>
        </>
      ) : (
        <section className="weddingHero">
          <span className="weddingHeroIcon">
            <History size={26} />
          </span>
          <strong>{t("shadowAccount.emptyStateLabel")}</strong>
          <p>{t("shadowAccount.emptyStateBody", { count: result.sampleSize })}</p>
          <button type="button" className="primaryButton" onClick={() => setActiveScreen(screens.PROFILE)}>
            {t("shadowAccount.logIncomeButton")}
          </button>
        </section>
      )}
    </Screen>
  );
}

// Family CFO - the real payoff of the access-grant system (lib/access-
// grant-store.js) and the "view as" backend (lib/auth.js's
// resolveEffectiveProfileKey/asUser=, already wired into 15 real routes)
// that existed but had no real frontend before this: a family member who
// granted "all"-scope view access can actually be seen here - their real
// committed monthly total, real income, real loan/investment/savings
// breakdown - not just an access-grant record sitting in a settings list.
// Replaces /grants as the real entry point (that route now redirects here).

const JOINT_RISK_TO_BAND = { low: "healthy", medium: "tight", high: "at_risk" };

function describeJointAction(action, t) {
  const domainLabel = t(`simulator.goals.${action.domain}`) || action.domain;
  if (action.action_type.startsWith("confirm_") && action.action_type.endsWith("_plan")) {
    if (action.payload.kind === "budget") {
      return t("familyCfo.describe.weddingBudget", { domain: domainLabel, amount: formatSgd(action.payload.total_budget), date: action.payload.wedding_date });
    }
    if (action.payload.kind === "plan" && action.domain === "travel") {
      return t("familyCfo.describe.travelPlan", {
        domain: domainLabel,
        amount: formatSgd(action.payload.total_budget),
        destination: action.payload.destination,
        date: action.payload.travel_date,
      });
    }
    if (action.payload.kind === "plan") {
      return t("familyCfo.describe.genericPlan", { domain: domainLabel });
    }
    if (action.payload.kind === "savings_plan") {
      return t("familyCfo.describe.savingsPlan", {
        domain: domainLabel,
        amount: formatSgd(action.payload.monthly_contribution),
        start: action.payload.start_month,
        end: action.payload.target_complete_month,
      });
    }
  }
  if (action.action_type === "pause_goal_plan" || action.action_type === "reduce_goal_plan") {
    return t("familyCfo.describe.pauseReduce", { domain: domainLabel, amount: formatSgd(action.payload.newMonthlyContribution), reason: action.payload.explanation });
  }
  return `${domainLabel} / ${action.action_type}`;
}

// Real evidence a confirming partner would otherwise never see - the same
// feasibility/whole-picture numbers the initiator saw (lib/joint-plan-
// evidence.js), not a blind confirm/decline on a one-line summary.
function JointEvidencePanel({ evidence, t }) {
  const worseningImpacts = [...evidence.wholePicture.loanImpact, ...evidence.wholePicture.investmentImpact].filter((item) => item.delta <= -10);
  return (
    <div className="proofBlock">
      <small>{t("familyCfo.realEvidenceLabel")}</small>
      <div className="weddingStatChips">
        <b className={`statePill state-${JOINT_RISK_TO_BAND[evidence.riskLevel]}`}>
          {t("familyCfo.feasibilityScore", { score: evidence.feasibilityScore })}
        </b>
        <span className="statChip">{t("familyCfo.wholePictureUtilization", { percent: evidence.wholePicture.wholePictureUtilizationPercent })}</span>
      </div>
      <small>{t("familyCfo.residualAfterAll", { amount: formatSgd(evidence.wholePicture.residualAfterAllCommitments) })}</small>
      {worseningImpacts.length ? (
        <small className="riskText">
          {t("familyCfo.worseningImpact", { items: worseningImpacts.map((item) => `${item.name ?? item.purpose} (${item.scoreBefore}→${item.scoreAfter})`).join(", ") })}
        </small>
      ) : null}
    </div>
  );
}

function PauseFeasibilityPanel({ check, t }) {
  return (
    <div className="proofBlock">
      <small>{t("familyCfo.realCheckLabel")}</small>
      <div className="weddingStatChips">
        <b className={`statePill state-${JOINT_RISK_TO_BAND[check.riskLevel]}`}>{t("familyCfo.feasibilityScore", { score: check.feasibilityScore })}</b>
        <span className="statChip">{t("familyCfo.wholePictureUtilization", { percent: check.utilizationPercent })}</span>
      </div>
      <small>
        {t("familyCfo.pauseCheckDetail", {
          current: formatSgd(check.oldMonthlyContribution),
          committed: formatSgd(check.otherCommitmentsMonthlyTotal),
          income: formatSgd(check.monthlyIncome),
        })}
      </small>
    </div>
  );
}

// Read-only reuse of Strategic Balance's own real category breakdown
// (buildStrategicCategories/StrategicBalanceAccordionItem, unchanged) -
// same real numbers the member sees for themselves, with readOnly
// suppressing the rebalance slider and the "go to planner" action, since
// neither belongs to a viewer looking at someone else's real data.
function FamilyMemberBalanceView({ member, t, onBack }) {
  const [openCategory, setOpenCategory] = useState(null);
  const categories = buildStrategicCategories(member.snapshot, member.healthScores, member.profile, t);

  return (
    <>
      <button type="button" className="secondaryButton" onClick={onBack}>
        {t("familyCfo.backToOverview")}
      </button>
      <div className={`utilizationHero band-${member.snapshot.utilization.healthLabel}`}>
        <div className="utilizationRing">
          <strong className="numeric">{member.snapshot.utilization.utilizationPercent}%</strong>
        </div>
        <div>
          <span className="utilizationLabel">{t(`lifeGraph.strategicBalance.healthLabel.${member.snapshot.utilization.healthLabel}`)}</span>
          <small>{t("familyCfo.viewingAs", { name: member.displayName })}</small>
        </div>
      </div>
      <div className="strategicCategoryList">
        {STRATEGIC_CATEGORY_IDS.map((id) => (
          <StrategicBalanceAccordionItem
            key={id}
            category={categories[id]}
            expanded={openCategory === id}
            onToggle={() => setOpenCategory((current) => (current === id ? null : id))}
            snapshot={member.snapshot}
            profile={member.profile}
            readOnly
            t={t}
          />
        ))}
      </div>
    </>
  );
}

function FamilyMemberCard({ grant, figures, t, onViewBalance }) {
  return (
    <article className="strategyItem" style={{ display: "block" }}>
      <div className="weddingStatChips" style={{ marginBottom: "4px" }}>
        <strong>{grant.grantor_display_name}</strong>
        <span className="statChip">{grant.scope === "all" ? t("familyCfo.scopeAll") : grant.scope}</span>
        <span className="statChip">{t(`familyCfo.accessLevel.${grant.access_level}`)}</span>
      </div>
      {figures?.status === "loading" ? (
        <small>{t("loading.detail")}</small>
      ) : figures?.status === "ready" && figures.hasRealProfile ? (
        <>
          <div className="weddingStatChips">
            <span className="statChip">{t("familyCfo.memberIncome", { amount: formatSgd(figures.monthlyIncome) })}</span>
            <span className="statChip">{t("familyCfo.memberCommitted", { amount: formatSgd(figures.committedMonthlyTotal) })}</span>
            <b className={`statePill state-${figures.healthLabel}`}>{figures.utilizationPercent}%</b>
          </div>
          <button type="button" className="miniButton" style={{ marginTop: "8px" }} onClick={onViewBalance}>
            {t("familyCfo.viewBalance")}
          </button>
        </>
      ) : figures?.status === "ready" ? (
        <small>{t("familyCfo.memberNoRealProfile")}</small>
      ) : grant.scope !== "all" ? (
        <small>{t("familyCfo.memberScopedOnly")}</small>
      ) : (
        <small>{t("familyCfo.memberFiguresUnavailable")}</small>
      )}
    </article>
  );
}

function FamilyCfoScreen({ t, setActiveScreen }) {
  const [loading, setLoading] = useState(true);
  const [given, setGiven] = useState([]);
  const [received, setReceived] = useState([]);
  const [pendingJointActions, setPendingJointActions] = useState([]);
  const [initiatedJointActions, setInitiatedJointActions] = useState([]);
  const [memberFigures, setMemberFigures] = useState({});
  const [viewingGrantId, setViewingGrantId] = useState(null);
  const [granteeEmail, setGranteeEmail] = useState("");
  const [scope, setScope] = useState("all");
  const [accessLevel, setAccessLevel] = useState("view");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [jointActionBusyId, setJointActionBusyId] = useState(null);
  const [declineReasons, setDeclineReasons] = useState({});

  const fetchMemberFigures = async (grant) => {
    try {
      const prefsResponse = await fetch(`/api/preferences?asUser=${grant.grantor_user_id}`);
      if (!prefsResponse.ok) return { status: "unavailable" };
      const { data } = await prefsResponse.json();
      const memberProfile = getUserProfile(data ?? {});
      const hasRealProfile = String(memberProfile?.statedMonthlyIncome ?? "") !== String(defaultProfile.statedMonthlyIncome);
      if (!hasRealProfile) return { status: "ready", hasRealProfile: false };

      const monthlyIncome = numberValue(memberProfile.monthlyIncome, 7500);
      const monthlyExpenses = numberValue(memberProfile.monthlyExpenses, 3500);
      const sbParams = new URLSearchParams({
        monthlyIncome: String(monthlyIncome),
        monthlyExpenses: String(monthlyExpenses),
        asUser: grant.grantor_user_id,
      });
      const sbResponse = await fetch(`/api/strategic-balance/snapshot?${sbParams.toString()}`);
      if (!sbResponse.ok) return { status: "unavailable" };
      const snapshot = await sbResponse.json();
      return {
        status: "ready",
        hasRealProfile: true,
        monthlyIncome,
        monthlyExpenses,
        committedMonthlyTotal: snapshot.committedMonthlyTotal,
        healthLabel: snapshot.utilization.healthLabel,
        utilizationPercent: snapshot.utilization.utilizationPercent,
        profile: memberProfile,
        snapshot,
        healthScores: getHealthScores(memberProfile),
      };
    } catch {
      return { status: "unavailable" };
    }
  };

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/grants").then((response) => (response.ok ? response.json() : { given: [], received: [] })),
      fetch("/api/joint-actions").then((response) => (response.ok ? response.json() : { pending: [] })),
      fetch("/api/joint-actions/mine").then((response) => (response.ok ? response.json() : { proposed: [] })),
    ])
      .then(([grantsData, pendingData, initiatedData]) => {
        setGiven(grantsData.given ?? []);
        setReceived(grantsData.received ?? []);
        setPendingJointActions(pendingData.pending ?? []);
        setInitiatedJointActions(initiatedData.proposed ?? []);

        const viewableGrants = (grantsData.received ?? []).filter((grant) => grant.status === "active" && grant.scope === "all");
        viewableGrants.forEach((grant) => {
          setMemberFigures((current) => ({ ...current, [grant.id]: { status: "loading" } }));
          fetchMemberFigures(grant).then((result) => {
            setMemberFigures((current) => ({ ...current, [grant.id]: result }));
          });
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const familyPicture = useMemo(() => {
    const members = received
      .filter((grant) => grant.status === "active" && grant.scope === "all")
      .map((grant) => {
        const figures = memberFigures[grant.id];
        return {
          userId: grant.grantor_user_id,
          displayName: grant.grantor_display_name,
          hasRealProfile: figures?.status === "ready" && figures.hasRealProfile,
          monthlyIncome: figures?.monthlyIncome ?? 0,
          monthlyExpenses: figures?.monthlyExpenses ?? 0,
          committedMonthlyTotal: figures?.committedMonthlyTotal ?? 0,
        };
      });
    return computeFamilyPicture(members);
  }, [received, memberFigures]);

  const createGrant = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ granteeEmail, scope, accessLevel }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormError(
          data.error === "grantee_not_found"
            ? t("familyCfo.errorGranteeNotFound")
            : data.error === "cannot_grant_self"
              ? t("familyCfo.errorCannotGrantSelf")
              : t("familyCfo.genericError")
        );
        return;
      }
      setGranteeEmail("");
      loadAll();
    } finally {
      setSubmitting(false);
    }
  };

  const respondToGrant = async (id, decision) => {
    await fetch(`/api/grants/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    loadAll();
  };

  const revokeGrant = async (id) => {
    await fetch(`/api/grants/${id}/revoke`, { method: "POST" });
    loadAll();
  };

  const confirmJointAction = async (id) => {
    setJointActionBusyId(id);
    try {
      await fetch(`/api/joint-actions/${id}/confirm`, { method: "POST" });
      loadAll();
    } finally {
      setJointActionBusyId(null);
    }
  };

  const declineJointAction = async (id) => {
    setJointActionBusyId(id);
    try {
      await fetch(`/api/joint-actions/${id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReasons[id]?.trim() || undefined }),
      });
      loadAll();
    } finally {
      setJointActionBusyId(null);
    }
  };

  const viewingMember = viewingGrantId
    ? (() => {
        const grant = received.find((item) => item.id === viewingGrantId);
        const figures = memberFigures[viewingGrantId];
        if (!grant || figures?.status !== "ready" || !figures.hasRealProfile) return null;
        return { displayName: grant.grantor_display_name, ...figures };
      })()
    : null;

  if (viewingMember) {
    return (
      <Screen>
        <Header title={t("familyCfo.title")} subtitle={t("familyCfo.subtitle")} />
        <FamilyMemberBalanceView member={viewingMember} t={t} onBack={() => setViewingGrantId(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t("familyCfo.title")} subtitle={t("familyCfo.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

      {loading ? (
        <p>{t("loading.detail")}</p>
      ) : (
        <>
          <div className={`utilizationHero band-${familyPicture.hasAnyRealData ? familyPicture.healthLabel : "notPlanned"}`}>
            <div className="utilizationRing">
              <strong className="numeric">{familyPicture.hasAnyRealData ? `${familyPicture.utilizationPercent}%` : "—"}</strong>
            </div>
            <div>
              <span className="utilizationLabel">{t("familyCfo.familyPictureLabel")}</span>
              {familyPicture.hasAnyRealData ? (
                <small className="utilizationTrend">
                  {t("familyCfo.familyPictureDetail", {
                    income: formatSgd(familyPicture.totalMonthlyIncome),
                    committed: formatSgd(familyPicture.totalCommittedMonthly),
                    residual: formatSgd(familyPicture.residualMonthly),
                  })}
                </small>
              ) : (
                <small className="utilizationTrend">{t("familyCfo.familyPictureEmpty")}</small>
              )}
            </div>
          </div>
          {familyPicture.excludedMemberNames.length ? (
            <p className="weddingCarouselHint">{t("familyCfo.excludedNote", { names: familyPicture.excludedMemberNames.join(", ") })}</p>
          ) : null}

          <section className="financialStrategyPanel">
            <span className="sectionLabel">{t("familyCfo.membersLabel")}</span>
            <div className="strategyList">
              {received.length ? (
                received.map((grant) => (
                  <FamilyMemberCard
                    key={grant.id}
                    grant={grant}
                    figures={memberFigures[grant.id]}
                    t={t}
                    onViewBalance={() => setViewingGrantId(grant.id)}
                  />
                ))
              ) : (
                <p>{t("familyCfo.noMembers")}</p>
              )}
            </div>
          </section>

          <section className="financialStrategyPanel">
            <span className="sectionLabel">{t("familyCfo.decisionsLabel")}</span>
            <div className="strategyList">
              {pendingJointActions.length ? (
                pendingJointActions.map((action) => (
                  <article className="strategyItem" key={action.id} style={{ display: "block" }}>
                    <div>
                      <strong>{t("familyCfo.proposedBy", { name: action.initiator_display_name })}</strong>
                      <small>{describeJointAction(action, t)}</small>
                    </div>
                    {action.payload.jointEvidence ? <JointEvidencePanel evidence={action.payload.jointEvidence} t={t} /> : null}
                    {action.payload.feasibilityCheck ? <PauseFeasibilityPanel check={action.payload.feasibilityCheck} t={t} /> : null}
                    <input
                      type="text"
                      className="aiTextInput"
                      placeholder={t("familyCfo.declineReasonPlaceholder")}
                      value={declineReasons[action.id] ?? ""}
                      onChange={(event) => setDeclineReasons((current) => ({ ...current, [action.id]: event.target.value }))}
                      style={{ marginTop: "10px" }}
                    />
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button
                        type="button"
                        className="miniButton"
                        style={{ flex: 1 }}
                        disabled={jointActionBusyId === action.id}
                        onClick={() => confirmJointAction(action.id)}
                      >
                        {t("familyCfo.confirm")}
                      </button>
                      <button
                        type="button"
                        className="miniButton danger"
                        style={{ flex: 1 }}
                        disabled={jointActionBusyId === action.id}
                        onClick={() => declineJointAction(action.id)}
                      >
                        {t("familyCfo.decline")}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p>{t("familyCfo.noDecisions")}</p>
              )}
            </div>
          </section>

          {initiatedJointActions.length ? (
            <section className="financialStrategyPanel">
              <span className="sectionLabel">{t("familyCfo.sentLabel")}</span>
              <div className="strategyList">
                {initiatedJointActions.map((action) => (
                  <article className="strategyItem" key={action.id} style={{ display: "block" }}>
                    <div className="weddingStatChips">
                      <strong>{t("familyCfo.sentTo", { name: action.target_display_name })}</strong>
                      <b className={`statePill state-${action.status === "confirmed" ? "healthy" : action.status === "declined" ? "at_risk" : "tight"}`}>
                        {t(`familyCfo.status.${action.status}`)}
                      </b>
                    </div>
                    <small>{describeJointAction(action, t)}</small>
                    {action.status === "declined" && action.decline_reason ? (
                      <small className="riskText">{t("familyCfo.theirReason", { reason: action.decline_reason })}</small>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="financialStrategyPanel">
            <span className="sectionLabel">{t("familyCfo.inviteTitle")}</span>
            <form onSubmit={createGrant} className="settingsGroup">
              <label className="textareaField">
                <span className="sectionLabel">{t("familyCfo.emailLabel")}</span>
                <input type="email" className="aiTextInput" value={granteeEmail} onChange={(event) => setGranteeEmail(event.target.value)} required />
              </label>
              <label className="textareaField">
                <span className="sectionLabel">{t("familyCfo.scopeLabel")}</span>
                <select className="aiTextInput" value={scope} onChange={(event) => setScope(event.target.value)}>
                  {GRANT_SCOPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? t("familyCfo.scopeAll") : option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="textareaField">
                <span className="sectionLabel">{t("familyCfo.accessLevelLabel")}</span>
                <select className="aiTextInput" value={accessLevel} onChange={(event) => setAccessLevel(event.target.value)}>
                  <option value="view">{t("familyCfo.accessLevel.view")}</option>
                  <option value="view_and_act">{t("familyCfo.accessLevel.view_and_act")}</option>
                </select>
              </label>
              {formError ? (
                <section className="adviceOnlyPanel">
                  <AlertTriangle size={18} />
                  <p>{formError}</p>
                </section>
              ) : null}
              <button type="submit" className="primaryButton" disabled={submitting}>
                {submitting ? t("familyCfo.sending") : t("familyCfo.sendInvite")}
              </button>
            </form>
          </section>

          <section className="financialStrategyPanel">
            <span className="sectionLabel">{t("familyCfo.accessGivenLabel")}</span>
            <div className="strategyList">
              {given.length ? (
                given.map((grant) => (
                  <article className="strategyItem" key={grant.id}>
                    <div>
                      <strong>{grant.grantee_display_name}</strong>
                      <small>
                        {grant.grantee_email} · {grant.scope === "all" ? t("familyCfo.scopeAll") : grant.scope} · {t(`familyCfo.status.${grant.status}`)}
                      </small>
                    </div>
                    {grant.status === "active" ? (
                      <button type="button" className="miniButton danger" onClick={() => revokeGrant(grant.id)}>
                        {t("familyCfo.revoke")}
                      </button>
                    ) : null}
                  </article>
                ))
              ) : (
                <p>{t("familyCfo.noAccessGiven")}</p>
              )}
            </div>
          </section>

          <section className="financialStrategyPanel">
            <span className="sectionLabel">{t("familyCfo.accessReceivedLabel")}</span>
            <div className="strategyList">
              {received.length ? (
                received.map((grant) => (
                  <article className="strategyItem" key={grant.id}>
                    <div>
                      <strong>{grant.grantor_display_name}</strong>
                      <small>
                        {grant.grantor_email} · {grant.scope === "all" ? t("familyCfo.scopeAll") : grant.scope} · {t(`familyCfo.status.${grant.status}`)}
                      </small>
                    </div>
                    {grant.status === "pending" ? (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button type="button" className="miniButton" onClick={() => respondToGrant(grant.id, "accept")}>
                          {t("familyCfo.accept")}
                        </button>
                        <button type="button" className="miniButton danger" onClick={() => respondToGrant(grant.id, "decline")}>
                          {t("familyCfo.decline")}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p>{t("familyCfo.noAccessReceived")}</p>
              )}
            </div>
          </section>
        </>
      )}
    </Screen>
  );
}

// Goal Marketplace - the real fix for a gap this session's own review
// surfaced: selecting a goal (profileGoalOptions' checkbox grid, buried in
// Profile settings) only ever flipped a silent profile.goals[id] flag - it
// never took the customer anywhere. Separately, the only real "goal ->
// planner" doorway (DEDICATED_GOAL_SCREENS) lived as a small icon row
// inside Mirror's tools panel, with no sense of real status. This screen
// unifies both into one real, status-aware experience: the same real
// confirmed-plan data Strategic Balance/Family CFO already read
// (lib/strategic-balance-context.js's getStrategicBalanceSnapshot, via the
// existing /api/strategic-balance/snapshot route - no new backend), plus
// the real SME Cash Flow Copilot profile-existence check, assembled into
// one browse-and-act view instead of a settings toggle disconnected from
// a separate tools list.
const GOAL_MARKETPLACE_ICONS = {
  wedding: HeartHandshake,
  home: Building2,
  loan: CircleDollarSign,
  retirement: Landmark,
  emergency: LockKeyhole,
  investment: LineChart,
  family: ShieldCheck,
  business: BriefcaseBusiness,
  custom: Target,
};

function GoalMarketplaceCard({ id, t, status, onExplore, onToggle, canToggle, selected }) {
  const Icon = GOAL_MARKETPLACE_ICONS[id];
  return (
    <article className="strategyItem" style={{ display: "block" }}>
      <div className="weddingStatChips" style={{ marginBottom: "4px" }}>
        <span className="iconBubble">
          <Icon size={16} />
        </span>
        <strong>{t(`simulator.goals.${id}`)}</strong>
        <b className={`statePill state-${status.band}`}>{t(`goalMarketplace.status.${status.kind}`)}</b>
      </div>
      <small>{status.detail}</small>
      <div className="decisionButtonRow" style={{ marginTop: "8px" }}>
        <button type="button" className="primaryButton" style={{ flex: 1 }} onClick={onExplore}>
          {t(`goalMarketplace.action.${status.kind === "confirmed" ? "view" : status.kind === "inProgress" ? "continue" : "explore"}`)}
        </button>
        {canToggle ? (
          <button type="button" className="secondaryButton" onClick={onToggle}>
            {selected ? t("goalMarketplace.deselect") : t("goalMarketplace.select")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function GoalMarketplaceScreen({ t, setActiveScreen, preferences, setPreferences, setOtherGoalSeed }) {
  const [snapshot, setSnapshot] = useState(null);
  const [smeProfileExists, setSmeProfileExists] = useState(null);
  const [loading, setLoading] = useState(true);

  const profile = getUserProfile(preferences);
  const customGoals = getCustomGoals(preferences);
  const healthScores = getHealthScores(profile);
  const selectedGoalIds = getProfileGoalIds(profile, customGoals);

  useEffect(() => {
    let cancelled = false;
    const monthlyIncome = numberValue(profile.monthlyIncome, 7500);
    const monthlyExpenses = numberValue(profile.monthlyExpenses, 3500);
    Promise.all([
      fetch(`/api/strategic-balance/snapshot?${new URLSearchParams({ monthlyIncome: String(monthlyIncome), monthlyExpenses: String(monthlyExpenses) })}`).then((response) =>
        response.json()
      ),
      fetch("/api/sme/cashflow").then((response) => response.json()),
    ])
      .then(([snapshotData, smeData]) => {
        if (cancelled) return;
        setSnapshot(snapshotData);
        setSmeProfileExists(Boolean(smeData.profile));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !snapshot) {
    return (
      <Screen>
        <Header title={t("goalMarketplace.title")} subtitle={t("goalMarketplace.subtitle")} />
        <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
        <p>{t("loading.detail")}</p>
      </Screen>
    );
  }

  const weddingSavings = snapshot.savings.find((plan) => plan.domain === "wedding");
  const homeSavings = snapshot.savings.find((plan) => plan.domain === "home");
  const homeLoan = snapshot.loans.find((loan) => loan.purpose === "home");
  const retirementSavings = snapshot.savings.find((plan) => plan.domain === "retirement");
  const personalLoan = snapshot.loans.find((loan) => loan.purpose === "renovation" || loan.purpose === "personal");
  const emergencyScore = healthScores.find((score) => score.id === "emergency")?.value ?? 50;
  const insuranceScore = healthScores.find((score) => score.id === "insurance")?.value ?? 50;

  const cards = [
    {
      id: "wedding",
      status: weddingSavings
        ? { kind: "confirmed", band: "healthy", detail: t("goalMarketplace.detail.confirmedSavings", { amount: formatSgd(weddingSavings.monthlyContribution) }) }
        : selectedGoalIds.includes("wedding")
          ? { kind: "inProgress", band: "tight", detail: t("goalMarketplace.detail.selectedNotStarted") }
          : { kind: "explore", band: "notPlanned", detail: t("goalMarketplace.detail.notSelected") },
      screen: screens.NEED_WEDDING,
      canToggle: true,
      selected: selectedGoalIds.includes("wedding"),
    },
    {
      id: "home",
      status:
        homeSavings || homeLoan
          ? {
              kind: "confirmed",
              band: "healthy",
              detail: homeLoan
                ? t("goalMarketplace.detail.confirmedLoan", { amount: formatSgd(homeLoan.monthlyInstallment) })
                : t("goalMarketplace.detail.confirmedSavings", { amount: formatSgd(homeSavings.monthlyContribution) }),
            }
          : selectedGoalIds.includes("home")
            ? { kind: "inProgress", band: "tight", detail: t("goalMarketplace.detail.selectedNotStarted") }
            : { kind: "explore", band: "notPlanned", detail: t("goalMarketplace.detail.notSelected") },
      screen: screens.NEED_HOME,
      canToggle: true,
      selected: selectedGoalIds.includes("home"),
    },
    {
      id: "loan",
      status: personalLoan
        ? { kind: "confirmed", band: "healthy", detail: t("goalMarketplace.detail.confirmedLoan", { amount: formatSgd(personalLoan.monthlyInstallment) }) }
        : { kind: "explore", band: "notPlanned", detail: t("goalMarketplace.detail.loanExplore") },
      screen: screens.NEED_LOAN,
      canToggle: false,
    },
    {
      id: "retirement",
      status: retirementSavings
        ? { kind: "confirmed", band: "healthy", detail: t("goalMarketplace.detail.confirmedSavings", { amount: formatSgd(retirementSavings.monthlyContribution) }) }
        : selectedGoalIds.includes("retirement")
          ? { kind: "inProgress", band: "tight", detail: t("goalMarketplace.detail.selectedNotStarted") }
          : { kind: "explore", band: "notPlanned", detail: t("goalMarketplace.detail.notSelected") },
      screen: screens.NEED_RETIREMENT,
      canToggle: true,
      selected: selectedGoalIds.includes("retirement"),
    },
    {
      id: "investment",
      status: snapshot.investments.length
        ? { kind: "confirmed", band: "healthy", detail: t("goalMarketplace.detail.confirmedInvestments", { count: snapshot.investments.length }) }
        : selectedGoalIds.includes("investment")
          ? { kind: "inProgress", band: "tight", detail: t("goalMarketplace.detail.selectedNotStarted") }
          : { kind: "explore", band: "notPlanned", detail: t("goalMarketplace.detail.notSelected") },
      screen: screens.NEED_INVESTMENT,
      canToggle: true,
      selected: selectedGoalIds.includes("investment"),
    },
    {
      id: "emergency",
      status: { kind: emergencyScore >= 70 ? "confirmed" : "inProgress", band: scoreBand(emergencyScore), detail: t("goalMarketplace.detail.healthScore", { score: emergencyScore }) },
      screen: screens.NEED_EMERGENCY,
      canToggle: false,
    },
    {
      id: "family",
      status: { kind: insuranceScore >= 70 ? "confirmed" : "inProgress", band: scoreBand(insuranceScore), detail: t("goalMarketplace.detail.healthScore", { score: insuranceScore }) },
      screen: screens.NEED_INSURANCE,
      canToggle: true,
      selected: selectedGoalIds.includes("family"),
    },
    {
      id: "business",
      status: smeProfileExists
        ? { kind: "confirmed", band: "healthy", detail: t("goalMarketplace.detail.businessConfirmed") }
        : selectedGoalIds.includes("business")
          ? { kind: "inProgress", band: "tight", detail: t("goalMarketplace.detail.selectedNotStarted") }
          : { kind: "explore", band: "notPlanned", detail: t("goalMarketplace.detail.businessExplore") },
      screen: screens.SME_CASHFLOW,
      canToggle: true,
      selected: selectedGoalIds.includes("business"),
    },
  ];

  return (
    <Screen>
      <Header title={t("goalMarketplace.title")} subtitle={t("goalMarketplace.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

      <div className="strategyList">
        {cards.map((card) => (
          <GoalMarketplaceCard
            key={card.id}
            id={card.id}
            t={t}
            status={card.status}
            canToggle={card.canToggle}
            selected={card.selected}
            onExplore={() => setActiveScreen(card.screen)}
            onToggle={() => toggleProfileGoal(setPreferences, card.id)}
          />
        ))}
      </div>

      <section className="financialStrategyPanel">
        <span className="sectionLabel">{t("goalMarketplace.familyKids.label")}</span>
        <p className="weddingCarouselHint">{t("goalMarketplace.familyKids.detail")}</p>
        <button
          type="button"
          className="primaryButton"
          onClick={() => {
            setOtherGoalSeed(t("goalMarketplace.familyKids.starterMessage"));
            setActiveScreen(screens.NEED_OTHER);
          }}
        >
          {t("goalMarketplace.familyKids.action")}
          <ChevronRight size={16} />
        </button>
      </section>

      <section className="financialStrategyPanel">
        <span className="sectionLabel">{t("goalMarketplace.customLabel")}</span>
        <div className="strategyList">
          {customGoals.length ? (
            customGoals.map((goal, index) => (
              <article className="strategyItem" key={index}>
                <div>
                  <strong>{goal.name}</strong>
                  <small>{goal.monthlyContribution ? t("goalMarketplace.detail.confirmedSavings", { amount: formatSgd(goal.monthlyContribution) }) : t("goalMarketplace.detail.selectedNotStarted")}</small>
                </div>
              </article>
            ))
          ) : (
            <p>{t("goalMarketplace.noCustomGoals")}</p>
          )}
        </div>
        <button type="button" className="secondaryButton" onClick={() => setActiveScreen(screens.NEED_OTHER)}>
          {t("goalMarketplace.addCustomGoal")}
        </button>
      </section>
    </Screen>
  );
}

// Personal Economy - reframes numbers that are each already real elsewhere
// (Home's stated income/expenses, Asset Profile's real net worth,
// Strategic Balance's real committed monthly total) as real economic
// indicators, plus two genuinely new computations: a real net-worth
// trajectory from the Asset Profile ledger's own real createdAt
// timestamps, and a real income growth rate from the customer's own
// logged income_entries history. See lib/personal-economy-finance.js -
// nothing here is invented, every number traces back to a real stored row.
function TrendIndicator({ direction, children }) {
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : null;
  return (
    <span className={`weddingStatChips`} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      {Icon ? <Icon size={14} /> : null}
      {children}
    </span>
  );
}

function PersonalEconomyScreen({ t, setActiveScreen, preferences }) {
  const [committedMonthlyTotal, setCommittedMonthlyTotal] = useState(null);
  const [loading, setLoading] = useState(true);

  const profile = getUserProfile(preferences);
  const assets = preferences.assets ?? [];
  const monthlyIncome = numberValue(profile.monthlyIncome, 7500);
  const monthlyExpenses = numberValue(profile.monthlyExpenses, 3500);
  const netWorth = computeNetWorth(assets, {
    existingLoans: numberValue(profile.existingLoans, 0),
    creditCardOutstanding: numberValue(profile.creditCardOutstanding, 0),
  });

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ monthlyIncome: String(monthlyIncome), monthlyExpenses: String(monthlyExpenses) });
    fetch(`/api/strategic-balance/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setCommittedMonthlyTotal(data.committedMonthlyTotal ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCommittedMonthlyTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Deliberately once on mount, like every other real "current snapshot"
    // read in this app - re-fetches only when the customer reopens this screen.
  }, []);

  if (loading || committedMonthlyTotal === null) {
    return (
      <Screen>
        <Header title={t("personalEconomy.title")} subtitle={t("personalEconomy.subtitle")} />
        <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
        <p>{t("loading.detail")}</p>
      </Screen>
    );
  }

  const indicators = computePersonalEconomyIndicators({
    monthlyIncome,
    monthlyExpenses,
    netWorth: netWorth.netWorth,
    committedMonthlyTotal,
  });
  const netWorthTimeline = computeNetWorthTimeline(assets);
  const incomeGrowth = computeIncomeGrowth(preferences.incomeHistory ?? []);

  const indicatorCards = [
    { id: "grossOutput", value: formatSgd(indicators.grossOutput) },
    { id: "consumption", value: formatSgd(indicators.consumption) },
    { id: "tradeBalance", value: formatSgd(indicators.tradeBalance) },
    { id: "reserves", value: formatSgd(indicators.reserves) },
    { id: "debtRatio", value: `${indicators.debtRatioPercent}%` },
    { id: "savingsRate", value: `${indicators.savingsRatePercent}%` },
  ];

  return (
    <Screen>
      <Header title={t("personalEconomy.title")} subtitle={t("personalEconomy.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

      <div className="futureCompareGrid">
        {indicatorCards.map((card) => (
          <div className="futureCompareCard" key={card.id}>
            <span className="sectionLabel">{t(`personalEconomy.indicators.${card.id}.label`)}</span>
            <strong>{card.value}</strong>
            <small>{t(`personalEconomy.indicators.${card.id}.detail`)}</small>
          </div>
        ))}
      </div>

      <section className="proofBlock">
        <strong>{t("personalEconomy.netWorthTrendLabel")}</strong>
        {netWorthTimeline ? (
          <p>
            <TrendIndicator direction={netWorthTimeline.direction}>
              {t("personalEconomy.netWorthTrendDetail", {
                amount: formatSgd(Math.abs(netWorthTimeline.changeAmount)),
                percent: netWorthTimeline.changePercent == null ? "—" : Math.abs(netWorthTimeline.changePercent),
              })}
            </TrendIndicator>
          </p>
        ) : (
          <p>{t("personalEconomy.netWorthTrendEmpty")}</p>
        )}
      </section>

      <section className="proofBlock">
        <strong>{t("personalEconomy.incomeGrowthLabel")}</strong>
        {incomeGrowth.hasEnoughHistory ? (
          <p>
            <TrendIndicator direction={incomeGrowth.direction}>
              {t("personalEconomy.incomeGrowthDetail", {
                percent: incomeGrowth.growthPercent == null ? "—" : Math.abs(incomeGrowth.growthPercent),
                months: incomeGrowth.sampleSize,
              })}
            </TrendIndicator>
          </p>
        ) : (
          <p>{t("personalEconomy.incomeGrowthEmpty", { count: incomeGrowth.sampleSize })}</p>
        )}
      </section>

      <section className="financialStrategyPanel">
        <span className="sectionLabel">{t("personalEconomy.subsystemsLabel")}</span>
        <div className="strategyList">
          <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.ASSET_PROFILE)}>
            <PiggyBank size={15} />
            <span>{t("assetProfile.title")}</span>
            <ChevronRight size={14} className="weddingEntryTrailing" />
          </button>
          <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.STRATEGIC_BALANCE)}>
            <ChartNoAxesColumnIncreasing size={15} />
            <span>{t("lifeGraph.strategicBalance.title")}</span>
            <ChevronRight size={14} className="weddingEntryTrailing" />
          </button>
          <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.SHADOW_ACCOUNT)}>
            <History size={15} />
            <span>{t("shadowAccount.title")}</span>
            <ChevronRight size={14} className="weddingEntryTrailing" />
          </button>
          <button type="button" className="checkOption weddingEntryOption" onClick={() => setActiveScreen(screens.FAMILY_CFO)}>
            <Users size={15} />
            <span>{t("familyCfo.title")}</span>
            <ChevronRight size={14} className="weddingEntryTrailing" />
          </button>
        </div>
      </section>
    </Screen>
  );
}

// Deal Finder - the one honest slice of "Agent-to-Agent Commerce" this app
// can deliver without either fabricating a fake negotiation result or
// standing up a real external merchant/payment integration (neither
// exists here - QuickActionScreen's PayNow/Scan&Pay/FX screens are
// explicitly named mockScreens with hardcoded fake data, confirmed while
// scoping this feature). This is real web research, not agent
// negotiation: real web_search, real vendor names, real sources - the
// customer still has to go act on it themselves. See
// lib/deal-finder-prompts.js's system prompt for the same honesty
// boundary stated to the model itself.
function DealFinderScreen({ t, setActiveScreen, language }) {
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);

  const submitSearch = async () => {
    if (!query.trim()) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/deal-finder/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), language }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("dealFinder.genericError"));
        return;
      }
      setResult({ ...data.result, mocked: data.mocked });
    } catch {
      setErrorMessage(t("dealFinder.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const searchAgain = () => {
    setResult(null);
    setQuery("");
  };

  return (
    <Screen>
      <Header title={t("dealFinder.title")} subtitle={t("dealFinder.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

      <section className="trustNote compactTrustNote">
        <Info size={17} />
        <p>{t("dealFinder.disclaimer")}</p>
      </section>

      {result ? (
        <>
          <p className="weddingCarouselHint">{result.query_summary}</p>
          <div className="strategyList">
            {result.options.map((option, index) => (
              <article className="strategyItem" key={index} style={{ display: "block" }}>
                <div className="weddingStatChips" style={{ marginBottom: "4px" }}>
                  <strong>{option.name}</strong>
                  <b className="statePill state-healthy">{formatSgd(option.price)}</b>
                </div>
                <small>
                  {option.vendor} · {option.unit}
                </small>
                <p>{option.notes}</p>
                <small className="riskText">{t("dealFinder.sourceLabel", { source: option.source })}</small>
              </article>
            ))}
          </div>
          <p className="proofBlock">
            <strong>{t("dealFinder.researchNotesLabel")}</strong>
            <span>{result.research_notes}</span>
          </p>
          {result.mocked ? <p className="weddingCarouselHint">{t("dealFinder.mockedNote")}</p> : null}
          <button type="button" className="primaryButton" onClick={searchAgain}>
            {t("dealFinder.searchAgain")}
            <Search size={18} />
          </button>
        </>
      ) : (
        <section className="settingsGroup">
          <span className="sectionLabel">{t("dealFinder.queryLabel")}</span>
          <textarea
            className="aiTextInput"
            rows={3}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("dealFinder.queryPlaceholder")}
            aria-label={t("dealFinder.queryLabel")}
          />
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          <button type="button" className="primaryButton" disabled={submitting || !query.trim()} onClick={submitSearch}>
            {submitting ? t("dealFinder.searching") : t("dealFinder.searchButton")}
            <Search size={18} />
          </button>
        </section>
      )}
    </Screen>
  );
}

// Family Travel - mirrors WeddingPlanCards' shape (same .weddingPlanCarousel*
// CSS, generic enough to reuse), adapted for travel's real fields
// (destination/traveler_count/trip_length_days instead of venue/
// photography/attire tiers).
function TravelPlanCards({ plans, researchNotes, onSelectPlan, t }) {
  const medianCost = [...plans].map((plan) => plan.total_cost).sort((a, b) => a - b)[Math.floor((plans.length - 1) / 2)];
  return (
    <section className="weddingPlanCarouselWrap">
      <span className="sectionLabel">{t("familyTravel.planComparisonLabel")}</span>
      <div className="weddingPlanCarousel">
        {plans.map((plan, index) => {
          const recommended = plan.total_cost === medianCost;
          return (
            <article className={`weddingPlanTile accent-${index % 3}${recommended ? " recommended" : ""}`} key={plan.id}>
              {recommended ? <span className="miniBadge">{t("status.recommended")}</span> : null}
              <h3>{plan.name}</h3>
              <p className="weddingPlanSummary">{plan.summary}</p>
              <div className="weddingTotalCost">
                <small>{t("familyTravel.totalCost")}</small>
                <strong>{formatSgd(Math.round(plan.total_cost))}</strong>
              </div>
              <div className="weddingStatChips">
                <span className="statChip">{plan.destination}</span>
                <span className="statChip">{t("familyTravel.travelerCount", { count: plan.traveler_count })}</span>
                <span className="statChip">{t("familyTravel.tripLength", { days: plan.trip_length_days })}</span>
              </div>
              <button type="button" className="primaryButton" onClick={() => onSelectPlan(plan.id)}>
                {t("familyTravel.selectPlan")}
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

function TravelItineraryList({ itinerary, t }) {
  if (!itinerary?.length) return null;
  return (
    <div className="settingsGroup">
      <span className="sectionLabel">{t("familyTravel.itineraryLabel")}</span>
      {itinerary.map((day, index) => (
        <div className="proofBlock" key={index}>
          <strong>
            {t("familyTravel.dayLabel", { day: day.day_number })}
            {day.is_photo_spot ? " 📍" : ""}
          </strong>
          <p>
            {day.label} — {day.location}
          </p>
          {day.notes ? <small>{day.notes}</small> : null}
        </div>
      ))}
    </div>
  );
}

function TravelConfirmedCard({ budget, t }) {
  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("familyTravel.confirmedLabel")}</span>
      <h3>{budget.destination}</h3>
      <p>{budget.confirmation_note}</p>
      <div className="weddingStatChips">
        <span className="statChip">{formatSgd(Math.round(budget.total_budget))}</span>
        <span className="statChip">{t("familyTravel.travelerCount", { count: budget.traveler_count })}</span>
        <span className="statChip">{t("familyTravel.tripLength", { days: budget.trip_length_days })}</span>
        <span className="statChip">{budget.travel_date}</span>
      </div>
      <TravelItineraryList itinerary={budget.itinerary} t={t} />
    </section>
  );
}

// Fifth pilot of the zero-input draft pattern. Travel has no benchmark to
// derive a real budget from either (like Wedding) - so the real,
// zero-input part is the same real discretionary monthly capacity math
// (income minus expenses minus every already-confirmed commitment),
// literally reused from lib/wedding-draft-finance.js since the formula
// itself is generic, not wedding-specific, matching this codebase's
// standing preference to reuse existing real math over writing a
// near-duplicate. The one real ask is trip scope/distance and timing -
// genuinely unknown, and directly maps to what the AI needs (see
// lib/travel-prompts.js).
const FAMILY_TRAVEL_DRAFT_TIMELINE_OPTIONS = [
  { id: "asap", labelKey: "homePlanner.draft.timeline.asap", months: 6, seedText: "in the next few months" },
  { id: "oneYear", labelKey: "homePlanner.draft.timeline.oneYear", months: 12, seedText: "sometime in the next year" },
  { id: "twoYears", labelKey: "homePlanner.draft.timeline.twoYears", months: 18, seedText: "in 1-2 years" },
  { id: "exploring", labelKey: "homePlanner.draft.timeline.exploring", months: null, seedText: "just exploring for now, no firm date" },
];
const FAMILY_TRAVEL_DRAFT_SCOPE_OPTIONS = [
  { id: "domestic", labelKey: "familyTravel.draft.scope.domestic", seedText: "a short regional trip nearby" },
  { id: "regional", labelKey: "familyTravel.draft.scope.regional", seedText: "a trip within Southeast Asia" },
  { id: "longHaul", labelKey: "familyTravel.draft.scope.longHaul", seedText: "a long-haul international trip" },
];

function FamilyTravelRealDraft({ profile, t, onStartWithSeed, submitting }) {
  const [committedMonthlyTotal, setCommittedMonthlyTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState(null);
  const [scope, setScope] = useState(null);

  const monthlyIncome = numberValue(profile.monthlyIncome, 0);
  const monthlyExpenses = numberValue(profile.monthlyExpenses, 0);
  const currentSavings = numberValue(profile.currentSavings, 0);
  const hasRealProfile = String(profile?.statedMonthlyIncome ?? "") !== String(defaultProfile.statedMonthlyIncome);

  useEffect(() => {
    if (!hasRealProfile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({ monthlyIncome: String(monthlyIncome), monthlyExpenses: String(monthlyExpenses) });
    fetch(`/api/strategic-balance/snapshot?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setCommittedMonthlyTotal(data.committedMonthlyTotal ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCommittedMonthlyTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasRealProfile]);

  if (!hasRealProfile) {
    return (
      <section className="weddingHero">
        <span className="weddingHeroIcon">
          <Globe2 size={26} />
        </span>
        <strong>{t("familyTravel.draft.noProfileLabel")}</strong>
        <p>{t("familyTravel.draft.noProfileBody")}</p>
      </section>
    );
  }

  if (loading || committedMonthlyTotal === null) {
    return <p>{t("loading.detail")}</p>;
  }

  const capacity = computeWeddingSavingsCapacity({ monthlyIncome, monthlyExpenses, committedMonthlyTotal });
  const selectedTimeline = FAMILY_TRAVEL_DRAFT_TIMELINE_OPTIONS.find((option) => option.id === timeline);
  const projection = selectedTimeline
    ? computeProjectedWeddingSavings({ currentSavings, monthlyCapacity: capacity.monthlyCapacity, timelineMonths: selectedTimeline.months })
    : null;

  const canStart = Boolean(timeline && scope);

  const handleStart = () => {
    if (!canStart) return;
    const timelineText = selectedTimeline?.seedText;
    const scopeText = FAMILY_TRAVEL_DRAFT_SCOPE_OPTIONS.find((option) => option.id === scope)?.seedText;
    onStartWithSeed(`We're planning ${scopeText}, ${timelineText}.`);
  };

  return (
    <section className="recommendationPanel">
      <span className="sectionLabel">{t("familyTravel.draft.title")}</span>
      {capacity.hasCapacity ? (
        <p>{t("familyTravel.draft.capacity", { amount: formatSgd(capacity.monthlyCapacity) })}</p>
      ) : (
        <p>{t("familyTravel.draft.noCapacity")}</p>
      )}
      {projection ? (
        <p>{t("familyTravel.draft.projection", { amount: formatSgd(projection.projectedSavings) })}</p>
      ) : null}
      <small className="riskText">{t("familyTravel.draft.basedOn")}</small>

      <div className="settingsGroup">
        <span className="sectionLabel">{t("homePlanner.draft.timelineQuestion")}</span>
        <div className="checkboxGrid">
          {FAMILY_TRAVEL_DRAFT_TIMELINE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={timeline === option.id ? "checkOption selected" : "checkOption"}
              onClick={() => setTimeline(option.id)}
            >
              <span>{t(option.labelKey)}</span>
            </button>
          ))}
        </div>

        <span className="sectionLabel">{t("familyTravel.draft.scopeQuestion")}</span>
        <div className="checkboxGrid">
          {FAMILY_TRAVEL_DRAFT_SCOPE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              className={scope === option.id ? "checkOption selected" : "checkOption"}
              onClick={() => setScope(option.id)}
            >
              <span>{t(option.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="primaryButton" disabled={!canStart || submitting} onClick={handleStart}>
        {submitting ? t("weddingPlanner.thinking") : t("familyTravel.draft.startButton")}
        <Send size={18} />
      </button>
    </section>
  );
}

function FamilyTravelScreen({ t, setActiveScreen, language, profile }) {
  const [sessionData, setSessionData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (message) => {
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/travel/stage1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: sessionData?.planOptions || sessionData?.confirmedBudget ? "refine" : "generate",
          message,
          language,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("familyTravel.genericError"));
        return;
      }
      if (data.status === "pending_partner_confirmation") {
        setSessionData((current) => ({ ...current, pendingPartnerConfirmation: true }));
        return;
      }
      if (data.type === "propose_travel_plans") {
        setSessionData((current) => ({ ...current, planOptions: data.data, confirmedBudget: null }));
      } else if (data.type === "confirm_travel_plan") {
        setSessionData((current) => ({ ...current, confirmedBudget: data.data, planOptions: null }));
      }
    } catch {
      setErrorMessage(t("familyTravel.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const planAnother = () => setSessionData(null);

  const handleSelectPlan = (planId) => {
    const plan = sessionData?.planOptions?.plans.find((p) => p.id === planId);
    if (!plan) return;
    handleSubmit(`I'd like to confirm the "${plan.name}" plan as my final travel plan.`);
  };

  return (
    <Screen>
      <Header title={t("familyTravel.title")} subtitle={t("familyTravel.subtitle")} />
      <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />

      {sessionData?.pendingPartnerConfirmation ? (
        <section className="needHeroCard">
          <Bot size={20} />
          <span className="sectionLabel">{t("familyTravel.pendingTitle")}</span>
          <p>{t("familyTravel.pendingBody")}</p>
        </section>
      ) : sessionData?.confirmedBudget ? (
        <>
          <TravelConfirmedCard budget={sessionData.confirmedBudget} t={t} />
          <button type="button" className="secondaryButton" onClick={planAnother}>
            {t("familyTravel.planAnother")}
          </button>
        </>
      ) : (
        <>
          {sessionData?.planOptions ? (
            <TravelPlanCards
              plans={sessionData.planOptions.plans}
              researchNotes={sessionData.planOptions.research_notes}
              onSelectPlan={handleSelectPlan}
              t={t}
            />
          ) : (
            <FamilyTravelRealDraft profile={profile} t={t} onStartWithSeed={handleSubmit} submitting={submitting} />
          )}
          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}
          {sessionData?.planOptions ? (
            <AiTextInputCard
              t={t}
              onSubmit={handleSubmit}
              submitting={submitting}
              placeholder={t("familyTravel.inputPlaceholder")}
              submitLabelKey="familyTravel.send"
              labelKey="familyTravel.inputLabel"
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const DECODE_SEVERITY_ICONS = { low: Info, medium: AlertTriangle, high: AlertTriangle };

function DecodeDocumentHistoryModal({ entries, loading, onClose, t }) {
  return (
    <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("decodeDocument.historyTitle")}>
      <motion.div className="confirmModal weddingHistoryModal" {...screenMotion}>
        <History size={24} />
        <strong>{t("decodeDocument.historyTitle")}</strong>
        {loading ? (
          <p>{t("loading.detail")}</p>
        ) : entries.length ? (
          <div className="historyTimeline">
            {entries.map((entry) => (
              <article key={entry.id}>
                <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                <div>
                  <strong>{t(`decodeDocument.documentType.${entry.documentType}`)}</strong>
                  <small>{entry.summary}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>{t("decodeDocument.historyEmpty")}</p>
        )}
        <button type="button" className="primaryButton" onClick={onClose}>
          {t("homeBanking.gotIt")}
        </button>
      </motion.div>
    </section>
  );
}

function DecodeDocumentResultCard({ result, t, onDecodeAnother }) {
  return (
    <>
      <section className="insightCard">
        <FileText size={20} />
        <p>
          <strong>{t(`decodeDocument.documentType.${result.documentType}`)}</strong> — {result.summary}
        </p>
      </section>

      <section className="adviceOnlyPanel">
        <AlertTriangle size={18} />
        <p>{t("decodeDocument.disclaimer")}</p>
      </section>

      {result.flaggedClauses.length ? (
        <div className="settingsGroup">
          <span className="sectionLabel">{t("decodeDocument.flaggedTitle")}</span>
          {result.flaggedClauses.map((clause, index) => {
            const Icon = DECODE_SEVERITY_ICONS[clause.severity] ?? Info;
            return (
              <div className="proofBlock" key={index}>
                <strong>
                  <Icon size={14} /> {t(`decodeDocument.severity.${clause.severity}`)}
                </strong>
                <p>{clause.concern}</p>
                <small>&ldquo;{clause.excerpt}&rdquo;</small>
              </div>
            );
          })}
        </div>
      ) : (
        <p>{t("decodeDocument.noFlagsFound")}</p>
      )}

      {result.keyFacts.length ? (
        <div className="settingsGroup">
          <span className="sectionLabel">{t("decodeDocument.keyFactsTitle")}</span>
          {result.keyFacts.map((fact, index) => (
            <SummaryRow key={index} label={fact.label} value={fact.value} />
          ))}
        </div>
      ) : null}

      <button type="button" className="primaryButton" onClick={onDecodeAnother}>
        {t("decodeDocument.decodeAnother")}
        <FileText size={18} />
      </button>
    </>
  );
}

function DecodeDocumentScreen({ t, setActiveScreen, language }) {
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    fetch("/api/decode-document/history")
      .then((response) => response.json())
      .then((data) => setHistoryEntries(data.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  };

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file after an error
    if (!selected) return;
    setExtractError("");
    setErrorMessage("");
    setFile(null);
    setExtracting(true);
    try {
      const extraction = await extractPdfText(selected);
      if (extraction.error === "no_text_layer") {
        setExtractError(t("decodeDocument.noTextLayerError"));
        return;
      }
      setFile({ name: selected.name, text: extraction.text, truncated: extraction.truncated });
    } catch {
      setExtractError(t("decodeDocument.extractError"));
    } finally {
      setExtracting(false);
    }
  };

  const submitDecode = async () => {
    if (!file?.text) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/decode-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText: file.text, language }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(t("decodeDocument.genericError"));
        return;
      }
      setResult(data);
    } catch {
      setErrorMessage(t("decodeDocument.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const decodeAnother = () => {
    setResult(null);
    setFile(null);
    setExtractError("");
  };

  return (
    <Screen>
      <Header title={t("decodeDocument.title")} subtitle={t("decodeDocument.subtitle")} />
      <div className="weddingTopRow">
        <BackMirrorButton setActiveScreen={setActiveScreen} t={t} />
        <button type="button" className="historyButton" onClick={openHistory} aria-label={t("decodeDocument.historyTitle")}>
          <History size={16} />
        </button>
      </div>
      {historyOpen ? (
        <DecodeDocumentHistoryModal entries={historyEntries} loading={historyLoading} onClose={() => setHistoryOpen(false)} t={t} />
      ) : null}

      {result ? (
        <DecodeDocumentResultCard result={result} t={t} onDecodeAnother={decodeAnother} />
      ) : (
        <section className="settingsGroup">
          <section className="trustNote compactTrustNote">
            <FileText size={17} />
            <p>{t("decodeDocument.instructions")}</p>
          </section>

          <label className="checkOption weddingEntryOption">
            <FileText size={15} />
            <span>{extracting ? t("decodeDocument.extracting") : file?.name ?? t("decodeDocument.chooseFile")}</span>
            <input type="file" accept="application/pdf" onChange={handleFileChange} style={{ display: "none" }} disabled={extracting} />
          </label>

          {extractError ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{extractError}</p>
            </section>
          ) : null}
          {file?.truncated ? (
            <section className="trustNote compactTrustNote">
              <Info size={17} />
              <p>{t("decodeDocument.truncatedNote")}</p>
            </section>
          ) : null}

          {errorMessage ? (
            <section className="adviceOnlyPanel">
              <AlertTriangle size={18} />
              <p>{errorMessage}</p>
            </section>
          ) : null}

          <button type="button" className="primaryButton" disabled={submitting || extracting || !file?.text} onClick={submitDecode}>
            {submitting ? t("decodeDocument.thinking") : t("decodeDocument.submit")}
            <FileText size={18} />
          </button>
        </section>
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
  const [decisions, setDecisions] = useState({});
  const [applyResults, setApplyResults] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [escalatedActionIds, setEscalatedActionIds] = useState(() => new Set());

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
        profile: {
          monthlyIncome: profile.monthlyIncome,
          monthlyExpenses: profile.monthlyExpenses,
          currentSavings: profile.currentSavings,
          isIncomeIrregular: profile.isIncomeIrregular,
          incomeSampleSize: profile.incomeSampleSize,
        },
      }),
    });
    const proposeData = await proposeResponse.json();
    if (!proposeResponse.ok) {
      setErrorMessage(t("needDetails.emergency.genericError"));
      return;
    }
    setSessionData((current) => ({ ...current, proposedActions: proposeData.data }));
    // Don't pre-decide actions the AI itself flagged as needing human/banker
    // review before anything happens - the customer must opt in explicitly.
    // Everything else defaults to "approve" but stays fully editable/rejectable below.
    setDecisions(
      Object.fromEntries(
        proposeData.data.actions
          .filter((action) => !action.suitability?.human_review_required)
          .map((action) => [action.id, { decision: "approve" }])
      )
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

  const updateDecision = (actionId, decision) => {
    setDecisions((current) => ({ ...current, [actionId]: decision }));
  };

  // Same real Relationship Manager escalation record ProductFitScreen
  // writes (preferences.escalationHistory) - one real shared "times you
  // asked for human help" log, not a second parallel system. Previously
  // action.suitability.human_review_required had zero visible consequence
  // beyond silently not pre-selecting "approve" (see runProposeActions
  // above) - this gives it a real, reachable action.
  function requestHardshipRmReview(action) {
    setPreferences((current) => {
      const existing = Array.isArray(current.escalationHistory) ? current.escalationHistory : [];
      const record = {
        id: `hardship-${action.id}-${Date.now()}`,
        source: "hardshipRecovery",
        title: t(`needDetails.emergency.actionTypes.${action.action_type}`),
        reason: action.rationale,
        at: Date.now(),
      };
      return { ...current, escalationHistory: [record, ...existing].slice(0, 10) };
    });
    setEscalatedActionIds((current) => new Set(current).add(action.id));
  }

  const decisionCount = Object.keys(decisions).length;

  const applyRecoveryPlan = async () => {
    if (!decisionCount) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/hardship/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisions: Object.entries(decisions).map(([actionId, decision]) => ({ actionId, ...decision })),
        }),
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
                    decision={decisions[action.id]}
                    onDecisionChange={updateDecision}
                    escalated={escalatedActionIds.has(action.id)}
                    onEscalate={() => requestHardshipRmReview(action)}
                    t={t}
                  />
                ))}
              </div>
              <button type="button" className="primaryButton" onClick={applyRecoveryPlan} disabled={submitting || !decisionCount}>
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
                          : entry.status === "rejected"
                            ? `${t("needDetails.emergency.actionRejectedLabel")}${entry.decision_reason ? `: ${entry.decision_reason}` : ""}`
                            : entry.explanation
                    }
                    value={
                      entry.status === "failed" || entry.status === "rejected"
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

// Mirrors SavingsCheckinForm's shape (month + amount + optional note) but
// with its own copy - reusing SavingsCheckinForm directly would show
// wedding-labeled text ("weddingPlanner.checkins.*") in Settings.
function IncomeLogEntryForm({ onAddEntry, submitting, t }) {
  const [entryMonth, setEntryMonth] = useState(currentMonthValue());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!entryMonth || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || submitting) return;
    const ok = await onAddEntry({ entryMonth, amount: parsedAmount, note: note.trim() || undefined });
    if (ok) {
      setAmount("");
      setNote("");
    }
  };

  return (
    <form className="settingsGroup" onSubmit={handleSubmit}>
      <span className="sectionLabel">{t("settings.incomeLog.addButton")}</span>
      <input
        type="month"
        className="aiTextInput"
        value={entryMonth}
        onChange={(event) => setEntryMonth(event.target.value)}
        aria-label={t("settings.incomeLog.monthLabel")}
      />
      <input
        type="number"
        min="0"
        step="10"
        className="aiTextInput"
        placeholder={t("settings.incomeLog.amountLabel")}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        aria-label={t("settings.incomeLog.amountLabel")}
      />
      <input
        type="text"
        className="aiTextInput"
        placeholder={t("settings.incomeLog.noteLabel")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        aria-label={t("settings.incomeLog.noteLabel")}
      />
      <button type="submit" className="secondaryButton" disabled={submitting}>
        {submitting ? t("settings.incomeLog.submitting") : t("settings.incomeLog.addButton")}
      </button>
    </form>
  );
}

// Mirrors IncomeLogEntryForm exactly, for the expense side (lib/expense-
// store.js) - kept as its own component rather than a generalized
// "amount entries" form, same mirrored-not-abstracted convention as
// income-store.js/expense-store.js themselves.
function ExpenseLogEntryForm({ onAddEntry, submitting, t }) {
  const [entryMonth, setEntryMonth] = useState(currentMonthValue());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!entryMonth || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || submitting) return;
    const ok = await onAddEntry({ entryMonth, amount: parsedAmount, note: note.trim() || undefined });
    if (ok) {
      setAmount("");
      setNote("");
    }
  };

  return (
    <form className="settingsGroup" onSubmit={handleSubmit}>
      <span className="sectionLabel">{t("settings.expenseLog.addButton")}</span>
      <input
        type="month"
        className="aiTextInput"
        value={entryMonth}
        onChange={(event) => setEntryMonth(event.target.value)}
        aria-label={t("settings.expenseLog.monthLabel")}
      />
      <input
        type="number"
        min="0"
        step="10"
        className="aiTextInput"
        placeholder={t("settings.expenseLog.amountLabel")}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        aria-label={t("settings.expenseLog.amountLabel")}
      />
      <input
        type="text"
        className="aiTextInput"
        placeholder={t("settings.expenseLog.noteLabel")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        aria-label={t("settings.expenseLog.noteLabel")}
      />
      <button type="submit" className="secondaryButton" disabled={submitting}>
        {submitting ? t("settings.expenseLog.submitting") : t("settings.expenseLog.addButton")}
      </button>
    </form>
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
  const [incomeSubmitting, setIncomeSubmitting] = useState(false);
  const [incomeError, setIncomeError] = useState("");
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const privacyScore = preferences.consentWithdrawn ? 38 : 92;
  const profile = getUserProfile(preferences);
  const notificationHistory = getNotificationHistory(profile, preferences, t);

  // Writes through the real income_entries table (source of truth), then
  // mirrors the result into preferences.incomeHistory so every real reader
  // (Life Graph, Mirror, hardship, every domain's AI conversation - all via
  // getUserProfile()) sees it on the very next render, not just this screen.
  async function handleAddIncomeEntry({ entryMonth, amount, note }) {
    setIncomeSubmitting(true);
    setIncomeError("");
    try {
      const response = await fetch("/api/income/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryMonth, amount, note }),
      });
      if (!response.ok) {
        setIncomeError(t("settings.incomeLog.error"));
        return false;
      }
      const { entry } = await response.json();
      setPreferences((current) => {
        const withoutSameMonth = (current.incomeHistory ?? []).filter((existing) => existing.entry_month !== entry.entry_month);
        return {
          ...current,
          incomeHistory: [entry, ...withoutSameMonth].sort((a, b) => (a.entry_month < b.entry_month ? 1 : -1)),
        };
      });
      return true;
    } catch {
      setIncomeError(t("settings.incomeLog.error"));
      return false;
    } finally {
      setIncomeSubmitting(false);
    }
  }

  // Mirrors handleAddIncomeEntry exactly, for the expense side.
  async function handleAddExpenseEntry({ entryMonth, amount, note }) {
    setExpenseSubmitting(true);
    setExpenseError("");
    try {
      const response = await fetch("/api/expense/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryMonth, amount, note }),
      });
      if (!response.ok) {
        setExpenseError(t("settings.expenseLog.error"));
        return false;
      }
      const { entry } = await response.json();
      setPreferences((current) => {
        const withoutSameMonth = (current.expenseHistory ?? []).filter((existing) => existing.entry_month !== entry.entry_month);
        return {
          ...current,
          expenseHistory: [entry, ...withoutSameMonth].sort((a, b) => (a.entry_month < b.entry_month ? 1 : -1)),
        };
      });
      return true;
    } catch {
      setExpenseError(t("settings.expenseLog.error"));
      return false;
    } finally {
      setExpenseSubmitting(false);
    }
  }

  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function updateProfileField(key, value) {
    setPreferences((current) => ({
      ...current,
      // Spread the raw stored profile (mergeDefaults(defaultProfile, ...)),
      // not getUserProfile(current) - that now also carries computed fields
      // (monthlyIncome smoothed, isIncomeIrregular, incomeSampleSize) which
      // must never get baked into persisted storage as if customer-typed.
      profile: { ...mergeDefaults(defaultProfile, current.profile), [key]: value },
    }));
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

      <button type="button" className="profileQuickAction" onClick={() => setActiveScreen(screens.ASSET_PROFILE)}>
        <Wallet size={18} />
        <span>
          <strong>{t("settings.openAssetProfile")}</strong>
          <small>{t("settings.openAssetProfileDetail")}</small>
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
            ["statedMonthlyIncome", "profile.combinedIncome", "number"],
            ["monthlyExpenses", "profile.monthlyExpenses", "number"],
            ["currentSavings", "profile.currentSavings", "number"],
            ["existingLoans", "profile.existingLoans", "number"],
            ["creditCardOutstanding", "profile.creditCardOutstanding", "number"],
            ["investments", "profile.investments", "number"],
            ["insuranceStatus", "profile.insuranceStatus", "text"],
            ["insuranceCoverageAmount", "profile.insuranceCoverageAmount", "number"],
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
                onClick={() => toggleProfileGoal(setPreferences, id)}
              >
                <Icon size={15} />
                <span>{t(labelKey)}</span>
                {profile.goals?.[id] ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={Banknote} title={t("settings.incomeLog.title")} description={t("settings.incomeLog.description")}>
        <div className="recommendationPanel">
          <span className="sectionLabel">{t("settings.incomeLog.summaryTitle")}</span>
          <SummaryRow label={t("settings.incomeLog.effectiveLabel")} value={formatSgd(Math.round(Number(profile.monthlyIncome) || 0))} />
          {profile.isIncomeIrregular ? (
            <p>
              {t("settings.incomeLog.irregularNote", {
                sampleSize: profile.incomeSampleSize,
                amount: formatSgd(Math.round(Number(profile.monthlyIncome) || 0)),
              })}
            </p>
          ) : null}
        </div>

        {(preferences.incomeHistory ?? []).length ? (
          <div className="weddingLineItems">
            {(preferences.incomeHistory ?? []).map((entry) => (
              <SummaryRow
                key={entry.id ?? entry.entry_month}
                label={entry.note ? `${entry.entry_month} — ${entry.note}` : entry.entry_month}
                value={formatSgd(Math.round(Number(entry.amount)))}
              />
            ))}
          </div>
        ) : (
          <p>{t("settings.incomeLog.emptyState")}</p>
        )}

        {incomeError ? (
          <section className="adviceOnlyPanel">
            <AlertTriangle size={18} />
            <p>{incomeError}</p>
          </section>
        ) : null}

        <IncomeLogEntryForm onAddEntry={handleAddIncomeEntry} submitting={incomeSubmitting} t={t} />
      </SettingsCard>

      <SettingsCard icon={Banknote} title={t("settings.expenseLog.title")} description={t("settings.expenseLog.description")}>
        <div className="recommendationPanel">
          <span className="sectionLabel">{t("settings.expenseLog.summaryTitle")}</span>
          <SummaryRow label={t("settings.expenseLog.effectiveLabel")} value={formatSgd(Math.round(Number(profile.monthlyExpenses) || 0))} />
          {profile.isExpensesIrregular ? (
            <p>
              {t("settings.expenseLog.irregularNote", {
                sampleSize: profile.expenseSampleSize,
                amount: formatSgd(Math.round(Number(profile.monthlyExpenses) || 0)),
              })}
            </p>
          ) : null}
        </div>

        {(preferences.expenseHistory ?? []).length ? (
          <div className="weddingLineItems">
            {(preferences.expenseHistory ?? []).map((entry) => (
              <SummaryRow
                key={entry.id ?? entry.entry_month}
                label={entry.note ? `${entry.entry_month} — ${entry.note}` : entry.entry_month}
                value={formatSgd(Math.round(Number(entry.amount)))}
              />
            ))}
          </div>
        ) : (
          <p>{t("settings.expenseLog.emptyState")}</p>
        )}

        {expenseError ? (
          <section className="adviceOnlyPanel">
            <AlertTriangle size={18} />
            <p>{expenseError}</p>
          </section>
        ) : null}

        <ExpenseLogEntryForm onAddEntry={handleAddExpenseEntry} submitting={expenseSubmitting} t={t} />
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

      <SettingsCard icon={Accessibility} title={t("settings.accessibility.title")} description={t("settings.accessibility.description")}>
        <ToggleRow
          icon={Accessibility}
          label={t("settings.accessibility.simpleMode")}
          checked={Boolean(preferences.accessibility?.simpleMode)}
          onChange={() => updateNested("accessibility", "simpleMode", !preferences.accessibility?.simpleMode)}
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

      <SettingsCard icon={LogOut} title={t("settings.account.title")} description={t("settings.account.description")}>
        <div className="settingsActions">
          <button type="button" className="miniButton" onClick={() => window.location.assign("/grants")}>
            <Users size={15} />
            {t("settings.account.sharedAccess")}
          </button>
          <button
            type="button"
            className="miniButton danger"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.assign("/login");
            }}
          >
            <LogOut size={15} />
            {t("settings.account.logOut")}
          </button>
        </div>
      </SettingsCard>
    </Screen>
  );
}

// Blank draft for the "add asset" form, keyed by the fixed taxonomy field
// shape (lib/asset-taxonomy.js). `details` fields are all optional strings
// here (parsed/validated on submit) so every input can stay a controlled
// component regardless of which category is selected.
function blankAssetDraft(category) {
  return {
    category,
    subtype: ASSET_SUBTYPES[category][0],
    name: "",
    value: "",
    strengthRating: "3",
    notes: "",
    details: {
      liquidity: "liquid",
      risk: "medium",
      expectedReturnPct: "",
      maturityDate: "",
      appreciates: false,
      producesCashflow: false,
      monthlyCashflow: "",
      maintenanceCostMonthly: "",
      liquidityDifficulty: "medium",
      monthlyIncome: "",
      ownerDependency: "partial",
      replicable: false,
      status: "active",
      coverageAmount: "",
      expiryDate: "",
      metricLabel: "",
      metricValue: "",
      opportunityTypes: [],
    },
  };
}

// Renders only the fields that matter for the selected category, per the
// per-category field schema in the approved plan - a financial asset never
// shows a "strength rating", a human-capital asset never shows "liquidity".
function AssetDetailFields({ draft, setDraft, t }) {
  const { category, details } = draft;
  const setDetail = (key, value) => setDraft((current) => ({ ...current, details: { ...current.details, [key]: value } }));

  if (category === "financial") {
    return (
      <>
        <label className="inputField">
          <span>{t("assetProfile.fields.value")}</span>
          <input type="text" inputMode="decimal" value={draft.value} onChange={(e) => setDraft((c) => ({ ...c, value: e.target.value }))} />
        </label>
        <label className="inputField">
          <span>{t("assetProfile.fields.liquidity")}</span>
          <select value={details.liquidity} onChange={(e) => setDetail("liquidity", e.target.value)}>
            {FIELD_ENUMS.liquidity.map((option) => (
              <option key={option} value={option}>
                {t(`assetProfile.fields.liquidityOptions.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="inputField">
          <span>{t("assetProfile.fields.risk")}</span>
          <select value={details.risk} onChange={(e) => setDetail("risk", e.target.value)}>
            {FIELD_ENUMS.risk.map((option) => (
              <option key={option} value={option}>
                {t(`assetProfile.fields.riskOptions.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="inputField">
          <span>{t("assetProfile.fields.expectedReturnPct")}</span>
          <input type="text" inputMode="decimal" value={details.expectedReturnPct} onChange={(e) => setDetail("expectedReturnPct", e.target.value)} />
        </label>
        <label className="inputField">
          <span>{t("assetProfile.fields.maturityDate")}</span>
          <input type="date" value={details.maturityDate} onChange={(e) => setDetail("maturityDate", e.target.value)} />
        </label>
      </>
    );
  }

  if (category === "physical") {
    return (
      <>
        <label className="inputField">
          <span>{t("assetProfile.fields.value")}</span>
          <input type="text" inputMode="decimal" value={draft.value} onChange={(e) => setDraft((c) => ({ ...c, value: e.target.value }))} />
        </label>
        <button type="button" className={details.appreciates ? "checkOption selected" : "checkOption"} onClick={() => setDetail("appreciates", !details.appreciates)}>
          <span>{t("assetProfile.fields.appreciates")}</span>
          {details.appreciates ? <Check size={14} /> : null}
        </button>
        <button type="button" className={details.producesCashflow ? "checkOption selected" : "checkOption"} onClick={() => setDetail("producesCashflow", !details.producesCashflow)}>
          <span>{t("assetProfile.fields.producesCashflow")}</span>
          {details.producesCashflow ? <Check size={14} /> : null}
        </button>
        {details.producesCashflow ? (
          <label className="inputField">
            <span>{t("assetProfile.fields.monthlyCashflow")}</span>
            <input type="text" inputMode="decimal" value={details.monthlyCashflow} onChange={(e) => setDetail("monthlyCashflow", e.target.value)} />
          </label>
        ) : null}
        <label className="inputField">
          <span>{t("assetProfile.fields.maintenanceCostMonthly")}</span>
          <input type="text" inputMode="decimal" value={details.maintenanceCostMonthly} onChange={(e) => setDetail("maintenanceCostMonthly", e.target.value)} />
        </label>
        <label className="inputField">
          <span>{t("assetProfile.fields.liquidityDifficulty")}</span>
          <select value={details.liquidityDifficulty} onChange={(e) => setDetail("liquidityDifficulty", e.target.value)}>
            {FIELD_ENUMS.liquidityDifficulty.map((option) => (
              <option key={option} value={option}>
                {t(`assetProfile.fields.liquidityDifficultyOptions.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  }

  if (category === "business") {
    return (
      <>
        <label className="inputField">
          <span>{t("assetProfile.fields.monthlyIncome")}</span>
          <input type="text" inputMode="decimal" value={details.monthlyIncome} onChange={(e) => setDetail("monthlyIncome", e.target.value)} />
        </label>
        <label className="inputField">
          <span>{t("assetProfile.fields.valueOptional")}</span>
          <input type="text" inputMode="decimal" value={draft.value} onChange={(e) => setDraft((c) => ({ ...c, value: e.target.value }))} />
        </label>
        <label className="inputField">
          <span>{t("assetProfile.fields.ownerDependency")}</span>
          <select value={details.ownerDependency} onChange={(e) => setDetail("ownerDependency", e.target.value)}>
            {FIELD_ENUMS.ownerDependency.map((option) => (
              <option key={option} value={option}>
                {t(`assetProfile.fields.ownerDependencyOptions.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={details.replicable ? "checkOption selected" : "checkOption"} onClick={() => setDetail("replicable", !details.replicable)}>
          <span>{t("assetProfile.fields.replicable")}</span>
          {details.replicable ? <Check size={14} /> : null}
        </button>
      </>
    );
  }

  if (category === "legal") {
    return (
      <>
        <label className="inputField">
          <span>{t("assetProfile.fields.status")}</span>
          <select value={details.status} onChange={(e) => setDetail("status", e.target.value)}>
            {FIELD_ENUMS.legalStatus.map((option) => (
              <option key={option} value={option}>
                {t(`assetProfile.fields.statusOptions.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="inputField">
          <span>{t("assetProfile.fields.coverageAmount")}</span>
          <input type="text" inputMode="decimal" value={details.coverageAmount} onChange={(e) => setDetail("coverageAmount", e.target.value)} />
        </label>
        <label className="inputField">
          <span>{t("assetProfile.fields.expiryDate")}</span>
          <input type="date" value={details.expiryDate} onChange={(e) => setDetail("expiryDate", e.target.value)} />
        </label>
        <AssetStrengthRatingField draft={draft} setDraft={setDraft} t={t} />
      </>
    );
  }

  // human, social, knowledge, digital - the mostly-non-monetary categories:
  // required strength rating, optional value, plus digital's follower-count-
  // style metric and social's opportunity-type tags.
  return (
    <>
      <AssetStrengthRatingField draft={draft} setDraft={setDraft} t={t} />
      <label className="inputField">
        <span>{t("assetProfile.fields.estimatedValueOptional")}</span>
        <input type="text" inputMode="decimal" value={draft.value} onChange={(e) => setDraft((c) => ({ ...c, value: e.target.value }))} />
      </label>
      {category === "social" ? (
        <div className="checkboxGrid">
          {FIELD_ENUMS.opportunityType.map((option) => {
            const selected = (details.opportunityTypes ?? []).includes(option);
            return (
              <button
                type="button"
                key={option}
                className={selected ? "checkOption selected" : "checkOption"}
                onClick={() =>
                  setDetail(
                    "opportunityTypes",
                    selected ? details.opportunityTypes.filter((o) => o !== option) : [...(details.opportunityTypes ?? []), option]
                  )
                }
              >
                <span>{t(`assetProfile.fields.opportunityTypeOptions.${option}`)}</span>
                {selected ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {category === "digital" ? (
        <>
          <label className="inputField">
            <span>{t("assetProfile.fields.metricLabel")}</span>
            <input type="text" value={details.metricLabel} onChange={(e) => setDetail("metricLabel", e.target.value)} />
          </label>
          <label className="inputField">
            <span>{t("assetProfile.fields.metricValue")}</span>
            <input type="text" inputMode="decimal" value={details.metricValue} onChange={(e) => setDetail("metricValue", e.target.value)} />
          </label>
        </>
      ) : null}
    </>
  );
}

function AssetStrengthRatingField({ draft, setDraft, t }) {
  return (
    <label className="inputField">
      <span>{t("assetProfile.fields.strengthRating")}</span>
      <select value={draft.strengthRating} onChange={(e) => setDraft((c) => ({ ...c, strengthRating: e.target.value }))}>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

function AssetEntryForm({ initialDraft, onSubmit, onCancel, submitting, t }) {
  const [draft, setDraft] = useState(initialDraft);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(draft);
  };

  return (
    <form className="settingsGroup" onSubmit={handleSubmit}>
      <label className="inputField">
        <span>{t("assetProfile.fields.category")}</span>
        <select
          value={draft.category}
          onChange={(e) => {
            const category = e.target.value;
            setDraft((current) => ({ ...blankAssetDraft(category), name: current.name, notes: current.notes }));
          }}
        >
          {ASSET_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t(assetCategoryMeta[category].labelKey)}
            </option>
          ))}
        </select>
      </label>
      <label className="inputField">
        <span>{t("assetProfile.fields.subtype")}</span>
        <select value={draft.subtype} onChange={(e) => setDraft((c) => ({ ...c, subtype: e.target.value }))}>
          {ASSET_SUBTYPES[draft.category].map((subtype) => (
            <option key={subtype} value={subtype}>
              {t(assetSubtypeLabelKey(draft.category, subtype))}
            </option>
          ))}
        </select>
      </label>
      <label className="inputField">
        <span>{t("assetProfile.fields.name")}</span>
        <input
          type="text"
          className="aiTextInput"
          placeholder={t("assetProfile.fields.namePlaceholder")}
          value={draft.name}
          onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
        />
      </label>

      <AssetDetailFields draft={draft} setDraft={setDraft} t={t} />

      <label className="inputField">
        <span>{t("assetProfile.fields.notes")}</span>
        <input type="text" className="aiTextInput" value={draft.notes} onChange={(e) => setDraft((c) => ({ ...c, notes: e.target.value }))} />
      </label>

      <div className="settingsActions">
        <button type="submit" className="primaryButton" disabled={submitting || !draft.name.trim()}>
          {submitting ? t("assetProfile.form.submitting") : t("assetProfile.form.submit")}
        </button>
        <button type="button" className="miniButton" onClick={onCancel}>
          {t("assetProfile.form.cancel")}
        </button>
      </div>
    </form>
  );
}

function AssetProfileScreen({ preferences, setPreferences, t, setActiveScreen }) {
  const [addingCategory, setAddingCategory] = useState(null);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const assets = preferences.assets ?? [];
  const profile = getUserProfile(preferences);
  const netWorth = computeNetWorth(assets, {
    existingLoans: numberValue(profile.existingLoans, 0),
    creditCardOutstanding: numberValue(profile.creditCardOutstanding, 0),
  });
  const categoryTotals = computeCategoryTotals(assets);
  const stageRollup = computeStageRollup(assets);

  const hasLegacyNumbers = numberValue(profile.currentSavings, 0) > 0 || numberValue(profile.investments, 0) > 0 || numberValue(profile.insuranceCoverageAmount, 0) > 0;
  const showMigrationPrompt = assets.length === 0 && hasLegacyNumbers;

  function draftToPayload(draft) {
    return {
      category: draft.category,
      subtype: draft.subtype,
      name: draft.name.trim(),
      value: draft.value === "" ? null : Number(draft.value),
      strengthRating: isNonMonetaryCategory(draft.category) ? Number(draft.strengthRating) : null,
      details: draft.details,
      notes: draft.notes.trim() || undefined,
    };
  }

  async function handleCreate(draft) {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(draft)),
      });
      if (!response.ok) {
        setError(t("assetProfile.form.error"));
        return;
      }
      const { asset } = await response.json();
      setPreferences((current) => ({ ...current, assets: [asset, ...(current.assets ?? [])] }));
      setAddingCategory(null);
    } catch {
      setError(t("assetProfile.form.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id, draft) {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(draft)),
      });
      if (!response.ok) {
        setError(t("assetProfile.form.error"));
        return;
      }
      const { asset } = await response.json();
      setPreferences((current) => ({ ...current, assets: (current.assets ?? []).map((a) => (a.id === id ? asset : a)) }));
      setEditingAssetId(null);
    } catch {
      setError(t("assetProfile.form.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setError(t("assetProfile.form.error"));
        return;
      }
      setPreferences((current) => ({ ...current, assets: (current.assets ?? []).filter((a) => a.id !== id) }));
    } catch {
      setError(t("assetProfile.form.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMigrateLegacy() {
    const starters = [];
    if (numberValue(profile.currentSavings, 0) > 0) {
      starters.push({
        category: "financial",
        subtype: "cash",
        name: t("assetProfile.migration.cashName"),
        value: numberValue(profile.currentSavings, 0),
        details: { liquidity: "cash", risk: "low" },
      });
    }
    if (numberValue(profile.investments, 0) > 0) {
      starters.push({
        category: "financial",
        subtype: "fund",
        name: t("assetProfile.migration.investmentName"),
        value: numberValue(profile.investments, 0),
        details: { liquidity: "liquid", risk: "medium" },
      });
    }
    if (numberValue(profile.insuranceCoverageAmount, 0) > 0) {
      starters.push({
        category: "legal",
        subtype: "insurance_policy",
        name: t("assetProfile.migration.insuranceName"),
        details: { status: "active", coverageAmount: numberValue(profile.insuranceCoverageAmount, 0) },
      });
    }
    setSubmitting(true);
    setError("");
    try {
      const created = [];
      for (const starter of starters) {
        const response = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(starter),
        });
        if (response.ok) {
          const { asset } = await response.json();
          created.push(asset);
        }
      }
      setPreferences((current) => ({ ...current, assets: [...created, ...(current.assets ?? [])] }));
    } catch {
      setError(t("assetProfile.form.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Header eyebrow={t("assetProfile.eyebrow")} title={t("assetProfile.title")} subtitle={t("assetProfile.subtitle")} />
      <div className="weddingTopRow">
        <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
      </div>

      <section className="recommendationPanel">
        <span className="sectionLabel">{t("assetProfile.netWorth.title")}</span>
        <SummaryRow label={t("assetProfile.netWorth.total")} value={formatSgd(netWorth.netWorth)} />
        <SummaryRow label={t("assetProfile.netWorth.assets")} value={formatSgd(netWorth.assetTotal)} />
        <SummaryRow label={t("assetProfile.netWorth.liabilities")} value={formatSgd(netWorth.liabilities)} />
      </section>

      {showMigrationPrompt ? (
        <section className="adviceOnlyPanel">
          <Info size={18} />
          <p>{t("assetProfile.migration.prompt")}</p>
          <button type="button" className="secondaryButton" onClick={handleMigrateLegacy} disabled={submitting}>
            {t("assetProfile.migration.action")}
          </button>
        </section>
      ) : null}

      <section className="scoreGrid">
        {STAGES.map((stage) => {
          const rollup = stageRollup[stage];
          const Icon = assetStageMeta[stage].icon;
          return (
            <article className="healthScoreCard" key={stage}>
              <div>
                <strong>{t(assetStageMeta[stage].labelKey)}</strong>
                <Icon size={15} />
              </div>
              <b>{rollup.valueTotal > 0 ? formatSgd(rollup.valueTotal) : `${rollup.itemCount} ${t("assetProfile.stages.itemsSuffix")}`}</b>
              <small>{t("assetProfile.stages.itemCount", { count: rollup.itemCount })}</small>
            </article>
          );
        })}
      </section>

      {error ? (
        <section className="adviceOnlyPanel">
          <AlertTriangle size={18} />
          <p>{error}</p>
        </section>
      ) : null}

      {ASSET_CATEGORIES.map((category) => {
        const Icon = assetCategoryMeta[category].icon;
        const categoryAssets = assets.filter((asset) => asset.category === category);
        const totals = categoryTotals[category];
        return (
          <SettingsCard
            key={category}
            icon={Icon}
            title={t(assetCategoryMeta[category].labelKey)}
            description={totals.valueTotal > 0 ? formatSgd(totals.valueTotal) : t("assetProfile.stages.itemCount", { count: totals.itemCount })}
          >
            {categoryAssets.length ? (
              <div className="weddingLineItems">
                {categoryAssets.map((asset) =>
                  editingAssetId === asset.id ? (
                    <AssetEntryForm
                      key={asset.id}
                      initialDraft={assetToDraft(asset)}
                      onSubmit={(draft) => handleUpdate(asset.id, draft)}
                      onCancel={() => setEditingAssetId(null)}
                      submitting={submitting}
                      t={t}
                    />
                  ) : (
                    <div className="weddingLineItem" key={asset.id}>
                      <SummaryRow
                        label={`${asset.name} — ${t(assetSubtypeLabelKey(asset.category, asset.subtype))}`}
                        value={asset.value != null ? formatSgd(asset.value) : asset.strengthRating != null ? `${asset.strengthRating}/5` : "—"}
                      />
                      <div className="settingsActions">
                        <button type="button" className="miniButton" onClick={() => setEditingAssetId(asset.id)} aria-label={t("assetProfile.form.edit")}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" className="miniButton danger" onClick={() => handleDelete(asset.id)} aria-label={t("assetProfile.form.delete")}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p>{t("assetProfile.emptyCategory")}</p>
            )}

            {addingCategory === category ? (
              <AssetEntryForm
                initialDraft={blankAssetDraft(category)}
                onSubmit={handleCreate}
                onCancel={() => setAddingCategory(null)}
                submitting={submitting}
                t={t}
              />
            ) : (
              <button type="button" className="secondaryButton" onClick={() => setAddingCategory(category)}>
                <Plus size={15} />
                {t("assetProfile.form.addToCategory")}
              </button>
            )}
          </SettingsCard>
        );
      })}
    </Screen>
  );
}

function assetToDraft(asset) {
  const blank = blankAssetDraft(asset.category);
  return {
    ...blank,
    subtype: asset.subtype,
    name: asset.name,
    value: asset.value != null ? String(asset.value) : "",
    strengthRating: asset.strengthRating != null ? String(asset.strengthRating) : "3",
    notes: asset.notes ?? "",
    details: { ...blank.details, ...(asset.details ?? {}) },
  };
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

function Screen({ children, className }) {
  return (
    <motion.div className={className ? `screen ${className}` : "screen"} {...screenMotion}>
      {children}
    </motion.div>
  );
}

export default function App() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState("checking"); // "checking" | "authenticated" | "redirecting"
  const [authUser, setAuthUser] = useState(null);
  // True only once the real fetched profile/preferences have actually
  // landed in state (setPreferences below) - `authStatus` alone flips to
  // "authenticated" before that async chain finishes, and `preferences`
  // is still the initial defaultPreferences (displayName "Karina") during
  // that gap. Found via live verification: the debounced persist effect
  // used to fire on authStatus alone, genuinely PUTting the stale default
  // name to the server on every fresh signup/login before a second,
  // correct PUT landed moments later.
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  // Only recognizes ?screen=familyCfo today - the one real deep link this
  // app has, used by /grants redirecting into the SPA (see app/grants/
  // page.jsx). Not a general-purpose deep-linking system.
  const [activeScreen, setActiveScreen] = useState(() => {
    if (typeof window === "undefined") return screens.HOME;
    const requested = new URLSearchParams(window.location.search).get("screen");
    return requested === "familyCfo" ? screens.FAMILY_CFO : screens.HOME;
  });
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
  const [mirrorChatSeed, setMirrorChatSeed] = useState(null);
  // A real, editable starter message for the Other-goal planner (e.g. from
  // Goal Marketplace's "Family & Kids" quick start) - unlike
  // mirrorChatSeed, this pre-fills the input for the customer to review
  // and edit, never auto-submits on its own.
  const [otherGoalSeed, setOtherGoalSeed] = useState(null);
  const [jointDebateViewId, setJointDebateViewId] = useState(null);
  const preferencesSyncTimer = useRef(null);

  const t = useMemo(() => makeTranslator(language), [language]);
  const effectiveTheme = getEffectiveTheme(preferences.theme, systemTheme);
  const displayName = getDisplayName(preferences.displayName);

  // Real auth gate: resolves who's logged in before anything reads a
  // localStorage key, since those keys are namespaced by the real userId
  // (storageKey()) - reading them before this resolves would read/write the
  // wrong (or no) namespace. Redirects to /login on 401 rather than falling
  // through to defaultPreferences.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((user) => {
        if (cancelled) return;
        setCurrentSessionUserId(user.id);
        setAuthUser(user);
        setAuthStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setAuthStatus("redirecting");
        router.push("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let cancelled = false;

    (async () => {
    const storedLanguage = window.localStorage.getItem(storageKey("futureos-language"));
    if (storedLanguage && locales[storedLanguage]) setLanguage(storedLanguage);
    const localPreferences = safeJsonParse(window.localStorage.getItem(storageKey("futureos-preferences")), null);
    // The server copy is the cross-device source of truth once one exists (a second
    // device/login should see real data, not its own empty localStorage cache) -
    // local-only data is what seeds the very first server write, via the
    // persistence effect further below.
    let savedPreferences = localPreferences;
    try {
      const response = await fetch("/api/preferences");
      if (response.ok) {
        const { data } = await response.json();
        if (data) savedPreferences = data;
      }
    } catch {
      // Offline/unreachable - fall back to whatever this device has cached.
    }
    // The real income_entries table (lib/income-store.js) is the source of
    // truth for income history, not the generic preferences blob - fetched
    // separately and always wins over whatever's cached there, same
    // reasoning as goalLedger/escalationHistory below.
    let fetchedIncomeHistory = savedPreferences?.incomeHistory ?? [];
    try {
      const incomeResponse = await fetch("/api/income/entries");
      if (incomeResponse.ok) {
        const { entries } = await incomeResponse.json();
        if (Array.isArray(entries)) fetchedIncomeHistory = entries;
      }
    } catch {
      // Offline/unreachable - fall back to whatever was cached in preferences.
    }
    // Same reasoning as fetchedIncomeHistory above, mirrored for the
    // expense side (lib/expense-store.js).
    let fetchedExpenseHistory = savedPreferences?.expenseHistory ?? [];
    try {
      const expenseResponse = await fetch("/api/expense/entries");
      if (expenseResponse.ok) {
        const { entries } = await expenseResponse.json();
        if (Array.isArray(entries)) fetchedExpenseHistory = entries;
      }
    } catch {
      // Offline/unreachable - fall back to whatever was cached in preferences.
    }
    // Same reasoning as fetchedIncomeHistory above: the real `assets` table
    // (lib/asset-store.js) is the source of truth, not the generic
    // preferences blob.
    let fetchedAssets = savedPreferences?.assets ?? [];
    try {
      const assetsResponse = await fetch("/api/assets");
      if (assetsResponse.ok) {
        const { assets: fetched } = await assetsResponse.json();
        if (Array.isArray(fetched)) fetchedAssets = fetched;
      }
    } catch {
      // Offline/unreachable - fall back to whatever was cached in preferences.
    }
    // Runs Mirror's real outcome-resolution job (lib/mirror-outcome-resolver.js,
    // no cron infra in this app - same recompute-on-read pattern as
    // follow-through/strategic-balance) on every real app load, and caches the
    // result so computeGuardianReputation reads the same number everywhere.
    let fetchedMirrorOutcomeStats = savedPreferences?.mirrorOutcomeStats ?? null;
    try {
      const outcomesResponse = await fetch("/api/mirror/outcomes");
      if (outcomesResponse.ok) fetchedMirrorOutcomeStats = await outcomesResponse.json();
    } catch {
      // Offline/unreachable - fall back to whatever was cached in preferences.
    }
    // Same real-accountability caching pattern as mirrorOutcomeStats above,
    // for confirmed investment picks (app/api/investment/outcomes).
    let fetchedInvestmentOutcomeStats = savedPreferences?.investmentOutcomeStats ?? null;
    try {
      const investmentOutcomesResponse = await fetch("/api/investment/outcomes");
      if (investmentOutcomesResponse.ok) fetchedInvestmentOutcomeStats = await investmentOutcomesResponse.json();
    } catch {
      // Offline/unreachable - fall back to whatever was cached in preferences.
    }
    if (cancelled) return;
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
      incomeHistory: fetchedIncomeHistory,
      expenseHistory: fetchedExpenseHistory,
      assets: fetchedAssets,
      mirrorOutcomeStats: fetchedMirrorOutcomeStats,
      investmentOutcomeStats: fetchedInvestmentOutcomeStats,
      // The authenticated account's real display name seeds every fresh
      // login (no more global "Karina" hardcode) - a customer's own edit in
      // Settings (still stored in preferences.displayName) always wins once
      // one exists.
      displayName: savedPreferences?.displayName || authUser?.displayName || defaultPreferences.displayName,
    };
    setPreferences(storedPreferences);
    setPreferencesLoaded(true);
    setSimulatorInputs(
      mergeDefaults(
        getSimulatorDefaultsFromProfile(getUserProfile(storedPreferences), getCustomGoals(storedPreferences)),
        safeJsonParse(window.localStorage.getItem(storageKey("futureos-simulator-inputs")), null)
      )
    );
    setSimulatorRan(safeJsonParse(window.localStorage.getItem(storageKey("futureos-simulator-ran")), false));
    setSimulatorApplied(safeJsonParse(window.localStorage.getItem(storageKey("futureos-simulator-applied")), false));
    setSimulatorActionStates(
      mergeDefaults(
        defaultSimulatorActionStates,
        safeJsonParse(window.localStorage.getItem(storageKey("futureos-simulator-actions")), null)
      )
    );
    const savedMemory = safeJsonParse(window.localStorage.getItem(storageKey("futureos-guardian-memory")), null);
    if (Array.isArray(savedMemory) && savedMemory.length > 0) {
      setMemoryEvents(savedMemory);
    }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, authUser]);

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
    document.documentElement.lang = language;
    if (authStatus !== "authenticated") return;
    window.localStorage.setItem(storageKey("futureos-language"), language);
  }, [language, authStatus]);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    if (authStatus !== "authenticated") return;
    // Also wait for the real fetched preferences to have landed, not just
    // authStatus - otherwise this fires while `preferences` is still the
    // initial defaultPreferences (displayName "Karina") during the gap
    // before the async profile/preferences load finishes, genuinely
    // persisting the stale default to the server and localStorage.
    if (!preferencesLoaded) return;
    window.localStorage.setItem(storageKey("futureos-preferences"), JSON.stringify(preferences));

    // Debounced server sync so a login on a different device sees real data
    // instead of that device's own empty cache - localStorage write above stays
    // instant, this just mirrors it without a network round-trip per keystroke.
    if (preferencesSyncTimer.current) clearTimeout(preferencesSyncTimer.current);
    preferencesSyncTimer.current = setTimeout(() => {
      fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      }).catch(() => {});
    }, 1000);
  }, [preferences, effectiveTheme, authStatus, preferencesLoaded]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    window.localStorage.setItem(storageKey("futureos-simulator-inputs"), JSON.stringify(simulatorInputs));
  }, [simulatorInputs, authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    window.localStorage.setItem(storageKey("futureos-simulator-ran"), JSON.stringify(simulatorRan));
  }, [simulatorRan, authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    window.localStorage.setItem(storageKey("futureos-simulator-applied"), JSON.stringify(simulatorApplied));
  }, [simulatorApplied, authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    window.localStorage.setItem(storageKey("futureos-simulator-actions"), JSON.stringify(simulatorActionStates));
  }, [simulatorActionStates, authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    window.localStorage.setItem(storageKey("futureos-guardian-memory"), JSON.stringify(memoryEvents));
  }, [memoryEvents, authStatus]);

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
    window.localStorage.removeItem(storageKey("futureos-preferences"));
    window.localStorage.removeItem(storageKey("futureos-simulator-inputs"));
    window.localStorage.removeItem(storageKey("futureos-simulator-ran"));
    window.localStorage.removeItem(storageKey("futureos-simulator-applied"));
    window.localStorage.removeItem(storageKey("futureos-simulator-actions"));
    window.localStorage.removeItem(storageKey("futureos-guardian-memory"));
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
    simulatorActionStates,
    successStates,
    setSuccessStates,
    memoryEvents,
    setMemoryEvents,
    setLoanPlannerInitialPurpose,
    setMirrorChatSeed,
    setJointDebateViewId,
  };

  const exploreChatScreen = (
    <MirrorChatScreen
      {...shared}
      simulatorInputs={simulatorInputs}
      mirrorChatSeed={mirrorChatSeed}
      onConsumeMirrorChatSeed={() => setMirrorChatSeed(null)}
      initialView="chat"
    />
  );

  const currentScreen = {
    [screens.HOME]: <TodayScreen {...shared} />,
    [screens.HOME_FULL]: <HomeDashboard {...shared} />,
    [screens.LIFE_GRAPH]: <LifeGraph {...shared} />,
    [screens.RELATIONSHIP_LEDGER]: <RelationshipLedgerScreen {...shared} simulatorActionStates={simulatorActionStates} />,
    [screens.DECISION_VERDICT]: (
      <DecisionVerdictScreen t={t} setActiveScreen={setActiveScreen} language={language} profile={getUserProfile(preferences)} />
    ),
    [screens.DECODE_DOCUMENT]: <DecodeDocumentScreen t={t} setActiveScreen={setActiveScreen} language={language} />,
    [screens.CHANGE_LEDGER]: <ChangeLedgerScreen t={t} setActiveScreen={setActiveScreen} backTo={screens.LIFE_GRAPH} />,
    [screens.MEMORY_LENS]: <MemoryLensScreen t={t} setActiveScreen={setActiveScreen} />,
    [screens.FUTURE_FIELD]: (
      <FutureFieldCanvas t={t} setActiveScreen={setActiveScreen} language={language} domain="home" backTo={screens.MIRROR} />
    ),
    [screens.HOME_HORIZON]: <HomeHorizon t={t} setActiveScreen={setActiveScreen} />,
    [screens.EMERGENCY_RUNWAY]: <EmergencyRunway t={t} setActiveScreen={setActiveScreen} />,
    [screens.WEDDING_LIVING_PLAN]: <WeddingContinuousScene t={t} setActiveScreen={setActiveScreen} />,
    [screens.REPAYMENT_PATH]: <DebtGravity t={t} setActiveScreen={setActiveScreen} />,
    [screens.FUTURE_LIFE_TIMELINE]: <FutureDayLoom t={t} setActiveScreen={setActiveScreen} />,
    [screens.TRIP_ORBIT]: <CalendarOrbit t={t} setActiveScreen={setActiveScreen} />,
    [screens.CAPITAL_PATHS]: <CapitalPrism t={t} setActiveScreen={setActiveScreen} />,
    [screens.PROTECTION_ENVELOPE]: <LivingEnvelope t={t} setActiveScreen={setActiveScreen} />,
    [screens.FAMILY_CONSTELLATION]: <PrivateConstellation t={t} setActiveScreen={setActiveScreen} />,
    [screens.FUTURE_COMPARISON]: (
      <FutureComparisonScreen t={t} setActiveScreen={setActiveScreen} language={language} profile={getUserProfile(preferences)} />
    ),
    [screens.SME_CASHFLOW]: <SmeCashflowScreen t={t} setActiveScreen={setActiveScreen} language={language} preferences={preferences} />,
    [screens.ACTIVITY_CHECK]: (
      <ActivityCheckScreen t={t} setActiveScreen={setActiveScreen} language={language} profile={getUserProfile(preferences)} />
    ),
    [screens.FAMILY_TRAVEL]: (
      <FamilyTravelScreen t={t} setActiveScreen={setActiveScreen} language={language} profile={getUserProfile(preferences)} />
    ),
    [screens.SHADOW_ACCOUNT]: <ShadowAccountScreen preferences={preferences} t={t} setActiveScreen={setActiveScreen} />,
    [screens.FAMILY_CFO]: <FamilyCfoScreen t={t} setActiveScreen={setActiveScreen} />,
    [screens.GOAL_MARKETPLACE]: (
      <GoalMarketplaceScreen
        t={t}
        setActiveScreen={setActiveScreen}
        preferences={preferences}
        setPreferences={setPreferences}
        setOtherGoalSeed={setOtherGoalSeed}
      />
    ),
    [screens.PERSONAL_ECONOMY]: <PersonalEconomyScreen t={t} setActiveScreen={setActiveScreen} preferences={preferences} />,
    [screens.DEAL_FINDER]: <DealFinderScreen t={t} setActiveScreen={setActiveScreen} language={language} />,
    [screens.MIRROR]: <ExploreScreen setActiveScreen={setActiveScreen} t={t} />,
    [screens.EXPLORE_CHAT]: exploreChatScreen,
    [screens.JOINT_DEBATE_RESPONSE]: <JointDebateResponseScreen {...shared} debateId={jointDebateViewId} />,
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
    [screens.ASSET_PROFILE]: <AssetProfileScreen {...shared} />,
    [screens.NEED_WEDDING]: <NeedDetailScreen {...shared} type="wedding" />,
    [screens.NEED_HOME]: <NeedDetailScreen {...shared} type="home" />,
    [screens.NEED_RETIREMENT]: <NeedDetailScreen {...shared} type="retirement" />,
    [screens.NEED_OTHER]: (
      <NeedDetailScreen {...shared} type="other" otherGoalSeed={otherGoalSeed} onConsumeOtherGoalSeed={() => setOtherGoalSeed(null)} />
    ),
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
        preferences={preferences}
        simulatorInputs={simulatorInputs}
        simulatorActionStates={simulatorActionStates}
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
    [screens.STRATEGIC_BALANCE]: <StrategicBalanceScreen preferences={preferences} t={t} setActiveScreen={setActiveScreen} />,
    [screens.CROSS_BANK_DATA]: <CrossBankDataScreen t={t} setActiveScreen={setActiveScreen} profile={getUserProfile(preferences)} />,
    [screens.PEER_BENCHMARK]: <PeerBenchmarkScreen preferences={preferences} t={t} setActiveScreen={setActiveScreen} />,
    [screens.LIFE_JOURNEY]: <LifeJourneyScreen setActiveScreen={setActiveScreen} preferences={preferences} t={t} />,
    [screens.PRODUCT_FIT]: (
      <ProductFitScreen
        preferences={preferences}
        setPreferences={setPreferences}
        simulatorInputs={simulatorInputs}
        simulatorActionStates={simulatorActionStates}
        t={t}
        setActiveScreen={setActiveScreen}
      />
    ),
    [screens.PAYNOW]: <QuickActionScreen {...shared} type="paynow" />,
    [screens.SCAN_PAY]: <QuickActionScreen {...shared} type="scanPay" />,
    [screens.FX]: <QuickActionScreen {...shared} type="fx" />,
    [screens.LOADING]: <LoadingScreen messageKey={loadingCopyKey} t={t} />,
  }[activeScreen];

  if (authStatus !== "authenticated") {
    return (
      <main className="stage theme-light">
        <section className="phone" aria-label={t("app.prototypeLabel")}>
          <p style={{ padding: 24 }}>{t("loading.detail")}</p>
        </section>
      </main>
    );
  }

  return (
    <LifeThreadProvider enabled={authStatus === "authenticated"}>
      <PhoneShell
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
        language={language}
        setLanguage={setLanguage}
        theme={effectiveTheme}
        simpleMode={Boolean(preferences.accessibility?.simpleMode)}
        t={t}
      >
        <AnimatePresence mode="wait">{currentScreen}</AnimatePresence>
      </PhoneShell>
    </LifeThreadProvider>
  );
}

