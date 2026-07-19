import { getConfirmedHomePrice, getOtherGoalsMonthlyCommitment } from "../../../../lib/loan-context.js";

export const runtime = "nodejs";

const VALID_PURPOSES = new Set(["home", "renovation", "personal"]);

// Read-only cross-goal context for the client-side archetype live preview.
// For purpose=home this also resolves the confirmed property price/type,
// since Loan Planner never re-collects or re-estimates that for the home
// purpose. The confirm endpoint independently re-fetches this server-side —
// a stale or failed client fetch here can never corrupt what gets persisted.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const purpose = searchParams.get("purpose");

  if (!VALID_PURPOSES.has(purpose)) {
    return Response.json({ error: "invalid_purpose" }, { status: 400 });
  }

  const [otherGoals, homePrice] = await Promise.all([
    getOtherGoalsMonthlyCommitment(purpose === "home" ? "home" : null),
    purpose === "home" ? getConfirmedHomePrice() : Promise.resolve(null),
  ]);

  if (purpose === "home" && !homePrice) {
    return Response.json({ error: "no_confirmed_home_plan" }, { status: 404 });
  }

  return Response.json({
    otherGoalsMonthlyOutflow: otherGoals.total,
    price: homePrice?.price ?? null,
    propertyType: homePrice?.propertyType ?? null,
  });
}
