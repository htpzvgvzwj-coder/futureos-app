// Environment validation (Usable RC, section 十八). Called by
// /api/readiness and importable at startup. Reports missing / misconfigured
// vars WITHOUT ever echoing their values.

const REQUIRED = ["DATABASE_URL"];
const RECOMMENDED = ["DATABASE_URL_UNPOOLED"];
const OPTIONAL_PROVIDERS = [
  "FUTUREOS_PAYMENT_PROVIDER", // connected|sandbox|unavailable
  "FUTUREOS_SGFINDEX",
  "FUTUREOS_INSURER",
  "APP_COMMIT",
  "VERCEL_GIT_COMMIT_SHA",
];

export function checkEnv(env = process.env) {
  const missingRequired = REQUIRED.filter((k) => !env[k]);
  const missingRecommended = RECOMMENDED.filter((k) => !env[k]);
  const providers = Object.fromEntries(
    ["FUTUREOS_PAYMENT_PROVIDER", "FUTUREOS_SGFINDEX", "FUTUREOS_INSURER"].map((k) => [
      k.replace("FUTUREOS_", "").toLowerCase(),
      env[k] ?? "unavailable",
    ]),
  );
  return {
    ok: missingRequired.length === 0,
    missingRequired,
    missingRecommended,
    providers,
    // never include values - just which keys are present
    present: [...REQUIRED, ...RECOMMENDED, ...OPTIONAL_PROVIDERS].filter((k) => Boolean(env[k])),
  };
}

// Throws at startup if a required var is missing (call from a server-only
// module if you want hard-fail behaviour).
export function assertEnv(env = process.env) {
  const r = checkEnv(env);
  if (!r.ok) throw new Error(`Missing required environment variables: ${r.missingRequired.join(", ")}`);
  return r;
}
