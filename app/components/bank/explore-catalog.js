// The Explore capability catalog (Future Bank, Part 6). A COMPLETE, always-
// visible vertical directory - not a 3x3 grid, not a card wall, not hidden
// inside a <details>. Pure data so an "Explore visibility" test can assert
// every Studio and every core bank capability is listed.
//
// Each entry: what it is, the problem it solves, what bank data it reads,
// what it produces, and one CTA (a screen id passed to setActiveScreen).

export const EXPLORE_GROUPS = [
  {
    id: "bank_now",
    title: "Bank now",
    entries: [
      { id: "accounts", name: "Accounts", problem: "See every account and its real balance.", reads: ["accounts", "transactions"], result: "Posted, available and pending balance per account.", cta: "home" },
      { id: "pay", name: "Pay", problem: "Send money or pay a bill.", reads: ["accounts"], result: "A transfer between your own accounts, or an honest 'not connected' for external.", cta: "paynow" },
      { id: "scan_pay", name: "Scan & Pay", problem: "Pay a merchant by QR.", reads: ["accounts"], result: "A scan flow (no real rail yet - shown honestly).", cta: "scanPay" },
      { id: "transfer", name: "Transfer", problem: "Move money between your accounts.", reads: ["accounts"], result: "A real double-entry ledger move.", cta: "paynow" },
      { id: "fx", name: "FX", problem: "Check indicative foreign-exchange rates.", reads: ["accounts"], result: "Indicative rates (not a live quote).", cta: "fx" },
      { id: "cards", name: "Cards", problem: "See card balance and repay it.", reads: ["accounts", "transactions"], result: "Card owed + a repayment that reduces both sides.", cta: "accountDetail" },
      { id: "transactions", name: "Transactions", problem: "Search and review what you spent.", reads: ["transactions"], result: "Filterable history with status and category.", cta: "changeLedger" },
      { id: "bills", name: "Bills & subscriptions", problem: "See recurring charges.", reads: ["recurring_obligations", "transactions"], result: "Every active recurring payment and its next due date.", cta: "personalEconomy" },
    ],
  },
  {
    id: "understand_money",
    title: "Understand my money",
    entries: [
      { id: "financial_twin", name: "Financial Twin", problem: "See everything you own, owe, earn and have promised.", reads: ["financial_assets", "liabilities", "income_streams", "commitments"], result: "Net worth, liquid vs restricted, monthly free cashflow.", cta: "strategicBalance" },
      { id: "spending_timeline", name: "Spending Timeline", problem: "See spending over time.", reads: ["transactions"], result: "Month-by-month spend from posted transactions.", cta: "personalEconomy" },
      { id: "recurring_payments", name: "Recurring Payments", problem: "Find every subscription and standing bill.", reads: ["recurring_obligations"], result: "A list with amounts and cadence.", cta: "personalEconomy" },
      { id: "spending_patterns", name: "Spending Patterns", problem: "Understand where money goes.", reads: ["transactions"], result: "Merchant / category patterns (rule-based, not AI).", cta: "personalEconomy" },
      { id: "unusual_changes", name: "Unusual Changes", problem: "Catch a payment that is out of the ordinary.", reads: ["transactions"], result: "Flagged large or unexpected transactions.", cta: "spendingRisk" },
      { id: "safe_to_spend", name: "Safe-to-Spend", problem: "Know how much you can safely use today.", reads: ["financial_assets", "recurring_obligations", "commitments", "income_streams"], result: "Available to spend after bills, protection and commitments.", cta: "home" },
      { id: "future_balance", name: "Future Balance", problem: "See your balance at future dates.", reads: ["income_streams", "recurring_obligations", "commitments"], result: "Balance at payday / bill / +30 / +90 / goal date, each labelled by confidence.", cta: "home" },
      { id: "cross_bank", name: "Cross-bank connection", problem: "Bring in accounts held elsewhere.", reads: [], result: "A connection flow (SGFinDex not connected - shown honestly).", cta: "crossBankData" },
      { id: "document_decoder", name: "Document Decoder", problem: "Understand a statement or policy.", reads: [], result: "A plain-language breakdown of an uploaded document.", cta: "decodeDocument" },
    ],
  },
  {
    id: "solve_problem",
    title: "Solve a money problem",
    entries: [
      { id: "money_rescue", name: "Money Rescue", problem: "One place for any money problem.", reads: ["financial_assets", "transactions", "recurring_obligations", "commitments"], result: "Calm cases: what happened, what's at risk, your options.", cta: "hardship" },
      { id: "failed_payment", name: "Failed payment help", problem: "A payment did not go through.", reads: ["transactions"], result: "Why it failed and how to retry safely.", cta: "hardship" },
      { id: "cashflow_pressure", name: "Upcoming cashflow pressure", problem: "Bills are about to cluster.", reads: ["recurring_obligations", "income_streams"], result: "When the pinch is and how to smooth it.", cta: "hardship" },
      { id: "unknown_txn", name: "Unknown transaction review", problem: "You don't recognise a charge.", reads: ["transactions"], result: "Recognise, dispute or recategorise.", cta: "spendingRisk" },
      { id: "subscription_control", name: "Subscription control", problem: "Too many or duplicate subscriptions.", reads: ["recurring_obligations"], result: "Duplicates flagged; cancel guidance.", cta: "personalEconomy" },
      { id: "debt_support", name: "Debt repayment support", problem: "Debt feels heavy.", reads: ["liabilities"], result: "A repayment path and freed cashflow.", cta: "repaymentPath" },
      { id: "emergency_review", name: "Emergency buffer review", problem: "Is my safety net enough?", reads: ["financial_assets", "transactions"], result: "Months of cover and how to rebuild.", cta: "emergencyRunway" },
      { id: "income_interruption", name: "Income interruption support", problem: "Income stopped or is late.", reads: ["income_streams", "financial_assets"], result: "A short-term buffer plan.", cta: "hardship" },
    ],
  },
  {
    id: "plan_life",
    title: "Plan my life",
    entries: [
      { id: "wedding", name: "Wedding", problem: "Build a budget, payment timeline and shared contribution plan.", reads: ["financial_assets", "income_streams", "commitments"], result: "May affect your Home timeline and Emergency coverage.", cta: "weddingLivingPlan" },
      { id: "home", name: "Home", problem: "Plan a down payment, loan pressure and move-in date.", reads: ["financial_assets", "liabilities", "income_streams"], result: "Ready month + the cost to your other goals.", cta: "homeHorizon" },
      { id: "emergency", name: "Emergency", problem: "Set a buffer, test a shock and see a recovery path.", reads: ["financial_assets", "transactions"], result: "Months of cover + a rebuild pace.", cta: "emergencyRunway" },
      { id: "travel", name: "Travel", problem: "Budget a trip, its FX and the window.", reads: ["financial_assets", "income_streams"], result: "Monthly pace + your finances after the trip.", cta: "tripOrbit" },
      { id: "investment", name: "Investment", problem: "Find long-term room, risk and a target horizon.", reads: ["financial_assets", "income_streams"], result: "What you can invest without hurting liquidity.", cta: "capitalPaths" },
      { id: "retirement", name: "Retirement", problem: "See the future income gap and a contribution path.", reads: ["financial_assets", "income_streams", "commitments"], result: "The gap + a monthly plan to close it.", cta: "futureLifeTimeline" },
      { id: "loan", name: "Loan", problem: "See a repayment path, interest and freed cashflow.", reads: ["liabilities", "income_streams"], result: "Debt-free date + monthly room released.", cta: "repaymentPath" },
      { id: "insurance", name: "Insurance", problem: "Check protection gaps against premium and risk appetite.", reads: ["financial_assets", "liabilities", "income_streams"], result: "Cover gaps + a premium you can carry.", cta: "protectionEnvelope" },
      { id: "family", name: "Family", problem: "Plan shared costs and responsibilities with privacy.", reads: ["income_streams", "commitments"], result: "A shared band - private amounts never leak.", cta: "familyConstellation" },
    ],
  },
  {
    id: "decide_protect_remember",
    title: "Decide, protect and remember",
    entries: [
      { id: "mirror", name: "Mirror", problem: "Compare alternative futures before you commit.", reads: ["financial_assets", "commitments"], result: "Side-by-side paths with real trade-offs.", cta: "mirror" },
      { id: "guardian", name: "Guardian", problem: "See what the bank is watching for you.", reads: ["commitments", "financial_assets"], result: "Watch rules, triggers and what Guardian can't do.", cta: "guardian" },
      { id: "shared_money", name: "Shared Money", problem: "Manage money and permissions with others.", reads: ["ownership", "commitments"], result: "Shared bands + per-field permissions.", cta: "relationshipLedger" },
      { id: "financial_history", name: "Financial History", problem: "See how every change happened.", reads: ["change_ledger", "ripple_events"], result: "Before to action to recalculation to current state.", cta: "changeLedger" },
      { id: "future_handoff", name: "Future Handoff", problem: "See resources freed by a completed plan.", reads: ["commitments"], result: "What is available to redirect.", cta: "memoryLens" },
      { id: "bank_services", name: "Bank services", problem: "Ways to reach a goal with a bank product.", reads: ["commitments"], result: "Options matched to a goal (not a hard sell).", cta: "productFit" },
    ],
  },
];

// A flat list, for tests / search.
export function allExploreEntries() {
  return EXPLORE_GROUPS.flatMap((g) => g.entries.map((e) => ({ ...e, group: g.id })));
}

export const NINE_STUDIOS = ["wedding", "home", "emergency", "travel", "investment", "retirement", "loan", "insurance", "family"];
