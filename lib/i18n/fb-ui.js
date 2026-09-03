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

// makeTx(language) -> tx(englishString) -> localized string (or the
// English string unchanged for `en` / an unknown language / a missing key).
export function makeTx(language) {
  const dict = DICTS[language] || null;
  return (s) => {
    if (s == null) return s;
    return (dict && Object.prototype.hasOwnProperty.call(dict, s) && dict[s]) || s;
  };
}
