"use client";

// Explore — a future experiment bench, not a feature menu. It shows
// outputs, not options: what Future Bank can already see, test and change.
//
//   Hero            try a future before you commit — one before → after
//   Signature       Future Field · Financial Twin · Impact Map ·
//                   Money Rescue · Guardian — each with a live proof
//   Life Studios    the same abilities as life scenarios, one at a time
//   Recent Futures  the changes you (or the system) just tried
//   Data sources    the outside links, demoted — status, not a headline
//   All tools       everything else, in a compact drawer

import { useEffect, useMemo, useState } from "react";
import css from "../../showcase/fb.module.css";
import x from "./explore.module.css";
import { FeatureHistory } from "./FeatureHistory.jsx";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { useTx } from "./i18n.jsx";
import {
  costOfDelay, negativeRecommendations, stressTest, receiptFromLedgerEvent, traceSecondOrder, nextBestQuestion,
} from "../../../lib/explore/differentiation.js";

const money = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
const yearOf = (s) => {
  const m = /^(\d{4})/.exec(String(s ?? ""));
  return m ? m[1] : null;
};

// Studios as questions, not nouns. Each names what it shows.
const STUDIOS = [
  { domain: "home", name: "Home", q: "Can I buy sooner without breaking my safety room?", shows: ["Ready month", "Down-payment path", "Impact on emergency, wedding, retirement"] },
  { domain: "wedding", name: "Wedding", q: "Can we afford the wedding we want?", shows: ["Guest count vs budget", "Partner split", "What it delays"] },
  { domain: "loan", name: "Loan", q: "What if I pay this down faster?", shows: ["Debt-free date", "Freed money per month", "Best next use"] },
  { domain: "retirement", name: "Retire", q: "What future income gap am I creating?", shows: ["Future income gap", "Lifestyle trade-off"] },
  { domain: "travel", name: "Travel", q: "Can this trip fit without regret?", shows: ["Buffer after the trip", "Regret risk"] },
  { domain: "investment", name: "Invest", q: "What money can safely leave cash?", shows: ["Liquidity gate", "Investable room", "Harmed goal if too high"] },
  { domain: "insurance", name: "Protect", q: "What would still be uncovered?", shows: ["Protection gap", "Premium pressure"] },
  { domain: "emergency", name: "Emergency", q: "How many months can I survive?", shows: ["Months covered", "Rebuild path"] },
  { domain: "family", name: "Family", q: "What can we share without exposing everything?", shows: ["Shared band", "Permission boundary"] },
];

// A free-text question -> the best place to test it.
function routeForQuestion(q) {
  const s = String(q || "").toLowerCase();
  if (/wedding|marry|marriage/.test(s)) return "studio:wedding";
  if (/debt|loan|repay|pay.*(down|off)|mortgage/.test(s)) return "studio:loan";
  if (/home|house|flat|hdb|condo|property|down ?payment|buy a place/.test(s)) return "studio:home";
  if (/retire|pension|old age/.test(s)) return "studio:retirement";
  if (/travel|trip|holiday|vacation/.test(s)) return "studio:travel";
  if (/invest|portfolio|stocks|etf/.test(s)) return "studio:investment";
  if (/insur|cover|protect/.test(s)) return "studio:insurance";
  if (/emergency|buffer|runway|survive|job loss|income stop/.test(s)) return "studio:emergency";
  if (/spend|afford|can i|safe to/.test(s)) return "twin";
  return "future_field";
}

const ALL_TOOLS = [
  { group: "Everyday banking", items: [
    { label: "Pay & transfer", route: "today" },
    { label: "Scan & Pay", route: "today" },
    { label: "Currency exchange", route: "today" },
  ] },
  { group: "Understand your money", items: [
    { label: "Financial Twin", route: "twin" },
    { label: "Spending Intelligence", route: "spending" },
    { label: "Import a statement", route: "today" },
  ] },
  { group: "Solve a problem", items: [
    { label: "Money Rescue", route: "rescue" },
    { label: "A failed payment", route: "rescue" },
    { label: "An unfamiliar transaction", route: "rescue" },
  ] },
  { group: "Protect", items: [
    { label: "Guardian", route: "guardian" },
    { label: "Family & Care", route: "family" },
    { label: "Change Ledger", route: "history" },
  ] },
];

