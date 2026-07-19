import { computeLoanArchetype, applyLoanModifiers } from "../../../../lib/loan-finance.js";
import { confirmLoanSchema } from "../../../../lib/loan-validation.js";
import { getOtherGoalsMonthlyCommitment } from "../../../../lib/loan-context.js";
import { DEFAULT_PROFILE_KEY, getOrCreateSession, saveArtifact, updateSessionStatus } from "../../../../lib/loan-store.js";

export const runtime = "nodejs";

// No AI call here — archetype/modifier selection is a structured UI pick
// with nothing for an LLM to interpret, so this validates and computes
// directly. Server independently recomputes every number via
// lib/loan-finance.js rather than trusting anything the client sent beyond
// the categorical choices (purpose/archetype/modifiers) and the profile
// inputs, exactly like every other deterministic calculator in this app.
export async function POST(request) {
  const body = await request.json();
  const parsed = confirmLoanSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  const { purpose, principalBasis, propertyType, archetype, modifiers, monthlyIncome, monthlyExpenses, currentSavings, existingMonthlyDebt } = parsed.data;

  const otherGoals = await getOtherGoalsMonthlyCommitment(purpose === "home" ? "home" : null);

  const params = {
    principalBasis,
    propertyType,
    monthlyIncome,
    monthlyExpenses,
    existingMonthlyDebt,
    currentSavings,
    otherGoalsMonthlyOutflow: otherGoals.total,
  };

  const base = computeLoanArchetype(purpose, archetype, params);
  const result = modifiers.length ? applyLoanModifiers(base, modifiers, params) : base;

  const session = await getOrCreateSession(DEFAULT_PROFILE_KEY, purpose);
  const createdAt = await saveArtifact(session.id, "stage1", "confirmed_loan", result);
  await updateSessionStatus(session.id, { stage1Status: "confirmed" });

  return Response.json({ type: "confirm_loan", data: result, confirmedAt: createdAt });
}
