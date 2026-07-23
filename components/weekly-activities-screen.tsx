"use client";

import { useEffect, useState, useTransition } from "react";
import { CrmShell } from "@/components/crm-shell";
import { hasPermission } from "@/lib/access-control";
import { getWeeklyActivityData, recordWeeklyActivity, subscribeCrmDataChanged } from "@/lib/crm-data-source";
import { useCrmRole } from "@/lib/use-crm-role";
import type { WeeklyActivityData, WeeklyActivityKey } from "@/types/crm-app";

const METRICS: Array<{
  key: WeeklyActivityKey;
  label: string;
  description: string;
  color: string;
  automatic?: boolean;
}> = [
  {
    key: "companies_added",
    label: "Empresas adicionadas",
    description: "Novas empresas cadastradas no CRM durante a semana.",
    color: "#4f46e5",
    automatic: true
  },
  {
    key: "opportunities_created",
    label: "Oportunidades criadas",
    description: "Novas oportunidades comerciais abertas no período.",
    color: "#7c3aed",
    automatic: true
  },
  {
    key: "first_contacts",
    label: "Primeiros contatos",
    description: "Primeira abordagem realizada com uma empresa.",
    color: "#0284c7"
  },
  {
    key: "conversations_started",
    label: "Conversas iniciadas",
    description: "Empresas que responderam e iniciaram uma conversa comercial.",
    color: "#0891b2"
  },
  {
    key: "diagnostics_scheduled",
    label: "Diagnósticos agendados",
    description: "Diagnósticos comerciais confirmados com data definida.",
    color: "#0d9488"
  },
  {
    key: "meetings_held",
    label: "Reuniões realizadas",
    description: "Reuniões que efetivamente aconteceram na semana.",
    color: "#16a34a"
  },
  {
    key: "proposals_sent",
    label: "Propostas enviadas",
    description: "Contabilizadas automaticamente ao mover para Proposta enviada, ou manualmente.",
    color: "#ca8a04"
  },
  {
    key: "followups_done",
    label: "Follow-ups feitos",
    description: "Retomadas de contato efetivamente realizadas.",
    color: "#ea580c"
  }
];

