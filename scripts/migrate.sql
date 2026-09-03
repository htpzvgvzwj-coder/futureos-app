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

-- Mirrors income_entries exactly - the real missing half of "the bank
-- shouldn't ask the customer for data it should already know". Once a
-- customer logs real monthly expenses, every real consumer of
-- profile.monthlyExpenses (getUserProfile's own smoothing, same real
-- technique already applied to monthlyIncome) picks up the real smoothed
-- figure for free, and a real expense trend (rising/falling, not a
-- guess) becomes computable the same way income growth already is.
create table if not exists expense_entries (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null,
  entry_month   text not null, -- 'YYYY-MM'
  amount        numeric not null,
  note          text,
  created_at    timestamptz not null default now(),
  unique (profile_key, entry_month)
);

create index if not exists expense_entries_profile_idx
  on expense_entries (profile_key, entry_month desc);

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

-- Customer Calibration Score: the customer's own optional counter-argument
-- at confirm time ("I'm proceeding despite this flagged risk because...").
-- Only set on confirm (lib/mirror-store.js confirmDebate), never at debate
-- generation - it only makes sense once the customer has actually committed
-- despite the named risk. Checked against the SAME real 90-day resolution
-- mirror-outcome-resolver.js already runs for the AI's own accountability
-- (resolved_outcome), never a separate/invented judgment of the text itself.
alter table mirror_debates add column if not exists customer_rebuttal text;

-- Joint Debate v2: the real second side of a joint dual-partner debate
-- (lib/joint-debate-context.js). Previously the partner's real numbers were
-- silently folded into the initiator's AI prompt with no real counterpart -
-- the partner never saw the debate, was never notified, never acted. Now:
-- partner_id is the real user found by getJointPartnerId at generation time
-- (who gets notified and who is allowed to respond - checked server-side,
-- never just "whoever guesses the debate id"); partner_rebuttal is the
-- partner's own real, typed input, not borrowed data; joint_synthesis is a
-- separate, later AI call that explicitly weighs both real people's actual
-- words, persisted alongside (never overwriting) the original judgeSynthesis
-- so the original debate's own accountability record stays intact.
alter table mirror_debates add column if not exists partner_id uuid;
alter table mirror_debates add column if not exists partner_rebuttal text;
alter table mirror_debates add column if not exists partner_rebuttal_at timestamptz;
alter table mirror_debates add column if not exists joint_synthesis text;
alter table mirror_debates add column if not exists joint_synthesis_alignment text; -- aligned | diverged
alter table mirror_debates add column if not exists joint_synthesis_at timestamptz;

create index if not exists mirror_debates_partner_idx
  on mirror_debates (partner_id, joint_synthesis_at)
  where partner_id is not null;

-- Joint action initiator visibility: previously the initiator of a
-- pause/reduce or joint plan-confirm proposal had zero real feedback after
-- proposing - no list of their own proposals, no notification when the
-- target confirmed or declined, and a decline carried no reason at all.
-- decline_reason is the target's own optional real explanation (never
-- required, never invented if they skip it); the initiator learns the
-- outcome via a real guardian_alerts row (alert_type 'joint_action_resolved',
-- lib/joint-action-store.js), the same notification channel
-- joint_debate_pending already established.
alter table joint_actions add column if not exists decline_reason text;

