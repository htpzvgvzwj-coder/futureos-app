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
import { detectCollision } from "../../../lib/guardian/collision.js";

const NODE_TARGET = { income: "today", safety: "emergency", home: "home", relationships: "family", freedom: "investment", future: "retirement" };
const STATE_WORD = { solid: "on track", hollow: "not set up", ghost: "being planned", pulse: "just changed" };

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

  const collision = detectCollision({
    commitments: Array.isArray(lt.commitments) ? lt.commitments : [],
    availableMonthly: lt.availableMonthlyCashflow ?? null,
  });
  const thread = buildLivingThread({ lt, moments, planMovement, collision });

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
              <span className={`${life.numValue} ${n.value == null ? life.unset : ""}`}>{n.value ?? "not set up"}</span>
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
                  {n.collision ? <span className={life.nodeCollision}>competing</span> : <span className={life.nodeState}>{STATE_WORD[n.state]}</span>}
                </div>
                <button type="button" className={life.nodeBtn} onClick={() => openNode(n.id)}>
                  {n.state === "hollow" ? "Set this up →" : "Open →"}
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

        <FeatureHistory feature="explore" label="How this line formed" />
      </div>
    </div>
  );
}
