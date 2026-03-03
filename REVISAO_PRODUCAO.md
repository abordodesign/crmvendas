# Revisao de Producao

Este documento consolida a revisao final do sistema em tres frentes:

- varredura de mensagens de erro e textos da UI
- lacunas de persistencia no banco
- riscos residuais antes de producao

## 1. Varredura de mensagens e textos da UI

### Estado atual

Os textos principais da interface estao coerentes e legiveis nos fluxos revisados:

- login e cadastro
- feedback de criacao de usuarios
- mensagens de agenda, tarefas e oportunidades
- labels de papel: `Admin`, `Gestor`, `Comercial`
- fallback de permissao: `Sem perfil`

### Ponto observado

- O loading principal em `components/crm-shell.tsx` esta correto como `Carregando permissões...`.
- O projeto, no entanto, mistura ASCII e texto com acentos em alguns arquivos.

### Risco de UX

Alguns pontos ainda exibem `error.message` bruto vindo do Supabase:

- `components/register-form.tsx`
- `components/settings-screen.tsx`
- `app/api/admin/users/route.ts`
- `app/api/auth/bootstrap/route.ts`

Isso significa que mensagens tecnicas podem aparecer em ingles ou com texto pouco amigavel ao usuario final.

### Recomendacao

Criar um normalizador de erros para:

- traduzir erros comuns do Supabase
- padronizar mensagens de API
- evitar expor mensagens tecnicas brutas

## 2. O que ainda nao persiste 100% no banco

O banco ja foi preparado com os campos extras, mas a camada de acesso a dados ainda nao grava/le todos eles.

### 2.1 Clientes (`accounts`)

#### O banco ja suporta

- `phone`
- `email`
- `address`
- `city`
- `state`
- `zip_code`
- `document`
- `status`

#### Lacuna atual no codigo

Em `lib/crm-data-source.ts`:

- `createCustomer(...)` grava apenas:
  - `organization_id`
  - `legal_name`
  - `trade_name`
  - `segment`
  - `owner_id`
- `updateCustomer(...)` atualiza apenas:
  - `legal_name`
  - `trade_name`
  - `segment`
- `getCustomers()` le apenas:
  - `id`
  - `legal_name`
  - `trade_name`
  - `segment`
  - `owner_id`
  - `contacts`

#### Efeito

- O formulario coleta telefone, e-mail, endereco, cidade, estado, CEP e documento.
- Esses dados aparecem na UI e no fallback local.
- Mas ainda nao sao persistidos integralmente no Supabase.

### 2.2 Oportunidades (`opportunities`)

#### O banco ja suporta

- `next_step`
- `conclusion_status`
- `conclusion_reason`
- `concluded_at`

#### Lacuna atual no codigo

Em `lib/crm-data-source.ts`:

- `createOpportunity(...)` nao grava:
  - `next_step`
  - `conclusion_status`
  - `conclusion_reason`
  - `concluded_at`
- `updateOpportunity(...)` tambem nao atualiza esses campos
- `getOpportunities()` nao le esses campos do banco

#### Efeito

- Os campos existem no modal e no fluxo visual.
- Mas ainda nao ficam persistidos de forma confiavel no Supabase.

### 2.3 Contatos (`contacts`)

#### Situacao atual

- A tabela existe e esta protegida por RLS.
- O sistema usa `contacts` principalmente para contagem e estrutura.

#### Lacuna

- Ainda nao existe um fluxo completo e dedicado na UI para criar/editar contatos reais no banco.

### 2.4 Gestao de equipe

#### Ja implementado

- Criacao de usuarios internos na mesma organizacao.

#### Ainda faltando

- listagem de membros
- alteracao de papel
- desativacao de usuario
- redefinicao de senha administrativa

## 3. Riscos residuais antes de producao

### Alta prioridade

- Campos extras de clientes ainda nao persistem 100% no banco.
- Campos extras de oportunidades ainda nao persistem 100% no banco.
- O app ainda pode mostrar erros tecnicos do Supabase sem traducao.

### Media prioridade

- O fallback local com `localStorage` ainda pode mascarar falhas remotas em testes superficiais.
- O projeto depende de `SUPABASE_SERVICE_ROLE_KEY` para bootstrap server-side e criacao de equipe.

### Baixa prioridade

- Ainda nao ha uma area de administracao completa de usuarios internos.

## 4. Proximos passos recomendados

### Persistencia

Atualizar `lib/crm-data-source.ts` para:

- gravar todos os campos extras em `accounts`
- ler todos os campos extras de `accounts`
- gravar `next_step`, `conclusion_status`, `conclusion_reason`, `concluded_at` em `opportunities`
- ler esses campos nas listagens e no funil

### UX

- criar um normalizador de erros do Supabase
- padronizar feedbacks em portugues
- tornar explicita na UI a diferenca entre fallback local e persistencia real
