"use client";

// LivingSceneProvider - the shared runtime every Studio scene mounts inside.
//
// It owns ONE state object for a domain and exposes it through context. It
// renders no visual. The PRIMARY PRODUCT RULE governs it: the runtime may
// calculate / monitor / prepare / remember implicitly, but it must never
// implicitly make a decision, seal a commitment, move or allocate money,
// run Shadow Guardian, or hide an assumption.
//
// Persistence split:
//   - sessionStorage: ONLY the unsaved UI draft (branch vars the customer is
//     dragging, a not-yet-confirmed allocation, a turning-point ack).
//   - server (/api/future-field): the source of truth for confirmed state -
//     whether this plan is already sealed (plan state past "draft"), its
//     committed path, its branches. A fresh provider mount (reload / new
//     tab) recovers the committed state from there, never from the draft.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLifeThread } from "../life-thread/LifeThreadProvider.jsx";
import { derivePhase } from "../../../lib/living-scene/spine.js";
import { commitmentGateOpen, allocationGoalId, allocationSettled as computeAllocationSettled } from "../../../lib/living-scene/gates.js";
import { normalizeAllocation, allocationSum, isAllocationSet } from "../../../lib/living-plan/allocation.js";

const LivingSceneContext = createContext(null);

export function useLivingScene() {
  const ctx = useContext(LivingSceneContext);
  if (!ctx) throw new Error("useLivingScene must be used inside <LivingSceneProvider>");
  return ctx;
}

// Part 0.3: recovery is by commitment IDENTITY, not a generic plan state.
// /api/future-field returns `sceneSeal` which is only { sealed: true } when
// an active commitment for the SAME (domain, plan) exists.

