import type { DashboardMetric, HighlightCard, PipelineColumn } from "@/types/crm";

export const crmHighlights: HighlightCard[] = [
  {
    eyebrow: "Visao 360",
    title: "Cliente consolidado",
    description:
      "Timeline unica com historico de contatos, tarefas, oportunidades e proximas acoes."
  },
  {
    eyebrow: "Automacao",
    title: "Follow-up previsivel",
    description:
      "Regras assicronas para lembretes, criacao de tarefas e alertas de inatividade comercial."
  },
  {
    eyebrow: "Gestao visual",
    title: "Pipeline confiavel",
    description:
      "Etapas claras, probabilidade por fase e dados obrigatorios antes de avancar a negociacao."
  }
];

export const strategicMetrics: DashboardMetric[] = [
  {
    label: "Pipeline total",
    value: "R$ 480 mil",
    change: "+12% vs. fevereiro"
  },
  {
    label: "Taxa de conversao",
    value: "31%",
    change: "+4 p.p. no trimestre"
  },
  {
    label: "Ciclo medio",
    value: "19 dias",
    change: "-3 dias"
  }
];

export const pipelineColumns: PipelineColumn[] = [
  {
    id: "lead",
    name: "Lead qualificado",
    opportunities: [
      {
        id: "opp-1",
        title: "Diagnostico inicial",
        company: "Atlas Logistica",
        valueLabel: "R$ 38 mil"
      },
      {
        id: "opp-2",
        title: "Reuniao de escopo",
        company: "Grupo Horizonte",
        valueLabel: "R$ 72 mil"
      }
    ]
  },
  {
    id: "proposal",
    name: "Proposta enviada",
    opportunities: [
      {
        id: "opp-3",
        title: "Aguardando validacao",
        company: "Maresia Energia",
        valueLabel: "R$ 125 mil"
      }
    ]
  },
  {
    id: "negotiation",
    name: "Negociacao",
    opportunities: [
      {
        id: "opp-4",
        title: "Ajuste comercial",
        company: "Nova Fase Consultoria",
        valueLabel: "R$ 56 mil"
      }
    ]
  }
];