-- Future Comparison ("Time Machine") - two real, deterministic futures
-- (buy this now vs wait) for a purchase decision, computed from the
-- customer's real cashflow and every already-confirmed loan/investment on
-- file (lib/future-comparison-finance.js). Same shape/role as
-- decision_checks, no multi-turn lifecycle.
create table if not exists future_comparisons (
  id                uuid primary key default gen_random_uuid(),
  profile_key       text not null,
  description       text not null,
  amount            numeric(12,2) not null,
  recurring_monthly numeric(12,2) not null default 0,
  horizon_months    integer not null,
  numbers           jsonb not null,
  narrative         text not null,
  key_consideration text not null,
  mocked            boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists future_comparisons_profile_key_idx
  on future_comparisons (profile_key, created_at desc);

-- Family Travel - mirrors wedding_sessions/messages/artifacts exactly
-- (including the stage column, always "stage1" for now) so the shared
-- joint-action dispatcher (lib/goal-plan-actions.js) works with travel
-- with zero special-casing.
create table if not exists travel_sessions (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null,
  stage1_status text not null default 'in_progress', -- in_progress | confirmed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists travel_sessions_profile_key_idx
  on travel_sessions (profile_key);

create table if not exists travel_messages (
  id         bigserial primary key,
  session_id uuid not null references travel_sessions(id),
  stage      text not null,
  seq        integer not null,
  role       text not null,
  content    jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists travel_artifacts (
  id            bigserial primary key,
  session_id    uuid not null references travel_sessions(id),
  stage         text not null,
  artifact_type text not null, -- plan_options | confirmed_budget
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists travel_messages_session_stage_seq_idx
  on travel_messages (session_id, stage, seq);

-- SME Cash Flow Copilot - the business owner's own real recurring income/
-- expense events (lib/sme-cashflow-finance.js does a real day-by-day
-- simulation over these, never invented). One profile per customer,
-- updated in place - not a session/history lifecycle.
create table if not exists sme_cashflow_profiles (
  profile_key       text primary key,
  business_name     text not null,
  starting_cash     numeric(12,2) not null,
  events            jsonb not null,
  narrative         text not null,
  key_consideration text not null,
  mocked            boolean not null default false,
  updated_at        timestamptz not null default now()
);

-- SME Copilot v2: a real check-in loop, same shape as wedding/home/
-- retirement's savings checkins - the owner logs a real observed cash
-- balance on a real date, the server looks up what the forecast (saved
-- at the time) predicted for that same day, and stores both so accuracy
-- can be tracked over time without recomputing against events that may
-- have since changed.
create table if not exists sme_cashflow_checkins (
  id                bigserial primary key,
  profile_key       text not null,
  checkin_date      date not null,
  forecast_day      integer not null,
  predicted_balance numeric(12,2) not null,
  actual_balance    numeric(12,2) not null,
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists sme_cashflow_checkins_profile_idx
  on sme_cashflow_checkins (profile_key, checkin_date);

-- Home Goal Shift V2: a real, structured, revocable commitment - replaces
-- the AI-text "adopt this pace" submission for the Moment's primary
-- action. Distinct from home_artifacts' confirmed_savings_plan (which
-- stays the source of truth every existing consumer - Strategic Balance,
-- Loan Planner, simulatorInputs - already reads unchanged): this table
-- adds the structured fields those consumers don't need but Guardian's
-- pause/revoke/execution-status view does. One active commitment per
-- profile+domain at a time - a new commitment or a revoke supersedes the
-- previous one rather than mutating it in place, so the history stays a
-- real audit trail.
create table if not exists goal_commitments (
  id                              uuid primary key default gen_random_uuid(),
  profile_key                     text not null,
  domain                          text not null, -- 'home' (only domain today)
  monthly_contribution            numeric(12,2) not null,
  effective_month                 text not null, -- 'YYYY-MM'
  pause_if_emergency_months_below numeric(4,1) not null,
  source_moment                   jsonb not null, -- the real Moment snapshot that led to this decision, for later prediction-vs-actual comparison
  status                          text not null default 'active', -- active | revoked
  created_at                      timestamptz not null default now(),
  revoked_at                      timestamptz
);

create index if not exists goal_commitments_profile_domain_idx
  on goal_commitments (profile_key, domain, status, created_at desc);

-- Plan Runtime (commitment slice): revoke-consistency + duplicate-guard.
--
-- superseded_savings_plan is the confirmed_savings_plan payload that was in
-- force BEFORE this commitment adjusted it, captured verbatim at create
-- time. A revoke restores it exactly (lib/plan-runtime/commitment.js
-- buildRevertSavingsPlanPayload), so cancelling a commitment actually
-- propagates back through every downstream consumer instead of leaving
-- Guardian's adjusted amount stuck in Strategic Balance / Loan Planner /
-- hardship / follow-through. prior_monthly_contribution is the same fact as
-- a plain number, for quick audit reads.
alter table goal_commitments add column if not exists superseded_savings_plan jsonb;
alter table goal_commitments add column if not exists prior_monthly_contribution numeric(12,2);
-- Guardian Phase 3: a collision path or recovery step can pause a commitment
-- (status 'paused'); it drops out of the active/committed total until resumed.
alter table goal_commitments add column if not exists paused_at timestamptz;
alter table goal_commitments add column if not exists pause_reason text;

-- One active commitment per (profile, domain). A rapid double-submit, or a
-- second "adopt" before the first is revoked, must not leave two active
-- rows: revoke targets a single id, and getActiveCommitment / every
-- cross-goal read only sees the latest, so an older active row would linger
-- as an unrevoked, uncounted audit-trail liability. The insert path catches
-- the unique violation and returns a real 409 instead.
create unique index if not exists goal_commitments_one_active_per_domain
  on goal_commitments (profile_key, domain)
  where status = 'active';

-- Change Ledger: FutureOS's central, append-only causal record - "what
-- actually changed, why, and what it touched" for every meaningful action,
-- across every feature. NOT a dev log, notification feed, or click trail
-- (technical audit logging, if ever needed, stays a separate table). One
-- row per real state change; rows are never updated or deleted - a later
-- revoke/override writes a NEW row that points at the old one via
-- supersedes_event_id.
--
-- Every numeric field in cause/before/after/impact_set comes from a real
-- deterministic calculation at write time (lib/change-ledger + the calling
-- route), never from an AI. Snapshots are frozen: a later recomputation
-- must not be able to rewrite what a past event recorded.
create table if not exists change_ledger_events (
  id                  uuid primary key default gen_random_uuid(),
  profile_key         text not null,
  occurred_at         timestamptz not null default now(),
  actor               text not null,           -- user | guardian | system | partner
  source_feature      text not null,           -- wedding | home | mirror | life_graph | guardian | quote_to_plan | emergency | investment | ...
  action_type         text not null,           -- stable slug, see lib/change-ledger/events.js
  status              text not null,           -- projected | simulated | scheduled | active | paused | revoked | completed | observed
  plan_id             text,
  plan_branch_id      text,
  commitment_id       uuid,
  related_goal_ids    text[] not null default '{}',
  visibility          text not null default 'private', -- private | shared | system
  cause               jsonb not null default '{}',   -- the real datum / quote / rule / risk / user action that triggered this
  before_snapshot     jsonb not null default '{}',   -- minimal, explainable prior state
  after_snapshot      jsonb not null default '{}',   -- minimal, explainable new state
  impact_set          jsonb not null default '[]',   -- [{ goalId, metric, before, after, unit, ... }] - real computed deltas only
  evidence_refs       jsonb not null default '[]',   -- [{ kind, ref, sourceUpdatedAt }] - files, quotes, real data, provenance
  confidence          text,                    -- low | medium | high (null when not meaningful)
  uncertainty_note    text,                    -- honest reason an impact could NOT be quantified
  supersedes_event_id uuid references change_ledger_events(id),
  message_key         text not null,           -- i18n template key resolved by lib/change-ledger/format.js
  message_params      jsonb not null default '{}',
  dedupe_key          text,                    -- caller-supplied idempotency key; unique per profile when present
  created_at          timestamptz not null default now()
);

create index if not exists change_ledger_events_profile_time_idx
  on change_ledger_events (profile_key, occurred_at desc);

create index if not exists change_ledger_events_profile_feature_idx
  on change_ledger_events (profile_key, source_feature, occurred_at desc);

create index if not exists change_ledger_events_supersedes_idx
  on change_ledger_events (supersedes_event_id)
  where supersedes_event_id is not null;

-- Idempotency: a retried request / double-submit carrying the same
-- dedupe_key must not create a second ledger row. Partial so rows without a
-- key (legitimately distinct events) are unconstrained.
create unique index if not exists change_ledger_events_dedupe_idx
  on change_ledger_events (profile_key, dedupe_key)
  where dedupe_key is not null;

-- ============================================================================
-- Plan Runtime: the unified, auditable plan kernel.
--
-- Every goal in FutureOS (home / wedding / retirement / ...) gets ONE plan
-- row, which owns an append-only chain of immutable versions, a set of
-- branches (Future Field "Peel"), a set of constraints (Pins), and a set of
-- evidence entries (Evidence Radar / Quote-to-Plan). goal_commitments (added
-- earlier) stays as the sealed-commitment record and now also points back at
-- its plan. State always comes from lib/plan-runtime/state-machine.js's
-- PLAN_STATES; transitions are validated there before any write here.
--
-- Numbers in every snapshot/data/impact column are produced by a real
-- deterministic calculation at write time, never by an AI. Versions and
-- snapshots are frozen - a later recompute must never rewrite recorded
-- history.
-- ============================================================================

create table if not exists plans (
  id              uuid primary key default gen_random_uuid(),
  profile_key     text not null,
  domain          text not null,
  goal_key        text not null,
  title           text not null default '',
  state           text not null default 'draft',
  current_version text not null default '0',
  visibility      text not null default 'private',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists plans_profile_domain_goal_idx
  on plans (profile_key, domain, goal_key);
create index if not exists plans_profile_state_idx
  on plans (profile_key, state);

create table if not exists plan_versions (
  id                 uuid primary key default gen_random_uuid(),
  plan_id            uuid not null references plans(id),
  profile_key        text not null,
  version            text not null,
  supersedes_version text,
  actor              text not null,
  state_at_version   text not null,
  data               jsonb not null default '{}',
  cause              jsonb not null default '{}',
  evidence           jsonb not null default '[]',
  confidence         text,
  evidence_maturity_percent integer,
  uncertainty_note   text,
  ledger_event_id    uuid,
  created_at         timestamptz not null default now()
);

create unique index if not exists plan_versions_plan_version_idx
  on plan_versions (plan_id, version);
create index if not exists plan_versions_profile_idx
  on plan_versions (profile_key, created_at desc);

create table if not exists plan_branches (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references plans(id),
  profile_key       text not null,
  label             text not null,
  base_version      text not null,
  data              jsonb not null default '{}',
  delta             jsonb not null default '{}',
  feasibility       jsonb not null default '{}',
  status            text not null default 'open',
  sealed_commitment_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists plan_branches_plan_idx
  on plan_branches (plan_id, status);

create table if not exists plan_constraints (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null,
  plan_id       uuid references plans(id),
  kind          text not null,
  operator      text not null,
  value         numeric,
  value_text    text,
  scope         text not null default 'domain',
  active        boolean not null default true,
  cause         jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  released_at   timestamptz
);

create index if not exists plan_constraints_profile_active_idx
  on plan_constraints (profile_key, active);

create table if not exists plan_evidence (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references plans(id),
  profile_key    text not null,
  field          text not null,
  label          text not null default '',
  truthfulness   text not null default 'estimate',
  value          jsonb,
  range_low      numeric,
  range_high     numeric,
  required       boolean not null default false,
  impact_weight  integer not null default 0,
  source_kind    text,
  source_ref     text,
  source_updated_at timestamptz,
  valid_until    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists plan_evidence_plan_field_idx
  on plan_evidence (plan_id, field);

create table if not exists plan_transitions (
  id               uuid primary key default gen_random_uuid(),
  profile_key      text not null,
  from_plan_id     uuid not null references plans(id),
  to_plan_id       uuid references plans(id),
  transition_type  text not null,
  residual_amount  numeric,
  data             jsonb not null default '{}',
  status           text not null default 'proposed',
  ledger_event_id  uuid,
  created_at       timestamptz not null default now(),
  responded_at     timestamptz
);

create index if not exists plan_transitions_profile_idx
  on plan_transitions (profile_key, created_at desc);

create table if not exists guardian_policies (
  id               uuid primary key default gen_random_uuid(),
  profile_key      text not null,
  plan_id          uuid references plans(id),
  commitment_id    uuid,
  can_move_money   boolean not null default false,
  can_reschedule   boolean not null default false,
  can_notify       boolean not null default true,
  pause_conditions jsonb not null default '[]',
  reconfirm_after_days integer,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  revoked_at       timestamptz
);

create index if not exists guardian_policies_profile_active_idx
  on guardian_policies (profile_key, active);

alter table goal_commitments add column if not exists plan_id uuid;
alter table goal_commitments add column if not exists plan_branch_id uuid;

-- Living Thread commit 9: Family - Private Constellation.
-- Two INDEPENDENT participant identities per family plan. Neither
-- participant's private affordability numbers or per-item marks are ever
-- readable by the other - only the merged band and confirmation state.
create table if not exists family_plans (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references plans(id),
  created_by    text not null,
  invite_code   text unique,
  status        text not null default 'forming',   -- forming | both_joined | merged
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists family_plans_plan_idx on family_plans (plan_id);

create table if not exists family_participants (
  id              uuid primary key default gen_random_uuid(),
  family_plan_id  uuid not null references family_plans(id),
  participant_key text not null,                    -- an independent identity
  role            text not null default 'partner',  -- initiator | partner
  display_name    text not null default '',
  -- { affordableMin, affordableMax, marks: { itemId: mustKeep|flexible|undecided } }
  -- Written only by the owning participant; never returned to the other.
  private_view    jsonb not null default '{}',
  confirmed       boolean not null default false,
  confirmed_at    timestamptz,
  joined_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (family_plan_id, participant_key)
);

create index if not exists family_participants_plan_idx
  on family_participants (family_plan_id);

-- Living Thread (causal-spine round): DB-level idempotency for Seal. A
-- second confirm with the same client idempotency key can never create a
-- second active commitment.
create unique index if not exists goal_commitments_idempotency_key
  on goal_commitments ((source_moment->>'idempotencyKey'))
  where source_moment ? 'idempotencyKey' and status = 'active';

-- Living Thread (causal-spine round, blocker 3): at most ONE active branch
-- per plan. Two concurrent activate requests can never both win.
create unique index if not exists plan_branches_one_active_per_plan
  on plan_branches (plan_id)
  where status = 'active';

-- Living Thread (causal-spine round, blocker 4): Seal idempotency is
-- PER USER. Different users may reuse the same client key without
-- colliding.
drop index if exists goal_commitments_idempotency_key;
create unique index if not exists goal_commitments_idempotency_key_v2
  on goal_commitments (profile_key, (source_moment->>'idempotencyKey'))
  where source_moment ? 'idempotencyKey' and status = 'active';

-- ============================================================
-- Future Bank (PR #15 feat/future-bank-surface): the canonical
-- Bank Reality tables. profile_key holds users.id. Money columns
-- are numeric(18,2) - exact decimal, no float drift. Every row
-- carries source_type (+ as_of) so a system estimate can never be
-- read as a bank fact. See lib/financial-twin/* and
-- lib/transaction-ledger/*.
-- ============================================================

create table if not exists bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  profile_key    text not null,
  kind           text not null,
  display_name   text not null default '',
  institution    text,
  currency       text not null default 'SGD',
  masked_number  text,
  is_liability   boolean not null default false,
  credit_limit   numeric(18,2),
  goal_domain    text,
  status         text not null default 'active',
  source_type    text not null default 'user_confirmed',
  source_name    text,
  opened_at      timestamptz,
  as_of          timestamptz not null default now(),
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists bank_accounts_profile_idx on bank_accounts (profile_key, status);

create table if not exists bank_transactions (
  id                   uuid primary key default gen_random_uuid(),
  profile_key          text not null,
  account_id           uuid not null references bank_accounts(id),
  direction            text not null,
  amount               numeric(18,2) not null check (amount >= 0),
  currency             text not null default 'SGD',
  original_amount      numeric(18,2),
  original_currency    text,
  fx_rate              numeric(20,8),
  status               text not null default 'posted',
  category             text,
  channel              text,
  merchant             text,
  counterparty_masked  text,
  reference            text,
  transfer_id          text,
  reversal_of          uuid references bank_transactions(id),
  is_internal_transfer boolean not null default false,
  is_card_repayment    boolean not null default false,
  recurring_group      text,
  idempotency_key      text,
  source_type          text not null default 'user_confirmed',
  authorised_at        timestamptz,
  posted_at            timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists bank_transactions_account_idx
  on bank_transactions (account_id, coalesce(posted_at, authorised_at, created_at) desc);
create index if not exists bank_transactions_profile_idx
  on bank_transactions (profile_key, created_at desc);
create index if not exists bank_transactions_recurring_idx
  on bank_transactions (profile_key, recurring_group) where recurring_group is not null;
create unique index if not exists bank_transactions_idempotency_idx
  on bank_transactions (profile_key, idempotency_key, direction, account_id)
  where idempotency_key is not null;

create table if not exists financial_assets (
  id                uuid primary key default gen_random_uuid(),
  profile_key       text not null,
  asset_class       text not null,
  label             text not null default '',
  linked_account_id uuid references bank_accounts(id),
  currency          text not null default 'SGD',
  current_value     numeric(18,2) not null default 0,
  available_value   numeric(18,2),
  liquidity_class   text not null default 'liquid',
  restricted_purpose text,
  owner_type        text not null default 'self',
  ownership_percent numeric(6,3) not null default 100,
  source_type       text not null default 'user_confirmed',
  source_name       text,
  confidence        text not null default 'medium',
  is_user_confirmed boolean not null default true,
  as_of             timestamptz not null default now(),
  last_synced_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists financial_assets_profile_idx on financial_assets (profile_key, asset_class);

create table if not exists liabilities (
  id                 uuid primary key default gen_random_uuid(),
  profile_key        text not null,
  liability_class    text not null,
  label              text not null default '',
  linked_account_id  uuid references bank_accounts(id),
  currency           text not null default 'SGD',
  current_balance    numeric(18,2) not null default 0,
  original_principal numeric(18,2),
  apr                numeric(6,3),
  minimum_monthly    numeric(18,2),
  next_due_date      date,
  owner_type         text not null default 'self',
  ownership_percent  numeric(6,3) not null default 100,
  source_type        text not null default 'user_confirmed',
  as_of              timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists liabilities_profile_idx on liabilities (profile_key, liability_class);

create table if not exists income_streams (
  id               uuid primary key default gen_random_uuid(),
  profile_key      text not null,
  label            text not null default '',
  kind             text not null default 'salary',
  monthly_amount   numeric(18,2) not null default 0,
  currency         text not null default 'SGD',
  pay_day_of_month smallint,
  next_expected_date date,
  source_type      text not null default 'user_confirmed',
  detected_from_account_id uuid references bank_accounts(id),
  active           boolean not null default true,
  as_of            timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists income_streams_profile_idx on income_streams (profile_key, active);

create table if not exists recurring_obligations (
  id              uuid primary key default gen_random_uuid(),
  profile_key     text not null,
  label           text not null default '',
  kind            text not null default 'subscription',
  merchant        text,
  monthly_amount  numeric(18,2) not null default 0,
  currency        text not null default 'SGD',
  cadence         text not null default 'monthly',
  next_due_date   date,
  recurring_group text,
  category        text,
  source_type     text not null default 'system_estimated',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists recurring_obligations_profile_idx on recurring_obligations (profile_key, active);

create table if not exists ripple_events (
  id             uuid primary key default gen_random_uuid(),
  profile_key    text not null,
  kind           text not null,
  domain         text,
  cause          text not null default '',
  monthly_delta  numeric(18,2),
  affected_goals jsonb not null default '[]',
  state          text not null default 'possible',
  severity       text not null default 'information',
  dedupe_key     text,
  source_ref     jsonb not null default '{}',
  snapshot_id    text,
  superseded_by  uuid references ripple_events(id),
  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists ripple_events_profile_idx on ripple_events (profile_key, occurred_at desc);
create unique index if not exists ripple_events_dedupe_idx
  on ripple_events (profile_key, dedupe_key)
  where dedupe_key is not null and state <> 'superseded' and state <> 'revoked';

-- ============================================================
-- Usable Release Candidate (feat/usable-release-candidate):
-- onboarding, consent, lifecycle roles, import batches, audit.
-- profile_key holds users.id. All `create ... if not exists`.
-- ============================================================

create table if not exists user_onboarding (
  profile_key     text primary key,
  account_type    text not null default 'individual',  -- individual|youth|guardian_managed_child|household
  status          text not null default 'started',     -- started|consent_done|reality_added|complete
  step            text not null default 'account_type',
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One row per consent scope the customer explicitly granted / revoked.
create table if not exists consent_records (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null,
  scope         text not null,   -- account_data|transaction_data|assets_liabilities|planning_data|shared_data|guardian_monitoring
  granted       boolean not null,
  required      boolean not null default false,
  version       text not null default 'v1',
  source        text not null default 'onboarding',
  created_at    timestamptz not null default now()
);
create index if not exists consent_records_profile_idx on consent_records (profile_key, scope, created_at desc);

-- Lifecycle / shared-access roles. account_owner is implicit (the user
-- themselves); rows here are grants TO other identities.
create table if not exists lifecycle_roles (
  id              uuid primary key default gen_random_uuid(),
  profile_key     text not null,          -- whose data
  subject_key     text,                   -- who holds the role (a users.id) - null for a placeholder
  role            text not null,          -- account_owner|guardian|dependent|household_member|trusted_contact|beneficiary_placeholder
  scope           text not null default 'view',  -- view|contribute|suggest|approve|manage|revoke
  status          text not null default 'active',  -- active|pending|revoked
  legal_confirmation_required boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  revoked_at      timestamptz
);
create index if not exists lifecycle_roles_profile_idx on lifecycle_roles (profile_key, status);
create index if not exists lifecycle_roles_subject_idx on lifecycle_roles (subject_key, status);

-- CSV import batches - so an import can be shown as a receipt and rolled
-- back atomically, and the same file can't be imported twice.
create table if not exists import_batches (
  id              uuid primary key default gen_random_uuid(),
  profile_key     text not null,
  account_id      uuid references bank_accounts(id),
  file_name       text not null default '',
  file_hash       text not null,          -- sha256 of the raw bytes
  row_count       integer not null default 0,
  imported_count  integer not null default 0,
  skipped_count   integer not null default 0,
  status          text not null default 'previewed',  -- previewed|committed|rolled_back|failed
  mapping         jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  committed_at    timestamptz,
  rolled_back_at  timestamptz
);
create unique index if not exists import_batches_dedupe_idx
  on import_batches (profile_key, file_hash)
  where status = 'committed';
alter table bank_transactions add column if not exists import_batch_id uuid references import_batches(id);
create index if not exists bank_transactions_import_batch_idx on bank_transactions (import_batch_id) where import_batch_id is not null;

-- Append-only audit trail for account-control + guardian decisions.
create table if not exists audit_events (
  id            uuid primary key default gen_random_uuid(),
  profile_key   text not null,
  actor_key     text,                     -- who did it (may differ from profile_key for guardian actions)
  kind          text not null,            -- consent_granted|consent_revoked|data_exported|account_delete_requested|import_committed|import_rolled_back|guardian_decision|role_granted|role_revoked
  detail        jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists audit_events_profile_idx on audit_events (profile_key, created_at desc);

-- Soft account-deletion request (a real deletion runs a cascade + may be
-- subject to a legal retention window).
create table if not exists account_deletions (
  profile_key   text primary key,
  requested_at  timestamptz not null default now(),
  status        text not null default 'requested',  -- requested|processing|completed|held_for_compliance
  reason        text,
  completed_at  timestamptz
);

-- Usable Release UI: account recovery (email delivery needs a provider;
-- the token mechanism + reset flow are real).
create table if not exists password_reset_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists password_reset_tokens_user_idx on password_reset_tokens (user_id);

-- Money Moments (Explore = the visible output surface). The MoneyMoment
-- objects themselves are DERIVED each request by lib/money-moments/build.js
-- from the Financial Twin, Life Thread, Ripple and Change Ledger - this
-- table holds only their LIFECYCLE, keyed by a stable moment_key. A
-- resolved/snoozed moment is re-opened automatically when its evidence
-- hash changes (the underlying signal became true again).
create table if not exists money_moment_state (
  profile_key    text not null,
  moment_key     text not null,          -- stable key from the aggregator (e.g. "rescue:payment_failed:<txnId>")
  state          text not null default 'new',  -- new|reviewed|snoozed|resolved
  evidence_hash  text,                   -- sha1 of the moment's evidence at the time of the last user action
  snoozed_until  timestamptz,
  last_action    text,                   -- reviewed|snoozed|resolved|reopened|acknowledged
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (profile_key, moment_key)
);
create index if not exists money_moment_state_profile_idx on money_moment_state (profile_key, updated_at desc);

-- ============================================================
-- Phase 6 - lifecycle / Care Circle & Handoff.
-- The Care Circle rows carry who the person is and which parts of your
-- money they are noted for. The handoff plan is a WRITTEN plan only -
-- status is always 'described'; Future Bank never executes it.
-- ============================================================
alter table lifecycle_roles add column if not exists relation_label text;
alter table lifecycle_roles add column if not exists note text;
alter table lifecycle_roles add column if not exists covers jsonb not null default '[]';

create table if not exists care_handoff_plans (
  profile_key       text primary key,
  kind              text not null default 'general',    -- general|retirement|incapacity
  successor_role_id uuid references lifecycle_roles(id) on delete set null,
  successor_label   text,
  trigger_note      text,
  instructions      text,
  status            text not null default 'described',  -- always 'described' - never executed by the app
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- Phase 6 Round 2 - authorization / approval queue.
-- On a youth/child account (or when the owner sets an amount rule) a real
-- money move creates a PENDING request instead of executing. A holder of
-- an approve-scoped role decides it; on approve the move executes from the
-- stored payload. Every step is audited + in the Change Ledger.
-- ============================================================
create table if not exists authorization_policies (
  profile_key              text primary key,
  restricted_need_approval boolean not null default true,  -- youth/child restricted actions need approval
  approval_over_amount     numeric,                        -- any money move over this needs approval (null = off)
  updated_at               timestamptz not null default now()
);

create table if not exists authorization_requests (
  id                 uuid primary key default gen_random_uuid(),
  profile_key        text not null,
  kind               text not null,          -- internal_transfer | card_repayment
  summary            text not null,
  amount             numeric,
  currency           text not null default 'SGD',
  payload            jsonb not null default '{}',   -- enough to execute the move on approve
  reason             text,                   -- why approval was needed
  status             text not null default 'pending', -- pending|approved|declined|cancelled|executed|expired
  decided_by_role_id uuid references lifecycle_roles(id) on delete set null,
  decided_by         text,                   -- 'guardian' | 'owner'
  decision_note      text,
  created_at         timestamptz not null default now(),
  decided_at         timestamptz,
  executed_at        timestamptz,
  expires_at         timestamptz not null default (now() + interval '14 days')
);
create index if not exists authorization_requests_profile_idx on authorization_requests (profile_key, status, created_at desc);

-- ============================================================
-- Phase 6 Round 3 - real cross-user linking for Care.
-- A one-time invite code links a placeholder lifecycle_roles row to a real
-- second person (their users.id lands in subject_key, status -> active).
-- Only the sha256 of the code is stored; either party can revoke; every
-- cross-account action is audited with actor_key = the guardian.
-- ============================================================
create table if not exists care_invites (
  id           uuid primary key default gen_random_uuid(),
  profile_key  text not null,                       -- the account owner who created the invite
  role_id      uuid references lifecycle_roles(id) on delete cascade,
  role         text not null,
  scope        text not null default 'view',
  code_hash    text not null unique,                -- sha256(code) - the code itself is never stored
  status       text not null default 'open',        -- open | accepted | revoked | expired
  accepted_by  text,                                -- users.id who accepted
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  expires_at   timestamptz not null default (now() + interval '14 days')
);
create index if not exists care_invites_profile_idx on care_invites (profile_key, status);
create index if not exists care_invites_code_idx on care_invites (code_hash) where status = 'open';

-- ============================================================
-- Phase 6 Round 5 - Guardian mechanics (allowance, cooling-off, two-person,
-- decline reasons, per-guardian covers routing, nudges, age transitions).
-- ============================================================
-- per-link auto-approve ceiling the owner delegates to one guardian
alter table lifecycle_roles add column if not exists auto_approve_weekly numeric;  -- null = off
-- how the account handles a move that needs approval, + a two-person rule
alter table authorization_policies add column if not exists mode text not null default 'approval'; -- approval | cooling_off
alter table authorization_policies add column if not exists cooling_off_hours integer not null default 48;
alter table authorization_policies add column if not exists require_both boolean not null default false;
-- state for the new request flows
alter table authorization_requests add column if not exists auto_execute_at timestamptz;    -- cooling_off deadline
alter table authorization_requests add column if not exists owner_confirmed_at timestamptz; -- two-person: owner's half
alter table authorization_requests add column if not exists auto_reason text;               -- within_allowance | cooling_off_elapsed
alter table authorization_requests add column if not exists covers text;                    -- money area, for guardian routing

-- an owner pushes one specific thing to a linked person to look at; auto-expires
create table if not exists care_nudges (
  id           uuid primary key default gen_random_uuid(),
  profile_key  text not null,            -- the owner
  role_id      uuid references lifecycle_roles(id) on delete cascade,  -- who it is for
  subject_key  text not null,            -- that person's users.id (denormalised for the reader)
  title        text not null,
  detail       text,
  ref          jsonb not null default '{}',   -- { kind, id } - a moment / plan / request
  status       text not null default 'open', -- open | seen | done | expired
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days')
);
create index if not exists care_nudges_subject_idx on care_nudges (subject_key, status);

-- owner-defined ranges shared with household members (never exact amounts)
create table if not exists care_shared_ranges (
  id           uuid primary key default gen_random_uuid(),
  profile_key  text not null,
  category     text not null,        -- rent | groceries | transport | savings | ...
  low          numeric not null,
  high         numeric not null,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (profile_key, category)
);
create index if not exists care_shared_ranges_profile_idx on care_shared_ranges (profile_key);

-- youth account age-transition proposals: rule-triggered, owner-confirmed
create table if not exists care_transitions (
  id           uuid primary key default gen_random_uuid(),
  profile_key  text not null,
  milestone    text not null,            -- turns_16 | turns_18 | custom
  proposes     jsonb not null default '{}',   -- { restrictedNeedApproval?, approvalOverAmount?, accountType? }
  rationale    text not null,
  status       text not null default 'proposed', -- proposed | applied | dismissed
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create index if not exists care_transitions_profile_idx on care_transitions (profile_key, status);
-- an optional birth year to drive the milestone proposals (year only - not a full DOB)
alter table user_onboarding add column if not exists birth_year integer;

-- ============================================================
-- Guardian round 2 (protection layer) - the Guardian Contract.
-- One row per capability the user has moved off its default level.
-- level: watch | ask | act. A fixed set can never reach 'act'
-- (enforced in lib/guardian/contract.js, not here).
-- ============================================================
create table if not exists guardian_contracts (
  profile_key  text not null,
  capability   text not null,
  level        text not null default 'ask',   -- watch | ask | act
  updated_at   timestamptz not null default now(),
  primary key (profile_key, capability)
);
