"use client";

// Explore - intent-first. One natural field: "What do you want to change?"
// Deterministic routing (intent-router.js) picks a Studio and SAYS which
// and why; a low-confidence read asks one clarification. It never creates
// or seals a plan. "Continue your future" comes from the server Life
// Thread's activePlans / activeDrafts - never a sessionStorage key.

import { useMemo, useState } from "react";
import { useLifeThread } from "../../components/life-thread/LifeThreadProvider.jsx";
import { useBankData } from "../../components/bank/useBankData.jsx";
import { ExploreCatalog } from "../../components/bank/ExploreCatalog.jsx";
import { CurrentRippleStrip } from "../../components/bank/CurrentRippleStrip.jsx";
import { routeIntent } from "./intent-router.js";

const DOMAIN_SCREEN = {
  loan: "repaymentPath",
  retirement: "futureLifeTimeline",
  travel: "tripOrbit",
  investment: "capitalPaths",
  insurance: "protectionEnvelope",
  family: "familyConstellation",
  wedding: "weddingLivingPlan",
  home: "homeHorizon",
  emergency: "emergencyRunway",
};

function Screen({ children, className }) {
  return <section className={`screen ${className ?? ""}`}>{children}</section>;
}

export function ExploreScreen({ setActiveScreen, t }) {
  const { thread, status } = useLifeThread();
  const { ripple } = useBankData();
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const activeDomains = useMemo(() => {
    const a = new Set();
    for (const p of thread?.activePlans ?? []) a.add(p.domain);
    for (const d of thread?.activeDrafts ?? []) a.add(d.domain);
    return [...a];
  }, [thread]);

  const result = useMemo(() => (submitted ? routeIntent(text, { activeDomains }) : null), [submitted, text, activeDomains]);

  // "Continue your future" - server truth, most-recent draft first, then a
  // sealed plan that has room to keep going.
  const continueTarget = useMemo(() => {
    const draft = (thread?.activeDrafts ?? [])
      .slice()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
    if (draft && DOMAIN_SCREEN[draft.domain]) return { domain: draft.domain, screen: DOMAIN_SCREEN[draft.domain], kind: "draft" };
    const plan = (thread?.activePlans ?? [])[0];
    if (plan && DOMAIN_SCREEN[plan.domain]) return { domain: plan.domain, screen: DOMAIN_SCREEN[plan.domain], kind: "plan" };
    return null;
  }, [thread]);

  const tp = thread?.nextTurningPoint ?? null;
  const pw = thread?.promiseWeight ?? null;
  const tension = tp?.whyNowKey
    ? t(tp.whyNowKey, tp.whyNowParams)
    : pw && pw.status && pw.status !== "calm"
      ? t(`explore.tension.${pw.status}`)
      : null;

  const go = (screen) => setActiveScreen(screen);

  return (
    <Screen className="exploreMoment">
      <header className="exploreMomentHead">
        <p className="exploreFieldEyebrow">{t("explore.eyebrow")}</p>
      </header>

      {continueTarget ? (
        <button type="button" className="exploreContinue" onClick={() => go(continueTarget.screen)}>
          <span className="exploreContinueLabel">{t("explore.continue")}</span>
          <span className="exploreContinueName">{t(`explore.route.${continueTarget.domain}`)}</span>
        </button>
      ) : null}

      {tension ? <p className="exploreTension">{tension}</p> : null}

      <form
        className="exploreIntent"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
      >
        <label htmlFor="exploreIntentInput">{t("explore.question")}</label>
        <input
          id="exploreIntentInput"
          type="text"
          value={text}
          placeholder={t("explore.placeholder")}
          onChange={(e) => {
            setText(e.target.value);
            setSubmitted(false);
          }}
          autoComplete="off"
        />
        <button type="submit" className="lsPrimaryBtn" disabled={!text.trim()}>
          {t("explore.goIntent")}
        </button>
      </form>

      {result ? (
        result.confidence === "high" && result.pick ? (
          <div className="exploreRouted">
            <p className="exploreRoutedWhy">
              {t("explore.routedTo", { studio: t(result.pick.labelKey) })} · {t(result.pick.whyKey)}
            </p>
            <button type="button" className="lsPrimaryBtn" onClick={() => go(result.pick.screen)}>
              {t("explore.openStudio", { studio: t(result.pick.labelKey) })}
            </button>
          </div>
        ) : result.matches.length ? (
          <div className="exploreClarify">
            <p>{t("explore.clarify")}</p>
            <div className="exploreClarifyChips">
              {result.matches.map((m) => (
                <button key={m.id} type="button" className="exploreFieldMoreBtn" onClick={() => go(m.screen)}>
                  {t(m.labelKey)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="exploreNoMatch">{t("explore.noMatch")}</p>
        )
      ) : null}

      <button type="button" className="linkButton exploreFieldTalk" onClick={() => go("exploreChat")}>
        {t("explore.talkItThrough")}
      </button>

      <CurrentRippleStrip ripple={ripple} compact onAction={(a) => a === "compare" && go("mirror")} />

      {/* The complete capability directory - always visible, no drawer. */}
      <ExploreCatalog onOpen={(screen) => go(screen)} activeDomains={activeDomains} t={t} />

      {status === "error" ? <p className="lsProvenance">{t("explore.threadUnavailable")}</p> : null}
    </Screen>
  );
}
