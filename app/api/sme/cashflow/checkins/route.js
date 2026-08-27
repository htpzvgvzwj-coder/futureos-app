import { getCurrentUserId } from "../../../../../lib/auth.js";
import { getProfile, addCheckin, getCheckins } from "../../../../../lib/sme-cashflow-store.js";
import { computeCashFlowForecast } from "../../../../../lib/sme-cashflow-finance.js";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcMidnight(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const checkins = await getCheckins(userId);
  return Response.json({ checkins });
}

// The owner logs a real observed cash balance on a real date. The
// forecast day it corresponds to, and what that forecast actually
// predicted for that day, are both computed here from the profile's real
// saved events - never trusted from the client, same discipline as every
// other server-recomputed total in this app.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { checkinDate, actualBalance, note } = body;

  if (typeof checkinDate !== "string" || !DATE_RE.test(checkinDate)) {
    return Response.json({ error: "invalid_date" }, { status: 400 });
  }
  const parsedActual = Number(actualBalance);
  if (!Number.isFinite(parsedActual)) {
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  }

  const profile = await getProfile(userId);
  if (!profile) return Response.json({ error: "no_profile" }, { status: 409 });

  const forecast = computeCashFlowForecast({ startingCash: profile.startingCash, events: profile.events, horizonDays: 30 });
  const forecastDay = Math.round((toUtcMidnight(checkinDate) - toUtcMidnight(profile.updatedAt.slice(0, 10))) / MS_PER_DAY) + 1;
  if (forecastDay < 1 || forecastDay > forecast.horizonDays) {
    return Response.json({ error: "outside_forecast_window", detail: { horizonDays: forecast.horizonDays } }, { status: 422 });
  }
  const predictedBalance = forecast.timeline[forecastDay - 1].balance;

  const checkin = await addCheckin(userId, {
    checkinDate,
    forecastDay,
    predictedBalance,
    actualBalance: parsedActual,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  });
  return Response.json({ checkin });
}
