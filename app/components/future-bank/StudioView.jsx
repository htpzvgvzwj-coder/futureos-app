"use client";

// One Studio, one shape. Not a fintech calculator screen: a question, the
// single result sentence, the impact strip it moves, the one input that
// would sharpen it, and three honest actions. The draggable scene itself
// lives in Future Field — this is the framed way in.

import { useEffect, useMemo, useState } from "react";
import css from "../../showcase/fb.module.css";
import x from "./explore.module.css";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { useTx } from "./i18n.jsx";
import { costOfDelay, nextBestQuestion, traceSecondOrder } from "../../../lib/explore/differentiation.js";

const money = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
const yr = (s) => { const m = /^(\d{4})/.exec(String(s ?? "")); return m ? m[1] : null; };

const STUDIO = {
  home: { name: "Home", q: "Can I buy sooner without breaking my safety room?" },
  wedding: { name: "Wedding", q: "Can we afford the wedding we want?" },
  loan: { name: "Loan", q: "What if I pay this down faster?" },
  retirement: { name: "Retirement", q: "What future income gap am I creating?" },
  travel: { name: "Travel", q: "Can this trip fit without regret?" },
  investment: { name: "Investing", q: "What money can safely leave cash?" },
  insurance: { name: "Protection", q: "What would still be uncovered?" },
  emergency: { name: "Emergency", q: "How many months can I survive?" },
  family: { name: "Family", q: "What can we share without exposing everything?" },
};
const NODE_FOR = { home: "home", wedding: "relationships", family: "relationships", investment: "freedom", retirement: "future", emergency: "safety", loan: "freedom", travel: "freedom" };

export function StudioView(props) {
  return (
    <FutureBankDataProvider enabled>
      <Inner {...props} />
    </FutureBankDataProvider>
  );
}

