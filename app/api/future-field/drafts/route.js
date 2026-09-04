import { getCurrentUserId } from "../../../../lib/auth.js";
import { query } from "../../../../lib/db.js";

export const runtime = "nodejs";

// GET /api/future-field/drafts
// Every open or active possible-path branch across EVERY domain — the
// cross-domain "Future Drafts" list. Each branch already carries its own
// delta { before, after, changedKeys } from when it was peeled (real
// diffPlanData output, not recomputed here), which is what makes this
// generic across nine very different domain shapes.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await query(
      `select b.id, b.plan_id, b.label, b.status, b.delta, b.feasibility, b.created_at, b.updated_at, p.domain, p.title
         from plan_branches b
         join plans p on p.id = b.plan_id
        where b.profile_key = $1 and b.status in ('open', 'active')
        order by b.updated_at desc
        limit 60`,
      [userId],
    );
    const drafts = res.rows.map((r) => ({
      id: r.id,
      planId: r.plan_id,
      domain: r.domain,
      planTitle: r.title,
      label: r.label,
      status: r.status,
      isActive: r.status === "active",
      changedKeys: r.delta?.changedKeys ?? [],
      before: r.delta?.before ?? {},
      after: r.delta?.after ?? {},
      sealable: r.feasibility?.sealable ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return Response.json({ drafts });
  } catch (error) {
    console.error("[future-field/drafts] failed:", error?.message);
    return Response.json({ error: "drafts_unavailable" }, { status: 500 });
  }
}
