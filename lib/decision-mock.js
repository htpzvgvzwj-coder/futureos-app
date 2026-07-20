// Local, deterministic stand-in for the Anthropic call used only when the real API request fails
// (e.g. no API credits) - see app/api/decision/check/route.js. Since the verdict category and every
// number are already fully decided by lib/decision-finance.js before this ever runs, the mock only
// ever needs to supply narrative text - never a number, never the verdict itself. Clearly flagged
// with "[Simulated]" and `mocked: true` in the route response.

const TEMPLATES = {
  go_ahead: {
    narrative:
      "[Simulated] Based on your current cashflow, this purchase looks manageable - your monthly buffer and emergency fund both stay in a healthy range afterward.",
    key_consideration:
      "[Simulated] Still worth confirming the total cost includes any fees, delivery, or installation charges before you commit.",
  },
  proceed_with_caution: {
    narrative:
      "[Simulated] This is affordable, but it noticeably tightens your monthly buffer or emergency fund - not a clear no, but there's less room for surprises afterward.",
    key_consideration:
      "[Simulated] Consider whether this can wait a month or two, or whether a smaller version of the same purchase would ease the squeeze.",
  },
  reconsider: {
    narrative:
      "[Simulated] Based on your current cashflow, this would push your monthly budget into the red or leave your emergency fund dangerously thin.",
    key_consideration:
      "[Simulated] Worth checking if there's a payment plan, a cheaper alternative, or whether this can be deferred until your other goals are further along.",
  },
};

export function buildMockNarration(verdictCategory) {
  return TEMPLATES[verdictCategory] ?? TEMPLATES.proceed_with_caution;
}
