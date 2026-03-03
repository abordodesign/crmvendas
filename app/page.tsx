import { DashboardShell } from "@/components/dashboard-shell";
import { crmHighlights, pipelineColumns, strategicMetrics } from "@/lib/crm-data";

export default function Home() {
  return (
    <DashboardShell
      highlights={crmHighlights}
      metrics={strategicMetrics}
      pipeline={pipelineColumns}
    />
  );
}
