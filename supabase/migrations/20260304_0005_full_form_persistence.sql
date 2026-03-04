alter table public.accounts
  add column if not exists primary_contact_name text;

alter table public.tasks
  add column if not exists priority text not null default 'Media';
