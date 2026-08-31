# FutureOS — deployment & operations

## Required environment

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres (Neon) pooled connection string. **Required.** |
| `DATABASE_URL_UNPOOLED` | Direct connection used by `scripts/migrate.mjs`. Recommended. |

## Optional provider flags (default: `unavailable`)

| Var | Values | Effect |
|---|---|---|
| `FUTUREOS_PAYMENT_PROVIDER` | `connected` / `sandbox` / `unavailable` | Enables Pay/Transfer/Scan&Pay capability. Without it these are `connection_required` and no external money moves. |
| `FUTUREOS_SGFINDEX` | `connected` / `unavailable` | Cross-bank connection. |
| `FUTUREOS_INSURER` | `connected` / `unavailable` | Insurance quotes. |
| `APP_COMMIT` / `VERCEL_GIT_COMMIT_SHA` | git sha | Shown by `/api/health`. |

`GET /api/readiness` reports missing required vars (keys only, never values).

## Deploy (Vercel)

1. Set the env vars above in the Vercel project (Production + Preview).
2. `npm run db:migrate` against the target database (`DATABASE_URL_UNPOOLED`).
   `scripts/migrate.sql` is idempotent (`create ... if not exists`) — safe to re-run.
3. Deploy. Next.js App Router, Node runtime for all `/api/*`.
4. Smoke check:
   - `GET /api/health` → `200 {status:"ok"}`
   - `GET /api/readiness` → `200 {ready:true}` (or `503` with `missingTables` / `missingEnv`)
   - Register → login → `GET /api/financial-twin` → add a manual account → reload → state persists.

## Migrations

- Forward: append to `scripts/migrate.sql`, run `npm run db:migrate`.
- All statements are `create ... if not exists` / `alter ... add column if not exists` / `create ... index if not exists` — no destructive DDL, no data rewrite.
- Rollback: there is no automated down-migration. To undo a table, `drop table if exists <name>` manually after confirming nothing depends on it. Data-affecting fixes should be a new forward migration.

## Backup / restore

Neon provides point-in-time restore. Before a risky migration, take a Neon branch/snapshot; restore by promoting the branch or running Neon's PITR.

## Rate limiting

`lib/http-guards.js` is an **in-memory, per-instance** limiter (auth / import / pay routes). For a multi-instance deployment replace the `buckets` Map with a shared store (Upstash Redis / Vercel KV). Flagged in the delivery report.

## Not connected (needs licensed partners + compliance)

Real deposit custody, external transfers, card issuance, KYC/AML, production fraud decisions, SGFinDex, insurer feeds, investment execution, loan approval. `/api/bank/pay` returns `status:"not_connected", canMoveMoney:false` for anything external and never fabricates a success.
