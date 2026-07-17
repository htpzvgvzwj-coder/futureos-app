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
