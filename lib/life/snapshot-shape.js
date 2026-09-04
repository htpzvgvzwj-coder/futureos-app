// The pure shape helpers for Life Thread snapshots — safe to import from a
// client component (no DB). The DB read/write lives in ./snapshot.js.

const num = (v) => (v == null || v === "" ? null : Number(v));

// The minimal, renderable shape stored in life_thread_snapshots.thread.
// Feed it the output of buildLivingThread(...).
export function compactThread(thread = {}) {
  return {
    direction: thread.direction ?? null,
    directionKey: thread.directionKey ?? null,
    directionParams: thread.directionParams ?? null,
    weather: thread.weather ? { id: thread.weather.id, label: thread.weather.label } : null,
    numbers: Array.isArray(thread.numbers)
      ? thread.numbers.map((n) => ({ id: n.id, label: n.label, value: n.value ?? null }))
      : [],
    nodes: Array.isArray(thread.nodes)
      ? thread.nodes.map((n) => ({ id: n.id, label: n.label, state: n.state, valueText: n.valueText ?? null, note: n.note ?? null }))
      : [],
  };
}

// Pull the three headline figures out of a compact thread.
export function figuresFrom(ct = {}) {
  const by = Object.fromEntries((ct.numbers ?? []).map((n) => [n.id, n.value]));
  const money = (s) => {
    const m = /([\d,]+(?:\.\d+)?)/.exec(String(s ?? ""));
    return m ? Number(m[1].replace(/,/g, "")) : null;
  };
  return {
    free_monthly: money(by.free),
    committed_monthly: money(by.committed),
    safety_months: money(by.safety),
  };
}

// "What moved" between a stored snapshot row and now.
export function movedBetween(snapshotRow, nowFigures) {
  if (!snapshotRow) return [];
  const out = [];
  const pairs = [
    ["free_monthly", "Free each month", "sgd"],
    ["committed_monthly", "Promised to your future", "sgd"],
    ["safety_months", "Safety buffer", "months"],
  ];
  for (const [k, label, unit] of pairs) {
    const a = num(snapshotRow[k]);
    const b = num(nowFigures?.[k]);
    if (a == null || b == null || a === b) continue;
    out.push({ label, unit, then: a, now: b });
  }
  return out;
}
