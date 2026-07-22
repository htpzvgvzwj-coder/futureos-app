import { z } from "zod";
import { getCurrentUserId } from "../../../lib/auth.js";
import { proposeJointAction, listPendingJointActions } from "../../../lib/joint-action-store.js";
import { query } from "../../../lib/db.js";

export const runtime = "nodejs";

const DISPATCHABLE_ACTIONS = new Set(["pause_goal_plan", "reduce_goal_plan"]);

const proposeSchema = z.object({
  targetEmail: z.string().email(),
  domain: z.enum(["wedding", "home", "retirement"]),
  actionType: z.enum(["pause_goal_plan", "reduce_goal_plan"]),
  newMonthlyContribution: z.number().min(0),
  explanation: z.string().min(1),
});

// Lists what THIS user still needs to confirm or decline (they're the target).
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const pending = await listPendingJointActions(userId);
  return Response.json({ pending });
}

// Proposing never executes anything by itself - it only creates a pending record
// the target must separately confirm (app/api/joint-actions/[id]/confirm).
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = proposeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", detail: parsed.error.issues }, { status: 422 });
  }
  if (!DISPATCHABLE_ACTIONS.has(parsed.data.actionType)) {
    return Response.json({ error: "not_yet_dispatchable" }, { status: 400 });
  }

  const targetResult = await query(`select id from users where email = $1`, [parsed.data.targetEmail.toLowerCase()]);
  const targetUserId = targetResult.rows[0]?.id;
  if (!targetUserId) return Response.json({ error: "target_not_found" }, { status: 404 });
  if (targetUserId === userId) return Response.json({ error: "cannot_propose_to_self" }, { status: 400 });

  try {
    const action = await proposeJointAction({
      initiatorUserId: userId,
      targetUserId,
      domain: parsed.data.domain,
      actionType: parsed.data.actionType,
      payload: {
        newMonthlyContribution: parsed.data.newMonthlyContribution,
        explanation: parsed.data.explanation,
      },
    });
    return Response.json({ action });
  } catch (error) {
    if (error.code === "no_joint_grant") {
      return Response.json({ error: "no_joint_grant" }, { status: 403 });
    }
    throw error;
  }
}
