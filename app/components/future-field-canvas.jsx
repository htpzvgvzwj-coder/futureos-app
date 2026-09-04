"use client";

// Future Field - the interactive time canvas.
//
// One time field holds three kinds of path:
//   Reality Path   - what the bank has confirmed (solid)
//   Possible Path  - Mirror branches (semi-transparent)
//   Committed Path  - the future Guardian is following (highlighted)
//
// Five actions, each with BOTH a direct-manipulation affordance on the
// canvas AND a full keyboard/button/form equivalent in the panel below:
//   Peel  - split a possible future off reality
//   Bend  - move an outcome (the target date); the server solves the method
//   Pin   - fix a non-negotiable as a structured constraint
//   Seal  - turn a possible future into a commitment (explicit consent)
//   Catch-up - see whether reality is closing on the committed path
//
// Every number shown is real - computed server-side from the customer's
// confirmed plan and cashflow (app/api/future-field/*). This file renders;
// it never invents a figure.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { GoalChangeHistory } from "./change-ledger-screen.jsx";
import { parseAsk } from "../../lib/explore/ask-parser.js";

// ---- time helpers (YYYY-MM) ------------------------------------------------
function nowMonth() {
  return new Date().toISOString().slice(0, 7);
}
function monthToIndex(m) {
  const [y, mo] = m.split("-").map(Number);
  return y * 12 + (mo - 1);
}
function indexToMonth(i) {
  const y = Math.floor(i / 12);
  const mo = (i % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}`;
}
function monthsBetween(a, b) {
  return monthToIndex(b) - monthToIndex(a);
}
function addMonths(m, n) {
  return indexToMonth(monthToIndex(m) + n);
}
function fmtMonth(m, locale) {
  if (!m) return "";
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(locale, { year: "numeric", month: "short" });
}
function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

const PIN_KINDS = [
  { kind: "emergency_floor_months", needsValue: true },
  { kind: "max_monthly_contribution", needsValue: true },
  { kind: "max_delay_months", needsValue: true },
  { kind: "no_guardian_auto_move", needsValue: false },
  { kind: "no_balance_share", needsValue: false },
];

// Per-domain: which plan variables the customer can Peel a branch on, and
// how each is edited. `kind` -> input control. `options` -> a <select>.
const PEEL_FIELDS = {
  home: [
    { field: "estimated_price", kind: "money" },
    { field: "target_complete_month", kind: "month" },
    { field: "monthly_contribution", kind: "money" },
  ],
  wedding: [
    { field: "wedding_date", kind: "month" },
    { field: "guest_count", kind: "count" },
    { field: "venue_tier", kind: "select", options: ["budget", "mid_range", "premium"] },
    { field: "venue_type", kind: "select", options: ["community", "restaurant", "hotel", "outdoor"] },
    { field: "total_budget", kind: "money" },
    { field: "monthly_contribution", kind: "money" },
    { field: "partner_contribution", kind: "money" },
  ],
  emergency: [
    { field: "target_months", kind: "count" },
    { field: "floor_months", kind: "count" },
    { field: "monthly_contribution", kind: "money" },
  ],
  loan: [
    { field: "extra_repayment", kind: "money" },
    { field: "monthly_installment", kind: "money" },
  ],
  retirement: [
    { field: "monthly_contribution", kind: "money" },
    { field: "target_monthly_income", kind: "money" },
  ],
  travel: [
    { field: "travellers", kind: "count" },
    { field: "nights", kind: "count" },
    { field: "comfort_tier", kind: "select", options: ["budget", "mid", "premium"] },
    { field: "destination_type", kind: "select", options: ["domestic", "regional", "longhaul"] },
    { field: "trip_month", kind: "month" },
    { field: "total_budget", kind: "money" },
    { field: "monthly_contribution", kind: "money" },
  ],
  investment: [
    { field: "monthly_commitment", kind: "money" },
    { field: "target_pool", kind: "money" },
    { field: "horizon_years", kind: "count" },
  ],
  insurance: [
    { field: "monthly_premium_now", kind: "money" },
    { field: "income_protection_months", kind: "count" },
    { field: "existing_income_protection", kind: "money" },
    { field: "existing_life_cover", kind: "money" },
    { field: "existing_ci_cover", kind: "money" },
  ],
  family: [
    { field: "shared_monthly_contribution", kind: "money" },
    { field: "partner_share_ratio", kind: "count" },
  ],
};
function peelFieldsFor(domain) {
  return PEEL_FIELDS[domain] ?? PEEL_FIELDS.home;
}
function peelInputType(kind) {
  return kind === "month" ? "month" : kind === "select" ? "select" : "number";
}

// ---- SVG time field ------------------------------------------------------
function TimeField({ field, selectedBranchId, onSelectBranch, onBendMonth, t, locale }) {
  // The projection of the currently-selected branch (if any). Home /
  // Emergency nodes move by its ALLOCATED layer; its AVAILABLE layer is
  // drawn as a faint "possible" ghost that is never shown as fact.
  const selectedProj =
    (field.possiblePaths ?? []).find((b) => b.id === selectedBranchId)?.projectedImpacts ?? null;
  const W = 340;
  const H = 210;
  const padL = 14;
  const padR = 20;
  const padT = 16;
  const padB = 26;
  const start = nowMonth();

  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const endpoints = useMemo(() => {
    const list = [];
    if (field.realityPath?.readyMonth) list.push(field.realityPath.readyMonth);
    if (field.committedPath?.readyMonth) list.push(field.committedPath.readyMonth);
    for (const b of field.possiblePaths ?? []) if (b.readyMonth) list.push(b.readyMonth);
    return list;
  }, [field]);

  const maxIdx = endpoints.length ? Math.max(...endpoints.map(monthToIndex)) : monthToIndex(addMonths(start, 60));
  const spanMonths = Math.max(6, maxIdx - monthToIndex(start) + 3);

  const x = (month) => {
    if (!month) return padL;
    const frac = Math.max(0, Math.min(1, monthsBetween(start, month) / spanMonths));
    return padL + frac * (W - padL - padR);
  };
  const monthFromX = (px) => {
    const frac = Math.max(0, Math.min(1, (px - padL) / (W - padL - padR)));
    return addMonths(start, Math.round(frac * spanMonths));
  };

  const lanes = { reality: padT + 22, committed: padT + 62, branchBase: padT + 100 };

  const svgRef = useRef(null);
  const dragging = useRef(null);

  const clientToSvgX = (clientX) => {
    const rect = svgRef.current.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * W;
  };

  const handlePointerMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      const month = monthFromX(clientToSvgX(e.clientX));
      onBendMonth(month, { preview: true });
    },
    [onBendMonth],
  );
  const handlePointerUp = useCallback(
    (e) => {
      if (!dragging.current) return;
      const month = monthFromX(clientToSvgX(e.clientX));
      dragging.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      onBendMonth(month, { preview: false });
    },
    [handlePointerMove, onBendMonth],
  );

  const startDrag = (which) => (e) => {
    e.preventDefault();
    dragging.current = which;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const onNodeKey = (currentMonth) => (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = addMonths(currentMonth, e.key === "ArrowLeft" ? -1 : 1);
      onBendMonth(next, { preview: false });
    }
  };

  const axisTicks = [];
  for (let i = 0; i <= spanMonths; i += 12) {
    const m = addMonths(start, i);
    axisTicks.push({ m, px: x(m) });
  }

  const rp = field.realityPath;
  const cp = field.committedPath;

  return (
    <svg
      ref={svgRef}
      className="ffCanvas"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t("futureField.canvasAria")}
    >
      {/* time axis */}
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} className="ffAxis" />
      {axisTicks.map((tk) => (
        <g key={tk.m}>
          <line x1={tk.px} y1={H - padB} x2={tk.px} y2={H - padB + 4} className="ffAxis" />
          <text x={tk.px} y={H - padB + 14} className="ffAxisLabel" textAnchor="middle">
            {tk.m.slice(0, 4)}
          </text>
        </g>
      ))}
      <text x={padL} y={padT - 4} className="ffNowLabel">
        {t("futureField.now")}
      </text>

      {/* pins as guard-rails */}
      {(field.pins ?? []).map((p, i) => {
        if (p.kind === "max_delay_months" && rp?.readyMonth) {
          const limitMonth = addMonths(rp.readyMonth, Number(p.value) || 0);
          return (
            <g key={p.id}>
              <line x1={x(limitMonth)} y1={padT} x2={x(limitMonth)} y2={H - padB} className="ffPinVertical" />
              <text x={x(limitMonth)} y={padT + 6} className="ffPinLabel" textAnchor="end">
                {t(`changeLedger.pinKind.${p.kind}`, { value: p.value })}
              </text>
            </g>
          );
        }
        return (
          <text key={p.id} x={W - padR} y={H - padB - 6 - i * 12} className="ffPinLabel" textAnchor="end">
            ⚲ {t(`changeLedger.pinKind.${p.kind}`, { value: p.value ?? "" })}
          </text>
        );
      })}

      {/* Reality path */}
      {rp?.readyMonth ? (
        <g>
          <line x1={x(start)} y1={lanes.reality} x2={x(rp.readyMonth)} y2={lanes.reality} className="ffReality" />
          <circle cx={x(start)} cy={lanes.reality} r={3} className="ffNodeStart" />
          <circle
            cx={x(rp.readyMonth)}
            cy={lanes.reality}
            r={7}
            className="ffNode ffNodeReality"
            tabIndex={0}
            role="slider"
            aria-label={t("futureField.realityNodeAria")}
            aria-valuetext={fmtMonth(rp.readyMonth, locale)}
            onKeyDown={onNodeKey(rp.readyMonth)}
            onPointerDown={startDrag("reality")}
            style={reduceMotion ? undefined : { transition: "cx 0.15s ease" }}
          />
          <text x={x(rp.readyMonth)} y={lanes.reality - 12} className="ffNodeLabel" textAnchor="middle">
            {t("futureField.reality")} · {fmtMonth(rp.readyMonth, locale)}
          </text>
        </g>
      ) : (
        <text x={W / 2} y={lanes.reality} className="ffNodeLabel" textAnchor="middle">
          {t("futureField.realityNoDate")}
        </text>
      )}

      {/* Committed path */}
      {cp?.readyMonth ? (
        <g>
          <line x1={x(start)} y1={lanes.committed} x2={x(cp.readyMonth)} y2={lanes.committed} className="ffCommitted" />
          <circle cx={x(start)} cy={lanes.committed} r={3} className="ffNodeStart" />
          <g transform={`translate(${x(cp.readyMonth) - 7}, ${lanes.committed - 7})`}>
            <circle cx={7} cy={7} r={8} className="ffNode ffNodeCommitted" />
          </g>
          <text x={x(cp.readyMonth)} y={lanes.committed + 20} className="ffNodeLabel" textAnchor="middle">
            {t("futureField.committed")} · {sgd(cp.monthlyContribution)}/mo
          </text>
          {field.catchUp ? (
            <text
              x={x(start) + 8}
              y={lanes.committed - 10}
              className={`ffCatchUp ffCatchUp-${field.catchUp.status}`}
            >
              {t(`futureField.catchUp.${field.catchUp.status}`)}
            </text>
          ) : null}
        </g>
      ) : null}

      {/* Cross-goal nodes - Home deposit + Emergency fund on the same field.
          When a branch is selected they move by its projection: solid =
          allocated (a real choice), dashed ghost = available-but-unclaimed. */}
      {(field.crossGoalNodes ?? []).map((n, i) => {
        const y = padT + 128 + i * 18;
        if (y > H - padB - 4) return null;

        if (n.goalId === "emergency") {
          const alloc = selectedProj?.allocatedImpact?.emergency ?? null;
          const avail = selectedProj?.availableImpact ?? null;
          const shownBuffer = alloc ? alloc.bufferAfter : n.bufferMonths;
          const safe = shownBuffer >= (n.floorMonths ?? 6);
          return (
            <g key={n.goalId}>
              <text x={x(start) + 4} y={y} className={`ffNodeLabel ffCross-${safe ? "ok" : "risk"}`}>
                {t("futureField.node.emergency")}: {shownBuffer}mo{" "}
                {alloc ? `(${t("futureField.possible")})` : safe ? "✓" : t("futureField.belowFloor", { floor: n.floorMonths })}
              </text>
              {!alloc && avail?.maxEmergencyBufferAfter && avail.maxEmergencyBufferAfter > n.bufferMonths ? (
                <text x={x(start) + 4} y={y + 10} className="ffNodeLabel ffGhost">
                  {t("futureField.node.emergency")} → {avail.maxEmergencyBufferAfter}mo {t("futureField.possibleIfAllocated")}
                </text>
              ) : null}
            </g>
          );
        }

        // home node
        const allocHome = selectedProj?.allocatedImpact?.home ?? null;
        const availHome = selectedProj?.availableImpact ?? null;
        const shownMonth = allocHome?.readyMonthAfter ?? n.readyMonth;
        const end = shownMonth ? x(shownMonth) : x(addMonths(start, spanMonths));
        return (
          <g key={n.goalId}>
            <line x1={x(start)} y1={y} x2={end} y2={y} className={allocHome ? "ffCrossGoal ffCrossGoalMoved" : "ffCrossGoal"} />
            <circle cx={end} cy={y} r={4} className="ffNode ffNodeCross" style={reduceMotion ? undefined : { transition: "cx 0.25s ease" }} />
            <text x={end} y={y - 6} className="ffNodeLabel" textAnchor="middle">
              {t("futureField.node.home")}
              {shownMonth ? ` · ${fmtMonth(shownMonth, locale)}` : ""}
              {allocHome ? ` (${t("futureField.possible")})` : ""}
            </text>
            {!allocHome && availHome?.maxHomeReadyMonth && availHome.maxHomeReadyMonth !== n.readyMonth ? (
              <>
                <circle cx={x(availHome.maxHomeReadyMonth)} cy={y} r={3} className="ffNode ffGhostNode" />
                <text x={x(availHome.maxHomeReadyMonth)} y={y + 10} className="ffNodeLabel ffGhost" textAnchor="middle">
                  {t("futureField.possibleIfAllocated")}
                </text>
              </>
            ) : null}
          </g>
        );
      })}

      {/* Possible paths (branches) */}
      {(field.possiblePaths ?? []).map((b, i) => {
        const y = lanes.branchBase + i * 20;
        if (y > H - padB - 6) return null;
        const end = b.readyMonth ?? addMonths(start, spanMonths);
        const selected = b.id === selectedBranchId;
        return (
          <g key={b.id} className={`ffBranch${selected ? " ffBranchSelected" : ""}`}>
            <line x1={x(start)} y1={y} x2={x(end)} y2={y} className="ffPossible" />
            <circle
              cx={x(end)}
              cy={y}
              r={selected ? 7 : 5}
              className="ffNode ffNodePossible"
              tabIndex={0}
              role="button"
              aria-label={t("futureField.branchNodeAria", { label: b.label })}
              aria-pressed={selected}
              onClick={() => onSelectBranch(selected ? null : b.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectBranch(selected ? null : b.id);
                }
              }}
            />
            <text x={x(end)} y={y - 9} className="ffNodeLabel" textAnchor="middle">
              {b.label}
              {b.readyMonth ? ` · ${fmtMonth(b.readyMonth, locale)}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---- panel --------------------------------------------------------------
export function FutureFieldCanvas({
  t,
  setActiveScreen,
  language = "en",
  domain = "home",
  backTo = "mirror",
  titleKey = "futureField.title",
  subtitleKey = "futureField.subtitle",
  embedded = false,
  // Single-state-source mode: when the parent owns the field (e.g.
  // WeddingLivingPlan via useWeddingField), it passes these in and this
  // component does NOT fetch or keep a second copy.
  externalField = undefined,
  externalError = undefined,
  externalBusy = undefined,
  externalReload = undefined,
  selectedBranchId: externalSelectedBranchId = undefined,
  setSelectedBranchId: externalSetSelectedBranchId = undefined,
  // Free text from Explore's "what do you want to test?" or a Studio's ask
  // box — parsed and used ONLY to pre-fill the Peel form below. Nothing is
  // proposed until the person reviews it and taps Peel themselves.
  initialAsk = "",
}) {
  const controlled = externalField !== undefined;
  const locale = language === "zh" ? "zh-CN" : "en-SG";
  const peelFields = peelFieldsFor(domain);
  const [internalField, setInternalField] = useState(null);
  const [internalError, setInternalError] = useState("");
  const [internalBusy, setInternalBusy] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [internalSelectedBranchId, setInternalSelectedBranchId] = useState(null);

  const field = controlled ? externalField : internalField;
  const setField = controlled ? () => {} : setInternalField;
  const error = controlled ? externalError ?? "" : internalError;
  const setError = controlled ? () => {} : setInternalError;
  const busy = controlled ? Boolean(externalBusy) : internalBusy;
  const setBusy = controlled ? () => {} : setInternalBusy;
  const selectedBranchId = controlled ? externalSelectedBranchId ?? null : internalSelectedBranchId;
  const setSelectedBranchId = controlled ? externalSetSelectedBranchId ?? (() => {}) : setInternalSelectedBranchId;

  // Peel form
  const [peelField, setPeelField] = useState(peelFields[0].field);
  const [peelValue, setPeelValue] = useState("");
  const [peelLabel, setPeelLabel] = useState("");
  const peelFieldMeta = peelFields.find((f) => f.field === peelField) ?? peelFields[0];

  // Pre-fill the Peel form from a question typed in Explore / a Studio's
  // ask box, once the plan's real current data has loaded. Runs once per
  // ask; never re-applies itself, and never submits anything on its own.
  const appliedAskRef = useRef("");
  useEffect(() => {
    if (!initialAsk || appliedAskRef.current === initialAsk) return;
    if (!field?.hasRealityPath) return;
    const parsed = parseAsk(initialAsk, domain);
    if (!parsed || !peelFields.some((f) => f.field === parsed.field)) { appliedAskRef.current = initialAsk; return; }
    appliedAskRef.current = initialAsk;
    setPeelField(parsed.field);
    if (parsed.shiftMonths != null) {
      const anchor = field.realityPath.data?.[parsed.field] || new Date().toISOString().slice(0, 7);
      setPeelValue(addMonths(anchor, parsed.shiftMonths));
    } else if (parsed.value != null) {
      setPeelValue(String(parsed.value));
    }
    if (parsed.label) setPeelLabel(parsed.label.slice(0, 60));
  }, [initialAsk, field?.hasRealityPath, domain, peelFields, field?.realityPath?.data]);

  // Bend
  const [bendMonth, setBendMonth] = useState("");
  const [bendResult, setBendResult] = useState(null);

  // Pin form
  const [pinKind, setPinKind] = useState("emergency_floor_months");
  const [pinValue, setPinValue] = useState("6");

  // Seal
  const [sealBranch, setSealBranch] = useState("");
  const [sealAmount, setSealAmount] = useState("");
  const [sealPreview, setSealPreview] = useState(null);
  const [sealDone, setSealDone] = useState(null);

  const load = useCallback(async () => {
    if (controlled) {
      const data = externalReload ? await externalReload() : field;
      if (data?.hasRealityPath) {
        setBendMonth((cur) => cur || data.realityPath.readyMonth || "");
        setSealAmount((cur) => cur || String(data.realityPath.monthlyContribution || ""));
      }
      return;
    }
    setError("");
    try {
      const res = await fetch(`/api/future-field?domain=${encodeURIComponent(domain)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(t("futureField.loadError"));
        return;
      }
      setField(data);
      if (data.hasRealityPath) {
        setBendMonth((cur) => cur || data.realityPath.readyMonth || "");
        setSealAmount((cur) => cur || String(data.realityPath.monthlyContribution || ""));
      }
    } catch {
      setError(t("futureField.loadError"));
    }
  }, [domain, t, controlled]);

  useEffect(() => {
    // Controlled mode: the parent already fetched; just seed the local
    // form defaults once the field arrives.
    if (controlled) {
      if (field?.hasRealityPath) {
        setBendMonth((cur) => cur || field.realityPath.readyMonth || "");
        setSealAmount((cur) => cur || String(field.realityPath.monthlyContribution || ""));
      }
      return;
    }
    load();
  }, [load, controlled, field?.hasRealityPath]);

  const post = async (url, body, opts = {}) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: opts.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: opts.method === "DELETE" ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(t(`futureField.err.${data.error}`) === `futureField.err.${data.error}` ? t("futureField.genericError") : t(`futureField.err.${data.error}`));
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch {
      setError(t("futureField.genericError"));
      return { ok: false, data: {} };
    } finally {
      setBusy(false);
    }
  };

  // Peel
  const doPeel = async (e) => {
    e?.preventDefault?.();
    if (peelValue === "") return;
    const raw = peelFieldMeta.kind === "month" || peelFieldMeta.kind === "select" ? peelValue : Number(peelValue);
    const overrides = { [peelField]: raw };
    const { ok, data } = await post(`/api/future-field/branch?action=peel&domain=${domain}`, {
      overrides,
      label: peelLabel || t("futureField.defaultBranchLabel"),
    });
    if (ok) {
      setAnnounce(t("futureField.announce.peeled", { label: data.branch.label }));
      setPeelValue("");
      setPeelLabel("");
      await load();
    }
  };

  // Bend
  const doBend = async (targetMonth, { preview } = {}) => {
    if (!targetMonth) return;
    setBendMonth(targetMonth);
    const { ok, data } = await post(`/api/future-field/bend`, {
      domain,
      outcome: { metric: "targetDate", toMonth: targetMonth },
    });
    if (ok) {
      setBendResult(data);
      if (!preview) {
        setAnnounce(
          data.achievable
            ? t("futureField.announce.bent", { amount: sgd(data.solvedMonthly), month: fmtMonth(targetMonth, locale) })
            : t("futureField.announce.bentImpossible"),
        );
      }
    }
  };

  const saveBendAsBranch = async () => {
    if (!bendResult?.achievable) return;
    const { ok, data } = await post(`/api/future-field/branch?action=peel&domain=${domain}`, {
      overrides: { monthly_contribution: bendResult.solvedMonthly, target_complete_month: bendMonth },
      label: t("futureField.bentBranchLabel", { month: fmtMonth(bendMonth, locale) }),
    });
    if (ok) {
      setAnnounce(t("futureField.announce.peeled", { label: data.branch.label }));
      setBendResult(null);
      await load();
    }
  };

  // Pin
  const doPin = async (e) => {
    e?.preventDefault?.();
    const meta = PIN_KINDS.find((p) => p.kind === pinKind);
    const { ok } = await post(`/api/future-field/pin`, {
      domain,
      kind: pinKind,
      value: meta?.needsValue ? Number(pinValue) : undefined,
      scope: "domain",
    });
    if (ok) {
      setAnnounce(t("futureField.announce.pinned", { kind: t(`changeLedger.pinKind.${pinKind}`, { value: pinValue }) }));
      await load();
    }
  };
  const releasePin = async (id) => {
    const { ok } = await post(`/api/future-field/pin?id=${encodeURIComponent(id)}`, null, { method: "DELETE" });
    if (ok) {
      setAnnounce(t("futureField.announce.pinReleased"));
      await load();
    }
  };

  // Seal
  const doSealPreview = async (e) => {
    e?.preventDefault?.();
    if (sealAmount === "") return;
    const { ok, data } = await post(`/api/future-field/seal`, {
      domain,
      mode: "preview",
      monthlyAmount: Number(sealAmount),
      branchId: sealBranch || undefined,
    });
    if (ok) setSealPreview(data.preview);
  };
  const doSealConfirm = async () => {
    const { ok, data } = await post(`/api/future-field/seal`, {
      domain,
      mode: "confirm",
      monthlyAmount: Number(sealAmount),
      branchId: sealBranch || undefined,
    });
    if (ok) {
      setSealPreview(null);
      setSealDone(data);
      setAnnounce(t("futureField.announce.sealed", { amount: sgd(Number(sealAmount)) }));
      await load();
    }
  };

  if (error && !field) {
    return (
      <section className="screen ffScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen(backTo)}>
          <ArrowLeft size={16} aria-hidden /> {t("changeLedger.back")}
        </button>
        <p className="ffEmpty">{error}</p>
      </section>
    );
  }
  if (!field) {
    return <section className="screen ffScreen"><p className="ffLoading">…</p></section>;
  }
  if (!field.hasRealityPath) {
    return (
      <section className="screen ffScreen">
        <button type="button" className="linkButton" onClick={() => setActiveScreen(backTo)}>
          <ArrowLeft size={16} aria-hidden /> {t("changeLedger.back")}
        </button>
        <header className="ffHeader">
          <h1>{t("futureField.title")}</h1>
        </header>
        <p className="ffEmpty">{t(domain === "wedding" ? "futureField.noRealityPathWedding" : "futureField.noRealityPath")}</p>
        <button
          type="button"
          className="primaryButton"
          onClick={() => setActiveScreen(domain === "wedding" ? "needWedding" : "needHome")}
        >
          {t(domain === "wedding" ? "futureField.goConfirmPlanWedding" : "futureField.goConfirmPlan")}
        </button>
      </section>
    );
  }

  const pinMeta = PIN_KINDS.find((p) => p.kind === pinKind);

  return (
    <section className={embedded ? "ffScreen ffEmbedded" : "screen ffScreen"}>
      {embedded ? null : (
        <>
          <button type="button" className="linkButton" onClick={() => setActiveScreen(backTo)}>
            <ArrowLeft size={16} aria-hidden /> {t("changeLedger.back")}
          </button>
          <header className="ffHeader">
            <h1>{t(titleKey)}</h1>
            <p>{t(subtitleKey)}</p>
          </header>
        </>
      )}

      <p className="ffLiveRegion" role="status" aria-live="polite">
        {announce}
      </p>

      <TimeField
        field={field}
        selectedBranchId={selectedBranchId}
        onSelectBranch={(id) => {
          setSelectedBranchId(id);
          setSealBranch(id ?? "");
        }}
        onBendMonth={doBend}
        t={t}
        locale={locale}
      />

      <div className="ffLegend">
        <span><i className="ffSwatch ffSwatchReality" /> {t("futureField.reality")}</span>
        <span><i className="ffSwatch ffSwatchPossible" /> {t("futureField.possible")}</span>
        <span><i className="ffSwatch ffSwatchCommitted" /> {t("futureField.committed")}</span>
      </div>

      {error ? <p className="ffError">{error}</p> : null}

      {/* Cross-goal impact - the other real goals this plan competes with */}
      {(field.crossGoalNodes ?? []).length ? (
        <section className="ffAction ffCrossCard">
          <h2>{t("futureField.crossTitle")}</h2>
          <ul className="ffCrossList">
            {field.crossGoalNodes.map((n) => (
              <li key={n.goalId}>
                {n.goalId === "home" ? (
                  <span>
                    {t("futureField.node.home")}: {sgd(n.monthlyContribution)}/mo
                    {n.readyMonth ? ` · ${t("futureField.ready")} ${fmtMonth(n.readyMonth, locale)}` : ""}
                  </span>
                ) : (
                  <span className={n.safe ? "" : "ffWarn"}>
                    {t("futureField.node.emergency")}: {n.bufferMonths} {t("futureField.months")}
                    {n.safe ? ` · ${t("futureField.aboveFloor")}` : ` · ${t("futureField.belowFloor", { floor: n.floorMonths })}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {field.context?.availableMonthlyCashflow != null ? (
            <p className="ffMuted">
              {t("futureField.roomLeft", { amount: sgd(field.context.availableMonthlyCashflow) })}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Catch-up */}
      {field.catchUp ? (
        <section className="ffAction ffCatchUpCard">
          <h2>{t("futureField.catchUpTitle")}</h2>
          <p className={`ffCatchUpStatus ffCatchUp-${field.catchUp.status}`}>
            {t(`futureField.catchUp.${field.catchUp.status}`)}
          </p>
          {field.catchUp.driftMonths != null ? (
            <p className="ffMuted">{t("futureField.catchUpDrift", { months: field.catchUp.driftMonths })}</p>
          ) : null}
        </section>
      ) : null}

      {/* Peel */}
      <form className="ffAction" onSubmit={doPeel}>
        <h2>{t("futureField.peelTitle")}</h2>
        <p className="ffMuted">{t("futureField.peelHelp")}</p>
        <label>
          {t("futureField.peelFieldLabel")}
          <select
            value={peelField}
            onChange={(e) => {
              setPeelField(e.target.value);
              setPeelValue("");
            }}
          >
            {peelFields.map((f) => (
              <option key={f.field} value={f.field}>
                {t(`futureField.peelField.${f.field}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("futureField.peelValueLabel")}
          {peelFieldMeta.kind === "select" ? (
            <select value={peelValue} onChange={(e) => setPeelValue(e.target.value)} required>
              <option value="">—</option>
              {peelFieldMeta.options.map((o) => (
                <option key={o} value={o}>
                  {t(`futureField.opt.${peelField}.${o}`) === `futureField.opt.${peelField}.${o}` ? o : t(`futureField.opt.${peelField}.${o}`)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={peelInputType(peelFieldMeta.kind)}
              value={peelValue}
              onChange={(e) => setPeelValue(e.target.value)}
              required
            />
          )}
        </label>
        <label>
          {t("futureField.peelLabelLabel")}
          <input type="text" value={peelLabel} onChange={(e) => setPeelLabel(e.target.value)} maxLength={60} />
        </label>
        <button type="submit" className="primaryButton" disabled={busy}>
          {t("futureField.peelCta")}
        </button>
      </form>

      {/* Bend */}
      <form className="ffAction" onSubmit={(e) => { e.preventDefault(); doBend(bendMonth, { preview: false }); }}>
        <h2>{t("futureField.bendTitle")}</h2>
        <p className="ffMuted">{t("futureField.bendHelp")}</p>
        <label>
          {t("futureField.bendMonthLabel")}
          <input type="month" value={bendMonth} onChange={(e) => setBendMonth(e.target.value)} />
        </label>
        <button type="submit" className="secondaryButton" disabled={busy}>
          {t("futureField.bendCta")}
        </button>
        {bendResult ? (
          bendResult.achievable ? (
            <div className="ffResult">
              <p><strong>{sgd(bendResult.solvedMonthly)}/mo</strong> ({bendResult.deltaMonthly >= 0 ? "+" : ""}{sgd(bendResult.deltaMonthly)} {t("futureField.vsNow")})</p>
              {bendResult.sideEffects?.bufferImpactMonths ? (
                <p className="ffMuted">{t("futureField.bendBufferCost", { months: bendResult.sideEffects.bufferImpactMonths, horizon: bendResult.sideEffects.bufferImpactHorizonMonths })}</p>
              ) : null}
              {bendResult.sideEffects?.fitsAvailableCashflow === false ? (
                <p className="ffWarn">{t("futureField.bendExceedsCashflow")}</p>
              ) : null}
              <button type="button" className="linkButton" onClick={saveBendAsBranch} disabled={busy}>
                {t("futureField.bendSaveAsBranch")}
              </button>
            </div>
          ) : (
            <p className="ffWarn">{t("futureField.bendImpossible", { months: bendResult.soonestAtCeiling ?? "" })}</p>
          )
        ) : null}
      </form>

      {/* Pin */}
      <section className="ffAction">
        <h2>{t("futureField.pinTitle")}</h2>
        <p className="ffMuted">{t("futureField.pinHelp")}</p>
        {(field.pins ?? []).length ? (
          <ul className="ffPinList">
            {field.pins.map((p) => (
              <li key={p.id}>
                <span>{t(`changeLedger.pinKind.${p.kind}`, { value: p.value ?? "" })}</span>
                <button type="button" className="linkButton" onClick={() => releasePin(p.id)} disabled={busy}>
                  {t("futureField.pinRelease")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ffMuted">{t("futureField.noPins")}</p>
        )}
        <form className="ffPinForm" onSubmit={doPin}>
          <select value={pinKind} onChange={(e) => setPinKind(e.target.value)}>
            {PIN_KINDS.map((p) => (
              <option key={p.kind} value={p.kind}>
                {t(`changeLedger.pinKind.${p.kind}`, { value: "N" })}
              </option>
            ))}
          </select>
          {pinMeta?.needsValue ? (
            <input type="number" value={pinValue} onChange={(e) => setPinValue(e.target.value)} aria-label={t("futureField.pinValueLabel")} />
          ) : null}
          <button type="submit" className="secondaryButton" disabled={busy}>
            {t("futureField.pinCta")}
          </button>
        </form>
      </section>

      {/* Seal */}
      <section className="ffAction ffSeal">
        <h2>{t("futureField.sealTitle")}</h2>
        <p className="ffMuted">{t("futureField.sealHelp")}</p>
        {sealDone ? (
          <div className="ffResult ffSealDone">
            <p>{t("futureField.sealConfirmed", { amount: sgd(sealDone.commitment?.monthly_contribution) })}</p>
            <p className="ffMuted">{t("futureField.sealShadowNote")}</p>
            <button type="button" className="linkButton" onClick={() => setActiveScreen("changeLedger")}>
              {t("changeLedger.viewFull")}
            </button>
          </div>
        ) : sealPreview ? (
          <div className="ffSealPreview">
            <dl>
              <div><dt>{t("futureField.sealAmount")}</dt><dd>{sgd(sealPreview.amount)}/mo · {t("futureField.from")} {sealPreview.effectiveMonth}</dd></div>
              <div><dt>{t("futureField.sealReady")}</dt><dd>{fmtMonth(sealPreview.readyMonth, locale) || "—"}</dd></div>
              <div><dt>{t("futureField.sealGuardianCan")}</dt><dd>{t("futureField.sealGuardianCanValue")}</dd></div>
              <div><dt>{t("futureField.sealAutoPause")}</dt><dd>{t("futureField.sealAutoPauseValue", { months: 6 })}</dd></div>
              <div><dt>{t("futureField.sealExecution")}</dt><dd>{t(`futureField.exec.${sealPreview.execution}`)}</dd></div>
              <div><dt>{t("futureField.sealReversible")}</dt><dd>{t("futureField.yes")}</dd></div>
            </dl>
            {sealPreview.sources?.length ? (
              <p className="ffMuted">{t("futureField.sealSources")}: {sealPreview.sources.join(" · ")}</p>
            ) : null}
            {!sealPreview.respectsPins ? (
              <p className="ffWarn">{t("futureField.sealViolatesPins")}</p>
            ) : null}
            <div className="ffSealActions">
              <button type="button" className="primaryButton" onClick={doSealConfirm} disabled={busy || !sealPreview.respectsPins}>
                {t("futureField.sealConfirmCta")}
              </button>
              <button type="button" className="linkButton" onClick={() => setSealPreview(null)}>
                {t("futureField.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={doSealPreview}>
            <label>
              {t("futureField.sealBranchLabel")}
              <select value={sealBranch} onChange={(e) => setSealBranch(e.target.value)}>
                <option value="">{t("futureField.sealBranchReality")}</option>
                {(field.possiblePaths ?? []).filter((b) => b.status === "open").map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </label>
            <label>
              {t("futureField.sealAmountLabel")}
              <input type="number" value={sealAmount} onChange={(e) => setSealAmount(e.target.value)} required />
            </label>
            <button type="submit" className="secondaryButton" disabled={busy}>
              {t("futureField.sealPreviewCta")}
            </button>
          </form>
        )}
      </section>

      {/* Change Replay - what has changed for this plan, from the real Ledger */}
      <GoalChangeHistory goalId={domain} t={t} setActiveScreen={setActiveScreen} />
    </section>
  );
}
