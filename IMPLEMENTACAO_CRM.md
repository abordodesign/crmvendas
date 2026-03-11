# Implementacao CRM Vendas

Este documento registra o que foi analisado e implementado no sistema ate o momento.

## Visao geral da stack

- Frontend em Next.js com App Router.
- Cliente Supabase via `@supabase/supabase-js`.
- Banco em Supabase/Postgres com RLS.
- Fallback local para parte dos fluxos via `localStorage` quando nao ha sessao real.

## Estrutura funcional implementada

### Autenticacao e sessao

- Tela de login em `app/login/page.tsx`.
- Formulario de login em `components/login-form.tsx`.
- Sincronizacao do token da sessao para cookie HTTP-only em `app/api/auth/session/route.ts`.
- Sincronizacao automatica no cliente em `components/auth-cookie-sync.tsx`.
- Fallback local de admin de desenvolvimento em `lib/dev-auth.ts`:
  - e-mail: `admin@crm.com.br`
  - senha: `admin`

### Cadastro publico

- Tela publica de cadastro em `app/cadastro/page.tsx`.
- Formulario de cadastro em `components/register-form.tsx`.
- Cria usuario no Supabase Auth com metadata:
  - `full_name`
  - `display_name`
  - `company_name`
  - `organization_name`
  - `role = admin`
- Bloqueio contra multiplos cliques no botao de criar conta.
- Fluxo de reenvio de e-mail de confirmacao com:
  - cooldown de 60 segundos
  - botao com estado animado
  - barra de progresso visual

### Bootstrap automatico de perfil

- Endpoint server-side em `app/api/auth/bootstrap/route.ts`.
- Chama a funcao SQL `bootstrap_auth_user` para garantir:
  - `organizations`
  - `profiles`
  - `app_settings`
  - `pipeline_stages`
- Esse bootstrap e chamado automaticamente apos:
  - login
  - cadastro
  - restauracao/sincronizacao de sessao

### Dashboard e modulos internos

- Rotas internas:
  - `app/dashboard/page.tsx`
  - `app/dashboard/agenda/page.tsx`
  - `app/dashboard/customers/page.tsx`
  - `app/dashboard/opportunities/page.tsx`
  - `app/dashboard/tasks/page.tsx`
  - `app/dashboard/notifications/page.tsx`
  - `app/dashboard/settings/page.tsx`
  - `app/dashboard/history/page.tsx`
- Shell principal do CRM em `components/crm-shell.tsx`.
- Provider de autenticacao em `components/crm-auth-context.tsx`.
- Provider de configuracoes em `components/crm-settings-context.tsx`.

### Modulos de negocio

- Agenda: `components/agenda-screen.tsx`
- Clientes: `components/customers-screen.tsx`
- Oportunidades: `components/opportunities-screen.tsx`
- Tarefas: `components/tasks-screen.tsx`
- Notificacoes: `components/notifications-screen.tsx`
- Historico: `components/history-screen.tsx`
- Configuracoes: `components/settings-screen.tsx`

### Permissoes e papeis

- Papeis definidos em `lib/access-control.ts`:
  - `admin`
  - `manager`
  - `sales`
  - `viewer` (Acompanhamento, somente leitura)
- Regras de permissao centralizadas em `hasPermission(...)`.
- Ajuste para nao mascarar ausencia de perfil como `sales`.
- Quando o perfil nao existe, a UI agora mostra `Sem perfil`.

### Fluxo de equipe interna

- Endpoint admin para criar usuarios internos em `app/api/admin/users/route.ts`.
- Usa `SUPABASE_SERVICE_ROLE_KEY` para chamar `auth.admin.createUser`.
- Disponivel apenas para usuarios `admin`.
- O novo usuario e criado:
  - ja confirmado (`email_confirm: true`)
  - vinculado a mesma organizacao do admin atual
  - com `role` definido pelo formulario
- Interface de equipe em `components/settings-screen.tsx` com:
  - criacao de usuario
  - listagem de usuarios cadastrados
  - alteracao de papel (role)
  - exclusao de usuario

## Persistencia e fonte de dados

### Camada de dados

