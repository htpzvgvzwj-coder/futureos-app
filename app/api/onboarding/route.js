import { getCurrentUserId } from "../../../lib/auth.js";
import {
  getOnboarding, setAccountType, advanceOnboarding, getConsent, setConsent,
  ACCOUNT_TYPES, CONSENT_SCOPES,
} from "../../../lib/account-control/store.js";
import { obj, enumOf, bool, parseOr400 } from "../../../lib/validate.js";

export const runtime = "nodejs";

// GET /api/onboarding -> where the user is in first-run setup + their
// consent grid. A brand-new user has no persona - status "not_started".
export async function GET(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const [onboarding, consent] = await Promise.all([getOnboarding(userId), getConsent(userId)]);
  return Response.json({ onboarding, consent });
}

const setTypeSchema = obj({ action: enumOf(["set_account_type"]), accountType: enumOf(ACCOUNT_TYPES) });
const consentSchema = obj({ action: enumOf(["set_consent"]), scope: enumOf(CONSENT_SCOPES), granted: bool() });
const advanceSchema = obj({ action: enumOf(["advance"]), step: enumOf(["account_type", "consent", "add_reality", "first_result", "complete"]) });

// POST /api/onboarding
export async function POST(request) {
  const userId = await getCurrentUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "set_account_type") {
      const { response, value } = parseOr400(setTypeSchema, body);
      if (response) return response;
      return Response.json({ onboarding: await setAccountType(userId, value.accountType) });
    }
    if (body.action === "set_consent") {
      const { response, value } = parseOr400(consentSchema, body);
      if (response) return response;
      return Response.json({ consent: await setConsent(userId, value.scope, value.granted) });
    }
    if (body.action === "advance") {
      const { response, value } = parseOr400(advanceSchema, body);
      if (response) return response;
      return Response.json({ onboarding: await advanceOnboarding(userId, value.step) });
    }
    return Response.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
