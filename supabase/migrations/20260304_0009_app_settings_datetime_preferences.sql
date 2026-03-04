alter table public.app_settings
  add column if not exists locale text not null default 'pt-BR';

alter table public.app_settings
  add column if not exists time_zone text not null default 'system';

alter table public.app_settings
  add column if not exists use_24_hour_clock boolean not null default true;
