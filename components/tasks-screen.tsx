"use client";

import { useEffect, useState, useTransition } from "react";
import { CrmShell, pillStyle } from "@/components/crm-shell";
import { hasPermission } from "@/lib/access-control";
import { completeTask, createTask, deleteTask, getTasks, updateTask } from "@/lib/crm-data-source";
import { seedTasks } from "@/lib/crm-seed";
import { useCrmRole } from "@/lib/use-crm-role";
import type { TaskItem } from "@/types/crm-app";

const PRIORITY_OPTIONS = [
  { id: "Alta", label: "Alta" },
  { id: "Media", label: "Media" },
  { id: "Baixa", label: "Baixa" }
];

export function TasksScreen() {
  const role = useCrmRole();
  const [tasks, setTasks] = useState<TaskItem[]>(seedTasks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState(PRIORITY_OPTIONS[1].id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taskPendingDelete, setTaskPendingDelete] = useState<TaskItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canCreate = role ? hasPermission(role, "tasks:write") : true;
  const canEdit = role ? hasPermission(role, "records:edit") || hasPermission(role, "tasks:write") : true;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const nextTasks = await getTasks();

      if (isMounted) {
        setTasks(nextTasks);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDueDate("");
    setDueTime("");
    setPriority(PRIORITY_OPTIONS[1].id);
  }

  function openCreateModal() {
    resetForm();
    setIsViewMode(false);
    setIsModalOpen(true);
    setFeedback(null);
  }

  function populateTask(task: TaskItem) {
    setEditingId(task.id);
    setTitle(task.title);
    setDueDate(task.dueDate ?? "");
    setDueTime(task.dueTime ?? "");
    setPriority(task.priority);
  }

  function openView(task: TaskItem) {
    populateTask(task);
    setIsViewMode(true);
    setIsModalOpen(true);
    setFeedback(null);
  }

  function startEdit(task: TaskItem) {
    if (!canEdit) {
      setFeedback("Seu perfil nao pode editar tarefas.");
      return;
    }

    populateTask(task);
    setIsViewMode(false);
    setIsModalOpen(true);
    setFeedback(null);
  }

  function handleSubmit() {
    setFeedback(null);

    if (editingId) {
      if (!canEdit) {
        setFeedback("Seu perfil nao pode editar tarefas.");
        return;
      }

      const currentRecord = tasks.find((item) => item.id === editingId);

      if (!currentRecord) {
        resetForm();
        return;
      }

      startTransition(() => {
        void (async () => {
          const updated = await updateTask({
            id: editingId,
            title,
            dueDate,
            dueTime,
            priority,
            companyLabel: currentRecord.company
          });

          setTasks((current) =>
            current.map((item) =>
              item.id === editingId
                ? {
                    ...item,
                    ...updated
                  }
                : item
            )
          );
          setIsViewMode(false);
          setIsModalOpen(false);
          resetForm();
          setFeedback("Tarefa atualizada.");
        })();
      });

      return;
    }

    if (!canCreate) {
      setFeedback("Seu perfil nao pode criar tarefas.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const created = await createTask({
          title,
          dueDate,
          dueTime,
          priority
        });

        setTasks((current) => [created, ...current]);
        setIsViewMode(false);
        setIsModalOpen(false);
        resetForm();
        setFeedback("Tarefa adicionada.");
      })();
    });
  }

  function handleComplete(taskId: string) {
    if (!canEdit) {
      setFeedback("Seu perfil nao pode concluir tarefas.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const currentTask = tasks.find((task) => task.id === taskId);
        const success = await completeTask(taskId, currentTask?.title);

        if (success) {
          setTasks((current) => current.filter((task) => task.id !== taskId));
          setFeedback("Tarefa concluida.");
        }
      })();
    });
  }

  function requestDelete(task: TaskItem) {
    if (!canEdit) {
      setFeedback("Seu perfil nao pode excluir tarefas.");
      return;
    }

    setTaskPendingDelete(task);
    setFeedback(null);
  }

  function confirmDelete() {
    if (!taskPendingDelete) {
      return;
    }

    startTransition(() => {
      void (async () => {
        const currentTask = taskPendingDelete;
        const success = await deleteTask({
          id: currentTask.id,
          title: currentTask.title
        });

        if (success) {
          setTasks((current) => current.filter((task) => task.id !== currentTask.id));
          setFeedback("Tarefa excluida.");
        } else {
          setFeedback("Nao foi possivel excluir a tarefa.");
        }

        setTaskPendingDelete(null);
      })();
    });
  }

  return (
    <CrmShell
      activePath="/dashboard/tasks"
      title="Tarefas"
      subtitle="Controle de follow-up, pendencias e proximas acoes da operacao comercial."
      primaryAction="Nova tarefa"
    >
      <TaskFormModal
        open={isModalOpen}
        editing={Boolean(editingId)}
        viewMode={isViewMode}
        title={title}
        onTitleChange={setTitle}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        dueTime={dueTime}
        onDueTimeChange={setDueTime}
        priority={priority}
        onPriorityChange={setPriority}
        onEnableEdit={() => setIsViewMode(false)}
        onClose={() => {
          setIsViewMode(false);
          setIsModalOpen(false);
          resetForm();
        }}
        onSubmit={handleSubmit}
        isPending={isPending}
        canSubmit={Boolean(editingId ? canEdit : canCreate) && Boolean(title.trim())}
      />
      <DeleteTaskModal
        task={taskPendingDelete}
        isPending={isPending}
        onClose={() => setTaskPendingDelete(null)}
        onConfirm={confirmDelete}
      />

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
            flexWrap: "wrap"
          }}
        >
          <div>
            <div style={{ fontWeight: 800 }}>Cadastro de tarefa em modal</div>
            <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 13 }}>
              Criacao, visualizacao e edicao no mesmo fluxo, com layout de janela.
            </div>
          </div>
          <button type="button" onClick={openCreateModal} disabled={!canCreate} style={submitButtonStyle}>
            Nova tarefa
          </button>
        </div>
        {!canCreate ? <div style={warningStyle}>Seu perfil pode visualizar, mas nao criar tarefas.</div> : null}
        {feedback ? <div style={feedbackStyle}>{feedback}</div> : null}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16
        }}
      >
        <MetricCard label="Tarefas em aberto" value={String(tasks.length)} />
        <MetricCard label="Alta prioridade" value={String(tasks.filter((task) => task.priority === "Alta").length)} />
        <MetricCard label="Proxima entrega" value={tasks[0]?.due ?? "Sem prazo"} />
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={pillStyle}>Buscar tarefa</div>
            <div style={pillStyle}>Prioridade</div>
            <div style={pillStyle}>Vencimento</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {tasks.map((task) => (
            <article
              key={task.id}
              onClick={() => openView(task)}
              style={{
                display: "grid",
                gap: 12,
                padding: "16px 18px",
                borderRadius: 20,
                background: "var(--surface-elevated)",
                border: "1px solid var(--line)",
                cursor: "pointer"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap"
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: "1.02rem",
                      lineHeight: 1.15,
                      letterSpacing: "-0.03em"
                    }}
                  >
                    {task.title}
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
                    {task.company}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEdit(task);
                    }}
                    disabled={!canEdit}
                    style={editButtonStyle}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleComplete(task.id);
                    }}
                    disabled={!canEdit}
                    style={completeButtonStyle}
                  >
                    Concluir
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDelete(task);
                    }}
                    disabled={!canEdit}
                    style={deleteButtonStyle}
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12
                }}
              >
                <DataCell label="Execucao" value={task.due} />
                <DataCell label="Prioridade" value={task.priority} emphasis color={priorityColor(task.priority)} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </CrmShell>
  );
}

