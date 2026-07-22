// Deterministic (no AI) amount extraction from a voice transcript - same "AI
// touches zero numbers" discipline as every *-finance.js module in this
// codebase. Picks the largest plausible currency-like number mentioned, since
// point-of-decision speech ("should I spend fifteen hundred on this") almost
// always states the price as the most prominent number. This is always shown
// back to the customer as an editable field before the verdict runs - a
// misheard number must never silently drive a financial verdict.
export function extractAmountFromTranscript(transcript) {
  if (!transcript) return null;
  const matches = [...transcript.matchAll(/\$?\s?(\d[\d,]*(?:\.\d+)?)\s?(k|thousand|usd|dollars|sgd)?/gi)];
  if (!matches.length) return null;

  const amounts = matches
    .map((match) => {
      let value = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(value)) return null;
      if (/^k$|thousand/i.test(match[2] ?? "")) value *= 1000;
      return value;
    })
    .filter((value) => value != null);

  return amounts.length ? Math.max(...amounts) : null;
}