export function ExploreView(props) {
  return (
    <FutureBankDataProvider enabled>
      <Inner {...props} />
    </FutureBankDataProvider>
  );
}

function ExploreDelayRow({ r, tx, money }) {
  return (
    <>
      <span className={r.delta === 0 ? x.delayNow : undefined}>{tx(r.label)}</span>
      <span>{r.readyYear}</span>
      <span>{r.bufferMonthsAfter != null ? `${r.bufferMonthsAfter} mo` : "—"}</span>
      <span>{r.monthlyRoomAfter != null ? money(r.monthlyRoomAfter) : "—"}</span>
    </>
  );
}

function Inner({ onRoute, onStudio }) {
  const { tx } = useTx();
  const fb = useFutureBankData();
  const lt = fb.lifeThread ?? {};
  const twin = fb.twin ?? {};
  const s2s = twin.safeToSpend ?? {};

  const [q, setQ] = useState("");
  const [openStudio, setOpenStudio] = useState("home");
  const [spendPreview, setSpendPreview] = useState(false);
  const [delayOpen, setDelayOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [guardian, setGuardian] = useState(null);
  const [latestEvent, setLatestEvent] = useState(null);
  const [sampleBusy, setSampleBusy] = useState(false);

  useEffect(() => {
    fetch("/api/guardian", { headers: { "cache-control": "no-cache" } }).then((r) => (r.ok ? r.json() : null)).then(setGuardian).catch(() => {});
    fetch("/api/change-ledger", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLatestEvent((d?.events ?? []).find((e) => Array.isArray(e.impact_set) && e.impact_set.length) ?? null))
      .catch(() => {});
  }, [fb.version]);

  const looksEmpty = !Number(twin?.twin?.netWorth) && (lt.commitments?.length ?? 0) === 0;
  const sample = async (action) => {
    setSampleBusy(true);
    await fetch("/api/account/sample-data", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => {});
    setSampleBusy(false);
    await fb.refetchAll?.();
  };

  // ---- live proofs -------------------------------------------------
  const homeNode = (lt.lifeNodes ?? []).find((n) => n.id === "home");
  const homeYear = yearOf(homeNode?.horizon);
  const room = lt.availableMonthlyCashflow;
  const needs = fb.momentsRaw?.counts?.actionRequired ?? 0;
  const topRescue = (fb.moments ?? []).find((m) => m.state === "new" && (m.severity === "action_required" || m.kind?.includes?.("rescue") || m.kind?.includes?.("payment")));
  const gProtected = guardian?.protection?.summary ?? null;
  const gNeeds = (guardian?.now?.level && ["decision", "urgent"].includes(guardian.now.level)) ? 1 : 0;
  const pw = lt.promiseWeight?.pressureWindow ?? null;

  const spendAmt = useMemo(() => {
    const base = Number(s2s.safeToSpend) || 0;
    if (base <= 0) return 0;
    return Math.max(200, Math.round((base * 0.16) / 100) * 100); // ~a sixth of what's safe
  }, [s2s.safeToSpend]);
  const spendAfter = (Number(s2s.safeToSpend) || 0) - spendAmt;

  // ---- deeper differentiation: computed from real data --------------
  const twinCtx = {
    essentialMonthly: lt.monthlyExpenses,
    monthlyExpenses: lt.monthlyExpenses,
    bufferMonths: (lt.lifeNodes ?? []).find((n) => n.id === "safety")?.value,
    monthlyRoom: lt.availableMonthlyCashflow,
    liquidBuffer: s2s.breakdown?.postedLiquidCash,
    safeToSpend: s2s,
  };
  const homeContribution = (lt.commitments ?? []).find((c) => c.domain === "home")?.monthlyContribution ?? 0;
  const delay = useMemo(
    () => (homeContribution > 0 && homeYear ? costOfDelay({ domain: "home", monthlyContribution: homeContribution, readyYear: homeYear, twin: twinCtx }) : null),
    [homeContribution, homeYear, lt.monthlyExpenses, lt.availableMonthlyCashflow],
  );
  const secondOrder = useMemo(() => traceSecondOrder({ primaryDomain: "home", direction: "earlier", lt }), [lt.crossGoalEdges]);
  const negatives = useMemo(() => negativeRecommendations({ lt, s2s }), [lt.availableMonthlyCashflow, lt.promiseWeight, s2s.safeToSpend, s2s.belowProtectedFloor]);
  const stress = useMemo(() => stressTest({ lt, twin: twinCtx, shock: "income_1mo" }), [lt.monthlyCommittedTotal, lt.monthlyExpenses, s2s.breakdown]);
  const receipt = useMemo(() => (latestEvent ? receiptFromLedgerEvent(latestEvent, tx) : null), [latestEvent]);

  const submitQuestion = () => {
    if (!q.trim()) return onRoute("future_field");
    onRoute(routeForQuestion(q));
  };

  const studio = STUDIOS.find((st) => st.domain === openStudio) ?? STUDIOS[0];

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        {/* ---- Hero ---- */}
        <div className={x.hero}>
          <h1 className={x.heroTitle}>{tx("Try a future before you commit")}</h1>
          <p className={x.heroSub}>{tx("See how one decision moves your money, your plans and your safety room.")}</p>
          <form
            className={x.heroForm}
            onSubmit={(e) => { e.preventDefault(); submitQuestion(); }}
          >
            <input
              className={x.heroInput}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tx("What do you want to test?")}
              aria-label={tx("What do you want to test?")}
            />
            <button type="submit" className={x.heroGo} aria-label={tx("Test it")}>→</button>
          </form>
          <div className={x.quickRow}>
            <button type="button" className={x.quick} onClick={() => (delay ? setDelayOpen((v) => !v) : onRoute("studio:home"))}>{tx("Buy home sooner")}</button>
            <button type="button" className={x.quick} onClick={() => onRoute("studio:loan")}>{tx("Pay debt faster")}</button>
            {spendAmt > 0 ? (
              <button type="button" className={x.quick} onClick={() => setSpendPreview((v) => !v)}>{tx("Spend {amt} safely", { amt: money(spendAmt) })}</button>
            ) : null}
          </div>

          {delayOpen && delay ? (
            <div className={x.preview}>
              <span className={x.previewHead}>{tx("The cost of waiting — or not")}</span>
              <div className={x.delayGrid}>
                <span />
                <span className={x.delayCol}>{tx("Ready")}</span>
                <span className={x.delayCol}>{tx("Buffer")}</span>
                <span className={x.delayCol}>{tx("Room")}</span>
                {delay.rows.map((r) => (
                  <ExploreDelayRow key={r.delta} r={r} tx={tx} money={money} />
                ))}
              </div>
              {secondOrder ? (
                <span className={x.chain}>
                  {secondOrder.chain.map((c, i) => (
                    <span key={i}>{i > 0 ? " → " : ""}<b>{tx(c.node)}</b> {tx(c.effect)}</span>
                  ))}
                </span>
              ) : null}
              <span className={css.micro}>{tx("Estimate. Open the Home Studio to test it against your real numbers.")}</span>
              <div className={x.previewActs}>
                <button type="button" className={css.cta} onClick={() => onStudio("home")}>{tx("Open Home Studio")}</button>
              </div>
            </div>
          ) : null}

          {spendPreview && spendAmt > 0 ? (
            <div className={x.preview}>
              <span className={x.previewHead}>{tx("If you spend {amt} now", { amt: money(spendAmt) })}</span>
              <div className={x.previewRow}><span>{tx("Safe-to-Spend")}</span><span>{money(s2s.safeToSpend)} <b>→</b> {money(spendAfter)}</span></div>
              <div className={x.previewRow}><span>{tx("Protected reserve")}</span><span>{money(s2s.breakdown?.protectedReserve)} · {tx("untouched")}</span></div>
              <div className={x.previewRow}><span>{tx("Below your safety line?")}</span><span>{spendAfter < 0 || s2s.belowProtectedFloor ? tx("yes — Guardian would step in") : tx("no")}</span></div>
              <div className={x.previewActs}>
                <button type="button" className={css.cta} onClick={() => onRoute("twin")}>{tx("Open Financial Twin")}</button>
                <button type="button" className={css.link} onClick={() => onRoute("future_field")}>{tx("Test in Future Field")}</button>
              </div>
            </div>
          ) : null}
        </div>

        {looksEmpty ? (
          <button type="button" className={css.partial} onClick={() => sample("load")} disabled={sampleBusy}>
            <b>{sampleBusy ? tx("Working…") : tx("Nothing to test yet — load an example account")}</b>
            <span>{tx("Accounts, 90 days of spending, plans, CPF and links. Only your data; clear it any time.")}</span>
          </button>
        ) : null}

        {/* ---- Signature features (1 + 4) ---- */}
        <section className={css.section}>
          <p className={css.kicker}>{tx("What Future Bank does")}</p>

          <button type="button" className={x.sigBig} onClick={() => onRoute("future_field")}>
            <span className={x.sigKind}>{tx("Future Field")}</span>
            <b className={x.sigLead}>{tx("Test a decision before it becomes real.")}</b>
            <span className={x.timeline}>
              <span className={x.tlNode}>{tx("Today")}</span>
              <span className={x.tlLine} />
              <span className={`${x.tlNode} ${x.tlDecision}`}>{tx("Decision")}</span>
              <span className={x.tlLine} />
              <span className={x.tlNode}>{tx("Future")}</span>
            </span>
            <span className={x.sigProof}>
              {homeYear ? tx("e.g. move Home from {y} — see what it costs elsewhere", { y: homeYear }) : tx("Move any plan and watch the whole line respond")}
            </span>
          </button>

          <div className={x.sigGrid}>
            <button type="button" className={x.sigCard} onClick={() => onRoute("twin")}>
              <span className={x.sigKind}>{tx("Financial Twin")}</span>
              <span className={x.sigDesc}>{tx("Your real financial body, not just balances.")}</span>
              <span className={x.sigLayers}>{tx("Assets")} · {tx("Debt")} · {tx("Room")} · {tx("Promises")}</span>
              <span className={x.sigProof}>{room != null ? tx("Monthly room: {v} after bills and promises", { v: money(room) }) : tx("Add your income to see your monthly room")}</span>
            </button>

            <button type="button" className={x.sigCard} onClick={() => onRoute("impact_map")}>
              <span className={x.sigKind}>{tx("Impact Map")}</span>
              <span className={x.sigDesc}>{tx("See what moved elsewhere.")}</span>
              <span className={x.sigProof}>
                {pw && Number(pw.shortfall) > 0
                  ? tx("Home and Wedding are {v}/mo short of what's free", { v: money(pw.shortfall) })
                  : tx("Home, Safety and Wedding pull on each other — see how")}
              </span>
            </button>

            <button type="button" className={x.sigCard} onClick={() => onRoute("rescue")}>
              <span className={x.sigKind}>{tx("Money Rescue")}</span>
              <span className={x.sigDesc}>{tx("When money goes wrong — problem, risk, next move.")}</span>
              <span className={x.sigProof}>
                {topRescue ? topRescue.title : needs > 0 ? tx("{n} things need review", { n: needs }) : tx("Nothing wrong right now")}
              </span>
            </button>

            <button type="button" className={x.sigCard} onClick={() => onRoute("guardian")}>
              <span className={x.sigKind}>{tx("Guardian")}</span>
              <span className={x.sigDesc}>{tx("Watches, asks, never moves money on its own.")}</span>
              <span className={x.sigProof}>
                {gProtected
                  ? tx("Watching {p} of {t} promises · {n} need permission", { p: gProtected.protectedCount, t: gProtected.total, n: gNeeds })
                  : tx("Watching your promises and your safety line")}
              </span>
            </button>
          </div>
        </section>

        {/* ---- Before you commit: what NOT to do + a stress test ---- */}
        {(negatives.items.length || stress) ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("Before you commit")}</p>

            {negatives.items.map((n, i) => (
              <div key={i} className={x.dont}>
                <b>{tx(n.dont)}</b>
                <span className={css.micro}>{tx(n.because)}</span>
              </div>
            ))}

            {stress ? (
              <div className={x.stress}>
                <b>{tx(stress.shock)}</b>
                {stress.survivesShock ? (
                  <span className={css.micro}>
                    {tx("Your line holds — about {n} months of runway before anything breaks.", { n: stress.monthsOfRunway })}
                    {stress.weakestPlan ? ` ${tx("Pausing {d} would stretch it further.", { d: tx(stress.weakestPlan.label) })}` : ""}
                  </span>
                ) : (
                  <span className={css.micro}>
                    {tx("It breaks around {m} — short by {v}.", { m: stress.breaksAt, v: money(stress.shortBy) })}
                    {stress.weakestPlan ? ` ${tx("Pausing {d} buys about {n} months.", { d: tx(stress.weakestPlan.label), n: stress.weakestPlan.pausingBuysMonths })}` : ""}
                  </span>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ---- Life Studios ---- */}
        <section className={css.section}>
          <p className={css.kicker}>{tx("Life Studios")}</p>
          <div className={x.studioTabs}>
            {STUDIOS.map((st) => (
              <button
                key={st.domain}
                type="button"
                className={`${x.studioTab} ${openStudio === st.domain ? x.studioTabOn : ""}`}
                onClick={() => setOpenStudio(st.domain)}
              >
                {tx(st.name)}
              </button>
            ))}
          </div>
          <div className={x.studioPreview}>
            <b className={x.studioQ}>{tx(studio.q)}</b>
            <ul className={x.studioShows}>
              {studio.shows.map((s) => <li key={s}>{tx(s)}</li>)}
            </ul>
            {(() => {
              const oq = nextBestQuestion({ domain: studio.domain, known: [] });
              return oq ? <span className={x.oneQ}>{tx("Answer one thing to sharpen this:")} {tx(oq.q)}</span> : null;
            })()}
            <button type="button" className={css.cta} onClick={() => onStudio(studio.domain)}>{tx("Explore {name}", { name: tx(studio.name) })}</button>
          </div>
        </section>

        {/* ---- Recent Futures ---- */}
        <section className={css.section}>
          <p className={css.kicker}>{tx("Recent futures")}</p>
          {receipt && receipt.lines.length ? (
            <div className={x.receipt}>
              <span className={x.previewHead}>{tx("Future receipt")}</span>
              <b>{tx("You tested:")} {receipt.title}</b>
              {receipt.lines.map((l, i) => (
                <div key={i} className={x.receiptRow}>
                  <span>{tx(l.label)}</span>
                  <span>{l.before} <b>→</b> {l.after}{l.delta ? ` (${l.delta})` : ""}</span>
                </div>
              ))}
              <span className={css.micro}>{tx("Estimate, recomputed from your Change Ledger.")}</span>
            </div>
          ) : null}
          <FeatureHistory feature="explore" label="Recent futures" />
        </section>

        {/* ---- Data sources (demoted) ---- */}
        <section className={css.section}>
          <p className={css.kicker}>{tx("Data sources")}</p>
          <p className={css.micro}>
            {tx("Outside links are off until configured — nothing is estimated in their place.")}
            {" "}
            <button type="button" className={css.link} onClick={() => onRoute("connections")}>{tx("See what's limited →")}</button>
          </p>
        </section>

        {/* ---- All tools ---- */}
        <section className={css.section}>
          <button type="button" className={css.link} onClick={() => setToolsOpen((v) => !v)}>
            {toolsOpen ? tx("Hide all tools") : tx("All tools")}
          </button>
          {toolsOpen ? (
            <div className={x.tools}>
              {ALL_TOOLS.map((grp) => (
                <div key={grp.group} className={x.toolGroup}>
                  <span className={css.micro}>{tx(grp.group)}</span>
                  {grp.items.map((it) => (
                    <button key={it.label} type="button" className={css.link} onClick={() => onRoute(it.route)}>{tx(it.label)}</button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
