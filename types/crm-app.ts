export type KpiCard = {
  label: string;
  value: string;
  trend: string;
};

export type PipelineDeal = {
  id: string;
  company: string;
  title: string;
  owner: string;
  value: string;
  nextStep?: string;
};

export type PipelineColumn = {
  id: string;
  name: string;
  total: string;
  deals: PipelineDeal[];
};

export type TaskItem = {
  id: string;
  title: string;
  company: string;
  opportunityId?: string;
  opportunityTitle?: string;
  due: string;
  priority: string;
  dueDate?: string;
  dueTime?: string;
};

export type AgendaItem = {
  id: string;
  time: string;
  title: string;
  note: string;
  scheduledAt?: string;
  category?: string;
  accountId?: string;
  accountName?: string;
  opportunityId?: string;
  opportunityTitle?: string;
};

export type NotificationPriority = "high" | "medium" | "info";

export type NotificationItem = {
  id: string;
  ruleKey: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  priority: NotificationPriority;
  isRead?: boolean;
};

export type ActivityItem = {
  id: string;
  actor: string;
  action: string;
  target: string;
  when: string;
  createdAt?: string;
  eventType?: "movement" | "task" | "interaction" | "customer" | "opportunity";
};

export type CustomerItem = {
  id: string;
  legalName: string;
  tradeName: string;
  segment: string;
  companyContactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  document: string;
  owner: string;
  contacts: number;
  status: string;
};

export type OpportunityItem = {
  id: string;
  title: string;
  company: string;
  leadSource?: string;
  createdAt?: string;
  stage: string;
  owner: string;
  nextStep?: string;
  baseAmount: string;
  isRecurring: boolean;
  months: number;
  amount: string;
  probability: number;
  manualProbability?: number;
  expectedCloseDate: string;
  status: string;
  conclusionStatus?: string;
  conclusionReason?: string;
  concludedAt?: string;
};

export type OpportunityNote = {
  id: string;
  opportunityId: string;
  content: string;
  author: string;
  createdAt: string;
};

export type DashboardData = {
  kpis: KpiCard[];
  pipeline: PipelineColumn[];
  tasks: TaskItem[];
  agenda: AgendaItem[];
  activity: ActivityItem[];
};

export type PipelineStatistics = {
  leadsThisMonth: number;
  opportunitiesCount: number;
  proposalsCount: number;
  salesCount: number;
  totalPipeline: number;
  weightedPipeline: number;
  averageProbability: number;
  forecastMonth: number;
  openOpportunities: number;
  dueThisMonth: number;
  nearestCloseDate: string | null;
  byStage: Array<{
    stage: string;
    probability: number;
    count: number;
    total: number;
    weightedTotal: number;
  }>;
  leadSources: Array<{
    source: string;
    count: number;
    percentage: number;
    total: number;
  }>;
  conversions: Array<{
    label: string;
    rate: number;
    converted: number;
    base: number;
  }>;
  sourceConversions: Array<{
    source: string;
    conversions: Array<{
      label: string;
      rate: number;
      converted: number;
      base: number;
    }>;
  }>;
};
