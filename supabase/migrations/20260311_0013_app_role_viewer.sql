do $$
begin
  if exists (select 1 from pg_type where typname = 'app_role') then
    begin
      alter type public.app_role add value if not exists 'viewer';
    exception
      when duplicate_object then
        null;
    end;
  end if;
end
$$;

create or replace function public.bootstrap_auth_user(
  p_user_id uuid,
  p_email text,
  p_raw_user_meta_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_org_name text;
  v_org_slug text;
  v_organization_id uuid;
  v_full_name text;
  v_display_name text;
  v_company_name text;
  v_role public.app_role;
begin
  v_email := lower(trim(coalesce(p_email, '')));

  if v_email = '' then
    raise exception 'E-mail invalido para bootstrap.';
  end if;

  select pr.organization_id
    into v_organization_id
  from public.profiles pr
  where pr.id = p_user_id;

  if v_organization_id is null then
    select pr.organization_id
      into v_organization_id
    from public.profiles pr
    where lower(trim(pr.full_name)) = lower(trim(coalesce(p_raw_user_meta_data ->> 'full_name', '')))
      and pr.organization_id is not null
    limit 1;
  end if;

  v_org_name := coalesce(
    nullif(trim(coalesce(p_raw_user_meta_data ->> 'organization_name', '')), ''),
    nullif(trim(coalesce(p_raw_user_meta_data ->> 'company_name', '')), ''),
    'CRM comercial'
  );

  v_org_slug := regexp_replace(lower(unaccent(v_org_name)), '[^a-z0-9]+', '-', 'g');
  v_org_slug := trim(both '-' from v_org_slug);

  if v_org_slug = '' then
    v_org_slug := 'crm-comercial';
  end if;

  if v_organization_id is null then
    insert into public.organizations (name, slug)
    values (v_org_name, v_org_slug)
    on conflict (slug) do update
      set name = excluded.name
    returning id into v_organization_id;
  end if;

  v_full_name := coalesce(
    nullif(trim(coalesce(p_raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(split_part(v_email, '@', 1)), ''),
    'Equipe'
  );

  v_display_name := coalesce(
    nullif(trim(coalesce(p_raw_user_meta_data ->> 'display_name', '')), ''),
    v_full_name
  );

  v_company_name := coalesce(
    nullif(trim(coalesce(p_raw_user_meta_data ->> 'company_name', '')), ''),
    (
      select name
      from public.organizations
      where id = v_organization_id
    )
  );

  v_role := case lower(coalesce(p_raw_user_meta_data ->> 'role', ''))
    when 'master' then 'admin'::public.app_role
    when 'admin' then 'admin'::public.app_role
    when 'manager' then 'manager'::public.app_role
    when 'sales' then 'sales'::public.app_role
    when 'viewer' then 'viewer'::public.app_role
    else 'admin'::public.app_role
  end;

  insert into public.profiles (id, organization_id, full_name, role)
  values (p_user_id, v_organization_id, v_full_name, v_role)
  on conflict (id) do update
  set organization_id = excluded.organization_id,
      full_name = excluded.full_name,
      role = excluded.role;

  insert into public.app_settings (organization_id, user_id, display_name, company_name, features)
  values (
    v_organization_id,
    p_user_id,
    v_display_name,
    v_company_name,
    jsonb_build_object(
      'notifications_center', true,
      'browser_notifications', true,
      'agenda_module', true,
      'task_reminders', true,
      'pipeline_drag_drop', true,
      'history_module', true,
      'pipeline_agent_system', true
    )
  )
  on conflict (user_id) do update
  set organization_id = excluded.organization_id,
      display_name = excluded.display_name,
      company_name = excluded.company_name;
end;
$$;
