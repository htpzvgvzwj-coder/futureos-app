import { getCurrentUserId } from "../../../../lib/auth.js";
import { loadDomainContext } from "../../../../lib/future-field/service.js";
import { solveMonthlyForTargetMonths } from "../../../../lib/plan-runtime/index.js";

export const runtime = "nodejs";

function monthsFromNow(targetMonth) {
  if (!targetMonth) return null;
  const [y, m] = targetMonth.split("-").map(Number);
  const now = new Date();
  return (y - now.getUTCFullYear()) * 12 + (m - 1 - now.getUTCMonth());
}

// Bend: the customer moved an OUTCOME (a ready date / a target month); solve
// the METHOD backwards. Non-destructive - returns the solved monthly amount
// and the real knock-on effect on cashflow and the emergency buffer. The
// customer then Peels or Seals the result if they want it.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const domain = body.domain ?? "home";
  const context = await loadDomainContext(userId, domain);
  if (!context.realityPlanData || !context.adapter) {
    return Response.json({ error: "no_reality_path" }, { status: 409 });
  }

  // outcome: { metric: "targetDate", toMonth: "YYYY-MM" }  (only date-bend
  // is wired for home today - other levers return not_supported honestly).
  const outcome = body.outcome ?? {};
  if (outcome.metric !== "targetDate" || !outcome.toMonth) {
    return Response.json({ error: "outcome_not_supported", supported: [{ metric: "targetDate" }] }, { status: 422 });
  }
  const targetMonths = monthsFromNow(outcome.toMonth);
  if (!(targetMonths > 0)) {
    return Response.json({ error: "target_in_the_past" }, { status: 422 });
  }

  const projector = context.adapter.projector(context.realityPlanData);
  const solved = solveMonthlyForTargetMonths({
    targetMonths,
    projectMonthsFn: projector,
    lowAmount: 0,
    highAmount: Math.max(20000, (context.availableMonthlyCashflow ?? 5000) * 3),
  });

  if (!solved.achievable) {
    return Response.json({
      outcome,
      achievable: false,
      reason: "even_max_pace_misses_the_date",
      soonestAtCeiling: solved.projectedMonths,
    });
  }

  const priorMonthly = context.realityPlanData.monthly_contribution || 0;
  const deltaMonthly = solved.amount - priorMonthly;
  // Real knock-on: every extra dollar/month is a dollar/month not growing
  // the emergency buffer. Expressed the same way lib/moment-engine.js does.
  const bufferImpactMonths =
    context.monthlyExpenses > 0 ? Math.round(((Math.max(0, deltaMonthly) * 12) / context.monthlyExpenses) * 10) / 10 : null;
  const fitsCashflow = context.availableMonthlyCashflow == null ? null : solved.amount <= context.availableMonthlyCashflow;

  return Response.json({
    outcome,
    achievable: true,
    solvedMonthly: solved.amount,
    priorMonthly,
    deltaMonthly,
    projectedMonths: solved.projectedMonths,
    sideEffects: {
      bufferImpactMonths,
      bufferImpactHorizonMonths: 12,
      fitsAvailableCashflow: fitsCashflow,
      availableMonthlyCashflow: context.availableMonthlyCashflow,
    },
  });
}
