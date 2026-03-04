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
  primary_contact_name text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip_code text,
  document text,
  status text not null default 'active',
  owner_id uuid references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now(),
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
  owner_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  status public.opportunity_status not null default 'open',
  base_amount numeric(12,2) not null default 0,
  is_recurring boolean not null default false,
  months integer not null default 1 check (months >= 1),
  amount numeric(12,2) not null default 0,
  expected_close_date date,
  loss_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opportunities
  add column if not exists base_amount numeric(12,2) not null default 0;

alter table public.opportunities
  add column if not exists is_recurring boolean not null default false;

alter table public.opportunities
  add column if not exists months integer not null default 1;

alter table public.accounts
  add column if not exists primary_contact_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text,
  add column if not exists document text,
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

alter table public.opportunities
  add column if not exists next_step text,
  add column if not exists conclusion_status text,
  add column if not exists conclusion_reason text,
  add column if not exists concluded_at timestamptz;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  opportunity_id uuid references public.opportunities on delete cascade,
  account_id uuid references public.accounts on delete cascade,
  contact_id uuid references public.contacts on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
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
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  priority text not null default 'Media',
  due_at timestamptz,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists priority text not null default 'Media';

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
alter table public.app_settings enable row level security;
alter table public.notifications enable row level security;

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

create policy "org scoped app settings"
on public.app_settings
for all
using (organization_id = public.current_profile_org() and user_id = auth.uid())
with check (organization_id = public.current_profile_org() and user_id = auth.uid());

create policy "org scoped notifications"
on public.notifications
for all
using (organization_id = public.current_profile_org() and user_id = auth.uid())
with check (organization_id = public.current_profile_org() and user_id = auth.uid());
