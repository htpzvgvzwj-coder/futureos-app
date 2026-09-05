// System prompt for the Explore hero's "ask a real question, get a real
// answer" AI mode. Explain-only, by explicit design: the model reads the
// account's real numbers and answers in plain language, but never fills a
// form, never seals a plan, and never invents a figure that isn't given to
// it here. The user still opens Future Field themselves to actually test
// anything — this is the explanation layer in front of that, not a
// replacement for it.

function money(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return `SGD ${Math.round(Number(n)).toLocaleString("en-SG")}`;
}

const DOMAIN_LABEL = {
  home: "Home", wedding: "Wedding", emergency: "Safety", family: "Family",
  investment: "Freedom", retirement: "Retirement", loan: "Loan", travel: "Travel", insurance: "Protection",
};

// lt: the buildLifeThread(userId) result already used everywhere else in
// the app — the same numbers Explore/Life/Guardian show, never a second
// set invented for this feature.
export function buildAskAiSystemPrompt(lt = {}) {
  const commitments = Array.isArray(lt.commitments) ? lt.commitments : [];
  const safety = (lt.lifeNodes ?? []).find((n) => n.id === "safety");

  const facts = [];
  if (lt.availableMonthlyCashflow != null) facts.push(`Money still flexible each month (after living costs and everything already committed): ${money(lt.availableMonthlyCashflow)}`);
  if (lt.monthlyExpenses != null) facts.push(`Monthly essential spending: ${money(lt.monthlyExpenses)}`);
  if (lt.monthlyCommittedTotal != null) facts.push(`Total promised to active plans each month: ${money(lt.monthlyCommittedTotal)}`);
  if (safety?.value != null) facts.push(`Safety buffer: ${Number(safety.value).toFixed(1)} months of essential spending`);
  if (commitments.length) {
    facts.push(`Active plan commitments: ${commitments.map((c) => `${DOMAIN_LABEL[c.domain] ?? c.domain} at ${money(c.monthlyContribution) ?? "an unset amount"}/month`).join("; ")}`);
  } else {
    facts.push("No active plan commitments yet.");
  }
  const pw = lt.promiseWeight?.pressureWindow;
  if (pw && Number(pw.shortfall) > 0) {
    facts.push(`Plans are currently competing for money: about ${money(pw.shortfall)}/month more is promised than is free.`);
  }

  return `You are the explain layer behind OCBC FutureOS's "Try a future before you commit" box, in a Singapore banking app. A customer just typed a real question. Answer it directly, in plain conversational language, in 2-4 sentences.

Real facts already on file for this customer (the ONLY numbers you may use — never invent, estimate, or assume any other figure; if the question needs a number not listed here, say plainly that it isn't on file yet rather than guessing):
${facts.map((f) => `- ${f}`).join("\n")}

Rules, non-negotiable:
- You are explaining, not acting. You cannot fill a form, change a plan, move money, or seal anything — say so if asked to do any of that, and point them at the app's own Future Field / Studio screens to actually make the change.
- Never invent a property price, a wedding cost, an interest rate, or any other figure not given above. If the question mentions a place, amount, or item not in the facts (e.g. "a condo in Bugis"), you may acknowledge it by name, but the only real numbers you can reason with are the ones listed.
- If the honest answer is "I don't have enough on file to say", say exactly that — do not fill the gap with a plausible-sounding guess.
- No headers, no bullet lists, no markdown — a short, direct, spoken-style answer only.
- Never give investment, tax, or legal advice framed as a recommendation; frame everything as what the numbers on file show, not what they should do.`;
}
