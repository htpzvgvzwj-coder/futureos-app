"use client";

// Guardian — the decision queue. It reads the SAME Money Moment objects as
// Today, Life and Explore (via FutureBankDataProvider): no second alert
// model, no chatbot. What needs a decision, what it is watching, and the
// fixed list of what Guardian can never do on its own.

import css from "../../showcase/fb.module.css";
import fbc from "./future-bank.module.css";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { relTime } from "./format.js";

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

function Inner({ onRoute }) {
  const fb = useFutureBankData();
  const all = fb.momentsRaw?.allMoments ?? fb.moments ?? [];
  const decisions = all.filter((m) => m.state === "new" && (m.severity === "action_required" || m.sourceType === "turning_point"));
  const watching = all.filter((m) => m.state === "new" && m.severity === "watch" && m.sourceType !== "turning_point");

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <div>
          <h1 className={css.title}>Guardian</h1>
          <p className={css.micro}>The same signals as Today, Life and Explore — here they become decisions. Guardian asks; you decide.</p>
        </div>

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
