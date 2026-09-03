"use client";

// Guardian — Future Bank's protection layer, not a notification list.
// The home is three layers only:
//   1. Guardian Now      - one state, one cause, one action
//   2. Protected by Guardian - the seven promises it guards
//   3. Guardian Proof    - the recent value it produced, as causal replay
// The operational surface (approval queue, people you look after, the
// Contract) lives below the fold and stays fully usable.

import { useCallback, useEffect, useRef, useState } from "react";
import css from "../../showcase/fb.module.css";
import { FeatureHistory } from "./FeatureHistory.jsx";
import fbc from "./future-bank.module.css";
import g from "./guardian.module.css";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { useTx } from "./i18n.jsx";
import { relTime, money } from "./format.js";

const LEVEL_LABEL = { calm: "Calm", watching: "Watching", decision: "Decision", urgent: "Urgent" };

function ImpactRow({ name, v, currency, warn }) {
  const fmt = (n) => `${currency} ${Number(n ?? 0).toLocaleString("en-SG")}`;
  const same = v.before === v.after;
  return (
    <div className={g.impactRow}>
      <span className={g.impactName}>{name}</span>
      <span className={`${g.impactVal} ${same ? g.same : ""} ${warn && !same ? g.warn : ""}`}>
        {same ? fmt(v.after) : (<>{fmt(v.before)}<span className={g.to}>→</span>{fmt(v.after)}</>)}
      </span>
    </div>
  );
}

export function GuardianView(props) {
  return (
    <FutureBankDataProvider enabled>
      <Inner {...props} />
    </FutureBankDataProvider>
  );
}

