create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_key text not null,
  type text not null,
  label text not null,
  title text not null,
  detail text not null,
  href text not null,
  priority text not null check (priority in ('high', 'medium', 'info')),
  entity_type text,
  entity_id text,
  is_read boolean not null default false,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, source_key)
);

alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'org scoped notifications'
  ) then
    create policy "org scoped notifications"
    on public.notifications
    for all
    using (organization_id = public.current_profile_org() and user_id = auth.uid())
    with check (organization_id = public.current_profile_org() and user_id = auth.uid());
  end if;
end
$$;
