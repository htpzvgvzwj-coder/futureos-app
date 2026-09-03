"use client";

// The Life tab — the Living Thread. One continuously-changing line:
//   Life Direction   - a sentence generated from reality
//   three numbers    - free each month / promised to your future / safety months
//   the line         - the nodes that really exist, node meaning carried by
//                      the dot's form (solid / hollow / ghost / pulse)
//   What Moved       - the single most recent change + its knock-on effects
// No nine-Studio grid, no snapshot ids, no metric keys, no dashboard.

import { useState } from "react";
import css from "../../showcase/fb.module.css";
import life from "./life.module.css";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { FeatureHistory } from "./FeatureHistory.jsx";
import { relTime } from "./format.js";
import { buildLivingThread } from "../../../lib/life/thread.js";
import { buildFutureEcho, answerLineQuestion } from "../../../lib/life/ask.js";
import { detectCollision } from "../../../lib/guardian/collision.js";

const NODE_TARGET = { income: "today", safety: "emergency", home: "home", relationships: "family", freedom: "investment", future: "retirement" };
const money = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;

export function LifeView(props) {
  return (
    <FutureBankDataProvider enabled>
      <Inner {...props} />
    </FutureBankDataProvider>
  );
}

function Inner({ onStudio, onAddReality, onRoute }) {
  const fb = useFutureBankData();
  const lt = fb.lifeThread ?? {};
  const moments = Array.isArray(fb.moments) ? fb.moments : [];
  const planMovement = Array.isArray(fb.planMovement) ? fb.planMovement : [];
  const [openNum, setOpenNum] = useState(null);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState(null);

  const collision = detectCollision({
    commitments: Array.isArray(lt.commitments) ? lt.commitments : [],
    availableMonthly: lt.availableMonthlyCashflow ?? null,
  });
  const thread = buildLivingThread({ lt, moments, planMovement, collision });
  const echo = buildFutureEcho({ lt });

  const ask = (text) => {
    const query = (text ?? q).trim();
    if (!query) return;
    if (text != null) setQ(text);
    setAnswer(answerLineQuestion(query, { lt, collision }));
  };

  const openNode = (id) => {
    if (id === "relationships") return onStudio?.("relationships");
    const t = NODE_TARGET[id];
    if (t === "today") return onRoute?.("today");
    if (t) return onStudio?.(t);
    onAddReality?.();
  };

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <h1 className={css.title}>Life</h1>

        <p className={life.direction}>{thread.direction}</p>

        {thread.weather ? (
          <span className={`${life.weather} ${life[thread.weather.id] || ""}`} title={thread.weather.note}>
            <span className={life.weatherDot} /> {thread.weather.label}
          </span>
        ) : null}

        <div className={life.numbers}>
          {thread.numbers.map((n) => (
            <button key={n.id} type="button" className={life.numCell} onClick={() => setOpenNum(openNum === n.id ? null : n.id)}>
              <span className={life.numLabel}>{n.label}</span>
              <span className={`${life.numValue} ${n.value == null ? life.unset : ""}`}>{n.value ?? n.emptyHint ?? "—"}</span>
            </button>
          ))}
        </div>
        {openNum ? <p className={life.numSource}>{thread.numbers.find((x) => x.id === openNum)?.source}</p> : null}

        {thread.whatMoved ? (
          <div className={life.moved}>
            <span className={life.movedHead}>{thread.whatMoved.headline}</span>
            {thread.whatMoved.impacts.map((im, i) => (
              <span key={i} className={life.movedImpact}>{im}</span>
            ))}
            <span className={life.movedWhen}>{relTime(thread.whatMoved.when)} · {thread.whatMoved.status}</span>
          </div>
        ) : null}

        <section className={css.section}>
          <div className={life.thread}>
            {thread.nodes.map((n) => (
              <div key={n.id} className={life.node}>
                <span className={`${life.nodeDot} ${life[n.state] || ""} ${n.ring ? life.ring : ""}`} />
                <div className={life.nodeRowTop}>
                  <span className={life.nodeName}>{n.label}</span>
                  {n.valueText ? <span className={life.nodeVal}>{n.valueText}</span> : null}
                  {n.collision ? (
                    <span className={life.nodeCollision}>{n.note}</span>
                  ) : n.note ? (
                    <span className={life.nodeState}>{n.note}</span>
                  ) : null}
                </div>
                <button type="button" className={life.nodeBtn} onClick={() => openNode(n.id)}>
                  {n.cta} →
                </button>
              </div>
            ))}
            {thread.futureSlot ? (
              <button type="button" className={life.futureSlot} onClick={() => onRoute?.("explore")}>
                <span className={life.nodeDot} />
                <span>{thread.futureSlot.label}</span>
              </button>
            ) : null}
          </div>
        </section>

        {echo.plans.length ? (
          <div className={life.echo}>
            <span className={life.echoHead}>If today&apos;s plans keep running</span>
            {echo.plans.map((p) => (
              <div key={p.domain} className={life.echoRow}>
                <span className={life.echoLabel}>{p.label} · {money(p.monthly)}/mo</span>
                <span className={life.echoCells}>
                  {p.at.map((a) => (
                    <span key={a.years} className={life.echoCell}>+<b>{money(a.added)}</b> in {a.years}y</span>
                  ))}
                </span>
              </div>
            ))}
            {echo.safety ? (
              <div className={life.echoRow}>
                <span className={life.echoLabel}>Safety buffer · {echo.safety.nowMonths.toFixed(1)} months now</span>
                <span className={life.echoCells}>
                  {echo.safety.at.map((a) => (
                    <span key={a.years} className={life.echoCell}><b>{a.months.toFixed(1)} mo</b> in {a.years}y</span>
                  ))}
                </span>
              </div>
            ) : null}
            <span className={life.echoBasis}>{echo.basis}</span>
          </div>
        ) : null}

        <div className={life.ask}>
          <form className={life.askRow} onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <input
              className={life.askInput}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask about your line…"
              aria-label="Ask about your line"
            />
            <button type="submit" className={life.askBtn} disabled={!q.trim()}>Ask</button>
          </form>
          {answer?.text ? <p className={life.askAnswer}>{answer.text}</p> : null}
          {answer && !answer.text && answer.examples ? (
            <div className={life.askExamples}>
              <span className={life.echoBasis}>Try one of these:</span>
              {answer.examples.map((ex) => (
                <button key={ex} type="button" className={life.askExample} onClick={() => ask(ex)}>{ex}</button>
              ))}
            </div>
          ) : null}
        </div>

        <FeatureHistory feature="explore" label="How this line formed" />
      </div>
    </div>
  );
}
