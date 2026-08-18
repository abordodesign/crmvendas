alter table public.opportunities
  add column if not exists setup_amount numeric(12,2) not null default 0;

comment on column public.opportunities.setup_amount is
  'Valor unico de implantacao somado ao contrato da oportunidade.';
