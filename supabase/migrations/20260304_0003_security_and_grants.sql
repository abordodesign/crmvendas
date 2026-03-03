create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

drop policy if exists "profiles self update" on public.profiles;

create policy "profiles self update"
on public.profiles
for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and organization_id = public.current_profile_org()
  and role = (select role from public.profiles where id = auth.uid())
);

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
on all tables in schema public
to authenticated, service_role;

grant usage, select
on all sequences in schema public
to authenticated, service_role;

alter default privileges in schema public
grant select, insert, update, delete
on tables
to authenticated, service_role;

alter default privileges in schema public
grant usage, select
on sequences
to authenticated, service_role;

grant execute on function public.current_profile_org() to authenticated, service_role;
grant execute on function public.current_profile_role() to authenticated, service_role;
