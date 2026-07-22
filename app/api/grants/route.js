import { z } from "zod";
import { getCurrentUserId } from "../../../lib/auth.js";
import { createGrant, listGrantsGiven, listGrantsReceived } from "../../../lib/access-grant-store.js";
import { query } from "../../../lib/db.js";

export const runtime = "nodejs";

const createGrantSchema = z.object({
  granteeEmail: z.string().email(),
  scope: z.enum(["all", "wedding", "home", "retirement", "other", "hardship", "loan", "investment"]),
  accessLevel: z.enum(["view", "view_and_act"]),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [given, received] = await Promise.all([listGrantsGiven(userId), listGrantsReceived(userId)]);
  return Response.json({ given, received });
}

export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createGrantSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }

  const granteeResult = await query(`select id from users where email = $1`, [parsed.data.granteeEmail.toLowerCase()]);
  const granteeUserId = granteeResult.rows[0]?.id;
  if (!granteeUserId) {
    return Response.json({ error: "grantee_not_found" }, { status: 404 });
  }
  if (granteeUserId === userId) {
    return Response.json({ error: "cannot_grant_self" }, { status: 400 });
  }

  const grant = await createGrant({
    grantorUserId: userId,
    granteeUserId,
    scope: parsed.data.scope,
    accessLevel: parsed.data.accessLevel,
    expiresAt: parsed.data.expiresAt ?? null,
  });
  return Response.json({ grant });
}
