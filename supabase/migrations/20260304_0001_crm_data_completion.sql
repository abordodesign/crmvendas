alter table public.accounts
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

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'touch_accounts_updated_at'
      and tgrelid = 'public.accounts'::regclass
  ) then
    create trigger touch_accounts_updated_at
    before update on public.accounts
    for each row
    execute function public.touch_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'touch_opportunities_updated_at'
      and tgrelid = 'public.opportunities'::regclass
  ) then
    create trigger touch_opportunities_updated_at
    before update on public.opportunities
    for each row
    execute function public.touch_updated_at();
  end if;

  if to_regclass('public.app_settings') is not null
    and not exists (
      select 1 from pg_trigger
      where tgname = 'touch_app_settings_updated_at'
        and tgrelid = 'public.app_settings'::regclass
    ) then
    create trigger touch_app_settings_updated_at
    before update on public.app_settings
    for each row
    execute function public.touch_updated_at();
  end if;

  if to_regclass('public.notifications') is not null
    and not exists (
      select 1 from pg_trigger
      where tgname = 'touch_notifications_updated_at'
        and tgrelid = 'public.notifications'::regclass
    ) then
    create trigger touch_notifications_updated_at
    before update on public.notifications
    for each row
    execute function public.touch_updated_at();
  end if;
end
$$;

create index if not exists accounts_org_owner_idx
  on public.accounts (organization_id, owner_id);

create index if not exists accounts_org_email_idx
  on public.accounts (organization_id, email)
  where email is not null;

create unique index if not exists accounts_org_document_key
  on public.accounts (organization_id, document)
  where document is not null;

create index if not exists contacts_org_account_idx
  on public.contacts (organization_id, account_id);

create index if not exists opportunities_org_stage_idx
  on public.opportunities (organization_id, stage_id, status);

create index if not exists opportunities_org_owner_idx
  on public.opportunities (organization_id, owner_id);

create index if not exists opportunities_org_close_idx
  on public.opportunities (organization_id, expected_close_date);

create index if not exists tasks_org_owner_due_idx
  on public.tasks (organization_id, owner_id, is_done, due_at);

create index if not exists activities_org_scheduled_idx
  on public.activities (organization_id, scheduled_for);

create index if not exists activities_org_opportunity_idx
  on public.activities (organization_id, opportunity_id);

create index if not exists notifications_user_state_idx
  on public.notifications (user_id, resolved_at, is_read);
