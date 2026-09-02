"use client";

// Explore — what OCBC Future Bank can do. Not one input box: the seven
// bank capability zones a customer can understand, then the nine life
// Studios below. Every row states the problem it solves, its real status,
// and a real route.

import { useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";

// Real outside-data connections. None are configured yet, so every one is
// honestly "Not connected" with what it would unlock — never a fake toggle.
const CONNECTIONS = [
  { id: "payment_provider", name: "Payment rail", unlocks: "Pay and Scan & Pay to people and businesses outside your own accounts." },
  { id: "sgfindex", name: "SGFinDex (government)", unlocks: "Pull CPF, HDB, IRAS and other-bank balances into your Financial Twin automatically." },
  { id: "insurer", name: "Insurer link", unlocks: "Turn protection-gap estimates into figures from your real policies." },
];
const ACCOUNT_TYPE_NOTE = {
  youth: "Youth account — paying out, cards, FX, investing and loans need a guardian's approval.",
  guardian_managed_child: "Child account — a guardian controls the money and every permission.",
  household: "Household account — members see agreed ranges, never exact private amounts.",
};

// route ids resolved by page.jsx's onRoute handler
const ZONES = [
  { id: "spend_pay", name: "Spend & Pay", solves: "Paying, transferring and seeing your balance in one place.", output: "Money Movement", route: "today", status: "live" },
  { id: "safe_to_spend", name: "Safe-to-Spend", solves: "Knowing how much you can safely use right now.", output: "Available Now", route: "today", status: "live" },
  { id: "money_rescue", name: "Money Rescue", solves: "A failed payment, an income gap, a tight month — with a way out.", output: "Problem → Next Action", route: "rescue", status: "live" },
  { id: "spending_intelligence", name: "Spending Intelligence", solves: "Seeing spending trends, not just a list of transactions.", output: "Spending Pattern", route: "spending", status: "live" },
  { id: "financial_twin", name: "Financial Twin", solves: "Assets, debts, CPF and investments in one real picture.", output: "Financial Reality", route: "twin", status: "live" },
  { id: "shared_care", name: "Shared & Care", solves: "Managing money with a child, a partner, a household or a carer.", output: "Shared Commitment", route: "family", status: "live" },
  { id: "protect_handoff", name: "Protect & Handoff", solves: "Cover gaps, retirement, care, and passing money to the next stage.", output: "Guardian / Future Handoff", route: "studio:insurance", status: "live" },
];

const STUDIOS = [
  { domain: "home", name: "Home", line: "When a home is reachable, and its cost to your other goals." },
  { domain: "emergency", name: "Emergency fund", line: "How many months you're covered, and how to get to your floor." },
  { domain: "wedding", name: "Wedding", line: "Guest count and budget weighed against your other goals." },
  { domain: "loan", name: "Loan repayment", line: "Pay-off paths and the breathing room each one buys." },
  { domain: "retirement", name: "Retirement", line: "The long-term picture and what today's choices do to it." },
  { domain: "travel", name: "Travel", line: "A trip against your monthly room and your safety floor." },
  { domain: "investment", name: "Investing", line: "Putting money to work without breaking near-term plans." },
  { domain: "insurance", name: "Protection", line: "An honest estimate of a cover gap." },
  { domain: "family", name: "Family", line: "Shared responsibilities and who can see what." },
];

export function ExploreView(props) {
  return (
    <FutureBankDataProvider enabled>
      <Inner {...props} />
    </FutureBankDataProvider>
  );
}

function Inner({ onRoute, onStudio }) {
  const fb = useFutureBankData();
  const needs = fb.momentsRaw?.counts?.actionRequired ?? 0;
  const [caps, setCaps] = useState(null);
  useEffect(() => {
    fetch("/api/capabilities", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setCaps)
      .catch(() => setCaps(null));
  }, []);
  const providers = caps?.providers ?? {};
  const accountType = caps?.accountType ?? "individual";
  const isConnected = (v) => v === "connected" || v === "sandbox";

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <div>
          <h1 className={css.title}>Explore</h1>
          <p className={css.micro}>What OCBC Future Bank can do — your everyday banking, your real money, and your whole life ahead.</p>
        </div>

        {ACCOUNT_TYPE_NOTE[accountType] ? <p className={css.micro}>{ACCOUNT_TYPE_NOTE[accountType]}</p> : null}

        {needs > 0 ? (
          <button type="button" className={`${css.partial}`} onClick={() => onRoute("today")}>
            <b>{needs} thing{needs > 1 ? "s" : ""} need{needs > 1 ? "" : "s"} you</b>
            <span>Open Today to see what and why →</span>
          </button>
        ) : null}

        {/* 7 bank capability zones */}
        <section className={css.section}>
          <p className={css.kicker}>Bank capabilities</p>
          {ZONES.map((z) => (
            <button key={z.id} type="button" className={css.zoneRow} onClick={() => onRoute(z.route)}>
              <span className={css.zoneMain}>
                <span className={css.zoneName}>{z.name}</span>
                <span className={css.zoneSolves}>{z.solves}</span>
                <span className={css.zoneOut}>Life Thread: {z.output}</span>
              </span>
              <span className={`${css.zoneStatus} ${z.status === "live" ? css.live : css.soon}`}>{z.status === "live" ? "Available" : "Coming"}</span>
            </button>
          ))}
        </section>

        {/* real outside-data connections — honest status */}
        <section className={css.section}>
          <p className={css.kicker}>Connections</p>
          <div className={css.activity}>
            {CONNECTIONS.map((c) => {
              const connected = isConnected(providers[c.id]);
              return (
                <div key={c.id} className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{c.name}</span>
                    <span className={css.actMeta}>{c.unlocks}</span>
                  </span>
                  <span className={`${css.zoneStatus} ${connected ? css.live : css.soon}`}>{connected ? "Connected" : "Not connected"}</span>
                </div>
              );
            })}
          </div>
          <p className={css.micro}>Until a provider is configured, these stay off and nothing is estimated in their place.</p>
        </section>

        {/* 9 life Studios */}
        <section className={css.section}>
          <p className={css.kicker}>Plan a future</p>
          <p className={css.micro}>Each Studio shows a real path and what it does to your other goals — never a fixed template.</p>
          <div className={css.choiceGrid}>
            {STUDIOS.map((s) => (
              <button key={s.domain} type="button" className={css.choice} onClick={() => onStudio(s.domain)}>
                <b>{s.name}</b>
                <span>{s.line}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
