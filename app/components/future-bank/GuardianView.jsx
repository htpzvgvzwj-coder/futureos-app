"use client";

// Guardian — the decision queue. It reads the SAME Money Moment objects as
// Today, Life and Explore (via FutureBankDataProvider): no second alert
// model, no chatbot. What needs a decision, what it is watching, and the
// fixed list of what Guardian can never do on its own.

import { useCallback, useEffect, useState } from "react";
import css from "../../showcase/fb.module.css";
import fbc from "./future-bank.module.css";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { relTime, money } from "./format.js";

// Guardian can NEVER do these on its own - it can only surface and ask.
const CANNOT = [
  "move money or make a payment",
  "cancel or block a payment",
  "change or delay a goal",
  "share your private amounts",
  "act without you — it asks, you decide",
];

export function GuardianView(props) {
  return (
    <FutureBankDataProvider enabled>
      <Inner {...props} />
    </FutureBankDataProvider>
  );
}

function Inner({ onRoute, onOpenSupervised }) {
  const fb = useFutureBankData();
  const all = fb.momentsRaw?.allMoments ?? fb.moments ?? [];
  const decisions = all.filter((m) => m.state === "new" && (m.severity === "action_required" || m.sourceType === "turning_point"));
  const watching = all.filter((m) => m.state === "new" && m.severity === "watch" && m.sourceType !== "turning_point");

  const [auth, setAuth] = useState(null);
  const [care, setCare] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const loadAuth = useCallback(() => {
    fetch("/api/authorizations", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setAuth)
      .catch(() => setAuth(null));
    fetch("/api/care", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setCare)
      .catch(() => setCare(null));
  }, []);
  useEffect(() => {
    loadAuth();
  }, [loadAuth]);
  const supervised = care?.supervised ?? [];
  const supervisors = care?.supervisors ?? [];
  const inbox = care?.inbox ?? [];
  const pending = (auth?.requests ?? []).filter((r) => r.status === "pending");
  const [declineFor, setDeclineFor] = useState(null);
  const [declineNote, setDeclineNote] = useState("");
  const act = async (body) => {
    setBusyId(body.id);
    await fetch("/api/authorizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    setBusyId(null);
    setDeclineFor(null);
    setDeclineNote("");
    loadAuth();
    fb.refetchAll?.();
  };
  const approve = (id) => act({ action: "decide", id, decision: "approved" });
  const confirmBoth = (id) => act({ action: "confirm", id });
  const stop = (id) => act({ action: "stop", id });
  const submitDecline = (id) => {
    if (!declineNote.trim()) return;
    act({ action: "decide", id, decision: "declined", note: declineNote.trim() });
  };
  const hoursLeft = (iso) => {
    if (!iso) return null;
    const h = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
    return h > 0 ? h : 0;
  };

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <div>
          <h1 className={css.title}>Guardian</h1>
          <p className={css.micro}>The same signals as Today, Life and Explore — here they become decisions. Guardian asks; you decide.</p>
          {supervisors.length > 0 ? (
            <p className={css.micro}>
              {supervisors.map((s) => `${s.personLabel} (${s.role})`).join(", ")} can see this account&apos;s money health. Manage this in Family &amp; Care.
            </p>
          ) : null}
        </div>

        {inbox.length > 0 ? (
          <section className={css.section}>
            <p className={css.kicker}>They asked you to look</p>
            <div className={css.activity}>
              {inbox.map((n) => (
                <div key={n.id} className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{n.ownerLabel}</span>
                    <span className={css.actMeta}>{n.title}</span>
                  </span>
                  <button type="button" className={css.link} onClick={() => onOpenSupervised?.(n.ownerKey, n.ownerLabel)}>Open</button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {supervised.length > 0 ? (
          <section className={css.section}>
            <p className={css.kicker}>People you look after</p>
            <div className={css.activity}>
              {supervised.map((p) => (
                <div key={p.roleId} className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{p.ownerLabel}</span>
                    <span className={css.actMeta}>{p.role} · you can {p.scope === "approve" ? "view health + approve" : "view health only"}</span>
                  </span>
                  <button type="button" className={css.link} onClick={() => onOpenSupervised?.(p.ownerKey, p.ownerLabel)}>Open</button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* approval queue - real money moves parked by the account's rules */}
        {auth && (pending.length > 0 || auth.accountType === "youth" || auth.accountType === "guardian_managed_child") ? (
          <section className={css.section}>
            <p className={css.kicker}>Waiting for approval</p>
            {!auth.linkedApprover ? (
              <p className={css.micro}>
                On a supervised account these go to a linked guardian to decide. No guardian is linked yet, so they wait here for your review.
              </p>
            ) : null}
            {pending.length === 0 ? (
              <div className={css.calmCard}>
                <b>Nothing is waiting.</b>
                <span className={css.micro}>Money moves that need approval will appear here before they happen.</span>
              </div>
            ) : (
              pending.map((r) => (
                <article key={r.id} className={`${fbc.moment} ${fbc.action_required}`}>
                  <div className={fbc.momentTop}>
                    <span className={`${fbc.sev} ${fbc.action_required}`}>needs approval</span>
                    <span className={fbc.evMeta} style={{ marginLeft: "auto" }}>{relTime(r.createdAt)}</span>
                  </div>
                  <div className={fbc.momentTitle}>{r.summary}</div>
                  {r.amount != null ? <div className={fbc.momentSummary}>{money(r.amount)}</div> : null}
                  {r.reason ? <div className={fbc.evMeta}>Why: {r.reason}</div> : null}
                  {r.autoExecuteAt ? (
                    <div className={fbc.evMeta}>
                      Runs on its own in about {hoursLeft(r.autoExecuteAt)}h unless stopped.
                    </div>
                  ) : null}
                  {r.ownerConfirmedAt && r.decidedBy === "guardian" ? (
                    <div className={fbc.evMeta}>A guardian approved this — it runs once you confirm.</div>
                  ) : r.decidedBy === "guardian" ? (
                    <div className={fbc.evMeta}>A guardian approved this — needs your confirmation too.</div>
                  ) : null}
                  {declineFor === r.id ? (
                    <div className={css.field}>
                      <label htmlFor={`dn-${r.id}`}>A short reason (the account owner sees this)</label>
                      <input id={`dn-${r.id}`} type="text" value={declineNote} maxLength={140} autoComplete="off" onChange={(e) => setDeclineNote(e.target.value)} />
                      <div className={css.choiceGrid}>
                        <button type="button" className={css.cta} disabled={busyId === r.id || !declineNote.trim()} onClick={() => submitDecline(r.id)}>Send decline</button>
                        <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => { setDeclineFor(null); setDeclineNote(""); }}>Back</button>
                      </div>
                    </div>
                  ) : (
                    <div className={css.choiceGrid}>
                      {r.decidedBy === "guardian" && !r.ownerConfirmedAt ? (
                        <button type="button" className={css.cta} disabled={busyId === r.id} onClick={() => confirmBoth(r.id)}>Confirm &amp; do it</button>
                      ) : (
                        <button type="button" className={css.cta} disabled={busyId === r.id} onClick={() => approve(r.id)}>Approve &amp; do it</button>
                      )}
                      {r.autoExecuteAt ? (
                        <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => stop(r.id)}>Stop</button>
                      ) : (
                        <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => setDeclineFor(r.id)}>Decline</button>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        ) : null}

        <section className={css.section}>
          <p className={css.kicker}>Needs your decision</p>
          {decisions.length === 0 ? (
            <div className={css.calmCard}>
              <b>Nothing needs a decision right now.</b>
              <span className={css.micro}>Guardian is watching {watching.length} thing{watching.length === 1 ? "" : "s"} in the background.</span>
            </div>
          ) : (
            decisions.map((m) => (
              <article key={m.id} className={`${fbc.moment} ${fbc[m.severity] || ""}`}>
                <div className={fbc.momentTop}>
                  <span className={`${fbc.sev} ${fbc[m.severity] || ""}`}>{String(m.severity).replace("_", " ")}</span>
                  <span className={fbc.evMeta} style={{ marginLeft: "auto" }}>{relTime(m.occurredAt)}</span>
                </div>
                <div className={fbc.momentTitle}>{m.title}</div>
                <div className={fbc.momentSummary}>{m.summary}</div>
                {m.whyNow ? <div className={fbc.evMeta}>Why now: {m.whyNow}</div> : null}
                {(m.evidence ?? []).length > 0 ? (
                  <div className={fbc.evidence}>
                    {m.evidence.slice(0, 3).map((e, i) => (
                      <div key={i} className={fbc.evRow}><span>{e.label}</span><span>{e.value ?? "Needs more information"}</span></div>
                    ))}
                  </div>
                ) : null}
                {m.nextActions?.[0] ? (
                  <button
                    type="button"
                    className={`${fbc.act} ${fbc.primary}`}
                    disabled={m.nextActions[0].available === false}
                    onClick={() => onRoute?.(m.nextActions[0].route || "today")}
                  >
                    {m.nextActions[0].label}
                  </button>
                ) : null}
              </article>
            ))
          )}
        </section>

        {watching.length > 0 ? (
          <section className={css.section}>
            <p className={css.kicker}>Guardian is watching</p>
            <div className={css.activity}>
              {watching.slice(0, 6).map((m) => (
                <div key={m.id} className={css.actItem}>
                  <span className={css.actBody}>
                    <span className={css.actName}>{m.title}</span>
                    <span className={css.actMeta}>{m.evidence?.[0]?.source ? String(m.evidence[0].source).replace(/_/g, " ") : "detection"} · {relTime(m.occurredAt)}</span>
                  </span>
                  {m.nextActions?.[0] ? (
                    <button type="button" className={css.link} onClick={() => onRoute?.(m.nextActions[0].route || "today")}>Look</button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={css.section}>
          <p className={css.kicker}>What Guardian can never do</p>
          <ul className={css.proofList}>
            {CANNOT.map((c) => (
              <li key={c}><span className={css.proofMark}>✕</span> {c}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
