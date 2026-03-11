# Sistema de Alertas do Agente de Pipeline

Este documento explica como funciona o sistema de analise de pipeline no CRM, como os alertas sao classificados e como o agente atua automaticamente.

## 1. Visao Geral

O CRM possui um **Agente de Pipeline** que:

- analisa oportunidades abertas;
- detecta sinais de risco e esfriamento;
- calcula um score de atencao por oportunidade;
- classifica o risco em niveis (`critical`, `high`, `medium`, `low`);
- gera alertas na central de notificacoes;
- cria tarefas automaticas para casos prioritarios;
- registra historico de execucoes.

## 2. Onde o sistema aparece

- `Dashboard`:
  - bloco **Agente comercial / Top prioridades do dia** (fim da pagina);
- `Estatisticas`:
  - secao **Radar de atencao** com lista priorizada e acao recomendada;
- `Notificacoes`:
  - alertas de atencao por oportunidade e resumo diario;
- `Configuracoes`:
  - parametros do agente (horario, limites por etapa, maximo de tarefas/dia, ativar/desativar);
  - historico de execucoes do agente.

## 3. O que significa cada nivel

O nivel vem do `attentionScore` (0 a 100):

- `critical` (critico): `>= 70`
- `high` (alto): `>= 45` e `< 70`
- `medium` (medio): `>= 25` e `< 45`
- `low` (baixo): `< 25`

Interpretacao pratica:

- `critical`: risco alto de perda/estagnacao; agir hoje.
- `high`: risco relevante; agir em curto prazo.
- `medium`: acompanhar e tratar rapidamente.
- `low`: monitorar.

## 4. Como a analise e feita

A analise considera apenas oportunidades:

- com status aberto (`open` / "Em andamento");
- que nao estao em etapa de conclusao/fechamento finalizado.

### 4.1 Sinais usados no score

Para cada oportunidade, o agente soma pontos por sinais de risco:

1. **Proximo passo indefinido em etapa avancada**
- Etapas consideradas: `Proposta enviada`, `Negociacao`, `Fechamento`, `Conclusao`.
- Se `nextStep` estiver vazio ou com placeholder (ex.: "atualizar", "definir"):
  - `+26` pontos.

2. **Sem tarefa de follow-up vinculada**
- Se a oportunidade nao tiver tarefa vinculada:
  - `+12` pontos.

3. **Data de fechamento**
- Se data prevista ja venceu:
  - `+32` pontos.
- Se fecha em ate 3 dias:
  - `+12` (com tarefa) ou `+20` (sem tarefa).

4. **Tempo sem interacao (esfriamento)**
- Usa ultima atividade da oportunidade (ou `createdAt` como fallback).
- Calcula `daysWithoutInteraction`.
- Compara com limite por etapa configuravel em Configuracoes.
- Se exceder limite:
  - adiciona `14 + 2 * dias_excedentes`, limitado a `35`.

5. **Peso financeiro**
- Se valor da oportunidade for >= `1.5x` da media das abertas e ja houver risco:
  - `+8` pontos.

### 4.2 Limite por etapa (configuravel)

Padrao inicial:

- Lead: 7 dias
- Qualificacao: 6 dias
- Diagnostico: 6 dias
- Proposta: 4 dias
- Negociacao: 3 dias
- Fechamento: 2 dias

Esses limites podem ser alterados em Configuracoes.

### 4.3 Resultado da analise

Para cada oportunidade com score > 0, o sistema gera:

- `attentionScore`;
- `level` (critical/high/medium/low);
- ate 3 motivos principais (`reasons`);
- acao recomendada (`recommendedAction`);
- metadados de tempo:
  - `daysWithoutInteraction`;
  - `daysToClose`.

## 5. Alertas e notificacoes

A central de notificacoes recebe:

1. **Resumo diario do pipeline**
- exemplo: "Top 10 do dia: foco comercial"
- inclui contagem de criticos/altos/medios.

2. **Alertas por oportunidade**
- gerados para itens priorizados (top da lista);
- mostram motivo principal e score.

Se o agente estiver desativado em Configuracoes, esses alertas especificos do agente nao sao adicionados.

## 6. Automacao (agente ativo)

O agente executa rotina diaria com regras:

- respeita horario configurado (`runAt`, ex.: `08:00`);
- roda no maximo 1 vez por dia por usuario;
- so atua se o agente estiver habilitado.

### 6.1 Criacao automatica de tarefas

Durante a rotina:

- analisa top oportunidades de atencao;
- cria tarefas para niveis `critical` e `high`;
- evita duplicar quando ja existe tarefa do agente para a mesma oportunidade;
- respeita limite diario configurado (`maxTasksPerDay`);
- titulo das tarefas criadas:
  - `[AGENTE PIPELINE] <titulo da oportunidade>`

Prioridade e prazo padrao:

- `critical`: prioridade `Alta`, vencimento no mesmo dia;
- `high`: prioridade `Media`, vencimento no dia seguinte.

## 7. Historico de execucoes

Cada tentativa de rotina registra:

- data/hora (`ranAt`);
- se executou ou nao (`executed`);
- quantos negocios analisou (`reviewed`);
- quantas tarefas criou (`createdTasks`);
- motivo (`reason`).

### 7.1 Persistencia

O historico e salvo em dois niveis:

- **Supabase** (principal): tabela `public.pipeline_agent_runs`;
- **LocalStorage** (fallback): usado quando nao ha sessao/conexao.

Na tela de Configuracoes, o historico exibido prioriza dados remotos quando disponiveis.

## 8. Configuracoes disponiveis

Em **Configuracoes > Agente**:

- `Agente ativo` (on/off);
- `Horario da rotina` (`HH:mm`);
- `Max. tarefas automaticas/dia` (1 a 20);
- limites de dias por etapa (1 a 30).

## 9. Regras de negocio importantes

- O agente nao substitui a estrategia comercial; ele prioriza foco.
- Score alto nao significa perda certa, significa prioridade de acao.
- Sem atividade registrada, o sistema entende maior risco de esfriamento.
- Dados de atividades/tarefas impactam diretamente o score.

## 10. Boas praticas para melhor resultado

- sempre registrar interacoes relevantes;
- manter `nextStep` concreto (acao + prazo);
- vincular tarefas as oportunidades;
- revisar limites por etapa conforme o seu ciclo de vendas;
- acompanhar o historico do agente para calibrar automacoes.
