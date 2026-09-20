-- Garrison Market: fresh marketing/social subsystem.
-- IMPORTANT: this migration creates only the isolated marketing schema.
-- Existing public application/user/business data is intentionally untouched.

create schema if not exists marketing;

create table if not exists marketing.social_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('facebook','instagram')),
  provider_account_id text not null,
  account_name text,
  page_id text,
  instagram_business_account_id text,
  access_token_ciphertext text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active','expired','revoked','error')),
  metadata jsonb not null default '{}'::jsonb,
  connected_by_user_id integer references public."User"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_account_id)
);

create table if not exists marketing.content_drafts (
  id uuid primary key default gen_random_uuid(),
  title text,
  platform text not null check (platform in ('facebook','instagram','both')),
  content_type text not null default 'post',
  body text not null,
  media_urls text[] not null default '{}',
  hashtags text[] not null default '{}',
  call_to_action text,
  feature_focus text,
  generation_prompt text,
  generation_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  created_by_user_id integer references public."User"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketing.posts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references marketing.social_connections(id) on delete set null,
  draft_id uuid references marketing.content_drafts(id) on delete set null,
  platform text not null check (platform in ('facebook','instagram')),
  caption text,
  media_urls text[] not null default '{}',
  external_post_id text,
  status text not null default 'draft' check (status in ('draft','queued','scheduled','publishing','published','failed','cancelled')),
  scheduled_for timestamptz,
  published_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id integer references public."User"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketing.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  objective text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  start_at timestamptz,
  end_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_by_user_id integer references public."User"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketing.campaign_posts (
  campaign_id uuid not null references marketing.campaigns(id) on delete cascade,
  post_id uuid not null references marketing.posts(id) on delete cascade,
  primary key (campaign_id, post_id)
);

create table if not exists marketing.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_type text not null,
  action_type text not null,
  schedule text,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by_user_id integer references public."User"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketing.publishing_logs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references marketing.posts(id) on delete set null,
  connection_id uuid references marketing.social_connections(id) on delete set null,
  attempt_number integer not null default 1,
  action text not null,
  status text not null check (status in ('started','success','failed')),
  external_post_id text,
  http_status integer,
  response_excerpt text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists marketing.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references marketing.social_connections(id) on delete cascade,
  post_id uuid references marketing.posts(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram')),
  metric_date date not null,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  saves bigint not null default 0,
  clicks bigint not null default 0,
  video_views bigint not null default 0,
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists marketing.oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  provider text not null check (provider in ('facebook','instagram')),
  initiated_by_user_id integer references public."User"(id) on delete cascade,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists social_connections_status_idx on marketing.social_connections(status);
create index if not exists posts_scheduled_idx on marketing.posts(status, scheduled_for);
create index if not exists posts_connection_idx on marketing.posts(connection_id);
create index if not exists campaigns_status_idx on marketing.campaigns(status);
create index if not exists automations_due_idx on marketing.automations(enabled, next_run_at);
create index if not exists publishing_logs_post_idx on marketing.publishing_logs(post_id, created_at desc);
create index if not exists analytics_connection_date_idx on marketing.analytics_snapshots(connection_id, metric_date desc);
create index if not exists oauth_states_expiry_idx on marketing.oauth_states(expires_at);

alter table marketing.social_connections enable row level security;
alter table marketing.content_drafts enable row level security;
alter table marketing.posts enable row level security;
alter table marketing.campaigns enable row level security;
alter table marketing.campaign_posts enable row level security;
alter table marketing.automations enable row level security;
alter table marketing.publishing_logs enable row level security;
alter table marketing.analytics_snapshots enable row level security;
alter table marketing.oauth_states enable row level security;

comment on schema marketing is 'Private Garrison Market marketing/social subsystem. Access through trusted server-side code only.';
comment on table marketing.social_connections is 'Meta/Facebook/Instagram connections. OAuth access tokens are stored as ciphertext.';
comment on table marketing.oauth_states is 'Short-lived OAuth state records used to protect Meta connection flows.';