function DeleteTaskModal({
  task,
  isPending,
  onClose,
  onConfirm
}: {
  task: TaskItem | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!task) {
    return null;
  }

  return (
    <div style={modalOverlayStyle}>
      <div style={confirmCardStyle} onClick={(event) => event.stopPropagation()}>
        <div style={confirmEyebrowStyle}>Confirmar exclusao</div>
        <h2 style={modalTitleStyle}>Excluir tarefa?</h2>
        <div style={feedbackDescriptionStyle}>Confira os dados antes de remover esta tarefa do sistema.</div>
        <div style={summaryBoxStyle}>
          <ModalStat label="Titulo" value={task.title} />
          <ModalStat label="Empresa" value={task.company} />
          <ModalStat label="Execucao" value={task.due} />
          <ModalStat label="Prioridade" value={task.priority} />
        </div>
        <div style={modalFooterStyle}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending} style={deleteButtonStyle}>
            {isPending ? "Excluindo..." : "Excluir tarefa"}
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
  placeholder,
  required = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 8, minWidth: 0, width: "100%" }}>
      <span style={fieldLabelStyle}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        style={inputStyle}
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 8, minWidth: 0, width: "100%" }}>
      <span style={fieldLabelStyle}>{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} disabled={disabled} />
    </label>
  );
}

