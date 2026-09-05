// The Explore hero's AI layer is explain-only by explicit design — it
// must ground every fact in the account's real Life Thread numbers and
// never invent a figure. This locks in the prompt's own guardrails so a
// future edit can't silently loosen them.

import test from "node:test";
import assert from "node:assert/strict";
import { buildAskAiSystemPrompt } from "../lib/explore/ask-ai-prompt.js";

test("includes the account's real numbers when present", () => {
  const p = buildAskAiSystemPrompt({
    availableMonthlyCashflow: 1400,
    monthlyExpenses: 2600,
    monthlyCommittedTotal: 2500,
    lifeNodes: [{ id: "safety", value: 23.6 }],
    commitments: [{ domain: "home", monthlyContribution: 1500 }, { domain: "wedding", monthlyContribution: 1000 }],
  });
  assert.match(p, /SGD 1,400/);
  assert.match(p, /SGD 2,600/);
  assert.match(p, /23\.6 months/);
  assert.match(p, /Home at SGD 1,500\/month/);
  assert.match(p, /Wedding at SGD 1,000\/month/);
});

test("never invents a number that wasn't given, and says so explicitly", () => {
  const p = buildAskAiSystemPrompt({});
  assert.match(p, /No active plan commitments yet\./);
  assert.match(p, /never invent, estimate, or assume any other figure/i);
  assert.match(p, /say plainly that it isn't on file yet rather than guessing/i);
});

test("explain-only: forbids acting, filling forms, or sealing plans", () => {
  const p = buildAskAiSystemPrompt({});
  assert.match(p, /cannot fill a form, change a plan, move money, or seal anything/i);
});

test("surfaces a pressure-window collision when one exists", () => {
  const p = buildAskAiSystemPrompt({
    commitments: [{ domain: "home", monthlyContribution: 1500 }],
    promiseWeight: { pressureWindow: { shortfall: 300 } },
  });
  assert.match(p, /competing for money/i);
  assert.match(p, /SGD 300\/month more is promised than is free/);
});
