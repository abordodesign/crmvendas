"use client";

import { useEffect, useState } from "react";
import { CrmShell } from "@/components/crm-shell";
import { getPipelineStatistics } from "@/lib/crm-data-source";
import type { PipelineStatistics } from "@/types/crm-app";

const emptyStatistics: PipelineStatistics = {
  totalPipeline: 0,
  weightedPipeline: 0,
  averageProbability: 0,
  forecastMonth: 0,
  openOpportunities: 0,
  dueThisMonth: 0,
  nearestCloseDate: null,
  byStage: [],
  leadSources: []
};

export function StatisticsScreen() {
  const [stats, setStats] = useState<PipelineStatistics>(emptyStatistics);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const next = await getPipelineStatistics();

      if (isMounted) {
        setStats(next);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <CrmShell
      activePath="/dashboard/statistics"
      title="Estatisticas"
      subtitle="Leitura executiva do pipeline com probabilidade e previsao de receita."
      primaryAction="Previsibilidade comercial"
    >
      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Indicadores de receita</div>
            <h2 style={titleStyle}>Visao executiva do funil</h2>
          </div>
          <div style={summaryBadgeStyle}>{stats.openOpportunities} oportunidades abertas</div>
        </div>
        <div style={kpiGridStyle}>
          <MetricCard
            label="Pipeline total"
            value={formatCurrency(stats.totalPipeline)}
            detail="Soma do valor potencial das oportunidades abertas."
          />
          <MetricCard
            label="Probabilidade media"
            value={`${stats.averageProbability}%`}
            detail="Media ponderada por valor com base na etapa atual."
          />
          <MetricCard
            label="Previsao do mes"
            value={formatCurrency(stats.forecastMonth)}
            detail="Valor ponderado das oportunidades com fechamento neste mes."
          />
          <MetricCard
            label="Pipeline ponderado"
            value={formatCurrency(stats.weightedPipeline)}
            detail="Receita potencial ajustada pela chance real de fechamento."
          />
        </div>
      </section>

      <section style={statsGridStyle}>
        <article style={panelStyle}>
          <div style={eyebrowStyle}>Cadencia de fechamento</div>
          <h2 style={titleStyle}>Janela comercial</h2>
          <div style={compactGridStyle}>
            <StatBlock label="Fecham neste mes" value={String(stats.dueThisMonth)} />
            <StatBlock label="Fechamento mais proximo" value={formatDateLabel(stats.nearestCloseDate)} />
            <StatBlock
              label="Ticket esperado"
              value={stats.openOpportunities ? formatCurrency(stats.weightedPipeline / stats.openOpportunities) : "R$ 0,00"}
            />
            <StatBlock
              label="Conversao estimada"
              value={stats.totalPipeline ? `${Math.round((stats.forecastMonth / stats.totalPipeline) * 100)}%` : "0%"}
            />
          </div>
        </article>

        <article style={panelStyle}>
          <div style={eyebrowStyle}>Leitura executiva</div>
          <h2 style={titleStyle}>Resumo operacional</h2>
          <div style={notesGridStyle}>
            <article style={noteCardStyle}>
              <div style={noteTitleStyle}>Previsibilidade</div>
              <div style={noteTextStyle}>
                {stats.totalPipeline
                  ? `O funil aberto soma ${formatCurrency(stats.totalPipeline)} e gera uma previsao ponderada de ${formatCurrency(
                      stats.weightedPipeline
                    )}.`
                  : "Ainda nao ha oportunidades abertas para previsao de receita."}
              </div>
            </article>
            <article style={noteCardStyle}>
              <div style={noteTitleStyle}>Fechamentos do mes</div>
              <div style={noteTextStyle}>
                {stats.dueThisMonth
                  ? `${stats.dueThisMonth} oportunidade${stats.dueThisMonth === 1 ? "" : "s"} alimentam a previsao mensal de ${formatCurrency(
                      stats.forecastMonth
                    )}.`
                  : "Nao ha oportunidades com fechamento previsto para este mes."}
              </div>
            </article>
          </div>
        </article>
      </section>

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Detalhamento por etapa</div>
            <h2 style={titleStyle}>Peso financeiro do pipeline</h2>
          </div>
        </div>
        <div style={stageGridStyle}>
          {stats.byStage.length ? (
            stats.byStage.map((stage) => (
              <article key={stage.stage} style={stageCardStyle}>
                <div style={stageHeaderStyle}>
                  <div style={stageTitleStyle}>{stage.stage}</div>
                  <div style={stageProbabilityStyle}>{stage.probability}%</div>
                </div>
                <div style={stageMetricStyle}>{formatCurrency(stage.total)}</div>
                <div style={stageSubtleStyle}>{stage.count} oportunidade(s) na etapa</div>
                <div style={stageFootStyle}>Ponderado: {formatCurrency(stage.weightedTotal)}</div>
              </article>
            ))
          ) : (
            <div style={emptyStageStyle}>Sem oportunidades abertas para distribuir no pipeline.</div>
          )}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Origem dos leads</div>
            <h2 style={titleStyle}>Canais que abastecem o pipeline</h2>
          </div>
        </div>
        <div style={sourceGridStyle}>
          {stats.leadSources.length ? (
            stats.leadSources.map((item) => (
              <article key={item.source} style={sourceCardStyle}>
                <div style={stageHeaderStyle}>
                  <div style={stageTitleStyle}>{item.source}</div>
                  <div style={stageProbabilityStyle}>{item.percentage}%</div>
                </div>
                <div style={stageMetricStyle}>{item.count} lead(s)</div>
                <div style={stageSubtleStyle}>Valor em aberto: {formatCurrency(item.total)}</div>
              </article>
            ))
          ) : (
            <div style={emptyStageStyle}>Ainda nao ha origem de leads cadastrada nas oportunidades abertas.</div>
          )}
        </div>
      </section>
    </CrmShell>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article style={cardStyle}>
      <div style={cardLabelStyle}>{label}</div>
      <div style={cardValueStyle}>{value}</div>
      <div style={cardTrendStyle}>{detail}</div>
    </article>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={statBlockStyle}>
      <div style={cardLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Sem data";
  }

  return parsed.toLocaleDateString("pt-BR");
}

const panelStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid var(--line)"
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap"
};

const eyebrowStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "1.35rem",
  fontWeight: 900,
  letterSpacing: "-0.03em"
};

const summaryBadgeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 800
};

const kpiGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16
};

const compactGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12
};

const notesGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14
};

const stageGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14
};

const sourceGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14
};

const cardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)"
};

const statBlockStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)"
};

const cardLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const cardValueStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: "1.8rem",
  fontWeight: 900,
  letterSpacing: "-0.04em"
};

const statValueStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: "1.2rem",
  fontWeight: 900,
  letterSpacing: "-0.03em"
};

const cardTrendStyle: React.CSSProperties = {
  marginTop: 8,
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5
};

const noteCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "linear-gradient(180deg, #ffffff 0%, var(--surface-elevated) 100%)",
  border: "1px solid var(--line)"
};

const noteTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: "-0.01em"
};

const noteTextStyle: React.CSSProperties = {
  marginTop: 8,
  color: "var(--muted)",
  lineHeight: 1.6,
  fontSize: 13
};

const stageCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)"
};

const sourceCardStyle: React.CSSProperties = {
  ...stageCardStyle
};

const stageHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10
};

const stageTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  letterSpacing: "-0.02em"
};

const stageProbabilityStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 800
};

const stageMetricStyle: React.CSSProperties = {
  marginTop: 12,
  fontSize: "1.45rem",
  fontWeight: 900,
  letterSpacing: "-0.03em"
};

const stageSubtleStyle: React.CSSProperties = {
  marginTop: 8,
  color: "var(--muted)",
  fontSize: 12
};

const stageFootStyle: React.CSSProperties = {
  marginTop: 10,
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 800
};

const emptyStageStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 18,
  border: "1px dashed var(--line)",
  color: "var(--muted)",
  fontSize: 13
};
