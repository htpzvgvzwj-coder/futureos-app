"use client";

// The Life tab — the visible spine. Reads the ONE server-owned Life Thread
// (+ Money Moments, plan movement, ledger) from FutureBankDataProvider.
// No second front-end model, no snapshot ids, no metric keys, no debug text.
//
//   1 Life position     - the six life nodes, human labels, unknown -> a
//                         concrete missing action
//   2 What is moving     - the single most meaningful real change now
//   3 Why it moved        - one plain reason + real source + updated time
//   4 What you can do next - one primary CTA into the right place
//   5 History             - only when real history exists

import css from "../../showcase/fb.module.css";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { money, humanMetric, relTime, afterLabel, isMaterial } from "./format.js";

// life node -> human label + the Studio (or add-reality) it opens, and the
// exact missing action when the node is unknown.
const NODES = {
  income: { label: "Income", domain: null, add: "Add your income", why: "so Future Bank can see what arrives each month" },
  safety: { label: "Safety", domain: "emergency", add: "Set a safety target", why: "so it knows your emergency floor", unit: "months" },
  home: { label: "Home", domain: "home", add: "Start a home plan", why: "to see when a home is reachable" },
  relationships: { label: "Family", domain: "relationships", add: "Set up family & care", why: "to manage a child's money, a guardian, a household or a beneficiary" },
  freedom: { label: "Freedom", domain: "investment", add: "Add income & expenses", why: "to see your free monthly cashflow" },
  future: { label: "Future", domain: "retirement", add: "Start a retirement plan", why: "to project the long term" },
};
const STATE_TEXT = { calm: "steady", moving: "moving", waiting_decision: "needs a decision", unknown: "not set up" };

export function LifeView(props) {
  return (
    <FutureBankDataProvider enabled>
      <Inner {...props} />
    </FutureBankDataProvider>
  );
}

