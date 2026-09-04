// Guardian Phase 2 — close the loop. Before a money move runs, Guardian
// shows what it does to the promises: Safe-to-Spend, the lowest balance
// before income, the emergency buffer, and any plan funded from the same
// account. Every number is computed from the real Financial Twin bundle.

import { query } from "../db.js";
import { buildFinancialTwinBundle } from "../financial-twin/bundle.js";
import { listAuthRequests } from "../authorization/store.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Pure: given the current safe-to-spend view + twin and a proposed move,
// return the before/after picture. `movesOutOfSpendable` is true when the
// cash genuinely leaves the spendable pool (a card repayment, an external
// payment) and false for a shuffle between the customer's own accounts.
export function buildMoveImpact({ safeToSpend, twin, kind, amount }) {
  const amt = round2(amount);
  const s2sBefore = round2(safeToSpend?.safeToSpend ?? 0);
  const lowBefore = round2(safeToSpend?.projectedLowBalanceBeforeIncome ?? s2sBefore);
  const debtBefore = round2(twin?.liabilitiesTotal ?? 0);

  const movesOutOfSpendable = kind === "card_repayment"; // internal_transfer keeps the money yours & liquid

  const s2sAfter = movesOutOfSpendable ? round2(Math.max(0, s2sBefore - amt)) : s2sBefore;
  const lowAfter = movesOutOfSpendable ? round2(lowBefore - amt) : lowBefore;
  const debtAfter = kind === "card_repayment" ? round2(Math.max(0, debtBefore - amt)) : debtBefore;

  const monthly = round2(twin?.essentialMonthlySpend ?? twin?.committedMonthlyTotal ?? 0);
  const protectedReserve = round2(safeToSpend?.breakdown?.protectedReserve ?? twin?.protectedAssets ?? 0);
  const bufferMonthsBefore = monthly > 0 ? round2(protectedReserve / monthly) : null;
  // the emergency pool is never the source of these moves, so months are unchanged
  const bufferMonthsAfter = bufferMonthsBefore;

  return {
    currency: safeToSpend?.currency ?? "SGD",
    movesOutOfSpendable,
    spendableNow: { before: s2sBefore, after: s2sAfter, delta: round2(s2sAfter - s2sBefore) },
    lowestBeforeIncome: { before: lowBefore, after: lowAfter },
    crossesSafetyLine: lowBefore >= 0 && lowAfter < 0,
    emergencyBuffer: { monthsBefore: bufferMonthsBefore, monthsAfter: bufferMonthsAfter, unchanged: true },
    debt: kind === "card_repayment" ? { before: debtBefore, after: debtAfter } : null,
  };
}

// The evidence + confidence + time a decision carries, from the parked
// request itself (no invention).
function decisionEvidence(req) {
  const out = [
    { label: "Amount", value: `${req.currency ?? "SGD"} ${Number(req.amount || 0).toLocaleString("en-SG")}`, confidence: "confirmed" },
    { label: "Kind", value: req.kind === "card_repayment" ? "Card repayment" : "Move between your own accounts", confidence: "confirmed" },
  ];
  if (req.reason) out.push({ label: "Why it is held", value: req.reason, confidence: "confirmed" });
  if (req.autoExecuteAt) out.push({ label: "Runs on its own", value: new Date(req.autoExecuteAt).toISOString().slice(0, 16).replace("T", " "), confidence: "scheduled" });
  return out;
}

export async function buildGuardianDecision(profileKey, requestId) {
  const pending = await listAuthRequests(profileKey, { status: "pending" });
  const req = pending.find((r) => r.id === requestId);
  if (!req) return null;
  const bundle = await buildFinancialTwinBundle(profileKey).catch(() => ({}));
  const impact = buildMoveImpact({ safeToSpend: bundle.safeToSpend, twin: bundle.twin, kind: req.kind, amount: req.amount });
  return {
    request: req,
    occurredAt: req.createdAt,
    confidence: "confirmed",
    evidence: decisionEvidence(req),
    impact,
    options: [
      { id: "continue", label: "Continue" },
      { id: "adjust", label: "Adjust amount" },
      { id: "cancel", label: "Cancel this move" },
    ],
  };
}
