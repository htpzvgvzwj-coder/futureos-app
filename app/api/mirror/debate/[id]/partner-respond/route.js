import { runToolTurnWithFallback } from "../../../../../../lib/ai-fallback.js";
import { buildJointSynthesisPrompt } from "../../../../../../lib/mirror-prompts.js";
import { JOINT_SYNTHESIS_TOOL } from "../../../../../../lib/mirror-tools.js";
import { jointSynthesisSchema } from "../../../../../../lib/mirror-validation.js";
import { getCurrentUserId } from "../../../../../../lib/auth.js";
import { getDebateForParty, savePartnerRebuttal, saveJointSynthesis } from "../../../../../../lib/mirror-store.js";
import { dismissAlertsForDebate } from "../../../../../../lib/guardian-alert-store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

// Joint Debate v2's real second-side action: the partner (never the
// initiator - real authorization check below, not just anyone who can read
// the debate) submits their own real response. This is what actually makes
// them a participant instead of a data source - their own typed words,
// persisted verbatim, then genuinely woven into a joint synthesis (a real,
// separate AI call - lib/mirror-prompts.js's buildJointSynthesisPrompt),
// never a silent restatement of the original debate.
export async function POST(request, { params }) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { rebuttal } = body;
  if (typeof rebuttal !== "string" || !rebuttal.trim() || rebuttal.length > 1000) {
    return Response.json({ error: "invalid_rebuttal" }, { status: 400 });
  }

  const debate = await getDebateForParty(id, userId);
  if (!debate) return Response.json({ error: "not_found" }, { status: 404 });
  // Real authorization: only the debate's own designated partner can
  // respond, not the initiator (who already argued their side inside the
  // original debate) and not anyone else who merely has read access.
  if (debate.partner_id !== userId) {
    return Response.json({ error: "not_the_partner" }, { status: 403 });
  }

  const updated = await savePartnerRebuttal(id, userId, rebuttal.trim());
  if (!updated) {
    // Either not the real partner (already checked above) or a rebuttal
    // was already recorded - one-shot, matching customer_rebuttal's own
    // real-once-only semantics.
    return Response.json({ error: "already_responded" }, { status: 409 });
  }

  let result;
  try {
    result = await runToolTurnWithFallback({
      systemPrompt: buildJointSynthesisPrompt(updated.context?.language ?? "en", {
        situation: updated.situation,
        goalLabel: updated.context?.goalLabel ?? updated.goal_type,
        bullCase: updated.bull_case,
        bearCase: updated.bear_case,
        bullRebuttal: updated.bull_rebuttal,
        judgeSynthesis: updated.judge_synthesis,
        recommendedAction: updated.recommended_action,
        partnerRebuttal: updated.partner_rebuttal,
      }),
      tool: JOINT_SYNTHESIS_TOOL,
      userMessage: "Write the joint synthesis.",
    });
  } catch (error) {
    console.error("mirror/debate/partner-respond: all configured AI providers failed", error.attempts ?? error);
    // The partner's real rebuttal is already saved even if this step fails -
    // never lose their real input over a synthesis-step outage.
    return Response.json({ error: "upstream_error", debate: updated }, { status: 502 });
  }

  if (result.refusal || !result.toolInput) {
    return Response.json({ error: result.refusal ? "refusal" : "inconclusive", debate: updated }, { status: 422 });
  }

  const parsed = jointSynthesisSchema.safeParse(result.toolInput);
  if (!parsed.success) {
    console.error("mirror/debate/partner-respond tool output failed validation", parsed.error.issues);
    return Response.json({ error: "validation_failed", debate: updated }, { status: 422 });
  }

  const final = await saveJointSynthesis(id, { jointSynthesis: parsed.data.jointSynthesis, alignment: parsed.data.alignment });
  await dismissAlertsForDebate(userId, id);

  return Response.json({ debate: final });
}
