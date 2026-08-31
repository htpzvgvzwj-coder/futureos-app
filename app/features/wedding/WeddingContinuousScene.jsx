"use client";

// Wedding Living Scene - one continuous scene, no five permanent tabs.
//
// The main body is the Budget River: the wedding's monthly cost flowing
// along a time axis from now to the wedding month. Drag the guest knob to
// widen / narrow the river (the Guest Orbit ring appears in place while
// you drag); drag the date knob along the axis to move the wedding. Venue
// and Couple Alignment open as contextual sheets on the current decision.
// History stays hidden until the Memory Scrubber is pulled. After Seal the
// scene stays put and the Guardian rail accompanies it.

import { useMemo, useState } from "react";
import { computeWeddingPlanFinance } from "../../../lib/wedding/plan-finance.js";
import { projectWeddingThreadImpact } from "../../../lib/wedding/wedding-thread-projector.js";
import { blindMerge } from "../../../lib/family/constellation-finance.js";
import { LivingSceneProvider, useLivingScene } from "../../components/living-scene/LivingSceneProvider.jsx";
import { SceneShell } from "../../components/living-scene/SceneShell.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}
const WED_KEYS = ["wedding_date", "guest_count", "guest_tiers", "venue_tier", "venue_type", "photography_tier", "attire_tier", "total_budget", "monthly_contribution", "partner_contribution", "couple_alignment"];
const VENUE_TIERS = ["budget", "mid_range", "premium"];
const VENUE_TYPES = ["community", "restaurant", "hotel", "outdoor"];
const GUEST_TIERS = ["inner", "family", "friends"]; // concentric orbit rings
const ALIGNMENT_ITEMS = ["venue", "photography", "catering", "attire", "guest_count"];
const MARKS = ["mustKeep", "flexible", "undecided"];
const MIN_GUESTS = 10;
const MAX_GUESTS = 400;

function tiersFrom(m) {
  const t = m.guest_tiers && typeof m.guest_tiers === "object" ? m.guest_tiers : null;
  const total = Number(m.guest_count) || MIN_GUESTS;
  if (t && GUEST_TIERS.some((k) => t[k] != null)) {
    return { inner: Math.max(0, Number(t.inner) || 0), family: Math.max(0, Number(t.family) || 0), friends: Math.max(0, Number(t.friends) || 0) };
  }
  // default split when the customer has not broken it down yet
  return { inner: Math.round(total * 0.2), family: Math.round(total * 0.35), friends: total - Math.round(total * 0.2) - Math.round(total * 0.35) };
}
function alignmentView(side) {
  const v = { affordableMin: Number(side?.affordableMin) || 0, affordableMax: Number(side?.affordableMax) || 0, mustKeep: [], flexible: [], undecided: [] };
  for (const id of ALIGNMENT_ITEMS) {
    const mk = side?.marks?.[id];
    if (mk === "mustKeep") v.mustKeep.push(id);
    else if (mk === "flexible") v.flexible.push(id);
    else v.undecided.push(id);
  }
  return v;
}

function merged(reality, branchVars) {
  const out = { ...reality };
  for (const k of WED_KEYS) if (branchVars[k] != null) out[k] = branchVars[k];
  return out;
}
function wedCtxFrom(reality, sceneContext) {
  return {
    monthlyIncome: Number(sceneContext?.monthlyIncome ?? reality.monthly_income) || 0,
    monthlyExpenses: Number(sceneContext?.monthlyExpenses ?? reality.monthly_expenses) || 0,
    committedExcludingWedding: Number(sceneContext?.committedMonthlyTotal ?? sceneContext?.committedExcludingDomain) || 0,
  };
}

