"use client";

// One place Today / Life / Explore / Guardian read the Financial Twin, the
// persistent Current Ripple, the resolved capability statuses and the
// onboarding state. A single invalidate() re-fetches after any mutation
// (a Pay, a Seal, a manual entry, a consent change).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const Ctx = createContext(null);

const FALLBACK = {
  twin: null,
  ripple: null,
  capabilities: null,
  onboarding: null,
  status: "idle",
  invalidate: () => {},
  reload: () => {},
};

export function useBankData() {
  return useContext(Ctx) ?? FALLBACK;
}

export function BankDataProvider({ enabled = true, children }) {
  const [twin, setTwin] = useState(null);
  const [ripple, setRipple] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [status, setStatus] = useState("idle");
  const req = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++req.current;
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const [tRes, rRes, cRes, oRes] = await Promise.all([
        fetch("/api/financial-twin", { headers: { "cache-control": "no-cache" } }),
        fetch("/api/ripple", { headers: { "cache-control": "no-cache" } }),
        fetch("/api/capabilities", { headers: { "cache-control": "no-cache" } }),
        fetch("/api/onboarding", { headers: { "cache-control": "no-cache" } }),
      ]);
      if (id !== req.current) return;
      setTwin(tRes.ok ? await tRes.json() : null);
      setRipple(rRes.ok ? await rRes.json() : null);
      setCapabilities(cRes.ok ? await cRes.json() : null);
      setOnboarding(oRes.ok ? await oRes.json() : null);
      setStatus(tRes.ok ? "ready" : tRes.status === 401 ? "unauthorized" : "error");
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

  const value = useMemo(
    () => ({ twin, ripple, capabilities, onboarding, status, invalidate, reload: load }),
    [twin, ripple, capabilities, onboarding, status, invalidate, load],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
