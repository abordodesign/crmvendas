create table if not exists public.pipeline_agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date_key text not null,
  ran_at timestamptz not null default now(),
  executed boolean not null default false,
  created_tasks integer not null default 0,
  reviewed integer not null default 0,
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table public.pipeline_agent_runs enable row level security;

create index if not exists pipeline_agent_runs_user_ran_at_idx
  on public.pipeline_agent_runs (user_id, ran_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pipeline_agent_runs'
      and policyname = 'org scoped pipeline agent runs'
  ) then
    create policy "org scoped pipeline agent runs"
    on public.pipeline_agent_runs
    for all
    using (organization_id = public.current_profile_org() and user_id = auth.uid())
    with check (organization_id = public.current_profile_org() and user_id = auth.uid());
  end if;
end
$$;
