"use client";

// SceneShell - the shared frame every Studio scene renders inside.
//
// The scene passes its own native direct-manipulation surface as children.
// SceneShell adds the spine layers BELOW it, each appearing only once its
// phase is relevant (never all at once), and the LivingSpine strip at the
// foot. This is what makes the seven behaviours one spine instead of seven
// panels.

import { useLivingScene } from "./LivingSceneProvider.jsx";
import { LivingSpine } from "./LivingSpine.jsx";
import { RealityLayer } from "./RealityLayer.jsx";
import { PossibilityLayer } from "./PossibilityLayer.jsx";
import { AllocationLayer } from "./AllocationLayer.jsx";
import { CommitmentLayer } from "./CommitmentLayer.jsx";
import { GuardianLayer } from "./GuardianLayer.jsx";
import { MemoryLayer } from "./MemoryLayer.jsx";
import { phaseReached } from "../../../lib/living-scene/spine.js";

export function SceneShell({
  t,
  setActiveScreen,
  realityRows = [],
  realityUnknowns = [],
  realityNote = null,
  sealMonthlyAmount = 0,
  sealDisabled = false,
  goalLabel = null,
  formatSelf,
  children,
}) {
  const s = useLivingScene();
  const reached = s.reached;
  const sealed = s.sealState.sealed;
  const commitReady = phaseReached(reached, "possible") && s.phase !== "turning_point" && !sealed;

  return (
    <div className="lsScene">
      <RealityLayer t={t} rows={realityRows} unknowns={realityUnknowns} note={realityNote} />

      <div className="lsSceneSurface">{children}</div>

      {phaseReached(reached, "possible") ? <PossibilityLayer t={t} formatSelf={formatSelf} /> : null}
      {phaseReached(reached, "allocation") ? <AllocationLayer t={t} goalLabel={goalLabel} /> : null}
      {commitReady || sealed ? <CommitmentLayer t={t} monthlyAmount={sealMonthlyAmount} disabled={sealDisabled} /> : null}
      {sealed ? <GuardianLayer t={t} /> : null}
      {sealed ? <MemoryLayer t={t} setActiveScreen={setActiveScreen} /> : null}

      <LivingSpine t={t} />
    </div>
  );
}
