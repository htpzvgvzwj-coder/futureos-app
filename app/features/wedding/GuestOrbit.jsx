"use client";

// Guest Orbit - guests as circles, not a list. Adjust a circle and the
// total, per-head cost, and the cross-goal projection all recompute
// through the real Future Field branch API.

import { useMemo, useState } from "react";

const CIRCLES = [
  { key: "core", weight: 0.28 },
  { key: "family", weight: 0.34 },
  { key: "friends", weight: 0.22 },
  { key: "optional", weight: 0.1 },
  { key: "travel", weight: 0.04 },
  { key: "special", weight: 0.02 },
];

function splitFromTotal(total) {
  const out = {};
  let used = 0;
  CIRCLES.forEach((c, i) => {
    const v = i === CIRCLES.length - 1 ? Math.max(0, total - used) : Math.round(total * c.weight);
    out[c.key] = v;
    used += v;
  });
  return out;
}

function sgd(n) {
  return `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
}

export function GuestOrbit({ field, t, peel, busy }) {
  const realityGuests = Number(field?.realityPath?.data?.guest_count) || 0;
  const [circles, setCircles] = useState(() => splitFromTotal(realityGuests));
  const [applied, setApplied] = useState(null);

  const total = useMemo(() => Object.values(circles).reduce((a, b) => a + b, 0), [circles]);
  const changed = total !== realityGuests;

  const perGuest = field?.realityPath?.feasibility?.perGuest ?? null;
  const estDelta = perGuest != null ? (total - realityGuests) * perGuest : null;

  const setCircle = (key, value) => {
    const v = Math.max(0, Math.min(400, Number(value) || 0));
    setCircles((c) => ({ ...c, [key]: v }));
  };

  const apply = async () => {
    const r = await peel({ guest_count: total }, t("weddingLivingPlan.guestOrbit.branchLabel", { count: total }));
    if (r.ok) {
      const branch = (r.data && r.data.branch) || null;
      setApplied({ branchId: branch?.id ?? null, impacts: branch?.projectedImpacts ?? null, count: total });
    }
  };

  return (
    <section className="wlpView wlpGuestOrbit" aria-labelledby="guestOrbitTitle">
      <h3 id="guestOrbitTitle">{t("weddingLivingPlan.guestOrbit.title")}</h3>
      <p className="wlpMuted">{t("weddingLivingPlan.guestOrbit.help")}</p>

      <div className="wlpOrbitRings">
        {CIRCLES.map((c) => (
          <label key={c.key} className="wlpOrbitRing">
            <span>{t(`weddingLivingPlan.guestOrbit.circle.${c.key}`)}</span>
            <input
              type="range"
              min="0"
              max={c.key === "family" || c.key === "friends" ? 120 : 60}
              step="1"
              value={circles[c.key]}
              onChange={(e) => setCircle(c.key, e.target.value)}
              aria-label={t(`weddingLivingPlan.guestOrbit.circle.${c.key}`)}
            />
            <input
              type="number"
              min="0"
              max="400"
              value={circles[c.key]}
              onChange={(e) => setCircle(c.key, e.target.value)}
              aria-label={t("weddingLivingPlan.guestOrbit.exactCount", { circle: t(`weddingLivingPlan.guestOrbit.circle.${c.key}`) })}
              className="wlpOrbitNum"
            />
          </label>
        ))}
      </div>

      <div className="wlpOrbitTotal">
        <strong>{t("weddingLivingPlan.guestOrbit.total", { count: total })}</strong>
        {changed && estDelta != null ? (
          <span className={estDelta < 0 ? "wlpDown" : "wlpUp"}>
            {estDelta < 0 ? "−" : "+"}
            {sgd(Math.abs(estDelta))} {t("weddingLivingPlan.guestOrbit.estVenueChange")}
          </span>
        ) : null}
      </div>

      <button type="button" className="primaryButton" onClick={apply} disabled={busy || !changed}>
        {t("weddingLivingPlan.guestOrbit.apply")}
      </button>

      {applied ? (
        <div className="wlpAppliedImpact" role="status">
          <p>
            <strong>{t("weddingLivingPlan.guestOrbit.appliedTo", { count: applied.count })}</strong>
          </p>
          {applied.impacts ? (
            <ul>
              <li>
                {t("weddingLivingPlan.impact.wedding", {
                  before: sgd(applied.impacts.wedding.totalBefore),
                  after: sgd(applied.impacts.wedding.totalAfter),
                })}
              </li>
              {applied.impacts.cashflow.before != null ? (
                <li>
                  {t("weddingLivingPlan.impact.cashflow", {
                    freed: sgd(Math.abs(applied.impacts.cashflow.freed)),
                    dir: applied.impacts.cashflow.freed >= 0 ? t("weddingLivingPlan.impact.freed") : t("weddingLivingPlan.impact.needed"),
                  })}
                </li>
              ) : null}
              {applied.impacts.home ? (
                <li>
                  {t("weddingLivingPlan.impact.home", {
                    months: Math.abs(applied.impacts.home.monthsDelta ?? 0),
                    dir: t(`weddingLivingPlan.impact.dir.${applied.impacts.home.direction}`),
                  })}
                </li>
              ) : null}
              <li className={applied.impacts.emergency.direction === "down" ? "wlpWarn" : ""}>
                {t("weddingLivingPlan.impact.emergency", {
                  before: applied.impacts.emergency.bufferBefore,
                  after: applied.impacts.emergency.bufferAfter,
                })}
              </li>
            </ul>
          ) : (
            <p className="wlpMuted">{t("weddingLivingPlan.impact.pending")}</p>
          )}
          {applied.impacts ? (
            <p className="wlpMuted">
              {t("weddingLivingPlan.impact.confidence", { level: applied.impacts.confidence })}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
