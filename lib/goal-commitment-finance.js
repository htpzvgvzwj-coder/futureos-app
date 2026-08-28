// Pure computation, no DB/AI - same discipline as every other
// lib/*-finance.js. A commitment's real execution state is DERIVED live
// against the customer's current real emergency buffer, never a stored
// flag that could drift stale - so "Guardian paused this" is always
// evaluated against today's real numbers, not whatever was true when the
// commitment was created.
export function evaluateCommitmentExecutionState({ commitment, emergencyBufferMonths }) {
  if (commitment.status === "revoked") return "revoked";
  if (emergencyBufferMonths < Number(commitment.pause_if_emergency_months_below)) return "paused";
  return "active";
}
