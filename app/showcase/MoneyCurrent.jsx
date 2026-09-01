"use client";

// "Money Current" - the signature Future Bank component. A compact,
// readable current of real money events through time:
//
//   Now  →  next bill  →  next income  →  protected money  →  next decision
//
// It is NOT a decorative chart. Every node is real Financial Twin data
// (or an explicit "next decision" the user is shaping). It is the visual
// language reused by the Change Receipt as a ripple.

import css from "./fb.module.css";

const sgd = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
const shortDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
};
// twin = /api/financial-twin payload. decision = optional { label, amount, when }.
export function buildCurrentNodes(twin, decision = null) {
  const s2s = twin?.safeToSpend ?? {};
  const bd = s2s.breakdown ?? {};
  const nextBill = s2s.nearTermObligationsList?.[0] ?? null;
  const nextIncome = s2s.nextIncome ?? null;

  const nodes = [
    {
      key: "now",
      kind: "now",
      label: "Now",
      amount: s2s.safeToSpend ?? twin?.twin?.balanceBreakdown?.availableNow ?? 0,
      when: null,
      whenText: "safe to spend",
      effect: "This is your Available now",
      source: "Financial Twin · Safe-to-Spend",
    },
  ];
  if (nextBill) {
    nodes.push({
      key: "bill",
      kind: "out",
      label: "Bill",
      amount: -Math.abs(nextBill.amount),
      when: nextBill.dueDate,
      whenText: shortDate(nextBill.dueDate),
      name: nextBill.label,
      effect: `Lowers Available by ${sgd(Math.abs(nextBill.amount))} on ${shortDate(nextBill.dueDate)}`,
      source: "Recurring obligation · confirmed",
    });
  }
  if (nextIncome) {
    nodes.push({
      key: "income",
      kind: "in",
      label: "Income",
      amount: Math.abs(nextIncome.amount),
      when: nextIncome.expectedDate,
      whenText: nextIncome.inDays != null ? `in ${nextIncome.inDays}d` : shortDate(nextIncome.expectedDate),
      name: nextIncome.label,
      effect: `Raises Available by ${sgd(Math.abs(nextIncome.amount))} on ${shortDate(nextIncome.expectedDate)}`,
      source: `Income stream · ${nextIncome.confidence ?? "expected"}`,
    });
  }
  const protectedAmt = bd.protectedReserve ?? twin?.twin?.balanceBreakdown?.protectedFor ?? 0;
  if (protectedAmt > 0) {
    nodes.push({
      key: "protected",
      kind: "protected",
      label: "Protected",
      amount: protectedAmt,
      when: null,
      whenText: "kept back",
      effect: "Held out of Available as your safety buffer",
      source: "Your protected reserve",
    });
  }
  if (decision) {
    nodes.push({
      key: "decision",
      kind: "decision",
      label: decision.label ?? "Decision",
      amount: decision.amount ?? null,
      when: decision.when ?? null,
      whenText: decision.whenText ?? (decision.when ? shortDate(decision.when) : "you're shaping this"),
      effect: decision.effect ?? "Not affecting Available yet",
      source: decision.source ?? "A plan you are shaping",
    });
  } else {
    nodes.push({
      key: "decision",
      kind: "decision",
      label: "Decision",
      amount: null,
      when: null,
      whenText: "none pending",
      effect: "Nothing pending",
      source: "—",
    });
  }
  return nodes;
}

const NODE_CLASS = {
  now: css.nodeNow,
  in: css.nodeIn,
  out: css.nodeOut,
  protected: css.nodeProtected,
  decision: css.nodeDecision,
};

export function MoneyCurrent({ twin, decision = null, onExplain = null, compact = false, detail = false }) {
  const nodes = buildCurrentNodes(twin, decision);
  const n = nodes.length;

  return (
    <section className={css.current} aria-label="Money Current">
      {!compact && (
        <div className={css.currentHead}>
          <span className={css.currentTitle}>Your money current</span>
          {onExplain ? (
            <button type="button" className={css.currentLink} onClick={() => onExplain("current")}>
              How this is built
            </button>
          ) : null}
        </div>
      )}
      <div className={`${css.track} ${compact ? css.trackCompact : ""}`}>
        <div className={css.trackLine} />
        {nodes.map((node, i) => {
          const align = i === 0 ? css.nodeStart : i === n - 1 ? css.nodeEnd : "";
          return (
            <div key={node.key} className={`${css.node} ${NODE_CLASS[node.kind]} ${align}`}>
              <span className={css.nodeLabelTop}>{node.label}</span>
              <span className={css.nodeDot} />
              <span className={css.nodeAmt}>
                {node.amount != null ? (
                  <>
                    {node.amount < 0 ? "−" : node.kind === "in" ? "+" : ""}
                    {sgd(Math.abs(node.amount))}
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span className={css.nodeWhen}>{node.whenText}</span>
            </div>
          );
        })}
      </div>
      {detail && !compact && (
        <div className={css.currentDetail}>
          {nodes.map((node) => (
            <div key={node.key} className={css.currentDetailRow}>
              <span className={css.currentDetailLabel}>{node.name || node.label}</span>
              <span className={css.currentDetailEffect}>{node.effect}</span>
              <span className={css.currentDetailSource}>{node.source}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// The Change Receipt ripple: Before → you changed → recalculated → what
// moved → next. Only shows a numeric delta when the server returned one.
export function MoneyCurrentRipple({ before, after, changedLabel, consequence, movedRows = [], onNext, nextLabel = "Back to what needs you" }) {
  return (
    <section className={css.ripple} aria-label="What changed">
      <p className={css.kicker}>What changed</p>
      <div className={css.rippleRow}>
        <span className={css.rk}>Before</span>
        <span>{before}</span>
      </div>
      <div className={css.rippleRow}>
        <span className={css.rk}>You changed</span>
        <span>{changedLabel}</span>
      </div>
      <div className={css.rippleRow}>
        <span className={css.rk}>Now</span>
        <span>{after}</span>
      </div>
      {movedRows.map((r, i) => (
        <div key={i} className={`${css.rippleRow} ${css.moved}`}>
          <span className={css.rk}>Moved</span>
          <span>
            {r.text}{" "}
            {r.delta ? <span className={r.up ? css.deltaUp : css.deltaDown}>{r.delta}</span> : null}
          </span>
        </div>
      ))}
      {consequence ? (
        <div className={css.rippleRow}>
          <span className={css.rk}>Meaning</span>
          <span>{consequence}</span>
        </div>
      ) : null}
      {onNext ? (
        <button type="button" className={css.cta} onClick={onNext} style={{ marginTop: 4 }}>
          {nextLabel}
        </button>
      ) : null}
    </section>
  );
}
