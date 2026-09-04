// Ask to Pay — a child or youth asks to make a payment. The guardian sees
// the REASON Guardian reached its decision, not just an Approve / Reject
// button: what's left in the week, whether the merchant is familiar,
// whether it dips a savings goal, and what the approval policy says.
//
// Pure. Returns:
//   {
//     outcome: "auto_ok" | "needs_approval" | "blocked",
//     reasons:      [{ code, text, tone }],   // tone: ok | watch | block
//     remainingBefore, remainingAfter,        // this week's allowance
//     goalImpact:   { label, daysLater } | null,
//     needsApproval: boolean,
//   }

const round0 = (n) => Math.round(Number(n) || 0);
const money = (n) => `SGD ${round0(n).toLocaleString("en-SG")}`;
const norm = (s) => String(s || "").trim().toLowerCase();

export function evaluateAskToPay({
  amount,
  merchant = "",
  weeklyAllowance = null,
  spentThisWeek = 0,
  knownMerchants = [],
  savingsGoals = [], // [{ label, monthlyContribution, dailyRate }]
  policy = {}, // { autoApproveUnder, alwaysApproveOver, newMerchantNeedsApproval }
} = {}) {
  const amt = round0(amount);
  const reasons = [];
  if (!(amt > 0)) {
    return { outcome: "blocked", reasons: [{ code: "no_amount", text: "Enter how much to pay.", tone: "block" }], needsApproval: false };
  }

  const remainingBefore = weeklyAllowance == null ? null : Math.max(0, round0(weeklyAllowance) - round0(spentThisWeek));
  const remainingAfter = remainingBefore == null ? null : remainingBefore - amt;

  const known = knownMerchants.map(norm).includes(norm(merchant));
  const autoUnder = policy.autoApproveUnder != null ? round0(policy.autoApproveUnder) : null;
  const alwaysOver = policy.alwaysApproveOver != null ? round0(policy.alwaysApproveOver) : null;
  const newMerchantNeedsApproval = policy.newMerchantNeedsApproval !== false; // default on

  let block = false;
  let needsApproval = false;

  // 1 — within the week's allowance?
  if (remainingBefore != null) {
    if (amt <= remainingBefore) {
      reasons.push({ code: "within_week", text: `Leaves ${money(remainingAfter)} of this week's ${money(weeklyAllowance)}.`, tone: "ok" });
    } else {
      block = true;
      reasons.push({ code: "over_week", text: `This is ${money(amt - remainingBefore)} more than what's left this week (${money(remainingBefore)}).`, tone: "block" });
    }
  }

  // 2 — familiar merchant?
  if (merchant) {
    if (known) {
      reasons.push({ code: "known_merchant", text: `${merchant} is somewhere you've paid before.`, tone: "ok" });
    } else {
      reasons.push({ code: "new_merchant", text: `${merchant} is new — you haven't paid there before.`, tone: "watch" });
      if (newMerchantNeedsApproval) needsApproval = true;
    }
  }

  // 3 — does it slow a savings goal? (only a soft signal — never blocks)
  let goalImpact = null;
  const goal = savingsGoals.find((g) => g && (g.dailyRate > 0 || g.monthlyContribution > 0));
  if (goal) {
    const perDay = goal.dailyRate > 0 ? goal.dailyRate : round0(goal.monthlyContribution) / 30;
    const daysLater = perDay > 0 ? Math.round(amt / perDay) : 0;
    if (daysLater >= 1) {
      goalImpact = { label: goal.label, daysLater };
      reasons.push({ code: "goal_impact", text: `Spending this now moves "${goal.label}" about ${daysLater} day${daysLater === 1 ? "" : "s"} later.`, tone: "watch" });
    }
  }

  // 4 — approval policy thresholds
  if (alwaysOver != null && amt >= alwaysOver) {
    needsApproval = true;
    reasons.push({ code: "over_policy", text: `Anything ${money(alwaysOver)} or more needs a yes from a guardian.`, tone: "watch" });
  } else if (autoUnder != null && amt <= autoUnder && known && (remainingAfter == null || remainingAfter >= 0)) {
    reasons.push({ code: "auto_ok", text: `Small, familiar and within the week — no need to ask.`, tone: "ok" });
  } else if (autoUnder != null && amt > autoUnder) {
    needsApproval = true;
    reasons.push({ code: "over_auto", text: `Above the ${money(autoUnder)} you can spend without asking.`, tone: "watch" });
  }

  const outcome = block ? "blocked" : needsApproval ? "needs_approval" : "auto_ok";
  return { outcome, reasons, remainingBefore, remainingAfter, goalImpact, needsApproval: outcome === "needs_approval" };
}
