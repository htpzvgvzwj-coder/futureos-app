"use client";

// RealitySummary - one calm line about where this Studio stands right now.
// The full breakdown lives in the (closed) Evidence drawer, not here.

export function RealitySummary({ t, summary, rows = [], onOpenEvidence }) {
  const line = summary || (rows[0] ? `${rows[0].label}: ${rows[0].value}` : t("livingScene.reality.title"));
  return (
    <div className="lsRealitySummary">
      <p>{line}</p>
      {rows.length ? (
        <button type="button" className="lsRealityDetails" onClick={onOpenEvidence}>
          {t("livingScene.reality.details")}
        </button>
      ) : null}
    </div>
  );
}
