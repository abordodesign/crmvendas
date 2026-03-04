alter table public.accounts
  drop constraint if exists accounts_owner_id_fkey;

alter table public.accounts
  add constraint accounts_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete cascade;

alter table public.opportunities
  drop constraint if exists opportunities_owner_id_fkey;

alter table public.opportunities
  add constraint opportunities_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete cascade;

alter table public.activities
  drop constraint if exists activities_actor_id_fkey;

alter table public.activities
  add constraint activities_actor_id_fkey
  foreign key (actor_id)
  references public.profiles(id)
  on delete cascade;

alter table public.tasks
  drop constraint if exists tasks_owner_id_fkey;

alter table public.tasks
  add constraint tasks_owner_id_fkey
  foreign key (owner_id)
  references public.profiles(id)
  on delete cascade;
