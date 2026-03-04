alter table public.opportunities
  add column if not exists lead_source text;
