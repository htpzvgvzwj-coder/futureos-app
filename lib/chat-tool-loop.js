import { deepCleanStrayEscapes, findToolUse, runToolTurn } from "./anthropic-client.js";

// Every other domain's AI tool in this app is structured-output-only - the
// model "calls" propose_plans, but the app never actually *runs* anything,
// it's just how typed JSON gets out of the model (see
// buildFollowUpUserContent's "synthesize a fake ack tool_result" trick,
// which relies on this - it works because nothing real happened that the
// model needs to know the outcome of).
//
// A real chat tool (e.g. Mirror chat's run_debate) is different: when the
// model calls it, the server actually executes real logic (a real
// computation, a real DB write) and the model needs the REAL result back in
// the same turn before its response is considered final - narrating a
// result it was never actually given would violate the same "never invent
// what you don't have" discipline every other domain's prompts already
// enforce, just for a tool result instead of a dollar figure.
//
// This loops: call the model -> if it called a known LOCAL tool, actually
// execute it and feed the real result back as a genuine tool_result -> call
// again -> repeat until the model responds with something other than a
// local tool call (plain text, a refusal, or a tool this loop doesn't know
// about, e.g. a "final answer" tool a caller might add later). Anthropic's
// own server-side tool continuation (stop_reason "pause_turn", e.g.
// web_search) is handled transparently by runToolTurn on every iteration -
// this loop only adds handling for tools THIS APP defines and executes.
const MAX_TOOL_ITERATIONS = 4;

export async function runChatTurnWithTools(client, params, toolExecutors) {
  let messages = [...params.messages];
  const toolResults = [];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const response = await runToolTurn(client, { ...params, messages });

    if (response.stop_reason === "refusal") {
      return { response, toolResults };
    }

    const toolUse = findToolUse(response.content, Object.keys(toolExecutors));
    if (!toolUse) {
      return { response, toolResults };
    }

    const cleanedInput = deepCleanStrayEscapes(toolUse.input);
    const result = await toolExecutors[toolUse.name](cleanedInput);
    toolResults.push({ name: toolUse.name, input: cleanedInput, result });

    messages = [
      ...messages,
      { role: "assistant", content: response.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }] },
    ];
  }

  const error = new Error("chat_tool_loop_exceeded_max_iterations");
  error.code = "max_iterations_exceeded";
  throw error;
}
