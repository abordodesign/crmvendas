"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CrmAuthProvider } from "@/components/crm-auth-context";
import { CrmSettingsProvider } from "@/components/crm-settings-context";
import { type AppRole } from "@/lib/access-control";
import { defaultCrmSettings, getCrmSettings, subscribeCrmSettingsChanged } from "@/lib/crm-settings";
import {
  getNotificationItems,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeCrmDataChanged
} from "@/lib/crm-data-source";
import { getDevAdminSession } from "@/lib/dev-auth";
import { supabase } from "@/lib/supabase";
import type { NotificationItem } from "@/types/crm-app";

type CrmShellProps = {
  activePath:
    | "/dashboard"
    | "/dashboard/statistics"
    | "/dashboard/agenda"
    | "/dashboard/customers"
    | "/dashboard/opportunities"
    | "/dashboard/tasks"
    | "/dashboard/history"
    | "/dashboard/notifications"
    | "/dashboard/settings";
  title: string;
  subtitle: string;
  primaryAction?: string;
  children: React.ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/statistics", label: "Estatisticas" },
  { href: "/dashboard/agenda", label: "Agenda" },
  { href: "/dashboard/customers", label: "Clientes" },
  { href: "/dashboard/opportunities", label: "Oportunidades" },
  { href: "/dashboard/tasks", label: "Tarefas" },
  { href: "/dashboard/notifications", label: "Notificacoes" },
  { href: "/dashboard/settings", label: "Configuracoes" },
  { href: "/dashboard/history", label: "Historico" }
] as const;

const notificationModuleOptions = [
  { id: "all", label: "Todos" },
  { id: "Agenda", label: "Agenda" },
  { id: "Tarefa", label: "Tarefas" },
  { id: "Funil", label: "Funil" },
  { id: "Fechamento", label: "Fechamento" }
] as const;

function formatRoleLabel(role: AppRole | null) {
  if (role === "admin") {
    return "Master";
  }

  if (role === "manager") {
    return "Gestor";
  }

  if (role === "sales") {
    return "Comercial";
  }

  return "Sem perfil";
}

function normalizeAppRole(value: unknown): AppRole | null {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalizedValue === "master" || normalizedValue === "admin") {
    return "admin";
  }

  if (normalizedValue === "manager") {
    return "manager";
  }

  if (normalizedValue === "sales") {
    return "sales";
  }

  return null;
}

