"use client";

// LivingSceneProvider - the shared spine every Studio scene mounts inside.
//
// It owns ONE state object for a domain and exposes it through context:
//   reality        - the confirmed plan + real feasibility (from /api/future-field)
//   context        - real cashflow / buffer / committed totals
//   branchVars     - the customer's live overrides (what they are dragging)
//   projection     - the live self-outcome + cross-goal node deltas + freed / pressure
//   allocation     - { goalMonthly, emergencyMonthly, flexibleMonthly } the customer set
//   pins           - structured constraints
//   sealed / commitment / guardianState
//   phase          - the single spine phase that is live right now
//
// It does NOT render a visual. Each scene renders its own native surface and
// reads/writes this state. Numbers come from the same pure lib math the
// server adapters use (projectFn is supplied by the scene) and, on release,
// from the real /api/future-field endpoints - never invented here.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { derivePhase, mergeReached } from "../../../lib/living-scene/spine.js";
import { normalizeAllocation, allocationSum, isAllocationSet } from "../../../lib/living-plan/allocation.js";

const LivingSceneContext = createContext(null);

export function useLivingScene() {
  const ctx = useContext(LivingSceneContext);
  if (!ctx) throw new Error("useLivingScene must be used inside <LivingSceneProvider>");
  return ctx;
}

function storageKey(domain) {
  return `livingScene:${domain}`;
}

