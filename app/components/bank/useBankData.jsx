"use client";

// One place Today / Life / Explore / Guardian read the Financial Twin +
// the persistent Current Ripple. A single invalidate() re-fetches both
// after any mutation (a Pay, a Seal, a manual entry).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const Ctx = createContext(null);

export function useBankData() {
  return (
    useContext(Ctx) ?? {
      twin: null,
      ripple: null,
      status: "idle",
      invalidate: () => {},
      reload: () => {},
    }
  );
}

export function BankDataProvider({ enabled = true, children }) {
  const [twin, setTwin] = useState(null);
  const [ripple, setRipple] = useState(null);
  const [status, setStatus] = useState("idle");
  const req = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++req.current;
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const [tRes, rRes] = await Promise.all([
        fetch("/api/financial-twin", { headers: { "cache-control": "no-cache" } }),
        fetch("/api/ripple", { headers: { "cache-control": "no-cache" } }),
      ]);
      if (id !== req.current) return;
      setTwin(tRes.ok ? await tRes.json() : null);
      setRipple(rRes.ok ? await rRes.json() : null);
      setStatus(tRes.ok ? "ready" : "error");
    } catch {
      if (id === req.current) setStatus("error");
    }
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const timer = useRef(null);
  const invalidate = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(load, 250);
  }, [load]);

  const value = useMemo(() => ({ twin, ripple, status, invalidate, reload: load }), [twin, ripple, status, invalidate, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
