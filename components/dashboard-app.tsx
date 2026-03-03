"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CrmShell, pillStyle } from "@/components/crm-shell";
import { defaultCrmSettings, getCrmSettings, subscribeCrmSettingsChanged } from "@/lib/crm-settings";
import {
  createAgendaEntry,
  deleteAgendaEntry,
  getDashboardData,
  getOpportunities,
  getReferenceOptions,
  moveOpportunityToStage,
  subscribeCrmDataChanged,
  updateAgendaEntry
} from "@/lib/crm-data-source";
import { seedDashboardData } from "@/lib/crm-seed";
import type { DashboardData, OpportunityItem } from "@/types/crm-app";

const FILTER_MODES = [
  { id: "all", label: "Todos" },
  { id: "high_value", label: "Ticket alto" },
  { id: "next_step_pending", label: "Sem proximo passo" },
  { id: "closing", label: "Em conclusao" }
] as const;

const SORT_MODES = [
  { id: "value_desc", label: "Maior ticket" },
  { id: "value_asc", label: "Menor ticket" },
  { id: "company_asc", label: "Cliente A-Z" },
  { id: "owner_asc", label: "Responsavel A-Z" },
  { id: "title_asc", label: "Servico A-Z" }
] as const;
export function DashboardApp() {
  const [settings, setSettings] = useState(defaultCrmSettings);
  const [data, setData] = useState<DashboardData>(seedDashboardData);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterIndex, setFilterIndex] = useState(0);
  const [sortIndex, setSortIndex] = useState(0);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [moveFeedback, setMoveFeedback] = useState<string | null>(null);
  const [recentlyMovedDealId, setRecentlyMovedDealId] = useState<string | null>(null);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null);
  const [agendaTitle, setAgendaTitle] = useState("");
  const [agendaNote, setAgendaNote] = useState("");
  const [agendaDate, setAgendaDate] = useState("");
  const [agendaTime, setAgendaTime] = useState("");
  const [agendaCategory, setAgendaCategory] = useState("Reuniao");
  const [agendaFeedback, setAgendaFeedback] = useState<string | null>(null);
  const [agendaFilterToday, setAgendaFilterToday] = useState(true);
  const [accountOptions, setAccountOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [opportunityOptions, setOpportunityOptions] = useState<OpportunityItem[]>([]);
  const [agendaAccountId, setAgendaAccountId] = useState("");
  const [agendaOpportunityId, setAgendaOpportunityId] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [nextData, refs, opportunities] = await Promise.all([
        getDashboardData(),
        getReferenceOptions(),
        getOpportunities()
      ]);

      if (isMounted) {
        setData(nextData);
        setAccountOptions(refs.accounts.map((item) => ({ id: item.id, label: item.label })));
        setOpportunityOptions(opportunities);
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

  useEffect(() => {
    function clearDragState() {
      setDraggedDealId(null);
      setDragOverColumnId(null);
    }

    window.addEventListener("dragend", clearDragState);

    return () => {
      window.removeEventListener("dragend", clearDragState);
    };
  }, []);

  useEffect(() => {
    if (!recentlyMovedDealId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRecentlyMovedDealId(null);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [recentlyMovedDealId]);

  const activeFilter = FILTER_MODES[filterIndex];
  const activeSort = SORT_MODES[sortIndex];
  const isDragDropEnabled = settings.features.pipeline_drag_drop;
  const isAgendaEnabled = settings.features.agenda_module;

  function resetAgendaForm() {
    setEditingAgendaId(null);
    setAgendaTitle("");
    setAgendaNote("");
    setAgendaDate("");
    setAgendaTime("");
    setAgendaCategory("Reuniao");
    setAgendaAccountId("");
    setAgendaOpportunityId("");
  }

  function openCreateAgenda() {
    resetAgendaForm();
    setIsAgendaModalOpen(true);
    setAgendaFeedback(null);
  }

  function openEditAgenda(item: DashboardData["agenda"][number]) {
    setEditingAgendaId(item.id);
    setAgendaTitle(item.title);
    setAgendaNote(item.note);
    setAgendaDate(toDateInput(item.scheduledAt));
    setAgendaTime(toTimeInputValue(item.scheduledAt, item.time));
    setAgendaCategory(item.category ?? "Reuniao");
    setAgendaAccountId(item.accountId ?? "");
    setAgendaOpportunityId(item.opportunityId ?? "");
    setIsAgendaModalOpen(true);
    setAgendaFeedback(null);
  }

  function handleSaveAgenda() {
    if (!agendaTitle.trim() || !agendaDate || !agendaTime) {
      setAgendaFeedback("Preencha titulo, data e hora para salvar a agenda.");
      return;
    }

    startTransition(() => {
      void (async () => {
        if (editingAgendaId) {
          await updateAgendaEntry({
            id: editingAgendaId,
            title: agendaTitle,
            note: agendaNote,
            scheduledDate: agendaDate,
            scheduledTime: agendaTime,
            category: agendaCategory,
            accountId: agendaAccountId || undefined,
            opportunityId: agendaOpportunityId || undefined,
            accountName: accountOptions.find((item) => item.id === agendaAccountId)?.label,
            opportunityTitle: opportunityOptions.find((item) => item.id === agendaOpportunityId)?.title
          });
          setAgendaFeedback("Agenda atualizada.");
        } else {
          await createAgendaEntry({
            title: agendaTitle,
            note: agendaNote,
            scheduledDate: agendaDate,
            scheduledTime: agendaTime,
            category: agendaCategory,
            accountId: agendaAccountId || undefined,
            opportunityId: agendaOpportunityId || undefined,
            accountName: accountOptions.find((item) => item.id === agendaAccountId)?.label,
            opportunityTitle: opportunityOptions.find((item) => item.id === agendaOpportunityId)?.title
          });
          setAgendaFeedback("Agenda cadastrada.");
        }

        setIsAgendaModalOpen(false);
        resetAgendaForm();
      })();
    });
  }

  function handleDeleteAgenda(item: DashboardData["agenda"][number]) {
    startTransition(() => {
      void (async () => {
        const success = await deleteAgendaEntry({
          id: item.id,
          title: item.title
        });

        setAgendaFeedback(success ? "Item removido da agenda." : "Nao foi possivel remover o item da agenda.");
      })();
    });
  }

  const filteredPipeline = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    const nextColumns = data.pipeline
      .map((column) => {
        const filteredDeals = column.deals
          .filter((deal) => {
            const matchesQuery =
              !normalizedQuery ||
              normalizeSearchText([deal.title, deal.company, deal.owner, deal.nextStep ?? ""].join(" ")).includes(
                normalizedQuery
              );

            if (!matchesQuery) {
              return false;
            }

            if (activeFilter.id === "high_value") {
              return currencyToNumber(deal.value) >= 50000;
            }

            if (activeFilter.id === "next_step_pending") {
              return normalizeSearchText(deal.nextStep ?? "").includes("definirproximopasso");
            }

            if (activeFilter.id === "closing") {
              return normalizeSearchText(column.name).includes("conclusao");
            }

            return true;
          })
          .sort((left, right) => {
            if (activeSort.id === "value_desc") {
              return currencyToNumber(right.value) - currencyToNumber(left.value);
            }

            if (activeSort.id === "value_asc") {
              return currencyToNumber(left.value) - currencyToNumber(right.value);
            }

            if (activeSort.id === "owner_asc") {
              return left.owner.localeCompare(right.owner, "pt-BR");
            }

            if (activeSort.id === "company_asc") {
              return left.company.localeCompare(right.company, "pt-BR");
            }

            return left.title.localeCompare(right.title, "pt-BR");
          });

        return {
          ...column,
          deals: filteredDeals,
          total: formatCurrency(filteredDeals.reduce((sum, item) => sum + currencyToNumber(item.value), 0))
        };
      })
      .filter((column) => column.deals.length > 0);

    return nextColumns.sort((left, right) => {
      const leftTotal = left.deals.reduce((sum, item) => sum + currencyToNumber(item.value), 0);
      const rightTotal = right.deals.reduce((sum, item) => sum + currencyToNumber(item.value), 0);
      const leftLead = left.deals[0];
      const rightLead = right.deals[0];

      if (activeSort.id === "value_desc") {
        return rightTotal - leftTotal;
      }

      if (activeSort.id === "value_asc") {
        return leftTotal - rightTotal;
      }

      if (activeSort.id === "owner_asc") {
        return (leftLead?.owner ?? "").localeCompare(rightLead?.owner ?? "", "pt-BR");
      }

      if (activeSort.id === "company_asc") {
        return (leftLead?.company ?? left.name).localeCompare(rightLead?.company ?? right.name, "pt-BR");
      }

      return (leftLead?.title ?? left.name).localeCompare(rightLead?.title ?? right.name, "pt-BR");
    });
  }, [activeFilter.id, activeSort.id, data.pipeline, searchQuery]);

  return (
    <CrmShell
      activePath="/dashboard"
      title="Visao executiva do funil e da cadencia comercial"
      subtitle="Acompanhe pipeline, agenda, tarefas e atividade recente em uma unica tela."
    >
      <AgendaFormModal
        open={isAgendaModalOpen}
        editing={Boolean(editingAgendaId)}
        title={agendaTitle}
        note={agendaNote}
        date={agendaDate}
        time={agendaTime}
        category={agendaCategory}
        accountId={agendaAccountId}
        opportunityId={agendaOpportunityId}
        accounts={accountOptions}
        opportunities={opportunityOptions.filter(
          (item) => !agendaAccountId || item.company === accountOptions.find((option) => option.id === agendaAccountId)?.label
        )}
        onTitleChange={setAgendaTitle}
        onNoteChange={setAgendaNote}
        onDateChange={setAgendaDate}
        onTimeChange={setAgendaTime}
        onCategoryChange={setAgendaCategory}
        onAccountChange={setAgendaAccountId}
        onOpportunityChange={setAgendaOpportunityId}
        onClose={() => {
          setIsAgendaModalOpen(false);
          resetAgendaForm();
        }}
        onSubmit={handleSaveAgenda}
        isPending={isPending}
      />
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16
        }}
      >
        {data.kpis.map((kpi) => (
          <article
            key={kpi.label}
            style={{
              padding: 22,
              borderRadius: 24,
              background: "#ffffff",
              border: "1px solid var(--line)",
              boxShadow: "0 12px 24px rgba(15, 23, 42, 0.04)"
            }}
          >
            <div
              style={{
                color: "var(--muted)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }}
            >
              {kpi.label}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: "2rem",
                lineHeight: 1,
                fontWeight: 900,
                letterSpacing: "-0.05em"
              }}
            >
              {kpi.value}
            </div>
            <div style={{ marginTop: 8, color: "var(--secondary)", fontSize: 12, fontWeight: 800 }}>
              {kpi.trend}
            </div>
          </article>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.7fr)",
          gap: 18
        }}
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
                  display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 16
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Pipeline de oportunidades</h2>
              <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
                Acompanhe valor, responsavel e proximo passo por etapa.
              </div>
            </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar no funil"
                  style={searchInputStyle}
                />
                <label style={controlFieldStyle}>
                  <span style={controlLabelStyle}>Filtro</span>
                  <select
                    value={String(filterIndex)}
                    onChange={(event) => setFilterIndex(Number(event.target.value))}
                    style={controlSelectStyle}
                  >
                    {FILTER_MODES.map((option, index) => (
                      <option key={option.id} value={index}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={controlFieldStyle}>
                  <span style={controlLabelStyle}>Ordenar</span>
                  <select
                    value={String(sortIndex)}
                    onChange={(event) => setSortIndex(Number(event.target.value))}
                    style={controlSelectStyle}
                  >
                    {SORT_MODES.map((option, index) => (
                      <option key={option.id} value={index}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
            </div>
          </div>

          {moveFeedback ? (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 14,
                background: "rgba(79, 70, 229, 0.06)",
                border: "1px solid rgba(79, 70, 229, 0.12)",
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 700
              }}
            >
              {moveFeedback}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14
            }}
          >
            {filteredPipeline.length ? filteredPipeline.map((column) => (
              <article
                key={column.id}
                onDragOver={(event) => {
                  if (!isDragDropEnabled || !draggedDealId) {
                    return;
                  }

                  event.preventDefault();
                  if (dragOverColumnId !== column.id) {
                    setDragOverColumnId(column.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverColumnId === column.id) {
                    setDragOverColumnId(null);
                  }
                }}
                onDrop={async (event) => {
                  event.preventDefault();

                  if (!isDragDropEnabled) {
                    return;
                  }

                  const droppedDealId = event.dataTransfer.getData("text/plain") || draggedDealId;
                  setDragOverColumnId(null);
                  setDraggedDealId(null);

                  if (!droppedDealId) {
                    return;
                  }

                  const sourceColumn = data.pipeline.find((item) =>
                    item.deals.some((deal) => deal.id === droppedDealId)
                  );

                  if (sourceColumn?.name === column.name) {
                    return;
                  }

                  await moveOpportunityToStage({
                    opportunityId: droppedDealId,
                    targetStage: column.name
                  });
                  setRecentlyMovedDealId(droppedDealId);
                  setMoveFeedback(`Oportunidade movida para ${column.name}.`);
                }}
                style={{
                  padding: 16,
                  borderRadius: 22,
                  background: "var(--surface-elevated)",
                  border:
                    dragOverColumnId === column.id
                      ? "1px solid rgba(79, 70, 229, 0.4)"
                      : "1px solid var(--line)",
                  boxShadow:
                    dragOverColumnId === column.id
                      ? "0 0 0 4px rgba(79, 70, 229, 0.08)"
                      : "none",
                  transition: "border-color 120ms ease, box-shadow 120ms ease"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    marginBottom: 12
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 900,
                        color: "var(--accent)",
                        letterSpacing: "-0.02em"
                      }}
                    >
                      {column.name}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        color: "var(--muted)",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase"
                      }}
                    >
                      {column.total}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "5px 9px",
                      borderRadius: 999,
                      background: "rgba(79, 70, 229, 0.08)",
                      color: "var(--accent)",
                      fontSize: 12,
                      fontWeight: 800
                    }}
                  >
                    {column.deals.length}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {column.deals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable={isDragDropEnabled}
                      onDragStart={(event) => {
                        if (!isDragDropEnabled) {
                          return;
                        }

                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", deal.id);
                        setDraggedDealId(deal.id);
                      }}
                      onDragEnd={() => {
                        setDraggedDealId(null);
                        setDragOverColumnId(null);
                      }}
                      style={{
                        padding: 14,
                        borderRadius: 18,
                        background: "#ffffff",
                        border:
                          recentlyMovedDealId === deal.id
                            ? "1px solid rgba(20, 184, 166, 0.34)"
                            : "1px solid rgba(15, 23, 42, 0.06)",
                        cursor: "grab",
                        opacity: draggedDealId === deal.id ? 0.55 : 1,
                        transform:
                          draggedDealId === deal.id
                            ? "scale(0.98)"
                            : recentlyMovedDealId === deal.id
                              ? "translateY(-2px)"
                              : "none",
                        boxShadow:
                          recentlyMovedDealId === deal.id
                            ? "0 10px 22px rgba(20, 184, 166, 0.14)"
                            : "none",
                        transition: "opacity 120ms ease, transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: "1rem",
                              lineHeight: 1.15,
                              letterSpacing: "-0.03em"
                            }}
                          >
                            {deal.title}
                          </div>
                          <div
                            style={{
                              marginTop: 5,
                              color: "var(--muted)",
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase"
                            }}
                          >
                            {deal.company}
                          </div>
                          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                            Proximo passo: {deal.nextStep ?? "Definir proximo passo"}
                          </div>
                        </div>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: "var(--secondary)",
                            marginTop: 4,
                            flexShrink: 0
                          }}
                        />
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center"
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "rgba(20, 184, 166, 0.12)",
                            color: "#0f766e",
                            fontSize: 11,
                            fontWeight: 800
                          }}
                        >
                          {deal.value}
                        </div>
                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase"
                          }}
                        >
                          Responsavel: {deal.owner}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )) : (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: 22,
                  borderRadius: 20,
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--line)",
                  color: "var(--muted)"
                }}
              >
                Nenhuma oportunidade encontrada para a combinacao atual de busca, filtro e ordenacao.
              </div>
            )}
          </div>
        </section>

        <div style={{ display: "grid", gap: 18 }}>
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
                flexWrap: "wrap"
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Agenda do dia</h2>
              {isAgendaEnabled ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setAgendaFilterToday((current) => !current)}
                    style={miniButtonStyle}
                  >
                    {agendaFilterToday ? "Mostrando hoje" : "Mostrando todos"}
                  </button>
                  <button type="button" onClick={openCreateAgenda} style={smallActionButtonStyle}>
                    Novo horario
                  </button>
                </div>
              ) : (
                <div style={pillStyle}>Modulo desativado</div>
              )}
            </div>
            {isAgendaEnabled && agendaFeedback ? (
              <div
                style={{
                  marginTop: 12,
                  color: "var(--secondary)",
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                {agendaFeedback}
              </div>
            ) : null}
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {isAgendaEnabled
                ? data.agenda
                .filter((item) => !agendaFilterToday || isToday(item.scheduledAt))
                .map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--line)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>{item.time}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 800 }}>
                        {isWithinReminderWindow(item.scheduledAt) ? "Lembrete 15 min" : "Hoje"}
                      </div>
                      <button type="button" onClick={() => openEditAgenda(item)} style={miniButtonStyle}>
                        Editar
                      </button>
                      <button type="button" onClick={() => handleDeleteAgenda(item)} style={miniDangerButtonStyle}>
                        Excluir
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 900, letterSpacing: "-0.02em" }}>{item.title}</div>
                  <div style={{ marginTop: 8, display: "inline-flex", ...dashboardCategoryChipStyle(item.category) }}>
                    {item.category ?? "Reuniao"}
                  </div>
                  <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                    {item.note}
                  </div>
                  {(item.accountName || item.opportunityTitle) ? (
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap"
                      }}
                    >
                      {item.accountName && item.accountId ? (
                        <Link href={`/dashboard/customers?focus=${item.accountId}`} style={agendaLinkChipStyle}>
                          {item.accountName}
                        </Link>
                      ) : null}
                      {item.opportunityTitle && item.opportunityId ? (
                        <Link href={`/dashboard/opportunities?focus=${item.opportunityId}`} style={agendaLinkChipStyle}>
                          {item.opportunityTitle}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
                : (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 18,
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--line)",
                      color: "var(--muted)",
                      fontWeight: 700,
                      lineHeight: 1.6
                    }}
                  >
                    A agenda foi desativada em Configuracoes. Reative o modulo para voltar a exibir compromissos aqui.
                  </div>
                )}
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
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Tarefas prioritarias</h2>
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {data.tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--line)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>{task.title}</div>
                    <div style={{ color: priorityColor(task.priority), fontSize: 12, fontWeight: 800 }}>
                      {task.priority}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--muted)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase"
                    }}
                  >
                    {task.company}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--muted)"
                    }}
                  >
                    Vence: {task.due}
                  </div>
                </div>
              ))}
            </div>
          </section>
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
            marginBottom: 14
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Atividade recente</h2>
          <div style={pillStyle}>Atualizado agora</div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {data.activity.map((item) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "200px minmax(0, 1fr) 120px",
                gap: 14,
                alignItems: "center",
                padding: "14px 16px",
                borderRadius: 18,
                background: "var(--surface-elevated)",
                border: "1px solid var(--line)"
              }}
            >
              <div style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>{item.actor}</div>
              <div style={{ color: "var(--muted)", lineHeight: 1.5 }}>
                {item.action} <strong style={{ color: "var(--foreground)" }}>{item.target}</strong>
              </div>
              <div style={{ textAlign: "right", color: "var(--muted)", fontSize: 13, fontWeight: 700 }}>
                {item.when}
              </div>
            </div>
          ))}
        </div>
      </section>
    </CrmShell>
  );
}

