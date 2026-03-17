"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CrmShell } from "@/components/crm-shell";
import { getDashboardData, subscribeCrmDataChanged } from "@/lib/crm-data-source";
import { seedDashboardData } from "@/lib/crm-seed";
import { getCrmSettings, saveCrmSettings, subscribeCrmSettingsChanged } from "@/lib/crm-settings";
import type { DashboardData } from "@/types/crm-app";

export function MetasScreen() {
  const [data, setData] = useState<DashboardData>(seedDashboardData);
  const [goalInput, setGoalInput] = useState("");
  const [savedGoal, setSavedGoal] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const nextData = await getDashboardData();

      if (isMounted) {
        setData(nextData);
      }
    }

    void load();
    const unsubscribe = subscribeCrmDataChanged(() => {
      void load();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      const settings = await getCrmSettings();

      if (!isMounted) {
        return;
      }

      setSavedGoal(settings.pipelineGoal);
      setGoalInput(settings.pipelineGoal > 0 ? formatDecimalInput(settings.pipelineGoal) : "");
    }

    void loadSettings();
    const unsubscribe = subscribeCrmSettingsChanged(() => {
      void loadSettings();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const monthlyGoal = parseCurrencyInput(goalInput);
  const achievedRevenue = useMemo(
    () => currencyToNumber(data.kpis.find((item) => item.label === "Receita do mes")?.value ?? "R$ 0,00"),
    [data.kpis]
  );
  const existingPipeline = useMemo(
    () => data.pipeline.reduce((sum, column) => sum + currencyToNumber(column.total), 0),
    [data.pipeline]
  );
  const remainingRevenue = Math.max(monthlyGoal - achievedRevenue, 0);
  const requiredPipeline = remainingRevenue * 3;
  const pipelineHealth = requiredPipeline > 0 ? (existingPipeline / requiredPipeline) * 100 : achievedRevenue >= monthlyGoal && monthlyGoal > 0 ? 100 : 0;
  const healthTone = getHealthTone(pipelineHealth, monthlyGoal);
  const chartMax = Math.max(monthlyGoal, achievedRevenue, requiredPipeline, existingPipeline, 1);

  const chartItems = [
    { label: "Meta", value: monthlyGoal, color: "#1d4ed8" },
    { label: "Conquistado", value: achievedRevenue, color: "#0f766e" },
    { label: "Pipeline Necessario", value: requiredPipeline, color: "#7c3aed" },
    { label: "Pipeline Existente", value: existingPipeline, color: "#c2410c" }
  ];

  const hasChanges = Math.abs(monthlyGoal - savedGoal) > 0.0001;

  function handleSubmit() {
    setFeedback(null);

    startTransition(() => {
      void (async () => {
        const currentSettings = await getCrmSettings();
        const nextGoal = Math.max(monthlyGoal, 0);
        await saveCrmSettings({
          ...currentSettings,
          pipelineGoal: nextGoal
        });
        setSavedGoal(nextGoal);
        setGoalInput(nextGoal > 0 ? formatDecimalInput(nextGoal) : "");
        setFeedback("Meta salva no banco de dados.");
      })();
    });
  }

  return (
    <CrmShell
      activePath="/dashboard/metas"
      title="Metas"
      subtitle="Defina a meta e acompanhe a saude do pipeline em uma tela dedicada."
      primaryAction="Meta comercial"
    >
      <section style={heroPanelStyle}>
        <div style={heroHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Saude do pipeline</div>
            <h2 style={titleStyle}>Meta editavel, leitura travada</h2>
            <div style={subtitleStyle}>
              Apenas o campo de meta pode ser alterado. Os demais indicadores ficam travados e so atualizam quando voce salvar a nova meta.
            </div>
          </div>
          <div style={{ ...healthBadgeStyle, ...healthBadgeToneStyle(healthTone) }}>
            {monthlyGoal <= 0 ? "Defina a meta" : `${formatPercent(pipelineHealth)} de saude`}
          </div>
        </div>

        <div style={metricsGridStyle}>
          <div style={formulaPanelStyle}>
            <div style={formulaHeaderStyle}>
              <div style={formulaTitleStyle}>Calculo</div>
              <button type="button" onClick={handleSubmit} disabled={!hasChanges || isPending} style={saveButtonStyle}>
                {isPending ? "Salvando..." : "Salvar meta"}
              </button>
            </div>
            <div style={formulaGridStyle}>
              <MetricRow
                label="Meta"
                marker="+"
                value={
                  <input
                    value={goalInput}
                    onChange={(event) => setGoalInput(event.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    style={metricInputStyle}
                  />
                }
              />
              <MetricRow label="Conquistado" marker="-" value={<div style={metricValueStyle}>{formatCurrency(achievedRevenue)}</div>} />
              <MetricRow label="A Realizar" marker="=" value={<div style={metricValueStyle}>{formatCurrency(remainingRevenue)}</div>} />
            </div>
            <div style={metaInfoRowStyle}>
              <span style={metaInfoStyle}>Meta salva: {formatCurrency(savedGoal)}</span>
              <span style={metaInfoStyle}>{hasChanges ? "Existem alteracoes pendentes" : "Sem alteracoes pendentes"}</span>
            </div>
            {feedback ? <div style={feedbackStyle}>{feedback}</div> : null}
          </div>

          <div style={multiplierWrapStyle}>
            <div style={multiplierBracketStyle} />
            <div style={multiplierTextStyle}>x 3</div>
          </div>

          <div style={formulaPanelStyle}>
            <div style={formulaTitleStyle}>Resultado</div>
            <div style={formulaGridStyle}>
              <MetricRow label="Pipeline Necessario" value={<div style={metricValueStyle}>{formatCurrency(requiredPipeline)}</div>} />
              <MetricRow label="Pipeline Existente" value={<div style={metricValueStyle}>{formatCurrency(existingPipeline)}</div>} />
              <MetricRow label="Saude do Pipeline" value={<div style={metricValueStyle}>{formatPercent(pipelineHealth)}</div>} />
            </div>
          </div>
        </div>
      </section>

      <section style={contentGridStyle}>
        <article style={panelStyle}>
          <div style={sectionTopStyle}>
            <div>
              <div style={eyebrowStyle}>Leitura executiva</div>
              <h2 style={titleStyle}>Resumo da meta</h2>
            </div>
          </div>
          <div style={summaryGridStyle}>
            <SummaryCard label="Meta mensal" value={formatCurrency(monthlyGoal)} detail="Valor alvo informado manualmente." />
            <SummaryCard label="Ja conquistado" value={formatCurrency(achievedRevenue)} detail="Receita fechada no mes atual." />
            <SummaryCard label="Falta realizar" value={formatCurrency(remainingRevenue)} detail="Meta menos o que ja foi conquistado." />
            <SummaryCard label="Saude travada" value={formatPercent(pipelineHealth)} detail="Leitura automatica do pipeline em relacao a meta." tone={healthTone} />
          </div>
        </article>

        <article style={panelStyle}>
          <div style={sectionTopStyle}>
            <div>
              <div style={eyebrowStyle}>Grafico</div>
              <h2 style={titleStyle}>Comparativo da meta</h2>
            </div>
          </div>
          <div style={chartStyle}>
            {chartItems.map((item) => {
              const barHeight = `${Math.max((item.value / chartMax) * 100, item.value > 0 ? 8 : 0)}%`;

              return (
                <div key={item.label} style={chartColumnStyle}>
                  <div style={chartTrackStyle}>
                    <div
                      style={{
                        ...chartBarStyle,
                        height: barHeight,
                        background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}cc 100%)`
                      }}
                    />
                  </div>
                  <div style={chartValueStyle}>{formatCurrency(item.value)}</div>
                  <div style={chartLabelStyle}>{item.label}</div>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </CrmShell>
  );
}

function MetricRow({
  label,
  value,
  marker
}: {
  label: string;
  value: React.ReactNode;
  marker?: string;
}) {
  return (
    <div style={metricRowStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricMarkerStyle}>{marker ?? ""}</div>
      {value}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: ReturnType<typeof getHealthTone>;
}) {
  return (
    <div style={{ ...summaryCardStyle, ...summaryToneStyle(tone) }}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
      <div style={summaryDetailStyle}>{detail}</div>
    </div>
  );
}

function parseCurrencyInput(value: string) {
  if (!value.trim()) {
    return 0;
  }

  const sanitized = value.replace(/[^\d,.-]/g, "");
  const hasComma = sanitized.includes(",");
  const normalized = hasComma ? sanitized.replace(/\./g, "").replace(",", ".") : sanitized.replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function currencyToNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.max(0, value))}%`;
}

function formatDecimalInput(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function getHealthTone(value: number, goal: number) {
  if (goal <= 0) {
    return "neutral" as const;
  }

  if (value >= 100) {
    return "healthy" as const;
  }

  if (value >= 70) {
    return "warning" as const;
  }

  return "risk" as const;
}

function healthBadgeToneStyle(tone: ReturnType<typeof getHealthTone>): React.CSSProperties {
  if (tone === "healthy") {
    return {
      background: "rgba(20, 184, 166, 0.12)",
      color: "#0f766e",
      borderColor: "rgba(20, 184, 166, 0.22)"
    };
  }

  if (tone === "warning") {
    return {
      background: "rgba(202, 138, 4, 0.14)",
      color: "#854d0e",
      borderColor: "rgba(202, 138, 4, 0.22)"
    };
  }

  if (tone === "risk") {
    return {
      background: "rgba(220, 38, 38, 0.12)",
      color: "#991b1b",
      borderColor: "rgba(220, 38, 38, 0.22)"
    };
  }

  return {
    background: "rgba(79, 70, 229, 0.08)",
    color: "var(--accent)",
    borderColor: "rgba(79, 70, 229, 0.18)"
  };
}

function summaryToneStyle(tone: ReturnType<typeof getHealthTone>): React.CSSProperties {
  if (tone === "healthy") {
    return { borderColor: "rgba(20, 184, 166, 0.22)" };
  }

  if (tone === "warning") {
    return { borderColor: "rgba(202, 138, 4, 0.22)" };
  }

  if (tone === "risk") {
    return { borderColor: "rgba(220, 38, 38, 0.22)" };
  }

  return {};
}

const heroPanelStyle: React.CSSProperties = {
  padding: 24,
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid var(--line)",
  display: "grid",
  gap: 18
};

const heroHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap"
};

const panelStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid var(--line)"
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 18,
  alignItems: "center"
};

const formulaPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 14
};

const formulaHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap"
};

const formulaTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--muted)"
};

const saveButtonStyle: React.CSSProperties = {
  minHeight: 40,
  border: 0,
  borderRadius: 12,
  padding: "10px 14px",
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const formulaGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14
};

const metricRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "116px 20px minmax(0, 1fr)",
  gap: 8,
  alignItems: "center"
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.3
};

const metricMarkerStyle: React.CSSProperties = {
  textAlign: "center",
  color: "var(--muted)",
  fontSize: 20,
  fontWeight: 700
};

const metricInputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid var(--line)",
  padding: "10px 12px",
  outline: "none",
  font: "inherit",
  fontWeight: 700,
  textAlign: "right",
  background: "#ffffff",
  width: "100%"
};

const metricValueStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid #d9d1c4",
  background: "#f3f0ea",
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  fontWeight: 700
};

const multiplierWrapStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  alignItems: "center",
  gap: 10,
  minWidth: 56
};

const multiplierBracketStyle: React.CSSProperties = {
  width: 22,
  height: 150,
  borderTop: "3px solid var(--foreground)",
  borderBottom: "3px solid var(--foreground)",
  borderLeft: "3px solid var(--foreground)",
  borderTopLeftRadius: 14,
  borderBottomLeftRadius: 14,
  justifySelf: "end"
};

const multiplierTextStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800
};

const eyebrowStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "1.25rem",
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: "-0.03em"
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 10,
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.6,
  maxWidth: 760
};

const metaInfoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap"
};

const metaInfoStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 700
};

const feedbackStyle: React.CSSProperties = {
  color: "#0f766e",
  fontSize: 13,
  fontWeight: 700
};

const healthBadgeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid transparent",
  fontSize: 13,
  fontWeight: 800
};

const sectionTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14
};

const summaryCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 20,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)",
  display: "grid",
  gap: 8
};

const summaryLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: "1.55rem",
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: "-0.04em"
};

const summaryDetailStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5
};

const chartStyle: React.CSSProperties = {
  minHeight: 320,
  borderRadius: 22,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, rgba(79, 70, 229, 0.04) 0%, rgba(255,255,255,0.9) 100%)",
  padding: 18,
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
  alignItems: "end"
};

const chartColumnStyle: React.CSSProperties = {
  height: "100%",
  display: "grid",
  gap: 10,
  alignItems: "end"
};

const chartTrackStyle: React.CSSProperties = {
  height: 220,
  borderRadius: 16,
  background: "rgba(148, 163, 184, 0.12)",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  display: "flex",
  alignItems: "flex-end",
  padding: 10
};

const chartBarStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 0,
  borderRadius: 10
};

const chartValueStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.4
};

const chartLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1.4,
  textTransform: "uppercase"
};
