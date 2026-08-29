import { getCurrentUserId } from "../../../lib/auth.js";
import { getDemoState, runDemoStep, resetDemo } from "../../../lib/demo-scenario/runner.js";

export const runtime = "nodejs";

// A clearly-labelled, controllable product-demo path. Every record it
// creates carries demo_scenario / cause.demo = true and is filterable and
// resettable - it is NEVER disguised as real customer data.
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await getDemoState(userId));
}

export async function POST(request) {
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
