"use client";

// RealityLayer - "What does the system know right now?"
//
// Confirmed facts with their provenance, and - separately - what the system
// does NOT know. An unknown is shown as an unknown, never folded into a gap
// or a total.

export function RealityLayer({ t, rows = [], unknowns = [], note = null }) {
  return (
    <section className="lsLayer lsReality" aria-label={t("livingScene.reality.title")}>
      <h3>{t("livingScene.reality.title")}</h3>
      <dl className="lsRealityRows">
        {rows.map((r) => (
          <div key={r.id} className="lsRealityRow">
            <dt>{r.label}</dt>
            <dd>
              <b>{r.value}</b>
              {r.provenance ? <span className="lsProvenance">{r.provenance}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {unknowns.length ? (
        <div className="lsUnknowns">
          <p className="lsUnknownsHead">{t("livingScene.reality.unknownHead")}</p>
          <ul>
            {unknowns.map((u) => (
              <li key={u.id}>{u.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {note ? <p className="lsProvenance lsNote">{note}</p> : null}
    </section>
  );
}