// Per-viewer convenience only: remember the customer's in-progress branch /
// allocation / acknowledgements so a refresh does not throw the exploration
// away. Wrapped in try/catch - never required for the scene to work.
function loadPersisted(domain) {
  try {
    const raw = sessionStorage.getItem(storageKey(domain));
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
}
function persist(domain, patch) {
  try {
    const prev = loadPersisted(domain) ?? {};
    sessionStorage.setItem(storageKey(domain), JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* private mode / disabled storage - fine */
  }
}
function clearPersisted(domain) {
  try {
    sessionStorage.removeItem(storageKey(domain));
  } catch {
    /* fine */
  }
}

const EMPTY_PROJECTION = { selfOutcome: null, nodes: [], freedCashflow: 0, addedPressure: 0, mode: "neutral" };

export function LivingSceneProvider({ domain, projectFn, turningPointFor = null, children }) {
  const [field, setField] = useState(null); // raw /api/future-field response
  const [loadState, setLoadState] = useState("loading"); // loading | ready | no-reality | error
  const [branchVars, setBranchVars] = useState({});
  const [allocation, setAllocationState] = useState(normalizeAllocation(null));
  const [allocationTouched, setAllocationTouched] = useState(false);
  const [turningPointAck, setTurningPointAck] = useState(false);
  const [reached, setReached] = useState(["reality"]);
  const [serverBranch, setServerBranch] = useState(null); // { id, delta, feasibility, projectedImpacts }
  const [sealState, setSealState] = useState({ sealed: false, commitment: null, preview: null, error: null, busy: false });
  const [guardianStandDown, setGuardianStandDown] = useState(false);
  const peelTimer = useRef(null);
  const branchVarsRef = useRef({});

  // ---- load the real field ------------------------------------------------
  useEffect(() => {
    let alive = true;
    setLoadState("loading");
    fetch(`/api/future-field?domain=${encodeURIComponent(domain)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!alive) return;
        setField(d);
        setLoadState(d?.hasRealityPath ? "ready" : "no-reality");
      })
      .catch(() => alive && setLoadState("error"));
    return () => {
      alive = false;
    };
  }, [domain]);

  // ---- restore in-progress exploration ---------------------------------
  // Setters are stable and loadPersisted is module scope, so [loadState,
  // domain] is the complete dependency set. (No react-hooks lint plugin is
  // configured, so there is no disable directive to add - and an unknown
  // rule in a disable comment is itself a lint error here.)
  useEffect(() => {
    if (loadState !== "ready") return;
    const p = loadPersisted(domain);
    if (!p) return;
    if (p.branchVars && typeof p.branchVars === "object") setBranchVars(p.branchVars);
    if (p.allocation) {
      setAllocationState(normalizeAllocation(p.allocation));
      setAllocationTouched(Boolean(p.allocationTouched));
    }
    if (p.turningPointAck) setTurningPointAck(true);
    if (Array.isArray(p.reached)) setReached(p.reached);
  }, [loadState, domain]);

  branchVarsRef.current = branchVars;

  const reality = field?.realityPath ?? null;
  const realityData = reality?.data ?? null;
  const sceneContext = field?.context ?? {};
  const crossGoalNodes = field?.crossGoalNodes ?? [];

  // ---- live projection (pure, instant) --------------------------------
  const projection = useMemo(() => {
    if (loadState !== "ready" || !realityData || typeof projectFn !== "function") return EMPTY_PROJECTION;
    if (Object.keys(branchVars).length === 0) return EMPTY_PROJECTION;
    try {
      const out = projectFn({ branchVars, reality: realityData, feasibility: reality?.feasibility ?? null, context: sceneContext, crossGoalNodes });
      return { ...EMPTY_PROJECTION, ...(out || {}) };
    } catch {
      return EMPTY_PROJECTION;
    }
  }, [loadState, realityData, reality, projectFn, branchVars, sceneContext, crossGoalNodes]);

  const branchDirty = Object.keys(branchVars).length > 0;
  const freedCashflow = Math.max(0, Math.round(Number(projection.freedCashflow) || 0));
  const addedPressure = Math.max(0, Math.round(Number(projection.addedPressure) || 0));
  const allocationOverspent = allocationSum(allocation) > freedCashflow + 0.5 && freedCashflow > 0;

  const turningPoint = useMemo(() => {
    if (!branchDirty || typeof turningPointFor !== "function") return null;
    try {
      return turningPointFor({ projection, branchVars, reality: realityData, context: sceneContext }) || null;
    } catch {
      return null;
    }
  }, [branchDirty, turningPointFor, projection, branchVars, realityData, sceneContext]);

  const phase = useMemo(
    () =>
      derivePhase({
        branchDirty,
        freedCashflow,
        addedPressure,
        allocationSet: freedCashflow > 0 || addedPressure > 0 ? allocationTouched && !allocationOverspent : true,
        turningPoint,
        turningPointAcknowledged: turningPointAck,
        sealed: sealState.sealed,
        guardianActive: sealState.sealed && !guardianStandDown,
        revoked: false,
      }),
    [branchDirty, freedCashflow, addedPressure, allocationTouched, allocationOverspent, turningPoint, turningPointAck, sealState.sealed, guardianStandDown],
  );

  useEffect(() => {
    setReached((prev) => {
      const next = mergeReached(prev, phase);
      if (next.length !== prev.length) persist(domain, { reached: next });
      return next;
    });
  }, [phase, domain]);

  // ---- actions -------------------------------------------------------
  const peelToServer = useCallback(
    async (vars) => {
      try {
        const res = await fetch(`/api/future-field/branch?action=peel&domain=${encodeURIComponent(domain)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ overrides: vars, label: "Living Scene branch" }),
        });
        if (!res.ok) return;
        const d = await res.json();
        if (d?.branch) setServerBranch(d.branch);
      } catch {
        /* offline / auth - the pure projection still stands */
      }
    },
    [domain],
  );

  const setVar = useCallback(
    (key, value) => {
      setBranchVars((prev) => {
        const next = { ...prev, [key]: value };
        persist(domain, { branchVars: next });
        return next;
      });
      // debounced authoritative peel so the server projection catches up
      if (peelTimer.current) clearTimeout(peelTimer.current);
      peelTimer.current = setTimeout(() => {
        const cur = branchVarsRef.current;
        if (cur && Object.keys(cur).length) peelToServer(cur);
      }, 650);
    },
    [domain, peelToServer],
  );

  const resetBranch = useCallback(() => {
    setBranchVars({});
    setAllocationState(normalizeAllocation(null));
    setAllocationTouched(false);
    setTurningPointAck(false);
    setServerBranch(null);
    setReached(["reality"]);
    clearPersisted(domain);
  }, [domain]);

  const setAllocation = useCallback(
    (next) => {
      const norm = normalizeAllocation(next);
      setAllocationState(norm);
      setAllocationTouched(true);
      persist(domain, { allocation: norm, allocationTouched: true });
    },
    [domain],
  );

  const acknowledgeTurningPoint = useCallback(() => {
    setTurningPointAck(true);
    persist(domain, { turningPointAck: true });
  }, [domain]);

  const seal = useCallback(
    async (monthlyAmount) => {
      setSealState((s) => ({ ...s, busy: true, error: null }));
      try {
        const preRes = await fetch(`/api/future-field/seal`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domain, branchId: serverBranch?.id ?? null, monthlyAmount, mode: "preview" }),
        });
        const pre = await preRes.json();
        if (!preRes.ok || pre?.preview?.sealable === false) {
          setSealState((s) => ({ ...s, busy: false, preview: pre?.preview ?? null, error: pre?.error ?? "not_sealable" }));
          return { ok: false, preview: pre?.preview ?? null };
        }
        return { ok: true, preview: pre.preview };
      } catch {
        setSealState((s) => ({ ...s, busy: false, error: "network" }));
        return { ok: false };
      }
    },
    [domain, serverBranch],
  );

  const confirmSeal = useCallback(
    async (monthlyAmount) => {
      setSealState((s) => ({ ...s, busy: true, error: null }));
      try {
        // allocation rides with the branch, exactly like WeddingLivingPlan
        if (serverBranch?.id && isAllocationSet(allocation)) {
          await fetch(`/api/future-field/branch?action=allocate&domain=${encodeURIComponent(domain)}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ branchId: serverBranch.id, allocation, goalId: "home" }),
          });
        }
        const res = await fetch(`/api/future-field/seal`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domain, branchId: serverBranch?.id ?? null, monthlyAmount, mode: "confirm" }),
        });
        const d = await res.json();
        if (!res.ok) {
          setSealState((s) => ({ ...s, busy: false, error: d?.error ?? "seal_failed", preview: d?.preview ?? s.preview }));
          return { ok: false, error: d?.error ?? "seal_failed" };
        }
        setSealState({ sealed: true, commitment: d.commitment ?? null, preview: d.preview ?? null, error: null, busy: false });
        persist(domain, { sealed: true });
        return { ok: true, commitment: d.commitment ?? null };
      } catch {
        setSealState((s) => ({ ...s, busy: false, error: "network" }));
        return { ok: false, error: "network" };
      }
    },
    [domain, serverBranch, allocation],
  );

  const standDownGuardian = useCallback(() => setGuardianStandDown(true), []);

  const value = useMemo(
    () => ({
      domain,
      loadState,
      field,
      reality,
      realityData,
      context: sceneContext,
      crossGoalNodes,
      branchVars,
      branchDirty,
      setVar,
      resetBranch,
      projection,
      serverProjection: serverBranch?.projectedImpacts ?? null,
      serverBranch,
      freedCashflow,
      addedPressure,
      allocation,
      allocationTouched,
      allocationOverspent,
      setAllocation,
      turningPoint,
      turningPointAck,
      acknowledgeTurningPoint,
      phase,
      reached,
      seal,
      confirmSeal,
      sealState,
      standDownGuardian,
      guardianStandDown,
      pins: field?.pins ?? [],
    }),
    [
      domain, loadState, field, reality, realityData, sceneContext, crossGoalNodes, branchVars, branchDirty, setVar, resetBranch,
      projection, serverBranch, freedCashflow, addedPressure, allocation, allocationTouched, allocationOverspent, setAllocation,
      turningPoint, turningPointAck, acknowledgeTurningPoint, phase, reached, seal, confirmSeal, sealState, standDownGuardian, guardianStandDown,
    ],
  );

  return <LivingSceneContext.Provider value={value}>{children}</LivingSceneContext.Provider>;
}
