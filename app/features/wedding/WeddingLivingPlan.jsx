"use client";

// Wedding Living Plan - the flagship vertical. It IS a Future Field: the
// wedding, the home deposit and the emergency fund on one time axis, the
// couple's real cashflow behind it. Every variable the customer changes
// (date, guests, venue, budget, monthly amount, partner split) recomputes
// through the real Future Field solver/API and moves the other goals.
//
// This surface is deliberately thin - it composes the shared Future Field
// canvas with a Wedding framing. The Wedding-specific math lives in
// lib/future-field/adapters.js (weddingAdapter); the cross-goal impact and
// the reality path come from lib/future-field/service.js.

import { FutureFieldCanvas } from "../../components/future-field-canvas.jsx";

export function WeddingLivingPlan({ t, setActiveScreen, language = "en" }) {
  return (
    <FutureFieldCanvas
      t={t}
      setActiveScreen={setActiveScreen}
      language={language}
      domain="wedding"
      backTo="mirror"
      titleKey="weddingLivingPlan.title"
      subtitleKey="weddingLivingPlan.subtitle"
    />
  );
}
