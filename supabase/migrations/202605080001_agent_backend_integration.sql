create table if not exists public.agent_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  source_path text not null,
  name text not null,
  description text,
  default_compartment_key text,
  default_stage_key text,
  default_skill_content text not null,
  default_input_contracts jsonb not null default '[]'::jsonb,
  default_output_contracts jsonb not null default '[]'::jsonb,
  visible_in_agent_list boolean not null default true,
  template_kind text not null default 'workflow_agent',
  metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.compartments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  is_default boolean not null default false,
  archived boolean not null default false,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, slug)
);

create table if not exists public.user_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  compartment_id uuid not null references public.compartments(id) on delete cascade,
  template_id uuid references public.agent_templates(id) on delete set null,
  name text not null,
  description text,
  stage_key text,
  active_skill_version_id uuid,
  input_contracts jsonb not null default '[]'::jsonb,
  output_contracts jsonb not null default '[]'::jsonb,
  is_custom boolean not null default false,
  enabled boolean not null default true,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists user_agents_template_once_per_compartment
  on public.user_agents (user_id, compartment_id, template_id)
  where template_id is not null;

create table if not exists public.agent_skill_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_agent_id uuid not null references public.user_agents(id) on delete cascade,
  template_id uuid references public.agent_templates(id) on delete set null,
  version_number int not null,
  skill_content text not null,
  input_contracts jsonb not null default '[]'::jsonb,
  output_contracts jsonb not null default '[]'::jsonb,
  change_summary text,
  is_active boolean not null default false,
  reverted_from_version_id uuid references public.agent_skill_versions(id) on delete set null,
  created_at timestamptz default now(),
  unique (user_agent_id, version_number)
);

alter table public.user_agents
  add constraint user_agents_active_skill_version_id_fkey
  foreign key (active_skill_version_id)
  references public.agent_skill_versions(id)
  on delete set null;

create table if not exists public.pipeline_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  description text,
  compartment_key text,
  nodes jsonb not null,
  edges jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.competition_pipelines (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  compartment_id uuid not null references public.compartments(id) on delete restrict,
  name text not null default 'Default pipeline',
  status text not null default 'draft',
  created_from_template_id uuid references public.pipeline_templates(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pipeline_nodes (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.competition_pipelines(id) on delete cascade,
  user_agent_id uuid not null references public.user_agents(id) on delete restrict,
  node_key text not null,
  label text not null,
  position_index int not null,
  input_contracts jsonb not null default '[]'::jsonb,
  output_contracts jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (pipeline_id, node_key)
);

create table if not exists public.pipeline_edges (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.competition_pipelines(id) on delete cascade,
  from_node_id uuid references public.pipeline_nodes(id) on delete set null,
  from_output_key text,
  to_node_id uuid not null references public.pipeline_nodes(id) on delete cascade,
  to_input_key text not null,
  source_type text not null default 'agent_output',
  source_file_id uuid references public.competition_files(id) on delete set null,
  required boolean not null default true,
  allow_any_file boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.competitions
  add column if not exists compartment_id uuid references public.compartments(id) on delete set null;

alter table public.competition_files
  add column if not exists artifact_key text,
  add column if not exists artifact_role text,
  add column if not exists producer_node_id uuid references public.pipeline_nodes(id) on delete set null,
  add column if not exists producer_agent_id uuid references public.user_agents(id) on delete set null,
  add column if not exists status text not null default 'draft',
  add column if not exists summary_text text,
  add column if not exists summary_status text,
  add column if not exists processing_status text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

update public.competition_files
set status = case when approved then 'approved' else 'draft' end
where status is null or status = 'draft';

alter table public.output_versions
  add column if not exists summary_text text,
  add column if not exists summary_version_number int,
  add column if not exists status text,
  add column if not exists created_by_run_id uuid references public.agent_runs(id) on delete set null;

alter table public.agent_runs
  add column if not exists pipeline_id uuid references public.competition_pipelines(id) on delete set null,
  add column if not exists pipeline_node_id uuid references public.pipeline_nodes(id) on delete set null,
  add column if not exists skill_version_id uuid references public.agent_skill_versions(id) on delete set null,
  add column if not exists previous_agent_run_id uuid references public.agent_runs(id) on delete set null,
  add column if not exists context_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists auto_choice_reason jsonb,
  add column if not exists risk_level text,
  add column if not exists raw_log text,
  add column if not exists queued_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.agent_templates enable row level security;
alter table public.compartments enable row level security;
alter table public.user_agents enable row level security;
alter table public.agent_skill_versions enable row level security;
alter table public.pipeline_templates enable row level security;
alter table public.competition_pipelines enable row level security;
alter table public.pipeline_nodes enable row level security;
alter table public.pipeline_edges enable row level security;
alter table public.notifications enable row level security;

create policy "agent templates readable" on public.agent_templates
  for select to authenticated using (true);

create policy "pipeline templates readable" on public.pipeline_templates
  for select to authenticated using (true);

create policy "compartments own rows" on public.compartments
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user agents own rows" on public.user_agents
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "agent skill versions own rows" on public.agent_skill_versions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "competition pipelines own rows" on public.competition_pipelines
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "pipeline nodes through owned pipeline" on public.pipeline_nodes
  for all to authenticated using (
    exists (
      select 1 from public.competition_pipelines p
      where p.id = pipeline_nodes.pipeline_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.competition_pipelines p
      where p.id = pipeline_nodes.pipeline_id and p.user_id = auth.uid()
    )
  );

create policy "pipeline edges through owned pipeline" on public.pipeline_edges
  for all to authenticated using (
    exists (
      select 1 from public.competition_pipelines p
      where p.id = pipeline_edges.pipeline_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.competition_pipelines p
      where p.id = pipeline_edges.pipeline_id and p.user_id = auth.uid()
    )
  );

create policy "notifications own rows" on public.notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "competition files storage own read" on storage.objects
  for select to authenticated using (
    bucket_id in ('competition-files', 'agent-outputs', 'journal-pdfs', 'profile-assets')
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "competition files storage own insert" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('competition-files', 'agent-outputs', 'journal-pdfs', 'profile-assets')
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "competition files storage own update" on storage.objects
  for update to authenticated using (
    bucket_id in ('competition-files', 'agent-outputs', 'journal-pdfs', 'profile-assets')
    and split_part(name, '/', 1) = auth.uid()::text
  ) with check (
    bucket_id in ('competition-files', 'agent-outputs', 'journal-pdfs', 'profile-assets')
    and split_part(name, '/', 1) = auth.uid()::text
  );
