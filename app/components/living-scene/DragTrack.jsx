"use client";

// DragTrack - a pointer-draggable value track with a real handle, full
// keyboard control, and no motion. Used by every scene as the primary
// direct-manipulation affordance. Horizontal by default; `poles` labels the
// two ends (e.g. Breathing Room <-> Debt Weight).

import { useCallback, useRef } from "react";

export function DragTrack({ min = 0, max = 100, step = 1, value, onChange, ariaLabel, poles = null, fillFrom = "left", markers = [] }) {
  const ref = useRef(null);
  const span = Math.max(1, max - min);
  const pct = Math.min(100, Math.max(0, ((Number(value) - min) / span) * 100));

  const setFromClientX = useCallback(
    (clientX) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const raw = min + frac * span;
      const snapped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, snapped)));
    },
    [min, max, span, step, onChange],
  );

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e) => {
    if (e.buttons !== 1) return;
    setFromClientX(e.clientX);
  };
  const onKeyDown = (e) => {
    const big = (max - min) / 10;
    let next = Number(value);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next -= step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next += step;
    else if (e.key === "PageDown") next -= big;
    else if (e.key === "PageUp") next += big;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else return;
    e.preventDefault();
    onChange(Math.min(max, Math.max(min, Math.round(next / step) * step)));
  };

  return (
    <div className="lsDragWrap">
      {poles ? (
        <div className="lsDragPoles">
          <span>{poles[0]}</span>
          <span>{poles[1]}</span>
        </div>
      ) : null}
      <div
        ref={ref}
        className="lsDragTrack"
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        <div className="lsDragFill" style={fillFrom === "right" ? { right: 0, width: `${100 - pct}%` } : { left: 0, width: `${pct}%` }} />
        {markers.map((m) => (
          <span key={m.id} className="lsDragMarker" style={{ left: `${Math.min(100, Math.max(0, ((m.value - min) / span) * 100))}%` }} title={m.label} />
        ))}
        <div className="lsDragHandle" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}
