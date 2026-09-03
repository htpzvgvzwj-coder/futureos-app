"use client";

// One context carrying the current language + a gettext-style `tx()` for
// every Future Bank tab view. Provided once in app/page.jsx around the
// screen area; components read it with useTx(). Rendered outside the
// provider (e.g. a legacy screen), useTx() returns an identity `tx` so the
// English text shows unchanged.

import { createContext, useContext, useMemo } from "react";
import { makeTx } from "../../../lib/i18n/fb-ui.js";

const FbI18nCtx = createContext({ tx: (s) => s, language: "en" });

export function FutureBankI18n({ language = "en", children }) {
  const value = useMemo(() => ({ tx: makeTx(language), language }), [language]);
  return <FbI18nCtx.Provider value={value}>{children}</FbI18nCtx.Provider>;
}

export function useTx() {
  return useContext(FbI18nCtx);
}
