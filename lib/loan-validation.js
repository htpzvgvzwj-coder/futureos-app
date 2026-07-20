import { z } from "zod";
import { LOAN_ARCHETYPE_KEYS, LOAN_MODIFIER_KEYS } from "./loan-finance.js";

// Mirrors the other *-validation.js modules' shape-checking approach.
// Business-invariant checks (non-negative numbers) live here since JSON
// Schema `strict: true` alone can't express them.

const sizingOption = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  loan_amount_estimate: z.number().min(0),
  estimate_basis: z.string().min(1),
  considerations: z.string(),
});

export const proposeLoanSizingSchema = z.object({
  sizing_options: z.array(sizingOption).min(1).max(2),
  research_notes: z.string(),
});

const ALL_PURPOSES = ["home", "renovation", "personal"];

// Validates the body of POST /api/loan/confirm — a structured UI selection,
// not an AI tool-call output, so there are no LLM-output quirks to guard
// against here: just enum membership and positive numbers. propertyType is
// required only for purpose === "home" (needed to derive HDB vs. bank loan
// tenure/MSR applicability in lib/loan-finance.js).
export const confirmLoanSchema = z
  .object({
    purpose: z.enum(ALL_PURPOSES),
    principalBasis: z.number().positive(),
    // The client's propertyType state is initialized to (and stays) null for
    // non-home purposes, not undefined - .nullable() accepts what the real
    // UI actually sends, not just what a hand-written test payload would.
    propertyType: z.string().min(1).nullable().optional(),
    archetype: z.enum(LOAN_ARCHETYPE_KEYS),
    modifiers: z.array(z.enum(LOAN_MODIFIER_KEYS)).max(3),
    monthlyIncome: z.number().min(0),
    monthlyExpenses: z.number().min(0),
    currentSavings: z.number().min(0),
    existingMonthlyDebt: z.number().min(0).default(0),
    relationshipTier: z.number().int().min(0).max(3).default(0),
    insuranceCoverageAmount: z.number().min(0).default(0),
  })
  .refine((body) => body.purpose !== "home" || Boolean(body.propertyType), {
    message: "propertyType is required when purpose is 'home'",
    path: ["propertyType"],
  });
