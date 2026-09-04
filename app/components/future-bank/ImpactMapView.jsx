"use client";

// Impact Map — one goal moves, the others move too. Not a dashboard: the
// live cross-goal relationships from the Life Thread, the month where
// plans are competing for the same money, and which links are being
// pushed right now by an active simulation.

import css from "../../showcase/fb.module.css";
import x from "./explore.module.css";
import { FutureBankDataProvider, useFutureBankData } from "./FutureBankDataProvider.jsx";
import { useTx } from "./i18n.jsx";

const money = (n) => `SGD ${Math.round(Number(n) || 0).toLocaleString("en-SG")}`;
const NODE_LABEL = { income: "Today", safety: "Safety", home: "Home", relationships: "Wedding", freedom: "Freedom", future: "Retirement" };
const cap = (s) => String(s || "").replace(/^\w/, (c) => c.toUpperCase());

export function ImpactMapView(props) {
  return (
    <FutureBankDataProvider enabled>
      <Inner {...props} />
    </FutureBankDataProvider>
  );
}

function Inner({ onBack, onStudio }) {
  const { tx } = useTx();
  const fb = useFutureBankData();
  const lt = fb.lifeThread ?? {};
  const edges = Array.isArray(lt.crossGoalEdges) ? lt.crossGoalEdges : [];
  const pw = lt.promiseWeight?.pressureWindow ?? null;
  const active = edges.filter((e) => e.direction && e.direction !== "flat");

  return (
    <div className={`${css.app} ${css.embedded}`}>
      <div className={css.shell}>
        <button type="button" className={css.backLink} onClick={onBack}>← {tx("Explore")}</button>
        <div>
          <h1 className={css.title}>{tx("Impact Map")}</h1>
          <p className={css.micro}>{tx("One goal changes, the others move with it. This is how your plans pull on each other right now.")}</p>
        </div>

        {pw && Number(pw.shortfall) > 0 ? (
          <div className={`${css.calmCard} ${x.impactHeadline}`}>
            <b>{tx("This month, your plans want more than is free")}</b>
            <span className={css.micro}>
              {(pw.driverCommitments ?? []).map((d) => tx(NODE_LABEL[d.domain] ?? cap(d.domain))).join(" + ")} {tx("need")} {money(pw.totalDemand)}/mo, {tx("but only")} {money(pw.freeCashflow)}/mo {tx("is free")} — {tx("a")} {money(pw.shortfall)}/mo {tx("gap")}.
            </span>
          </div>
        ) : (
          <div className={css.calmCard}>
            <b>{tx("No plan is pulling hard on another right now")}</b>
            <span className={css.micro}>{tx("Start a change in a Studio or Future Field and the links below light up with the size and direction of the pull.")}</span>
          </div>
        )}

        <section className={css.section}>
          <p className={css.kicker}>{active.length ? tx("Moving now") : tx("How your goals are linked")}</p>
          {(active.length ? active : edges).map((e, i) => (
            <button
              key={i}
              type="button"
              className={css.zoneRow}
              onClick={() => onStudio?.(e.from === "relationships" ? "wedding" : e.from)}
            >
              <span className={css.zoneMain}>
                <span className={css.zoneName}>
                  {tx(NODE_LABEL[e.from] ?? cap(e.from))} → {tx(NODE_LABEL[e.to] ?? cap(e.to))}
                </span>
                <span className={css.zoneSolves}>{tx(e.basis)}</span>
                {e.magnitude != null ? (
                  <span className={css.zoneOut}>
                    {e.direction === "down" ? "▼" : e.direction === "up" ? "▲" : "—"} {e.magnitude}{e.unit ? ` ${tx(e.unit)}` : ""}
                  </span>
                ) : null}
              </span>
              <span className={`${css.zoneStatus} ${e.direction && e.direction !== "flat" ? css.live : css.soon}`}>
                {e.direction === "down" ? tx("tightening") : e.direction === "up" ? tx("easing") : tx("steady")}
              </span>
            </button>
          ))}
        </section>

        <p className={css.micro}>{tx("Every number here is recomputed from your real accounts, plans and commitments — nothing is assumed.")}</p>
      </div>
    </div>
  );
}
