"use client";

// PossibilityLayer - "What could happen if this changes?"
//
// The self outcome (this Studio's own number) plus every other life node
// this branch pushes on. Nodes move by the CURRENT projection - the pure
// one while dragging, replaced by the server's cross-goal projection once
// the debounced peel lands.

import { useLivingScene } from "./LivingSceneProvider.jsx";

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

function DirArrow({ dir }) {
  const glyph = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
  return <span className={`lsDir lsDir-${dir || "flat"}`} aria-hidden="true">{glyph}</span>;
}

export function PossibilityLayer({ t, formatSelf }) {
  const s = useLivingScene();
  if (!s.branchDirty) return null;
  const self = s.projection.selfOutcome;
  const nodes = s.projection.nodes ?? [];
  const server = s.serverProjection;

  return (
    <section className="lsLayer lsPossibility" aria-label={t("livingScene.possible.title")}>
      <h3>{t("livingScene.possible.title")}</h3>

      {self ? (
        <p className="lsSelfOutcome">
          <span className="lsSelfLabel">{t(`livingScene.self.${self.metric}`)}</span>
          <span className="lsSelfMove">
            <span className="lsWas">{formatSelf ? formatSelf(self.before) : self.before}</span>
            <DirArrow dir={self.dir} />
            <b>{formatSelf ? formatSelf(self.after) : self.after}</b>
          </span>
        </p>
      ) : null}

      {nodes.length ? (
        <ul className="lsNodes">
          {nodes.map((n) => (
            <li key={n.id} className={`lsNode lsNode-${n.dir || "flat"}`}>
              <span className="lsNodeName">{t(`livingScene.node.${n.id}`)}</span>
              <span className="lsNodeMove">
                <DirArrow dir={n.dir} />
                {n.note ?? (n.deltaMonthly ? `${n.deltaMonthly > 0 ? "+" : ""}${sgd(n.deltaMonthly)}/mo` : t(`livingScene.node.dir.${n.dir || "flat"}`))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {server ? (
        <p className="lsProvenance">{t("livingScene.possible.serverConfirmed")}</p>
      ) : (
        <p className="lsProvenance">{t("livingScene.possible.projectedNote")}</p>
      )}
    </section>
  );
}
