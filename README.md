# CRM Vendas

CRM comercial com funil, tarefas, agenda, notificacoes, historico e modulos de prospeccao (gratuito e pago com flag).

## Stack

- Next.js 16 + React 19 + TypeScript
- Supabase (Auth + Postgres + RLS)
- Zod para validacoes

## Funcionalidades prontas

- Login e cadastro com Supabase.
- Bootstrap de perfil e sessao para evitar usuario sem role.
- Dashboard executivo com visao do funil e operacao comercial.
- Agenda com criacao e acompanhamento de compromissos.
- Clientes com cadastro em modal, edicao, exclusao e filtros avancados.
- Oportunidades em Kanban com movimentacao por etapa, probabilidade, valor e previsao.
- Tarefas com criacao, edicao, prioridade, horario e vinculo com oportunidade.
- Notificacoes com prioridade, filtro por modulo e controle de leitura.
- Historico/auditoria de eventos operacionais.
- Estatisticas com cards de funil, pipeline, previsao e filtros de periodo.
- Campo de origem do lead e analise de origem em estatisticas.
- Notas em leads/oportunidades dentro do proprio sistema.
- Consulta de CNPJ com autopreenchimento (BrasilAPI + fallback).
- Prospeccao gratuita via OpenStreetMap (Nominatim).

## Modulos de prospeccao

### 1) Prospeccao Gratis (ativo)

- Menu: `Prospeccao Gratis`
- Fonte: OpenStreetMap/Nominatim
- Rota: `/dashboard/prospecting-free`
- API interna: `/api/prospecting/free`

### 2) Prospeccao Google Places (pago, opcional)

- Rota existente: `/dashboard/prospecting`
- API interna: `/api/prospecting/places`
- O modulo fica no codigo, mas pode ficar oculto no menu.

Controle por variavel de ambiente:

- `NEXT_PUBLIC_ENABLE_GOOGLE_PLACES_PROSPECTING=false` => Google Places escondido no menu (padrao atual)
- `NEXT_PUBLIC_ENABLE_GOOGLE_PLACES_PROSPECTING=true` => Google Places aparece no menu novamente

## Variaveis de ambiente

Base:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Prospecao Google (quando ativada):

- `GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_ENABLE_GOOGLE_PLACES_PROSPECTING=true`

Arquivo de exemplo: `.env.example`.

## Rotas principais

- `/login`
- `/cadastro`
- `/dashboard`
- `/dashboard/statistics`
- `/dashboard/agenda`
- `/dashboard/customers`
- `/dashboard/opportunities`
- `/dashboard/tasks`
- `/dashboard/notifications`
- `/dashboard/settings`
- `/dashboard/history`
- `/dashboard/prospecting-free`
- `/dashboard/prospecting` (quando habilitado pela flag)

## Scripts

- `npm run dev` inicia em desenvolvimento
- `npm run build` gera build de producao
- `npm run start` inicia build de producao
- `npm run lint` roda lint
- `npm run typecheck` roda verificacao de tipos

## Documentacao complementar

- Manual funcional completo: `MANUAL_DO_SISTEMA.md`
- Guia de implementacao: `IMPLEMENTACAO_CRM.md`
- Checklist de deploy: `CHECKLIST_DEPLOY_SUPABASE_VERCEL.md`
