"use client";

// One shared Wedding Living Plan state object. Every Wedding view (Future
// Field, Guest Orbit, Budget River, Mirror, Change Replay) reads and writes
// through this - the customer never re-enters what the plan already knows.

import { useCallback, useEffect, useState } from "react";

export function useWeddingField() {
  const [field, setField] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/future-field?domain=wedding");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "load_error");
        setField(data.hasRealityPath === false ? data : null);
        return data;
      }
      setField(data);
      return data;
    } catch {
      setError("load_error");
      return null;
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Thin POST/DELETE helper against the Future Field API. Returns
  // { ok, data }.
  const call = useCallback(async (url, body, method = "POST") => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "request_failed");
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch {
      setError("request_failed");
      return { ok: false, data: {} };
    } finally {
      setBusy(false);
    }
  }, []);

  // Peel a branch on one wedding variable, then reload the shared field.
  const peel = useCallback(
    async (overrides, label) => {
      const r = await call(`/api/future-field/branch?action=peel&domain=wedding`, { overrides, label });
      if (r.ok) await reload();
      return r;
    },
    [call, reload],
  );

  return { field, error, busy, reload, call, peel, setField };
}
