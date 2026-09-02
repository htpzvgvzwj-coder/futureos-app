"use client";

// Connections — the one honest place that shows what Future Bank cannot do
// on its own yet, and exactly why. Every row is resolved from the live
// capability registry (/api/capabilities): account type, connected
// providers, permissions. Nothing here fakes a connection or fills the gap
// with an estimate.

import { useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";

const PROVIDERS = [
  {
    id: "payment_provider",
    name: "Payment rail",
    pulls: "The ability to actually send money to people and businesses outside your own accounts.",
    lands: "Pay, Scan & Pay, PayNow-to-someone.",
  },
  {
    id: "sgfindex",
    name: "SGFinDex (government)",
    pulls: "CPF, HDB, IRAS and other-bank balances, with your consent, straight from the source.",
    lands: "Financial Twin — real figures instead of what you typed.",
  },
  {
    id: "insurer",
    name: "Insurer link",
    pulls: "Your real policy cover, premiums and renewal dates.",
    lands: "Protection — a real gap instead of an estimate.",
  },
];

const STATUS_LABEL = {
  live: "Working",
  limited: "Partly working",
  connection_required: "Needs a connection",
  unavailable: "Off",
  restricted_by_age: "Not for this account type",
  restricted_by_permission: "You lack the permission",
};

export function ConnectionsView({ onBack }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/capabilities", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const providers = data?.providers ?? {};
  const caps = data?.capabilities ?? {};
  const isConnected = (v) => v === "connected" || v === "sandbox";
  const limited = Object.values(caps).filter(
    (c) => c.status === "connection_required" || c.status === "restricted_by_age" || c.status === "limited",
  );

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <button type="button" className={css.backLink} onClick={onBack}>← Explore</button>
        <div>
          <h1 className={css.title}>Connections</h1>
          <p className={css.micro}>What Future Bank can&apos;t do on its own yet, and exactly why. No fake switches; nothing is estimated in place of a real connection.</p>
        </div>

        <section className={css.section}>
          <p className={css.kicker}>Outside data &amp; rails</p>
          <div className={css.activity}>
            {PROVIDERS.map((p) => {
              const connected = isConnected(providers[p.id]);
              return (
                <div key={p.id} className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{p.name}</span>
                    <span className={css.actMeta}>{p.pulls}</span>
                    <span className={css.actMeta}>Lands in: {p.lands}</span>
                  </span>
                  <span className={`${css.zoneStatus} ${connected ? css.live : css.soon}`}>{connected ? "Connected" : "Not connected"}</span>
                </div>
              );
            })}
          </div>
          <p className={css.micro}>These turn on when the provider is connected for OCBC — you don&apos;t need to do anything, and you&apos;ll see the change here.</p>
        </section>

        <section className={css.section}>
          <p className={css.kicker}>What&apos;s limited right now</p>
          {!data ? (
            <p className={css.micro}>Reading your capabilities…</p>
          ) : limited.length === 0 ? (
            <p className={css.micro}>Nothing is held back — everything available to your account is working on your real data.</p>
          ) : (
            <div className={css.activity}>
              {limited.map((c) => (
                <div key={c.id} className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{c.name}</span>
                    <span className={css.actMeta}>{c.whatIsRequired || c.note || STATUS_LABEL[c.status]}</span>
                  </span>
                  <span className={`${css.zoneStatus} ${css.soon}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                </div>
              ))}
            </div>
          )}
          {data?.accountType && data.accountType !== "individual" ? (
            <p className={css.micro}>Some of these are limited because this is a <b>{String(data.accountType).replace(/_/g, " ")}</b> account, not because of a missing connection.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
