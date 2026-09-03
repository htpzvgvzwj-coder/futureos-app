"use client";

// The scope-limited view of an account you look after. It shows a health
// state and whether a decision is waiting - never the raw ledger or exact
// amounts - unless you hold 'approve', in which case you also see the full
// detail of what you are being asked to approve. Everything here is read
// from /api/care?account=<id>, which enforces the link server-side.

import { useCallback, useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import fbc from "./future-bank.module.css";
import { useTx } from "./i18n.jsx";
import { money, relTime } from "./format.js";

const HEALTH = {
  steady: { label: "Steady", cls: css.calmCard },
  tight: { label: "Getting tight", cls: css.movingCard },
  attention: { label: "Needs attention", cls: css.movingCard },
};

export function SupervisedView({ ownerKey, ownerLabel, onBack }) {
  const { tx } = useTx();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setErr("");
    fetch(`/api/care?account=${encodeURIComponent(ownerKey)}`, { headers: { "cache-control": "no-cache" } })
      .then(async (r) => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }))
      .then((d) => (d.ok ? setData(d) : setErr(d.error === "not_linked" ? tx("You are no longer linked to this account.") : tx("Could not load this view."))))
      .catch(() => setErr(tx("Could not load this view.")));
  }, [ownerKey, tx]);
  useEffect(() => {
    load();
  }, [load]);

  const [declineFor, setDeclineFor] = useState(null);
  const [declineNote, setDeclineNote] = useState("");
  const decide = async (id, decision, note) => {
    setBusyId(id);
    await fetch("/api/care", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "decide", account: ownerKey, id, decision, note }),
    }).catch(() => {});
    setBusyId(null);
    setDeclineFor(null);
    setDeclineNote("");
    load();
  };

  const s = data?.snapshot;
  const scope = data?.role?.scope;
  const health = s ? HEALTH[s.health] ?? HEALTH.steady : null;
  const nudges = data?.nudges ?? [];
  const ranges = data?.sharedRanges ?? [];
  const nudgeDone = async (id) => {
    await fetch("/api/care", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "nudge_done", id }),
    }).catch(() => {});
    load();
  };

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <button type="button" className={css.backLink} onClick={onBack}>← {tx("Guardian")}</button>
        <div>
          <h1 className={css.title}>{ownerLabel || tx("An account you look after")}</h1>
          <p className={css.micro}>
            {tx("You can see")} {scope === "approve" ? tx("their money health and decide what they ask you to approve") : tx("their money health only")} — {tx("never their transactions or exact balances. They can end this any time.")}
          </p>
        </div>

        {err ? <p className={css.err}>{err}</p> : null}

        {nudges.length > 0 ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("They asked you to look")}</p>
            {nudges.map((n) => (
              <div key={n.id} className={css.movingCard}>
                <b>{n.title}</b>
                {n.detail ? <span className={css.micro}>{n.detail}</span> : null}
                <button type="button" className={css.link} onClick={() => nudgeDone(n.id)}>{tx("Mark done")}</button>
              </div>
            ))}
          </section>
        ) : null}

        {ranges.length > 0 ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("Agreed ranges they shared")}</p>
            <div className={css.activity}>
              {ranges.map((r) => (
                <div key={r.category} className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{tx(r.category)}</span>
                    <span className={css.actMeta}>SGD {r.low.toLocaleString("en-SG")}–{r.high.toLocaleString("en-SG")}{r.note ? ` · ${r.note}` : ""}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className={css.micro}>{tx("These are ranges the account owner chose to share — not their actual spending.")}</p>
          </section>
        ) : null}

        {s ? (
          <>
            <section className={css.section}>
              <p className={css.kicker}>{tx("Right now")}</p>
              <div className={health.cls}>
                <b>{tx(health.label)}</b>
                <span className={css.micro}>{s.headline}</span>
              </div>
              <div className={css.activity}>
                <div className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{tx("Safe-to-spend")}</span>
                    <span className={css.actMeta}>{s.safeToSpendState === "below_safe_line" ? tx("Below their safe line") : tx("At or above their safe line")}</span>
                  </span>
                </div>
                <div className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{tx("Reality vs plan")}</span>
                    <span className={css.actMeta}>
                      {s.driftSeverity === "high"
                        ? tx("Has drifted a lot — worth a conversation")
                        : s.driftSeverity === "watch"
                          ? tx("Drifting a little")
                          : tx("In line with their plan")}
                    </span>
                  </span>
                </div>
                <div className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{tx("Waiting for a decision")}</span>
                    <span className={css.actMeta}>{s.pendingApprovalCount > 0 ? `${s.pendingApprovalCount} ${s.pendingApprovalCount > 1 ? tx("items") : tx("item")}` : tx("Nothing")}</span>
                  </span>
                </div>
              </div>
              <p className={css.micro}>{tx("Updated")} {relTime(s.updatedAt)}.</p>
            </section>

            {scope === "approve" ? (
              <section className={css.section}>
                <p className={css.kicker}>{tx("They asked you to approve")}</p>
                {(s.pendingApprovals ?? []).length === 0 ? (
                  <div className={css.calmCard}><b>{tx("Nothing right now.")}</b></div>
                ) : (
                  s.pendingApprovals.map((r) => (
                    <article key={r.id} className={`${fbc.moment} ${fbc.action_required}`}>
                      <div className={fbc.momentTop}>
                        <span className={`${fbc.sev} ${fbc.action_required}`}>{tx("needs approval")}</span>
                        <span className={fbc.evMeta} style={{ marginLeft: "auto" }}>{relTime(r.createdAt)}</span>
                      </div>
                      <div className={fbc.momentTitle}>{tx(r.summary)}</div>
                      {r.amount != null ? <div className={fbc.momentSummary}>{money(r.amount)}</div> : null}
                      {r.reason ? <div className={fbc.evMeta}>{tx("Why")}: {tx(r.reason)}</div> : null}
                      {declineFor === r.id ? (
                        <div className={css.field}>
                          <label htmlFor={`sdn-${r.id}`}>{tx("A short reason (they will see this)")}</label>
                          <input id={`sdn-${r.id}`} type="text" value={declineNote} maxLength={140} autoComplete="off" onChange={(e) => setDeclineNote(e.target.value)} />
                          <div className={css.choiceGrid}>
                            <button type="button" className={css.cta} disabled={busyId === r.id || !declineNote.trim()} onClick={() => decide(r.id, "declined", declineNote.trim())}>{tx("Send decline")}</button>
                            <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => { setDeclineFor(null); setDeclineNote(""); }}>{tx("Back")}</button>
                          </div>
                        </div>
                      ) : (
                        <div className={css.choiceGrid}>
                          <button type="button" className={css.cta} disabled={busyId === r.id} onClick={() => decide(r.id, "approved")}>{tx("Approve & do it")}</button>
                          <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => setDeclineFor(r.id)}>{tx("Decline")}</button>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </section>
            ) : null}

            <section className={css.section}>
              <p className={css.kicker}>{tx("What you cannot do")}</p>
              <ul className={css.proofList}>
                <li><span className={css.proofMark}>✕</span> {tx("see their transactions or exact balances")}</li>
                <li><span className={css.proofMark}>✕</span> {tx("move their money")}{scope === "approve" ? ` ${tx("(only approve what they ask)")}` : ""}</li>
                <li><span className={css.proofMark}>✕</span> {tx("change their goals or plans")}</li>
                <li><span className={css.proofMark}>✕</span> {tx("stay linked if they revoke — it ends immediately")}</li>
              </ul>
            </section>
          </>
        ) : !err ? (
          <p className={css.lede}>{tx("Loading…")}</p>
        ) : null}
      </div>
    </div>
  );
}
