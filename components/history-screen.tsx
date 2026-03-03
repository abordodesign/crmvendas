"use client";

import { useEffect, useMemo, useState } from "react";
import { CrmShell } from "@/components/crm-shell";
import { getHistoryActivities, subscribeCrmDataChanged } from "@/lib/crm-data-source";
import { seedActivity } from "@/lib/crm-seed";
import type { ActivityItem } from "@/types/crm-app";

const TYPE_OPTIONS = [
  { id: "all", label: "Todos" },
  { id: "movement", label: "Movimentacoes" },
  { id: "opportunity", label: "Oportunidades" },
  { id: "customer", label: "Clientes" },
  { id: "task", label: "Tarefas" },
  { id: "interaction", label: "Interacoes" }
] as const;
const PERIOD_OPTIONS = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "all", label: "Todo periodo" }
] as const;
const PAGE_SIZE = 12;

export function HistoryScreen() {
  const [items, setItems] = useState<ActivityItem[]>(seedActivity);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("7d");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const nextItems = await getHistoryActivities();

      if (isMounted) {
        setItems(nextItems);
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

  const actorOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.actor))).filter(Boolean);
    return ["all", ...unique];
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    const now = Date.now();

    return items.filter((item) => {
      const itemType = item.eventType ?? classifyActivity(item);
      const matchesType = typeFilter === "all" || itemType === typeFilter;
      const matchesActor = actorFilter === "all" || item.actor === actorFilter;
      const matchesQuery =
        !normalizedQuery ||
        normalizeSearchText([item.actor, item.action, item.target].join(" ")).includes(normalizedQuery);
      const itemTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      const matchesPeriod =
        periodFilter === "all" ||
        !itemTime ||
        (periodFilter === "today" && now - itemTime <= 24 * 60 * 60 * 1000) ||
        (periodFilter === "7d" && now - itemTime <= 7 * 24 * 60 * 60 * 1000) ||
        (periodFilter === "30d" && now - itemTime <= 30 * 24 * 60 * 60 * 1000);

      return matchesType && matchesActor && matchesQuery && matchesPeriod;
    });
  }, [actorFilter, items, periodFilter, searchQuery, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter, actorFilter, periodFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  return (
    <CrmShell
      activePath="/dashboard/history"
      title="Historico"
      subtitle="Acompanhe toda movimentacao do sistema, com filtros para localizar eventos rapidamente."
      primaryAction="Historico em tempo real"
    >
      <section
        style={{
          padding: 20,
          borderRadius: 28,
          background: "#ffffff",
          border: "1px solid var(--line)"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14
          }}
        >
          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Buscar</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por usuario, acao ou alvo"
              style={controlInputStyle}
            />
          </label>

          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Tipo</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={controlInputStyle}>
              {TYPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Responsavel</span>
            <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} style={controlInputStyle}>
              {actorOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "Todos" : option}
                </option>
              ))}
            </select>
          </label>

          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Periodo</span>
            <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} style={controlInputStyle}>
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section
        style={{
          padding: 20,
          borderRadius: 28,
          background: "#ffffff",
          border: "1px solid var(--line)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Eventos registrados</h2>
          <div style={summaryPillStyle}>
            {filteredItems.length} registros • Pagina {Math.min(page, totalPages)} de {totalPages}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {pagedItems.length ? (
            pagedItems.map((item) => (
              <article
                key={item.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: 20,
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "220px minmax(0, 1fr) 120px",
                  gap: 14,
                  alignItems: "center"
                }}
              >
                <div>
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}
                  >
                    Responsavel
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 900, letterSpacing: "-0.02em" }}>{item.actor}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: typeColor(classifyActivity(item)),
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}
                  >
                    {typeLabel(item.eventType ?? classifyActivity(item))}
                  </div>
                  <div style={{ marginTop: 6, lineHeight: 1.6 }}>
                    {item.action} <strong style={{ color: "var(--foreground)" }}>{item.target}</strong>
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    color: "var(--muted)",
                    fontSize: 13,
                    fontWeight: 700
                  }}
                >
                  {item.when}
                </div>
              </article>
            ))
          ) : (
            <div
              style={{
                padding: 18,
                borderRadius: 18,
                background: "var(--surface-elevated)",
                border: "1px solid var(--line)",
                color: "var(--muted)"
              }}
            >
              Nenhum registro encontrado para os filtros atuais.
            </div>
          )}
        </div>

        {filteredItems.length ? (
          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap"
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              Exibindo {(page - 1) * PAGE_SIZE + 1} a {Math.min(page * PAGE_SIZE, filteredItems.length)} de {filteredItems.length}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                style={paginationButtonStyle}
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                style={paginationButtonStyle}
              >
                Proxima
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </CrmShell>
  );
}

function classifyActivity(item: ActivityItem) {
  if (item.eventType) {
    return item.eventType;
  }

  if (normalizeSearchText(item.action).startsWith("moveu")) {
    return "movement";
  }

  if (normalizeSearchText(item.action).includes("atividade")) {
    return "task";
  }

  return "interaction";
}

function typeLabel(type: string) {
  if (type === "movement") {
    return "Movimentacao";
  }

  if (type === "opportunity") {
    return "Oportunidade";
  }

  if (type === "customer") {
    return "Cliente";
  }

  if (type === "task") {
    return "Tarefa";
  }

  return "Interacao";
}

function typeColor(type: string) {
  if (type === "movement") {
    return "var(--accent)";
  }

  if (type === "opportunity") {
    return "#1d4ed8";
  }

  if (type === "customer") {
    return "#7c3aed";
  }

  if (type === "task") {
    return "#a16207";
  }

  return "#0f766e";
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const controlFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8
};

const controlLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const controlInputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid var(--line)",
  padding: "10px 12px",
  outline: "none",
  font: "inherit",
  background: "#ffffff"
};

const summaryPillStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 800
};

const paginationButtonStyle: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "10px 14px",
  background: "#ffffff",
  fontWeight: 700,
  cursor: "pointer"
};
