"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CrmShell } from "@/components/crm-shell";
import { getPipelineAttention, getPipelineStatistics, runPipelineAttentionAgent } from "@/lib/crm-data-source";
import type { PipelineAttentionData, PipelineAttentionItem, PipelineStatistics } from "@/types/crm-app";

const periodOptions = [
  { id: "30d", label: "30 dias", days: 30 },
  { id: "6m", label: "6 meses", days: 180 },
  { id: "12m", label: "12 meses", days: 365 }
] as const;

const emptyStatistics: PipelineStatistics = {
  leadsThisMonth: 0,
  opportunitiesCount: 0,
  proposalsCount: 0,
  salesCount: 0,
  totalPipeline: 0,
  weightedPipeline: 0,
  averageProbability: 0,
  forecastMonth: 0,
  openOpportunities: 0,
  dueThisMonth: 0,
  nearestCloseDate: null,
  byStage: [],
  leadSources: [],
  conversions: [],
  sourceConversions: []
};

const emptyAttention: PipelineAttentionData = {
  generatedAt: "",
  summary: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    monitored: 0
  },
  items: []
};

export function StatisticsScreen() {
  const [stats, setStats] = useState<PipelineStatistics>(emptyStatistics);
  const [attention, setAttention] = useState<PipelineAttentionData>(emptyAttention);
  const [periodId, setPeriodId] = useState<(typeof periodOptions)[number]["id"]>("30d");
  const activePeriod = periodOptions.find((item) => item.id === periodId) ?? periodOptions[0];

  useEffect(() => {
    void runPipelineAttentionAgent();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [nextStats, nextAttention] = await Promise.all([getPipelineStatistics(activePeriod.days), getPipelineAttention(12)]);

      if (isMounted) {
        setStats(nextStats);
        setAttention(nextAttention);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [activePeriod.days]);

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
            <div style={eyebrowStyle}>Performance no periodo</div>
            <h2 style={titleStyle}>Leads, oportunidades e vendas</h2>
          </div>
          <div style={periodFilterRowStyle}>
            {periodOptions.map((option) => {
              const isActive = option.id === periodId;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPeriodId(option.id)}
                  style={{
                    ...periodFilterButtonStyle,
                    background: isActive ? "rgba(79, 70, 229, 0.08)" : "#ffffff",
                    color: isActive ? "var(--accent)" : "var(--foreground)",
                    borderColor: isActive ? "rgba(79, 70, 229, 0.18)" : "var(--line)"
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={kpiGridStyle}>
          <MetricCard
            label="Leads do periodo"
            value={String(stats.leadsThisMonth)}
            detail={`Oportunidades criadas nos ultimos ${activePeriod.label}.`}
          />
          <MetricCard
            label="Oportunidades"
            value={String(stats.opportunitiesCount)}
            detail={`Leads que avancaram para contato/qualificacao em ${activePeriod.label}.`}
          />
          <MetricCard
            label="Propostas"
            value={String(stats.proposalsCount)}
            detail={`Negocios que chegaram em proposta enviada em ${activePeriod.label}.`}
          />
          <MetricCard
            label="Vendas"
            value={String(stats.salesCount)}
            detail={`Oportunidades concluidas como ganho em ${activePeriod.label}.`}
          />
        </div>
      </section>

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
            label="Faturamento previsto"
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

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Radar de atencao</div>
            <h2 style={titleStyle}>Onde agir agora no pipeline</h2>
          </div>
          <div style={summaryBadgeStyle}>{attention.summary.monitored} negocio(s) monitorado(s)</div>
        </div>
        <div style={attentionSummaryGridStyle}>
          <AttentionSummaryCard label="Criticos" value={String(attention.summary.critical)} tone="critical" />
          <AttentionSummaryCard label="Altos" value={String(attention.summary.high)} tone="high" />
          <AttentionSummaryCard label="Medios" value={String(attention.summary.medium)} tone="medium" />
          <AttentionSummaryCard label="Baixos" value={String(attention.summary.low)} tone="low" />
        </div>
        <div style={attentionListStyle}>
          {attention.items.length ? (
            attention.items.map((item) => (
              <article key={item.opportunityId} style={attentionCardStyle}>
                <div style={attentionCardHeaderStyle}>
                  <div>
                    <div style={stageTitleStyle}>{item.title}</div>
                    <div style={stageSubtleStyle}>
                      {item.company} • {item.stage} • {formatCurrency(item.amount)}
                    </div>
                  </div>
                  <div style={attentionPillStyle(item.level)}>Score {item.attentionScore}</div>
                </div>
                <div style={attentionMetaStyle}>
                  <span>Responsavel: {item.owner}</span>
                  <span>
                    {item.daysWithoutInteraction !== undefined
                      ? `Sem interacao ha ${item.daysWithoutInteraction} dia(s)`
                      : "Interacao recente sem data registrada"}
                  </span>
                  <span>
                    {item.daysToClose !== undefined
                      ? item.daysToClose >= 0
                        ? `Fechamento em ${item.daysToClose} dia(s)`
                        : `Fechamento vencido ha ${Math.abs(item.daysToClose)} dia(s)`
                      : "Sem previsao de fechamento"}
                  </span>
                </div>
                <div style={attentionReasonListStyle}>
                  {item.reasons.map((reason) => (
                    <div key={reason} style={attentionReasonItemStyle}>
                      {reason}
                    </div>
                  ))}
                </div>
                <div style={attentionActionRowStyle}>
                  <div style={sourceConversionMetaStyle}>{item.recommendedAction}</div>
                  <Link href={item.href} style={attentionActionLinkStyle}>
                    Abrir negocio
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <div style={emptyStageStyle}>
              Sem alertas de atencao no momento. O pipeline aberto esta dentro das regras de acompanhamento.
            </div>
          )}
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
            <div style={eyebrowStyle}>Conversao do funil</div>
            <h2 style={titleStyle}>Taxa de avanco entre etapas em {activePeriod.label}</h2>
          </div>
        </div>
        <div style={conversionGridStyle}>
          {stats.conversions.map((item) => (
            <article key={item.label} style={conversionCardStyle}>
              <div style={cardLabelStyle}>{item.label}</div>
              <div style={cardValueStyle}>{item.rate}%</div>
              <div style={cardTrendStyle}>
                {item.converted} de {item.base} avancaram nesta etapa
              </div>
            </article>
          ))}
        </div>
        <div style={conversionFootnoteStyle}>
          A conversao do periodo usa as oportunidades criadas na janela selecionada e o estagio atual de cada uma. Para taxa por coorte
          completa, o CRM precisaria registrar o historico de passagem por etapa.
        </div>
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
            <h2 style={titleStyle}>Canais que geraram leads em {activePeriod.label}</h2>
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
            <div style={emptyStageStyle}>Ainda nao ha origem de leads cadastrada no periodo selecionado.</div>
          )}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Conversao por origem</div>
            <h2 style={titleStyle}>Qualidade de cada canal em {activePeriod.label}</h2>
          </div>
        </div>
        <div style={sourceConversionGridStyle}>
          {stats.sourceConversions.length ? (
            stats.sourceConversions.map((group) => (
              <article key={group.source} style={sourceConversionCardStyle}>
                <div style={stageHeaderStyle}>
                  <div style={stageTitleStyle}>{group.source}</div>
                  <div style={sourceConversionBadgeStyle}>{group.conversions[0]?.base ?? 0} lead(s)</div>
                </div>
                <div style={sourceConversionListStyle}>
                  {group.conversions.map((item) => (
                    <div key={item.label} style={sourceConversionRowStyle}>
                      <div>
                        <div style={cardLabelStyle}>{item.label}</div>
                        <div style={sourceConversionMetaStyle}>
                          {item.converted} de {item.base}
                        </div>
                      </div>
                      <div style={sourceConversionRateStyle}>{item.rate}%</div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div style={emptyStageStyle}>Ainda nao ha base suficiente para cruzar conversao por origem.</div>
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

function AttentionSummaryCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: PipelineAttentionItem["level"];
}) {
  return (
    <article style={attentionSummaryCardStyle(tone)}>
      <div style={cardLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </article>
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

function attentionPillStyle(level: PipelineAttentionItem["level"]): React.CSSProperties {
  if (level === "critical") {
    return {
      ...attentionPillBaseStyle,
      background: "rgba(220, 38, 38, 0.14)",
      color: "#991b1b"
    };
  }

  if (level === "high") {
    return {
      ...attentionPillBaseStyle,
      background: "rgba(234, 88, 12, 0.14)",
      color: "#9a3412"
    };
  }

  if (level === "medium") {
    return {
      ...attentionPillBaseStyle,
      background: "rgba(202, 138, 4, 0.18)",
      color: "#854d0e"
    };
  }

  return {
    ...attentionPillBaseStyle,
    background: "rgba(20, 184, 166, 0.12)",
    color: "#0f766e"
  };
}

function attentionSummaryCardStyle(level: PipelineAttentionItem["level"]): React.CSSProperties {
  return {
    ...statBlockStyle,
    borderColor:
      level === "critical"
        ? "rgba(220, 38, 38, 0.25)"
        : level === "high"
          ? "rgba(234, 88, 12, 0.25)"
          : level === "medium"
            ? "rgba(202, 138, 4, 0.25)"
            : "rgba(20, 184, 166, 0.25)"
  };
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

const periodFilterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap"
};

const periodFilterButtonStyle: React.CSSProperties = {
  minHeight: 38,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "8px 12px",
  background: "#ffffff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer"
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

const conversionGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14
};

const sourceConversionGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
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

const conversionCardStyle: React.CSSProperties = {
  ...stageCardStyle
};

const sourceConversionCardStyle: React.CSSProperties = {
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

const conversionFootnoteStyle: React.CSSProperties = {
  marginTop: 12,
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.6
};

const sourceConversionBadgeStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(20, 184, 166, 0.12)",
  color: "#0f766e",
  fontSize: 12,
  fontWeight: 800
};

const sourceConversionListStyle: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 10
};

const sourceConversionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid var(--line)"
};

const sourceConversionMetaStyle: React.CSSProperties = {
  marginTop: 4,
  color: "var(--muted)",
  fontSize: 12
};

const sourceConversionRateStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  fontWeight: 900,
  letterSpacing: "-0.02em",
  color: "var(--accent)"
};

const attentionSummaryGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12
};

const attentionListStyle: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 12
};

const attentionCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #ffffff 0%, var(--surface-elevated) 100%)"
};

const attentionCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12
};

const attentionPillBaseStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800
};

const attentionMetaStyle: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  color: "var(--muted)",
  fontSize: 12
};

const attentionReasonListStyle: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 8
};

const attentionReasonItemStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "#ffffff",
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--foreground)"
};

const attentionActionRowStyle: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap"
};

const attentionActionLinkStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(79, 70, 229, 0.22)",
  color: "var(--accent)",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800
};
