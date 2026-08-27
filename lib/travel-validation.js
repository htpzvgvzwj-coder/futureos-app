import { z } from "zod";

// Mirrors lib/wedding-validation.js's discipline: line_items are the
// source of truth (each carries its own real estimate_basis), and
// total_cost/total_budget are recomputed server-side from their sum via
// .transform() - the model's own top-level number is never trusted, same
// "no unexplained numbers" principle as every other domain planner.

const lineItem = z.object({
  category: z.string().min(1),
  label: z.string().min(1),
  unit_rate: z.number().min(0),
  unit: z.string().min(1),
  quantity: z.number().min(0),
  subtotal: z.number().min(0),
  estimate_basis: z.string().min(1),
});

const itineraryItem = z.object({
  day_number: z.number().min(1),
  label: z.string().min(1),
  location: z.string().min(1),
  is_photo_spot: z.boolean(),
  notes: z.string(),
});

function lineItemsSum(lineItems) {
  return Math.round(lineItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;
}

const plan = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    total_cost: z.number().min(0),
    currency: z.string().min(1),
    destination: z.string().min(1),
    traveler_count: z.number().min(1),
    trip_length_days: z.number().min(1),
    line_items: z.array(lineItem).min(1),
    itinerary: z.array(itineraryItem),
  })
  .transform((plan) => ({ ...plan, total_cost: lineItemsSum(plan.line_items) }));

export const proposeTravelPlansSchema = z.object({
  plans: z.array(plan).min(2).max(3),
  research_notes: z.string(),
});

export const confirmTravelPlanSchema = z
  .object({
    plan_id: z.string().min(1),
    travel_date: z.string().min(1),
    total_budget: z.number().min(0),
    currency: z.string().min(1),
    destination: z.string().min(1),
    traveler_count: z.number().min(1),
    trip_length_days: z.number().min(1),
    line_items: z.array(lineItem).min(1),
    itinerary: z.array(itineraryItem),
    confirmation_note: z.string(),
  })
  .transform((budget) => ({ ...budget, total_budget: lineItemsSum(budget.line_items) }));
