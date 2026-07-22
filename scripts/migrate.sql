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