function Inner({ onRoute, onOpenSupervised }) {
  const { tx } = useTx();
  const fb = useFutureBankData();
  const [gd, setGd] = useState(null);
  const [auth, setAuth] = useState(null);
  const [care, setCare] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [openDomain, setOpenDomain] = useState(null);
  const [foldOpen, setFoldOpen] = useState(false);
  const foldRef = useRef(null);

  const load = useCallback(() => {
    fetch("/api/guardian", { headers: { "cache-control": "no-cache" } }).then((r) => (r.ok ? r.json() : null)).then(setGd).catch(() => setGd(null));
    fetch("/api/authorizations", { headers: { "cache-control": "no-cache" } }).then((r) => (r.ok ? r.json() : null)).then(setAuth).catch(() => setAuth(null));
    fetch("/api/care", { headers: { "cache-control": "no-cache" } }).then((r) => (r.ok ? r.json() : null)).then(setCare).catch(() => setCare(null));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const now = gd?.now ?? null;
  const protection = gd?.protection ?? null;
  const proof = gd?.proof ?? [];
  const stage = gd?.stage ?? null;
  const contract = gd?.contract ?? null;
  const shield = gd?.promiseShield ?? null;
  const collision = gd?.collision?.collision ? gd.collision : null;
  const recovery = gd?.recovery?.inTrouble ? gd.recovery : null;
  const guardianPost = async (body) => {
    setBusyId(body.action);
    await fetch("/api/guardian", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    setBusyId(null);
    load();
    fb.refetchAll?.();
  };
  const supervised = care?.supervised ?? [];
  const supervisors = care?.supervisors ?? [];
  const inbox = care?.inbox ?? [];
  const pending = (auth?.requests ?? []).filter((r) => r.status === "pending");

  const [declineFor, setDeclineFor] = useState(null);
  const [declineNote, setDeclineNote] = useState("");
  const act = async (body) => {
    setBusyId(body.id);
    await fetch("/api/authorizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    setBusyId(null);
    setDeclineFor(null);
    setDeclineNote("");
    load();
    fb.refetchAll?.();
  };
  const hoursLeft = (iso) => {
    if (!iso) return null;
    const h = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
    return h > 0 ? h : 0;
  };
  const setCap = async (capability, level) => {
    await fetch("/api/guardian", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_contract", capability, level }) }).catch(() => {});
    load();
  };
  const resetCaps = async () => {
    await fetch("/api/guardian", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "reset_contract" }) }).catch(() => {});
    load();
  };

  // Guardian Now's primary action: pending approvals win, else the moment's action.
  const openFold = () => {
    setFoldOpen(true);
    setTimeout(() => foldRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  // Phase 2 — the decision loop: show the before/after impact before committing.
  const [decisionId, setDecisionId] = useState(null);
  const [decision, setDecision] = useState(null);
  const [adjustAmt, setAdjustAmt] = useState("");
  const openDecision = (id) => {
    setDecisionId(id);
    setDecision(null);
    fetch(`/api/guardian?decision=${id}`, { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDecision)
      .catch(() => setDecision(null));
  };
  const commitDecision = async (choice) => {
    const id = decisionId;
    setBusyId(id);
    if (choice === "continue") {
      await fetch("/api/authorizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "decide", id, decision: "approved" }) }).catch(() => {});
    } else if (choice === "cancel") {
      await fetch("/api/authorizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "decide", id, decision: "declined", note: "Cancelled from the decision view" }) }).catch(() => {});
    } else if (choice === "adjust" && Number(adjustAmt) > 0) {
      const res = await fetch("/api/authorizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "adjust", id, amount: Number(adjustAmt) }) }).then((r) => r.json()).catch(() => null);
      setBusyId(null);
      setAdjustAmt("");
      if (res?.request?.id) return openDecision(res.request.id);
      setDecisionId(null);
      load();
      return;
    }
    setBusyId(null);
    setDecisionId(null);
    setDecision(null);
    setAdjustAmt("");
    load();
    fb.refetchAll?.();
  };

  const primary =
    pending.length === 1
      ? { label: tx("Review this decision"), run: () => openDecision(pending[0].id) }
      : pending.length > 1
        ? { label: `${tx("Review")} ${pending.length} ${tx("decisions")}`, run: openFold }
        : now?.primaryAction
          ? { label: tx(now.primaryAction.label), run: () => onRoute?.(now.primaryAction.route || "today") }
          : now?.needsSetup
            ? { label: tx(now.primaryAction?.label || "Add a money source"), run: () => onRoute?.("reality") }
            : null;
  const level = pending.length > 0 && (now?.level === "calm" || !now) ? "decision" : now?.level ?? "calm";

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <h1 className={css.title}>{tx("Guardian")}</h1>

        {/* 1 — Guardian Now */}
        {now ? (
          <div className={`${g.now} ${g[level] || ""}`}>
            <span className={g.nowLevel}>{tx(LEVEL_LABEL[level] || "Calm")}</span>
            <span className={g.nowHeadline}>
              {pending.length > 0 && now.level === "calm"
                ? `${pending.length} ${pending.length > 1 ? tx("money moves need your decision") : tx("money move needs your decision")}`
                : tx(now.headline)}
            </span>
            {now.cause ? <span className={g.nowCause}>{tx(now.cause)}</span> : null}
            {primary ? (
              <button type="button" className={g.nowAction} onClick={primary.run}>{primary.label}</button>
            ) : null}
          </div>
        ) : (
          <div className={`${g.now} ${g.calm}`}>
            <span className={g.nowLevel}>{tx("Guardian")}</span>
            <span className={g.nowHeadline}>{tx("Reading your money…")}</span>
          </div>
        )}

        {/* Phase 2 — the decision loop: impact before you commit */}
        {decisionId ? (
          <div className={g.decision}>
            {!decision ? (
              <p className={css.micro}>{tx("Working out what this does…")}</p>
            ) : (
              <>
                <p className={css.kicker}>{tx("Before this runs")}</p>
                <dl className={g.decisionEv}>
                  {decision.evidence.map((e, i) => (
                    <div key={i} style={{ display: "contents" }}>
                      <dt>{tx(e.label)}</dt>
                      <dd>{tx(e.value)}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <ImpactRow name={tx("Money you can spend now")} v={decision.impact.spendableNow} currency={decision.impact.currency} warn={decision.impact.crossesSafetyLine} />
                  <ImpactRow name={tx("Lowest balance before your income")} v={decision.impact.lowestBeforeIncome} currency={decision.impact.currency} warn={decision.impact.crossesSafetyLine} />
                  <div className={g.impactRow}>
                    <span className={g.impactName}>{tx("Emergency buffer")}</span>
                    <span className={`${g.impactVal} ${g.same}`}>{tx("unchanged")}</span>
                  </div>
                  {decision.impact.debt ? (
                    <ImpactRow name={tx("Debt outstanding")} v={decision.impact.debt} currency={decision.impact.currency} />
                  ) : null}
                </div>
                {decision.impact.crossesSafetyLine ? (
                  <p className={css.micro} style={{ color: "var(--g-alert)" }}>{tx("This would take you below your safety line before your next income.")}</p>
                ) : !decision.impact.movesOutOfSpendable ? (
                  <p className={css.micro}>{tx("Your total spendable money is unchanged — this only moves it between your own accounts.")}</p>
                ) : null}
                <div className={g.decisionActs}>
                  <button type="button" className={g.go} disabled={busyId === decisionId} onClick={() => commitDecision("continue")}>{tx("Continue")}</button>
                  <button type="button" disabled={busyId === decisionId} onClick={() => setAdjustAmt(String(Math.round(decision.request.amount || 0)))}>{tx("Adjust amount")}</button>
                  <button type="button" disabled={busyId === decisionId} onClick={() => commitDecision("cancel")}>{tx("Cancel this move")}</button>
                  <button type="button" disabled={busyId === decisionId} onClick={() => { setDecisionId(null); setDecision(null); }}>{tx("Not now")}</button>
                </div>
                {adjustAmt !== "" ? (
                  <div className={css.field}>
                    <label htmlFor="gd-adj">{tx("New amount")} ({decision.impact.currency})</label>
                    <input id="gd-adj" inputMode="numeric" value={adjustAmt} onChange={(e) => setAdjustAmt(e.target.value.replace(/[^\d]/g, ""))} />
                    <button type="button" className={css.cta} disabled={busyId === decisionId || !(Number(adjustAmt) > 0)} onClick={() => commitDecision("adjust")}>{tx("Use this amount")}</button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {/* Recovery Mode — an ordered way back, not just a warning */}
        {recovery ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("A way back")}</p>
            <div className={g.decision}>
              {recovery.steps.map((s) => (
                <div key={s.order} className={g.impactRow} style={{ alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
                  <span className={g.impactVal}>{s.order}. {tx(s.label)}</span>
                  <span className={g.impactName}>{tx(s.detail)}</span>
                  {s.needsConfirm ? (
                    <button type="button" className={g.go} style={{ marginTop: 4 }} disabled={busyId === "apply_recovery_step"} onClick={() => guardianPost({ action: "apply_recovery_step", order: s.order })}>
                      {tx("Confirm this step")}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <p className={css.micro}>{tx("Guardian proposes this — nothing changes until you confirm a step.")}</p>
          </section>
        ) : null}

        {/* Collision Radar — two plans competing for the same cashflow */}
        {collision ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("Two plans are competing")}</p>
            <div className={g.decision}>
              <span className={g.impactVal}>{tx(collision.summary)}</span>
              <div className={g.decisionActs} style={{ flexDirection: "column", alignItems: "stretch" }}>
                {collision.paths.map((p) => (
                  <button key={p.id} type="button" style={{ textAlign: "left" }} disabled={busyId === "apply_collision_path"} onClick={() => guardianPost({ action: "apply_collision_path", pathId: p.id })}>
                    <b>{tx(p.label)}</b>
                    <span style={{ display: "block", fontWeight: 400, color: "var(--ink-soft)", marginTop: 2 }}>{tx(p.effect)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Promise Shield — the four buckets your money is carrying */}
        {shield ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("What your money is promised to")}</p>
            <div>
              {shield.buckets.map((b) => (
                <div key={b.id} className={g.impactRow}>
                  <span className={g.impactName}>{tx(b.name)}</span>
                  <span className={g.impactVal}>{shield.currency} {b.amount.toLocaleString("en-SG")}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* 2 — Protected by Guardian */}
        {protection ? (
          <section className={css.section}>
            <div className={g.protectHead}>
              <span className={g.protectCount}>{protection.summary.protectedCount} {tx("of")} {protection.summary.total} {tx("promises protected")}</span>
            </div>
            <p className={g.protectNext}>{tx("Next check")} {tx(protection.summary.nextCheck)}</p>
            {stage && stage.id !== "unknown" ? (
              <p className={g.stageLine}>
                <b>{tx(stage.label)}.</b> {tx("Guardian watches")} {tx(stage.focus)} {tx("hardest right now —")} {tx(stage.why)}
                {stage.caregiverNote ? ` ${tx(stage.caregiverNote)}` : ""}
              </p>
            ) : null}
            <div>
              {protection.domains.map((d) => (
                <div key={d.id} className={g.domain}>
                  <button type="button" className={g.domainRow} onClick={() => setOpenDomain(openDomain === d.id ? null : d.id)} aria-expanded={openDomain === d.id}>
                    <span className={`${g.dot} ${g[d.status] || ""}`} />
                    <span className={g.domainName}>{tx(d.name)}</span>
                    <span className={g.domainChevron}>{openDomain === d.id ? "–" : "+"}</span>
                  </button>
                  {openDomain === d.id ? (
                    <div className={g.domainBody}>
                      <span className={g.domainDetail}>{tx(d.detail)}</span>
                      <ul className={g.domainChecks}>
                        {d.checks.map((c) => <li key={c}>{tx(c)}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* 3 — Guardian Proof */}
        {proof.length > 0 ? (
          <section className={css.section}>
            <p className={css.kicker}>{tx("Guardian proof")}</p>
            {proof.slice(0, 4).map((p) => (
              <div key={p.id} className={g.proofCard}>
                <span className={g.proofWhen}>{relTime(p.when)}</span>
                <span className={g.proofLabel}>{tx("Finding")}</span><span className={g.proofValue}>{tx(p.finding)}</span>
                <span className={g.proofLabel}>{tx("Why")}</span><span className={g.proofValue}>{tx(p.reasoning)}</span>
                <span className={g.proofLabel}>{tx("Impact")}</span><span className={g.proofValue}>{p.impact.map((x) => tx(x)).join(" · ")}</span>
                <span className={g.proofLabel}>{tx("Decision")}</span><span className={g.proofValue}>{tx(p.decision)}</span>
                <span className={g.proofLabel}>{tx("Result")}</span><span className={`${g.proofValue} ${p.isActual ? "" : g.pending}`}>{tx(p.result)}</span>
              </div>
            ))}
          </section>
        ) : null}

        {/* ---- below the fold: the operational surface ---- */}
        <button type="button" className={g.foldToggle} onClick={() => setFoldOpen(!foldOpen)} aria-expanded={foldOpen} ref={foldRef}>
          <span>{tx("Handling, access & the Guardian Contract")}</span>
          <span>{foldOpen ? tx("Hide") : tx("Open")}</span>
        </button>

        {foldOpen ? (
          <>
            {/* approval queue */}
            {auth && (pending.length > 0 || auth.accountType === "youth" || auth.accountType === "guardian_managed_child") ? (
              <section className={css.section}>
                <p className={css.kicker}>{tx("Waiting for approval")}</p>
                {!auth.linkedApprover ? (
                  <p className={css.micro}>{tx("On a supervised account these go to a linked guardian. None is linked yet, so they wait here for you.")}</p>
                ) : null}
                {pending.length === 0 ? (
                  <div className={css.calmCard}><b>{tx("Nothing is waiting.")}</b></div>
                ) : (
                  pending.map((r) => (
                    <article key={r.id} className={`${fbc.moment} ${fbc.action_required}`}>
                      <div className={fbc.momentTop}>
                        <span className={`${fbc.sev} ${fbc.action_required}`}>{tx("needs approval")}</span>
                        <span className={fbc.evMeta} style={{ marginLeft: "auto" }}>{relTime(r.createdAt)}</span>
                      </div>
                      <div className={fbc.momentTitle}>{tx(r.summary)}</div>
                      {r.amount != null ? <div className={fbc.momentSummary}>{money(r.amount)}</div> : null}
                      {r.reason ? <div className={fbc.evMeta}>{tx("Why")}: {tx(r.reason)}</div> : null}
                      {r.autoExecuteAt ? <div className={fbc.evMeta}>{tx("Runs on its own in about")} {hoursLeft(r.autoExecuteAt)}h {tx("unless stopped.")}</div> : null}
                      {r.decidedBy === "guardian" ? <div className={fbc.evMeta}>{tx("A guardian approved this — needs your confirmation too.")}</div> : null}
                      {declineFor === r.id ? (
                        <div className={css.field}>
                          <label htmlFor={`dn-${r.id}`}>{tx("A short reason")}</label>
                          <input id={`dn-${r.id}`} type="text" value={declineNote} maxLength={140} autoComplete="off" onChange={(e) => setDeclineNote(e.target.value)} />
                          <div className={css.choiceGrid}>
                            <button type="button" className={css.cta} disabled={busyId === r.id || !declineNote.trim()} onClick={() => act({ action: "decide", id: r.id, decision: "declined", note: declineNote.trim() })}>{tx("Send decline")}</button>
                            <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => { setDeclineFor(null); setDeclineNote(""); }}>{tx("Back")}</button>
                          </div>
                        </div>
                      ) : (
                        <div className={css.choiceGrid}>
                          {r.decidedBy === "guardian" && !r.ownerConfirmedAt ? (
                            <button type="button" className={css.cta} disabled={busyId === r.id} onClick={() => act({ action: "confirm", id: r.id })}>{tx("Confirm & do it")}</button>
                          ) : (
                            <button type="button" className={css.cta} disabled={busyId === r.id} onClick={() => act({ action: "decide", id: r.id, decision: "approved" })}>{tx("Approve & do it")}</button>
                          )}
                          {r.autoExecuteAt ? (
                            <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => act({ action: "stop", id: r.id })}>{tx("Stop")}</button>
                          ) : (
                            <button type="button" className={css.choice} disabled={busyId === r.id} onClick={() => setDeclineFor(r.id)}>{tx("Decline")}</button>
                          )}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </section>
            ) : null}

            {/* people you look after + their nudges */}
            {inbox.length > 0 ? (
              <section className={css.section}>
                <p className={css.kicker}>{tx("They asked you to look")}</p>
                <div className={css.activity}>
                  {inbox.map((n) => (
                    <div key={n.id} className={css.actItem}>
                      <span className={css.actBody}><span className={css.actName}>{n.ownerLabel}</span><span className={css.actMeta}>{tx(n.title)}</span></span>
                      <button type="button" className={css.link} onClick={() => onOpenSupervised?.(n.ownerKey, n.ownerLabel)}>{tx("Open")}</button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {supervised.length > 0 ? (
              <section className={css.section}>
                <p className={css.kicker}>{tx("People you look after")}</p>
                <div className={css.activity}>
                  {supervised.map((p) => (
                    <div key={p.roleId} className={css.actItem}>
                      <span className={css.actBody}><span className={css.actName}>{p.ownerLabel}</span><span className={css.actMeta}>{tx(p.role)} · {p.scope === "approve" ? tx("view + approve") : tx("view only")}</span></span>
                      <button type="button" className={css.link} onClick={() => onOpenSupervised?.(p.ownerKey, p.ownerLabel)}>{tx("Open")}</button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {supervisors.length > 0 ? (
              <p className={css.micro}>{supervisors.map((s) => s.personLabel).join(", ")} {tx("can see this account's money health. Manage in Family & Care.")}</p>
            ) : null}

            {/* Guardian Contract */}
            {contract ? (
              <section className={css.section}>
                <p className={css.kicker}>{tx("Guardian Contract")}</p>
                <p className={css.micro}>{tx("Watch = observes only · Ask = surfaces and asks you · Act = does it inside its stated scope. Revocable any time.")}</p>
                {contract.capabilities.map((c) => (
                  <div key={c.capability} className={g.capRow}>
                    <span className={g.capLabel}>{tx(c.label)}</span>
                    <span className={g.capScope}>{tx(c.scope)}</span>
                    <span className={g.seg}>
                      {["watch", "ask", "act"].map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          aria-pressed={c.level === lv}
                          disabled={lv === "act" && !c.canAct}
                          onClick={() => setCap(c.capability, lv)}
                        >
                          {tx(lv[0].toUpperCase() + lv.slice(1))}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
                <button type="button" className={css.link} onClick={resetCaps} style={{ marginTop: 10 }}>{tx("Reset every capability to its default")}</button>
              </section>
            ) : null}
          </>
        ) : null}

        <FeatureHistory feature="guardian" label="Guardian's record with you" />
      </div>
    </div>
  );
}
