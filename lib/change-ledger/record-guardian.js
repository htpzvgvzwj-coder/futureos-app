// DB-aware Change Ledger recording for Guardian / evidence side events.
// Never throws.

import { recordEventSafe } from "./store.js";
import { buildRescueAdoptedEvent, buildQuoteImportedEvent, buildShadowEvent } from "./producers/guardian.js";

export async function recordRescueAdopted(args) {
  return recordEventSafe(buildRescueAdoptedEvent(args));
}

export async function recordQuoteImported(args) {
  return recordEventSafe(buildQuoteImportedEvent(args));
}

export async function recordShadowEvent(args) {
  return recordEventSafe(buildShadowEvent(args));
}
