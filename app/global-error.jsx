"use client";

// Root error boundary - catches errors in the root layout itself. Must
// render its own <html>/<body>. No stack traces, no internal identifiers.

export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>FutureOS could not load</h1>
            <p style={{ color: "#5a6480", fontSize: 14, marginBottom: 16 }}>Please try again in a moment. Your data is safe.</p>
            <button
              type="button"
              onClick={() => reset()}
              style={{ border: "1px solid #14243a", background: "#14243a", color: "#fff", borderRadius: 10, padding: "8px 16px", font: "inherit", cursor: "pointer" }}
            >
              Reload
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
