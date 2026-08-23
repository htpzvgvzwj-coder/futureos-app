import { updateAsset, deleteAsset } from "../../../../lib/asset-store.js";
import { getCurrentUserId } from "../../../../lib/auth.js";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { name, value, strengthRating, details, notes } = body;

  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "invalid_name" }, { status: 400 });
  }
  if (value !== undefined && value !== null && !Number.isFinite(Number(value))) {
    return Response.json({ error: "invalid_value" }, { status: 400 });
  }
  if (strengthRating !== undefined && strengthRating !== null) {
    const rating = Number(strengthRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return Response.json({ error: "invalid_strength_rating" }, { status: 400 });
    }
  }

  const asset = await updateAsset(userId, id, {
    name: name.trim(),
    value: value === undefined || value === null || value === "" ? null : Number(value),
    strengthRating: strengthRating === undefined || strengthRating === null || strengthRating === "" ? null : Number(strengthRating),
    details: typeof details === "object" && details !== null ? details : {},
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
  });
  if (!asset) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ asset });
}

export async function DELETE(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteAsset(userId, id);
  if (!deleted) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
