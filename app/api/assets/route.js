import { listAssets, createAsset } from "../../../lib/asset-store.js";
import { getCurrentUserId } from "../../../lib/auth.js";
import { isValidCategory, isValidSubtype } from "../../../lib/asset-taxonomy.js";

export const runtime = "nodejs";

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const assets = await listAssets(userId);
  return Response.json({ assets });
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { category, subtype, name, value, strengthRating, details, notes } = body;

  if (!isValidCategory(category) || !isValidSubtype(category, subtype)) {
    return Response.json({ error: "invalid_taxonomy" }, { status: 400 });
  }
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

  const asset = await createAsset(userId, {
    category,
    subtype,
    name: name.trim(),
    value: value === undefined || value === null || value === "" ? null : Number(value),
    strengthRating: strengthRating === undefined || strengthRating === null || strengthRating === "" ? null : Number(strengthRating),
    details: typeof details === "object" && details !== null ? details : {},
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
  });
  return Response.json({ asset });
}
