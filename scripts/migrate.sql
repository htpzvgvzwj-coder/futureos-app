create extension if not exists pgcrypto;

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
  status               text not null default 'applied' -- applied | failed | pending_review
);

create index if not exists hardship_actions_applied_session_idx
  on hardship_actions_applied (hardship_session_id, applied_at desc);

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