function Inner({ onBack, onStudio, onAddReality, onHistory, onRoute }) {
  const fb = useFutureBankData();
  const lt = fb.lifeThread ?? {};
  const nodes = lt.lifeNodes ?? [];
  const moments = fb.moments ?? [];
  const plans = fb.planMovement ?? [];
  const ledger = fb.ledger?.events ?? [];

  if (fb.status === "loading" && !fb.lifeThread) {
    return <Shell onBack={onBack}><p className={css.lede}>Reading your life thread…</p></Shell>;
  }

  // 2. What is moving: the top material plan movement, else the top moment
  // that carries an affected plan.
  const movingPlan = plans.find((p) => (p.affected ?? []).some(isMaterial)) ?? null;
  const movingRow = movingPlan ? movingPlan.affected.filter(isMaterial)[0] : null;
  const movingMoment =
    moments.find((m) => m.affectedPlans?.some((a) => a.direction && a.direction !== "flat")) ??
    moments.find((m) => m.sourceType === "reality_drift" || m.sourceType === "plan_impact") ??
    moments[0] ??
    null;

  let moving = null;
  if (movingPlan && movingRow) {
    const al = afterLabel(movingRow);
    moving = {
      title: `${cap(movingPlan.domain)} · ${humanMetric(movingRow.metric)}`,
      change: `${movingRow.before != null ? `${fmt(movingRow.before, movingRow.unit)} → ` : ""}${al.value === "Needs more information" ? al.value : fmt(al.value, movingRow.unit)}`,
      tag: al.tag ?? (movingPlan.state === "committed" ? "Committed" : "Preview"),
      why: `Because your ${movingPlan.domain} plan changed.`,
      source: movingPlan.lastChange ? "Change Ledger" : "Life Thread projection",
      updated: movingPlan.lastUpdatedAt ?? lt.generatedAt,
      cta: { label: `Review the ${movingPlan.domain} plan`, run: () => onStudio?.(movingPlan.domain) },
    };
  } else if (movingMoment) {
    const a = movingMoment.affectedPlans?.find((x) => x.direction && x.direction !== "flat");
    moving = {
      title: movingMoment.title,
      change: a
        ? `${a.before != null ? `${fmt(a.before, a.unit)} → ` : ""}${a.confirmedAfter ?? a.possibleAfter ?? "Needs more information"}`
        : null,
      tag: a?.confirmedAfter != null ? "Committed" : a ? "Preview" : null,
      why: movingMoment.whyNow || movingMoment.summary,
      source: movingMoment.evidence?.[0]?.source ? sourceLabel(movingMoment.evidence[0].source) : "Future Bank detection",
      updated: movingMoment.occurredAt,
      cta: movingMoment.nextActions?.[0]
        ? { label: movingMoment.nextActions[0].label, run: () => onRoute?.(movingMoment.nextActions[0].route) }
        : { label: "Open Guardian", run: () => onRoute?.("guardian") },
    };
  }

  return (
    <Shell onBack={onBack}>
      <div>
        <h1 className={css.title}>Life</h1>
        <p className={css.micro}>What's steady, what's moving, why, and the one next step — all from your real money.</p>
      </div>

      {/* 1. LIFE POSITION */}
      <section className={css.section}>
        <p className={css.kicker}>Life position</p>
        <div className={css.lifeGrid}>
          {nodes.map((n) => {
            const meta = NODES[n.id] ?? { label: cap(n.id) };
            const st = n.state ?? (n.known ? "calm" : "unknown");
            const valueText =
              st === "unknown"
                ? null
                : n.value == null
                  ? "set"
                  : n.id === "safety"
                    ? `${round1(n.value)} mo`
                    : money(n.value);
            return (
              <button
                key={n.id}
                type="button"
                className={`${css.lifeNode} ${css["life_" + st] || ""}`}
                onClick={() => (st === "unknown" ? (meta.domain ? onStudio?.(meta.domain) : onAddReality?.()) : meta.domain ? onStudio?.(meta.domain) : onAddReality?.())}
              >
                <span className={css.lifeNodeTop}>
                  <span className={css.lifeDot} />
                  <b>{meta.label}</b>
                </span>
                {st === "unknown" ? (
                  <span className={css.lifeNodeAction}>{meta.add} →</span>
                ) : (
                  <span className={css.lifeNodeVal}>{valueText} · {STATE_TEXT[st]}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2 + 3 + 4. WHAT IS MOVING / WHY / NEXT */}
      <section className={css.section}>
        <p className={css.kicker}>What is moving</p>
        {!moving ? (
          <div className={css.calmCard}>
            <b>Nothing is moving right now.</b>
            <span className={css.micro}>When a transaction, a bill, a plan or your income shifts, it shows here with why and one next step.</span>
          </div>
        ) : (
          <div className={css.movingCard}>
            <div className={css.movingHead}>
              <b>{moving.title}</b>
              {moving.tag ? <span className={moving.tag === "Committed" ? css.committedPill : css.previewPill}>{moving.tag}</span> : null}
            </div>
            {moving.change ? <div className={css.movingChange}>{moving.change}</div> : null}
            <div className={css.micro}>Why: {moving.why}</div>
            <div className={css.micro}>Source: {moving.source} · updated {relTime(moving.updated)}</div>
            <button type="button" className={`${css.cta} ${css.ctaSea}`} style={{ marginTop: 6 }} onClick={moving.cta.run}>
              {moving.cta.label}
            </button>
          </div>
        )}
      </section>

      {/* 5. HISTORY — only when real */}
      {ledger.length > 0 && (
        <section className={css.section}>
          <p className={css.kicker}>History</p>
          <div className={css.activity}>
            {ledger.slice(0, 4).map((e) => (
              <div key={e.id} className={css.actItem}>
                <span className={css.actGlyph}>{String(e.action_type || "?")[0].toUpperCase()}</span>
                <span className={css.actBody}>
                  <span className={css.actName}>{String(e.message_key || e.action_type || "change").replace(/[._]/g, " ")}</span>
                  <span className={css.actMeta}>{e.status} · {relTime(e.occurred_at)}</span>
                </span>
              </div>
            ))}
          </div>
          <button type="button" className={css.link} onClick={onHistory}>Open full history →</button>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children, onBack }) {
  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        {onBack ? <button type="button" className={css.backLink} onClick={onBack}>← Today</button> : null}
        {children}
      </div>
    </div>
  );
}

const cap = (s) => String(s || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
function fmt(v, unit) {
  if (v == null) return "Needs more information";
  if (unit === "sgd_per_month" && Number.isFinite(Number(v))) return `SGD ${Math.round(Number(v)).toLocaleString("en-SG")}`;
  return String(v);
}
function sourceLabel(s) {
  const m = {
    money_rescue_detector: "money-rescue detector",
    transaction_ledger: "transaction ledger",
    reality_drift_detector: "reality-drift detector",
    studio_impacts: "plan projection",
    life_thread: "life thread",
    ripple_events: "current ripple",
    change_ledger: "change ledger",
    plan_version: "your plan",
  };
  return m[s] ?? String(s).replace(/_/g, " ");
}
