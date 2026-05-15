create table if not exists public.stage_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  stage_id text not null,
  model_provider text not null,
  model_id text not null,
  skill_version_id uuid references public.agent_skill_versions(id) on delete set null,
  provider_session_id text,
  summary_text text,
  status text not null default 'active' check (status in ('active', 'closed', 'reset')),
  bootstrapped_at timestamptz default now(),
  last_used_at timestamptz default now(),
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists stage_sessions_one_active_per_model
  on public.stage_sessions(user_id, competition_id, stage_id, model_provider, model_id)
  where status = 'active';

alter table public.agent_runs
  add column if not exists stage_session_id uuid references public.stage_sessions(id) on delete set null,
  add column if not exists provider_session_id text,
  add column if not exists search_mode text not null default 'balanced' check (search_mode in ('fast', 'balanced', 'deep')),
  add column if not exists search_budget jsonb not null default '{}'::jsonb;

create table if not exists public.run_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete cascade,
  stage_id text,
  query text,
  url text not null,
  title text,
  domain text,
  snippet text,
  extracted_text text,
  provider text,
  captured_from text not null default 'provider_event',
  retrieved_at timestamptz default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists run_sources_run_id_idx on public.run_sources(run_id);
create index if not exists run_sources_competition_stage_idx on public.run_sources(competition_id, stage_id);

alter table public.stage_sessions enable row level security;
alter table public.run_sources enable row level security;

drop policy if exists "stage sessions own rows" on public.stage_sessions;
drop policy if exists "run sources own rows" on public.run_sources;

create policy "stage sessions own rows" on public.stage_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "run sources own rows" on public.run_sources
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
