import { getStrategicBalanceSnapshot } from "../../../../lib/strategic-balance-context.js";
import { simulateInvestmentAdjustment } from "../../../../lib/strategic-balance-finance.js";

export const runtime = "nodejs";

// Pure "what if" preview — nothing here is persisted. Re-fetches the
// snapshot fresh (rather than trusting anything the client sent about
// current loans/savings) so the simulation is always grounded in the
// customer's real confirmed plans, same "server recomputes, never trusts
// the client" discipline as every confirm endpoint in this app.
export async function POST(request) {
  const body = await request.json();
  const { newInvestmentMonthly, monthlyIncome, monthlyExpenses, currentSavings } = body;

  if (typeof newInvestmentMonthly !== "number" || newInvestmentMonthly < 0) {
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  }

  const snapshot = await getStrategicBalanceSnapshot();
  const savingsTotal = snapshot.savings.reduce((sum, plan) => sum + plan.monthlyContribution, 0);

  const result = simulateInvestmentAdjustment({
    newInvestmentMonthly,
    confirmedLoans: snapshot.loans,
    otherNonInvestmentMonthlyOutflow: savingsTotal,
    monthlyIncome: Number(monthlyIncome) || 0,
    monthlyExpenses: Number(monthlyExpenses) || 0,
    currentSavings: Number(currentSavings) || 0,
  });

  return Response.json(result);
}
