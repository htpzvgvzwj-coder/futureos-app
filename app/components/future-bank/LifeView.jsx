"use client";

// The Life tab — the Living Thread. One continuously-changing line:
//   Life Direction   - a sentence generated from reality
//   three numbers    - free each month / promised to your future / safety months
//   the line         - the nodes that really exist, node meaning carried by
//                      the dot's form (solid / hollow / ghost / pulse)
//   What Moved       - the single most recent change + its knock-on effects
// No nine-Studio grid, no snapshot ids, no metric keys, no dashboard.

import { useCallback, useEffect, useRef, useState } from "react";
import css from "../../showcase/fb.module.css";
import life from "./life.module.css";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { useTx } from "./i18n.jsx";
import { relTime } from "./format.js";
import { buildLivingThread } from "../../../lib/life/thread.js";
import { compactThread } from "../../../lib/life/snapshot-shape.js";
import { buildFutureEcho, answerLineQuestion } from "../../../lib/life/ask.js";
import { detectCollision } from "../../../lib/guardian/collision.js";
import { isPullable } from "../../../lib/life/pull.js";
import { buildLifeMemory } from "../../../lib/life/memory.js";
import { PullFold } from "./PullFold.jsx";
import { LifeMemory } from "./LifeMemory.jsx";

// The three numbers, read out as one Life Position sentence instead of a
// dashboard row. Each fragment stays tappable for its source. Returns
// { key, params } pairs so the sentence localises.
function positionFragments(numbers) {
  const by = Object.fromEntries((numbers || []).map((n) => [n.id, n]));
  const free = by.free;
  const safety = by.safety;
  const committed = by.committed;
  const hasCommitted = committed?.value && !/^SGD 0\b/.test(committed.value);
  return [
    {
      id: "free",
      key: free?.value != null ? "You have {v}/month free." : "Your monthly free money isn't worked out yet.",
      params: free?.value != null ? { v: free.value } : null,
      source: free?.source,
    },
    {
      id: "safety",
      key: safety?.value != null ? "Your safety covers {v}." : "Your safety buffer isn't set up.",
      params: safety?.value != null ? { v: safety.value } : null,
      source: safety?.source,
    },
    {
      id: "committed",
      key: hasCommitted ? "{v} is promised to your future plans." : "No money is promised to future plans yet.",
      params: hasCommitted ? { v: committed.value } : null,
      source: committed?.source,
    },
  ];
}

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
  const { tx } = useTx();
  const fb = useFutureBankData();
  const lt = fb.lifeThread ?? {};
  const moments = Array.isArray(fb.moments) ? fb.moments : [];
  const planMovement = Array.isArray(fb.planMovement) ? fb.planMovement : [];
  const [openNum, setOpenNum] = useState(null);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState(null);
  const [pullNode, setPullNode] = useState(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [replay, setReplay] = useState(null); // { eventId, when, snapshot } | null
  const [replayable, setReplayable] = useState([]); // ledger event ids with a snapshot
  const reconciledFor = useRef(null);

  const collision = detectCollision({
    commitments: Array.isArray(lt.commitments) ? lt.commitments : [],
    availableMonthly: lt.availableMonthlyCashflow ?? null,
  });
  const thread = buildLivingThread({ lt, moments, planMovement, collision });
  const echo = buildFutureEcho({ lt });
  const memory = buildLifeMemory({ events: fb.ledger?.events, twin: fb.twin, lifeThread: lt });
  const position = positionFragments(thread.numbers);

  // Capture the current line against the latest direction-changing event
  // (forward-only), and learn which memory records can be replayed.
  const latestId = memory.latest?.id ?? null;
  const captureAndLearn = useCallback(async () => {
    if (!lt.lifeNodes) return;
    const sig = `${latestId ?? "none"}:${thread.numbers.map((n) => n.value).join("|")}`;
    if (reconciledFor.current === sig) return;
    reconciledFor.current = sig;
    try {
      await fetch("/api/life-thread/snapshots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thread: compactThread(thread), latestEventId: latestId, latestEventAt: memory.latest?.when ?? null }),
      });
      const r = await fetch("/api/life-thread/snapshots", { headers: { "cache-control": "no-cache" } }).then((x) => (x.ok ? x.json() : null));
      if (r) setReplayable(r.snapshottedEventIds ?? []);
    } catch {
      /* snapshots are best-effort */
    }
  }, [latestId, lt.lifeNodes, thread, memory.latest]);
  useEffect(() => {
    captureAndLearn();
  }, [captureAndLearn]);

  const enterReplay = async (eventId, when) => {
    const r = await fetch(`/api/life-thread/snapshots?event=${encodeURIComponent(eventId)}`, { headers: { "cache-control": "no-cache" } })
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null);
    if (r?.snapshot) setReplay({ eventId, when, snapshot: r.snapshot });
  };
  const exitReplay = () => setReplay(null);

  // In replay the frozen snapshot drives the head of the page.
  const st = replay?.snapshot?.thread ?? null;
  const shownDirectionKey = st ? st.directionKey ?? st.direction : thread.directionKey ?? thread.direction;
  const shownDirectionParams = st ? st.directionParams : thread.directionParams;
  const shownWeather = st ? st.weather : thread.weather;
  const shownNodes = st ? st.nodes ?? [] : thread.nodes;
  const shownPosition = st ? positionFragments(st.numbers ?? []) : position;

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
        <h1 className={css.title}>{tx("Life")}</h1>

        {replay ? (
          <div className={life.replayBanner}>
            <span>{tx("Viewing your life on {d}", { d: new Date(replay.when || replay.snapshot.event_at || replay.snapshot.captured_at).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" }) })}</span>
            <button type="button" className={css.link} onClick={exitReplay}>{tx("Return to now")}</button>
          </div>
        ) : null}

        <p className={life.direction}>{tx(shownDirectionKey, shownDirectionParams)}</p>

        {shownWeather ? (
          <span
            className={`${life.weather} ${life[shownWeather.id] || ""}`}
            title={!replay ? tx(thread.weather?.noteKey ?? thread.weather?.note, thread.weather?.noteParams) : undefined}
          >
            <span className={life.weatherDot} /> {tx(shownWeather.label)}
          </span>
        ) : null}

        <p className={life.position}>
          {shownPosition.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`${life.posFrag} ${openNum === f.id ? life.posFragOpen : ""}`}
              onClick={() => setOpenNum(openNum === f.id ? null : f.id)}
            >
              {tx(f.key, f.params)}{" "}
            </button>
          ))}
        </p>
        {openNum && !replay ? <p className={life.numSource}>{tx(position.find((x) => x.id === openNum)?.source)}</p> : null}

        {!replay && thread.whatMoved ? (
          <div className={life.moved}>
            <span className={life.movedHead}>{tx(thread.whatMoved.headline)}</span>
            {thread.whatMoved.impacts.map((im, i) => (
              <span key={i} className={life.movedImpact}>{im}</span>
            ))}
            <span className={life.movedWhen}>{relTime(thread.whatMoved.when)} · {tx(thread.whatMoved.status)}</span>
          </div>
        ) : null}

        <section className={css.section}>
          <div className={life.thread}>
            {shownNodes.map((n) => (
              <div key={n.id} className={life.node}>
                <span className={`${life.nodeDot} ${life[n.state] || ""} ${n.ring ? life.ring : ""}`} />
                <div className={life.nodeRowTop}>
                  <span className={life.nodeName}>{tx(n.label)}</span>
                  {n.valueText ? <span className={life.nodeVal}>{n.valueText}</span> : null}
                  {n.collision ? (
                    <span className={life.nodeCollision}>{tx(n.note)}</span>
                  ) : n.note ? (
                    <span className={life.nodeState}>{tx(n.note)}</span>
                  ) : null}
                </div>
                {replay ? null : (
                <div className={life.nodeActs}>
                  <button type="button" className={life.nodeBtn} onClick={() => openNode(n.id)}>
                    {tx(n.cta)} →
                  </button>
                  {isPullable(n.id) && n.state !== "hollow" ? (
                    <button
                      type="button"
                      className={life.nodePull}
                      aria-expanded={pullNode === n.id}
                      onClick={() => setPullNode(pullNode === n.id ? null : n.id)}
                    >
                      {pullNode === n.id ? tx("Close") : tx("Try a change")}
                    </button>
                  ) : null}
                </div>
                )}
                {!replay && pullNode === n.id ? (
                  <PullFold
                    nodeId={n.id}
                    onClose={() => setPullNode(null)}
                    onChanged={() => fb.refetchAll?.()}
                    onStudio={(d) => onStudio?.(d)}
                  />
                ) : null}
              </div>
            ))}
            {!replay && thread.futureSlot ? (
              <button type="button" className={life.futureSlot} onClick={() => onRoute?.("explore")}>
                <span className={life.nodeDot} />
                <span>{tx(thread.futureSlot.label)}</span>
              </button>
            ) : null}
          </div>
        </section>

        {!replay && echo.plans.length ? (
          <div className={life.echo}>
            <span className={life.echoHead}>{tx("If today's plans keep running")}</span>
            {echo.plans.map((p) => (
              <div key={p.domain} className={life.echoRow}>
                <span className={life.echoLabel}>{tx(p.label)} · {money(p.monthly)}/mo</span>
                <span className={life.echoCells}>
                  {p.at.map((a) => (
                    <span key={a.years} className={life.echoCell}>+<b>{money(a.added)}</b> {tx("in")} {a.years}{tx("y")}</span>
                  ))}
                </span>
              </div>
            ))}
            {echo.safety ? (
              <div className={life.echoRow}>
                <span className={life.echoLabel}>{tx("Safety buffer")} · {echo.safety.nowMonths.toFixed(1)} {tx("months now")}</span>
                <span className={life.echoCells}>
                  {echo.safety.at.map((a) => (
                    <span key={a.years} className={life.echoCell}><b>{a.months.toFixed(1)} {tx("mo")}</b> {tx("in")} {a.years}{tx("y")}</span>
                  ))}
                </span>
              </div>
            ) : null}
            <span className={life.echoBasis}>{tx(echo.basis)}</span>
          </div>
        ) : null}

        {!replay ? (
          <div className={life.ask}>
            <form className={life.askRow} onSubmit={(e) => { e.preventDefault(); ask(); }}>
              <input
                className={life.askInput}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tx("Ask about your line…")}
                aria-label={tx("Ask about your line")}
              />
              <button type="submit" className={life.askBtn} disabled={!q.trim()}>{tx("Ask")}</button>
            </form>
            {answer?.text ? <p className={life.askAnswer}>{tx(answer.text)}</p> : null}
            {answer && !answer.text && answer.examples ? (
              <div className={life.askExamples}>
                <span className={life.echoBasis}>{tx("Try one of these:")}</span>
                {answer.examples.map((ex) => (
                  <button key={ex} type="button" className={life.askExample} onClick={() => ask(ex)}>{tx(ex)}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {!replay ? (
          <section className={css.section}>
            <LifeMemory
              memory={memory}
              open={memoryOpen}
              onToggle={() => setMemoryOpen(!memoryOpen)}
              replayableIds={replayable}
              onReplay={enterReplay}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