export function projectWeddingScene({ branchVars, reality, context }) {
  const ctx = wedCtxFrom(reality, context);
  const rf = computeWeddingPlanFinance({ planData: reality });
  const bf = computeWeddingPlanFinance({ planData: merged(reality, branchVars) });
  if (!rf.available || !bf.available) return {};
  const impact = projectWeddingThreadImpact({ branchPlan: merged(reality, branchVars), realityPlan: reality, context: ctx, allocation: branchVars.allocation ?? null });
  const nodes = (impact?.affectedGoals ?? [])
    .filter((g) => g.direction !== "flat")
    .map((g) => ({ id: g.goalId, dir: g.direction === "up" ? "up" : "down", note: g.goalId === "emergency" ? `${sgd(g.possibleAfter)}/mo room` : `${g.possibleAfter > 0 ? "+" : ""}${sgd(g.possibleAfter)}/mo` }));
  return {
    selfOutcome: { metric: "planTotal", before: rf.planTotal, after: bf.planTotal, unit: "sgd", dir: bf.planTotal < rf.planTotal ? "down" : bf.planTotal > rf.planTotal ? "up" : "flat" },
    nodes,
    freedCashflow: impact?.resourceDelta.freedMonthly ?? 0,
    addedPressure: impact?.resourceDelta.addedPressureMonthly ?? 0,
    mode: (impact?.resourceDelta.addedPressureMonthly ?? 0) > 0 ? "pressure" : (impact?.resourceDelta.freedMonthly ?? 0) > 0 ? "freed" : "neutral",
    wedding: bf,
    impactSet: impact,
  };
}

function weddingTurningPoint({ projection }) {
  const w = projection?.wedding;
  if (!w?.available) return null;
  if (w.budgetGap > 0) return { id: "wed-budget-gap", whyNowKey: "weddingScene.tp.budgetGap", whyNowParams: { amount: w.budgetGap } };
  if (w.onPace === false) return { id: "wed-behind-pace", whyNowKey: "weddingScene.tp.behindPace", whyNowParams: { need: w.userRequiredMonthly } };
  return null;
}

// ---------- SVG budget river ----------
const RV_W = 320;
const RV_H = 150;
const AXIS_Y = 118;
const RV_LEFT = 20;
const RV_RIGHT = 300;

