import { getCurrentUserId } from "../../../../lib/auth.js";
import { listRecurringObligations, listIncomeStreams } from "../../../../lib/financial-twin/rows-store.js";
import { buildLifeThread } from "../../../../lib/life-thread/service.js";
import { buildPressureForecast } from "../../../../lib/life/forecast.js";

export const runtime = "nodejs";

// GET /api/life-thread/forecast — Life Pressure Weather looking a few
// months ahead: the month where the non-monthly charges (annual premiums,
// a deposit, a levy) land together, and what they are.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const [obligations, incomes, lt] = await Promise.all([
      listRecurringObligations(userId).catch(() => []),
      listIncomeStreams(userId).catch(() => []),
      buildLifeThread(userId).catch(() => ({})),
    ]);
    const incomeMonthly = incomes.reduce((s, i) => s + (Number(i.monthlyAmount) || 0), 0);
    const forecast = buildPressureForecast({
      obligations,
      incomeMonthly,
      committedMonthly: Number(lt.monthlyCommittedTotal) || 0,
      freeMonthly: lt.availableMonthlyCashflow ?? null,
    });
    return Response.json(forecast);
  } catch (error) {
    console.error("[life-thread/forecast] failed:", error?.message);
    return Response.json({ error: "forecast_unavailable" }, { status: 500 });
  }
}
