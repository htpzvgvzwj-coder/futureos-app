import { getCurrentUserId } from "../../../../lib/auth.js";
import { planStore } from "../../../../lib/plan-runtime/index.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import { buildPinEvent } from "../../../../lib/change-ledger/producers/future-field.js";

export const runtime = "nodejs";

// The closed set of pin kinds (matches scripts/migrate.sql's comment on
// plan_constraints.kind and lib/change-ledger locales' pinKind.*).
const PIN_KINDS = {
  emergency_floor_months: "gte",
  max_monthly_contribution: "lte",
  max_delay_months: "lte",
  min_core_guests: "gte",
  min_photo_quality: "flag",
  no_balance_share: "flag",
  no_guardian_auto_move: "flag",
  // Home Horizon domain pins (Living Thread commit 2).
  minimum_emergency_months: "gte",
  maximum_monthly_repayment: "lte",
  minimum_renovation_reserve: "gte",
  latest_purchase_month: "lte", // value + metric are YYYYMM integers
  no_partner_share: "flag",
  minimum_post_purchase_cash: "gte",
  // Safety Runway domain pins (Living Thread commit 3).
  minimum_floor_months: "gte",
  maximum_rebuild_monthly: "lte",
  no_goal_funding_below_floor: "flag",
  // Debt Gravity domain pins (Living Thread commit 4).
  minimum_breathing_room: "gte",
  maximum_extra_payment: "lte",
  protect_emergency_floor: "flag",
  no_one_off_from_protected_savings: "flag",
  target_debt_only: "flag",
  // Future-Day Loom domain pins (Living Thread commit 5).
  minimum_current_breathing_room: "gte",
  minimum_emergency_floor: "gte",
  maximum_monthly_contribution: "lte",
  protected_future_day_choices: "flag",
  no_assumed_inheritance: "flag",
  no_unconfirmed_partner_assets: "flag",
};

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const domain = new URL(request.url).searchParams.get("domain") ?? null;
  const plan = domain ? await planStore.getPlan(userId, { domain, goalKey: domain }) : null;
  const pins = await planStore.getApplicableConstraints(userId, { planId: plan?.id ?? null, domain });
  return Response.json({
    pins: pins.map((c) => ({ id: c.id, kind: c.kind, operator: c.operator, value: c.value == null ? null : Number(c.value), scope: c.scope })),
  });
}

// Set (or change) a pin. A structured, persistent constraint - not a UI
// filter. Same kind + scope replaces the previous one (released, kept in
// history).
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { kind, value = null, scope = "domain", domain = null } = body;
  if (!PIN_KINDS[kind]) {
    return Response.json({ error: "unknown_pin_kind", allowed: Object.keys(PIN_KINDS) }, { status: 422 });
  }
  const operator = PIN_KINDS[kind];
  if (operator !== "flag" && !(Number.isFinite(Number(value)))) {
    return Response.json({ error: "value_required_for_this_pin" }, { status: 422 });
  }

  const plan = domain ? await planStore.getPlan(userId, { domain, goalKey: domain }) : null;
  const existing = (await planStore.getApplicableConstraints(userId, { planId: plan?.id ?? null, domain })).find((c) => c.kind === kind && c.scope === scope);

  const constraint = await planStore.setConstraint(userId, {
    planId: scope === "plan" ? plan?.id ?? null : null,
    kind,
    operator,
    value: operator === "flag" ? null : Number(value),
    scope,
    cause: { trigger: "future_field_pin" },
  });

  const ledger = await recordEventSafe(
    buildPinEvent({
      profileKey: userId,
      domain,
      planId: plan?.id ?? null,
      constraintId: constraint.id,
      kind,
      operator,
      value: operator === "flag" ? null : Number(value),
      phase: existing ? "change" : "set",
    }),
  );

  return Response.json({ pin: { id: constraint.id, kind, operator, value: constraint.value == null ? null : Number(constraint.value), scope }, ledgerEventId: ledger?.event?.id ?? null });
}

// Release a pin.
export async function DELETE(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
  const released = await planStore.releaseConstraint(id, userId);
  if (!released) return Response.json({ error: "not_found" }, { status: 404 });
  await recordEventSafe(
    buildPinEvent({
      profileKey: userId,
      domain: null,
      planId: released.plan_id ?? null,
      constraintId: released.id,
      kind: released.kind,
      operator: released.operator,
      value: released.value == null ? null : Number(released.value),
      phase: "release",
    }),
  );
  return Response.json({ released: true });
}