function monthKeyToIdx(m) {
  if (!/^\d{4}-\d{2}/.test(String(m ?? ""))) return null;
  const [y, mo] = String(m).slice(0, 7).split("-").map(Number);
  return y * 12 + (mo - 1);
}
function shiftMonth(m, by) {
  const s = /^\d{4}-\d{2}/.test(String(m ?? "")) ? String(m).slice(0, 7) : new Date().toISOString().slice(0, 7);
  const [y, mo] = s.split("-").map(Number);
  const idx = y * 12 + (mo - 1) + by;
  return `${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function RiverField({ t, wed, m, dragGuests, onGuests, onDate }) {
  const nowIdx = new Date().getUTCFullYear() * 12 + new Date().getUTCMonth();
  const tripIdx = monthKeyToIdx(m.wedding_date);
  const span = tripIdx != null ? Math.max(1, tripIdx - nowIdx) : 12;
  const dateX = RV_LEFT + Math.min(1, span / 36) * (RV_RIGHT - RV_LEFT);
  const req = wed.userRequiredMonthly ?? wed.userMonthly ?? 0;
  const thick = Math.max(4, Math.min(52, (req / 40)));
  const guests = Number(m.guest_count) || MIN_GUESTS;
  const guestFrac = Math.max(0, Math.min(1, (guests - MIN_GUESTS) / (MAX_GUESTS - MIN_GUESTS)));

  return (
    <svg className="wcField" viewBox={`0 0 ${RV_W} ${RV_H}`} role="group" aria-label={t("weddingScene.field.label")}>
      {/* time axis */}
      <line x1={RV_LEFT} y1={AXIS_Y} x2={RV_RIGHT} y2={AXIS_Y} className="wcAxis" />
      <text x={RV_LEFT} y={AXIS_Y + 14} className="wcSmall">{t("weddingScene.now")}</text>
      <text x={dateX} y={AXIS_Y + 14} className="wcSmall" textAnchor="middle">{m.wedding_date || "?"}</text>

      {/* the river: a band from now to the wedding, thickness = monthly need */}
      <path
        d={`M ${RV_LEFT} ${AXIS_Y - 6} L ${dateX} ${AXIS_Y - 6 - thick} L ${dateX} ${AXIS_Y - 6} Z`}
        className={`wcRiver ${wed.budgetGap > 0 ? "is-short" : ""}`}
      />

      {/* payment markers */}
      {(wed.paymentSchedule ?? []).map((p, i) => {
        const px = RV_LEFT + ((i + 1) / ((wed.paymentSchedule?.length ?? 1) + 1)) * (dateX - RV_LEFT);
        return <circle key={p.id ?? i} cx={px} cy={AXIS_Y} r="3" className="wcPay" />;
      })}

      {/* guest knob - vertical drag widens / narrows the river */}
      <g
        className="wcGuests"
        role="slider"
        tabIndex={0}
        aria-label={t("weddingScene.field.guests", { n: guests })}
        aria-valuemin={MIN_GUESTS}
        aria-valuemax={MAX_GUESTS}
        aria-valuenow={guests}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onGuests(Math.min(MAX_GUESTS, guests + 10));
          else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onGuests(Math.max(MIN_GUESTS, guests - 10));
          else return;
          e.preventDefault();
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          onGuests(guests, true);
        }}
        onPointerUp={() => onGuests(guests, false)}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const r = e.currentTarget.ownerSVGElement.getBoundingClientRect();
          const y = ((e.clientY - r.top) / r.height) * RV_H;
          const frac = Math.max(0, Math.min(1, (AXIS_Y - y) / 90));
          onGuests(Math.round((MIN_GUESTS + frac * (MAX_GUESTS - MIN_GUESTS)) / 10) * 10, true);
        }}
      >
        <line x1={RV_LEFT} y1={AXIS_Y - 6 - thick} x2={RV_LEFT} y2={AXIS_Y - 6} className="wcGuestStem" />
        <circle cx={RV_LEFT} cy={AXIS_Y - 6 - thick} r="7" className="wcGuestKnot" />
        <text x={RV_LEFT + 12} y={AXIS_Y - 6 - thick + 3} className="wcSmall">{guests} {t("weddingScene.guestsWord")}</text>
      </g>

      {/* date knob on the axis */}
      <g
        className="wcDate"
        role="slider"
        tabIndex={0}
        aria-label={t("weddingScene.field.date")}
        aria-valuemin={1}
        aria-valuemax={36}
        aria-valuenow={span}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onDate(1);
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onDate(-1);
          else return;
          e.preventDefault();
        }}
      >
        <circle cx={dateX} cy={AXIS_Y} r="7" className="wcDateKnot" />
      </g>

      {/* Guest Orbit ring - appears in place only while dragging headcount */}
      {dragGuests ? (
        <g className="wcOrbit">
          <circle cx={RV_W - 44} cy={40} r={12 + guestFrac * 22} className="wcOrbitRing" />
          <text x={RV_W - 44} y={44} className="wcSmall" textAnchor="middle">{guests}</text>
        </g>
      ) : null}
    </svg>
  );
}

// Guest Orbit - concentric rings by tier (inner circle / family /
// friends). Each ring's radius grows with its headcount; the arrow keys
// move guests between the selected ring and the total. The tier counts
// always sum to guest_count, which is what the finance engine reads.
function GuestOrbit({ t, tiers, onTier }) {
  const cx = 60;
  const cy = 60;
  const rFor = (n) => 10 + Math.min(40, Math.sqrt(Math.max(0, n)) * 3.2);
  return (
    <svg className="wcOrbitField" viewBox="0 0 120 120" role="group" aria-label={t("weddingScene.orbit.label")}>
      {GUEST_TIERS.map((tier, i) => (
        <g
          key={tier}
          className="wcOrbitTier"
          role="slider"
          tabIndex={0}
          aria-label={t("weddingScene.orbit.tier", { tier: t(`weddingScene.orbit.${tier}`), n: tiers[tier] })}
          aria-valuemin={0}
          aria-valuemax={400}
          aria-valuenow={tiers[tier]}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowRight") onTier(tier, tiers[tier] + 5);
            else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onTier(tier, Math.max(0, tiers[tier] - 5));
            else return;
            e.preventDefault();
          }}
        >
          <circle cx={cx} cy={cy} r={rFor(tiers[tier])} className={`wcOrbitRing wcOrbitRing-${i}`} />
          <text x={cx} y={cy - rFor(tiers[tier]) - 2} className="wcSmall" textAnchor="middle">
            {t(`weddingScene.orbit.${tier}`)} {tiers[tier]}
          </text>
        </g>
      ))}
      <text x={cx} y={cy + 3} className="wcOrbitTotal" textAnchor="middle">{tiers.inner + tiers.family + tiers.friends}</text>
    </svg>
  );
}

// Couple Alignment - two independent Must Keep / Flexible / Undecided
// marks + a private affordable range per side. blindMerge returns ONLY
// the overlapping band, the agreed items and a conflict count - never
// either side's raw amounts.
function CoupleAlignment({ t, self, partner, onMark, onRange, onResolve }) {
  const merge = useMemo(
    () => blindMerge({ partnerA: alignmentView(self), partnerB: alignmentView(partner), sharedItems: ALIGNMENT_ITEMS.map((id) => ({ id, monthlyCost: 0 })) }),
    [self, partner],
  );
  const cycle = (id) => {
    const cur = self?.marks?.[id] ?? "undecided";
    const next = MARKS[(MARKS.indexOf(cur) + 1) % MARKS.length];
    onMark(id, next);
  };
  return (
    <div className="wcSheet wcAlign">
      <p className="lsProvenance">{t("weddingScene.align.help")}</p>
      <label className="wcAlignRange">
        <span>{t("weddingScene.align.yourRange")}</span>
        <div className="toStepper">
          <button type="button" onClick={() => onRange(Math.max(0, (Number(self?.affordableMax) || 0) - 200))} aria-label={t("weddingScene.less")}>−</button>
          <b>{sgd(self?.affordableMax || 0)}</b>
          <button type="button" onClick={() => onRange((Number(self?.affordableMax) || 0) + 200)} aria-label={t("weddingScene.more")}>+</button>
        </div>
      </label>
      <ul className="wcAlignItems">
        {ALIGNMENT_ITEMS.map((id) => {
          const mine = self?.marks?.[id] ?? "undecided";
          const conflict = (merge.conflicts ?? []).some((c) => c.itemId === id);
          return (
            <li key={id} className={conflict ? "is-conflict" : ""}>
              <button type="button" className={`wcMark wcMark-${mine}`} onClick={() => cycle(id)}>
                {t(`weddingScene.align.item.${id}`)} · {t(`weddingScene.align.mark.${mine}`)}
              </button>
              {conflict ? (
                <button type="button" className="lsGhostBtn" onClick={() => onResolve(id)}>{t("weddingScene.align.resolve")}</button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="wcReadout">
        {merge.feasibleBandExists
          ? t("weddingScene.align.band", { low: sgd(merge.jointBand.low), high: sgd(merge.jointBand.high) })
          : t("weddingScene.align.noBand")}
      </p>
      <p className="wcReadout">{t("weddingScene.align.status", { agreed: (merge.agreedMustKeep ?? []).length, conflicts: (merge.conflicts ?? []).length })}</p>
      <p className="lsProvenance">{t("weddingScene.partnerNote")}</p>
    </div>
  );
}

function WeddingSceneInner({ t, setActiveScreen }) {
  const s = useLivingScene();
  const reality = s.realityData;
  const feas = s.reality?.feasibility ?? null;
  const [sheet, setSheet] = useState(null); // "venue" | "couple" | null
  const [dragGuests, setDragGuests] = useState(false);

  const m = useMemo(() => (reality ? merged(reality, s.branchVars) : null), [reality, s.branchVars]);
  const wed = useMemo(
    () => (reality ? computeWeddingPlanFinance({ planData: merged(reality, s.branchVars) }) : null),
    [reality, s.branchVars],
  );
  const proj = s.projection?.wedding?.available ? s.projection.wedding : wed;

  if (s.loadState === "loading") return <p className="wlpEmpty">{t("weddingScene.loading")}</p>;
  if (s.loadState !== "ready" || !feas?.available || !proj?.available || !m) {
    return (
      <section className="screen wlpScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
        <header className="wlpHeader"><h1>{t("weddingScene.title")}</h1></header>
        <p className="wlpEmpty">{t("weddingScene.noPlan")}</p>
      </section>
    );
  }

  const guests = Number(m.guest_count) || MIN_GUESTS;
  const partnerMonthly = Number(m.partner_contribution) || 0;
  const tiers = tiersFrom(m);
  const align = m.couple_alignment && typeof m.couple_alignment === "object" ? m.couple_alignment : {};
  const alignSelf = align.self ?? { affordableMax: 0, marks: {} };
  const alignPartner = align.partner ?? reality.partner_marks ?? { affordableMax: 0, marks: { venue: "mustKeep", photography: "flexible" } };
  const set = (k, v) => s.setVar(k, v);
  const onGuests = (n, dragging) => {
    if (dragging != null) setDragGuests(dragging);
    if (Number.isFinite(n)) set("guest_count", Math.max(MIN_GUESTS, Math.min(MAX_GUESTS, n)));
  };
  const onTier = (tier, v) => {
    const next = { ...tiers, [tier]: Math.max(0, Math.round(v)) };
    set("guest_tiers", next);
    set("guest_count", Math.max(MIN_GUESTS, Math.min(MAX_GUESTS, next.inner + next.family + next.friends)));
  };
  const setAlign = (patch) => set("couple_alignment", { self: { ...alignSelf, ...patch, marks: { ...alignSelf.marks, ...(patch.marks ?? {}) } }, partner: alignPartner });
  const onResolveConflict = async (itemId) => {
    // A resolution is a real decision: it becomes its own branch (and a
    // Change Ledger / Change Replay entry via the branch-created event).
    setAlign({ marks: { [itemId]: "flexible" } });
    await s.forkBranch(t("weddingScene.align.resolveLabel", { item: t(`weddingScene.align.item.${itemId}`) }));
  };

  return (
    <section className="screen wlpScreen lsSceneScreen wcScene">
      <button type="button" className="linkButton" onClick={() => setActiveScreen("mirror")}>← {t("changeLedger.back")}</button>
      <header className="wlpHeader">
        <h1>{t("weddingScene.title")}</h1>
        <p>{t("weddingScene.subtitle")}</p>
      </header>

      <SceneShell
        t={t}
        setActiveScreen={setActiveScreen}
        goalOptions={[{ id: "home" }, { id: "emergency" }, { id: "retirement" }]}
        realitySummary={t("weddingScene.summaryLine", { cost: sgd(proj.planTotal), month: reality.wedding_date || t("weddingScene.unknown.wedding_date") })}
        sealMonthlyAmount={proj.userRequiredMonthly || proj.userMonthly || 0}
        formatSelf={(v) => sgd(v)}
        realityRows={[
          { id: "cost", label: t("weddingScene.row.cost"), value: sgd(proj.computedCoreTotal), provenance: t("weddingScene.prov.referenceRate") },
          { id: "guests", label: t("weddingScene.row.guests"), value: `${reality.guest_count ?? t("weddingScene.unknown.guest_count")}`, provenance: t("weddingScene.prov.fromPlan") },
          { id: "need", label: t("weddingScene.row.need"), value: `${sgd(proj.userRequiredMonthly ?? 0)}/mo`, provenance: t("weddingScene.prov.yourShare") },
          { id: "gap", label: t("weddingScene.row.gap"), value: proj.budgetGap > 0 ? sgd(proj.budgetGap) : t("weddingScene.none"), provenance: t("weddingScene.prov.vsBudget") },
        ]}
        realityUnknowns={[
          reality.guest_count == null ? { id: "guest_count", label: t("weddingScene.unknown.guest_count") } : null,
          reality.wedding_date == null ? { id: "wedding_date", label: t("weddingScene.unknown.wedding_date") } : null,
        ].filter(Boolean)}
        realityNote={t("weddingScene.estimateNote")}
      >
        <div className="wcSurface">
          <RiverField t={t} wed={proj} m={m} dragGuests={dragGuests} onGuests={onGuests} onDate={(by) => set("wedding_date", shiftMonth(m.wedding_date, by))} />

          {proj.budgetGap > 0 ? <p className="wlpWarn">{t("weddingScene.belowCost", { amount: sgd(proj.budgetGap) })}</p> : null}
          <p className="wcReadout">{t("weddingScene.readout", { perGuest: sgd(guests ? Math.round(proj.planTotal / guests) : 0), need: sgd(proj.userRequiredMonthly ?? 0) })}</p>

          {/* contextual sheets on the current decision - not permanent tabs */}
          <div className="wcCtx">
            <button type="button" className="lsGhostBtn" aria-expanded={sheet === "guests"} onClick={() => setSheet(sheet === "guests" ? null : "guests")}>{t("weddingScene.ctx.guests")}</button>
            <button type="button" className="lsGhostBtn" aria-expanded={sheet === "venue"} onClick={() => setSheet(sheet === "venue" ? null : "venue")}>{t("weddingScene.ctx.venue")}</button>
            <button type="button" className="lsGhostBtn" aria-expanded={sheet === "couple"} onClick={() => setSheet(sheet === "couple" ? null : "couple")}>{t("weddingScene.ctx.couple")}</button>
          </div>
          {sheet === "guests" ? (
            <div className="wcSheet">
              <span>{t("weddingScene.orbit.help")}</span>
              <GuestOrbit t={t} tiers={tiers} onTier={onTier} />
            </div>
          ) : null}
          {sheet === "venue" ? (
            <div className="wcSheet">
              <span>{t("weddingScene.venueType")}</span>
              <div className="toSeg">
                {VENUE_TYPES.map((v) => (
                  <button key={v} type="button" className={m.venue_type === v ? "is-on" : ""} onClick={() => set("venue_type", v)}>{t(`weddingScene.type.${v}`)}</button>
                ))}
              </div>
              <span>{t("weddingScene.venueTier")}</span>
              <div className="toSeg">
                {VENUE_TIERS.map((v) => (
                  <button key={v} type="button" className={m.venue_tier === v ? "is-on" : ""} onClick={() => set("venue_tier", v)}>{t(`weddingScene.venue.${v}`)}</button>
                ))}
              </div>
              <label>
                <span>{t("weddingScene.field.date")}</span>
                <div className="toStepper">
                  <button type="button" onClick={() => set("wedding_date", shiftMonth(m.wedding_date, -1))} aria-label={t("weddingScene.less")}>−</button>
                  <b>{m.wedding_date || "?"}</b>
                  <button type="button" onClick={() => set("wedding_date", shiftMonth(m.wedding_date, 1))} aria-label={t("weddingScene.more")}>+</button>
                </div>
              </label>
              <p className="lsProvenance">{t("weddingScene.venueRecompute")}</p>
            </div>
          ) : null}
          {sheet === "couple" ? (
            <>
              <div className="wcSheet">
                <label>
                  <span>{t("weddingScene.partnerMonthly")}</span>
                  <div className="toStepper">
                    <button type="button" onClick={() => set("partner_contribution", Math.max(0, partnerMonthly - 50))} aria-label={t("weddingScene.less")}>−</button>
                    <b>{sgd(partnerMonthly)}</b>
                    <button type="button" onClick={() => set("partner_contribution", partnerMonthly + 50)} aria-label={t("weddingScene.more")}>+</button>
                  </div>
                </label>
              </div>
              <CoupleAlignment
                t={t}
                self={alignSelf}
                partner={alignPartner}
                onMark={(id, mark) => setAlign({ marks: { [id]: mark } })}
                onRange={(v) => setAlign({ affordableMax: v, affordableMin: Math.round(v * 0.6) })}
                onResolve={onResolveConflict}
              />
            </>
          ) : null}

          <div className="rpMirror">
            <button type="button" onClick={() => onGuests(guests - 20)}>{t("weddingScene.mirror.fewer")}</button>
            <button type="button" onClick={() => set("wedding_date", shiftMonth(m.wedding_date, 3))}>{t("weddingScene.mirror.later")}</button>
            <button type="button" onClick={() => s.resetBranch()}>{t("weddingScene.mirror.reset")}</button>
          </div>
        </div>
      </SceneShell>
    </section>
  );
}

export function WeddingContinuousScene({ t, setActiveScreen }) {
  return (
    <LivingSceneProvider domain="wedding" projectFn={projectWeddingScene} turningPointFor={weddingTurningPoint}>
      <WeddingSceneInner t={t} setActiveScreen={setActiveScreen} />
    </LivingSceneProvider>
  );
}
