# Manual do Sistema CRM Vendas

Este documento explica as funcionalidades do sistema e como operar cada area.

## 1. Preparacao do ambiente

Configure no ambiente:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Sem a `SUPABASE_SERVICE_ROLE_KEY`, o sistema nao consegue:

- bootstrapar perfis server-side
- criar usuarios internos da equipe

## 2. Acesso ao sistema

### Login

Rota:

- `/login`

Funcionalidade:

- autentica no Supabase Auth
- sincroniza a sessao para cookie
- executa o bootstrap do perfil automaticamente

### Cadastro publico

Rota:

- `/cadastro`

Funcionalidade:

- cria um novo usuario no Supabase Auth
- cria a organizacao inicial automaticamente
- define o primeiro usuario como `admin`

Campos:

- Nome completo
- Nome de exibicao
- Empresa
- E-mail
- Senha
- Confirmar senha

Comportamentos:

- bloqueia clique duplo no botao de criar conta
- se houver confirmacao de e-mail ativa:
  - exibe mensagem de confirmacao
  - mostra botao de reenvio
  - aplica cooldown de 60 segundos

## 3. Estrutura do painel

Rota base:

- `/dashboard`

Menu lateral:

- Dashboard
- Agenda
- Clientes
- Oportunidades
- Tarefas
- Notificacoes
- Configuracoes
- Historico

Observacao:

- Alguns itens podem ser ocultados dependendo das feature flags.

## 4. Dashboard

Rota:

- `/dashboard`

Funcionalidade:

- mostra KPIs principais
- pipeline resumido
- tarefas
- agenda
- atividade recente

Serve como visao geral do funil comercial.

## 5. Agenda

Rota:

- `/dashboard/agenda`

Funcionalidade:

- cria compromissos
- relaciona agenda com clientes e oportunidades
- exibe agenda ordenada por horario

Quando ha sessao real:

- grava em `activities`

## 6. Clientes

Rota:

- `/dashboard/customers`

Funcionalidade:

- visualizar clientes cadastrados
- criar e editar clientes quando o perfil permitir
- usar modal de cadastro organizado por blocos

Dados tratados:

- razao social
- nome fantasia
- segmento
- telefone
- e-mail
- endereco
- cidade
- estado
- CEP
- documento

## 7. Oportunidades

Rota:

- `/dashboard/opportunities`

Funcionalidade:

- criar oportunidades em modal
- editar oportunidades
- visualizar funil em kanban
- mover entre etapas
- calcular ticket
- tratar oportunidades recorrentes

Etapas padrao:

- Prospect
- Qualificado
- Apresentacao
- Proposta
- Negociacao
- Conclusao

Quando a etapa e `Conclusao`, o sistema exibe campos extras de encerramento.

## 8. Tarefas

Rota:

- `/dashboard/tasks`

Funcionalidade:

- criar tarefas
- editar tarefas
- marcar como concluidas
- controlar prazo

Quando ha sessao real:

- grava em `tasks`

## 9. Notificacoes

Rota:

- `/dashboard/notifications`

Funcionalidade:

- central de notificacoes
- leitura de alertas por prioridade
- filtro por modulo
- marcar individualmente como lido
- marcar tudo como lido

Tipos comuns:

- agenda proxima
- tarefa vencida
- tarefa de hoje
- oportunidade sem proximo passo
- fechamento proximo

## 10. Historico

Rota:

- `/dashboard/history`

Funcionalidade:

- exibe auditoria de acoes do CRM
- registra criacoes, edicoes e movimentacoes

Eventos comuns:

- cliente criado/editado
- oportunidade criada/editada
- tarefa criada/concluida
- item de agenda criado/editado/removido

## 11. Configuracoes

Rota:

- `/dashboard/settings`

Funcionalidades principais:

- alterar nome exibido
- alterar nome do sistema
- trocar senha do usuario autenticado
- ligar/desligar feature flags
- criar usuario interno da equipe (admin)
- limpar dados operacionais

### 11.1 Identidade do sistema

Permite ajustar:

- Nome exibido
- Nome do sistema

Esses dados persistem em:

- `app_settings`

### 11.2 Senha e autenticacao

Permite trocar a senha do usuario atual via Supabase Auth.

Exige:

- sessao real ativa

### 11.3 Feature flags

Ativa/desativa:

- Central de notificacoes
- Alertas do navegador
- Modulo de agenda
- Lembretes de tarefas
- Kanban arrastavel
- Historico e auditoria

### 11.4 Cadastro de equipe (somente admin)

Disponivel apenas para perfil `admin`.

Permite criar usuarios internos na mesma organizacao.

Campos:

- Nome completo
- Nome de exibicao
- E-mail
- Senha inicial
- Papel

Papeis possiveis:

- Comercial
- Gestor
- Admin

Comportamento:

- cria usuario no Supabase Auth
- vincula automaticamente a mesma organizacao do admin atual
- ja confirma o e-mail

### 11.5 Limpeza de dados

Botao:

- `Iniciar limpeza dos dados`

Remove:

- clientes operacionais
- oportunidades
- tarefas
- agenda
- atividades
- notificacoes
- dados locais do navegador

Se houver sessao real, tenta limpar tambem no Supabase.

## 12. Perfis e permissao

Perfis do sistema:

- `admin`
- `manager`
- `sales`

Resumo:

- `admin`: controle total, inclusive equipe
- `manager`: gestao operacional sem administracao total
- `sales`: operacao comercial

Se um usuario estiver autenticado mas sem `profile` valido:

- a interface mostra `Sem perfil`

## 13. Como o sistema salva dados

### Com sessao real

Salva no Supabase:

- `profiles`
- `organizations`
- `accounts`
- `contacts`
- `pipeline_stages`
- `opportunities`
- `activities`
- `tasks`
- `app_settings`
- `notifications`

### Sem sessao real

Usa fallback local no navegador:

- `localStorage`

Isso permite navegar no sistema em modo de desenvolvimento/demonstracao.

## 14. Problemas comuns

### `email rate limit exceeded`

Causa:

- limite de envio de e-mails do Supabase muito baixo

No projeto analisado foi identificado:

- `2 emails/h`

Correcao:

- aumentar `Rate limit for sending emails`
- ou desativar confirmacao de e-mail para testes internos

### Usuario entrou como Comercial quando deveria ser Admin

Causa mais comum:

- `profile` ainda nao existia no banco

Correcao aplicada:

- o sistema agora executa bootstrap automatico da sessao apos login/cadastro

## 15. Fluxo recomendado de operacao

1. Configurar variaveis de ambiente.
2. Entrar com conta admin real.
3. Ajustar nome do sistema em Configuracoes.
4. Criar membros da equipe pela area de Configuracoes.
5. Cadastrar clientes.
6. Criar oportunidades.
7. Organizar tarefas e agenda.
8. Acompanhar alertas e historico.
