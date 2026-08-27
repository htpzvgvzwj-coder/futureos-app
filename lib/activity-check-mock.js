export function buildMockActivityCheckNarration(check) {
  if (!check.hasHistory) {
    return {
      narrative: "[Simulated] No real confirmed history yet to compare this against.",
      key_consideration: "[Simulated] This check gets more useful once you've confirmed a few real plans.",
    };
  }
  if (check.unusual) {
    return {
      narrative: `[Simulated] This is SGD ${check.amount}, well above anything you've confirmed before (largest so far: SGD ${check.maxHistoricalAmount}).`,
      key_consideration: "[Simulated] Worth a second look before confirming - not a block, just a real flag.",
    };
  }
  return {
    narrative: `[Simulated] This is in line with your real history (largest before: SGD ${check.maxHistoricalAmount}).`,
    key_consideration: "[Simulated] Nothing unusual here based on your own past commitments.",
  };
}