const RECORDABLE_METRICS = METRICS.filter((metric) => !metric.automatic);

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function WeeklyActivitiesScreen() {
  const role = useCrmRole();
  const [referenceDate, setReferenceDate] = useState(() => localDateKey(new Date()));
  const [data, setData] = useState<WeeklyActivityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activityType, setActivityType] = useState<Exclude<WeeklyActivityKey, "companies_added" | "opportunities_created">>(
    "first_contacts"
  );
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [occurredOn, setOccurredOn] = useState(() => localDateKey(new Date()));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canRecord = role ? hasPermission(role, "tasks:write") || hasPermission(role, "opportunities:write") : false;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const next = await getWeeklyActivityData(referenceDate);
      if (isMounted) {
        setData(next);
        setIsLoading(false);
      }
    }

    void load();
    const unsubscribe = subscribeCrmDataChanged(() => void load());

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [referenceDate]);

  function moveWeek(days: number) {
    const next = new Date(`${referenceDate}T12:00:00`);
    next.setDate(next.getDate() + days);
    setReferenceDate(localDateKey(next));
    setFeedback(null);
  }

  function handleRecord() {
    if (!canRecord) {
      setFeedback("Seu perfil pode acompanhar os indicadores, mas não registrar atividades.");
      return;
    }

    if (!subject.trim() || !occurredOn) {
      setFeedback("Informe a empresa ou assunto e a data da atividade.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await recordWeeklyActivity({ type: activityType, subject, notes, occurredOn });
        setFeedback(result.message);
        if (result.ok) {
          setSubject("");
          setNotes("");
        }
      })();
    });
  }

  const total = data ? Object.values(data.counts).reduce((sum, value) => sum + value, 0) : 0;
  const previousTotal = data ? Object.values(data.previousCounts).reduce((sum, value) => sum + value, 0) : 0;

  return (
    <CrmShell
      activePath="/dashboard/weekly-activities"
      title="Atividades da Semana"
      subtitle="Acompanhe as ações comerciais que constroem o faturamento antes de ele aparecer."
      primaryAction="Indicadores antecedentes"
    >
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Ritmo comercial</div>
          <div style={heroNumberStyle}>{isLoading ? "—" : total}</div>
          <div style={heroTextStyle}>
            atividades no período {data ? `${formatDate(data.weekStart)} a ${formatDate(data.weekEnd)}` : "selecionado"}
          </div>
          {!isLoading && data ? (
            <div style={comparisonStyle}>{comparisonText(total, previousTotal)} em relação à semana anterior</div>
          ) : null}
        </div>
        <div style={weekActionsStyle}>
          <button type="button" onClick={() => moveWeek(-7)} style={secondaryButtonStyle}>
            Semana anterior
          </button>
          <button type="button" onClick={() => setReferenceDate(localDateKey(new Date()))} style={currentWeekButtonStyle}>
            Semana atual
          </button>
          <button type="button" onClick={() => moveWeek(7)} style={secondaryButtonStyle}>
            Próxima semana
          </button>
        </div>
      </section>

      <section style={metricsGridStyle}>
        {METRICS.map((metric) => {
          const current = data?.counts[metric.key] ?? 0;
          const previous = data?.previousCounts[metric.key] ?? 0;
          const difference = current - previous;

          return (
            <article key={metric.key} style={{ ...metricCardStyle, borderTop: `4px solid ${metric.color}` }}>
              <div style={metricTopStyle}>
                <span style={{ ...metricIconStyle, background: `${metric.color}14`, color: metric.color }}>{current}</span>
                <span style={{ ...deltaStyle, color: difference >= 0 ? "#15803d" : "#b91c1c" }}>
                  {difference >= 0 ? "+" : ""}{difference} vs. anterior
                </span>
              </div>
              <h2 style={metricTitleStyle}>{metric.label}</h2>
              <p style={metricDescriptionStyle}>{metric.description}</p>
              {metric.automatic ? <div style={automaticPillStyle}>Automático</div> : null}
            </article>
          );
        })}
      </section>

      <section style={contentGridStyle}>
        <div style={panelStyle}>
          <div style={panelEyebrowStyle}>Registrar esforço comercial</div>
          <h2 style={panelTitleStyle}>Adicionar atividade realizada</h2>
          <p style={panelDescriptionStyle}>
            Registre somente ações concluídas. Empresas, oportunidades e movimentações para proposta já entram automaticamente.
          </p>

          <div style={formGridStyle}>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Tipo de atividade</span>
              <select value={activityType} onChange={(event) => setActivityType(event.target.value as typeof activityType)} style={inputStyle}>
                {RECORDABLE_METRICS.map((metric) => (
                  <option key={metric.key} value={metric.key}>{metric.label}</option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>Data realizada</span>
              <input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} style={inputStyle} />
            </label>
            <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              <span style={fieldLabelStyle}>Empresa ou assunto</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Ex.: Climatização XYZ"
                style={inputStyle}
              />
            </label>
            <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
              <span style={fieldLabelStyle}>Observação</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Contexto ou resultado da atividade"
                rows={3}
                style={inputStyle}
              />
            </label>
          </div>

          {feedback ? <div style={feedbackStyle}>{feedback}</div> : null}
          {!canRecord ? <div style={permissionWarningStyle}>Perfil em modo de acompanhamento: registro desabilitado.</div> : null}
          <button type="button" onClick={handleRecord} disabled={isPending || !canRecord} style={primaryButtonStyle}>
            {isPending ? "Registrando..." : "Registrar atividade"}
          </button>
        </div>

        <div style={panelStyle}>
          <div style={panelEyebrowStyle}>Histórico da semana</div>
          <h2 style={panelTitleStyle}>Atividades recentes</h2>
          <div style={recentListStyle}>
            {data?.recent.length ? data.recent.slice(0, 10).map((item) => (
              <article key={item.id} style={recentItemStyle}>
                <div style={recentHeaderStyle}>
                  <strong>{metricLabel(item.type)}</strong>
                  <span style={recentDateStyle}>{formatDateTime(item.occurredAt)}</span>
                </div>
                <div style={recentSubjectStyle}>{item.subject}</div>
                {item.notes ? <div style={recentNotesStyle}>{item.notes}</div> : null}
                <div style={recentActorStyle}>Registrado por {item.actor}</div>
              </article>
            )) : (
              <div style={emptyStyle}>{isLoading ? "Carregando atividades..." : "Nenhuma atividade registrada nesta semana."}</div>
            )}
          </div>
        </div>
      </section>
    </CrmShell>
  );
}

function metricLabel(key: WeeklyActivityKey) {
  return METRICS.find((metric) => metric.key === key)?.label ?? key;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function comparisonText(current: number, previous: number) {
  const difference = current - previous;
  if (difference === 0) return "Mesmo volume";
  return `${Math.abs(difference)} ${difference > 0 ? "a mais" : "a menos"}`;
}

const heroStyle: React.CSSProperties = { padding: 24, borderRadius: 28, color: "#fff", background: "linear-gradient(135deg, #312e81, #4f46e5 55%, #0f766e)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", boxShadow: "0 24px 50px rgba(49, 46, 129, 0.18)" };
const eyebrowStyle: React.CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.78 };
const heroNumberStyle: React.CSSProperties = { marginTop: 8, fontSize: "3.2rem", lineHeight: 1, fontWeight: 950, letterSpacing: "-0.07em" };
const heroTextStyle: React.CSSProperties = { marginTop: 8, fontSize: 15, fontWeight: 700 };
const comparisonStyle: React.CSSProperties = { marginTop: 10, fontSize: 12, opacity: 0.82 };
const weekActionsStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,.28)", borderRadius: 12, padding: "10px 12px", background: "rgba(255,255,255,.1)", color: "#fff", fontWeight: 800, cursor: "pointer" };
const currentWeekButtonStyle: React.CSSProperties = { ...secondaryButtonStyle, background: "#fff", color: "#3730a3" };
const metricsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 };
const metricCardStyle: React.CSSProperties = { minHeight: 190, padding: 18, borderRadius: 22, background: "#fff", border: "1px solid var(--line)", boxShadow: "0 12px 30px rgba(15, 23, 42, .045)" };
const metricTopStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const metricIconStyle: React.CSSProperties = { minWidth: 48, height: 48, borderRadius: 15, display: "grid", placeItems: "center", fontSize: 22, fontWeight: 950 };
const deltaStyle: React.CSSProperties = { fontSize: 11, fontWeight: 850 };
const metricTitleStyle: React.CSSProperties = { margin: "15px 0 0", fontSize: 16, letterSpacing: "-0.02em" };
const metricDescriptionStyle: React.CSSProperties = { margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55 };
const automaticPillStyle: React.CSSProperties = { display: "inline-flex", marginTop: 12, padding: "5px 8px", borderRadius: 999, background: "rgba(79,70,229,.08)", color: "var(--accent)", fontSize: 9, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" };
const contentGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, alignItems: "start" };
const panelStyle: React.CSSProperties = { padding: 22, borderRadius: 26, background: "#fff", border: "1px solid var(--line)" };
const panelEyebrowStyle: React.CSSProperties = { color: "var(--accent)", fontSize: 10, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" };
const panelTitleStyle: React.CSSProperties = { margin: "7px 0 0", fontSize: 20, letterSpacing: "-.04em" };
const panelDescriptionStyle: React.CSSProperties = { margin: "8px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.6 };
const formGridStyle: React.CSSProperties = { marginTop: 18, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 7, minWidth: 0 };
const fieldLabelStyle: React.CSSProperties = { color: "var(--muted)", fontSize: 10, fontWeight: 850, letterSpacing: ".08em", textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { minHeight: 44, borderRadius: 12, border: "1px solid var(--line)", padding: "10px 12px", outline: "none", background: "#fff", font: "inherit" };
const feedbackStyle: React.CSSProperties = { marginTop: 12, color: "#0f766e", fontSize: 12, fontWeight: 800 };
const permissionWarningStyle: React.CSSProperties = { marginTop: 12, padding: "10px 12px", borderRadius: 12, color: "#a16207", background: "rgba(202,138,4,.08)", fontSize: 12, fontWeight: 800 };
const primaryButtonStyle: React.CSSProperties = { marginTop: 16, minHeight: 46, border: 0, borderRadius: 13, padding: "11px 15px", background: "linear-gradient(135deg, var(--accent), var(--accent-strong))", color: "#fff", fontWeight: 850, cursor: "pointer" };
const recentListStyle: React.CSSProperties = { marginTop: 16, display: "grid", gap: 10 };
const recentItemStyle: React.CSSProperties = { padding: "13px 14px", borderRadius: 16, background: "var(--surface-elevated)", border: "1px solid var(--line)" };
const recentHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 };
const recentDateStyle: React.CSSProperties = { color: "var(--muted)", whiteSpace: "nowrap" };
const recentSubjectStyle: React.CSSProperties = { marginTop: 7, fontWeight: 850 };
const recentNotesStyle: React.CSSProperties = { marginTop: 5, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 };
const recentActorStyle: React.CSSProperties = { marginTop: 7, color: "var(--muted)", fontSize: 10, fontWeight: 750 };
const emptyStyle: React.CSSProperties = { padding: 18, borderRadius: 16, border: "1px dashed var(--line)", color: "var(--muted)", fontSize: 13 };
