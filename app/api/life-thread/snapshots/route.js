import { getCurrentUserId } from "../../../../lib/auth.js";
import { guard } from "../../../../lib/http-guards.js";
import { listSnapshots, snapshottedEventIds, getSnapshotForEvent, reconcileSnapshots } from "../../../../lib/life/snapshot.js";

export const runtime = "nodejs";

// GET  /api/life-thread/snapshots            -> the frozen Life Thread
//                                               states, newest first + the
//                                               set of event ids that have
//                                               one (Life Memory marks
//                                               those records replayable).
// GET  /api/life-thread/snapshots?event=<id> -> one snapshot for playback.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("event");
  try {
    if (eventId) {
      const snap = await getSnapshotForEvent(userId, eventId);
      if (!snap) return Response.json({ error: "no_snapshot" }, { status: 404 });
      return Response.json({ snapshot: snap });
    }
    const [snapshots, ids] = await Promise.all([listSnapshots(userId), snapshottedEventIds(userId)]);
    return Response.json({ snapshots, snapshottedEventIds: [...ids] });
  } catch (error) {
    console.error("[life-thread/snapshots] GET failed:", error?.message);
    return Response.json({ error: "snapshots_unavailable" }, { status: 500 });
  }
}

// POST /api/life-thread/snapshots
//   { thread, latestEventId?, latestEventAt? }
// Called by the Life tab on load with the live compact thread. Captures
// the baseline once and pins the current state to the most recent
// direction-changing event that has no snapshot yet. Idempotent.
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const blocked = guard(request, { bucket: "life-snapshots", limit: 40 });
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({}));
  if (!body.thread || typeof body.thread !== "object") {
    return Response.json({ error: "missing_thread" }, { status: 400 });
  }
  try {
    const res = await reconcileSnapshots(userId, {
      thread: body.thread,
      latestEventId: body.latestEventId ?? null,
      latestEventAt: body.latestEventAt ?? null,
    });
    return Response.json(res);
  } catch (error) {
    console.error("[life-thread/snapshots] POST failed:", error?.message);
    return Response.json({ error: "snapshot_failed" }, { status: 500 });
  }
}
