"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Download,
  FileText,
  Globe2,
  HeartHandshake,
  Home,
  Info,
  Landmark,
  LineChart,
  LockKeyhole,
  LogOut,
  MonitorCog,
  Moon,
  QrCode,
  RotateCcw,
  ScanLine,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import en from "../locales/en.json";
import ms from "../locales/ms.json";
import ta from "../locales/ta.json";
import zh from "../locales/zh.json";

const screens = {
  HOME: "home",
  LIFE_GRAPH: "lifeGraph",
  MIRROR: "mirror",
  SIMULATOR: "simulator",
  GUARDIAN: "guardian",
  PROFILE: "profile",
  NEED_WEDDING: "needWedding",
  NEED_HOME: "needHome",
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

const customer = {
  names: "Karina",
  initials: "K",
  income: "SGD 7,500",
  savings: "SGD 85,000",
};

const detectedNeeds = [
  { id: "wedding", titleKey: "needs.wedding", screen: screens.NEED_WEDDING, icon: HeartHandshake },
  { id: "home", titleKey: "needs.home", screen: screens.NEED_HOME, icon: Building2 },
  { id: "emergency", titleKey: "needs.emergency", screen: screens.NEED_EMERGENCY, icon: LockKeyhole },
  { id: "insurance", titleKey: "needs.insurance", screen: screens.NEED_INSURANCE, icon: ShieldCheck },
  { id: "investment", titleKey: "needs.investment", screen: screens.NEED_INVESTMENT, icon: LineChart },
];

const competingGoals = [
  { labelKey: "competingGoals.wedding", stateKey: "wedding", value: 78, icon: HeartHandshake, color: "#d71920" },
  { labelKey: "competingGoals.home", stateKey: "home", value: 92, icon: Building2, color: "#203857" },
  { labelKey: "competingGoals.emergency", stateKey: "emergency", value: 88, icon: LockKeyhole, color: "#0f9f84" },
  { labelKey: "competingGoals.retirement", stateKey: "retirement", value: 84, icon: Landmark, color: "#667085" },
  { labelKey: "competingGoals.family", stateKey: "family", value: 81, icon: Sparkles, color: "#b45309" },
];

const recommendedBalance = [
  { labelKey: "recommendations.weddingBudget", value: "SGD 35,000" },
  { labelKey: "recommendations.monthlySavings", value: "SGD 450" },
  { labelKey: "recommendations.homeTarget", value: "2030" },
  { labelKey: "recommendations.retirementTarget", value: "62" },
  { labelKey: "recommendations.emergencyFund", valueKey: "common.protected" },
];

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
  { id: "emergency", labelKey: "simulator.goals.emergency", icon: LockKeyhole },
  { id: "retirement", labelKey: "simulator.goals.retirement", icon: Landmark },
  { id: "family", labelKey: "simulator.goals.family", icon: Sparkles },
  { id: "investment", labelKey: "simulator.goals.investment", icon: LineChart },
  { id: "business", labelKey: "simulator.goals.business", icon: BriefcaseBusiness },
  { id: "custom", labelKey: "simulator.goals.custom", icon: SlidersHorizontal },
];

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
    categoryKey: "lifeGraph.productFit.categories.savings",
    whyKey: "lifeGraph.productFit.why.ocbc360",
    supportsKey: "lifeGraph.productFit.supports.ocbc360",
    impactKey: "lifeGraph.productFit.impact.ocbc360",
    icon: Banknote,
  },
  {
    id: "monthlySavings",
    name: "OCBC Monthly Savings Account",
    categoryKey: "lifeGraph.productFit.categories.savings",
    whyKey: "lifeGraph.productFit.why.monthlySavings",
    supportsKey: "lifeGraph.productFit.supports.monthlySavings",
    impactKey: "lifeGraph.productFit.impact.monthlySavings",
    icon: Target,
  },
  {
    id: "homeLoan",
    name: "OCBC Home Loan",
    categoryKey: "lifeGraph.productFit.categories.loans",
    whyKey: "lifeGraph.productFit.why.homeLoan",
    supportsKey: "lifeGraph.productFit.supports.homeLoan",
    impactKey: "lifeGraph.productFit.impact.homeLoan",
    icon: Building2,
  },
  {
    id: "roboInvest",
    name: "OCBC RoboInvest",
    categoryKey: "lifeGraph.productFit.categories.wealth",
    whyKey: "lifeGraph.productFit.why.roboInvest",
    supportsKey: "lifeGraph.productFit.supports.roboInvest",
    impactKey: "lifeGraph.productFit.impact.roboInvest",
    icon: LineChart,
  },
  {
    id: "greatTerm",
    name: "GREAT Term Guard",
    categoryKey: "lifeGraph.productFit.categories.insurance",
    whyKey: "lifeGraph.productFit.why.greatTerm",
    supportsKey: "lifeGraph.productFit.supports.greatTerm",
    impactKey: "lifeGraph.productFit.impact.greatTerm",
    icon: ShieldCheck,
  },
  {
    id: "paynowGiro",
    name: "PayNow + GIRO transfers",
    categoryKey: "lifeGraph.productFit.categories.payments",
    whyKey: "lifeGraph.productFit.why.payments",
    supportsKey: "lifeGraph.productFit.supports.payments",
    impactKey: "lifeGraph.productFit.impact.payments",
    icon: CalendarClock,
  },
  {
    id: "ocbc365",
    name: "OCBC 365 Credit Card",
    categoryKey: "lifeGraph.productFit.categories.cards",
    whyKey: "lifeGraph.productFit.why.ocbc365",
    supportsKey: "lifeGraph.productFit.supports.ocbc365",
    impactKey: "lifeGraph.productFit.impact.ocbc365",
    icon: CreditCard,
  },
];

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
    const multiplier = variant === "conservative" ? 0.82 : variant === "balanced" ? 1 : 1.35;
    return [
      [t("simulator.output.fields.weddingBudget"), formatSgd(Math.round(weddingBudget * multiplier))],
      [t("simulator.output.fields.weddingDate"), formatMonthDate(inputs.weddingDate, "12 months")],
      [t("simulator.output.fields.savingsNeeded"), formatSgd(Math.max(0, Math.round(weddingBudget * multiplier - numberValue(inputs.currentSavings, 0) * 0.25)))],
      [t("simulator.output.fields.emergencyImpact"), emergencyImpact],
      [
        t("simulator.output.fields.retirementImpact"),
        variant === "highRisk" ? t("simulator.output.impact.delayed") : t("simulator.output.impact.onTrack"),
      ],
    ];
  }

  if (goalType === "home") {
    const downPayment = numberValue(inputs.targetDownPayment, 150000);
    const progress = Math.min(100, Math.round((numberValue(inputs.currentSavings, 0) / downPayment) * 100));
    return [
      [t("simulator.output.fields.homeTargetYear"), inputs.targetHomeYear || "2030"],
      [t("simulator.output.fields.downPaymentProgress"), `${progress}%`],
      [
        t("simulator.output.fields.mortgageReadiness"),
        variant === "highRisk" ? t("simulator.output.impact.reviewNeeded") : inputs.mortgageReadiness || t("status.preparing"),
      ],
      [t("simulator.output.fields.monthlySavingNeeded"), formatSgd(Math.round(downPayment / 36))],
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

function getDynamicSimulatorScenarios(inputs, t) {
  const goalType = getPrimaryGoal(inputs);
  return [
    {
      id: "conservative",
      titleKey: "simulator.output.scenarios.conservative.title",
      detailKey: "simulator.output.scenarios.conservative.detail",
      score: goalType === "home" ? 84 : 90,
      riskKey: "risk.low",
      riskClass: "Low",
      fields: buildScenarioFields(goalType, inputs, "conservative", t),
    },
    {
      id: "balanced",
      titleKey: "simulator.output.scenarios.balanced.title",
      detailKey: "simulator.output.scenarios.balanced.detail",
      score: goalType === "home" ? 82 : 88,
      riskKey: "risk.low",
      riskClass: "Low",
      fields: buildScenarioFields(goalType, inputs, "balanced", t),
      recommended: true,
    },
    {
      id: "highRisk",
      titleKey: "simulator.output.scenarios.highRisk.title",
      detailKey: "simulator.output.scenarios.highRisk.detail",
      score: 62,
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
  if (primaryType === "home") return Math.round(numberValue(inputs.targetDownPayment, 150000) / 36 / 50) * 50;
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
    id: "wedding-goal",
    year: "2026",
    titleKey: "guardian.memory.events.wedding.title",
    descriptionKey: "guardian.memory.events.wedding.description",
    impactKey: "guardian.memory.events.wedding.impact",
    productKey: "guardian.memory.events.wedding.product",
    actionKey: "guardian.memory.events.wedding.action",
    reasonKey: "guardian.memory.events.wedding.reason",
    dataKey: "guardian.memory.events.wedding.data",
    statusKey: "status.completed",
  },
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
  return {
    ...preferences,
    profileVersion: currentProfileVersion,
    displayName: "Karina",
    profile: defaultProfile,
  };
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

function getWeddingProjection(budget) {
  if (budget <= 35000) {
    return { score: 89, homeYear: 2030, retirementAge: 62, riskKey: "risk.low", color: "#0f9f84" };
  }
  if (budget <= 55000) {
    return { score: 74, homeYear: 2032, retirementAge: 64, riskKey: "risk.medium", color: "#f59e0b" };
  }
  const score = Math.max(52, 89 - Math.round((budget - 35000) / 1400));
  const homeYear = budget >= 80000 ? 2034 : 2033;
  const retirementAge = budget >= 80000 ? 66 : 65;
  return { score, homeYear, retirementAge, riskKey: "risk.high", color: "#d71920" };
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
  if (activeScreen === screens.SIMULATOR) return screens.MIRROR;
  if (
    [
      screens.NEED_WEDDING,
      screens.NEED_HOME,
      screens.NEED_EMERGENCY,
      screens.NEED_INSURANCE,
      screens.NEED_INVESTMENT,
    ].includes(activeScreen)
  ) {
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

function HomeDashboard({ goWithLoading, setActiveScreen, setActiveAccountId, displayName, preferences, t }) {
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [accountInfoModal, setAccountInfoModal] = useState(null);
  const [noticeModal, setNoticeModal] = useState(null);
  const NoticeIcon = noticeModal?.icon;
  const profile = getUserProfile(preferences);
  const customGoals = getCustomGoals(preferences);
  const healthScores = getHealthScores(profile);
  const spendingRisk = getSpendingRisk(profile);
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

  const quickActions = [
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
    {
      id: "customise",
      label: t("homeBanking.quickActions.customise"),
      icon: SlidersHorizontal,
      onClick: () => setCustomiseOpen(true),
      custom: true,
    },
  ];

  const accountDetails = getAccountDetails(profile, customGoals, healthScores, t);
  const accounts = ["savings", "creditCard", "loan", "investments", "insurance", "futureGoal"].map((id) => ({
    id,
    ...accountDetails[id],
  }));

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
                    body: t("homeBanking.notificationsText"),
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

        <section className="bankSection">
          <h2>{t("homeBanking.accountsTitle")}</h2>
          <div className="bankAccountList">
            {accounts.map(({ id, title, value, icon: Icon, infoBody, calculation }) => {
              const hasScoreInfo = value.includes("/") || value.includes("%");
              return (
              <motion.article
                className="bankAccountCard"
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
              >
                <button
                  type="button"
                  className="accountCardTapTarget"
                  data-testid={`account-card-${id}`}
                  aria-label={`${title} ${value}`}
                  onClick={() => {
                    setActiveAccountId(id);
                    setActiveScreen(screens.ACCOUNT_DETAIL);
                  }}
                />
                <span className="bankAccountIcon">
                  <Icon size={18} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{t("homeBanking.availableNow")}</small>
                </div>
                <b>{value}</b>
                {hasScoreInfo ? (
                  <button
                    type="button"
                    className="infoButton accountScoreInfo"
                    aria-label={t("homeBanking.infoLabel", { item: title })}
                    onClick={() =>
                      setAccountInfoModal({
                        title,
                        value,
                        body: infoBody,
                        method: calculation,
                      })
                    }
                  >
                    <Info size={13} />
                  </button>
                ) : (
                  <ChevronRight size={16} />
                )}
              </motion.article>
              );
            })}
          </div>
        </section>

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
            <div className="shortcutPreview">
              {quickActions.slice(0, 3).map(({ label, icon: Icon }) => (
                <span key={label}>
                  <Icon size={15} />
                  {label}
                </span>
              ))}
            </div>
            <button type="button" className="primaryButton" onClick={() => setCustomiseOpen(false)}>
              {t("homeBanking.customiseDone")}
            </button>
          </motion.div>
        </section>
      ) : null}

      {infoModal ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={infoModal.title}>
          <motion.div className="confirmModal" {...screenMotion}>
            <Info size={24} />
            <strong>{infoModal.title}</strong>
            <p>{infoModal.body}</p>
            <div className="proofScore">
              <span>{t("homeBanking.currentScore")}</span>
              <b>{infoModal.value}</b>
            </div>
            <div className="proofBlock">
              <strong>{t("homeBanking.howCalculated")}</strong>
              <p>{infoModal.method}</p>
            </div>
            <ul className="proofList">
              {infoModal.proofKeys.map((key) => (
                <li key={key}>{t(`homeBanking.proof.${key}`)}</li>
              ))}
            </ul>
            <button type="button" className="primaryButton" onClick={() => setInfoModal(null)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
      ) : null}

      {accountInfoModal ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={accountInfoModal.title}>
          <motion.div className="confirmModal" {...screenMotion}>
            <Info size={24} />
            <strong>{accountInfoModal.title}</strong>
            <p>{accountInfoModal.body}</p>
            <div className="proofScore">
              <span>{t("homeBanking.currentScore")}</span>
              <b>{accountInfoModal.value}</b>
            </div>
            <div className="proofBlock">
              <strong>{t("homeBanking.howCalculated")}</strong>
              <p>{accountInfoModal.method}</p>
            </div>
            <button type="button" className="primaryButton" onClick={() => setAccountInfoModal(null)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
      ) : null}

      {noticeModal ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={noticeModal.title}>
          <motion.div className="confirmModal" {...screenMotion}>
            <NoticeIcon size={24} />
            <strong>{noticeModal.title}</strong>
            <p>{noticeModal.body}</p>
            <button type="button" className="primaryButton" onClick={() => setNoticeModal(null)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
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
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={account.title}>
          <motion.div className="confirmModal" {...screenMotion}>
            <Info size={24} />
            <strong>{account.title}</strong>
            <p>{account.infoBody}</p>
            <div className="proofScore">
              <span>{t("homeBanking.currentScore")}</span>
              <b>{account.value}</b>
            </div>
            <div className="proofBlock">
              <strong>{t("homeBanking.howCalculated")}</strong>
              <p>{account.calculation}</p>
            </div>
            <button type="button" className="primaryButton" onClick={() => setDetailInfoOpen(false)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
      ) : null}
    </Screen>
  );
}

function LifeGraph({ goWithLoading, setActiveScreen, preferences, setPreferences, setSimulatorInputs, t }) {
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
  const StrategyIcon = strategyModal?.icon;
  const ProductIcon = productModal?.icon;

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

  return (
    <Screen>
      <Header title={t("lifeGraph.title")} subtitle={t("lifeGraph.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />
      <NoticeBanner text={notice} />

      <section className="recommendationPanel">
        <span className="sectionLabel">{t("lifeGraph.lifeStage")}</span>
        <SummaryRow label={t("profile.detectedStage")} value={detectedStage} />
        <SummaryRow
          label={t("lifeGraph.selectedGoals")}
          value={selectedGoalIds.map((goalId) => getProfileGoalLabel(goalId, customGoals, t)).join(", ")}
        />
      </section>

      <section className="scorePanel">
        <div className="panelHead">
          <span className="sectionLabel">{t("lifeGraph.health.title")}</span>
          <Info size={17} />
        </div>
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
      </section>

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
          {productRecommendations.map((product) => {
            const Icon = product.icon;
            const added = preferences.futurePlanProducts?.includes(product.id);
            return (
              <article className={added ? "productFitCard added" : "productFitCard"} key={product.id}>
                <div className="productFitHead">
                  <span className="iconBubble">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{t(product.categoryKey)}</small>
                  </div>
                  {added ? <CheckCircle2 size={16} /> : null}
                </div>
                <SummaryRow label={t("lifeGraph.productFit.whyLabel")} value={t(product.whyKey)} />
                <SummaryRow label={t("lifeGraph.productFit.supportsLabel")} value={t(product.supportsKey)} />
                <SummaryRow label={t("lifeGraph.productFit.impactLabel")} value={t(product.impactKey)} />
                <div className="buttonPair compactButtons">
                  <button type="button" className="secondaryButton" onClick={() => setProductModal(product)}>
                    {t("lifeGraph.productFit.viewStrategy")}
                  </button>
                  <button type="button" className="primaryButton" onClick={() => addProductToPlan(product)}>
                    {added ? t("status.active") : t("lifeGraph.productFit.addToPlan")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
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

      {infoModal ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t(infoModal.labelKey)}>
          <motion.div className="confirmModal" {...screenMotion}>
            <Info size={24} />
            <strong>{t(infoModal.labelKey)}</strong>
            <div className="proofScore">
              <span>{t("homeBanking.currentScore")}</span>
              <b>{infoModal.value}/100</b>
            </div>
            <SupportList
              title={t("lifeGraph.scoreInfo.title")}
              items={[
                t(`lifeGraph.scoreInfo.${infoModal.id}.meaning`),
                t(`lifeGraph.scoreInfo.${infoModal.id}.method`),
                t(`lifeGraph.scoreInfo.${infoModal.id}.data`),
                t(`lifeGraph.scoreInfo.${infoModal.id}.improve`),
              ]}
            />
            <button type="button" className="primaryButton" onClick={() => setInfoModal(null)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
      ) : null}

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
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={productModal.name}>
          <motion.div className="confirmModal" {...screenMotion}>
            {ProductIcon ? <ProductIcon size={24} /> : null}
            <strong>{productModal.name}</strong>
            <SupportList
              title={t("lifeGraph.productFit.strategyTitle")}
              items={[t(productModal.whyKey), t(productModal.supportsKey), t(productModal.impactKey), t("lifeGraph.productFit.disclaimer")]}
            />
            <button type="button" className="primaryButton" onClick={() => setProductModal(null)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
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
  const level = Number(simulatorInputs.independenceLevel);
  const selectedLevel = independenceLevels.find((item) => item.level === level) ?? independenceLevels[0];
  const customGoals = getCustomGoals(preferences);
  const fieldGroups = getSimulatorFieldGroups(simulatorInputs, t);
  const scenarios = getDynamicSimulatorScenarios(simulatorInputs, t);
  const reasoning = getAgentReasoning(simulatorInputs, t);
  const recommendedScenario = scenarios.find((scenario) => scenario.recommended) ?? scenarios[1] ?? scenarios[0];

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

  return (
    <Screen>
      <Header title={t("simulator.title")} subtitle={t("simulator.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

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
            {simulatorGoalOptions.map(({ id, labelKey, icon: Icon }) => (
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
            ))}
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
              <SummaryRow label={t("simulator.autonomousLock.monthlyLocked")} value={`${formatSgd(getRecommendedMonthlySaving(simulatorInputs))}/month`} />
              <SummaryRow label={t("simulator.autonomousLock.completion")} value={getGoalTargetDisplay(simulatorInputs)} />
              <SummaryRow label={t("simulator.autonomousLock.progress")} value="18%" />
              <div className="approvalCounters">
                <span>{t("simulator.autonomousLock.pause")}</span>
                <span>{t("simulator.autonomousLock.adjust")}</span>
                <span>{t("simulator.autonomousLock.withdrawImpact")}</span>
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
                <span>{t("competingGoals.wedding")}</span>
                <i />
                <span>{t("negotiator.futureGoals")}</span>
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
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={scoreInfoModal.title}>
          <motion.div className="confirmModal" {...screenMotion}>
            <Info size={24} />
            <strong>{scoreInfoModal.title}</strong>
            <div className="proofScore">
              <span>{t("homeBanking.currentScore")}</span>
              <b>{scoreInfoModal.value}</b>
            </div>
            <SupportList
              title={t("lifeGraph.scoreInfo.title")}
              items={[
                t("homeBanking.method.futureScore"),
                t("homeBanking.proof.futureScoreInputs"),
                t("homeBanking.proof.futureScoreWeights"),
                t("homeBanking.proof.futureScoreResult"),
              ]}
            />
            <button type="button" className="primaryButton" onClick={() => setScoreInfoModal(null)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
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
    </Screen>
  );
}

function FutureSelfGuardian({ setActiveScreen, preferences, simulatorInputs, simulatorActionStates, setSimulatorActionStates, t }) {
  const [guardianApplied, setGuardianApplied] = useState(false);
  const [protectedScoreInfoOpen, setProtectedScoreInfoOpen] = useState(false);
  const [memoryEvents, setMemoryEvents] = useState(defaultGuardianMemoryEvents);
  const [selectedMemoryEvent, setSelectedMemoryEvent] = useState(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [lastApprovedServiceId, setLastApprovedServiceId] = useState(null);
  const level = Number(simulatorInputs.independenceLevel);
  const selectedLevel = independenceLevels.find((item) => item.level === level) ?? independenceLevels[0];
  const reasoning = getAgentReasoning(simulatorInputs, t);
  const primaryType = getPrimaryGoal(simulatorInputs);
  const goalName = getGoalLabel(primaryType === "car" ? "custom" : primaryType, simulatorInputs, t);
  const selectedGoalIds = getSelectedGoalIds(simulatorInputs);
  const profile = getUserProfile(preferences);
  const displayName = getDisplayName(preferences.displayName);
  const visibleActionCards = simulatorActionCards.filter(({ id }) => {
    if (id === "mortgageReadiness") return selectedGoalIds.includes("home");
    if (id === "insuranceReview") return selectedGoalIds.includes("family") || selectedGoalIds.includes("home");
    if (id === "investmentPlan") return selectedGoalIds.includes("investment") || selectedGoalIds.includes("retirement");
    return true;
  });
  const approvedActionCount = visibleActionCards.filter(({ id }) => simulatorActionStates[id] === "approved").length;
  const approvedServiceCount = ocbcServiceActions.filter(({ id }) => simulatorActionStates[id] === "approved").length;
  const futureScore = approvedActionCount + approvedServiceCount > 0 ? 89 : 86;
  const aiConfidence = 96;
  const activeGoalCount = 8;
  const monthlySaving = formatSgd(getRecommendedMonthlySaving(simulatorInputs));
  const targetAmount = formatSgd(getGoalTargetAmount(simulatorInputs));
  const activeGoalText = reasoning.goals || goalName;
  const financialStrategyItems = [
    {
      id: "savings",
      labelKey: "guardian.strategy.savings",
      value: `${monthlySaving}/month`,
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
  const reportItems = [
    { labelKey: "guardian.report.goalProgress", value: t("guardian.report.goalProgressValue", { goal: goalName }) },
    { labelKey: "guardian.report.scoreChange", value: t("guardian.report.scoreChangeValue", { score: futureScore }) },
    { labelKey: "guardian.report.newInsights", value: reasoning.risk },
    { labelKey: "guardian.report.aiRecommendations", value: reasoning.action },
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
  ];

  useEffect(() => {
    const savedMemory = safeJsonParse(window.localStorage.getItem("futureos-guardian-memory"), null);
    if (Array.isArray(savedMemory) && savedMemory.length > 0) {
      setMemoryEvents(savedMemory);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("futureos-guardian-memory", JSON.stringify(memoryEvents));
  }, [memoryEvents]);

  function setGuardianActionState(actionId, state) {
    setGuardianApplied(false);
    setLastApprovedServiceId(null);
    setSimulatorActionStates((current) => ({ ...current, [actionId]: state }));
  }

  function approveServiceAction(actionId) {
    setGuardianApplied(false);
    setLastApprovedServiceId(actionId);
    setSimulatorActionStates((current) => ({ ...current, [actionId]: "approved" }));
  }

  const protectedScoreModal = protectedScoreInfoOpen ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t("guardian.protectedScore")}>
          <motion.div className="confirmModal" {...screenMotion}>
            <Info size={24} />
            <strong>{t("guardian.protectedScore")}</strong>
            <div className="proofScore">
              <span>{t("homeBanking.currentScore")}</span>
              <b>{futureScore}/100</b>
            </div>
            <SupportList
              title={t("lifeGraph.scoreInfo.title")}
              items={[
                t("guardian.protectedScoreInfo.meaning"),
                t("guardian.protectedScoreInfo.method"),
                t("guardian.protectedScoreInfo.data"),
                t("guardian.protectedScoreInfo.improve"),
              ]}
            />
            <button type="button" className="primaryButton" onClick={() => setProtectedScoreInfoOpen(false)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
      ) : null;

  const memoryDetailModal = selectedMemoryEvent ? (
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={t(selectedMemoryEvent.titleKey)}>
          <motion.div className="confirmModal memoryDetailModal" {...screenMotion}>
            <CalendarClock size={24} />
            <strong>{t(selectedMemoryEvent.titleKey)}</strong>
            <div className="memoryModalMeta">
              <span>{selectedMemoryEvent.year}</span>
              <b>{t(selectedMemoryEvent.statusKey)}</b>
            </div>
            <SummaryRow label={t("guardian.memory.modal.guardianAction")} value={t(selectedMemoryEvent.actionKey)} />
            <SummaryRow label={t("guardian.memory.modal.reason")} value={t(selectedMemoryEvent.reasonKey, { customer: displayName })} />
            <SummaryRow label={t("guardian.memory.modal.dataUsed")} value={t(selectedMemoryEvent.dataKey)} />
            <SummaryRow label={t("guardian.memory.modal.product")} value={t(selectedMemoryEvent.productKey)} />
            <SummaryRow label={t("guardian.memory.modal.futureScoreImpact")} value={t(selectedMemoryEvent.impactKey)} />
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
              <SummaryRow label={t("simulator.autonomousLock.monthlyLocked")} value={`${monthlySaving}/month`} />
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
          {visibleActionCards.map(({ id, titleKey, icon: Icon }) => {
            const state = simulatorActionStates[id] ?? "pending";
            const detail = getSimulatorActionDetail(id, simulatorInputs, level, t);
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
            {competingGoals.map(({ labelKey, value, icon: Icon, color }) => (
              <span key={labelKey}>
                <Icon size={14} style={{ color }} />
                {t(labelKey)}
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
          <SummaryRow label={t("guardian.reasoning.situationAnalysed")} value={reasoning.situation} />
          <SummaryRow label={t("guardian.reasoning.risksDetected")} value={reasoning.risk} />
          <SummaryRow label={t("guardian.reasoning.tradeoffsConsidered")} value={t("guardian.reasoning.tradeoffsValue", { goals: activeGoalText })} />
          <SummaryRow label={t("guardian.reasoning.selectedStrategy")} value={reasoning.recommendation} />
          {recommendedBalance.map((item) => (
            <SummaryRow
              key={item.labelKey}
              label={t(item.labelKey)}
              value={item.valueKey ? t(item.valueKey) : item.value}
            />
          ))}
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
                  aria-label={t("guardian.memory.openEvent", { event: t(event.titleKey) })}
                >
                  <span className="memoryYear">{event.year}</span>
                  <i aria-hidden="true" />
                  <div>
                    <strong>{t(event.titleKey)}</strong>
                    <small>{t(event.descriptionKey)}</small>
                    <span className="memoryImpact">
                      {t("guardian.memory.impact")}: {t(event.impactKey)}
                    </span>
                    <span className="memoryProduct">
                      {t("guardian.memory.productUsed")}: {t(event.productKey)}
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
          {reportItems.map((item) => (
            <SummaryRow key={item.labelKey} label={t(item.labelKey)} value={item.value} />
          ))}
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
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t("guardian.title")} subtitle={t("guardian.hub.subtitle")} />
      <BackHomeButton setActiveScreen={setActiveScreen} t={t} />

      <section className="guardianHubStatus">
        <div className="panelHead">
          <span className="sectionLabel">{t("guardian.sections.status")}</span>
          <ShieldCheck size={17} />
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
            <small>{t("guardian.status.aiConfidence")}</small>
            <strong>{aiConfidence}%</strong>
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
    </Screen>
  );
}

function NeedDetailScreen({ type, setActiveScreen, successStates, setSuccessStates, weddingBudget, setWeddingBudget, t }) {
  const success = Boolean(successStates[type]);
  const setSuccess = () => setSuccessStates((current) => ({ ...current, [type]: true }));

  if (type === "wedding") {
    const projection = getWeddingProjection(weddingBudget);
    return (
      <Screen>
        <Header title={t("needDetails.wedding.title")} subtitle={t("needDetails.wedding.subtitle")} />
        <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />
        <SuccessBanner show={success} text={t("needDetails.wedding.success")} />
        <section className="needHeroCard">
          <span className="sectionLabel">{t("needDetails.wedding.sliderLabel")}</span>
          <strong>{formatSgd(weddingBudget)}</strong>
          <input
            className="wideSlider"
            type="range"
            min="20000"
            max="100000"
            step="5000"
            value={weddingBudget}
            onChange={(event) => setWeddingBudget(Number(event.target.value))}
            aria-label={t("needDetails.wedding.sliderLabel")}
          />
        </section>
        <section className="metricGrid">
          <MetricCard label={t("needDetails.wedding.currentBudget")} value="SGD 80,000" />
          <MetricCard label={t("needDetails.wedding.recommendedBudget")} value="SGD 35,000" />
          <MetricCard label={t("needDetails.wedding.monthlySaving")} value="SGD 450" />
          <MetricCard label={t("needDetails.wedding.overspendImpact")} value={t("needDetails.wedding.delay")} />
        </section>
        <section className="recommendationPanel">
          <span className="sectionLabel">{t("needDetails.liveProjection")}</span>
          <SummaryRow label={t("mirror.futureScore")} value={`${projection.score}/100`} />
          <SummaryRow label={t("mirror.homePurchase")} value={projection.homeYear} />
          <SummaryRow label={t("mirror.retirementAge")} value={projection.retirementAge} />
          <SummaryRow label={t("mirror.risk")} value={t(projection.riskKey)} />
        </section>
        <button type="button" className="primaryButton" onClick={setSuccess}>
          {t("needDetails.wedding.cta")}
          <Check size={18} />
        </button>
      </Screen>
    );
  }

  const content = {
    home: <HomeNeedContent success={success} setSuccess={setSuccess} t={t} setActiveScreen={setActiveScreen} />,
    emergency: <EmergencyNeedContent success={success} setSuccess={setSuccess} t={t} setActiveScreen={setActiveScreen} />,
    insurance: <InsuranceNeedContent success={success} setSuccess={setSuccess} t={t} setActiveScreen={setActiveScreen} />,
    investment: <InvestmentNeedContent success={success} setSuccess={setSuccess} t={t} setActiveScreen={setActiveScreen} />,
  }[type];

  return content;
}

function HomeNeedContent({ success, setSuccess, t, setActiveScreen }) {
  return (
    <Screen>
      <Header title={t("needDetails.home.title")} subtitle={t("needDetails.home.subtitle")} />
      <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />
      <SuccessBanner show={success} text={t("needDetails.home.success")} />
      <ProgressPanel label={t("needDetails.home.score")} value={72} t={t} />
      <section className="metricGrid">
        <MetricCard label={t("needDetails.home.targetYear")} value="2030" />
        <MetricCard label={t("needDetails.home.currentFund")} value="SGD 42,000" />
        <MetricCard label={t("needDetails.home.targetDownPayment")} value="SGD 120,000" />
        <MetricCard label={t("needDetails.home.monthlyRequired")} value="SGD 1,850" />
      </section>
      <SupportList
        title={t("needDetails.ocbcSupport")}
        items={[
          t("needDetails.home.support1"),
          t("needDetails.home.support2"),
          t("needDetails.home.support3"),
          t("needDetails.home.support4"),
        ]}
      />
      <button type="button" className="primaryButton" onClick={setSuccess}>
        {t("needDetails.home.cta")}
        <Check size={18} />
      </button>
    </Screen>
  );
}

function EmergencyNeedContent({ success, setSuccess, t, setActiveScreen }) {
  return (
    <Screen>
      <Header title={t("needDetails.emergency.title")} subtitle={t("needDetails.emergency.subtitle")} />
      <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />
      <SuccessBanner show={success} text={t("needDetails.emergency.success")} />
      <ProgressPanel label={t("needDetails.emergency.score")} value={80} t={t} />
      <section className="metricGrid">
        <MetricCard label={t("needDetails.emergency.currentFund")} value="SGD 18,000" />
        <MetricCard label={t("needDetails.emergency.recommendedFund")} value="SGD 30,000" />
        <MetricCard label={t("needDetails.emergency.currentCoverage")} value={t("needDetails.emergency.months36")} />
        <MetricCard label={t("needDetails.emergency.recommendedCoverage")} value={t("needDetails.emergency.months6")} />
        <MetricCard label={t("needDetails.emergency.status")} value={t("needDetails.emergency.statusValue")} wide />
      </section>
      <SupportList
        title={t("needDetails.aiRecommendations")}
        items={[
          t("needDetails.emergency.rec1"),
          t("needDetails.emergency.rec2"),
          t("needDetails.emergency.rec3"),
        ]}
      />
      <button type="button" className="primaryButton" onClick={setSuccess}>
        {t("needDetails.emergency.cta")}
        <Check size={18} />
      </button>
    </Screen>
  );
}

function InsuranceNeedContent({ success, setSuccess, t, setActiveScreen }) {
  const [reviewScheduled, setReviewScheduled] = useState(success);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        <MetricCard label={t("needDetails.insurance.currentScore")} value="58/100" t={t} />
        <MetricCard label={t("needDetails.insurance.recommendedScore")} value="85/100" t={t} />
        <MetricCard label={t("needDetails.insurance.life")} value={t("needDetails.insurance.notReviewed")} />
        <MetricCard label={t("needDetails.insurance.health")} value={t("needDetails.insurance.basic")} />
        <MetricCard label={t("needDetails.insurance.critical")} value={t("needDetails.insurance.gap")} />
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

function InvestmentNeedContent({ success, setSuccess, t, setActiveScreen }) {
  const plans = [
    { title: t("needDetails.investment.conservative"), detail: t("needDetails.investment.lowerRisk"), age: "65" },
    { title: t("needDetails.investment.balanced"), detail: t("status.recommended"), age: "62", recommended: true },
    { title: t("needDetails.investment.growth"), detail: t("needDetails.investment.higherRisk"), age: "60" },
  ];

  return (
    <Screen>
      <Header title={t("needDetails.investment.title")} subtitle={t("needDetails.investment.subtitle")} />
      <BackLifeGraphButton setActiveScreen={setActiveScreen} t={t} />
      <SuccessBanner show={success} text={t("needDetails.investment.success")} />
      <section className="metricGrid">
        <MetricCard label={t("needDetails.investment.currentAmount")} value="SGD 15,000" />
        <MetricCard label={t("needDetails.investment.monthlyInvestment")} value="SGD 500" />
        <MetricCard label={t("needDetails.investment.riskProfile")} value={t("needDetails.investment.balanced")} />
        <MetricCard label={t("needDetails.investment.retirementAge")} value="62" />
        <MetricCard label={t("needDetails.investment.gap")} value="SGD 180,000" wide />
      </section>
      <section className="projectionGrid">
        {plans.map((plan) => (
          <article className={plan.recommended ? "projectionCard recommended" : "projectionCard"} key={plan.title}>
            <strong>{plan.title}</strong>
            <span>{plan.detail}</span>
            <b>{t("needDetails.investment.retirementAt", { age: plan.age })}</b>
          </article>
        ))}
      </section>
      <button type="button" className="primaryButton" onClick={setSuccess}>
        {t("needDetails.investment.cta")}
        <Check size={18} />
      </button>
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
            {notificationHistory.map(({ id, icon: Icon, tone, title, detail, time, status }) => (
              <button
                type="button"
                className={`notificationHistoryItem ${tone}`}
                key={id}
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
            ))}
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
          <button type="button" className="miniButton" onClick={() => setNotice(t("settings.privacy.manageNotice"))}>
            <Settings size={15} />
            {t("settings.privacy.managePermissions")}
          </button>
          <button type="button" className="miniButton danger" onClick={withdrawConsent}>
            <X size={15} />
            {t("settings.privacy.withdrawConsent")}
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

function ProgressPanel({ label, value, t }) {
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
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={label}>
          <motion.div className="confirmModal" {...screenMotion}>
            <Info size={24} />
            <strong>{label}</strong>
            <p>{t("scoreInfo.body", { item: label })}</p>
            <div className="proofScore">
              <span>{t("homeBanking.currentScore")}</span>
              <b>{value}%</b>
            </div>
            <div className="proofBlock">
              <strong>{t("homeBanking.howCalculated")}</strong>
              <p>{t("scoreInfo.method")}</p>
            </div>
            <button type="button" className="primaryButton" onClick={() => setInfoOpen(false)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
      ) : null}
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
        <section className="modalBackdrop" role="dialog" aria-modal="true" aria-label={label}>
          <motion.div className="confirmModal" {...screenMotion}>
            <Info size={24} />
            <strong>{label}</strong>
            <p>{t("scoreInfo.body", { item: label })}</p>
            <div className="proofScore">
              <span>{t("homeBanking.currentScore")}</span>
              <b>{value}</b>
            </div>
            <div className="proofBlock">
              <strong>{t("homeBanking.howCalculated")}</strong>
              <p>{t("scoreInfo.method")}</p>
            </div>
            <button type="button" className="primaryButton" onClick={() => setInfoOpen(false)}>
              {t("homeBanking.gotIt")}
            </button>
          </motion.div>
        </section>
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
  const [weddingBudget, setWeddingBudget] = useState(80000);
  const [successStates, setSuccessStates] = useState({});
  const [activeAccountId, setActiveAccountId] = useState("savings");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [systemTheme, setSystemTheme] = useState("light");
  const [simulatorInputs, setSimulatorInputs] = useState(defaultSimulatorInputs);
  const [simulatorRan, setSimulatorRan] = useState(false);
  const [simulatorApplied, setSimulatorApplied] = useState(false);
  const [simulatorActionStates, setSimulatorActionStates] = useState(defaultSimulatorActionStates);

  const t = useMemo(() => makeTranslator(language), [language]);
  const effectiveTheme = getEffectiveTheme(preferences.theme, systemTheme);
  const displayName = getDisplayName(preferences.displayName);

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem("futureos-language");
    if (storedLanguage && locales[storedLanguage]) setLanguage(storedLanguage);
    const savedPreferences = safeJsonParse(window.localStorage.getItem("futureos-preferences"), null);
    const storedPreferences = applyProfileMigration(
      mergeDefaults(defaultPreferences, savedPreferences),
      savedPreferences
    );
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
  }, []);

  useEffect(() => {
    setSimulatorInputs((current) => ({
      ...getSimulatorDefaultsFromProfile(getUserProfile(preferences), getCustomGoals(preferences)),
      situation: current.situation,
      independenceLevel: current.independenceLevel,
      plannedSpending: current.plannedSpending,
      weddingBudget: current.weddingBudget,
      weddingDate: current.weddingDate,
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
    setWeddingBudget(80000);
    setSuccessStates({});
    setActiveAccountId("savings");
    setSimulatorInputs(getSimulatorDefaultsFromProfile(defaultProfile, []));
    setSimulatorRan(false);
    setSimulatorApplied(false);
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
      customer: { ...customer, names: displayName, initials: getInitials(displayName) },
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
    weddingBudget,
    setWeddingBudget,
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
    [screens.SIMULATOR]: mirrorSimulatorScreen,
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
      />
    ),
    [screens.NEED_WEDDING]: <NeedDetailScreen {...shared} type="wedding" />,
    [screens.NEED_HOME]: <NeedDetailScreen {...shared} type="home" />,
    [screens.NEED_EMERGENCY]: <NeedDetailScreen {...shared} type="emergency" />,
    [screens.NEED_INSURANCE]: <NeedDetailScreen {...shared} type="insurance" />,
    [screens.NEED_INVESTMENT]: <NeedDetailScreen {...shared} type="investment" />,
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

