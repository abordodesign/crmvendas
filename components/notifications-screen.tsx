"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CrmShell } from "@/components/crm-shell";
import {
  getNotificationCenterItems,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeCrmDataChanged
} from "@/lib/crm-data-source";

type NotificationCenterItem = Awaited<ReturnType<typeof getNotificationCenterItems>>[number];

const moduleOptions = ["Todos", "Agenda", "Tarefa", "Funil", "Fechamento"] as const;
const priorityOptions = ["Todas", "high", "medium", "info"] as const;
const statusOptions = ["Ativas", "Lidas", "Resolvidas", "Todas"] as const;

export function NotificationsScreen() {
  const [items, setItems] = useState<NotificationCenterItem[]>([]);
  const [moduleFilter, setModuleFilter] = useState<(typeof moduleOptions)[number]>("Todos");
  const [priorityFilter, setPriorityFilter] = useState<(typeof priorityOptions)[number]>("Todas");
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("Ativas");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const next = await getNotificationCenterItems();

      if (isMounted) {
        setItems(next);
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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (moduleFilter !== "Todos" && item.label !== moduleFilter) {
        return false;
      }

      if (priorityFilter !== "Todas" && item.priority !== priorityFilter) {
        return false;
      }

      if (statusFilter === "Ativas" && item.resolvedAt) {
        return false;
      }

      if (statusFilter === "Lidas" && (!item.isRead || item.resolvedAt)) {
        return false;
      }

      if (statusFilter === "Resolvidas" && !item.resolvedAt) {
        return false;
      }

      return true;
    });
  }, [items, moduleFilter, priorityFilter, statusFilter]);

  const stats = {
    active: items.filter((item) => !item.resolvedAt).length,
    unread: items.filter((item) => !item.isRead && !item.resolvedAt).length,
    resolved: items.filter((item) => Boolean(item.resolvedAt)).length
  };

  return (
    <CrmShell
      activePath="/dashboard/notifications"
      title="Notificacoes"
      subtitle="Alertas do processo comercial, com leitura e historico de resolucao."
      primaryAction="Central ativa"
    >
      <section style={{ display: "grid", gap: 18 }}>
        <div
          style={{
            padding: 20,
            borderRadius: 24,
            background: "#ffffff",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
            display: "grid",
            gap: 16
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <MetricCard label="Ativas" value={String(stats.active)} accent="#4f46e5" />
            <MetricCard label="Nao lidas" value={String(stats.unread)} accent="#dc2626" />
            <MetricCard label="Resolvidas" value={String(stats.resolved)} accent="#0f766e" />
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value as (typeof moduleOptions)[number])} style={filterSelectStyle}>
              {moduleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as (typeof priorityOptions)[number])}
              style={filterSelectStyle}
            >
              <option value="Todas">Todas prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="info">Info</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as (typeof statusOptions)[number])} style={filterSelectStyle}>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                await markAllNotificationsAsRead();
              }}
              style={actionButtonStyle}
            >
              Marcar tudo como lido
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {filteredItems.length ? (
            filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 18,
                  borderRadius: 22,
                  background: item.resolvedAt ? "#f8fafc" : "#ffffff",
                  border: `1px solid ${priorityBorder(item.priority)}`,
                  boxShadow: "var(--shadow)",
                  display: "grid",
                  gap: 10
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ ...badgeStyle, color: priorityText(item.priority), background: prioritySoft(item.priority) }}>
                      {item.label}
                    </span>
                    <span style={{ ...badgeStyle, color: "var(--muted)", background: "var(--surface-elevated)" }}>
                      {item.resolvedAt ? "Resolvida" : item.isRead ? "Lida" : "Ativa"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {!item.isRead && !item.resolvedAt ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await markNotificationAsRead(item.id);
                        }}
                        style={inlineButtonStyle}
                      >
                        Marcar como lida
                      </button>
                    ) : null}
                    <Link href={item.href} style={inlineLinkStyle}>
                      Abrir origem
                    </Link>
                  </div>
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 900, letterSpacing: "-0.03em" }}>{item.title}</div>
                <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>{item.detail}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>
                  {item.resolvedAt ? "Historico de notificacao resolvida" : "Notificacao ativa para acompanhamento"}
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: 22,
                borderRadius: 22,
                background: "#ffffff",
                border: "1px solid var(--line)",
                boxShadow: "var(--shadow)",
                color: "var(--muted)",
                fontWeight: 700
              }}
            >
              Nenhuma notificacao encontrada para os filtros atuais.
            </div>
          )}
        </div>
      </section>
    </CrmShell>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 20,
        border: "1px solid var(--line)",
        background: "#ffffff"
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.05em" }}>{value}</div>
    </div>
  );
}

function priorityBorder(priority: NotificationCenterItem["priority"]) {
  if (priority === "high") {
    return "rgba(239, 68, 68, 0.25)";
  }

  if (priority === "medium") {
    return "rgba(245, 158, 11, 0.25)";
  }

  return "rgba(59, 130, 246, 0.2)";
}

function prioritySoft(priority: NotificationCenterItem["priority"]) {
  if (priority === "high") {
    return "rgba(239, 68, 68, 0.08)";
  }

  if (priority === "medium") {
    return "rgba(245, 158, 11, 0.08)";
  }

  return "rgba(59, 130, 246, 0.08)";
}

function priorityText(priority: NotificationCenterItem["priority"]) {
  if (priority === "high") {
    return "#dc2626";
  }

  if (priority === "medium") {
    return "#b45309";
  }

  return "#2563eb";
}

const filterSelectStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: "1px solid var(--line)",
  background: "#ffffff",
  color: "var(--foreground)",
  fontSize: 13,
  fontWeight: 700,
  padding: "0 14px",
  outline: "none"
};

const actionButtonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: 0,
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 800,
  padding: "0 16px",
  cursor: "pointer"
};

const inlineButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer"
};

const inlineLinkStyle: React.CSSProperties = {
  color: "var(--foreground)",
  fontSize: 12,
  fontWeight: 800
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};
