create or replace function public.slugify(input_text text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(input_text, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'crm'
  )
$$;

create or replace function public.ensure_default_pipeline_stages(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pipeline_stages (organization_id, name, stage_order, probability)
  values
    (p_organization_id, 'Prospect', 1, 10),
    (p_organization_id, 'Qualificado', 2, 25),
    (p_organization_id, 'Apresentacao', 3, 45),
    (p_organization_id, 'Proposta', 4, 60),
    (p_organization_id, 'Negociacao', 5, 80),
    (p_organization_id, 'Conclusao', 6, 100)
  on conflict (organization_id, stage_order) do nothing;
end
$$;

create or replace function public.bootstrap_auth_user(
  p_user_id uuid,
  p_email text,
  p_raw_user_meta_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_existing_org_id uuid;
  v_organization_id uuid;
  v_requested_org_id_text text;
  v_requested_org_slug text;
  v_requested_org_name text;
  v_display_name text;
  v_company_name text;
  v_full_name text;
  v_role public.app_role;
  v_base_slug text;
  v_candidate_slug text;
  v_counter integer := 1;
begin
  select organization_id
  into v_existing_org_id
  from public.profiles
  where id = p_user_id;

  if v_existing_org_id is not null then
    v_organization_id := v_existing_org_id;
  else
    v_requested_org_id_text := nullif(trim(coalesce(p_raw_user_meta_data ->> 'organization_id', '')), '');
    v_requested_org_slug := nullif(public.slugify(p_raw_user_meta_data ->> 'organization_slug'), 'crm');
    v_requested_org_name := nullif(trim(coalesce(
      p_raw_user_meta_data ->> 'organization_name',
      p_raw_user_meta_data ->> 'company_name',
      ''
    )), '');

    if v_requested_org_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      select id
      into v_organization_id
      from public.organizations
      where id = v_requested_org_id_text::uuid;
    end if;

    if v_organization_id is null and v_requested_org_slug is not null then
      select id
      into v_organization_id
      from public.organizations
      where slug = v_requested_org_slug;
    end if;

    if v_organization_id is null then
      v_requested_org_name := coalesce(
        v_requested_org_name,
        nullif(trim(coalesce(p_raw_user_meta_data ->> 'company_name', '')), ''),
        initcap(replace(split_part(coalesce(p_email, 'crm@local'), '@', 1), '.', ' '))
      );

      v_base_slug := coalesce(
        v_requested_org_slug,
        public.slugify(v_requested_org_name),
        public.slugify(split_part(coalesce(p_email, 'crm@local'), '@', 1))
      );
      v_candidate_slug := v_base_slug;

      while exists (
        select 1
        from public.organizations
        where slug = v_candidate_slug
      ) loop
        v_counter := v_counter + 1;
        v_candidate_slug := v_base_slug || '-' || v_counter::text;
      end loop;

      insert into public.organizations (name, slug)
      values (v_requested_org_name, v_candidate_slug)
      returning id into v_organization_id;
    end if;
  end if;

  v_full_name := coalesce(
    nullif(trim(coalesce(p_raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(p_raw_user_meta_data ->> 'display_name', '')), ''),
    nullif(trim(split_part(coalesce(p_email, ''), '@', 1)), ''),
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
    when 'admin' then 'admin'::public.app_role
    when 'manager' then 'manager'::public.app_role
    when 'sales' then 'sales'::public.app_role
    else 'admin'::public.app_role
  end;

  insert into public.profiles (id, organization_id, full_name, role)
  values (p_user_id, v_organization_id, v_full_name, v_role)
  on conflict (id) do update
  set full_name = excluded.full_name;

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
      'history_module', true
    )
  )
  on conflict (user_id) do nothing;

  perform public.ensure_default_pipeline_stages(v_organization_id);

  return v_organization_id;
end
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.bootstrap_auth_user(new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create or replace function public.assign_user_to_organization(
  p_user_id uuid,
  p_organization_id uuid,
  p_role public.app_role default 'sales',
  p_full_name text default null,
  p_display_name text default null,
  p_company_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_full_name text;
  v_company_name text;
begin
  select email
  into v_email
  from auth.users
  where id = p_user_id;

  if v_email is null then
    raise exception 'auth.users record not found for %', p_user_id;
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = p_organization_id
  ) then
    raise exception 'organization % not found', p_organization_id;
  end if;

  v_full_name := coalesce(
    nullif(trim(coalesce(p_full_name, '')), ''),
    initcap(replace(split_part(v_email, '@', 1), '.', ' '))
  );

  v_company_name := coalesce(
    nullif(trim(coalesce(p_company_name, '')), ''),
    (
      select name
      from public.organizations
      where id = p_organization_id
    )
  );

  insert into public.profiles (id, organization_id, full_name, role)
  values (p_user_id, p_organization_id, v_full_name, p_role)
  on conflict (id) do update
  set organization_id = excluded.organization_id,
      full_name = excluded.full_name,
      role = excluded.role;

  insert into public.app_settings (organization_id, user_id, display_name, company_name, features)
  values (
    p_organization_id,
    p_user_id,
    coalesce(nullif(trim(coalesce(p_display_name, '')), ''), v_full_name),
    v_company_name,
    jsonb_build_object(
      'notifications_center', true,
      'browser_notifications', true,
      'agenda_module', true,
      'task_reminders', true,
      'pipeline_drag_drop', true,
      'history_module', true
    )
  )
  on conflict (user_id) do update
  set organization_id = excluded.organization_id,
      display_name = excluded.display_name,
      company_name = excluded.company_name,
      updated_at = now();

  perform public.ensure_default_pipeline_stages(p_organization_id);
end
$$;

do $$
declare
  v_user record;
begin
  for v_user in
    select id, email, raw_user_meta_data
    from auth.users
  loop
    perform public.bootstrap_auth_user(v_user.id, v_user.email, coalesce(v_user.raw_user_meta_data, '{}'::jsonb));
  end loop;
end
$$;
