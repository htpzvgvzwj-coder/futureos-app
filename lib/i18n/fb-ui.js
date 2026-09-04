// Future Bank UI strings — gettext-style: the English text IS the key. A
// missing translation falls back to that English literal, so a gap here
// can never break the English UI.
//
// Two lookup paths:
//   • a flat English string  -> lib/i18n/fb-ui.<lang>.json
//   • a dotted namespace key (e.g. "changeLedger.event.commitment_paused.
//     headline") -> the app-wide locales/<lang>.json, so a builder can emit
//     a Change Ledger message key and the Future Bank UI resolves it too.
//
// `{name}` placeholders in the result are filled from `params`.

import zh from "./fb-ui.zh.json" with { type: "json" };
import ms from "./fb-ui.ms.json" with { type: "json" };
import ta from "./fb-ui.ta.json" with { type: "json" };
import enLocale from "../../locales/en.json" with { type: "json" };
import zhLocale from "../../locales/zh.json" with { type: "json" };
import msLocale from "../../locales/ms.json" with { type: "json" };
import taLocale from "../../locales/ta.json" with { type: "json" };

const DICTS = { zh, ms, ta };
const LOCALES = { en: enLocale, zh: zhLocale, ms: msLocale, ta: taLocale };

export const FB_LANGUAGES = ["en", "zh", "ms", "ta"];

// dotted key with no spaces: foo.bar or foo.bar.baz — an app-wide locale path
const NS_KEY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/;

function lookup(src, key) {
  return key.split(".").reduce((v, k) => (v == null ? v : v[k]), src);
}
function fill(t, params) {
  return String(t).replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? "" : String(params[k])));
}

// makeTx(language) -> tx(key, params?)
export function makeTx(language) {
  const dict = DICTS[language] || null;
  const locale = LOCALES[language] || null;
  return (s, params) => {
    if (s == null) return s;
    let t;
    if (NS_KEY.test(s)) {
      t = (locale && lookup(locale, s)) ?? lookup(LOCALES.en, s) ?? s;
    } else {
      t = (dict && Object.prototype.hasOwnProperty.call(dict, s) && dict[s]) || s;
    }
    return params ? fill(t, params) : t;
  };
}
