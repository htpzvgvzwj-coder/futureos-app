create extension if not exists pgcrypto;

-- Real multi-user auth (PDR-013 follow-up: FutureOS was single-user, "karina-demo"
-- hardcoded everywhere, until this table set + scripts/seed-demo-user.mjs migrated
-- existing demo data to a real account). Every domain table's profile_key column
-- stays plain text and now holds a real users.id (uuid) string - zero schema change
-- needed on any of them.
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  display_name  text not null,
  created_at    timestamptz not null default now()
);

create table if not exists user_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  token_hash   text not null unique, -- sha256 of the opaque cookie token; raw token never persisted
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);

create index if not exists user_sessions_user_id_idx on user_sessions (user_id);

-- Real user-to-user consent/sharing (six-list idea #3: adult child monitoring a
-- parent's account, or a couple sharing visibility on joint goals). Two-sided by
-- design (pending -> grantee accepts/declines), not silent access. grant_type and
-- access_level are deliberately wider than what's enforced today: 'external_provider'
-- and 'view_and_act' are reserved for later (see PDR-013 and app code comments) so
-- adding them doesn't require another migration, but nothing reads them as true yet.
create table if not exists access_grants (
  id                uuid primary key default gen_random_uuid(),
  grantor_user_id   uuid not null references users(id),
  grantee_user_id   uuid references users(id),
  grant_type        text not null default 'user', -- 'user' (built) | 'external_provider' (reserved, unbuilt)
  scope             text not null, -- 'all' | 'wedding' | 'home' | 'retirement' | ... (domain-scoped)
  access_level      text not null, -- 'view' | 'view_and_act' (only 'view' is ever enforced)
  status            text not null default 'pending', -- 'pending' | 'active' | 'revoked' | 'declined'
  granted_at        timestamptz not null default now(),
  responded_at      timestamptz,
  revoked_at        timestamptz,
  expires_at        timestamptz
);

create index if not exists access_grants_grantor_idx on access_grants (grantor_user_id, status);
create index if not exists access_grants_grantee_idx on access_grants (grantee_user_id, status);

-- Joint write-permission (access_level = 'view_and_act'): the grantee never acts
-- alone. Proposing an action creates a pending row here; it only actually executes
-- once the OTHER party (target_user_id, whose data it affects) separately confirms
-- via app/api/joint-actions/[id]/confirm. Deliberately not "the initiator's action
-- takes effect immediately, target just gets notified" - real dual consent.
create table if not exists joint_actions (
  id                 uuid primary key default gen_random_uuid(),
  grant_id           uuid not null references access_grants(id),
  initiator_user_id  uuid not null references users(id),
  target_user_id     uuid not null references users(id),
  domain             text not null, -- wedding | home | retirement
  action_type        text not null, -- pause_goal_plan | reduce_goal_plan (only these dispatch today)
  payload            jsonb not null,
  status             text not null default 'pending', -- pending | confirmed | declined
  created_at         timestamptz not null default now(),
  confirmed_at       timestamptz
);

create index if not exists joint_actions_target_idx on joint_actions (target_user_id, status);
create index if not exists joint_actions_initiator_idx on joint_actions (initiator_user_id, status);

-- Server-side mirror of the client's `preferences` blob, so logging into the same
-- account on a second device sees real data instead of that device's empty
-- localStorage cache. localStorage stays as the fast local cache (written first,
-- synced here in the background) - this table is the source of truth across devices.
create table if not exists user_preferences (
  user_id     uuid primary key references users(id),
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists wedding_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null default 'karina-demo',
  stage1_status text not null default 'in_progress', -- in_progress | confirmed
  stage2_status text not null default 'not_started', -- not_started | in_progress | confirmed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists wedding_messages (
  id           bigserial primary key,
  session_id   uuid not null references wedding_sessions(id),
  stage        text not null, -- stage1 | stage2
  seq          integer not null,
  role         text not null, -- user | assistant
  content      jsonb not null,
  created_at   timestamptz not null default now()
);

create table if not exists wedding_artifacts (
  id            bigserial primary key,
  session_id    uuid not null references wedding_sessions(id),
  stage         text not null,
  artifact_type text not null, -- plan_options | confirmed_budget | savings_plan_options | confirmed_savings_plan
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists wedding_messages_session_stage_seq_idx
  on wedding_messages (session_id, stage, seq);

create index if not exists wedding_artifacts_session_stage_type_idx
  on wedding_artifacts (session_id, stage, artifact_type, created_at desc);

create unique index if not exists wedding_sessions_profile_key_idx
  on wedding_sessions (profile_key);

create table if not exists wedding_savings_checkins (
  id            bigserial primary key,
  session_id    uuid not null references wedding_sessions(id),
  checkin_month text not null, -- "YYYY-MM"
  amount        numeric(12,2) not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists wedding_savings_checkins_session_idx
  on wedding_savings_checkins (session_id, checkin_month);

create table if not exists other_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null default 'karina-demo',
  stage1_status text not null default 'in_progress', -- in_progress | confirmed
  stage2_status text not null default 'not_started', -- not_started | in_progress | confirmed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists other_messages (
  id           bigserial primary key,
  session_id   uuid not null references other_sessions(id),
  stage        text not null, -- stage1 | stage2
  seq          integer not null,
  role         text not null, -- user | assistant
  content      jsonb not null,
  created_at   timestamptz not null default now()
);

create table if not exists other_artifacts (
  id            bigserial primary key,
  session_id    uuid not null references other_sessions(id),
  stage         text not null,
  artifact_type text not null, -- plan_options | confirmed_goal_plan | savings_plan_options | confirmed_savings_plan
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists other_messages_session_stage_seq_idx
  on other_messages (session_id, stage, seq);

create index if not exists other_artifacts_session_stage_type_idx
  on other_artifacts (session_id, stage, artifact_type, created_at desc);

create unique index if not exists other_sessions_profile_key_idx
  on other_sessions (profile_key);

create table if not exists other_savings_checkins (
  id            bigserial primary key,
  session_id    uuid not null references other_sessions(id),
  checkin_month text not null, -- "YYYY-MM"
  amount        numeric(12,2) not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists other_savings_checkins_session_idx
  on other_savings_checkins (session_id, checkin_month);

create table if not exists home_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null default 'karina-demo',
  stage1_status text not null default 'in_progress', -- in_progress | confirmed
  stage2_status text not null default 'not_started', -- not_started | in_progress | confirmed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists home_messages (
  id           bigserial primary key,
  session_id   uuid not null references home_sessions(id),
  stage        text not null, -- stage1 | stage2
  seq          integer not null,
  role         text not null, -- user | assistant
  content      jsonb not null,
  created_at   timestamptz not null default now()
);

create table if not exists home_artifacts (
  id            bigserial primary key,
  session_id    uuid not null references home_sessions(id),
  stage         text not null,
  artifact_type text not null, -- plan_options | confirmed_plan | savings_plan_options | confirmed_savings_plan
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists home_messages_session_stage_seq_idx
  on home_messages (session_id, stage, seq);

create index if not exists home_artifacts_session_stage_type_idx
  on home_artifacts (session_id, stage, artifact_type, created_at desc);

create unique index if not exists home_sessions_profile_key_idx
  on home_sessions (profile_key);

create table if not exists home_savings_checkins (
  id            bigserial primary key,
  session_id    uuid not null references home_sessions(id),
  checkin_month text not null, -- "YYYY-MM"
  amount        numeric(12,2) not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists home_savings_checkins_session_idx
  on home_savings_checkins (session_id, checkin_month);

create table if not exists retirement_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null default 'karina-demo',
  stage1_status text not null default 'in_progress', -- in_progress | confirmed
  stage2_status text not null default 'not_started', -- not_started | in_progress | confirmed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists retirement_messages (
  id           bigserial primary key,
  session_id   uuid not null references retirement_sessions(id),
  stage        text not null, -- stage1 | stage2
  seq          integer not null,
  role         text not null, -- user | assistant
  content      jsonb not null,
  created_at   timestamptz not null default now()
);

create table if not exists retirement_artifacts (
  id            bigserial primary key,
  session_id    uuid not null references retirement_sessions(id),
  stage         text not null,
  artifact_type text not null, -- plan_options | confirmed_plan | savings_plan_options | confirmed_savings_plan
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists retirement_messages_session_stage_seq_idx
  on retirement_messages (session_id, stage, seq);

create index if not exists retirement_artifacts_session_stage_type_idx
  on retirement_artifacts (session_id, stage, artifact_type, created_at desc);

create unique index if not exists retirement_sessions_profile_key_idx
  on retirement_sessions (profile_key);

create table if not exists retirement_savings_checkins (
  id            bigserial primary key,
  session_id    uuid not null references retirement_sessions(id),
  checkin_month text not null, -- "YYYY-MM"
  amount        numeric(12,2) not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists retirement_savings_checkins_session_idx
  on retirement_savings_checkins (session_id, checkin_month);

create table if not exists hardship_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null default 'karina-demo',
  stage1_status text not null default 'in_progress', -- in_progress | assessed
  stage2_status text not null default 'not_started', -- not_started | in_progress | proposed | applied
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists hardship_messages (
  id           bigserial primary key,
  session_id   uuid not null references hardship_sessions(id),
  stage        text not null, -- stage1 (assessment) | stage2 (recovery actions)
  seq          integer not null,
  role         text not null, -- user | assistant
  content      jsonb not null,
  created_at   timestamptz not null default now()
);

create table if not exists hardship_artifacts (
  id            bigserial primary key,
  session_id    uuid not null references hardship_sessions(id),
  stage         text not null,
  artifact_type text not null, -- hardship_assessment | proposed_recovery_actions
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists hardship_messages_session_stage_seq_idx
  on hardship_messages (session_id, stage, seq);

create index if not exists hardship_artifacts_session_stage_type_idx
  on hardship_artifacts (session_id, stage, artifact_type, created_at desc);

create unique index if not exists hardship_sessions_profile_key_idx
  on hardship_sessions (profile_key);

-- Audit trail of cross-domain writes: what the Emergency screen displays as
-- "here's what we changed and why," independent of any one domain's own data.
create table if not exists hardship_actions_applied (
  id                   bigserial primary key,
  hardship_session_id  uuid not null references hardship_sessions(id),
  action_type          text not null, -- pause_goal_plan | drawdown_emergency_fund | invest_excess | other_ocbc_support
  target_domain        text, -- wedding | home | retirement | null
  amount               numeric(12,2),
  explanation          text not null,
  applied_at           timestamptz not null default now(),
  status               text not null default 'applied' -- applied | failed | pending_review | rejected
);

create index if not exists hardship_actions_applied_session_idx
  on hardship_actions_applied (hardship_session_id, applied_at desc);

-- Four-state approval record (approve | edit | reject), not just applied/not-applied.
-- proposed_amount is Guardian's original suggestion; amount is what actually got applied
-- (equal for "approve", customer-modified for "edit", null for "reject"). This is the raw
-- material for a future Follow-Through Score "judgment/calibration" dimension: did the
-- customer's edits hold up, and does Guardian re-propose things it already knows were rejected.
alter table hardship_actions_applied add column if not exists decision_type text not null default 'approve'; -- approve | edit | reject
alter table hardship_actions_applied add column if not exists decision_reason text;
alter table hardship_actions_applied add column if not exists proposed_amount numeric(12,2);

-- Future Mirror's Bull/Bear/Judge debate (replaces the old single-voice scenario
-- engine). Every run is persisted, not just confirmed ones - bear_risk_tag is the
-- raw material for a future job that checks whether the flagged risk actually
-- happened and feeds that back into Guardian Reputation Score.
create table if not exists mirror_debates (
  id                  uuid primary key default gen_random_uuid(),
  profile_key         text not null default 'karina-demo',
  goal_type           text not null,
  situation           text,
  future_score        integer not null,
  risk_level          text not null, -- low | medium | high
  bull_case           text not null,
  bear_case           text not null,
  bear_risk_tag       text not null, -- income_disruption | rate_increase | expense_shock | timeline_slip | market_downturn | other
  judge_synthesis     text not null,
  recommended_action  text not null, -- proceed | proceed_with_adjustment | wait | reconsider
  confidence          text not null, -- low | medium | high
  confirmed           boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists mirror_debates_profile_idx
  on mirror_debates (profile_key, created_at desc);

-- Closes the debate's accountability loop: did the bear case's flagged risk actually
-- happen? Checked against real hardship evidence (the only real "did something bad
-- happen" signal this app has), not invented. resolved_outcome stays null until
-- there's either real evidence the risk materialized or enough real activity to
-- conclude it didn't - never guessed.
alter table mirror_debates add column if not exists confirmed_at timestamptz;
alter table mirror_debates add column if not exists resolved_outcome text; -- risk_materialized | risk_did_not_materialize | insufficient_signal
alter table mirror_debates add column if not exists resolved_at timestamptz;

-- Real trace of what fed this debate: the customer's raw inputs, the
-- server-computed feasibility numbers, and which AI provider actually
-- answered (anthropic/groq/gemini - the fallback chain means it isn't always
-- anthropic). Saved verbatim at generation time, never recomputed after the
-- fact. Nullable: rows created before this column existed have no trace,
-- which is honest - that snapshot was never captured and can't be rebuilt.
alter table mirror_debates add column if not exists context jsonb;
alter table mirror_debates add column if not exists ai_provider text;

-- Bull's direct response to bearCase's specific named risk, before the
-- Judge's synthesis - a real rebuttal round instead of two isolated
-- one-shot paragraphs. Nullable: rows created before this existed have none.
alter table mirror_debates add column if not exists bull_rebuttal text;

create table if not exists loan_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null default 'karina-demo',
  purpose       text not null, -- home | renovation | personal (| education | car, future)
  stage1_status text not null default 'in_progress', -- in_progress | confirmed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One active loan session per (customer, purpose) — a customer can have a
-- confirmed renovation loan AND a confirmed home loan at once, unlike other
-- domains' single profile_key-only session.
create unique index if not exists loan_sessions_profile_key_purpose_idx
  on loan_sessions (profile_key, purpose);

create table if not exists loan_messages (
  id           bigserial primary key,
  session_id   uuid not null references loan_sessions(id),
  stage        text not null, -- stage1 (sizing conversation) — no stage2, a loan has no "save up first" phase
  seq          integer not null,
  role         text not null, -- user | assistant
  content      jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists loan_messages_session_stage_seq_idx
  on loan_messages (session_id, stage, seq);

create table if not exists loan_artifacts (
  id            bigserial primary key,
  session_id    uuid not null references loan_sessions(id),
  stage         text not null,
  artifact_type text not null, -- sizing_options | confirmed_loan
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists loan_artifacts_session_stage_type_idx
  on loan_artifacts (session_id, stage, artifact_type, created_at desc);

create table if not exists investment_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null default 'karina-demo',
  stage1_status text not null default 'in_progress', -- in_progress | confirmed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists investment_sessions_profile_key_idx
  on investment_sessions (profile_key);

create table if not exists investment_messages (
  id           bigserial primary key,
  session_id   uuid not null references investment_sessions(id),
  stage        text not null, -- stage1 only (narrative conversation) — the purchase-mode/amount
                               -- pick itself is a structured confirm, no stage2, same "no save-up-
                               -- first phase" reasoning as loan_messages
  seq          integer not null,
  role         text not null, -- user | assistant
  content      jsonb not null,
  created_at   timestamptz not null default now()
);

create index if not exists investment_messages_session_stage_seq_idx
  on investment_messages (session_id, stage, seq);

create table if not exists investment_artifacts (
  id            bigserial primary key,
  session_id    uuid not null references investment_sessions(id),
  stage         text not null,
  artifact_type text not null, -- intake | shortlist | narrative | confirmed_investment_pick
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists investment_artifacts_session_stage_type_idx
  on investment_artifacts (session_id, stage, artifact_type, created_at desc);

-- One row per customer, created the first time anything reads it (see
-- lib/relationship-store.js's getOrCreateJourneyStart) - a real, permanent,
-- backend-recorded anchor for "when did our relationship begin," so the
-- Shared Journey section on Home always has a genuine first entry instead
-- of a confusing empty state on a customer's very first visit.
create table if not exists relationship_milestones (
  id           uuid primary key default gen_random_uuid(),
  profile_key  text not null,
  started_at   timestamptz not null default now()
);

create unique index if not exists relationship_milestones_profile_key_idx
  on relationship_milestones (profile_key);

-- Mirror's point-of-decision "Quick Verdict" tool (see lib/decision-finance.js). No sessions or
-- messages table, unlike every AI-conversation domain above — each check is a single deterministic
-- verdict plus a short AI narration, not a multi-turn conversation, so one row per check is enough.
create table if not exists decision_checks (
  id                uuid primary key default gen_random_uuid(),
  profile_key       text not null default 'karina-demo',
  description       text not null,
  amount            numeric(12,2) not null,
  recurring_monthly numeric(12,2) not null default 0,
  verdict           text not null, -- go_ahead | proceed_with_caution | reconsider
  numbers           jsonb not null,
  narrative         text not null,
  key_consideration text not null,
  mocked            boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists decision_checks_profile_key_idx
  on decision_checks (profile_key, created_at desc);

-- Event-triggered dynamic micro-insurance (the "insurance" item in Cross-Bank Data Integration's
-- concept preview, made real): triggered when a new loan is confirmed and the customer's declared
-- coverage no longer covers total liabilities. A precisely-sized, precisely-timed top-up offer, not
-- a full new annual policy - see lib/micro-insurance-finance.js.
create table if not exists micro_insurance_offers (
  id                uuid primary key default gen_random_uuid(),
  profile_key       text not null default 'karina-demo',
  trigger_purpose   text not null, -- home | renovation | personal
  gap_amount        numeric(12,2) not null,
  duration_months   integer not null,
  monthly_premium   numeric(10,2) not null,
  total_premium     numeric(10,2) not null,
  status            text not null default 'offered', -- offered | accepted | dismissed
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now()
);

create index if not exists micro_insurance_offers_profile_key_idx
  on micro_insurance_offers (profile_key, created_at desc);

-- Portable, verifiable financial-health credential (the "turn proof of financial health into a
-- portable credential" idea): a fixed, server-stored snapshot + hash issued at a point in time, so
-- anyone the customer shares the credential ID with can re-fetch the ORIGINAL issued snapshot from
-- OCBC and compare it against whatever the customer showed them - see lib/credential-store.js.
create table if not exists credentials (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null default 'karina-demo',
  snapshot      jsonb not null,
  content_hash  text not null,
  issued_at     timestamptz not null default now()
);

create index if not exists credentials_profile_key_idx
  on credentials (profile_key, issued_at desc);

-- Real income history for the income-smoothing feature (lib/income-finance.js):
-- unlike the *_savings_checkins tables (cumulative contributions toward a goal,
-- one profile can have many), this is one real number PER MONTH per customer -
-- a correction to an already-logged month is expected, not an edge case, so
-- unlike checkins this uses an upsert (see lib/income-store.js) instead of a
-- plain insert.
create table if not exists income_entries (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null,
  entry_month   text not null, -- 'YYYY-MM'
  amount        numeric not null,
  note          text,
  created_at    timestamptz not null default now(),
  unique (profile_key, entry_month)
);

create index if not exists income_entries_profile_idx
  on income_entries (profile_key, entry_month desc);

-- AI confidence -> real human escalation: when Mirror's own Judge synthesis
-- comes back with confidence "low" (the AI itself flagging genuine
-- uncertainty, not a UI-only label), the customer can request a real
-- Relationship Manager follow-up on that specific debate. Recorded on the
-- debate's own row (same pattern as confirmed/confirmed_at above) rather
-- than a separate table, since it's an action taken on one specific debate.
alter table mirror_debates add column if not exists escalation_requested boolean not null default false;
alter table mirror_debates add column if not exists escalation_requested_at timestamptz;

-- "Decode This": one row per document a customer had FutureOS explain. No
-- sessions/messages table, same reasoning as decision_checks above - a
-- single one-shot read, not a multi-turn conversation. extracted_text is the
-- real text pdf.js pulled from the customer's own PDF (never the raw PDF
-- binary - this app has no file-storage backend and doesn't need one),
-- capped client-side to 20000 chars before it ever reaches this table.
create table if not exists document_reviews (
  id                uuid primary key default gen_random_uuid(),
  profile_key       text not null,
  document_type     text not null, -- loan_agreement | insurance_pds | tenancy_agreement | offer_letter | other
  extracted_text    text not null,
  summary           text not null,
  flagged_clauses   jsonb not null,
  key_facts         jsonb not null,
  created_at        timestamptz not null default now()
);

create index if not exists document_reviews_profile_idx
  on document_reviews (profile_key, created_at desc);

-- Mirror's chat interface: one continuous thread per customer, unlike
-- wedding/home/etc's sessions (no `stage` column here - there's only one
-- ongoing conversation, not a stage1/stage2 split). Mirrors
-- wedding_sessions/wedding_messages' exact shape otherwise (lib/wedding-
-- store.js) - same seq-ordered message log pattern.
create table if not exists mirror_chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists mirror_chat_sessions_profile_key_idx
  on mirror_chat_sessions (profile_key);

create table if not exists mirror_chat_messages (
  id           bigserial primary key,
  session_id   uuid not null references mirror_chat_sessions(id),
  seq          integer not null,
  role         text not null, -- user | assistant
  content      jsonb not null,
  -- Real run_debate results actually executed during this assistant turn
  -- (see lib/chat-tool-loop.js) - `content` alone only holds the model's
  -- FINAL text/tool_use blocks, not the intermediate real tool_result that
  -- happened mid-loop, so without this a reloaded chat would show the
  -- narration but lose the actual rich debate card data. Null for user
  -- messages and assistant turns that never ran a tool.
  tool_results jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists mirror_chat_messages_session_seq_idx
  on mirror_chat_messages (session_id, seq);

-- The table above already existed (created earlier this session) before
-- tool_results was added to its definition - create table if not exists is
-- a no-op against an existing table, so the column needs its own explicit
-- alter to actually land on the real database.
alter table mirror_chat_messages add column if not exists tool_results jsonb;

-- "Why did I say that?" for chat replies - the same principle as
-- mirror_debates.context (P1, earlier this session), applied per chat turn:
-- the real baseInputs/language the system prompt was built from for this
-- specific assistant reply. Null for user messages.
alter table mirror_chat_messages add column if not exists context jsonb;

-- Asset Profile (资产台账): one row per itemized asset entry across the
-- customer's 8 fixed categories (see lib/asset-taxonomy.js for the closed
-- category/subtype lists - category and subtype are always validated
-- server-side against that taxonomy before a row is written here, never
-- free text). `value` is the customer's own stated amount - null for
-- non-monetary categories 4-8 items that were left unvalued (e.g. "learning
-- ability" has a strength rating but no dollar figure). `details` holds the
-- category-specific structured fields (liquidity/risk for financial,
-- ownerDependency for business, etc.) as flexible jsonb, same convention as
-- mirror_debates.context above - this app has no per-category tables, one
-- shared shape keeps the store/API/taxonomy validation single-sourced.
create table if not exists assets (
  id               uuid primary key default gen_random_uuid(),
  profile_key      text not null,
  category         text not null,
  subtype          text not null,
  name             text not null,
  value            numeric,
  strength_rating  smallint,
  details          jsonb not null default '{}',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists assets_profile_category_idx
  on assets (profile_key, category);

-- Real, persisted, screen-independent proactive alert - before this,
-- nothing in the app could surface "the customer should know this" outside
-- of them opening a specific screen. Created deterministically (see
-- lib/cross-goal-context.js's checkCrossGoalRisk) right after any domain
-- confirms a new commitment, if the customer's real total committed
-- monthly outflow (or an already-confirmed loan's real Future Score)
-- crosses a real threshold. Surfaced on Home (app/page.jsx's
-- HomeDashboard), not buried inside Guardian.
create table if not exists guardian_alerts (
  id             uuid primary key default gen_random_uuid(),
  profile_key    text not null,
  alert_type     text not null, -- cross_goal_risk (only type today)
  domain         text,          -- which goal's confirm triggered this
  severity       text not null, -- monitoring | atRisk
  detail         jsonb not null, -- real numbers from checkCrossGoalRisk
  status         text not null default 'open', -- open | dismissed
  created_at     timestamptz not null default now(),
  dismissed_at   timestamptz
);

create index if not exists guardian_alerts_profile_status_idx
  on guardian_alerts (profile_key, status, created_at desc);