function AgendaFormModal({
  open,
  editing,
  title,
  note,
  date,
  time,
  category,
  accountId,
  opportunityId,
  accounts,
  opportunities,
  onTitleChange,
  onNoteChange,
  onDateChange,
  onTimeChange,
  onCategoryChange,
  onAccountChange,
  onOpportunityChange,
  onClose,
  onSubmit,
  isPending
}: {
  open: boolean;
  editing: boolean;
  title: string;
  note: string;
  date: string;
  time: string;
  category: string;
  accountId: string;
  opportunityId: string;
  accounts: Array<{ id: string; label: string }>;
  opportunities: OpportunityItem[];
  onTitleChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onOpportunityChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 18,
            flexWrap: "wrap"
          }}
        >
          <div>
            <div style={agendaBadgeStyle}>Agenda comercial</div>
            <h2 style={agendaTitleStyle}>{editing ? "Editar horario" : "Novo horario"}</h2>
            <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
              Cadastre compromissos do dia com horario e observacao.
            </div>
          </div>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Fechar
          </button>
        </div>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14
          }}
        >
          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Titulo</span>
            <input value={title} onChange={(event) => onTitleChange(event.target.value)} style={searchInputStyle} />
          </label>
          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Data</span>
            <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} style={searchInputStyle} />
          </label>
          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Hora</span>
            <input type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} style={searchInputStyle} />
          </label>
          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Tipo</span>
            <select value={category} onChange={(event) => onCategoryChange(event.target.value)} style={controlSelectStyle}>
              <option value="Reuniao">Reuniao</option>
              <option value="Ligacao">Ligacao</option>
              <option value="E-mail">E-mail</option>
              <option value="Follow-up">Follow-up</option>
            </select>
          </label>
          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Cliente</span>
            <select value={accountId} onChange={(event) => onAccountChange(event.target.value)} style={controlSelectStyle}>
              <option value="">Nao vincular</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label style={controlFieldStyle}>
            <span style={controlLabelStyle}>Oportunidade</span>
            <select
              value={opportunityId}
              onChange={(event) => onOpportunityChange(event.target.value)}
              style={controlSelectStyle}
            >
              <option value="">Nao vincular</option>
              {opportunities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...controlFieldStyle, gridColumn: "1 / -1" }}>
            <span style={controlLabelStyle}>Observacao</span>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={4}
              style={agendaTextAreaStyle}
            />
          </label>
        </div>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancelar
          </button>
          <button type="button" onClick={onSubmit} disabled={isPending} style={smallActionButtonStyle}>
            {isPending ? "Salvando..." : editing ? "Salvar agenda" : "Cadastrar agenda"}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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

