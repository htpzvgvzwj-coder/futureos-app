"use client";

// The ONE client data source for the Future Bank shell. Today, Explore,
// Guardian and History all read from here - never from page-local derived
// state. One customer action (`act`) or `refetchAll()` re-loads every
// source so all four surfaces agree.
//
// Sources, loaded in parallel:
//   /api/financial-twin   - the money picture
//   /api/money-moments    - the normalized detection + plan-movement stream
//   /api/life-thread      - active plans/drafts, studioImpacts, turning point
//   /api/ripple           - persisted "what changed"
//   /api/change-ledger    - the causal history

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const Ctx = createContext(null);

const ENDPOINTS = {
  twin: "/api/financial-twin",
  moments: "/api/money-moments",
  lifeThread: "/api/life-thread",
  ripple: "/api/ripple",
  ledger: "/api/change-ledger?filter=all",
};

async function getJson(url) {
  const r = await fetch(url, { headers: { "cache-control": "no-cache" } });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(body?.error || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return body;
}

export function FutureBankDataProvider({ children, enabled = true }) {
  // Nesting-safe: if a provider already exists above (e.g. one wrapping the
  // whole shell), reuse it instead of firing a second set of fetches.
  const existing = useContext(Ctx);
  if (existing) return <>{children}</>;
  return <ProviderImpl enabled={enabled}>{children}</ProviderImpl>;
}

function ProviderImpl({ children, enabled = true }) {
  const [state, setState] = useState({
    twin: null,
    moments: null,
    lifeThread: null,
    ripple: null,
    ledger: null,
    status: "idle", // idle | loading | ready | error | anon
    error: null,
    loadedAt: null,
  });
  const inflight = useRef(0);

  const refetchAll = useCallback(async () => {
    if (!enabled) return;
    const seq = ++inflight.current;
    setState((s) => ({ ...s, status: s.status === "ready" ? "ready" : "loading", error: null }));
    const results = await Promise.allSettled([
      getJson(ENDPOINTS.twin),
      getJson(ENDPOINTS.moments),
      getJson(ENDPOINTS.lifeThread),
      getJson(ENDPOINTS.ripple),
      getJson(ENDPOINTS.ledger),
    ]);
    if (seq !== inflight.current) return; // a newer refetch superseded this one
    const [twin, moments, lifeThread, ripple, ledger] = results;
    const anyAnon = results.some((r) => r.status === "rejected" && r.reason?.status === 401);
    if (anyAnon) {
      setState((s) => ({ ...s, status: "anon" }));
      return;
    }
    const val = (r) => (r.status === "fulfilled" ? r.value : null);
    const firstErr = results.find((r) => r.status === "rejected");
    setState({
      twin: val(twin),
      moments: val(moments),
      lifeThread: val(lifeThread),
      ripple: val(ripple),
      ledger: val(ledger),
      status: val(twin) || val(moments) ? "ready" : firstErr ? "error" : "ready",
      error: firstErr ? String(firstErr.reason?.message || "load failed") : null,
      loadedAt: new Date().toISOString(),
    });
  }, [enabled]);

  useEffect(() => {
    if (enabled) refetchAll();
  }, [enabled, refetchAll]);

  // Persist a lifecycle action on a MoneyMoment, then re-sync every surface.
  const act = useCallback(
    async (action, momentKey, opts = {}) => {
      const r = await fetch("/api/money-moments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, momentKey, ...opts }),
      });
      const body = await r.json().catch(() => null);
      if (r.ok && body?.data) {
        setState((s) => ({ ...s, moments: body.data }));
      }
      // full re-sync so twin / life-thread / ripple / ledger reflect the write
      await refetchAll();
      return { ok: r.ok, ...(body || {}) };
    },
    [refetchAll],
  );

  const value = useMemo(
    () => ({
      ...state,
      refetchAll,
      act,
      // convenience selectors
      moments: state.moments?.moments ?? [],
      momentsRaw: state.moments,
      bankNow: state.moments?.bankNow ?? null,
      moneyChanged: state.moments?.moneyChanged ?? null,
      watching: state.moments?.watching ?? [],
      planMovement: state.moments?.planMovement ?? [],
      resourceSummary: state.moments?.monthlyResourceSummary ?? null,
    }),
    [state, refetchAll, act],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFutureBankData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFutureBankData must be used inside <FutureBankDataProvider>");
  return v;
}
