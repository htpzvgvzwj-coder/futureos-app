import { getCurrentUserId } from "../../../../lib/auth.js";
import { seedFirstPath, seedableDomains } from "../../../../lib/future-field/seed.js";
import { guard } from "../../../../lib/http-guards.js";

export const runtime = "nodejs";

// POST /api/future-field/seed
//   { domain, answers: {questionId: answerId}, exactAmounts?: {field: number},
//     mode: "confirmed" | "estimate" }
//
// Creates the FIRST draft plan + version + branch for a domain from the
// StudioEntryBridge answers, so a brand-new user is never stuck on a
// static "no plan" page. An "estimate" seed is a real, explorable draft
// that CANNOT be sealed until the flagged values are confirmed.
export async function POST(request) {
  const blocked = guard(request, { bucket: "studio-seed", limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const domain = body.domain;
  if (!seedableDomains().includes(domain)) {
    return Response.json({ error: "domain_not_supported", supported: seedableDomains() }, { status: 400 });
  }
  const mode = body.mode === "estimate" ? "estimate" : "confirmed";

  const result = await seedFirstPath(userId, domain, {
    answers: body.answers ?? {},
    exactAmounts: body.exactAmounts ?? {},
    mode,
  });

  if (!result.ok) {
    const status = result.error === "missing_answers" ? 422 : 400;
    return Response.json(result, { status });
  }
  return Response.json({ ...result, hasRealityPath: true }, { status: 201 });
}
