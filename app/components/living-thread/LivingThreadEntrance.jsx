"use client";

// LivingThreadEntrance - the bridge between the app's four nav entrances
// (Today / Life / Explore / Guardian) and the ONE LivingThreadSurface.
//
// Every entrance renders this with a different `lens`, but all four read
// the SAME canonical thread from useLifeThread() and run the SAME
// buildThreadGeometry inside the surface. Switching entrance = switching
// lens = a pure change of which overlay layers draw. No entrance computes
// its own version of the thread.

import { useLifeThread } from "../life-thread/LifeThreadProvider.jsx";
import { LivingThreadSurface } from "./LivingThreadSurface.jsx";

export function LivingThreadEntrance({ lens, onNavigateLens, onEnterStudio, onPlaceFragment, onStandDown, memoryEvents = [] }) {
  const { thread, status } = useLifeThread();
  return (
    <div className="livingThreadEntrance" data-lens={lens} data-thread-status={status}>
      <LivingThreadSurface
        thread={thread}
        lens={lens}
        onLensChange={onNavigateLens}
        onEnterStudio={onEnterStudio}
        onPlaceFragment={onPlaceFragment}
        onStandDown={onStandDown}
        memoryEvents={memoryEvents}
      />
    </div>
  );
}