function Inner({ domain = "home", onBack, onRoute }) {
  const { tx } = useTx();
  const fb = useFutureBankData();
  const lt = fb.lifeThread ?? {};
  const s = STUDIO[domain] ?? STUDIO.home;

  const [field, setField] = useState(null);
  useEffect(() => {
    fetch(`/api/future-field?domain=${encodeURIComponent(domain)}`, { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setField)
      .catch(() => setField(null));
  }, [domain]);

  const data = field?.realityPath?.data ?? {};
  const node = (lt.lifeNodes ?? []).find((n) => n.id === NODE_FOR[domain]);
  const horizonYear = yr(node?.horizon) ?? yr(data.target_complete_month) ?? yr(data.wedding_date);
  const monthly = (lt.commitments ?? []).find((c) => c.domain === domain)?.monthlyContribution
    ?? Number(data.monthly_contribution) ?? Number(data.monthly_commitment) ?? 0;
  const room = lt.availableMonthlyCashflow;
  const buffer = (lt.lifeNodes ?? []).find((n) => n.id === "safety")?.value;

  const delay = useMemo(() => {
    if (!(monthly > 0)) return null;
    const twin = { essentialMonthly: lt.monthlyExpenses, bufferMonths: buffer, monthlyRoom: room };
    if (domain === "home" && data.estimated_price && data.down_payment_ratio != null) {
      return costOfDelay({
        domain, monthlyContribution: monthly, readyYear: horizonYear, twin,
        downPaymentNeeded: Math.round(Number(data.estimated_price) * Number(data.down_payment_ratio)),
        currentSavings: Number(data.current_savings) || 0,
      });
    }
    return costOfDelay({ domain, monthlyContribution: monthly, readyYear: horizonYear, twin });
  }, [domain, monthly, horizonYear, data.estimated_price, lt.monthlyExpenses, room, buffer]);

  const secondOrder = useMemo(() => traceSecondOrder({ primaryDomain: domain, direction: "earlier", lt }), [domain, lt.crossGoalEdges]);
  const oneQ = nextBestQuestion({ domain, known: Object.keys(data).filter((k) => data[k] != null) });

  const now = delay?.rows.find((r) => r.delta === 0);
  const sooner = delay?.rows.find((r) => r.delta === -12);

  // one-sentence result
  const result = !(monthly > 0)
    ? tx("You haven't put a monthly amount on {name} yet — start it and this fills in.", { name: tx(s.name) })
    : sooner
      ? tx("Buying about a year sooner moves {name} to {y}, but your safety buffer drops from {b1} to {b2} months.", {
          name: tx(s.name), y: sooner.readyYear, b1: now?.bufferMonthsAfter, b2: sooner.bufferMonthsAfter,
        })
      : tx("{name} sits on your line for {y}, taking {m}/month. Change it and the rest of your line responds.", {
          name: tx(s.name), y: horizonYear ?? "—", m: money(monthly),
        });

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <button type="button" className={css.backLink} onClick={onBack}>← {tx("Explore")}</button>

        {/* Top result */}
        <div>
          <h1 className={css.title}>{tx(s.q)}</h1>
          <p className={css.lede}>{result}</p>
        </div>

        {/* Main object -> the real draggable scene */}
        <button type="button" className={x.sigBig} onClick={() => onRoute(`future_field:${domain}`)}>
          <span className={x.sigKind}>{tx("Future Field")}</span>
          <b className={x.sigLead}>{tx("Drag the plan and watch your line move")}</b>
          <span className={x.timeline}>
            <span className={x.tlNode}>{tx("Today")}</span><span className={x.tlLine} />
            <span className={`${x.tlNode} ${x.tlDecision}`}>{tx("Change")}</span><span className={x.tlLine} />
            <span className={x.tlNode}>{horizonYear ?? tx("Future")}</span>
          </span>
        </button>

        {/* Impact strip */}
        {delay ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("What moves")}</p>
            <div className={x.delayGrid} style={{ color: "var(--ink)" }}>
              <span />
              <span className={x.delayCol}>{tx("Ready")}</span>
              <span className={x.delayCol}>{tx("Buffer")}</span>
              <span className={x.delayCol}>{tx("Room")}</span>
              {delay.rows.filter((r) => [-12, 0, 12].includes(r.delta)).map((r) => (
                <StudioDelayRow key={r.delta} r={r} tx={tx} />
              ))}
            </div>
            {secondOrder ? (
              <p className={css.micro}>
                {secondOrder.chain.map((c, i) => `${i ? " → " : ""}${tx(c.node)} ${tx(c.effect)}`).join("")}
              </p>
            ) : null}
            <p className={css.micro}>{delay.realProjection ? tx("From the same projection the Home Studio uses.") : tx("Estimate — sharpen it in Future Field.")}</p>
          </section>
        ) : null}

        {/* One question upgrade */}
        {oneQ ? (
          <div className={css.calmCard}>
            <b>{tx("Answer one thing to sharpen this")}</b>
            <span className={css.micro}>{tx(oneQ.q)}</span>
            <button type="button" className={css.link} onClick={() => onRoute(`future_field:${domain}`)}>{tx("Answer it in Future Field →")}</button>
          </div>
        ) : null}

        {/* Actions */}
        <div className={css.choiceGrid}>
          <button type="button" className={css.cta} onClick={() => onRoute(`future_field:${domain}`)}>{tx("Try a change")}</button>
          <button type="button" className={css.choice} onClick={() => onRoute("impact_map")}>{tx("See what it affects")}</button>
          <button type="button" className={css.choice} onClick={() => onRoute("life")}>{tx("See it on your line")}</button>
        </div>
      </div>
    </div>
  );
}

function StudioDelayRow({ r, tx }) {
  return (
    <>
      <span className={r.delta === 0 ? x.delayNow : undefined}>{tx(r.labelKey ?? r.label, r.labelParams)}</span>
      <span>{r.readyYear}</span>
      <span>{r.bufferMonthsAfter != null ? `${r.bufferMonthsAfter} mo` : "—"}</span>
      <span>{r.monthlyRoomAfter != null ? money(r.monthlyRoomAfter) : "—"}</span>
    </>
  );
}
