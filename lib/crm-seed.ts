import type {
  ActivityItem,
  AgendaItem,
  CustomerItem,
  DashboardData,
  KpiCard,
  OpportunityItem,
  PipelineColumn,
  TaskItem
} from "@/types/crm-app";

export const seedKpis: KpiCard[] = [
  { label: "Pipeline total", value: "R$ 0,00", trend: "Nenhuma oportunidade cadastrada" },
  { label: "Ticket medio", value: "R$ 0,00", trend: "Sem base para calculo" },
  { label: "Receita recorrente", value: "R$ 0,00", trend: "Sem contratos recorrentes" },
  { label: "Tarefas em aberto", value: "0", trend: "Sem tarefas cadastradas" }
];

export const seedPipeline: PipelineColumn[] = [];

export const seedTasks: TaskItem[] = [];

export const seedAgenda: AgendaItem[] = [];

export const seedActivity: ActivityItem[] = [];

export const seedCustomers: CustomerItem[] = [];

export const seedOpportunities: OpportunityItem[] = [];

export const seedDashboardData: DashboardData = {
  kpis: seedKpis,
  pipeline: seedPipeline,
  tasks: seedTasks,
  agenda: seedAgenda,
  activity: seedActivity
};
