import { getCurrentUserId } from "../../../lib/auth.js";
import { getDemoState, runDemoStep, resetDemo } from "../../../lib/demo-scenario/runner.js";

export const runtime = "nodejs";

// Development-only walkthrough fixture. Not a user-facing feature: it is
// gated to non-production builds with an explicit FUTUREOS_DEV_FIXTURES
// flag, and every row it writes carries cause.demo = true so it can be
// filtered and reset. There is no UI entry point to it.
const ENABLED = process.env.NODE_ENV !== "production" && process.env.FUTUREOS_DEV_FIXTURES === "1";

function guard() {
  if (!ENABLED) return Response.json({ error: "not_found" }, { status: 404 });
  return null;
}

export async function GET(request) {
  const blocked = guard();
  if (blocked) return blocked;
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await getDemoState(userId));
}

export async function POST(request) {
  const blocked = guard();
  if (blocked) return blocked;
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body.action === "reset") {
    return Response.json(await resetDemo(userId));
  }
  if (!body.step) return Response.json({ error: "missing_step" }, { status: 400 });

  const result = await runDemoStep(userId, body.step);
  if (result.error) return Response.json(result, { status: 422 });
  return Response.json(result);
}
