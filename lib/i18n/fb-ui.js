// Future Bank UI strings — gettext-style: the English text IS the key. A
// missing translation falls back to that English literal, so a gap here
// can never break the English UI. Parametrised prose ("About SGD 600 a
// month is free…") is not handled here — that stays in its builder.
//
// Keep the JSON dictionaries flat: { "English source string": "translation" }.

import zh from "./fb-ui.zh.json" with { type: "json" };
import ms from "./fb-ui.ms.json" with { type: "json" };
import ta from "./fb-ui.ta.json" with { type: "json" };

const DICTS = { zh, ms, ta };

export const FB_LANGUAGES = ["en", "zh", "ms", "ta"];

// makeTx(language) -> tx(englishString, params?) -> localized string (or
// the English string unchanged for `en` / an unknown language / a missing
// key). When `params` is given, `{name}` placeholders in the result are
// filled from it — the English key doubles as the `en` template, so the
// dictionary entry for another language must keep the same placeholders.
export function makeTx(language) {
  const dict = DICTS[language] || null;
  return (s, params) => {
    if (s == null) return s;
    const t = (dict && Object.prototype.hasOwnProperty.call(dict, s) && dict[s]) || s;
    if (!params) return t;
    return String(t).replace(/\{(\w+)\}/g, (_, k) => (params[k] == null ? "" : String(params[k])));
  };
}
