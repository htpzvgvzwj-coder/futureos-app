"use client";

// Connections — the three outside-data links. Each shows its real status
// (from /api/connections), a Connect / Disconnect control, and — when
// connected — the pulled detail so the user can open it and check it holds
// up. A payment rail runs in `sandbox`: it says so, and an external
// transfer still returns a sandbox receipt.

import { useCallback, useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import { useTx } from "./i18n.jsx";
import { FeatureHistory } from "./FeatureHistory.jsx";

const money = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;

function LinkedDetail({ id, data }) {
  const { tx } = useTx();
  if (!data) return null;
  if (id === "sgfindex") {
    return (
      <div className={css.activity}>
        {(data.sources ?? []).map((s) => (
          <div key={s.id} className={css.actItem}>
            <span className={css.actBody}>
              <span className={css.actName}>{s.name} · {s.ref}</span>
              <span className={css.actMeta}>
                {s.balances
                  ? Object.entries(s.balances).map(([k, v]) => `${k.replace(/_/g, " ")}: ${money(v)}`).join(" · ")
                  : s.lastAssessedAnnualIncome != null
                    ? `Assessed income ${money(s.lastAssessedAnnualIncome)} (${s.lastAssessedIncomeYear}) · tax ${money(s.taxPayable)}`
                    : s.balance != null
                      ? `${s.accountType}: ${money(s.balance)}`
                      : s.records}
              </span>
              <span className={css.actMeta}>as of {s.asOf}</span>
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (id === "insurer") {
    return (
      <div className={css.activity}>
        {(data.policies ?? []).map((p) => (
          <div key={p.id} className={css.actItem}>
            <span className={css.actBody}>
              <span className={css.actName}>{p.insurer} · {p.type}</span>
              <span className={css.actMeta}>
                {p.coverage ? `Cover ${money(p.coverage)}${p.criticalIllnessCoverage ? ` · CI ${money(p.criticalIllnessCoverage)}` : ""} · ` : ""}
                {p.premiumMonthly ? `${money(p.premiumMonthly)}/mo` : p.premiumAnnual ? `${money(p.premiumAnnual)}/yr` : ""}
                {p.ward ? ` · ${p.ward}` : ""} · renews {p.renews}
              </span>
              <span className={css.actMeta}>Policy {p.policyNo}</span>
            </span>
          </div>
        ))}
        {data.incomeProtection?.note ? <p className={css.micro}>{data.incomeProtection.note}</p> : null}
      </div>
    );
  }
  // payment_provider
  return (
    <div className={css.activity}>
      <p className={css.micro}>{tx("Running in sandbox — a real external transfer still returns a sandbox receipt, never money actually sent.")}</p>
      {(data.payees ?? []).map((p) => (
        <div key={p.id} className={css.actItem}>
          <span className={css.actBody}>
            <span className={css.actName}>{p.name}</span>
            <span className={css.actMeta}>{p.handle}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function ConnectionsView({ onBack }) {
  const { tx } = useTx();
  const [conns, setConns] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    fetch("/api/connections", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConns(d?.connections ?? []))
      .catch(() => setConns([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (provider, action) => {
    setBusy(provider);
    await fetch("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, provider }) }).catch(() => {});
    setBusy(null);
    load();
  };

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <button type="button" className={css.backLink} onClick={onBack}>← {tx("Explore")}</button>
        <div>
          <h1 className={css.title}>{tx("Connections")}</h1>
          <p className={css.micro}>{tx("Link your real outside data. A linked figure is tagged with its source in your Financial Twin — never presented as something we made up.")}</p>
        </div>

        <section className={css.section}>
          <p className={css.kicker}>{tx("Outside data & rails")}</p>
          {conns == null ? (
            <p className={css.micro}>{tx("Loading…")}</p>
          ) : (
            conns.map((c) => (
              <div key={c.id} data-testid={`conn-${c.id}`} style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}>
                <div className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{tx(c.name)}</span>
                    <span className={css.actMeta}>{tx(c.pulls)}</span>
                    <span className={css.actMeta}>{tx("Lands in")}: {tx(c.lands)}</span>
                    {c.connected ? <span className={css.actMeta}>{tx(c.summary)}</span> : null}
                  </span>
                  <span className={`${css.zoneStatus} ${c.connected ? css.live : css.soon}`}>
                    {c.status === "sandbox" ? tx("Connected (sandbox)") : c.connected ? tx("Connected") : tx("Not connected")}
                  </span>
                </div>
                <div className={css.choiceGrid}>
                  {c.connected ? (
                    <>
                      <button type="button" className={css.link} onClick={() => setOpen(open === c.id ? null : c.id)}>
                        {open === c.id ? tx("Hide what's linked") : tx("See what's linked")}
                      </button>
                      <button type="button" className={css.link} disabled={busy === c.id} onClick={() => act(c.id, "disconnect")}>{tx("Disconnect")}</button>
                    </>
                  ) : (
                    <button type="button" className={css.cta} disabled={busy === c.id} onClick={() => act(c.id, "connect")}>{tx("Connect")}</button>
                  )}
                </div>
                {open === c.id && c.data ? <LinkedDetail id={c.id} data={c.data} /> : null}
              </div>
            ))
          )}
        </section>

        <FeatureHistory feature="connections" label="Your connection history" />
      </div>
    </div>
  );
}
