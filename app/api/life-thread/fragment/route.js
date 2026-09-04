import { getCurrentUserId } from "../../../../lib/auth.js";
import { guard } from "../../../../lib/http-guards.js";
import { recordEventSafe } from "../../../../lib/change-ledger/store.js";
import { createCommitment } from "../../../../lib/goal-commitment-store.js";
import { buildLifeThread } from "../../../../lib/life-thread/service.js";
import { buildFutureFragments, simulateFragment } from "../../../../lib/life/fragments.js";

export const runtime = "nodejs";

// POST /api/life-thread/fragment
//   { action: "confirm", fragmentId, kind, monthly? }
//
// Confirms a Future Fragment the person placed on their line: writes ONE
// Change Ledger event (so Life Memory appends it immediately) and, for a
// "build"/described fragment, a real additive commitment. "accelerate" is
// recorded as an allocation of freed money; "protect" as a Guardian note.
// Nothing here mutates or removes an existing commitment.
const thisMonth = () => new Date().toISOString().slice(0, 7);
const round0 = (n) => Math.round(Number(n) || 0);

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "life-fragment", limit: 20 });
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  if (body.action !== "confirm") return Response.json({ error: "bad_action" }, { status: 400 });

  try {
    const lt = await buildLifeThread(userId);
    // Re-derive the fragment from the current line so the client can't
    // confirm numbers that don't match the person's real data.
    const live = buildFutureFragments({ lt, twin: null });
    const fragment = live.find((f) => f.id === body.fragmentId);
    if (!fragment) return Response.json({ error: "fragment_not_available" }, { status: 409 });

    const monthly = body.monthly != null ? Math.max(0, round0(body.monthly)) : round0(fragment.needsMonthly);
    const receipt = simulateFragment(fragment, lt, { overrideMonthly: monthly });
    if (!receipt.affordable || !receipt.safetyOk) {
      return Response.json({ error: "not_confirmable", receipt }, { status: 422 });
    }

    let commitment = null;
    let event = null;

    if (fragment.kind === "build") {
      const domain = "investment"; // the Freedom node
      commitment = await createCommitment(userId, {
        domain,
        monthlyContribution: monthly,
        effectiveMonth: thisMonth(),
        pauseIfEmergencyMonthsBelow: 6,
        sourceMoment: { trigger: "future_fragment", fragmentId: fragment.id },
      }).catch(() => null);
      event = await recordEventSafe({
        profileKey: userId,
        actor: "user",
        sourceFeature: "life_graph",
        actionType: "commitment_created",
        status: "active",
        messageKey: "changeLedger.event.commitment_created.headline",
        messageParams: { amount: monthly, month: thisMonth() },
        relatedGoalIds: [domain],
        cause: { trigger: "future_fragment", fragmentId: fragment.id, kind: fragment.kind },
        impactSet: [
          { goalId: domain, metric: "monthlyContribution", before: 0, after: monthly, unit: "sgd_per_month", direction: "down" },
          { goalId: "cashflow", metric: "freeMonthlyCashflow", before: round0(lt.availableMonthlyCashflow), after: receipt.flexibleAfter, unit: "sgd", direction: "down" },
        ],
      });
    } else if (fragment.kind === "accelerate") {
      const domain = fragment.projected?.planShift?.domain ?? "home";
      const monthsEarlier = round0(fragment.projected?.planShift?.monthsEarlier ?? 0);
      event = await recordEventSafe({
        profileKey: userId,
        actor: "user",
        sourceFeature: "life_graph",
        actionType: "allocation_set",
        status: "active",
        messageKey: "changeLedger.event.savings_plan_confirmed.headline",
        messageParams: { domain, amount: monthly },
        relatedGoalIds: [domain],
        cause: { trigger: "future_fragment", fragmentId: fragment.id, kind: fragment.kind, adjusted: true },
        impactSet: [
          { goalId: domain, metric: "monthlyContribution", before: 0, after: monthly, unit: "sgd_per_month", direction: "down" },
          { goalId: domain, metric: "readyMonthShift", before: 0, after: -monthsEarlier, unit: "date_shift_months", direction: "up" },
          { goalId: "cashflow", metric: "freeMonthlyCashflow", before: round0(lt.availableMonthlyCashflow), after: receipt.flexibleAfter, unit: "sgd", direction: "down" },
        ],
      });
    } else {
      // protect
      event = await recordEventSafe({
        profileKey: userId,
        actor: "user",
        sourceFeature: "life_graph",
        actionType: "guardian_action",
        status: "active",
        messageKey: "changeLedger.event.savings_plan_confirmed.headline",
        messageParams: { domain: "safety", amount: round0(fragment.needsOneOff || fragment.needsMonthly) },
        relatedGoalIds: [],
        cause: { trigger: "future_fragment", fragmentId: fragment.id, kind: fragment.kind },
        impactSet: [],
        uncertaintyNote: fragment.detail,
      });
    }

    return Response.json({ ok: true, receipt, commitmentId: commitment?.id ?? null, eventId: event?.event?.id ?? null });
  } catch (error) {
    console.error("[life-thread/fragment] confirm failed:", error?.message);
    return Response.json({ error: "confirm_failed", detail: error?.message ?? null }, { status: 500 });
  }
}
