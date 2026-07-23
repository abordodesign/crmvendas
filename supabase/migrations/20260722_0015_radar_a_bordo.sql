alter table public.accounts
  add column if not exists radar_site_score smallint,
  add column if not exists radar_instagram_score smallint,
  add column if not exists radar_google_score smallint,
  add column if not exists radar_brand_score smallint,
  add column if not exists radar_urgency text not null default 'Media',
  add column if not exists radar_potential numeric(12,2) not null default 0,
  add column if not exists radar_last_contact date,
  add column if not exists radar_next_action text;

alter table public.accounts
  drop constraint if exists accounts_radar_site_score_check,
  add constraint accounts_radar_site_score_check check (radar_site_score between 0 and 10),
  drop constraint if exists accounts_radar_instagram_score_check,
  add constraint accounts_radar_instagram_score_check check (radar_instagram_score between 0 and 10),
  drop constraint if exists accounts_radar_google_score_check,
  add constraint accounts_radar_google_score_check check (radar_google_score between 0 and 10),
  drop constraint if exists accounts_radar_brand_score_check,
  add constraint accounts_radar_brand_score_check check (radar_brand_score between 0 and 10),
  drop constraint if exists accounts_radar_urgency_check,
  add constraint accounts_radar_urgency_check check (radar_urgency in ('Alta', 'Media', 'Baixa'));

create index if not exists accounts_radar_priority_idx
  on public.accounts (organization_id, radar_urgency, radar_potential desc);
