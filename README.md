# CRM Vendas

Projeto Beta CRM - Vendas.

Base inicial para um CRM interno focado em previsibilidade comercial, visao 360 do cliente e automacoes.

## Stack

- Next.js 15 com TypeScript
- Supabase para autenticacao, PostgreSQL e RLS
- Estrutura preparada para evolucao futura para multi-tenant

## Estrutura inicial

- `app/`: shell inicial da interface do CRM
- `components/`: componentes de apresentacao do dashboard
- `lib/`: dados iniciais e cliente Supabase
- `supabase/schema.sql`: modelo inicial de banco com RLS
- `types/`: contratos usados pela interface

## Proximos passos

1. Instalar dependencias com `npm install`
2. Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Aplicar `supabase/schema.sql` no projeto Supabase
4. Evoluir da UI estatica para dados reais e autenticacao
