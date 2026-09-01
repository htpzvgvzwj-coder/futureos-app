import { getCurrentUserId } from "../../../lib/auth.js";
import { guard } from "../../../lib/http-guards.js";
import { buildMoneyMoments } from "../../../lib/money-moments/build.js";
import { setMomentState, MOMENT_ACTIONS } from "../../../lib/money-moments/state-store.js";
import { recordAuditEvent } from "../../../lib/account-control/store.js";
import { recordEventSafe } from "../../../lib/change-ledger/store.js";
import { ACTION_TYPES } from "../../../lib/change-ledger/events.js";

export const runtime = "nodejs";

// GET /api/money-moments
// The one server-owned stream Today / Explore / Guardian / History read.
// Combines the Financial Twin, Money Rescue, Reality Drift, Ripple, Life
// Thread and Change Ledger into normalized MoneyMoments (+ plan movement,
// resource totals, "money changed" and "bank now" views). Nothing invented.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await buildMoneyMoments(userId);
    return Response.json(data);
  } catch (error) {
    console.error("[money-moments] build failed:", error?.stack || error?.message);
    return Response.json({ error: "money_moments_unavailable" }, { status: 500 });
  }
}

// POST /api/money-moments
//   { action: "reviewed" | "snoozed" | "resolved" | "reopened" | "acknowledged",
//     momentKey, evidenceHash?, snoozeDays?, note? }
//
// Persists the lifecycle transition and writes an audit row + a Change
// Ledger event. Detection state never lives only in React.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "money-moments-action", limit: 60 });
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const momentKey = String(body.momentKey || "");
  if (!MOMENT_ACTIONS.includes(action)) return Response.json({ error: "bad_action" }, { status: 400 });
  if (!momentKey) return Response.json({ error: "missing_moment_key" }, { status: 400 });

  try {
    const row = await setMomentState(userId, momentKey, action, {
      evidenceHash: body.evidenceHash ?? null,
      snoozeDays: body.snoozeDays ?? null,
      note: body.note ?? null,
    });

    await recordAuditEvent(null, userId, {
      kind: `money_moment_${action}`,
      detail: { momentKey, snoozeDays: body.snoozeDays ?? null },
    });

    const isOutcome = action === "acknowledged" || action === "resolved";
    await recordEventSafe({
      profileKey: userId,
      actor: "user",
      sourceFeature: "money_moments",
      actionType: ACTION_TYPES.RESCUE_ADOPTED,
      status: isOutcome ? "observed" : "projected",
      messageKey: `ledger.moneyMoment.${action}`,
      messageParams: { momentKey },
      cause: { trigger: "money_moment_action", action, momentKey },
      uncertaintyNote:
        action === "acknowledged"
          ? "You acknowledged a detected item; the underlying signal will reopen it if it recurs."
          : action === "snoozed"
            ? "Snoozed - it will resurface after the snooze window or if the evidence changes."
            : null,
      dedupeKey: `money_moment:${momentKey}:${action}:${new Date().toISOString().slice(0, 13)}`,
    });

    // rebuild so the caller (and the provider) can render the fresh stream
    const data = await buildMoneyMoments(userId);
    return Response.json({ ok: true, momentKey, state: row.state, data });
  } catch (error) {
    console.error("[money-moments] action failed:", error?.message);
    return Response.json({ error: "action_failed" }, { status: 400 });
  }
}
