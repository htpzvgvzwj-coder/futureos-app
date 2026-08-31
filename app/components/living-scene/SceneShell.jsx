"use client";

// SceneShell - the shared frame. Its whole job is Part 1:
//
//   1. a compact RealitySummary
//   2. the Studio's native scene (children)
//   3. exactly ONE active MomentOutlet
//   4. optional CLOSED Evidence and Memory drawers
//
// No cumulative "reached" layers. No seven-dot tracker. No "Step N". The
// phase machine is internal architecture, not customer navigation.

import { useState } from "react";
import { useLivingScene } from "./LivingSceneProvider.jsx";
import { RealitySummary } from "./RealitySummary.jsx";
import { MomentOutlet } from "./MomentOutlet.jsx";
import { EvidenceDrawer, MemoryDrawer } from "./SceneDrawers.jsx";
import { BranchStrip } from "./BranchStrip.jsx";

export function SceneShell({
  t,
  setActiveScreen,
  realitySummary = null,
  realityRows = [],
  realityUnknowns = [],
  realityNote = null,
  sealMonthlyAmount = 0,
  goalOptions = [],
  formatSelf,
  children,
}) {
  const s = useLivingScene();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const showMemoryDrawer = s.branchDirty || s.sealState.sealed;

  return (
    <div className="lsScene">
      <RealitySummary t={t} summary={realitySummary} rows={realityRows} onOpenEvidence={() => setEvidenceOpen(true)} />

      <div className="lsSceneSurface">{children}</div>

      <BranchStrip t={t} />

      <MomentOutlet t={t} sealMonthlyAmount={sealMonthlyAmount} goalOptions={goalOptions} formatSelf={formatSelf} />

      <EvidenceDrawer
        t={t}
        open={evidenceOpen}
        onToggle={setEvidenceOpen}
        rows={realityRows}
        unknowns={realityUnknowns}
        note={realityNote}
      />
      {showMemoryDrawer ? <MemoryDrawer t={t} setActiveScreen={setActiveScreen} /> : null}
    </div>
  );
}
