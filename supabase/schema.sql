create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'manager', 'sales');
create type public.opportunity_status as enum ('open', 'won', 'lost');
create type public.activity_kind as enum ('call', 'meeting', 'email', 'task', 'note');

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  full_name text not null,
  role public.app_role not null default 'sales',
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  legal_name text not null,
  trade_name text,
  segment text,
  owner_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  account_id uuid not null references public.accounts on delete cascade,
  full_name text not null,
  email text,
  phone text,
  position text,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name text not null,
  stage_order integer not null,
  probability integer not null check (probability between 0 and 100),
  created_at timestamptz not null default now(),
  unique (organization_id, stage_order)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  account_id uuid not null references public.accounts on delete cascade,
  contact_id uuid references public.contacts on delete set null,
  stage_id uuid not null references public.pipeline_stages on delete restrict,
  owner_id uuid references public.profiles(id),
  title text not null,
  status public.opportunity_status not null default 'open',
  amount numeric(12,2) not null default 0,
  expected_close_date date,
  loss_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  opportunity_id uuid references public.opportunities on delete cascade,
  account_id uuid references public.accounts on delete cascade,
  contact_id uuid references public.contacts on delete cascade,
  actor_id uuid references public.profiles(id),
  kind public.activity_kind not null,
  subject text not null,
  notes text,
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  opportunity_id uuid references public.opportunities on delete cascade,
  owner_id uuid not null references public.profiles(id),
  title text not null,
  due_at timestamptz,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.current_profile_org()
returns uuid
language sql
stable
as $$
  select organization_id
  from public.profiles
  where id = auth.uid()
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;

create policy "profiles select same org"
on public.profiles
for select
using (organization_id = public.current_profile_org());

create policy "profiles self update"
on public.profiles
for update
using (id = auth.uid());

create policy "org scoped read accounts"
on public.accounts
for select
using (organization_id = public.current_profile_org());

create policy "org scoped insert accounts"
on public.accounts
for insert
with check (organization_id = public.current_profile_org());

create policy "org scoped update accounts"
on public.accounts
for update
using (organization_id = public.current_profile_org());

create policy "org scoped read contacts"
on public.contacts
for select
using (organization_id = public.current_profile_org());

create policy "org scoped write contacts"
on public.contacts
for all
using (organization_id = public.current_profile_org())
with check (organization_id = public.current_profile_org());

create policy "org scoped pipeline"
on public.pipeline_stages
for all
using (organization_id = public.current_profile_org())
with check (organization_id = public.current_profile_org());

create policy "org scoped opportunities"
on public.opportunities
for all
using (organization_id = public.current_profile_org())
with check (organization_id = public.current_profile_org());

create policy "org scoped activities"
on public.activities
for all
using (organization_id = public.current_profile_org())
with check (organization_id = public.current_profile_org());

create policy "org scoped tasks"
on public.tasks
for all
using (organization_id = public.current_profile_org())
with check (organization_id = public.current_profile_org());
