"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CrmShell } from "@/components/crm-shell";
import { defaultCrmSettings, getCrmSettings, subscribeCrmSettingsChanged } from "@/lib/crm-settings";
import {
  createAgendaEntry,
  deleteAgendaEntry,
  getAgendaEntries,
  getOpportunities,
  getReferenceOptions,
  subscribeCrmDataChanged,
  updateAgendaEntry
} from "@/lib/crm-data-source";
import { seedAgenda } from "@/lib/crm-seed";
import type { AgendaItem, OpportunityItem } from "@/types/crm-app";

type PeriodMode = "today" | "week" | "all";

export function AgendaScreen() {
  const [settings, setSettings] = useState(defaultCrmSettings);
  const [items, setItems] = useState<AgendaItem[]>(seedAgenda);
  const [period, setPeriod] = useState<PeriodMode>("today");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState("Reuniao");
  const [accountId, setAccountId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [accountOptions, setAccountOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [opportunityOptions, setOpportunityOptions] = useState<OpportunityItem[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [itemPendingDelete, setItemPendingDelete] = useState<AgendaItem | null>(null);
  const [draggedAgendaId, setDraggedAgendaId] = useState<string | null>(null);
  const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);
  const [notifiedIds, setNotifiedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [agenda, refs, opportunities] = await Promise.all([getAgendaEntries(), getReferenceOptions(), getOpportunities()]);

      if (isMounted) {
        setItems(agenda);
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

  const visibleItems = useMemo(() => items.filter((item) => matchesPeriod(item.scheduledAt, period)), [items, period]);
  const upcomingReminders = useMemo(
    () => items.filter((item) => isWithinReminderWindow(item.scheduledAt)).slice(0, 4),
    [items]
  );
  const weeklyColumns = useMemo(() => buildWeeklyColumns(items), [items]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !settings.features.browser_notifications ||
      !upcomingReminders.length ||
      !("Notification" in window)
    ) {
      return;
    }

    const pending = upcomingReminders.filter((item) => !notifiedIds.includes(item.id));

    if (!pending.length) {
      return;
    }

    if (Notification.permission === "default") {
      void Notification.requestPermission();
      return;
    }

    if (Notification.permission !== "granted") {
      return;
    }

    pending.forEach((item) => {
      const notification = new Notification("Compromisso proximo", {
        body: `${item.time} • ${item.title}`
      });

      notification.onclick = () => {
        window.focus();
      };
    });

    setNotifiedIds((current) => [...current, ...pending.map((item) => item.id)]);
  }, [notifiedIds, settings.features.browser_notifications, upcomingReminders]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setNote("");
    setDate("");
    setTime("");
    setCategory("Reuniao");
    setAccountId("");
    setOpportunityId("");
  }

  function openCreate() {
    resetForm();
    setIsModalOpen(true);
    setFeedback(null);
  }

  function openEdit(item: AgendaItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setNote(item.note);
    setDate(toDateInput(item.scheduledAt));
    setTime(toTimeInputValue(item.scheduledAt, item.time));
    setCategory(item.category ?? "Reuniao");
    setAccountId(item.accountId ?? "");
    setOpportunityId(item.opportunityId ?? "");
    setIsModalOpen(true);
    setFeedback(null);
  }

  function saveItem() {
    if (!title.trim() || !date || !time) {
      setFeedback("Preencha titulo, data e hora.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const payload = {
          title,
          note,
          scheduledDate: date,
          scheduledTime: time,
          category,
          accountId: accountId || undefined,
          opportunityId: opportunityId || undefined,
          accountName: accountOptions.find((item) => item.id === accountId)?.label,
          opportunityTitle: opportunityOptions.find((item) => item.id === opportunityId)?.title
        };

        if (editingId) {
          await updateAgendaEntry({
            id: editingId,
            ...payload
          });
          setFeedback("Agenda atualizada.");
        } else {
          await createAgendaEntry(payload);
          setFeedback("Agenda cadastrada.");
        }

        setIsModalOpen(false);
        resetForm();
      })();
    });
  }

  function removeItem(item: AgendaItem) {
    setItemPendingDelete(item);
  }

  function confirmDelete() {
    if (!itemPendingDelete) {
      return;
    }

    startTransition(() => {
      void (async () => {
        const success = await deleteAgendaEntry({
          id: itemPendingDelete.id,
          title: itemPendingDelete.title
        });

        setFeedback(success ? "Compromisso removido." : "Nao foi possivel remover o compromisso.");
        setItemPendingDelete(null);
      })();
    });
  }

  function moveAgendaItemToDay(item: AgendaItem, dayKey: string) {
    const nextTime = toTimeInputValue(item.scheduledAt, item.time);

    if (!nextTime) {
      setFeedback("Nao foi possivel mover o compromisso sem um horario valido.");
      return;
    }

    startTransition(() => {
      void (async () => {
        await updateAgendaEntry({
          id: item.id,
          title: item.title,
          note: item.note,
          scheduledDate: dayKey,
          scheduledTime: nextTime,
          accountId: item.accountId,
          opportunityId: item.opportunityId,
          accountName: item.accountName,
          opportunityTitle: item.opportunityTitle
        });

        setFeedback(`Compromisso movido para ${formatDateLabel(dayKey)}.`);
      })();
    });
  }

  const filteredOpportunities = opportunityOptions.filter(
    (item) => !accountId || item.company === accountOptions.find((option) => option.id === accountId)?.label
  );

  return (
    <CrmShell
      activePath="/dashboard/agenda"
      title="Agenda"
      subtitle="Gerencie compromissos comerciais por dia ou semana, com vinculo a clientes e oportunidades."
      primaryAction="Novo compromisso"
    >
      <AgendaEditorModal
        open={isModalOpen}
        editing={Boolean(editingId)}
        title={title}
        note={note}
        date={date}
        time={time}
        category={category}
        accountId={accountId}
        opportunityId={opportunityId}
        accounts={accountOptions}
        opportunities={filteredOpportunities}
        onTitleChange={setTitle}
        onNoteChange={setNote}
        onDateChange={setDate}
        onTimeChange={setTime}
        onCategoryChange={setCategory}
        onAccountChange={setAccountId}
        onOpportunityChange={setOpportunityId}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        onSubmit={saveItem}
        isPending={isPending}
      />
      <DeleteAgendaModal
        item={itemPendingDelete}
        isPending={isPending}
        onClose={() => setItemPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      {!settings.features.agenda_module ? (
        <section style={panelStyle}>
          <div style={{ color: "var(--muted)", fontWeight: 700, lineHeight: 1.7 }}>
            O modulo de agenda foi desativado em Configuracoes. Reative a funcionalidade para cadastrar, editar e acompanhar compromissos aqui.
          </div>
        </section>
      ) : null}

      <section style={panelStyle}>
        <div style={toolbarStyle}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setPeriod("today")} style={periodButtonStyle(period === "today")}>
              Hoje
            </button>
            <button type="button" onClick={() => setPeriod("week")} style={periodButtonStyle(period === "week")}>
              Semana
            </button>
            <button type="button" onClick={() => setPeriod("all")} style={periodButtonStyle(period === "all")}>
              Tudo
            </button>
          </div>
          <button type="button" onClick={openCreate} style={primaryButtonStyle}>
            Novo compromisso
          </button>
        </div>
        {feedback ? <div style={feedbackStyle}>{feedback}</div> : null}
      </section>

      {upcomingReminders.length ? (
        <section style={panelStyle}>
          <div style={toolbarStyle}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Lembretes automáticos (15 min)</h2>
            <div style={summaryPillStyle}>{upcomingReminders.length} proximos</div>
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {upcomingReminders.map((item) => (
              <div key={item.id} style={reminderCardStyle}>
                <strong>{item.time}</strong> {item.title}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={panelStyle}>
        <div style={{ ...toolbarStyle, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Compromissos</h2>
          <div style={summaryPillStyle}>{visibleItems.length} itens</div>
        </div>

        {period === "week" ? (
          <div style={weekGridStyle}>
            {weeklyColumns.map((column) => (
              <section
                key={column.key}
                onDragOver={(event) => {
                  if (!draggedAgendaId) {
                    return;
                  }

                  event.preventDefault();
                  if (dragOverDayKey !== column.key) {
                    setDragOverDayKey(column.key);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverDayKey === column.key) {
                    setDragOverDayKey(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const droppedId = event.dataTransfer.getData("text/plain") || draggedAgendaId;
                  setDragOverDayKey(null);
                  setDraggedAgendaId(null);

                  if (!droppedId) {
                    return;
                  }

                  const item = items.find((entry) => entry.id === droppedId);

                  if (!item) {
                    return;
                  }

                  const currentKey = item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 10) : "";

                  if (currentKey === column.key) {
                    return;
                  }

                  moveAgendaItemToDay(item, column.key);
                }}
                style={{
                  ...weekColumnStyle,
                  border:
                    dragOverDayKey === column.key ? "1px solid rgba(79, 70, 229, 0.32)" : weekColumnStyle.border,
                  boxShadow: dragOverDayKey === column.key ? "0 0 0 4px rgba(79, 70, 229, 0.08)" : "none"
                }}
              >
                <div style={weekLabelStyle}>{column.label}</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {column.items.length ? (
                    column.items.map((item) => (
                      <AgendaCard
                        key={item.id}
                        item={item}
                        onEdit={openEdit}
                        onDelete={removeItem}
                        onOpen={() => openEdit(item)}
                        compact
                        draggable
                        isDragging={draggedAgendaId === item.id}
                        onDragStart={() => setDraggedAgendaId(item.id)}
                        onDragEnd={() => {
                          setDraggedAgendaId(null);
                          setDragOverDayKey(null);
                        }}
                      />
                    ))
                  ) : (
                    <div style={emptyDayStyle}>Nenhum compromisso</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : visibleItems.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            {visibleItems.map((item) => (
              <AgendaCard key={item.id} item={item} onEdit={openEdit} onDelete={removeItem} onOpen={() => openEdit(item)} />
            ))}
          </div>
        ) : (
          <div style={emptyStateStyle}>Nenhum compromisso encontrado para o periodo selecionado.</div>
        )}
      </section>
    </CrmShell>
  );
}

function DeleteAgendaModal({
  item,
  isPending,
  onClose,
  onConfirm
}: {
  item: AgendaItem | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!item) {
    return null;
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={confirmModalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={confirmEyebrowStyle}>Confirmar exclusao</div>
        <h2 style={modalTitleStyle}>Excluir compromisso?</h2>
        <div style={confirmTextStyle}>Confira os dados antes de remover este compromisso da agenda.</div>
        <div style={confirmGridStyle}>
          <FieldReadOnly label="Titulo" value={item.title} />
          <FieldReadOnly label="Horario" value={item.time} />
          <FieldReadOnly label="Tipo" value={item.category ?? "Reuniao"} />
          <FieldReadOnly label="Cliente" value={item.accountName || "-"} />
        </div>
        <div style={confirmActionsStyle}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending} style={dangerButtonStyle}>
            {isPending ? "Excluindo..." : "Excluir compromisso"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AgendaCard({
  item,
  onEdit,
  onDelete,
  onOpen,
  compact = false,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd
}: {
  item: AgendaItem;
  onEdit: (item: AgendaItem) => void;
  onDelete: (item: AgendaItem) => void;
  onOpen: () => void;
  compact?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  return (
    <article
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          return;
        }

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={onOpen}
      style={{
        padding: compact ? "12px 14px" : "16px 18px",
        borderRadius: 20,
        background: agendaCategorySurface(item.category),
        border: `1px solid ${agendaCategoryBorder(item.category)}`,
        cursor: draggable ? "grab" : "pointer",
        opacity: isDragging ? 0.55 : 1,
        transform: isDragging ? "scale(0.98)" : "none"
      }}
    >
      <div style={cardHeaderStyle}>
        <div>
          <div style={metaLabelStyle}>Horario</div>
          <div style={{ marginTop: 6, fontWeight: 900, fontSize: compact ? "1rem" : "1.1rem", letterSpacing: "-0.03em" }}>
            {item.time}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(item);
            }}
            style={secondaryButtonStyle}
          >
            Editar
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item);
            }}
            style={dangerButtonStyle}
          >
            Excluir
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, fontWeight: 900, fontSize: compact ? "0.95rem" : "1rem", letterSpacing: "-0.02em" }}>
        {item.title}
      </div>
      <div style={{ marginTop: 8, display: "inline-flex", ...categoryChipStyle(item.category) }}>
        {item.category ?? "Reuniao"}
      </div>
      <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.6, fontSize: compact ? 13 : 14 }}>{item.note}</div>
      {(item.accountName || item.opportunityTitle) ? (
        <div style={linkedListStyle}>
          {item.accountName && item.accountId ? (
            <Link
              href={`/dashboard/customers?focus=${item.accountId}`}
              onClick={(event) => event.stopPropagation()}
              style={linkedChipStyle}
            >
              {item.accountName}
            </Link>
          ) : null}
          {item.opportunityTitle && item.opportunityId ? (
            <Link
              href={`/dashboard/opportunities?focus=${item.opportunityId}`}
              onClick={(event) => event.stopPropagation()}
              style={linkedChipStyle}
            >
              {item.opportunityTitle}
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function AgendaEditorModal({
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
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={toolbarStyle}>
          <div>
            <div style={badgeStyle}>Agenda comercial</div>
            <h2 style={modalTitleStyle}>{editing ? "Editar compromisso" : "Novo compromisso"}</h2>
          </div>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Fechar
          </button>
        </div>

        <div style={modalGridStyle}>
          <Field label="Titulo" value={title} onChange={onTitleChange} />
          <Field label="Data" value={date} onChange={onDateChange} type="date" />
          <Field label="Hora" value={time} onChange={onTimeChange} type="time" />
          <Select
            label="Tipo"
            value={category}
            onChange={onCategoryChange}
            options={[
              { id: "Reuniao", label: "Reuniao" },
              { id: "Ligacao", label: "Ligacao" },
              { id: "E-mail", label: "E-mail" },
              { id: "Follow-up", label: "Follow-up" }
            ]}
          />
          <Select label="Cliente" value={accountId} onChange={onAccountChange} options={[{ id: "", label: "Nao vincular" }, ...accounts]} />
          <Select
            label="Oportunidade"
            value={opportunityId}
            onChange={onOpportunityChange}
            options={[{ id: "", label: "Nao vincular" }, ...opportunities.map((item) => ({ id: item.id, label: item.title }))]}
          />
          <label style={{ display: "grid", gap: 8, gridColumn: "1 / -1" }}>
            <span style={labelStyle}>Observacao</span>
            <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={4} style={textAreaStyle} />
          </label>
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancelar
          </button>
          <button type="button" onClick={onSubmit} disabled={isPending} style={primaryButtonStyle}>
            {isPending ? "Salvando..." : editing ? "Salvar alteracoes" : "Cadastrar compromisso"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}>
        {options.map((option) => (
          <option key={option.id || "blank"} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <div style={readOnlyValueStyle}>{value}</div>
    </div>
  );
}

function matchesPeriod(value: string | undefined, period: PeriodMode) {
  if (!value || period === "all") {
    return true;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return true;
  }

  const now = new Date();

  if (period === "today") {
    return date.toDateString() === now.toDateString();
  }

  const diff = date.getTime() - now.getTime();
  return diff <= 7 * 24 * 60 * 60 * 1000 && diff >= -24 * 60 * 60 * 1000;
}

function isWithinReminderWindow(value: string | undefined) {
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

function buildWeeklyColumns(items: AgendaItem[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = day.toISOString().slice(0, 10);

    return {
      key,
      label: day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }),
      items: items.filter((item) => {
        if (!item.scheduledAt) {
          return false;
        }

        const itemDate = new Date(item.scheduledAt);
        return !Number.isNaN(itemDate.getTime()) && itemDate.toISOString().slice(0, 10) === key;
      })
    };
  });
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
}

function agendaCategoryBorder(category: string | undefined) {
  if (category === "Ligacao") {
    return "rgba(20, 184, 166, 0.22)";
  }

  if (category === "E-mail") {
    return "rgba(37, 99, 235, 0.22)";
  }

  if (category === "Follow-up") {
    return "rgba(168, 85, 247, 0.22)";
  }

  return "rgba(79, 70, 229, 0.18)";
}

function agendaCategorySurface(category: string | undefined) {
  if (category === "Ligacao") {
    return "rgba(20, 184, 166, 0.06)";
  }

  if (category === "E-mail") {
    return "rgba(37, 99, 235, 0.05)";
  }

  if (category === "Follow-up") {
    return "rgba(168, 85, 247, 0.05)";
  }

  return "var(--surface-elevated)";
}

function categoryChipStyle(category: string | undefined): React.CSSProperties {
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

function toDateInput(value?: string) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
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

const panelStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid var(--line)"
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap"
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap"
};

const metaLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const weekGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12
};

const weekColumnStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)",
  minHeight: 220
};

const weekLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const emptyDayStyle: React.CSSProperties = {
  padding: "12px 10px",
  borderRadius: 14,
  border: "1px dashed var(--line)",
  color: "var(--muted)",
  fontSize: 12
};

const emptyStateStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 18,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)",
  color: "var(--muted)"
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(15, 23, 42, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20
};

const modalStyle: React.CSSProperties = {
  width: "min(820px, calc(100vw - 24px))",
  borderRadius: 24,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.16)",
  padding: 24
};

const confirmModalStyle: React.CSSProperties = {
  width: "min(680px, calc(100vw - 24px))",
  borderRadius: 24,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.16)",
  padding: 24
};

const badgeStyle: React.CSSProperties = {
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

const modalTitleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: "1.6rem",
  fontWeight: 900,
  letterSpacing: "-0.04em"
};

const modalGridStyle: React.CSSProperties = {
  marginTop: 20,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14
};

const labelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const confirmEyebrowStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const confirmTextStyle: React.CSSProperties = {
  marginTop: 10,
  color: "var(--muted)",
  lineHeight: 1.6
};

const confirmGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  padding: 16,
  borderRadius: 18,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)"
};

const confirmActionsStyle: React.CSSProperties = {
  marginTop: 18,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  flexWrap: "wrap"
};

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "11px 14px",
  outline: "none",
  font: "inherit",
  background: "#ffffff"
};

const textAreaStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "11px 14px",
  outline: "none",
  font: "inherit",
  background: "#ffffff",
  resize: "vertical"
};

const readOnlyValueStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "11px 14px",
  background: "#ffffff",
  fontWeight: 700
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  border: 0,
  borderRadius: 12,
  padding: "10px 14px",
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "10px 14px",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  color: "#b91c1c",
  border: "1px solid rgba(185, 28, 28, 0.18)"
};

const linkedListStyle: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  flexWrap: "wrap"
};

const linkedChipStyle: React.CSSProperties = {
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

const reminderCardStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  background: "rgba(20, 184, 166, 0.08)",
  border: "1px solid rgba(20, 184, 166, 0.16)"
};

const feedbackStyle: React.CSSProperties = {
  marginTop: 12,
  color: "var(--secondary)",
  fontSize: 13,
  fontWeight: 700
};

function periodButtonStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: 40,
    borderRadius: 12,
    border: "1px solid var(--line)",
    padding: "10px 14px",
    background: active ? "rgba(79, 70, 229, 0.08)" : "#ffffff",
    color: active ? "var(--accent)" : "var(--foreground)",
    fontWeight: 800,
    cursor: "pointer"
  };
}

const summaryPillStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 800
};
