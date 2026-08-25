// Real, live current-price quotes for the investment catalog's real tickers
// (lib/investment-catalog.js - SGX names like D05.SI/A35.SI, US names like
// JNJ/URTH). Deliberately scoped to CURRENT PRICE only, never "expected
// return" - a live quote is an observable fact a free public source can
// actually provide; a forward-looking return projection is inherently a
// modeled assumption no live feed can honestly supply. Pretending the
// static expectedAnnualReturnPercent figures are "real-time" would be MORE
// dishonest than leaving them as the disclosed static assumptions they are
// - see lib/investment-catalog.js's own header comment.
//
// Source: Yahoo Finance's public chart endpoint - free, no API key, and
// its ticker format (D05.SI, A35.SI, ...) already matches this catalog's
// own ticker convention exactly. Unofficial/undocumented (not a contracted
// data vendor), so this must degrade honestly, never fail the customer's
// actual request - a failed quote fetch returns null, never a stale or
// invented number silently standing in for a real one.
const QUOTE_TIMEOUT_MS = 4000;

async function fetchOneQuote(ticker) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUOTE_TIMEOUT_MS);
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FutureOS-prototype/1.0)" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const asOfSeconds = meta?.regularMarketTime;
    if (typeof price !== "number" || typeof asOfSeconds !== "number") return null;
    return { price, currency: meta.currency ?? null, asOf: new Date(asOfSeconds * 1000).toISOString() };
  } catch {
    // Network error, timeout, malformed response - never let a quote-feed
    // hiccup fail the shortlist the customer actually asked for.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Fetches every distinct real ticker in parallel; entries with no ticker
// (a generic fund with no quotable real-world identity, ticker: null in
// the catalog) are simply absent from the returned map, not fetched as
// "null" - never confused with a fetch that was attempted and failed.
export async function getLiveQuotes(tickers) {
  const distinct = [...new Set(tickers.filter(Boolean))];
  const results = await Promise.all(distinct.map(async (ticker) => [ticker, await fetchOneQuote(ticker)]));
  return Object.fromEntries(results);
}