function priorityColor(priority: string) {
  if (priority === "Alta") {
    return "#b91c1c";
  }

  if (priority === "Media") {
    return "#a16207";
  }

  return "#0f766e";
}

const searchInputStyle: React.CSSProperties = {
  minHeight: 42,
  minWidth: 220,
  borderRadius: 14,
  border: "1px solid var(--line)",
  padding: "10px 12px",
  outline: "none",
  font: "inherit",
  background: "#ffffff"
};

const controlFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6
};

const controlLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const controlSelectStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: "1px solid var(--line)",
  padding: "10px 12px",
  background: "#ffffff",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer"
};

const smallActionButtonStyle: React.CSSProperties = {
  minHeight: 40,
  border: 0,
  borderRadius: 12,
  padding: "10px 14px",
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const miniButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "6px 10px",
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer"
};

const miniDangerButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "6px 10px",
  background: "rgba(185, 28, 28, 0.08)",
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer"
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(15, 23, 42, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20
};

const modalCardStyle: React.CSSProperties = {
  width: "min(760px, calc(100vw - 24px))",
  borderRadius: 24,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.16)",
  padding: 24
};

const agendaBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase"
};

const agendaTitleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: "1.5rem",
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: "-0.04em"
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "10px 14px",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const agendaTextAreaStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid var(--line)",
  padding: "12px 14px",
  outline: "none",
  font: "inherit",
  background: "#ffffff",
  resize: "vertical",
  minHeight: 108
};

const agendaLinkChipStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#ffffff",
  border: "1px solid var(--line)",
  color: "var(--accent)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase"
};

function toDateInput(value?: string) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function toTimeInputValue(value?: string, fallback?: string) {
  if (!value) {
    return fallback ?? "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return fallback ?? "";
  }

  return parsed.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function isToday(value?: string) {
  if (!value) {
    return true;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  return parsed.toDateString() === new Date().toDateString();
}

function isWithinReminderWindow(value?: string) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    return false;
  }

  const diff = time - Date.now();
  return diff >= 0 && diff <= 15 * 60 * 1000;
}

function dashboardCategoryChipStyle(category: string | undefined): React.CSSProperties {
  if (category === "Ligacao") {
    return {
      padding: "6px 9px",
      borderRadius: 999,
      background: "rgba(20, 184, 166, 0.12)",
      color: "#0f766e",
      fontSize: 11,
      fontWeight: 800
    };
  }

  if (category === "E-mail") {
    return {
      padding: "6px 9px",
      borderRadius: 999,
      background: "rgba(37, 99, 235, 0.12)",
      color: "#1d4ed8",
      fontSize: 11,
      fontWeight: 800
    };
  }

  if (category === "Follow-up") {
    return {
      padding: "6px 9px",
      borderRadius: 999,
      background: "rgba(168, 85, 247, 0.12)",
      color: "#7c3aed",
      fontSize: 11,
      fontWeight: 800
    };
  }

  return {
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(79, 70, 229, 0.1)",
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 800
  };
}
