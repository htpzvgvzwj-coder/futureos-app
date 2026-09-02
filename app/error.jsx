"use client";

// Route-level error boundary (Usable RC, section 十二). Shows a calm,
// recoverable page - NEVER a stack trace, SQL error, env var name or
// internal id. A short error id is shown so support can trace it; it
// carries no personal data.

import { useEffect, useMemo } from "react";

export default function Error({ error, reset }) {
  const errorId = useMemo(() => {
    const rand = Math.random().toString(36).slice(2, 8);
    return `err_${Date.now().toString(36)}_${rand}`;
  }, []);

  useEffect(() => {
    // Structured, redacted client log - message only, no personal data.
    try {
      console.error("[futureos:error]", JSON.stringify({ errorId, message: String(error?.message ?? "unknown").slice(0, 200) }));
    } catch {
      /* noop */
    }
  }, [error, errorId]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <section style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong on this screen</h1>
        <p style={{ color: "#5a6480", fontSize: 14, marginBottom: 16 }}>
          Your data is safe. You can retry this screen, or go back to Today.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          <button type="button" onClick={() => reset()} style={btn}>
            Retry
          </button>
          <button type="button" onClick={() => { window.location.href = "/"; }} style={btnGhost}>
            Go to Today
          </button>
        </div>
        <p style={{ color: "#9aa2bd", fontSize: 12 }}>Reference: {errorId}</p>
      </section>
    </main>
  );
}

const btn = { border: "1px solid #14243a", background: "#14243a", color: "#fff", borderRadius: 10, padding: "8px 16px", font: "inherit", cursor: "pointer" };
const btnGhost = { border: "1px solid #d9deec", background: "transparent", color: "inherit", borderRadius: 10, padding: "8px 16px", font: "inherit", cursor: "pointer" };
