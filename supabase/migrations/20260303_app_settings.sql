create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  display_name text,
  company_name text,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_settings'
      and policyname = 'org scoped app settings'
  ) then
    create policy "org scoped app settings"
    on public.app_settings
    for all
    using (organization_id = public.current_profile_org() and user_id = auth.uid())
    with check (organization_id = public.current_profile_org() and user_id = auth.uid());
  end if;
end
$$;
