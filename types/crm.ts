export type HighlightCard = {
  eyebrow: string;
  title: string;
  description: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  change: string;
};

export type PipelineOpportunity = {
  id: string;
  title: string;
  company: string;
  valueLabel: string;
};

export type PipelineColumn = {
  id: string;
  name: string;
  opportunities: PipelineOpportunity[];
};
