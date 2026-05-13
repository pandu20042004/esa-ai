create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  plan text default 'free',
  accent text default 'Emerald',
  theme text default 'light',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null,
  institution text,
  status text default 'Setup',
  progress int default 0 check (progress >= 0 and progress <= 100),
  deadline date,
  registration_link text,
  current_stage_id text default 'onboarding',
  poster_file_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.competition_files (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_role text not null,
  file_source text not null,
  stage_id text,
  agent_id uuid,
  storage_bucket text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  content_text text,
  metadata jsonb default '{}'::jsonb,
  approved boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  compartment text default 'Essay',
  stage_id text,
  name text not null,
  description text,
  skill_file_id uuid references public.competition_files(id) on delete set null,
  required_input_role text,
  produced_output_role text,
  is_custom boolean default false,
  enabled boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  stage_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'idle',
  model_provider text,
  model_id text,
  reasoning_effort text,
  input_file_ids uuid[] default '{}',
  output_file_id uuid references public.competition_files(id) on delete set null,
  needs_user_choice jsonb,
  selected_choice jsonb,
  error text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  stage_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_type text not null default 'global',
  role text not null,
  content text not null,
  model_provider text,
  model_id text,
  reasoning_effort text,
  context jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.output_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.competition_files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number int not null,
  content_text text not null,
  change_summary text,
  created_at timestamptz default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  category text not null,
  color text,
  tags text[] default '{}',
  source text not null default 'user',
  stage_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.validity_checks (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  output_file_id uuid references public.competition_files(id) on delete cascade,
  journal_file_id uuid references public.competition_files(id) on delete cascade,
  selected_claim text not null,
  verdict text not null,
  evidence_text text,
  risk_reason text,
  model_provider text,
  model_id text,
  created_at timestamptz default now()
);

create table if not exists public.byok_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  label text,
  encrypted_api_key text not null,
  default_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.file_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.competition_files(id) on delete cascade,
  page_number int,
  chunk_index int not null,
  content text not null,
  metadata jsonb default '{}'::jsonb
);

alter table public.profiles enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_files enable row level security;
alter table public.agents enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_messages enable row level security;
alter table public.output_versions enable row level security;
alter table public.calendar_events enable row level security;
alter table public.validity_checks enable row level security;
alter table public.byok_keys enable row level security;
alter table public.file_chunks enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "competitions own rows" on public.competitions;
drop policy if exists "competition files own rows" on public.competition_files;
drop policy if exists "agents own rows" on public.agents;
drop policy if exists "agent runs own rows" on public.agent_runs;
drop policy if exists "agent messages own rows" on public.agent_messages;
drop policy if exists "output versions own rows" on public.output_versions;
drop policy if exists "calendar events own rows" on public.calendar_events;
drop policy if exists "validity checks own rows" on public.validity_checks;
drop policy if exists "byok keys own rows" on public.byok_keys;
drop policy if exists "file chunks visible through owned files" on public.file_chunks;

create policy "profiles own rows" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "competitions own rows" on public.competitions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "competition files own rows" on public.competition_files for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agents own rows" on public.agents for all using (user_id = auth.uid() or user_id is null) with check (user_id = auth.uid());
create policy "agent runs own rows" on public.agent_runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agent messages own rows" on public.agent_messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "output versions own rows" on public.output_versions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "calendar events own rows" on public.calendar_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "validity checks own rows" on public.validity_checks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "byok keys own rows" on public.byok_keys for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "file chunks visible through owned files" on public.file_chunks
  for select using (
    exists (
      select 1 from public.competition_files f
      where f.id = file_chunks.file_id and f.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values
  ('competition-files', 'competition-files', false),
  ('agent-outputs', 'agent-outputs', false),
  ('journal-pdfs', 'journal-pdfs', false),
  ('profile-assets', 'profile-assets', false)
on conflict (id) do nothing;