function draftKey(domain) {
  return `livingScene:draft:${domain}`;
}
// The draft is a per-viewer convenience only. Never authoritative.
function loadDraft(domain) {
  try {
    const raw = sessionStorage.getItem(draftKey(domain));
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
}
function persistDraft(domain, patch) {
  try {
    const prev = loadDraft(domain) ?? {};
    sessionStorage.setItem(draftKey(domain), JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* private mode / disabled storage - fine */
  }
}
function clearDraft(domain) {
  try {
    sessionStorage.removeItem(draftKey(domain));
  } catch {
    /* fine */
  }
}

const EMPTY_PROJECTION = { selfOutcome: null, nodes: [], freedCashflow: 0, addedPressure: 0, mode: "neutral" };

export function LivingSceneProvider({ domain, projectFn, turningPointFor = null, children }) {
  const { invalidate: invalidateLifeThread } = useLifeThread();
  const [field, setField] = useState(null); // raw /api/future-field response
  const [loadState, setLoadState] = useState("loading"); // loading | ready | no-reality | error
  const [branchVars, setBranchVars] = useState({});
  const [allocation, setAllocationState] = useState(normalizeAllocation(null));
  const [allocationTouched, setAllocationTouched] = useState(false);
  const [allocationTarget, setAllocationTarget] = useState(null); // explicit goal id, or null = flexible
  const [turningPointAck, setTurningPointAck] = useState(false);
  const [serverBranch, setServerBranch] = useState(null); // { id, delta, feasibility, sealableVerdict, projectedImpacts }
  const [sealState, setSealState] = useState({ sealed: false, source: null, commitment: null, guardianPolicy: null, preview: null, error: null, busy: false });
  const [guardianStandDown, setGuardianStandDown] = useState(false);
  const [shadowPreview, setShadowPreview] = useState({ status: "idle", data: null }); // idle | running | ready | error
  const peelTimer = useRef(null);
  const branchVarsRef = useRef({});

  // ---- load the real field (source of truth for confirmed state) --------
  useEffect(() => {
    let alive = true;
    setLoadState("loading");
    fetch(`/api/future-field?domain=${encodeURIComponent(domain)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!alive) return;
        setField(d);
        setLoadState(d?.hasRealityPath ? "ready" : "no-reality");
        // Part 0.3: recover confirmed state ONLY from an identity-matched
        // commitment for this (domain, plan). Restore the confirmed
        // allocation + Guardian policy; clear any incompatible session
        // draft so the sealed state shows consistently.
        const seal = d?.sceneSeal;
        if (seal?.sealed && seal.identityMatches) {
          clearDraft(domain);
          setBranchVars({});
          setSealState({
            sealed: true,
            source: "server",
            commitment: {
              id: seal.commitmentId,
              domain: seal.domain,
              plan_id: seal.planId,
              monthly_contribution: seal.monthlyContribution,
              effective_month: seal.effectiveMonth,
            },
            guardianPolicy: seal.guardianPolicy ?? null,
            preview: null,
            error: null,
            busy: false,
          });
          if (seal.allocation) {
            setAllocationState(normalizeAllocation(seal.allocation));
            setAllocationTouched(true);
            setAllocationTarget(seal.allocationTargetGoalId ?? null);
          }
          // restore confirmed branch vars from the sealed branch's delta
          const sealedBranch = (d.possiblePaths ?? []).find((b) => b.id === seal.branchId);
          if (sealedBranch?.delta?.after && typeof sealedBranch.delta.after === "object") {
            setBranchVars({ ...sealedBranch.delta.after });
          }
        }
      })
      .catch(() => alive && setLoadState("error"));
    return () => {
      alive = false;
    };
  }, [domain]);

  // ---- restore the UNSAVED DRAFT only (never "sealed") ------------------
  useEffect(() => {
    if (loadState !== "ready") return;
    const p = loadDraft(domain);
    if (!p) return;
    if (p.branchVars && typeof p.branchVars === "object") setBranchVars(p.branchVars);
    if (p.allocation) {
      setAllocationState(normalizeAllocation(p.allocation));
      setAllocationTouched(Boolean(p.allocationTouched));
    }
    if (typeof p.allocationTarget === "string") setAllocationTarget(p.allocationTarget);
    if (p.turningPointAck) setTurningPointAck(true);
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
  const allocSum = allocationSum(allocation);
  const allocationOverspent = allocSum > freedCashflow + 0.5 && freedCashflow > 0;
  // The "goal" leg needs an explicit target; without one the money is not
  // allocated to anything - it stays flexible.
  const needsTarget = allocation.goalMonthly > 0 && !allocationTarget;

  const turningPoint = useMemo(() => {
    if (!branchDirty || typeof turningPointFor !== "function") return null;
    try {
      return turningPointFor({ projection, branchVars, reality: realityData, context: sceneContext }) || null;
    } catch {
      return null;
    }
  }, [branchDirty, turningPointFor, projection, branchVars, realityData, sceneContext]);

  const resourceQuestion = freedCashflow > 0 || addedPressure > 0;
  const allocationSettled = computeAllocationSettled({
    resourceQuestion,
    allocationTouched,
    overspent: allocationOverspent,
    allocation,
    allocationTarget,
  });

  const phase = useMemo(
    () =>
      derivePhase({
        branchDirty,
        freedCashflow,
        addedPressure,
        allocationSet: allocationSettled,
        turningPoint,
        turningPointAcknowledged: turningPointAck,
        sealed: sealState.sealed,
        guardianActive: sealState.sealed && !guardianStandDown,
        revoked: false,
      }),
    [branchDirty, freedCashflow, addedPressure, allocationSettled, turningPoint, turningPointAck, sealState.sealed, guardianStandDown],
  );

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
        if (d?.branch) {
          setServerBranch(d.branch);
          invalidateLifeThread(); // a server branch now exists - refresh the Life Thread
        }
      } catch {
        /* offline / auth - the pure projection still stands */
      }
    },
    [domain, invalidateLifeThread],
  );

  const setVar = useCallback(
    (key, value) => {
      setBranchVars((prev) => {
        const next = { ...prev, [key]: value };
        persistDraft(domain, { branchVars: next });
        return next;
      });
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
    setAllocationTarget(null);
    setTurningPointAck(false);
    setServerBranch(null);
    clearDraft(domain);
  }, [domain]);

  // ---- real branches: create / select / compare / undo -----------------
  const refetchField = useCallback(async () => {
    try {
      const r = await fetch(`/api/future-field?domain=${encodeURIComponent(domain)}`);
      if (r.ok) setField(await r.json());
    } catch {
      /* offline - keep what we have */
    }
  }, [domain]);

  // Create: pin the current edits as a named branch and keep editing.
  const forkBranch = useCallback(
    async (label) => {
      const cur = branchVarsRef.current;
      if (!cur || Object.keys(cur).length === 0) return { ok: false, error: "nothing_to_fork" };
      try {
        const res = await fetch(`/api/future-field/branch?action=peel&domain=${encodeURIComponent(domain)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ overrides: cur, label: String(label || "").slice(0, 60) || "Branch" }),
        });
        if (!res.ok) return { ok: false, error: "peel_failed" };
        const d = await res.json();
        if (d?.branch) setServerBranch(d.branch);
        await refetchField();
        invalidateLifeThread();
        return { ok: true, branch: d?.branch ?? null };
      } catch {
        return { ok: false, error: "network" };
      }
    },
    [domain, refetchField, invalidateLifeThread],
  );

  // Select: make a saved branch THE active moment (server-side), load its
  // edits back in, and refresh - so it (and only it) drives the Life
  // Thread. Every other open branch becomes an alternative (compare only).
  const selectBranch = useCallback(
    async (id) => {
      const b = (field?.possiblePaths ?? []).find((x) => x.id === id);
      if (!b) return;
      setServerBranch(b);
      const after = b.delta?.after && typeof b.delta.after === "object" ? b.delta.after : null;
      if (after) {
        setBranchVars({ ...after });
        persistDraft(domain, { branchVars: after });
      }
      try {
        await fetch(`/api/future-field/branch?action=activate&domain=${encodeURIComponent(domain)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ branchId: id }),
        });
      } catch {
        /* offline - local selection still stands */
      }
      await refetchField();
      invalidateLifeThread();
    },
    [domain, field, refetchField, invalidateLifeThread],
  );

  // Undo: discard a possible future (kept in history, never hard-deleted).
  const discardBranch = useCallback(
    async (id) => {
      try {
        await fetch(`/api/future-field/branch?action=discard&domain=${encodeURIComponent(domain)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ branchId: id }),
        });
      } catch {
        /* ignore - refetch will reconcile */
      }
      if (serverBranch?.id === id) resetBranch();
      await refetchField();
      invalidateLifeThread();
    },
    [domain, serverBranch, resetBranch, refetchField, invalidateLifeThread],
  );

  // setAllocation(nextAllocation, targetGoalId|null). A "goal" leg with no
  // explicit target is rejected - it must not silently route anywhere.
  const setAllocation = useCallback(
    (next, target = null) => {
      const norm = normalizeAllocation(next);
      setAllocationState(norm);
      setAllocationTouched(true);
      const t = norm.goalMonthly > 0 ? (target || null) : null;
      setAllocationTarget(t);
      persistDraft(domain, { allocation: norm, allocationTouched: true, allocationTarget: t });
    },
    [domain],
  );

  const acknowledgeTurningPoint = useCallback(() => {
    setTurningPointAck(true);
    persistDraft(domain, { turningPointAck: true });
  }, [domain]);

  // Commitment review may not even render until every gate is clear.
  // Part 0.4: sealability is an EXPLICIT server verdict - a missing verdict
  // is treated as NOT sealable, never as true.
  const branchSealable = serverBranch?.sealableVerdict?.sealable === true;
  const canReviewCommitment = commitmentGateOpen({
    branchDirty,
    sealed: sealState.sealed,
    allocationSettled,
    turningPoint,
    turningPointAck,
    serverBranchId: serverBranch?.id ?? null,
    branchSealable,
  });

  const seal = useCallback(
    async (monthlyAmount) => {
      if (!canReviewCommitment) return { ok: false, error: "not_ready" };
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
        setSealState((s) => ({ ...s, busy: false, preview: pre.preview }));
        return { ok: true, preview: pre.preview };
      } catch {
        setSealState((s) => ({ ...s, busy: false, error: "network" }));
        return { ok: false };
      }
    },
    [domain, serverBranch, canReviewCommitment],
  );

  const confirmSeal = useCallback(
    async (monthlyAmount) => {
      if (!canReviewCommitment) return { ok: false, error: "not_ready" };
      setSealState((s) => ({ ...s, busy: true, error: null }));
      try {
        // Part 0.1: ONE atomic request. Allocation + explicit target + the
        // freed / pressure figures + a deterministic idempotency key all go
        // with the confirm - the server does allocation-persist + commitment
        // + Guardian policy + Ledger events in one transaction.
        const { goalId, valid } = allocationGoalId({ allocation, allocationTarget });
        const useAllocation = isAllocationSet(allocation) && valid;
        const idempotencyKey = [
          domain,
          serverBranch?.id ?? "reality",
          Math.round(monthlyAmount),
          useAllocation ? `${goalId}:${Math.round(allocationSum(allocation))}` : "noalloc",
        ].join("|");
        const res = await fetch(`/api/future-field/seal`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            domain,
            branchId: serverBranch?.id ?? null,
            monthlyAmount,
            mode: "confirm",
            allocation: useAllocation ? allocation : null,
            allocationTargetGoalId: useAllocation ? goalId : null,
            freedCashflow,
            addedPressure,
            idempotencyKey,
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          setSealState((s) => ({ ...s, busy: false, error: d?.error ?? "seal_failed", preview: d?.preview ?? s.preview }));
          return { ok: false, error: d?.error ?? "seal_failed" };
        }
        clearDraft(domain);
        setSealState({
          sealed: true,
          source: "confirm",
          commitment: d.commitment ?? null,
          guardianPolicy: null,
          preview: d.preview ?? null,
          error: null,
          busy: false,
        });
        invalidateLifeThread(); // one canonical snapshot for all four entrances
        return { ok: true, commitment: d.commitment ?? null };
      } catch {
        setSealState((s) => ({ ...s, busy: false, error: "network" }));
        return { ok: false, error: "network" };
      }
    },
    [domain, serverBranch, allocation, allocationTarget, freedCashflow, addedPressure, canReviewCommitment, invalidateLifeThread],
  );

  const standDownGuardian = useCallback(() => setGuardianStandDown(true), []);

  // Shadow Guardian is NEVER run implicitly. This is the only path to it,
  // and it is called only from an explicit "Stress-test this plan" action.
  // It never mutates the plan - it returns a preview the customer reads.
  const stressTest = useCallback(async (trigger = null) => {
    setShadowPreview({ status: "running", data: null });
    try {
      const res = await fetch("/api/living-plan/shadow-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(trigger ? { trigger } : {}),
      });
      const d = res.ok ? await res.json() : null;
      setShadowPreview({ status: d ? "ready" : "error", data: d?.preview ?? null });
      return d?.preview ?? null;
    } catch {
      setShadowPreview({ status: "error", data: null });
      return null;
    }
  }, []);

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
      savedBranches: (field?.possiblePaths ?? []).filter((b) => b.status !== "sealed" && b.status !== "discarded" && b.status !== "merged"),
      forkBranch,
      selectBranch,
      discardBranch,
      projection,
      serverProjection: serverBranch?.projectedImpacts ?? null,
      serverBranch,
      freedCashflow,
      addedPressure,
      allocation,
      allocationTouched,
      allocationOverspent,
      allocationTarget,
      needsAllocationTarget: needsTarget,
      setAllocation,
      turningPoint,
      turningPointAck,
      acknowledgeTurningPoint,
      phase,
      canReviewCommitment,
      seal,
      confirmSeal,
      sealState,
      standDownGuardian,
      guardianStandDown,
      stressTest,
      shadowPreview,
      pins: field?.pins ?? [],
    }),
    [
      domain, loadState, field, reality, realityData, sceneContext, crossGoalNodes, branchVars, branchDirty, setVar, resetBranch,
      forkBranch, selectBranch, discardBranch,
      projection, serverBranch, freedCashflow, addedPressure, allocation, allocationTouched, allocationOverspent, allocationTarget,
      needsTarget, setAllocation, turningPoint, turningPointAck, acknowledgeTurningPoint, phase, canReviewCommitment, seal, confirmSeal,
      sealState, standDownGuardian, guardianStandDown, stressTest, shadowPreview,
    ],
  );

  return <LivingSceneContext.Provider value={value}>{children}</LivingSceneContext.Provider>;
}
