alter table public.opportunities
  add column if not exists probability_override integer;

alter table public.opportunities
  drop constraint if exists opportunities_probability_override_check;

alter table public.opportunities
  add constraint opportunities_probability_override_check
  check (probability_override is null or (probability_override between 0 and 100));

update public.pipeline_stages
set
  name = case stage_order
    when 1 then 'Lead'
    when 2 then 'Qualificacao'
    when 3 then 'Diagnostico'
    when 4 then 'Proposta enviada'
    when 5 then 'Negociacao'
    when 6 then 'Fechamento'
    else name
  end,
  probability = case stage_order
    when 1 then 10
    when 2 then 25
    when 3 then 45
    when 4 then 70
    when 5 then 80
    when 6 then 100
    else probability
  end
where stage_order between 1 and 6;
