// Explore's hero ("Try a future before you commit") promises to test ANY
// free-text question the user types. This decides which domain's Future
// Field it opens. Pure, no DB — kept out of ExploreView.jsx so it's
// directly unit-testable (a bug here silently broke that promise for a
// whole class of typed questions, with no way to catch it from a
// component test).

export function domainForQuestion(q) {
  const s = String(q || "").toLowerCase();
  if (/wedding|marry|marriage/.test(s)) return "wedding";
  if (/debt|loan|repay|pay.*(down|off)|mortgage/.test(s)) return "loan";
  if (/home|house|flat|hdb|condo|property|down ?payment|buy a place/.test(s)) return "home";
  if (/retire|pension|old age/.test(s)) return "retirement";
  if (/travel|trip|holiday|vacation/.test(s)) return "travel";
  if (/invest|portfolio|stocks|etf/.test(s)) return "investment";
  if (/insur|cover|protect/.test(s)) return "insurance";
  if (/emergency|buffer|runway|survive|job loss|income stop/.test(s)) return "emergency";
  if (/family|share|kid|child|parent|elder/.test(s)) return "family";
  return null;
}

// ALWAYS opens Future Field — never silently diverts elsewhere. It used
// to send spend/afford-shaped questions with no detected domain straight
// to the Financial Twin instead ("Is it safe to spend $500 now?" -> Twin,
// not a test), which broke the hero's own promise for that entire class
// of typed questions.
export function routeForQuestion(q) {
  const d = domainForQuestion(q);
  // A concrete ask ("buy home 6 months sooner") goes straight into Future
  // Field with the text so it can pre-fill the peel form; a bare mention
  // of a life area with no real ask, or no domain detected at all, opens
  // the Studio's framed preview (defaulting to Home).
  return `future_field:${d ?? "home"}:ask:${encodeURIComponent(q)}`;
}