function TimeField({
  label,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 8, minWidth: 0, width: "100%" }}>
      <span style={fieldLabelStyle}>{label}</span>
      <input type="time" value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} disabled={disabled} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 8, minWidth: 0, width: "100%" }}>
      <span style={fieldLabelStyle}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} disabled={disabled}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TaskFormModal({
  open,
  editing,
  viewMode,
  title,
  onTitleChange,
  dueDate,
  onDueDateChange,
  dueTime,
  onDueTimeChange,
  priority,
  onPriorityChange,
  onEnableEdit,
  onClose,
  onSubmit,
  isPending,
  canSubmit
}: {
  open: boolean;
  editing: boolean;
  viewMode: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  dueTime: string;
  onDueTimeChange: (value: string) => void;
  priority: string;
  onPriorityChange: (value: string) => void;
  onEnableEdit: () => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  canSubmit: boolean;
}) {
  if (!open) {
    return null;
  }

  const priorityLabel = PRIORITY_OPTIONS.find((item) => item.id === priority)?.label ?? priority;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={modalBadgeStyle}>Tarefa</div>
            <h2 style={modalTitleStyle}>
              {editing ? (viewMode ? "Visualizar tarefa" : "Editar tarefa") : "Nova tarefa"}
            </h2>
            <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 14, lineHeight: 1.6, maxWidth: 560 }}>
              Janela de trabalho com criacao, visualizacao e edicao no mesmo fluxo.
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
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
            alignItems: "start"
          }}
        >
          <div style={formPanelStyle}>
            <div style={sectionTitleStyle}>Dados da tarefa</div>
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                alignItems: "end"
              }}
            >
              <Field
                label="Tarefa"
                value={title}
                onChange={onTitleChange}
                placeholder="Ligar para cliente"
                required
                disabled={viewMode}
              />
              <DateField label="Data" value={dueDate} onChange={onDueDateChange} disabled={viewMode} />
              <TimeField label="Hora" value={dueTime} onChange={onDueTimeChange} disabled={viewMode} />
              <SelectField
                label="Prioridade"
                value={priority}
                onChange={onPriorityChange}
                options={PRIORITY_OPTIONS}
                disabled={viewMode}
              />
            </div>
          </div>

          <div style={sidePanelStyle}>
            <div style={summaryCardStyle}>
              <div style={sectionTitleStyle}>Resumo da tarefa</div>
              <div style={summaryBoxStyle}>
                <ModalStat label="Titulo" value={title || "Nao informado"} />
                <ModalStat label="Prioridade" value={priorityLabel || "Nao informada"} />
                <ModalStat label="Execucao" value={[dueDate, dueTime].filter(Boolean).join(" ") || "Sem agenda"} />
              </div>
            </div>

            <div style={highlightCardStyle}>
              <div style={sectionTitleStyle}>Status visual</div>
              <div style={{ marginTop: 8, fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.04em" }}>
                {viewMode ? "Consulta" : editing ? "Edicao" : "Criacao"}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55 }}>
                Defina a prioridade e o horario para manter a cadencia comercial previsivel.
              </div>
            </div>
          </div>
        </div>

        <div style={modalFooterStyle}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            {viewMode ? "Fechar" : "Cancelar"}
          </button>
          {editing && viewMode ? (
            <button type="button" onClick={onEnableEdit} disabled={!canSubmit} style={submitButtonStyle}>
              Editar agora
            </button>
          ) : (
            <button type="button" onClick={onSubmit} disabled={isPending || !canSubmit} style={submitButtonStyle}>
              {isPending ? "Salvando..." : editing ? "Salvar edicao" : "Salvar tarefa"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article
      style={{
        padding: 22,
        borderRadius: 24,
        background: "#ffffff",
        border: "1px solid var(--line)"
      }}
    >
      <div style={metricLabelStyle}>{label}</div>
      <div
        style={{
          marginTop: 10,
          fontSize: "2rem",
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: "-0.05em"
        }}
      >
        {value}
      </div>
    </article>
  );
}

function DataCell({
  label,
  value,
  emphasis = false,
  color
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  color?: string;
}) {
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <div
        style={{
          marginTop: 6,
          fontWeight: emphasis ? 900 : 700,
          fontSize: emphasis ? 13.5 : 13,
          letterSpacing: emphasis ? "-0.01em" : "0",
          color: color ?? "inherit"
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ModalStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.5,
          overflowWrap: "anywhere"
        }}
      >
        {value}
      </div>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const metricLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "11px 14px",
  outline: "none",
  font: "inherit",
  background: "#ffffff",
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box"
};

const submitButtonStyle: React.CSSProperties = {
  minHeight: 44,
  border: 0,
  borderRadius: 14,
  padding: "12px 16px",
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid var(--line)",
  padding: "12px 16px",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const feedbackStyle: React.CSSProperties = {
  marginTop: 12,
  color: "var(--secondary)",
  fontSize: 13,
  fontWeight: 700
};

const warningStyle: React.CSSProperties = {
  marginTop: 12,
  color: "#a16207",
  fontSize: 13,
  fontWeight: 700
};

const feedbackDescriptionStyle: React.CSSProperties = {
  marginTop: 10,
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.6
};

const editButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: "8px 12px",
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer"
};

const completeButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: "8px 12px",
  background: "rgba(20, 184, 166, 0.12)",
  color: "#0f766e",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer"
};

const deleteButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: "8px 12px",
  background: "rgba(220, 38, 38, 0.1)",
  color: "#b91c1c",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer"
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: "rgba(15, 23, 42, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20
};

const modalCardStyle: React.CSSProperties = {
  width: "min(1260px, calc(100vw - 24px))",
  maxHeight: "min(90vh, 980px)",
  overflowY: "auto",
  overflowX: "hidden",
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.16)",
  padding: 24
};

const confirmCardStyle: React.CSSProperties = {
  ...modalCardStyle,
  width: "min(720px, calc(100vw - 24px))",
  maxHeight: "unset"
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  flexWrap: "wrap"
};

const modalFooterStyle: React.CSSProperties = {
  position: "sticky",
  bottom: -24,
  marginTop: 20,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  flexWrap: "wrap",
  paddingTop: 18,
  paddingBottom: 6,
  background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 24%)",
  borderTop: "1px solid rgba(15, 23, 42, 0.06)"
};

const modalBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase"
};

const confirmEyebrowStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const modalTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "1.75rem",
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: "-0.04em",
  color: "var(--foreground)"
};

const formPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  minWidth: 0,
  overflow: "hidden",
  padding: 18,
  borderRadius: 20,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)"
};

const sidePanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  minWidth: 0
};

const summaryCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "linear-gradient(180deg, rgba(79, 70, 229, 0.06) 0%, rgba(79, 70, 229, 0.02) 100%)",
  border: "1px solid rgba(79, 70, 229, 0.12)"
};

const summaryBoxStyle: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid rgba(79, 70, 229, 0.08)"
};

const highlightCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "rgba(20, 184, 166, 0.08)",
  border: "1px solid rgba(20, 184, 166, 0.16)",
  color: "#0f766e"
};

const sectionTitleStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};