- Fonte principal em `lib/crm-data-source.ts`.
- Configuracoes em `lib/crm-settings.ts`.
- Seed local em `lib/crm-seed.ts`.
- Tipos em `types/crm-app.ts`.

### Agente de Pipeline e alertas

- Motor de atencao com score por oportunidade em `getPipelineAttention(...)`.
- Classificacao de risco por nivel:
  - `critical`
  - `high`
  - `medium`
  - `low`
- Regras de risco:
  - sem proximo passo em etapa avancada
  - sem tarefa vinculada
  - fechamento vencido ou proximo
  - tempo sem interacao por etapa
  - peso adicional para negocios de alto valor
- Automacao diaria:
  - `runPipelineAttentionAgent()`
  - cria tarefas automaticas para casos prioritarios
  - respeita horario, limite diario e feature flags
- Historico de execucoes do agente:
  - visual em Configuracoes
  - fallback local + persistencia no Supabase
- Documentacao funcional dedicada:
  - `SISTEMA_ALERTAS_AGENTE_PIPELINE.md`

### Feature flags recentes

- Nova flag: `pipeline_agent_system`
  - habilita/desabilita analise, alertas e automacoes do agente
  - integrada ao painel de Configuracoes

### Exportacao PDF (Dashboard)

- Endpoint de relatorio executivo:
  - `GET /api/reports/dashboard-pdf`
- Botao `Exportar PDF` na dashboard.
- Conteudo do relatorio:
  - resumo de oportunidades
  - pipeline por etapa
  - situacao por risco
  - tabela de oportunidades priorizadas

### Comportamento hibrido

- Com sessao real:
  - leitura/escrita no Supabase
- Sem sessao real:
  - fallback em `localStorage`
- O sistema ainda usa fallback local para manter operabilidade durante desenvolvimento.

## Migrations criadas/ajustadas

### Criadas

- `supabase/migrations/20260303_0001_core_schema.sql`
- `supabase/migrations/20260304_0001_crm_data_completion.sql`
- `supabase/migrations/20260304_0002_auth_bootstrap.sql`
- `supabase/migrations/20260304_0003_security_and_grants.sql`
- `supabase/migrations/20260310_0012_pipeline_agent_runs.sql`
- `supabase/migrations/20260311_0013_app_role_viewer.sql`

### Ajustadas para idempotencia

- `supabase/migrations/20260303_app_settings.sql`
- `supabase/migrations/20260303_notifications.sql`
- `supabase/migrations/20260304_0004_bootstrap_profile_repair.sql`

### O que essas migrations cobrem

- Schema principal do CRM.
- Tabelas auxiliares de configuracoes e notificacoes.
- Tabela de historico do agente (`pipeline_agent_runs`).
- RLS e politicas.
- Grants para `authenticated` e `service_role`.
- Funcoes:
  - `current_profile_org`
  - `current_profile_role`
  - `touch_updated_at`
  - `slugify`
  - `ensure_default_pipeline_stages`
  - `bootstrap_auth_user`
  - `handle_new_auth_user`
  - `assign_user_to_organization`
- Trigger em `auth.users` para bootstrap automatico.
- Backfill de usuarios ja existentes.
- Indices operacionais para contas, oportunidades, tarefas, atividades e notificacoes.

## Variaveis de ambiente necessarias

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Observacoes operacionais

- Se o Supabase Auth estiver com confirmacao de e-mail ativa, o cadastro publico depende do limite de e-mails.
- Foi identificado no projeto um limite de `2 emails/h`, o que gera facilmente `email rate limit exceeded`.
- Para ambiente interno de teste, e recomendavel:
  - aumentar o rate limit de e-mail
  - ou desativar confirmacao de e-mail
- Para usuarios internos, preferir o cadastro da equipe pelo painel admin em configuracoes.

## Riscos e pontos ainda evolutiveis

- Ainda evolutivo:
  - redefinicao de senha de terceiros
  - desativacao/bloqueio de usuarios sem exclusao
  - filtros avancados e paginação na listagem de equipe
  - agendamento automatico de envio periodico de PDF por e-mail
