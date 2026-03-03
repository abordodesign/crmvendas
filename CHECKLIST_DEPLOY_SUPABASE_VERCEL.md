# Checklist de Deploy - Supabase + Vercel

Use este checklist antes de publicar o CRM em ambiente real.

## 1. Banco Supabase

### Estrutura

- Confirmar que todas as migrations em `supabase/migrations` foram aplicadas.
- Validar a existencia das funcoes:
  - `bootstrap_auth_user`
  - `assign_user_to_organization`
  - `current_profile_org`
  - `current_profile_role`
- Validar a existencia do trigger:
  - `on_auth_user_created` em `auth.users`

### Tabelas

- `organizations`
- `profiles`
- `accounts`
- `contacts`
- `pipeline_stages`
- `opportunities`
- `activities`
- `tasks`
- `app_settings`
- `notifications`

### RLS

- Confirmar RLS ativo em todas as tabelas principais.
- Validar se as policies foram aplicadas corretamente.
- Testar acesso com um usuario autenticado comum:
  - leitura da propria organizacao
  - bloqueio de dados de outra organizacao

## 2. Supabase Auth

### Provider de e-mail

- Revisar `Authentication > Providers > Email`.
- Definir se `Confirm email` ficara:
  - ativo em producao
  - desativado apenas em ambiente interno

### Rate limits

- Revisar `Authentication > Rate Limits`.
- Ajustar `Rate limit for sending emails` para valor compativel com o uso real.
- O valor de `2 emails/h` e insuficiente para testes e operacao normal.

### URLs

- Configurar `Site URL` com a URL final da aplicacao.
- Configurar `Redirect URLs` para:
  - producao
  - preview, se houver

## 3. Variaveis de ambiente

Configurar na Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Regra

- `SUPABASE_SERVICE_ROLE_KEY` deve existir apenas no servidor.
- Nunca expor a service role em codigo client-side.

## 4. Vercel

### Projeto

- Confirmar que o repositorio correto esta conectado.
- Confirmar que a branch principal e `main`.

### Build

Rodar antes do deploy:

- `npm run build`
- `npm run lint`
- `npm run typecheck`

## 5. Testes funcionais obrigatorios apos deploy

### Acesso

- Testar `/cadastro`
- Testar `/login`
- Confirmar criacao correta de conta `admin`

### Sessao

- Confirmar gravacao do cookie `crm_access_token`
- Confirmar execucao de `/api/auth/bootstrap` apos login/cadastro

### Modulos

- Dashboard abre corretamente
- Clientes abre e lista
- Oportunidades abre e renderiza kanban
- Tarefas abre e permite cadastro
- Agenda abre e permite cadastro
- Configuracoes abre e salva `app_settings`
- Notificacoes abre e carrega alertas
- Historico abre e renderiza eventos

### Admin

- Criar usuario interno em Configuracoes
- Confirmar que o novo usuario entra na mesma organizacao
- Confirmar que o papel foi salvo corretamente

## 6. Seguranca

- Validar que rotas server-side que usam service role exigem sessao:
  - `/api/auth/bootstrap`
  - `/api/admin/users`
- Validar que apenas `admin` cria usuarios da equipe
- Revisar logs para eventuais erros de RLS

## 7. Observabilidade

- Acompanhar logs do Supabase:
  - Auth
  - Database
- Acompanhar logs da Vercel:
  - falhas de rotas API
  - falhas de ambiente
  - erros de autenticacao

## 8. Limitacoes conhecidas

- Campos extras de clientes ainda nao persistem integralmente.
- Campos extras de oportunidades ainda nao persistem integralmente.
- Ainda nao existe gestao completa de usuarios internos.

## 9. Go-live

Antes de colocar em producao:

- migrations aplicadas
- auth validado
- env vars configuradas
- cadastro e login testados
- bootstrap de perfil validado
- criacao de equipe validada
- rate limits revisados
- testes funcionais concluidos
