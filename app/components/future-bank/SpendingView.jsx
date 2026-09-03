"use client";

// Spending Intelligence — a real pattern, not an unexplained score. Built
// only from posted transactions in the ledger. Every figure states how
// many transactions it is based on. If there is not enough history it says
// so instead of inventing a number.

import { useEffect, useMemo, useState } from "react";
import css from "../../showcase/fb.module.css";
import { FeatureHistory } from "./FeatureHistory.jsx";
import { useTx } from "./i18n.jsx";
import { money } from "./format.js";

const CAT_LABEL = {
  food: "Food & groceries",
  transport: "Transport",
  shopping: "Shopping",
  housing: "Housing",
  bills: "Bills & utilities",
  entertainment: "Entertainment",
  health: "Health",
  travel: "Travel",
  transfer: "Transfers",
  other: "Other",
};

export function SpendingView({ onBack }) {
  const { tx } = useTx();
  const [txns, setTxns] = useState(null);
  useEffect(() => {
    fetch("/api/bank/transactions?limit=250", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : { transactions: [] }))
      .then((d) => setTxns(d.transactions ?? []))
      .catch(() => setTxns([]));
  }, []);

  const view = useMemo(() => {
    if (!txns) return null;
    const now = Date.now();
    const posted = txns.filter(
      (t) => t.status === "posted" && t.direction === "debit" && !t.isInternalTransfer && !t.isCardRepayment && t.channel !== "opening_balance",
    );
    const inWindow = (days) => posted.filter((t) => now - new Date(t.postedAt ?? t.authorisedAt ?? 0).getTime() <= days * 86_400_000);
    const last30 = inWindow(30);
    const last90 = inWindow(90);
    const prior60 = last90.filter((t) => !last30.some((x) => x.id === t.id));

    const sum = (rows) => rows.reduce((s, t) => s + Number(t.amount || 0), 0);
    const byCat = {};
    for (const t of last90) {
      const c = t.category || "other";
      byCat[c] = byCat[c] ?? { spend: 0, count: 0 };
      byCat[c].spend += Number(t.amount || 0);
      byCat[c].count += 1;
    }
    const categories = Object.entries(byCat)
      .map(([c, v]) => ({ category: c, ...v }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6);
    const total90 = sum(last90);

    // one honest trend line: the category most up vs its own earlier pace
    const recentMonthly = sum(last30);
    const priorMonthly = prior60.length ? sum(prior60) / 2 : null;
    const trend =
      priorMonthly != null && priorMonthly > 0
        ? { up: recentMonthly > priorMonthly * 1.12, pct: Math.round(((recentMonthly - priorMonthly) / priorMonthly) * 100), recentMonthly, priorMonthly }
        : null;

    return { count90: last90.length, count30: last30.length, total90, total30: sum(last30), categories, total90pct: total90, trend };
  }, [txns]);

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <button type="button" className={css.backLink} onClick={onBack}>← {tx("Explore")}</button>
        <div>
          <h1 className={css.title}>{tx("Spending Intelligence")}</h1>
          <p className={css.micro}>{tx("Your spending pattern — built only from posted transactions, and it tells you how many.")}</p>
        </div>

        {!view ? (
          <p className={css.lede}>{tx("Reading your transactions…")}</p>
        ) : view.count90 < 5 ? (
          <div className={css.calmCard}>
            <b>{tx("Not enough history yet.")}</b>
            <span className={css.micro}>{tx("Add or import about three months of transactions and a real pattern shows here — trends, categories and unusual spend, each with its evidence.")}</span>
          </div>
        ) : (
          <>
            <div className={css.bigAmountWrap}>
              <span className={css.bigAmountLabel}>{tx("Spent in the last 30 days")}</span>
              <span className={css.bigAmount}>{money(view.total30)}</span>
            </div>
            <p className={css.micro}>{tx("Based on")} {view.count30} {view.count30 === 1 ? tx("posted transaction") : tx("posted transactions")} · {money(view.total90)} {tx("over 90 days")} ({view.count90} {tx("transactions")}).</p>

            {view.trend ? (
              <div className={view.trend.up ? css.movingCard : css.calmCard}>
                <b>
                  {view.trend.up
                    ? `${tx("Your spending is up about")} ${Math.abs(view.trend.pct)}% ${tx("this month")}`
                    : `${tx("Your spending is steady")} (${view.trend.pct >= 0 ? "+" : ""}${view.trend.pct}% ${tx("vs your recent pace")})`}
                </b>
                <span className={css.micro}>
                  {money(view.trend.recentMonthly)} {tx("in the last 30 days vs about")} {money(view.trend.priorMonthly)}/{tx("month before that. From your ledger.")}
                </span>
              </div>
            ) : null}

            <section className={css.section}>
              <p className={css.kicker}>{tx("Where it went (90 days)")}</p>
              <div className={css.activity}>
                {view.categories.map((c) => {
                  const pct = view.total90pct > 0 ? Math.round((c.spend / view.total90pct) * 100) : 0;
                  return (
                    <div key={c.category} className={css.actItem}>
                      <span className={css.actBody}>
                        <span className={css.actName}>{tx(CAT_LABEL[c.category] ?? c.category)}</span>
                        <span className={css.actMeta}>{pct}% · {c.count} {c.count === 1 ? tx("transaction") : tx("transactions")}</span>
                      </span>
                      <span className={css.actAmt}>{money(c.spend)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <p className={css.micro}>{tx("Every number here traces to real posted transactions in your ledger. Nothing is estimated or AI-generated.")}</p>
          </>
        )}
        <FeatureHistory feature="spending" label="Spending history" />
      </div>
    </div>
  );
}
