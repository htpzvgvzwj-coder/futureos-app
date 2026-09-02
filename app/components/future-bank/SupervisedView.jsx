"use client";

// The scope-limited view of an account you look after. It shows a health
// state and whether a decision is waiting - never the raw ledger or exact
// amounts - unless you hold 'approve', in which case you also see the full
// detail of what you are being asked to approve. Everything here is read
// from /api/care?account=<id>, which enforces the link server-side.

import { useCallback, useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import fbc from "./future-bank.module.css";
import { money, relTime } from "./format.js";

const HEALTH = {
  steady: { label: "Steady", cls: css.calmCard },
  tight: { label: "Getting tight", cls: css.movingCard },
  attention: { label: "Needs attention", cls: css.movingCard },
};

export function SupervisedView({ ownerKey, ownerLabel, onBack }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setErr("");
    fetch(`/api/care?account=${encodeURIComponent(ownerKey)}`, { headers: { "cache-control": "no-cache" } })
      .then(async (r) => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }))
      .then((d) => (d.ok ? setData(d) : setErr(d.error === "not_linked" ? "You are no longer linked to this account." : "Could not load this view.")))
      .catch(() => setErr("Could not load this view."));
  }, [ownerKey]);
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
        <button type="button" className={css.backLink} onClick={onBack}>← Guardian</button>
        <div>
          <h1 className={css.title}>{ownerLabel || "An account you look after"}</h1>
          <p className={css.micro}>
            You can see {scope === "approve" ? "their money health and decide what they ask you to approve" : "their money health only"} — never their transactions or exact balances. They can end this any time.
          </p>
        </div>

        {err ? <p className={css.err}>{err}</p> : null}

        {nudges.length > 0 ? (
          <section className={css.section}>
            <p className={css.kicker}>They asked you to look</p>
            {nudges.map((n) => (
              <div key={n.id} className={css.movingCard}>
                <b>{n.title}</b>
                {n.detail ? <span className={css.micro}>{n.detail}</span> : null}
                <button type="button" className={css.link} onClick={() => nudgeDone(n.id)}>Mark done</button>
              </div>
            ))}
          </section>
        ) : null}

        {ranges.length > 0 ? (
          <section className={css.section}>
            <p className={css.kicker}>Agreed ranges they shared</p>
            <div className={css.activity}>
              {ranges.map((r) => (
                <div key={r.category} className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{r.category}</span>
                    <span className={css.actMeta}>SGD {r.low.toLocaleString("en-SG")}–{r.high.toLocaleString("en-SG")}{r.note ? ` · ${r.note}` : ""}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className={css.micro}>These are ranges the account owner chose to share — not their actual spending.</p>
          </section>
        ) : null}

        {s ? (
          <>
            <section className={css.section}>
              <p className={css.kicker}>Right now</p>
              <div className={health.cls}>
                <b>{health.label}</b>
                <span className={css.micro}>{s.headline}</span>
              </div>
              <div className={css.activity}>
                <div className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>Safe-to-spend</span>
                    <span className={css.actMeta}>{s.safeToSpendState === "below_safe_line" ? "Below their safe line" : "At or above their safe line"}</span>
                  </span>
                </div>
                <div className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>Reality vs plan</span>
                    <span className={css.actMeta}>
                      {s.driftSeverity === "high"
                        ? "Has drifted a lot — worth a conversation"
                        : s.driftSeverity === "watch"
                          ? "Drifting a little"
                          : "In line with their plan"}
                    </span>
                  </span>
                </div>
                <div className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>Waiting for a decision</span>
                    <span className={css.actMeta}>{s.pendingApprovalCount > 0 ? `${s.pendingApprovalCount} item${s.pendingApprovalCount > 1 ? "s" : ""}` : "Nothing"}</span>
                  </span>
                </div>
              </div>
              <p className={css.micro}>Updated {relTime(s.updatedAt)}.</p>
            </section>

            {scope === "approve" ? (
              <section className={css.section}>
                <p className={css.kicker}>They asked you to approve</p>
                {(s.pendingApprovals ?? []).length === 0 ? (
                  <div className={css.calmCard}><b>Nothing right now.</b></div>
                ) : (
                  s.pendingApprovals.map((r) => (
                    <article key={r.id} className={`${fbc.moment} ${fbc.action_required}`}>
                      <div className={fbc.momentTop}>
                        <span className={`${fbc.sev} ${fbc.action_required}`}>needs approval</span>
                        <span className={fbc.evMeta} style={{ marginLeft: "auto" }}>{relTime(r.createdAt)}</span>
                      </div>
                      <div className={fbc.momentTitle}>{r.summary}</div>
                      {r.amount != null ? <div className={fbc.momentSummary}>{money(r.amount)}</div> : null}
                      {r.reason ? <div className={fbc.evMeta}>Why: {r.reason}</div> : null}
                      {declineFor === r.id ? (
                        <div className={css.field}>
                          <label htmlFor={`sdn-${r.id}`}>A short reason (they will see this)</label>
                          <input id={`sdn-${r.id}`} type="text" value={declineNote} maxLength={140} autoComplete="off" onChange={(e) => setDeclineNote(e.target.value)} />
                          <div className={css.choiceGrid}>
                            <button type="button" className={css.cta} disabled={busyId === r.id || !declineNote.trim()} onClick={() => decide(r.id, "declined", declineNote.trim())}>Send decline</button>
                            <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => { setDeclineFor(null); setDeclineNote(""); }}>Back</button>
                          </div>
                        </div>
                      ) : (
                        <div className={css.choiceGrid}>
                          <button type="button" className={css.cta} disabled={busyId === r.id} onClick={() => decide(r.id, "approved")}>Approve &amp; do it</button>
                          <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => setDeclineFor(r.id)}>Decline</button>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </section>
            ) : null}

            <section className={css.section}>
              <p className={css.kicker}>What you cannot do</p>
              <ul className={css.proofList}>
                <li><span className={css.proofMark}>✕</span> see their transactions or exact balances</li>
                <li><span className={css.proofMark}>✕</span> move their money{scope === "approve" ? " (only approve what they ask)" : ""}</li>
                <li><span className={css.proofMark}>✕</span> change their goals or plans</li>
                <li><span className={css.proofMark}>✕</span> stay linked if they revoke — it ends immediately</li>
              </ul>
            </section>
          </>
        ) : !err ? (
          <p className={css.lede}>Loading…</p>
        ) : null}
      </div>
    </div>
  );
}
