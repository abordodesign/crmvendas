do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'accounts' and policyname = 'org scoped delete accounts'
  ) then
    create policy "org scoped delete accounts"
    on public.accounts
    for delete
    using (organization_id = public.current_profile_org());
  end if;
end
$$;
