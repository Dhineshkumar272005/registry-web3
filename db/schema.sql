-- Run against a dedicated Postgres database that holds user information only.
create table if not exists users (
  wallet     text primary key,          -- lowercase address
  data       bytea not null,            -- AES-256-GCM sealed JSON profile
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists nonces (
  wallet text primary key, nonce text not null, expires_at timestamptz not null
);
create table if not exists access_log (  -- who read whose profile, never the profile itself
  id bigserial primary key, trial_id int, patient text, researcher text, at timestamptz default now()
);
create table if not exists rate_limits (k text, win bigint, n int not null default 0, at timestamptz default now(), primary key (k, win));
-- Researcher details are user information (sealed). `verified` is set by an admin after checking them:
--   update researchers set verified = true where wallet = '0xlowercaseaddress';
create table if not exists researchers (
  wallet text primary key, data bytea not null, verified boolean not null default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
-- Public trial details (plain JSON, shown to every patient).
create table if not exists trial_meta (
  trial_id int primary key, researcher text not null, data jsonb not null, updated_at timestamptz default now()
);

-- ---- scaling: chain index, so reads never scan the ledger ----
create table if not exists trials (
  id int primary key, researcher text not null, title text not null, criteria jsonb not null,
  consents int not null default 0, open boolean not null default true, block bigint, created_at timestamptz default now()
);
create table if not exists consents (trial_id int not null, patient text not null, block bigint, tx text, primary key (trial_id, patient));
create table if not exists patients (wallet text primary key);
create table if not exists indexer_state (id int primary key, last_block bigint not null);
create index if not exists trials_researcher_idx on trials (researcher, id desc);
create index if not exists trials_open_idx on trials (open, id desc);
create index if not exists trials_title_fts on trials using gin (to_tsvector('simple', title));
create index if not exists consents_patient_idx on consents (patient);
create index if not exists trial_meta_condition_idx on trial_meta ((data->>'conditions'));
create index if not exists access_log_trial_idx on access_log (trial_id, at);
create index if not exists nonces_expiry_idx on nonces (expires_at);
create index if not exists rate_limits_at_idx on rate_limits (at);

-- ---- patient-controlled sharing, administration and audit ----
create table if not exists shares (trial_id int not null, patient text not null, sections jsonb not null, updated_at timestamptz default now(), primary key (trial_id, patient));
create table if not exists admin_log (id bigserial primary key, admin text not null, researcher text not null, action text not null, note text, at timestamptz default now());
create index if not exists admin_log_researcher_idx on admin_log (researcher, at);
