"use client";

// LifeThreadProvider - the one place Today / Life / Explore / Guardian read
// their main state from. It owns the canonical server snapshot and a single
// `invalidate()` that every mutation (peel / allocation / Seal / revoke /
// handoff) calls. The current screen and scroll position are untouched by a
// refetch - only the data changes.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const LifeThreadContext = createContext(null);

export function useLifeThread() {
  return useContext(LifeThreadContext) ?? { thread: null, status: "idle", invalidate: () => {}, snapshotVersion: null };
}

export function LifeThreadProvider({ enabled = true, children }) {
  const [thread, setThread] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++reqId.current;
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const res = await fetch("/api/life-thread", { headers: { "cache-control": "no-cache" } });
      if (id !== reqId.current) return; // a newer request superseded this one
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      if (id !== reqId.current) return;
      setThread(data);
      setStatus("ready");
    } catch {
      if (id === reqId.current) setStatus("error");
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced so a burst of mutations (peel -> allocate -> seal) triggers
  // one refetch, not three.
  const invalidateTimer = useRef(null);
  const invalidate = useCallback(() => {
    if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
    invalidateTimer.current = setTimeout(load, 250);
  }, [load]);

  const value = useMemo(
    () => ({
      thread,
      status,
      snapshotVersion: thread?.snapshotVersion ?? null,
      invalidate,
      reload: load,
    }),
    [thread, status, invalidate, load],
  );

  return <LifeThreadContext.Provider value={value}>{children}</LifeThreadContext.Provider>;
}
