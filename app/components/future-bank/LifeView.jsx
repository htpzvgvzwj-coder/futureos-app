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
import { buildFutureEcho, answerLineQuestion, lineSuggestions } from "../../../lib/life/ask.js";
import { forecastHeadline } from "../../../lib/life/forecast.js";
import { buildNodeMoment } from "../../../lib/life/moment.js";
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
const capWord = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());

// tx a key whose params may themselves be translatable words (domain
// labels etc.) — translate each string param, then fill.
function txWithParams(tx, key, params) {
  if (!params) return tx(key);
  const mapped = {};
  for (const [k, v] of Object.entries(params)) mapped[k] = typeof v === "string" ? tx(v) : v;
  return tx(key, mapped);
}

// Turn a Future Field preview's projectedImpacts into short line-movement
// strings — shared shape with PullFold's impact rows.
function askSimLines(preview, tx, fmtMoney) {
  const pi = preview?.projectedImpacts;
  if (!pi) return [];
  const out = [];
  const rd = pi.resourceDelta || {};
  if (rd.freedMonthly > 0) out.push(`${tx("Frees")} ${fmtMoney(rd.freedMonthly)}/${tx("mo")}`);
  if (rd.addedPressureMonthly > 0) out.push(`${tx("Needs")} ${fmtMoney(rd.addedPressureMonthly)}/${tx("mo")} ${tx("more")}`);
  for (const g of pi.affectedGoals || []) {
    const before = g.before ?? null;
    const after = g.possibleAfter ?? g.confirmedAfter ?? null;
    if (before == null || after == null || Number(before) === Number(after)) continue;
    const f = (v) =>
      g.unit === "sgd_per_month" ? `${fmtMoney(v)}/mo` : g.unit === "sgd" ? fmtMoney(v) : g.unit === "date_shift_months" ? `${v > 0 ? "+" : ""}${Number(v).toFixed(0)} mo` : g.unit === "months" ? `${Number(v).toFixed(1)} mo` : String(v);
    out.push(`${tx(capWord(g.goalId))}: ${f(before)} → ${f(after)}`);
  }
  return out.slice(0, 4);
}

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
  const [forecast, setForecast] = useState(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [askSim, setAskSim] = useState(null); // preview of an Ask-the-Line "what if"
  const [momentNode, setMomentNode] = useState(null); // node id -> Moment Sheet
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

  useEffect(() => {
    fetch("/api/life-thread/forecast", { headers: { "cache-control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setForecast(d && !d.error ? d : null))
      .catch(() => setForecast(null));
  }, []);
  const fcHead = forecast ? forecastHeadline(forecast) : null;

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

  const ask = async (text) => {
    const query = (text ?? q).trim();
    if (!query) return;
    if (text != null) setQ(text);
    const a = answerLineQuestion(query, { lt, collision });
    setAnswer(a);
    setAskSim(null);
    if (a.simulate?.domain && a.simulate.overrides) {
      const r = await fetch(`/api/future-field/branch?action=preview&domain=${a.simulate.domain}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overrides: a.simulate.overrides }),
      })
        .then((x) => (x.ok ? x.json() : null))
        .catch(() => null);
      if (r?.preview) setAskSim({ label: a.simulate.label, preview: r.preview });
    }
  };
  const suggestions = lineSuggestions({ lt, collision });

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

        {!replay && fcHead ? (
          <button
            type="button"
            className={`${life.forecast} ${life[`fc_${fcHead.pressure}`] || ""}`}
            aria-expanded={forecastOpen}
            onClick={() => setForecastOpen(!forecastOpen)}
          >
            {tx(fcHead.key, fcHead.params)}
          </button>
        ) : null}
        {!replay && forecastOpen && forecast ? (
          <div className={life.forecastBody}>
            {forecast.months.map((m) => (
              <div key={m.ym} className={life.forecastRow}>
                <span className={`${life.forecastDot} ${life[`fc_${m.pressure}`] || ""}`} />
                <span className={life.forecastMonth}>{m.label}</span>
                <span className={life.forecastNums}>
                  {tx("out")} {money(m.scheduledOutflow)} · {tx("headroom")} {money(m.headroom)}
                </span>
                {m.drivers.length ? <span className={life.forecastDrivers}>{m.drivers.join(" · ")}</span> : null}
              </div>
            ))}
            <span className={life.echoBasis}>{tx(forecast.basis)}</span>
          </div>
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
                  <button
                    type="button"
                    className={life.nodeBtn}
                    onClick={() => (n.state === "hollow" ? openNode(n.id) : setMomentNode(n.id))}
                  >
                    {n.state === "hollow" ? `${tx(n.cta)} →` : `${tx("Look at this")} →`}
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

            {!answer ? (
              <div className={life.askExamples}>
                {suggestions.map((s) => (
                  <button key={s} type="button" className={life.askExample} onClick={() => ask(s)}>{tx(s)}</button>
                ))}
              </div>
            ) : null}

            {answer?.text ? <p className={life.askAnswer}>{txWithParams(tx, answer.textKey ?? answer.text, answer.textParams)}</p> : null}

            {askSim ? (
              <div className={life.askSim}>
                <span className={life.askSimHead}>{tx(askSim.label)}</span>
                {askSimLines(askSim.preview, tx, money).map((l, i) => (
                  <span key={i} className={life.askSimRow}>{l}</span>
                ))}
                {askSimLines(askSim.preview, tx, money).length === 0 ? (
                  <span className={css.micro}>{tx("Nothing else on your line moves.")}</span>
                ) : null}
                {askSim.preview.sealableVerdict && !askSim.preview.sealableVerdict.sealable ? (
                  <span className={life.pullBlock}>{tx("Can't be kept yet")} — {tx(askSim.preview.sealableVerdict.reason)}</span>
                ) : null}
              </div>
            ) : null}

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
              onExplore={(nodeId) => { setMemoryOpen(false); setReplay(null); setPullNode(nodeId); }}
            />
          </section>
        ) : null}
      </div>

      {momentNode ? (
        <NodeMomentSheet
          moment={buildNodeMoment({ nodeId: momentNode, lt, memory, planMovement })}
          tx={tx}
          onClose={() => setMomentNode(null)}
          onOpenStudio={() => { const id = momentNode; setMomentNode(null); openNode(id); }}
          onTry={() => { const id = momentNode; setMomentNode(null); if (isPullable(id)) setPullNode(id); else openNode(id); }}
        />
      ) : null}
    </div>
  );
}

function NodeMomentSheet({ moment, tx, onClose, onOpenStudio, onTry }) {
  return (
    <div className={css.sheetScrim} onClick={onClose}>
      <div className={css.sheet} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <span className={css.sheetGrip} />
        <p className={css.sheetTitle}>{tx(moment.label)}</p>
        <p className={css.lede}>{tx(moment.standing.key, moment.standing.params)}</p>

        <div className={life.momentRows}>
          {moment.monthlyUsed != null ? (
            <div className={css.sheetKV}><span>{tx("Using each month")}</span><span>{money(moment.monthlyUsed)}</span></div>
          ) : null}
          {moment.whyMoved ? (
            <div className={css.sheetKV}><span>{tx("Last moved")}</span><span>{tx(moment.whyMoved.what)} · {relTime(moment.whyMoved.when)}</span></div>
          ) : null}
          {moment.affecting.length ? (
            <div className={css.sheetKV}><span>{tx("Affecting")}</span><span>{moment.affecting.map((a) => tx(a)).join(", ")}</span></div>
          ) : null}
        </div>

        <div className={css.choiceGrid}>
          <button type="button" className={css.cta} onClick={onOpenStudio}>{tx(moment.action.key, moment.action.params)} →</button>
          <button type="button" className={css.choice} onClick={onTry}>{tx("Try a change")}</button>
        </div>
      </div>
    </div>
  );
}