export function CrmShell({
  activePath,
  title,
  subtitle,
  primaryAction = "Nova oportunidade",
  children
}: CrmShellProps) {
  const router = useRouter();
  const [authState, setAuthState] = useState<{
    role: AppRole | null;
    fullName: string;
    isLoading: boolean;
  }>({
    role: null,
    fullName: "",
    isLoading: true
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationModuleFilter, setNotificationModuleFilter] = useState<(typeof notificationModuleOptions)[number]["id"]>("all");
  const [settings, setSettings] = useState(defaultCrmSettings);

  async function handleLogout() {
    await supabase.auth.signOut();
    await fetch("/api/auth/session", {
      method: "DELETE"
    });
    router.push("/login");
  }

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        const devSession = getDevAdminSession();

        if (isMounted) {
          setAuthState({
            role: devSession?.role ?? null,
            fullName: devSession?.fullName ?? "Visitante",
            isLoading: false
          });
        }
        return;
      }

      const currentUser = session.user;

      async function fetchProfile() {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", currentUser.id)
          .maybeSingle();

        return profile;
      }

      let profile = await fetchProfile();
      let role = normalizeAppRole(profile?.role);

      if (!role) {
        try {
          await fetch("/api/auth/bootstrap", {
            method: "POST",
            cache: "no-store"
          });
        } catch {
          // Mantemos o fallback abaixo se o bootstrap falhar.
        }

        profile = await fetchProfile();
        role = normalizeAppRole(profile?.role);
      }

      if (!isMounted) {
        return;
      }

      setAuthState({
        role: role ?? normalizeAppRole(currentUser.user_metadata?.role),
        fullName:
          profile?.full_name ??
          (typeof currentUser.user_metadata?.full_name === "string" ? currentUser.user_metadata.full_name : null) ??
          currentUser.email ??
          "Equipe",
        isLoading: false
      });
    }

    void loadProfile();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        const devSession = getDevAdminSession();

        if (isMounted) {
          setAuthState({
            role: devSession?.role ?? null,
            fullName: devSession?.fullName ?? "Visitante",
            isLoading: false
          });
        }
        return;
      }

      void loadProfile();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      const next = await getCrmSettings();

      if (isMounted) {
        setSettings(next);
      }
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

  const filteredNotifications =
    notificationModuleFilter === "all"
      ? notifications
      : notifications.filter((item) => item.label === notificationModuleFilter);
  const unreadNotifications = filteredNotifications.filter((item) => !item.isRead);
  const unreadByPriority = {
    high: unreadNotifications.filter((item) => item.priority === "high"),
    medium: unreadNotifications.filter((item) => item.priority === "medium"),
    info: unreadNotifications.filter((item) => item.priority === "info")
  };
  const readNotifications = filteredNotifications.filter((item) => item.isRead);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | null = null;

    if (!settings.features.notifications_center) {
      setNotifications([]);

      return () => {
        isMounted = false;

        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    async function loadNotifications() {
      const next = await getNotificationItems();

      if (isMounted) {
        setNotifications(next);
      }
    }

    function scheduleNotificationsLoad() {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        void loadNotifications();
      }, 250);
    }

    void loadNotifications();
    const unsubscribe = subscribeCrmDataChanged(scheduleNotificationsLoad);

    return () => {
      isMounted = false;
      unsubscribe();

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [settings.features.notifications_center]);

  if (authState.isLoading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderRadius: 18,
            background: "#ffffff",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
            fontWeight: 700
          }}
        >
          Carregando permissões...
        </div>
      </main>
    );
  }

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/dashboard/agenda") {
      return settings.features.agenda_module;
    }

    if (item.href === "/dashboard/history") {
      return settings.features.history_module;
    }

    if (item.href === "/dashboard/notifications") {
      return settings.features.notifications_center;
    }

    return true;
  });

  return (
    <CrmAuthProvider value={authState}>
      <CrmSettingsProvider value={{ settings }}>
      <main style={{ minHeight: "100vh", padding: "20px 20px 28px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px minmax(0, 1fr)",
            gap: 20
          }}
        >
          <aside
            style={{
              padding: 22,
              borderRadius: 28,
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
              display: "grid",
              alignContent: "start",
              gap: 22
            }}
          >
            <div style={{ paddingBottom: 18, borderBottom: "1px solid var(--line)" }}>
              <div
                style={{
                  fontSize: "1.9rem",
                  fontWeight: 900,
                  letterSpacing: "-0.06em",
                  color: "var(--accent)"
                }}
              >
                {settings.companyName}
              </div>
              <div style={{ marginTop: 8, color: "var(--muted)", lineHeight: 1.6 }}>
                Operacao comercial centralizada, com previsao e follow-up em um unico fluxo.
              </div>
            </div>

            <nav style={{ display: "grid", gap: 10 }}>
              {visibleNavItems.map((item) => {
                const isActive = item.href === activePath;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 18,
                      background: isActive ? "rgba(79, 70, 229, 0.08)" : "#ffffff",
                      color: isActive ? "var(--accent)" : "var(--foreground)",
                      border: "1px solid var(--line)",
                      fontWeight: isActive ? 800 : 600
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div
              style={{
                padding: 18,
                borderRadius: 22,
                background: "linear-gradient(135deg, rgba(79, 70, 229, 0.06), rgba(20, 184, 166, 0.08))",
                border: "1px solid rgba(79, 70, 229, 0.08)"
              }}
            >
              <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 800 }}>Perfil atual</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: "1.25rem",
                  fontWeight: 900,
                  letterSpacing: "-0.04em"
                }}
              >
                {settings.displayName || authState.fullName}
              </div>
              <div style={{ marginTop: 8, color: "var(--muted)", lineHeight: 1.6 }}>
                Papel ativo: {formatRoleLabel(authState.role)}
              </div>
              <div style={{ marginTop: 6, color: "var(--foreground)", fontSize: 12, fontWeight: 800 }}>
                Exibicao: {settings.displayName}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
              style={{
                padding: "14px 16px",
                borderRadius: 18,
                background: "#ffffff",
                border: "1px solid var(--line)",
                fontWeight: 700,
                textAlign: "center",
                cursor: "pointer"
              }}
            >
              Sair do sistema
            </button>
          </aside>

          <section style={{ display: "grid", gap: 18 }}>
            <header
              style={{
                padding: 22,
                borderRadius: 28,
                background: "#ffffff",
                border: "1px solid var(--line)",
                boxShadow: "0 14px 30px rgba(15, 23, 42, 0.04)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap"
                }}
              >
                <div>
                  <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 800 }}>{settings.companyName}</div>
                  <h1
                    style={{
                      margin: "8px 0 0",
                      fontSize: "2.2rem",
                      lineHeight: 1,
                      letterSpacing: "-0.05em"
                    }}
                  >
                    {title}
                  </h1>
                  <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>{subtitle}</div>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={pillStyle}>Mar 2026</div>
                  <div style={pillStyle}>{formatRoleLabel(authState.role)}</div>
                  {settings.features.notifications_center ? (
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setIsNotificationsOpen((current) => !current)}
                      style={notificationButtonStyle}
                    >
                      <BellIcon />
                      {unreadNotifications.length ? (
                        <span style={notificationBadgeStyle}>{unreadNotifications.length}</span>
                      ) : null}
                    </button>
                    {isNotificationsOpen ? (
                      <div style={notificationMenuStyle}>
                        <div style={notificationHeaderRowStyle}>
                          <div style={notificationMenuHeaderStyle}>Notificacoes importantes</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <select
                              value={notificationModuleFilter}
                              onChange={(event) =>
                                setNotificationModuleFilter(
                                  event.target.value as (typeof notificationModuleOptions)[number]["id"]
                                )
                              }
                              style={notificationFilterSelectStyle}
                            >
                              {notificationModuleOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {unreadNotifications.length ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  await markAllNotificationsAsRead();
                                }}
                                style={markAllButtonStyle}
                              >
                                Marcar tudo como lido
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: 8 }}>
                          {filteredNotifications.length ? (
                            <>
                              <NotificationSection
                                title="Alta prioridade"
                                priority="high"
                                items={unreadByPriority.high}
                                onOpen={async (id) => {
                                  await markNotificationAsRead(id);
                                  setIsNotificationsOpen(false);
                                }}
                              />
                              <NotificationSection
                                title="Acompanhar"
                                priority="medium"
                                items={unreadByPriority.medium}
                                onOpen={async (id) => {
                                  await markNotificationAsRead(id);
                                  setIsNotificationsOpen(false);
                                }}
                              />
                              <NotificationSection
                                title="Informativas"
                                priority="info"
                                items={unreadByPriority.info}
                                onOpen={async (id) => {
                                  await markNotificationAsRead(id);
                                  setIsNotificationsOpen(false);
                                }}
                              />
                              {readNotifications.length ? (
                                <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                                  <div style={notificationSectionTitleStyle}>Lidas</div>
                                  {readNotifications.map((item) => (
                                    <NotificationLink
                                      key={item.id}
                                      item={item}
                                      isRead
                                      onOpen={() => {
                                        setIsNotificationsOpen(false);
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div style={{ color: "var(--muted)", fontSize: 13 }}>Nenhuma notificacao para esse modulo.</div>
                          )}
                        </div>
                        <Link
                          href="/dashboard/notifications"
                          onClick={() => setIsNotificationsOpen(false)}
                          style={notificationFooterLinkStyle}
                        >
                          Abrir central de notificacoes
                        </Link>
                      </div>
                    ) : null}
                  </div>
                  ) : null}
                  <div style={primaryPillStyle}>{primaryAction}</div>
                </div>
              </div>
            </header>

            {children}
          </section>
        </div>
      </main>
      </CrmSettingsProvider>
    </CrmAuthProvider>
  );
}

export const pillStyle: React.CSSProperties = {
  padding: "10px 14px",
  minHeight: 42,
  borderRadius: 14,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box"
};

export const primaryPillStyle: React.CSSProperties = {
  ...pillStyle,
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  border: "1px solid transparent"
};

const notificationButtonStyle: React.CSSProperties = {
  ...pillStyle,
  minHeight: 42,
  position: "relative",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 48
};

const notificationHeaderRowStyle: React.CSSProperties = {
  marginBottom: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap"
};

const notificationBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: -6,
  right: -6,
  minWidth: 20,
  height: 20,
  borderRadius: 999,
  background: "#ef4444",
  color: "#ffffff",
  fontSize: 11,
  fontWeight: 800,
  display: "grid",
  placeItems: "center",
  padding: "0 6px"
};

const notificationMenuStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  width: 320,
  padding: 14,
  borderRadius: 20,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 20px 44px rgba(15, 23, 42, 0.12)",
  zIndex: 30
};

const notificationMenuHeaderStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const notificationItemStyle: React.CSSProperties = {
  padding: "12px 12px",
  borderRadius: 16,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)"
};

const notificationLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const markAllButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer"
};

const notificationFilterSelectStyle: React.CSSProperties = {
  minHeight: 30,
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "#ffffff",
  color: "var(--foreground)",
  fontSize: 12,
  fontWeight: 700,
  padding: "0 10px",
  outline: "none"
};

const unreadDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#2563eb",
  flexShrink: 0,
  marginTop: 4
};

function priorityBorderColor(priority: NotificationItem["priority"]) {
  if (priority === "high") {
    return "rgba(239, 68, 68, 0.24)";
  }

  if (priority === "medium") {
    return "rgba(245, 158, 11, 0.24)";
  }

  return "rgba(59, 130, 246, 0.18)";
}

function priorityBackground(priority: NotificationItem["priority"]) {
  if (priority === "high") {
    return "rgba(239, 68, 68, 0.05)";
  }

  if (priority === "medium") {
    return "rgba(245, 158, 11, 0.06)";
  }

  return "rgba(59, 130, 246, 0.05)";
}

function priorityTextColor(priority: NotificationItem["priority"]) {
  if (priority === "high") {
    return "#dc2626";
  }

  if (priority === "medium") {
    return "#b45309";
  }

  return "#2563eb";
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4.5a4 4 0 0 0-4 4v1.3c0 .9-.3 1.8-.9 2.5l-1 1.2a1.75 1.75 0 0 0 1.34 2.88h9.1a1.75 1.75 0 0 0 1.34-2.88l-1-1.2a3.98 3.98 0 0 1-.9-2.5V8.5a4 4 0 0 0-4-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 18.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type NotificationSectionProps = {
  title: string;
  priority: NotificationItem["priority"];
  items: NotificationItem[];
  onOpen: (id: string) => void;
};

function NotificationSection({ title, priority, items, onOpen }: NotificationSectionProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          ...notificationSectionTitleStyle,
          color: priorityTextColor(priority)
        }}
      >
        {title}
      </div>
      {items.map((item) => (
        <NotificationLink
          key={item.id}
          item={item}
          onOpen={() => {
            onOpen(item.id);
          }}
        />
      ))}
    </div>
  );
}

type NotificationLinkProps = {
  item: NotificationItem;
  isRead?: boolean;
  onOpen: () => void;
};

function NotificationLink({ item, isRead = false, onOpen }: NotificationLinkProps) {
  return (
    <Link
      href={item.href}
      onClick={onOpen}
      style={{
        ...notificationItemStyle,
        borderColor: priorityBorderColor(item.priority),
        background: isRead ? "var(--surface-elevated)" : priorityBackground(item.priority),
        opacity: isRead ? 0.72 : 1
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span
          style={{
            ...notificationLabelStyle,
            color: priorityTextColor(item.priority)
          }}
        >
          {item.label}
        </span>
        {!isRead ? <span style={unreadDotStyle} /> : null}
      </div>
      <div style={{ marginTop: 6, fontWeight: 800, color: "var(--foreground)" }}>{item.title}</div>
      <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>{item.detail}</div>
    </Link>
  );
}

const notificationSectionTitleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const notificationFooterLinkStyle: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 12,
  borderTop: "1px solid var(--line)",
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 800
};
