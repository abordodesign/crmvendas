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
- Interface de criacao de usuarios da equipe em `components/settings-screen.tsx`.

## Persistencia e fonte de dados

### Camada de dados

- Fonte principal em `lib/crm-data-source.ts`.
- Configuracoes em `lib/crm-settings.ts`.
- Seed local em `lib/crm-seed.ts`.
- Tipos em `types/crm-app.ts`.

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

### Ajustadas para idempotencia

- `supabase/migrations/20260303_app_settings.sql`
- `supabase/migrations/20260303_notifications.sql`

### O que essas migrations cobrem

- Schema principal do CRM.
- Tabelas auxiliares de configuracoes e notificacoes.
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

- O frontend ainda nao persiste todos os campos extras de clientes/oportunidades no banco em todos os fluxos.
- Nao ha ainda listagem/gestao de usuarios da equipe alem da criacao.
- Nao foi implementado ainda:
  - redefinicao de senha de terceiros
  - desativacao de usuarios
  - listagem de membros da organizacao
