import { getCurrentUserId } from "../../../../lib/auth.js";
import {
  listFinancialAssets, createFinancialAsset, updateFinancialAsset, deleteFinancialAsset,
  listLiabilities, createLiability, updateLiability, deleteLiability,
  listIncomeStreams, createIncomeStream, updateIncomeStream, deleteIncomeStream,
  listRecurringObligations, upsertRecurringObligation, deleteRecurringObligation,
} from "../../../../lib/financial-twin/rows-store.js";
import { query } from "../../../../lib/db.js";

export const runtime = "nodejs";

// Manual reality entry (Usable RC, section 五). GET returns every Financial
// Twin row; POST/PATCH/DELETE mutate one, with a "used by which plan"
// guard on delete so nothing vanishes silently.
const KINDS = ["asset", "liability", "income", "recurring"];

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const [assets, liabilities, income, recurring] = await Promise.all([
    listFinancialAssets(userId), listLiabilities(userId), listIncomeStreams(userId), listRecurringObligations(userId),
  ]);
  return Response.json({ assets, liabilities, income, recurring });
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!KINDS.includes(body.kind)) return Response.json({ error: "invalid_kind" }, { status: 400 });
  try {
    const row =
      body.kind === "asset" ? await createFinancialAsset(userId, body.data ?? {})
      : body.kind === "liability" ? await createLiability(userId, body.data ?? {})
      : body.kind === "income" ? await createIncomeStream(userId, body.data ?? {})
      : await upsertRecurringObligation(userId, body.data ?? {});
    return Response.json({ row }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!KINDS.includes(body.kind) || !body.id) return Response.json({ error: "invalid_request" }, { status: 400 });
  try {
    const row =
      body.kind === "asset" ? await updateFinancialAsset(userId, body.id, body.data ?? {})
      : body.kind === "liability" ? await updateLiability(userId, body.id, body.data ?? {})
      : body.kind === "income" ? await updateIncomeStream(userId, body.id, body.data ?? {})
      : await upsertRecurringObligation(userId, { ...(body.data ?? {}), recurringGroup: body.id });
    if (!row) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ row });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  const confirmed = url.searchParams.get("confirm") === "true";
  if (!KINDS.includes(kind) || !id) return Response.json({ error: "invalid_request" }, { status: 400 });

  // "used by a plan" guard: a restricted asset earmarked to a domain, or a
  // liability/income a commitment depends on.
  const inUse = [];
  if (kind === "asset") {
    const a = await query(`select restricted_purpose from financial_assets where id = $1 and profile_key = $2`, [id, userId]);
    if (a.rows[0]?.restricted_purpose && a.rows[0].restricted_purpose !== "none") {
      const plans = await query(`select domain from goal_commitments where profile_key = $1 and status = 'active'`, [userId]);
      for (const p of plans.rows) inUse.push(p.domain);
    }
  }
  if (inUse.length && !confirmed) {
    return Response.json(
      {
        error: "in_use",
        usedByPlans: [...new Set(inUse)],
        message: "This is earmarked to an active plan.",
        options: ["archive", "replace", "cancel"],
      },
      { status: 409 },
    );
  }

  const ok =
    kind === "asset" ? await deleteFinancialAsset(userId, id)
    : kind === "liability" ? await deleteLiability(userId, id)
    : kind === "income" ? await deleteIncomeStream(userId, id)
    : await deleteRecurringObligation(userId, id);
  return Response.json({ deleted: ok });
}
