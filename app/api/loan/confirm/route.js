import { computeLoanArchetype, applyLoanModifiers } from "../../../../lib/loan-finance.js";
import { confirmLoanSchema } from "../../../../lib/loan-validation.js";
import { getOtherGoalsMonthlyCommitment } from "../../../../lib/loan-context.js";
import { getTotalConfirmedLoanLiabilities } from "../../../../lib/micro-insurance-context.js";
import { computeCoverageGap, computeMicroTopUp } from "../../../../lib/micro-insurance-finance.js";
import { saveOffer } from "../../../../lib/micro-insurance-store.js";
import { getOrCreateSession, saveArtifact, updateSessionStatus } from "../../../../lib/loan-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";
const MICRO_TOPUP_DURATION_MONTHS = 6;

// No AI call here — archetype/modifier selection is a structured UI pick
// with nothing for an LLM to interpret, so this validates and computes
// directly. Server independently recomputes every number via
// lib/loan-finance.js rather than trusting anything the client sent beyond
// the categorical choices (purpose/archetype/modifiers) and the profile
// inputs, exactly like every other deterministic calculator in this app.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = confirmLoanSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const {
    purpose,
    principalBasis,
    propertyType,
    archetype,
    modifiers,
    monthlyIncome,
    monthlyExpenses,
    currentSavings,
    existingMonthlyDebt,
    relationshipTier,
    insuranceCoverageAmount,
  } = parsed.data;

  const otherGoals = await getOtherGoalsMonthlyCommitment(purpose === "home" ? "home" : null, userId);

  const params = {
    principalBasis,
    propertyType,
    monthlyIncome,
    monthlyExpenses,
    existingMonthlyDebt,
    currentSavings,
    otherGoalsMonthlyOutflow: otherGoals.total,
    relationshipTier,
  };

  const base = computeLoanArchetype(purpose, archetype, params);
  const result = modifiers.length ? applyLoanModifiers(base, modifiers, params) : base;

  const session = await getOrCreateSession(userId, purpose);
  const createdAt = await saveArtifact(session.id, "stage1", "confirmed_loan", result);
  await updateSessionStatus(session.id, { stage1Status: "confirmed" });

  // Event-triggered micro-insurance: this new loan is the trigger event. Re-reads total liabilities
  // AFTER the save above, so it already reflects this loan - if the customer's declared coverage no
  // longer covers total liabilities, Guardian offers a precisely-sized, precisely-timed top-up
  // instead of a full new annual policy. Pure arithmetic - lib/micro-insurance-finance.js, no AI.
  const totalLiabilities = await getTotalConfirmedLoanLiabilities(userId);
  const { gapAmount, hasGap } = computeCoverageGap({ existingCoverageAmount: insuranceCoverageAmount, totalLiabilities });
  let microInsuranceOffer = null;
  if (hasGap) {
    const topUp = computeMicroTopUp({ gapAmount, durationMonths: MICRO_TOPUP_DURATION_MONTHS });
    const saved = await saveOffer(userId, { triggerPurpose: purpose, ...topUp });
    microInsuranceOffer = { ...topUp, ...saved, triggerPurpose: purpose, status: "offered" };
  }

  return Response.json({ type: "confirm_loan", data: result, confirmedAt: createdAt, microInsuranceOffer });
}
