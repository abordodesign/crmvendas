# Configuracao da SUPABASE_SERVICE_ROLE_KEY

## O que e

A `SUPABASE_SERVICE_ROLE_KEY` e a chave administrativa do projeto Supabase.

Ela permite que rotas server-side do sistema executem operacoes privilegiadas no banco e no Auth, acima das restricoes normais do cliente autenticado com a chave anonima.

## Por que ela e necessaria neste sistema

No `CRMVendas`, essa chave e necessaria para que partes criticas do sistema funcionem corretamente no servidor:

- Inicializacao e reparo automatico de perfil do usuario
- Criacao e ajuste de `profiles`
- Criacao e ajuste de `app_settings`
- Garantia de vinculacao do usuario a uma `organization`
- Criacao das etapas padrao do funil
- Operacoes administrativas de usuarios internos

Sem essa chave, o sistema pode autenticar o usuario, mas nao consegue completar o bootstrap interno do CRM.

## Onde ela e usada

Atualmente, a principal rota que depende dela e:

- [app/api/auth/bootstrap/route.ts](/c:/Users/A%20Bordo%20Design/Desktop/CRMVendas/app/api/auth/bootstrap/route.ts)

Essa rota:

- le o token da sessao atual
- identifica o usuario autenticado
- usa um client com `service_role`
- executa a RPC `bootstrap_auth_user`
- garante que o usuario tenha `profile`, `organization`, `app_settings` e pipeline inicial

Sem isso, o front pode nao conseguir resolver `organization_id` do usuario, e varios fluxos passam a falhar ou cair em fallback local.

## O que acontece quando ela esta faltando

Quando a `SUPABASE_SERVICE_ROLE_KEY` nao esta configurada, a rota `/api/auth/bootstrap` retorna erro `500`.

Isso costuma causar sintomas como:

- falha nas chamadas para `profiles`
- falha em leituras de `accounts`, `tasks`, `activities` e outras tabelas dependentes do contexto do usuario
- cadastros aparentam funcionar na tela, mas ficam apenas em cache local
- dados somem ao limpar cache do navegador
- o usuario nao consegue ter o contexto completo carregado no CRM

## Variaveis obrigatorias na Vercel

Para producao, este projeto precisa destas variaveis:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Como configurar na Vercel

1. Abra o projeto na Vercel
2. Va em `Settings`
3. Va em `Environment Variables`
4. Adicione a chave:
   `SUPABASE_SERVICE_ROLE_KEY`
5. Cole como valor a chave `service_role` do seu projeto Supabase
6. Salve a variavel para `Production` (e, se desejar, tambem `Preview` e `Development`)
7. Faca um novo deploy

## Onde encontrar a chave no Supabase

1. Abra o projeto no Supabase
2. Va em `Settings`
3. Va em `API`
4. Copie o valor de `service_role`

## Regra de seguranca

Essa chave e sensivel e nunca deve ser exposta no frontend.

Regras obrigatorias:

- nao usar prefixo `NEXT_PUBLIC_`
- nao colocar essa chave em codigo cliente
- nao expor em componentes React
- usar apenas em rotas server-side, server actions ou processos backend

## Depois de configurar

Depois de adicionar a `SUPABASE_SERVICE_ROLE_KEY`, faca:

1. Novo deploy da aplicacao
2. Novo login no sistema
3. Teste o endpoint de bootstrap
4. Teste cadastro de cliente, oportunidade e tarefa
5. Confirme no banco que os dados foram realmente persistidos

## Resumo

Sem a `SUPABASE_SERVICE_ROLE_KEY`, o sistema pode abrir, mas partes essenciais do CRM nao conseguem se auto-inicializar no backend.

Ela e necessaria para que o ambiente funcione de forma confiavel, especialmente nos fluxos de bootstrap, reparo de perfil e operacoes administrativas ligadas a usuarios e organizacoes.
