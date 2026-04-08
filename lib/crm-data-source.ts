"use client";

import { supabase } from "@/lib/supabase";
import { getCrmSettings, peekCrmSettings } from "@/lib/crm-settings";
import {
  seedActivity,
  seedAgenda,
  seedCustomers,
  seedDashboardData,
  seedOpportunities,
  seedTasks
} from "@/lib/crm-seed";
import type {
  ActivityItem,
  AgendaItem,
  CustomerItem,
  DashboardData,
  NotificationItem,
  NotificationPriority,
  PipelineAttentionData,
  PipelineAttentionItem,
  OpportunityItem,
  OpportunityNote,
  PipelineStatistics,
  PipelineColumn,
  TaskItem
} from "@/types/crm-app";

type ReferenceOption = {
  id: string;
  label: string;
  searchText?: string;
  probability?: number;
};

export const LEAD_SOURCE_OPTIONS: ReferenceOption[] = [
  { id: "indicacao", label: "Indicacao" },
  { id: "cliente-ativo", label: "Cliente Ativo" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "google", label: "Google" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "outbound", label: "Outbound" },
  { id: "site", label: "Site" },
  { id: "parceiro", label: "Parceiro" },
  { id: "outro", label: "Outro" }
];

type StoredNotification = NotificationItem & {
  resolvedAt?: string | null;
  entityType?: string;
  entityId?: string;
};

type NotificationRuleDraft = {
  ruleKey: string;
  type: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  priority: NotificationPriority;
  entityType?: string;
  entityId?: string;
};

type CurrentUserContext = {
  userId: string;
  organizationId: string;
  fullName: string;
};

const LOCAL_OPPORTUNITIES_KEY = "crm_local_opportunity_previews";
const LOCAL_OPPORTUNITY_NOTES_KEY = "crm_local_opportunity_notes";
const LOCAL_CUSTOMERS_KEY = "crm_local_customers";
const LOCAL_ACTIVITY_KEY = "crm_local_activity";
const LOCAL_AGENDA_KEY = "crm_local_agenda";
const LOCAL_NOTIFICATIONS_KEY = "crm_local_notifications";
const LOCAL_AGENT_LAST_RUN_DATE_KEY = "crm_pipeline_agent_last_run_date";
const LOCAL_AGENT_HISTORY_KEY = "crm_pipeline_agent_history";
const CRM_DATA_CHANGED_EVENT = "crm:data-changed";
const STAGE_NOTE_PREFIX = "stage_move:";
const AUDIT_NOTE_PREFIX = "audit:";
const OPPORTUNITY_NOTE_PREFIX = "opportunity_note:";
const AGENT_TASK_PREFIX = "[AGENTE PIPELINE]";
const USER_CONTEXT_CACHE_TTL_MS = 5000;
const QUERY_CACHE_TTL_MS = 4000;
const DASHBOARD_PIPELINE_LIMIT = 120;
const REFERENCE_ITEMS_LIMIT = 200;
const MAX_AGENT_HISTORY_ITEMS = 40;

export type PipelineAgentExecutionHistoryEntry = {
  id: string;
  dateKey: string;
  ranAt: string;
  executed: boolean;
  createdTasks: number;
  reviewed: number;
  reason: string;
};
let currentUserContextCache:
  | {
      expiresAt: number;
      promise: Promise<CurrentUserContext | null>;
    }
  | null = null;
const queryCache = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<unknown>;
  }
>();

export const DEFAULT_STAGE_OPTIONS: ReferenceOption[] = [
  { id: "lead", label: "Lead", probability: 10 },
  { id: "qualification", label: "Qualificacao", probability: 25 },
  { id: "discovery", label: "Diagnostico", probability: 45 },
  { id: "proposal-sent", label: "Proposta enviada", probability: 70 },
  { id: "negotiation", label: "Negociacao", probability: 80 },
  { id: "closing", label: "Fechamento", probability: 100 }
];

const DEFAULT_STAGE_PROBABILITIES: Record<string, number> = {
  Lead: 10,
  Prospect: 10,
  Qualificacao: 25,
  Qualificado: 25,
  Diagnostico: 45,
  Apresentacao: 45,
  "Proposta enviada": 70,
  Proposta: 70,
  Negociacao: 80,
  Fechamento: 100,
  Conclusao: 100
};

const STAGE_PROGRESS_ORDER = ["Lead", "Qualificacao", "Diagnostico", "Proposta enviada", "Negociacao", "Fechamento"] as const;

export const CONCLUSION_STATUS_OPTIONS: ReferenceOption[] = [
  { id: "ativo", label: "Ativo" },
  { id: "cancelado", label: "Cancelado" },
  { id: "suspenso", label: "Suspenso" },
  { id: "conquistado", label: "Conquistado" }
];

export const CONCLUSION_REASON_OPTIONS: ReferenceOption[] = [
  { id: "negocio-fechado", label: "Negocio Fechado" },
  { id: "oportunidade-nunca-existiu", label: "Oportunidade Nunca Existiu" },
  { id: "perdido", label: "Perdido" },
  { id: "projeto-futuro", label: "Projeto Futuro" }
];

function normalizeStageLabel(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();

  if (!normalized) {
    return "Sem etapa";
  }

  if (normalized === "prospect") {
    return "Lead";
  }

  if (normalized === "qualificado") {
    return "Qualificacao";
  }

  if (normalized === "apresentacao") {
    return "Diagnostico";
  }

  if (normalized === "proposta") {
    return "Proposta enviada";
  }

  if (normalized === "conclusao") {
    return "Fechamento";
  }

  return value ?? "Sem etapa";
}

export function isConclusionStage(stage: string | null | undefined) {
  const normalized = (stage ?? "").trim().toLowerCase();
  return normalized === "conclusao" || normalized === "fechamento";
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

type OpportunityStageSummary = {
  name: string | null;
  probability?: number | null;
};

type OpportunityAccountSummary = {
  trade_name: string | null;
  legal_name: string | null;
};

type OpportunityOwnerSummary = {
  full_name: string | null;
};

type OpportunityQueryRecord = {
  id: string;
  title: string;
  amount: number | null;
  base_amount: number | null;
  is_recurring: boolean | null;
  months: number | null;
  owner_id: string | null;
  status: string | null;
  next_step: string | null;
  expected_close_date: string | null;
  conclusion_status?: string | null;
  conclusion_reason?: string | null;
  concluded_at?: string | null;
  probability_override?: number | null;
  lead_source?: string | null;
  created_at?: string | null;
  pipeline_stages: OpportunityStageSummary | OpportunityStageSummary[] | null;
  accounts: OpportunityAccountSummary | OpportunityAccountSummary[] | null;
  profiles: OpportunityOwnerSummary | OpportunityOwnerSummary[] | null;
};

function getLocalOpportunityPreviews(): OpportunityItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_OPPORTUNITIES_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as OpportunityItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => {
      const normalizedStage = normalizeStageLabel(item.stage);
      const hasManualProbability = typeof item.manualProbability === "number" && Number.isFinite(item.manualProbability);
      const effectiveProbability =
        typeof item.probability === "number" && Number.isFinite(item.probability)
          ? item.probability
          : hasManualProbability
            ? item.manualProbability ?? 0
            : DEFAULT_STAGE_PROBABILITIES[normalizedStage] ?? 0;

      return {
        ...item,
        leadSource: typeof item.leadSource === "string" ? item.leadSource : undefined,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
        stage: normalizedStage,
        probability: Math.max(0, Math.min(100, effectiveProbability)),
        manualProbability: hasManualProbability ? item.manualProbability : undefined
      };
    });
  } catch {
    return [];
  }
}

function getLocalCustomers(): CustomerItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_CUSTOMERS_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as CustomerItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalOpportunityNotes(): OpportunityNote[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_OPPORTUNITY_NOTES_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as OpportunityNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalActivity(): ActivityItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_ACTIVITY_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ActivityItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalAgenda(): AgendaItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_AGENDA_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as AgendaItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalNotifications(): StoredNotification[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StoredNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalAgentExecutionHistory(): PipelineAgentExecutionHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(LOCAL_AGENT_HISTORY_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as PipelineAgentExecutionHistoryEntry[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: item.id,
        dateKey: item.dateKey,
        ranAt: item.ranAt,
        executed: Boolean(item.executed),
        createdTasks: Number.isFinite(item.createdTasks) ? item.createdTasks : 0,
        reviewed: Number.isFinite(item.reviewed) ? item.reviewed : 0,
        reason: item.reason || "Sem detalhe"
      }));
  } catch {
    return [];
  }
}

function saveLocalOpportunityNotes(items: OpportunityNote[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_OPPORTUNITY_NOTES_KEY, JSON.stringify(items));
  notifyCrmDataChanged();
}

function saveLocalNotifications(items: StoredNotification[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(items));
  notifyCrmDataChanged();
}

function saveLocalAgentExecutionHistory(items: PipelineAgentExecutionHistoryEntry[], notify = true) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_AGENT_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_AGENT_HISTORY_ITEMS)));

  if (notify) {
    notifyCrmDataChanged();
  }
}

async function registerPipelineAgentExecution(
  entry: Omit<PipelineAgentExecutionHistoryEntry, "id">,
  context: Awaited<ReturnType<typeof getCurrentUserContext>> | null
) {
  if (typeof window !== "undefined") {
    const current = getLocalAgentExecutionHistory();
    const last = current[0];

    if (
      !last ||
      !(
        last.dateKey === entry.dateKey &&
        last.executed === entry.executed &&
        last.createdTasks === entry.createdTasks &&
        last.reviewed === entry.reviewed &&
        last.reason === entry.reason
      )
    ) {
      const next: PipelineAgentExecutionHistoryEntry = {
        id: `agent-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...entry
      };

      saveLocalAgentExecutionHistory([next, ...current], true);
    }
  }

  if (!context) {
    return;
  }

  try {
    const { data: latest } = await supabase
      .from("pipeline_agent_runs")
      .select("id, date_key, executed, created_tasks, reviewed, reason")
      .eq("user_id", context.userId)
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isDuplicate =
      latest &&
      latest.date_key === entry.dateKey &&
      Boolean(latest.executed) === entry.executed &&
      (latest.created_tasks ?? 0) === entry.createdTasks &&
      (latest.reviewed ?? 0) === entry.reviewed &&
      (latest.reason ?? "") === entry.reason;

    if (isDuplicate) {
      return;
    }

    await supabase.from("pipeline_agent_runs").insert({
      organization_id: context.organizationId,
      user_id: context.userId,
      date_key: entry.dateKey,
      ran_at: entry.ranAt,
      executed: entry.executed,
      created_tasks: entry.createdTasks,
      reviewed: entry.reviewed,
      reason: entry.reason
    });
  } catch {
    // Fallback local ja foi salvo acima.
  }
}

export async function getPipelineAgentExecutionHistory(limit = 20): Promise<PipelineAgentExecutionHistoryEntry[]> {
  const safeLimit = Math.max(1, limit);
  const localHistory = getLocalAgentExecutionHistory().slice(0, safeLimit);
  const context = await getCurrentUserContext();

  if (!context) {
    return localHistory;
  }

  try {
    const { data, error } = await supabase
      .from("pipeline_agent_runs")
      .select("id, date_key, ran_at, executed, created_tasks, reviewed, reason")
      .eq("user_id", context.userId)
      .order("ran_at", { ascending: false })
      .limit(safeLimit);

    if (error || !data) {
      return localHistory;
    }

    return data.map((item) => ({
      id: item.id,
      dateKey: item.date_key,
      ranAt: item.ran_at,
      executed: Boolean(item.executed),
      createdTasks: item.created_tasks ?? 0,
      reviewed: item.reviewed ?? 0,
      reason: item.reason ?? "Sem detalhe"
    }));
  } catch {
    return localHistory;
  }
}

function saveLocalNotificationsIfChanged(items: StoredNotification[]) {
  const current = getLocalNotifications();

  if (JSON.stringify(current) === JSON.stringify(items)) {
    return;
  }

  saveLocalNotifications(items);
}

function saveLocalAgenda(items: AgendaItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_AGENDA_KEY, JSON.stringify(items));
  notifyCrmDataChanged();
}

function saveLocalActivity(item: ActivityItem) {
  if (typeof window === "undefined") {
    return;
  }

  const current = getLocalActivity();
  const next = [item, ...current].slice(0, 8);
  window.localStorage.setItem(LOCAL_ACTIVITY_KEY, JSON.stringify(next));
  notifyCrmDataChanged();
}

export async function clearCrmOperationalData(): Promise<{
  ok: boolean;
  remoteCleared: boolean;
  message: string;
}> {
  if (typeof window !== "undefined") {
    [
      LOCAL_OPPORTUNITIES_KEY,
      LOCAL_OPPORTUNITY_NOTES_KEY,
      LOCAL_CUSTOMERS_KEY,
      LOCAL_ACTIVITY_KEY,
      LOCAL_AGENDA_KEY,
      LOCAL_NOTIFICATIONS_KEY,
      LOCAL_AGENT_LAST_RUN_DATE_KEY,
      LOCAL_AGENT_HISTORY_KEY
    ].forEach((key) => window.localStorage.removeItem(key));
  }

  const context = await getCurrentUserContext();

  if (!context) {
    notifyCrmDataChanged();
    return {
      ok: true,
      remoteCleared: false,
      message: "Dados locais limpos. Nao havia sessao autenticada para limpar o Supabase."
    };
  }

  try {
    await supabase.from("notifications").delete().not("id", "is", null);
    await supabase.from("pipeline_agent_runs").delete().not("id", "is", null);
    await supabase.from("activities").delete().not("id", "is", null);
    await supabase.from("tasks").delete().not("id", "is", null);
    await supabase.from("opportunities").delete().not("id", "is", null);
    await supabase.from("contacts").delete().not("id", "is", null);
    await supabase.from("accounts").delete().not("id", "is", null);
    notifyCrmDataChanged();

    return {
      ok: true,
      remoteCleared: true,
      message: "Dados locais e operacionais do Supabase foram limpos."
    };
  } catch {
    notifyCrmDataChanged();
    return {
      ok: true,
      remoteCleared: false,
      message: "Dados locais limpos. A limpeza do Supabase nao foi concluida com a sessao atual."
    };
  }
}

function buildRelativeActivity(createdAt: string | null | undefined) {
  return formatRelative(createdAt);
}

function parseStageMovement(notes: string | null | undefined) {
  if (!notes) {
    return null;
  }

  if (notes.startsWith("stage:")) {
    return {
      fromStage: "",
      toStage: notes.slice("stage:".length)
    };
  }

  if (!notes.startsWith(STAGE_NOTE_PREFIX)) {
    return null;
  }

  const payload = notes.slice(STAGE_NOTE_PREFIX.length);
  const [fromStage = "", toStage = ""] = payload.split("||");

  return {
    fromStage,
    toStage
  };
}

function parseAuditEvent(notes: string | null | undefined) {
  if (!notes?.startsWith(AUDIT_NOTE_PREFIX)) {
    return null;
  }

  const payload = notes.slice(AUDIT_NOTE_PREFIX.length);
  const [eventType = "interaction", action = "", target = ""] = payload.split("||");

  return {
    eventType: eventType as ActivityItem["eventType"],
    action,
    target
  };
}

function parseOpportunityNote(notes: string | null | undefined) {
  if (!notes?.startsWith(OPPORTUNITY_NOTE_PREFIX)) {
    return null;
  }

  return notes.slice(OPPORTUNITY_NOTE_PREFIX.length).trim();
}

function saveLocalCustomer(item: CustomerItem) {
  if (typeof window === "undefined") {
    return;
  }

  const current = getLocalCustomers();
  const next = [item, ...current.filter((entry) => entry.id !== item.id)];
  window.localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(next));
  notifyCrmDataChanged();
}

function removeLocalCustomer(customerId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const next = getLocalCustomers().filter((item) => item.id !== customerId);
  window.localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(next));
  notifyCrmDataChanged();
}

function mergeCustomers(remote: CustomerItem[], local: CustomerItem[]) {
  const byId = new Map<string, CustomerItem>();

  remote.forEach((item) => byId.set(item.id, item));
  local.forEach((item) => byId.set(item.id, item));

  return Array.from(byId.values());
}

function mergeOpportunities(primary: OpportunityItem[], secondary: OpportunityItem[]) {
  const byId = new Map<string, OpportunityItem>();

  secondary.forEach((item) => byId.set(item.id, item));
  primary.forEach((item) => byId.set(item.id, item));

  return Array.from(byId.values());
}

export function notifyCrmDataChanged() {
  if (typeof window === "undefined") {
    return;
  }

  queryCache.clear();
  window.dispatchEvent(new Event(CRM_DATA_CHANGED_EVENT));
}

export function subscribeCrmDataChanged(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => {
    queryCache.clear();
    callback();
  };

  window.addEventListener(CRM_DATA_CHANGED_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(CRM_DATA_CHANGED_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function getCachedQuery<T>(cacheKey: string, loader: () => Promise<T>, ttlMs = QUERY_CACHE_TTL_MS): Promise<T> {
  const cached = queryCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise as Promise<T>;
  }

  const promise = loader();

  queryCache.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    promise
  });

  promise.catch(() => {
    const active = queryCache.get(cacheKey);

    if (active?.promise === promise) {
      queryCache.delete(cacheKey);
    }
  });

  return promise;
}

function saveLocalOpportunityPreview(item: OpportunityItem) {
  if (typeof window === "undefined") {
    return;
  }

  const current = getLocalOpportunityPreviews();
  const next = [item, ...current.filter((entry) => entry.id !== item.id)];
  window.localStorage.setItem(LOCAL_OPPORTUNITIES_KEY, JSON.stringify(next));
  notifyCrmDataChanged();
}

function updateLocalOpportunityPreview(item: OpportunityItem) {
  if (typeof window === "undefined") {
    return;
  }

  const current = getLocalOpportunityPreviews();
  const hasExisting = current.some((entry) => entry.id === item.id);
  const next = hasExisting ? current.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...current];
  window.localStorage.setItem(LOCAL_OPPORTUNITIES_KEY, JSON.stringify(next));
  notifyCrmDataChanged();
}

function removeLocalOpportunityPreview(opportunityId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const next = getLocalOpportunityPreviews().filter((item) => item.id !== opportunityId);
  window.localStorage.setItem(LOCAL_OPPORTUNITIES_KEY, JSON.stringify(next));
  notifyCrmDataChanged();
}

function existingLocalOpportunityCreatedAt(opportunityId: string) {
  return getLocalOpportunityPreviews().find((item) => item.id === opportunityId)?.createdAt ?? undefined;
}

function sortOpportunityNotesByDateDesc(left: OpportunityNote, right: OpportunityNote) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function buildPipelineFromOpportunities(items: OpportunityItem[]): PipelineColumn[] {
  const grouped = new Map<string, PipelineColumn>();

  items.forEach((opportunity) => {
    const stageKey = opportunity.stage || "Sem etapa";

    if (!grouped.has(stageKey)) {
      grouped.set(stageKey, {
        id: stageKey.toLowerCase().replace(/\s+/g, "-"),
        name: stageKey,
        total: "R$ 0,00",
        deals: []
      });
    }

    const column = grouped.get(stageKey);

    if (!column) {
      return;
    }

    column.deals.push({
      id: opportunity.id,
      company: opportunity.company,
      title: opportunity.title,
      owner: opportunity.owner,
      value: opportunity.amount,
      nextStep: opportunity.nextStep
    });
  });

  return Array.from(grouped.values()).map((column) => {
    const totalValue = column.deals.reduce((sum, deal) => sum + amountLabelToNumber(deal.value), 0);

    return {
      ...column,
      total: currency(totalValue)
    };
  });
}

function amountLabelToNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace("R$", "").replace(/\./g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function currency(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "R$ 0,00";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

type PipelineStatsSourceOpportunity = {
  id: string;
  stage: string;
  probability: number;
  amount: number;
  leadSource?: string;
  createdAt?: string;
  expectedCloseDate: string | null;
  status: string;
};

function normalizePipelineStatsOpportunity(input: {
  id: string;
  stage: string;
  probability?: number | null;
  amount: number;
  leadSource?: string;
  createdAt?: string;
  expectedCloseDate: string | null;
  status: string;
}): PipelineStatsSourceOpportunity {
  return {
    id: input.id,
    stage: input.stage,
    probability: Math.max(0, Math.min(100, input.probability ?? DEFAULT_STAGE_PROBABILITIES[input.stage] ?? 0)),
    amount: Math.max(0, input.amount),
    leadSource: input.leadSource?.trim() || undefined,
    createdAt: input.createdAt ?? undefined,
    expectedCloseDate: input.expectedCloseDate,
    status: input.status
  };
}

function isOpenPipelineOpportunity(item: PipelineStatsSourceOpportunity) {
  return mapUiOpportunityStatusToDb(item.status) === "open" && !isConclusionStage(item.stage);
}

function isSameMonth(date: Date, reference: Date) {
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

function getClosedRevenueThisMonth(items: OpportunityItem[], referenceDate = new Date()) {
  return items.reduce((sum, item) => {
    if (mapUiOpportunityStatusToDb(item.status) !== "won") {
      return sum;
    }

    if (!item.concludedAt) {
      return sum;
    }

    const concludedAt = new Date(item.concludedAt);
    if (Number.isNaN(concludedAt.getTime()) || !isSameMonth(concludedAt, referenceDate)) {
      return sum;
    }

    return sum + amountLabelToNumber(item.amount);
  }, 0);
}

function stageProgressIndex(stage: string) {
  const normalized = normalizeStageLabel(stage);
  const index = STAGE_PROGRESS_ORDER.indexOf(normalized as (typeof STAGE_PROGRESS_ORDER)[number]);
  return index >= 0 ? index : -1;
}

function buildConversionMetrics(items: PipelineStatsSourceOpportunity[]) {
  const validItems = items.filter((item) => mapUiOpportunityStatusToDb(item.status) !== "lost");
  const totalTracked = validItems.length;
  const reachedContato = validItems.filter((item) => stageProgressIndex(item.stage) >= 1).length;
  const reachedProposta = validItems.filter((item) => stageProgressIndex(item.stage) >= 3).length;
  const reachedVenda = validItems.filter((item) => mapUiOpportunityStatusToDb(item.status) === "won").length;

  return [
    {
      label: "Lead -> Contato",
      rate: totalTracked ? Math.round((reachedContato / totalTracked) * 100) : 0,
      converted: reachedContato,
      base: totalTracked
    },
    {
      label: "Contato -> Proposta",
      rate: reachedContato ? Math.round((reachedProposta / reachedContato) * 100) : 0,
      converted: reachedProposta,
      base: reachedContato
    },
    {
      label: "Proposta -> Venda",
      rate: reachedProposta ? Math.round((reachedVenda / reachedProposta) * 100) : 0,
      converted: reachedVenda,
      base: reachedProposta
    }
  ];
}

function computePipelineStatistics(items: PipelineStatsSourceOpportunity[], periodDays: number): PipelineStatistics {
  const openItems = items.filter(isOpenPipelineOpportunity);
  const now = new Date();
  const periodStart = new Date(now.getTime() - Math.max(0, periodDays - 1) * 86400000);
  const periodItems = items.filter((item) => {
    if (!item.createdAt) {
      return false;
    }

    const parsed = new Date(item.createdAt);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= periodStart.getTime();
  });
  const totalPipeline = openItems.reduce((sum, item) => sum + item.amount, 0);
  const weightedPipeline = openItems.reduce((sum, item) => sum + item.amount * (item.probability / 100), 0);
  const averageProbability = totalPipeline > 0 ? Math.round((weightedPipeline / totalPipeline) * 100) : 0;
  const lostRevenue = periodItems
    .filter((item) => mapUiOpportunityStatusToDb(item.status) === "lost")
    .reduce((sum, item) => sum + item.amount, 0);
  const dueThisMonth = openItems.filter((item) => {
    const parsed = item.expectedCloseDate ? new Date(item.expectedCloseDate) : null;

    return parsed ? isSameMonth(parsed, now) : false;
  });
  const forecastMonth = dueThisMonth.reduce((sum, item) => sum + item.amount * (item.probability / 100), 0);
  const nearestClose = openItems
    .map((item) => {
      const parsed = item.expectedCloseDate ? new Date(item.expectedCloseDate) : null;

      if (!parsed || Number.isNaN(parsed.getTime())) {
        return null;
      }

      return {
        raw: item.expectedCloseDate,
        time: parsed.getTime()
      };
    })
    .filter((item): item is { raw: string; time: number } => Boolean(item))
    .sort((left, right) => left.time - right.time)[0];
  const grouped = new Map<string, PipelineStatistics["byStage"][number]>();
  const leadSources = new Map<string, { source: string; count: number; total: number }>();
  const periodValidItems = periodItems.filter((item) => mapUiOpportunityStatusToDb(item.status) !== "lost");

  openItems.forEach((item) => {
    const current = grouped.get(item.stage) ?? {
      stage: item.stage,
      probability: item.probability,
      count: 0,
      total: 0,
      weightedTotal: 0
    };

    current.count += 1;
    current.total += item.amount;
    current.weightedTotal += item.amount * (item.probability / 100);
    grouped.set(item.stage, current);
  });

  periodItems.forEach((item) => {
    const sourceKey = item.leadSource?.trim() || "Sem origem";
    const currentSource = leadSources.get(sourceKey) ?? {
      source: sourceKey,
      count: 0,
      total: 0
    };

    currentSource.count += 1;
    currentSource.total += item.amount;
    leadSources.set(sourceKey, currentSource);
  });

  const sourceConversionBuckets = new Map<string, PipelineStatsSourceOpportunity[]>();

  periodItems
    .filter((item) => mapUiOpportunityStatusToDb(item.status) !== "lost")
    .forEach((item) => {
      const sourceKey = item.leadSource?.trim() || "Sem origem";
      const current = sourceConversionBuckets.get(sourceKey) ?? [];
      current.push(item);
      sourceConversionBuckets.set(sourceKey, current);
    });

  return {
    leadsThisMonth: periodItems.length,
    opportunitiesCount: periodValidItems.filter((item) => stageProgressIndex(item.stage) >= 1).length,
    proposalsCount: periodValidItems.filter((item) => stageProgressIndex(item.stage) >= 3).length,
    salesCount: periodItems.filter((item) => mapUiOpportunityStatusToDb(item.status) === "won").length,
    lostRevenue,
    totalPipeline,
    weightedPipeline,
    averageProbability,
    forecastMonth,
    openOpportunities: openItems.length,
    dueThisMonth: dueThisMonth.length,
    nearestCloseDate: nearestClose?.raw ?? null,
    byStage: Array.from(grouped.values()).sort((left, right) => right.total - left.total),
    leadSources: Array.from(leadSources.values())
      .sort((left, right) => right.count - left.count || right.total - left.total)
      .map((item) => ({
        ...item,
        percentage: periodItems.length ? Math.round((item.count / periodItems.length) * 100) : 0
      })),
    conversions: buildConversionMetrics(periodItems),
    sourceConversions: Array.from(sourceConversionBuckets.entries())
      .map(([source, bucket]) => ({
        source,
        conversions: buildConversionMetrics(bucket)
      }))
      .sort((left, right) => {
        const leftBase = left.conversions[0]?.base ?? 0;
        const rightBase = right.conversions[0]?.base ?? 0;
        return rightBase - leftBase;
      })
  };
}

export async function getPipelineStatistics(periodDays = 30): Promise<PipelineStatistics> {
  return getCachedQuery(`pipeline:statistics:${periodDays}`, async () => {
    const opportunities = await getOpportunities();

    const items = opportunities.map((item) =>
      normalizePipelineStatsOpportunity({
        id: item.id,
        stage: normalizeStageLabel(item.stage),
        probability: item.manualProbability ?? item.probability,
        amount: amountLabelToNumber(item.amount),
        leadSource: item.leadSource,
        createdAt: item.createdAt,
        expectedCloseDate: (() => {
          const parsed = parseDisplayDate(item.expectedCloseDate);
          return parsed ? parsed.toISOString() : null;
        })(),
        status: item.status
      })
    );
    return computePipelineStatistics(items, periodDays);
  });
}

function getStageStagnationLimit(stage: string, limits: Awaited<ReturnType<typeof getCrmSettings>>["pipelineAgent"]["stageLimits"]) {
  const normalized = normalizeStageLabel(stage);

  if (normalized === "Lead") {
    return limits.lead;
  }

  if (normalized === "Qualificacao") {
    return limits.qualification;
  }

  if (normalized === "Diagnostico") {
    return limits.diagnosis;
  }

  if (normalized === "Proposta enviada") {
    return limits.proposal;
  }

  if (normalized === "Negociacao") {
    return limits.negotiation;
  }

  if (normalized === "Fechamento" || normalized === "Conclusao") {
    return limits.closing;
  }

  return limits.lead;
}

function toAttentionLevel(score: number): PipelineAttentionItem["level"] {
  if (score >= 70) {
    return "critical";
  }

  if (score >= 45) {
    return "high";
  }

  if (score >= 25) {
    return "medium";
  }

  return "low";
}

function chooseRecommendedAction(reasons: string[], hasTask: boolean, stage: string) {
  const normalizedStage = normalizeStageLabel(stage);

  if (reasons.some((reason) => reason.toLowerCase().includes("proximo passo"))) {
    return "Definir proximo passo objetivo e prazo para hoje.";
  }

  if (!hasTask) {
    return "Criar tarefa de follow-up para as proximas 24h.";
  }

  if (reasons.some((reason) => reason.toLowerCase().includes("vencida"))) {
    return "Replanejar data de fechamento ou atualizar status real.";
  }

  if (normalizedStage === "Negociacao" || normalizedStage === "Fechamento") {
    return "Agendar contato direto com decisor ainda hoje.";
  }

  return "Registrar nova interacao e confirmar proxima acao com o cliente.";
}

async function getLatestOpportunityActivities(opportunityIds: string[]) {
  if (!opportunityIds.length) {
    return new Map<string, string>();
  }

  try {
    const { data, error } = await supabase
      .from("activities")
      .select("opportunity_id, created_at")
      .in("opportunity_id", opportunityIds)
      .order("created_at", { ascending: false })
      .limit(1200);

    if (error || !data) {
      return new Map<string, string>();
    }

    const latestByOpportunity = new Map<string, string>();

    data.forEach((activity) => {
      if (!activity.opportunity_id || !activity.created_at || latestByOpportunity.has(activity.opportunity_id)) {
        return;
      }

      latestByOpportunity.set(activity.opportunity_id, activity.created_at);
    });

    return latestByOpportunity;
  } catch {
    return new Map<string, string>();
  }
}

export async function getPipelineAttention(limit = 15): Promise<PipelineAttentionData> {
  return getCachedQuery(`pipeline:attention:${limit}`, async () => {
    const [opportunities, tasks, settings] = await Promise.all([getOpportunities(), getTasks(), getCrmSettings()]);

    if (!settings.features.pipeline_agent_system) {
      return {
        generatedAt: new Date().toISOString(),
        summary: { critical: 0, high: 0, medium: 0, low: 0, monitored: 0 },
        items: []
      };
    }

    const openOpportunities = opportunities.filter(
      (item) => mapUiOpportunityStatusToDb(item.status) === "open" && !isConclusionStage(item.stage)
    );
    const latestActivityMap = await getLatestOpportunityActivities(openOpportunities.map((item) => item.id));
    const tasksByOpportunity = new Map<string, TaskItem[]>();

    tasks.forEach((task) => {
      if (!task.opportunityId) {
        return;
      }

      const current = tasksByOpportunity.get(task.opportunityId) ?? [];
      current.push(task);
      tasksByOpportunity.set(task.opportunityId, current);
    });

    const openAmounts = openOpportunities.map((item) => amountLabelToNumber(item.amount)).filter((value) => value > 0);
    const averageAmount = openAmounts.length ? openAmounts.reduce((sum, value) => sum + value, 0) / openAmounts.length : 0;
    const now = Date.now();

    const attentionItems = openOpportunities
      .map((item) => {
        let score = 0;
        const reasons: string[] = [];
        const amount = amountLabelToNumber(item.amount);
        const itemTasks = tasksByOpportunity.get(item.id) ?? [];
        const hasTask = itemTasks.length > 0;
        const normalizedNextStep = (item.nextStep ?? "").trim().toLowerCase();
        const hasPlaceholderStep =
          !normalizedNextStep || normalizedNextStep.includes("atualizar") || normalizedNextStep.includes("definir");

        if (hasPlaceholderStep && ["Proposta enviada", "Negociacao", "Fechamento", "Conclusao"].includes(item.stage)) {
          score += 26;
          reasons.push("Proximo passo indefinido em etapa avancada.");
        }

        if (!hasTask) {
          score += 12;
          reasons.push("Sem tarefa de follow-up vinculada.");
        }

        const expectedClose = parseDisplayDate(item.expectedCloseDate);
        let daysToClose: number | undefined;

        if (expectedClose) {
          daysToClose = Math.ceil((expectedClose.getTime() - now) / 86400000);

          if (daysToClose < 0) {
            score += 32;
            reasons.push("Data de fechamento vencida e negocio ainda aberto.");
          } else if (daysToClose <= 3) {
            score += hasTask ? 12 : 20;
            reasons.push("Fechamento previsto nos proximos 3 dias.");
          }
        }

        const interactionAt = latestActivityMap.get(item.id) ?? item.createdAt;
        let daysWithoutInteraction: number | undefined;

        if (interactionAt) {
          const parsed = new Date(interactionAt);

          if (!Number.isNaN(parsed.getTime())) {
            daysWithoutInteraction = Math.floor((now - parsed.getTime()) / 86400000);
            const stageLimit = getStageStagnationLimit(item.stage, settings.pipelineAgent.stageLimits);

            if (daysWithoutInteraction > stageLimit) {
              const extraDays = daysWithoutInteraction - stageLimit;
              score += Math.min(35, 14 + extraDays * 2);
              reasons.push(`Sem interacao ha ${daysWithoutInteraction} dias na etapa ${item.stage}.`);
            }
          }
        }

        if (averageAmount > 0 && amount >= averageAmount * 1.5 && score > 0) {
          score += 8;
          reasons.push("Negocio de alto valor requer atencao imediata.");
        }

        if (score <= 0) {
          return null;
        }

        const attentionScore = Math.min(100, score);

        return {
          opportunityId: item.id,
          title: item.title,
          company: item.company,
          owner: item.owner,
          stage: item.stage,
          amount,
          attentionScore,
          level: toAttentionLevel(attentionScore),
          reasons: reasons.slice(0, 3),
          recommendedAction: chooseRecommendedAction(reasons, hasTask, item.stage),
          lastInteractionAt: interactionAt,
          daysWithoutInteraction,
          daysToClose,
          href: `/dashboard/opportunities?focus=${item.id}`
        } as PipelineAttentionItem;
      })
      .filter((item): item is PipelineAttentionItem => Boolean(item))
      .sort((left, right) => {
        if (right.attentionScore !== left.attentionScore) {
          return right.attentionScore - left.attentionScore;
        }

        return right.amount - left.amount;
      });

    const items = attentionItems.slice(0, Math.max(1, limit));
    const summary = items.reduce(
      (acc, item) => {
        acc[item.level] += 1;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 }
    );

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        ...summary,
        monitored: items.length
      },
      items
    };
  });
}

function isPipelineAgentTaskTitle(title: string | undefined) {
  return (title ?? "").toUpperCase().includes(AGENT_TASK_PREFIX);
}

function buildPipelineAttentionNotificationRules(attention: PipelineAttentionData): NotificationRuleDraft[] {
  const dayKey = formatDateKey(new Date());
  const levelLabel: Record<PipelineAttentionItem["level"], string> = {
    critical: "Critico",
    high: "Alto",
    medium: "Medio",
    low: "Baixo"
  };

  const summaryRule: NotificationRuleDraft = {
    ruleKey: `pipeline-daily-top10-${dayKey}`,
    type: "pipeline_daily_summary",
    label: "Funil",
    title: "Top 10 do dia: foco comercial",
    detail: `${attention.summary.critical} critico(s), ${attention.summary.high} alto(s), ${attention.summary.medium} medio(s).`,
    href: "/dashboard/statistics",
    priority: attention.summary.critical || attention.summary.high ? "high" : "medium",
    entityType: "pipeline",
    entityId: dayKey
  };

  const itemRules = attention.items.slice(0, 6).map((item) => ({
    ruleKey: `pipeline-attention-${item.opportunityId}`,
    type: "pipeline_attention",
    label: "Funil",
    title: `${levelLabel[item.level]}: ${item.title}`,
    detail: `${item.reasons[0] ?? "Negocio precisa de atencao."} Score ${item.attentionScore}.`,
    href: item.href,
    priority: item.level === "critical" || item.level === "high" ? "high" : "medium",
    entityType: "opportunity",
    entityId: item.opportunityId
  })) satisfies NotificationRuleDraft[];

  return [summaryRule, ...itemRules];
}

export async function runPipelineAttentionAgent(): Promise<{
  executed: boolean;
  dateKey: string;
  createdTasks: number;
  reviewed: number;
}> {
  const today = formatDateKey(new Date());
  const ranAt = new Date().toISOString();

  const [settings, context, attention, tasks] = await Promise.all([
    getCrmSettings(),
    getCurrentUserContext(),
    getPipelineAttention(10),
    getTasks()
  ]);

  async function finish(input: { executed: boolean; createdTasks: number; reviewed: number; reason: string }) {
    await registerPipelineAgentExecution(
      {
      dateKey: today,
      ranAt,
      executed: input.executed,
      createdTasks: input.createdTasks,
      reviewed: input.reviewed,
      reason: input.reason
      },
      context
    );

    return {
      executed: input.executed,
      dateKey: today,
      createdTasks: input.createdTasks,
      reviewed: input.reviewed
    };
  }

  if (!settings.features.pipeline_agent_system || !settings.pipelineAgent.enabled || !hasReachedRunTime(settings.pipelineAgent.runAt)) {
    return await finish({
      executed: false,
      createdTasks: 0,
      reviewed: attention.items.length,
      reason: !settings.features.pipeline_agent_system
        ? "Sistema do agente desativado nas feature flags."
        : !settings.pipelineAgent.enabled
          ? "Agente desativado nas configuracoes."
          : "Aguardando horario configurado."
    });
  }

  if (typeof window !== "undefined") {
    const lastRun = window.localStorage.getItem(LOCAL_AGENT_LAST_RUN_DATE_KEY);

    if (lastRun === today) {
      return await finish({
        executed: false,
        createdTasks: 0,
        reviewed: attention.items.length,
        reason: "Rotina diaria ja executada hoje."
      });
    }

    // Marcamos no inicio para evitar reexecucao em cascata apos notifyCrmDataChanged.
    window.localStorage.setItem(LOCAL_AGENT_LAST_RUN_DATE_KEY, today);
  }

  if (!settings.features.task_reminders || !context) {
    return await finish({
      executed: true,
      createdTasks: 0,
      reviewed: attention.items.length,
      reason: !settings.features.task_reminders
        ? "Lembretes de tarefas estao desativados."
        : "Sem sessao autenticada para gravar tarefas."
    });
  }

  const activeTaskOpportunityIds = new Set(
    tasks
      .filter((task) => task.opportunityId && isPipelineAgentTaskTitle(task.title))
      .map((task) => task.opportunityId as string)
  );

  let createdTasks = 0;
  const maxTasksPerDay = settings.pipelineAgent.maxTasksPerDay;

  for (const item of attention.items) {
    if (createdTasks >= maxTasksPerDay) {
      break;
    }

    if (item.level !== "critical" && item.level !== "high") {
      continue;
    }

    if (activeTaskOpportunityIds.has(item.opportunityId)) {
      continue;
    }

    const dueDate = getDateOffsetInput(item.level === "critical" ? 0 : 1);
    const dueTime = item.level === "critical" ? "11:00" : "16:00";

    await createTask({
      title: `${AGENT_TASK_PREFIX} ${item.title}`,
      opportunityId: item.opportunityId,
      opportunityTitle: item.title,
      dueDate,
      dueTime,
      priority: item.level === "critical" ? "Alta" : "Media",
      companyLabel: item.company
    });

    activeTaskOpportunityIds.add(item.opportunityId);
    createdTasks += 1;
  }

  return await finish({
    executed: true,
    createdTasks,
    reviewed: attention.items.length,
    reason: createdTasks ? "Execucao concluida com criacao de tarefas." : "Execucao concluida sem necessidade de novas tarefas."
  });
}

function mapDbOpportunityStatusToUi(value: string | null | undefined) {
  if (!value) {
    return "Em andamento";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "won") {
    return "Conquistado";
  }

  if (normalized === "lost") {
    return "Perdido";
  }

  return "Em andamento";
}

function mapUiOpportunityStatusToDb(value: string | null | undefined): "open" | "won" | "lost" {
  if (!value) {
    return "open";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.includes("conquist") || normalized === "won") {
    return "won";
  }

  if (
    normalized.includes("perd") ||
    normalized.includes("cancel") ||
    normalized.includes("suspens") ||
    normalized === "lost"
  ) {
    return "lost";
  }

  return "open";
}

function mapAccountStatusToUi(value: string | null | undefined) {
  if (!value) {
    return "Ativo";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "active" || normalized === "ativo") {
    return "Ativo";
  }

  if (normalized === "inactive" || normalized === "inativo") {
    return "Inativo";
  }

  return value;
}

function formatDate(date: string | null | undefined) {
  if (!date) {
    return "Sem data";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  const preferences = getDateTimePreferences();

  return parsed.toLocaleDateString(preferences.locale, {
    timeZone: preferences.timeZone
  });
}

function formatDateTime(date: string | null | undefined) {
  if (!date) {
    return "Sem data";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  const preferences = getDateTimePreferences();

  return `${parsed.toLocaleDateString(preferences.locale, {
    timeZone: preferences.timeZone
  })} ${parsed.toLocaleTimeString(preferences.locale, {
    timeZone: preferences.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: !preferences.use24HourClock
  })}`;
}

function toDateInput(date: string | null | undefined) {
  if (!date) {
    return "";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const preferences = getDateTimePreferences();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: preferences.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function toTimeInput(date: string | null | undefined) {
  if (!date) {
    return "";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const preferences = getDateTimePreferences();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: preferences.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));

  return `${values.hour}:${values.minute}`;
}

function combineDateAndTime(date: string | undefined, time: string | undefined) {
  if (!date) {
    return null;
  }

  const normalizedTime = time || "09:00";
  const parsed = new Date(`${date}T${normalizedTime}:00`);

  if (Number.isNaN(parsed.getTime())) {
    return `${date}T${normalizedTime}:00`;
  }

  return parsed.toISOString();
}

function formatTime(date: string | null | undefined) {
  if (!date) {
    return "--:--";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }

  const preferences = getDateTimePreferences();

  return parsed.toLocaleTimeString(preferences.locale, {
    timeZone: preferences.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: !preferences.use24HourClock
  });
}

function getDateTimePreferences() {
  const settings = peekCrmSettings();
  const browserTimeZone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo" : "America/Sao_Paulo";

  return {
    locale: settings.locale,
    timeZone: settings.timeZone === "system" ? browserTimeZone : settings.timeZone,
    use24HourClock: settings.use24HourClock
  };
}

function formatRelative(date: string | null | undefined) {
  if (!date) {
    return "agora";
  }

  const parsed = new Date(date).getTime();

  if (Number.isNaN(parsed)) {
    return "agora";
  }

  const minutes = Math.max(1, Math.round((Date.now() - parsed) / 60000));

  if (minutes < 60) {
    return `ha ${minutes} min`;
  }

  const hours = Math.round(minutes / 60);
  return `ha ${hours} h`;
}

function parseDisplayDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [day, month, year] = value.split("/");

  if (!day || !month || !year) {
    return null;
  }

  const parsed = new Date(`${year}-${month}-${day}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateOffsetInput(daysToAdd: number) {
  const next = new Date();
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + daysToAdd);
  return formatDateKey(next);
}

function hasReachedRunTime(runAt: string) {
  const [hoursRaw, minutesRaw] = runAt.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return true;
  }

  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(hours, minutes, 0, 0);

  return now.getTime() >= scheduled.getTime();
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function endOfToday() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now;
}

function createNotificationFromRule(
  draft: NotificationRuleDraft,
  persisted?: Partial<StoredNotification>
): StoredNotification {
  return {
    id: persisted?.id ?? `notification-local-${draft.ruleKey}`,
    ruleKey: draft.ruleKey,
    label: draft.label,
    title: draft.title,
    detail: draft.detail,
    href: draft.href,
    priority: draft.priority,
    isRead: persisted?.isRead ?? false,
    resolvedAt: null,
    entityType: draft.entityType,
    entityId: draft.entityId
  };
}

function buildNotificationRules(input: {
  agenda: AgendaItem[];
  tasks: TaskItem[];
  opportunities: OpportunityItem[];
}): NotificationRuleDraft[] {
  const now = Date.now();
  const rules: NotificationRuleDraft[] = [];

  input.agenda
    .filter((item) => {
      if (!item.scheduledAt) {
        return false;
      }

      const time = new Date(item.scheduledAt).getTime();

      if (Number.isNaN(time)) {
        return false;
      }

      const diff = time - now;
      return diff >= 0 && diff <= 15 * 60 * 1000;
    })
    .slice(0, 3)
    .forEach((item) => {
      rules.push({
        ruleKey: `agenda-soon-${item.id}`,
        type: "agenda_due_soon",
        label: "Agenda",
        title: item.title,
        detail: `${item.time} • compromisso em ate 15 min`,
        href: "/dashboard/agenda",
        priority: "high",
        entityType: "agenda",
        entityId: item.id
      });
    });

  input.tasks
    .filter((task) => task.dueDate)
    .slice(0, 8)
    .forEach((task) => {
      const time = new Date(`${task.dueDate}T${task.dueTime || "23:59"}:00`).getTime();

      if (Number.isNaN(time)) {
        return;
      }

      if (time <= now) {
        rules.push({
          ruleKey: `task-overdue-${task.id}`,
          type: "task_overdue",
          label: "Tarefa",
          title: task.title,
          detail: "Prazo vencido ou imediato",
          href: "/dashboard/tasks",
          priority: "high",
          entityType: "task",
          entityId: task.id
        });
        return;
      }

      if (time >= startOfToday().getTime() && time <= endOfToday().getTime()) {
        rules.push({
          ruleKey: `task-today-${task.id}`,
          type: "task_today",
          label: "Tarefa",
          title: task.title,
          detail: "Entrega prevista ainda hoje",
          href: "/dashboard/tasks",
          priority: "medium",
          entityType: "task",
          entityId: task.id
        });
      }
    });

  input.opportunities.slice(0, 12).forEach((item) => {
    const next = (item.nextStep ?? "").toLowerCase();
    const hasPlaceholderStep = !next || next.includes("definir") || next.includes("atualizar");

    if (hasPlaceholderStep && ["Negociacao", "Proposta enviada", "Proposta", "Fechamento", "Conclusao"].includes(item.stage)) {
      rules.push({
        ruleKey: `opportunity-next-step-${item.id}`,
        type: "opportunity_next_step",
        label: "Funil",
        title: item.title,
        detail: "Proximo passo precisa ser definido",
        href: `/dashboard/opportunities?focus=${item.id}`,
        priority: item.stage === "Negociacao" ? "high" : "medium",
        entityType: "opportunity",
        entityId: item.id
      });
    }

    const closingDate = parseDisplayDate(item.expectedCloseDate);

    if (!closingDate) {
      return;
    }

    const diffDays = Math.ceil((closingDate.getTime() - now) / 86400000);

    if (diffDays >= 0 && diffDays <= 3 && !isConclusionStage(item.stage)) {
      rules.push({
        ruleKey: `opportunity-close-${item.id}`,
        type: "opportunity_closing_soon",
        label: "Fechamento",
        title: item.title,
        detail: `Previsao de fechamento em ${item.expectedCloseDate}`,
        href: `/dashboard/opportunities?focus=${item.id}`,
        priority: "high",
        entityType: "opportunity",
        entityId: item.id
      });
    }
  });

  return rules;
}

function resolveCurrentUserLabel(
  currentContext: Awaited<ReturnType<typeof getCurrentUserContext>>,
  targetUserId: string | null | undefined,
  fallbackName: string | null | undefined
) {
  if (currentContext?.userId && targetUserId && currentContext.userId === targetUserId) {
    return currentContext.fullName;
  }

  return fallbackName ?? "Equipe";
}

function sortActivityByDateDesc(left: ActivityItem, right: ActivityItem) {
  const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
  const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
  return rightTime - leftTime;
}

function sortAgendaByDateAsc(left: AgendaItem, right: AgendaItem) {
  const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : 0;
  const rightTime = right.scheduledAt ? new Date(right.scheduledAt).getTime() : 0;
  return leftTime - rightTime;
}

function mergeAgendaItems(primary: AgendaItem[], secondary: AgendaItem[]) {
  const byId = new Map<string, AgendaItem>();

  secondary.forEach((item) => byId.set(item.id, item));
  primary.forEach((item) => byId.set(item.id, item));

  return Array.from(byId.values()).sort(sortAgendaByDateAsc);
}

function mapAgendaItem(activity: {
  id: string;
  subject: string;
  notes: string | null;
  kind?: string | null;
  scheduled_for: string | null;
  accounts?: Array<{ id?: string; trade_name?: string; legal_name?: string }>;
  opportunities?: Array<{ id?: string; title?: string }>;
}): AgendaItem {
  const account = pickOne(activity.accounts);
  const opportunity = pickOne(activity.opportunities);

  return {
    id: activity.id,
    time: formatTime(activity.scheduled_for),
    title: activity.subject,
    note: activity.notes || (account?.trade_name ?? account?.legal_name ?? "Sem observacao"),
    scheduledAt: activity.scheduled_for ?? undefined,
    category: agendaCategoryFromKind(activity.kind),
    accountId: account?.id,
    accountName: account?.trade_name ?? account?.legal_name,
    opportunityId: opportunity?.id,
    opportunityTitle: opportunity?.title
  };
}

function agendaCategoryFromKind(kind: string | null | undefined) {
  if (kind === "call") {
    return "Ligacao";
  }

  if (kind === "email") {
    return "E-mail";
  }

  if (kind === "note") {
    return "Follow-up";
  }

  return "Reuniao";
}

function agendaKindFromCategory(category: string | undefined) {
  if (category === "Ligacao") {
    return "call" as const;
  }

  if (category === "E-mail") {
    return "email" as const;
  }

  if (category === "Follow-up") {
    return "note" as const;
  }

  return "meeting" as const;
}

export async function getDashboardData(): Promise<DashboardData> {
  return getCachedQuery("dashboard:data", async () => {
    const localPreviews = getLocalOpportunityPreviews();
    const localActivity = getLocalActivity();
    const localAgenda = getLocalAgenda();
    const currentContext = await getCurrentUserContext();

    try {
    const [stagesRes, opportunitiesRes, tasksRes, activitiesRes, agendaRes, accountsRes] = await Promise.all([
      supabase.from("pipeline_stages").select("id, name, stage_order"),
      supabase
        .from("opportunities")
        .select(
          "id, title, amount, base_amount, is_recurring, months, stage_id, owner_id, status, expected_close_date, concluded_at, accounts:account_id(trade_name, legal_name), profiles:owner_id(full_name)"
        )
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_PIPELINE_LIMIT),
      supabase
        .from("tasks")
        .select(
          "id, title, due_at, is_done, opportunities:opportunity_id(title, accounts:account_id(trade_name, legal_name)), profiles:owner_id(full_name)"
        )
        .eq("is_done", false)
        .order("due_at", { ascending: true })
        .limit(3),
      supabase
        .from("activities")
        .select(
          "id, subject, notes, created_at, scheduled_for, kind, actor_id, accounts:account_id(trade_name, legal_name), profiles:actor_id(full_name)"
        )
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("activities")
        .select(
          "id, subject, notes, kind, scheduled_for, accounts:account_id(id, trade_name, legal_name), opportunities:opportunity_id(id, title)"
        )
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true })
        .limit(6),
      supabase.from("accounts").select("id", { count: "exact", head: true })
    ]);

    if (
      stagesRes.error ||
      opportunitiesRes.error ||
      tasksRes.error ||
      activitiesRes.error ||
      agendaRes.error ||
      accountsRes.error ||
      !stagesRes.data
    ) {
      if (localPreviews.length) {
        const merged = mergeOpportunities(localPreviews, seedOpportunities);
        const pipeline = buildPipelineFromOpportunities(merged);
        const totalPipeline = merged.reduce((sum, item) => sum + amountLabelToNumber(item.amount), 0);
        const recurringTotal = merged
          .filter((item) => item.isRecurring)
          .reduce((sum, item) => sum + amountLabelToNumber(item.amount), 0);
        const monthRevenue = getClosedRevenueThisMonth(merged);
        const averageTicket = merged.length ? totalPipeline / merged.length : 0;

        return {
          ...seedDashboardData,
          kpis: [
            { label: "Pipeline total", value: currency(totalPipeline), trend: `${merged.length} oportunidades` },
            { label: "Ticket medio", value: currency(averageTicket), trend: "Media por oportunidade" },
            {
              label: "Receita recorrente",
              value: currency(recurringTotal),
              trend: recurringTotal ? "Contratos recorrentes no funil" : "Sem contratos recorrentes"
            },
            {
              label: "Receita do mes",
              value: currency(monthRevenue),
              trend: monthRevenue ? "Negocios fechados no mes atual" : "Sem negocios fechados neste mes"
            },
            seedDashboardData.kpis.find((item) => item.label === "Tarefas em aberto") ?? {
              label: "Tarefas em aberto",
              value: "0",
              trend: "Sem tarefas cadastradas"
            }
          ],
          pipeline,
          agenda: mergeAgendaItems(localAgenda, seedAgenda).slice(0, 6),
          activity: [...localActivity, ...seedActivity].sort(sortActivityByDateDesc).slice(0, 6)
        };
      }

      return {
        ...seedDashboardData,
        agenda: mergeAgendaItems(localAgenda, seedAgenda).slice(0, 6),
        activity: [...localActivity, ...seedActivity].sort(sortActivityByDateDesc).slice(0, 6)
      };
    }

    const stageNames = new Map<string, string>(
      stagesRes.data.map((stage) => [stage.id, stage.name])
    );

    const grouped = new Map<string, PipelineColumn>();

    opportunitiesRes.data?.forEach((opportunity) => {
      const stageId = opportunity.stage_id ?? "sem-etapa";
      const stageName = normalizeStageLabel(stageNames.get(stageId) ?? "Sem etapa");
      const account = pickOne(opportunity.accounts);
      const owner = pickOne(opportunity.profiles);

      if (!grouped.has(stageId)) {
        grouped.set(stageId, {
          id: stageId,
          name: stageName,
          total: "R$ 0",
          deals: []
        });
      }

      const column = grouped.get(stageId);

      if (!column) {
        return;
      }

      column.deals.push({
        id: opportunity.id,
        title: opportunity.title,
        company: account?.trade_name ?? account?.legal_name ?? "Conta sem nome",
        owner: resolveCurrentUserLabel(currentContext, opportunity.owner_id, owner?.full_name ?? "Sem responsavel"),
        value: currency(opportunity.amount)
      });
    });

    const pipeline = Array.from(grouped.values()).map((column) => {
      const totalValue = column.deals.reduce((sum, deal) => {
        const numeric = Number(deal.value.replace(/[^\d,-]/g, "").replace(".", "").replace(",", "."));
        return sum + (Number.isFinite(numeric) ? numeric : 0);
      }, 0);

      return {
        ...column,
        total: currency(totalValue)
      };
    });

    const tasks: TaskItem[] =
      tasksRes.data?.map((task) => {
        const opportunity = pickOne(task.opportunities);
        const account = pickOne(opportunity?.accounts);

        return {
          id: task.id,
          title: task.title,
          company: account?.trade_name ?? account?.legal_name ?? opportunity?.title ?? "Sem conta",
          due: formatDateTime(task.due_at),
          priority: "Media",
          dueDate: toDateInput(task.due_at),
          dueTime: toTimeInput(task.due_at)
        };
      }) ?? seedTasks;

    const agenda: AgendaItem[] = agendaRes.data?.filter((activity) => Boolean(activity.scheduled_for)).map(mapAgendaItem) ?? seedAgenda;

    const activity: ActivityItem[] =
      activitiesRes.data?.map((item): ActivityItem => {
        const actor = pickOne(item.profiles);
        const account = pickOne(item.accounts);
        const move = parseStageMovement(item.notes);
        const audit = parseAuditEvent(item.notes);

        if (move) {
          return {
            id: item.id,
            actor: resolveCurrentUserLabel(currentContext, item.actor_id, actor?.full_name),
            action: `moveu ${item.subject} de ${move.fromStage || "Sem etapa"} para`,
            target: move.toStage || "Sem etapa",
            when: formatRelative(item.created_at),
            createdAt: item.created_at,
            eventType: "movement"
          };
        }

        if (audit) {
          return {
            id: item.id,
            actor: resolveCurrentUserLabel(currentContext, item.actor_id, actor?.full_name),
            action: audit.action,
            target: audit.target,
            when: formatRelative(item.created_at),
            createdAt: item.created_at,
            eventType: audit.eventType
          };
        }

        return {
          id: item.id,
          actor: actor?.full_name ?? "Equipe",
          action: item.kind === "task" ? "criou atividade em" : "registrou interacao em",
          target: account?.trade_name ?? account?.legal_name ?? item.subject,
          when: formatRelative(item.created_at),
          createdAt: item.created_at,
          eventType: item.kind === "task" ? "task" : "interaction"
        };
      }) ?? seedActivity;

    const opportunityCount = opportunitiesRes.data?.length ?? 0;
    const accountsCount = accountsRes.count ?? 0;
    const totalPipeline = opportunitiesRes.data?.reduce(
      (sum, opportunity) => sum + (typeof opportunity.amount === "number" ? opportunity.amount : 0),
      0
    ) ?? 0;

    const fetchedOpportunities =
      opportunitiesRes.data?.map((opportunity) => {
        const stage = normalizeStageLabel(stageNames.get(opportunity.stage_id ?? "") ?? "Sem etapa");
        const account = pickOne(opportunity.accounts);
        const owner = pickOne(opportunity.profiles);

        return {
          id: opportunity.id,
          title: opportunity.title,
          company: account?.trade_name ?? account?.legal_name ?? "Conta sem nome",
          leadSource: undefined,
          createdAt: undefined,
          stage,
          owner: owner?.full_name ?? "Sem responsavel",
          nextStep: "Atualizar proximo passo",
          baseAmount: currency(opportunity.base_amount),
          isRecurring: Boolean(opportunity.is_recurring),
          months: opportunity.months ?? 1,
          amount: currency(opportunity.amount),
          probability: Math.max(0, Math.min(100, DEFAULT_STAGE_PROBABILITIES[stage] ?? 0)),
          manualProbability: undefined,
          expectedCloseDate: formatDate(opportunity.expected_close_date),
          status: mapDbOpportunityStatusToUi(opportunity.status),
          concludedAt: opportunity.concluded_at ?? undefined
        };
      }) ?? [];

    const mergedOpportunities = mergeOpportunities(localPreviews, fetchedOpportunities);
    const mergedPipeline = mergedOpportunities.length ? buildPipelineFromOpportunities(mergedOpportunities) : [];
    const mergedTotal = mergedOpportunities.reduce((sum, item) => sum + amountLabelToNumber(item.amount), 0);
    const recurringTotal = mergedOpportunities
      .filter((item) => item.isRecurring)
      .reduce((sum, item) => sum + amountLabelToNumber(item.amount), 0);
    const monthRevenue = getClosedRevenueThisMonth(mergedOpportunities);
    const averageTicket = mergedOpportunities.length ? mergedTotal / mergedOpportunities.length : 0;

    return {
      kpis: [
        {
          label: "Pipeline total",
          value: currency(mergedOpportunities.length ? mergedTotal : totalPipeline),
          trend: `${mergedOpportunities.length || opportunityCount} oportunidades`
        },
        {
          label: "Ticket medio",
          value: currency(averageTicket),
          trend: `${accountsCount} contas no CRM`
        },
        {
          label: "Receita recorrente",
          value: currency(recurringTotal),
          trend: mergedOpportunities.some((item) => item.isRecurring)
            ? "Contratos recorrentes no funil"
            : "Sem contratos recorrentes"
        },
        {
          label: "Receita do mes",
          value: currency(monthRevenue),
          trend: monthRevenue ? "Negocios fechados no mes atual" : "Sem negocios fechados neste mes"
        },
        {
          label: "Tarefas em aberto",
          value: String(tasks.length),
          trend: tasks.length ? "Acompanhamento ativo" : "Sem pendencias"
        }
      ],
      pipeline: mergedPipeline.length ? mergedPipeline : pipeline.length ? pipeline : seedDashboardData.pipeline,
      tasks: tasks.length ? tasks : seedTasks,
      agenda: mergeAgendaItems(localAgenda, agenda.length ? agenda : seedAgenda).slice(0, 6),
      activity: [...localActivity, ...(activity.length ? activity : seedActivity)].sort(sortActivityByDateDesc).slice(0, 6)
    };
    } catch {
      return {
        ...seedDashboardData,
        agenda: mergeAgendaItems(localAgenda, seedAgenda).slice(0, 6),
        activity: [...localActivity, ...seedActivity].sort(sortActivityByDateDesc).slice(0, 6)
      };
    }
  });
}

export async function getCustomers(): Promise<CustomerItem[]> {
  return getCachedQuery("customers:list", async () => {
    const localCustomers = getLocalCustomers();
    const currentContext = await getCurrentUserContext();

    try {
      const { data, error } = await supabase
        .from("accounts")
        .select(
          "id, legal_name, trade_name, segment, primary_contact_name, phone, email, address, city, state, zip_code, document, status, owner_id, contacts(id), profiles:owner_id(full_name)"
        )
        .order("created_at", { ascending: false });

      if (error || !data) {
        return mergeCustomers(seedCustomers, localCustomers);
      }

      const remoteCustomers = data.map((account) => {
        const owner = pickOne(account.profiles);
        const contacts = Array.isArray(account.contacts) ? account.contacts.length : 0;

        return {
          id: account.id,
          legalName: account.legal_name ?? "Sem razao social",
          tradeName: account.trade_name ?? account.legal_name ?? "Sem nome fantasia",
          segment: account.segment ?? "Nao informado",
          companyContactName: account.primary_contact_name ?? "",
          phone: account.phone ?? "",
          email: account.email ?? "",
          address: account.address ?? "",
          city: account.city ?? "",
          state: account.state ?? "",
          zipCode: account.zip_code ?? "",
          document: account.document ?? "",
          owner: resolveCurrentUserLabel(currentContext, account.owner_id, owner?.full_name ?? "Sem responsavel"),
          contacts,
          status: mapAccountStatusToUi(account.status)
        };
      });

      return mergeCustomers(remoteCustomers, localCustomers);
    } catch {
      return mergeCustomers(seedCustomers, localCustomers);
    }
  });
}

export async function getOpportunities(): Promise<OpportunityItem[]> {
  return getCachedQuery("opportunities:list", async () => {
    const localPreviews = getLocalOpportunityPreviews();
    const currentContext = await getCurrentUserContext();

    try {
      const primaryQuery = await supabase
        .from("opportunities")
        .select(
          "id, title, amount, base_amount, is_recurring, months, owner_id, status, next_step, expected_close_date, conclusion_status, conclusion_reason, concluded_at, probability_override, lead_source, created_at, pipeline_stages:stage_id(name, probability), accounts:account_id(trade_name, legal_name), profiles:owner_id(full_name)"
        )
        .order("created_at", { ascending: false });
      let data = (primaryQuery.data ?? null) as OpportunityQueryRecord[] | null;
      let error = primaryQuery.error;

      if (error || !data) {
        const fallbackQuery = await supabase
          .from("opportunities")
          .select(
            "id, title, amount, base_amount, is_recurring, months, owner_id, status, next_step, expected_close_date, conclusion_status, conclusion_reason, concluded_at, created_at, pipeline_stages:stage_id(name, probability), accounts:account_id(trade_name, legal_name), profiles:owner_id(full_name)"
          )
          .order("created_at", { ascending: false });

        data = (fallbackQuery.data ?? null) as OpportunityQueryRecord[] | null;
        error = fallbackQuery.error;
      }

      if (error || !data) {
        return localPreviews.length ? mergeOpportunities(localPreviews, seedOpportunities) : seedOpportunities;
      }

      const fetched = data.map((opportunity) => {
        const stage = pickOne(opportunity.pipeline_stages);
        const account = pickOne(opportunity.accounts);
        const owner = pickOne(opportunity.profiles);
        const probabilityOverride =
          typeof opportunity === "object" && opportunity && "probability_override" in opportunity
            ? (opportunity as { probability_override?: number | null }).probability_override
            : null;
        const leadSource =
          typeof opportunity === "object" && opportunity && "lead_source" in opportunity
            ? (opportunity as { lead_source?: string | null }).lead_source
            : null;
        const createdAt =
          typeof opportunity === "object" && opportunity && "created_at" in opportunity
            ? (opportunity as { created_at?: string | null }).created_at
            : null;

        return {
          id: opportunity.id,
          title: opportunity.title,
          company: account?.trade_name ?? account?.legal_name ?? "Conta sem nome",
          leadSource: leadSource ?? undefined,
          createdAt: createdAt ?? undefined,
          stage: normalizeStageLabel(stage?.name),
          owner: resolveCurrentUserLabel(currentContext, opportunity.owner_id, owner?.full_name ?? "Sem responsavel"),
          nextStep: opportunity.next_step ?? "Atualizar proximo passo",
          baseAmount: currency(opportunity.base_amount),
          isRecurring: Boolean(opportunity.is_recurring),
          months: opportunity.months ?? 1,
          amount: currency(opportunity.amount),
          probability: Math.max(
            0,
            Math.min(100, probabilityOverride ?? stage?.probability ?? DEFAULT_STAGE_PROBABILITIES[normalizeStageLabel(stage?.name)] ?? 0)
          ),
          manualProbability: probabilityOverride ?? undefined,
          expectedCloseDate: formatDate(opportunity.expected_close_date),
          status: mapDbOpportunityStatusToUi(opportunity.status),
          conclusionStatus: opportunity.conclusion_status ?? undefined,
          conclusionReason: opportunity.conclusion_reason ?? undefined,
          concludedAt: opportunity.concluded_at ?? undefined
        };
      });

      return mergeOpportunities(localPreviews, fetched);
    } catch {
      return localPreviews.length ? mergeOpportunities(localPreviews, seedOpportunities) : seedOpportunities;
    }
  });
}

export async function getTasks(): Promise<TaskItem[]> {
  return getCachedQuery("tasks:list", async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, title, due_at, priority, opportunities:opportunity_id(id, title, accounts:account_id(trade_name, legal_name))"
        )
        .order("due_at", { ascending: true });

      if (error || !data) {
        return seedTasks;
      }

      return data.map((task) => {
        const opportunity = pickOne(task.opportunities);
        const account = pickOne(opportunity?.accounts);

        return {
          id: task.id,
          title: task.title,
          company: account?.trade_name ?? account?.legal_name ?? opportunity?.title ?? "Sem conta",
          opportunityId: opportunity?.id ?? undefined,
          opportunityTitle: opportunity?.title ?? undefined,
          due: formatDateTime(task.due_at),
          priority: task.priority ?? "Media",
          dueDate: toDateInput(task.due_at),
          dueTime: toTimeInput(task.due_at)
        };
      });
    } catch {
      return seedTasks;
    }
  });
}

async function getCurrentUserContext() {
  if (currentUserContextCache && currentUserContextCache.expiresAt > Date.now()) {
    return currentUserContextCache.promise;
  }

  const promise = (async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;

    if (!userId) {
      return null;
    }

    async function fetchProfile() {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, full_name")
        .eq("id", userId)
        .maybeSingle();

      return profile;
    }

    let profile = await fetchProfile();

    if (!profile?.organization_id) {
      try {
        await fetch("/api/auth/bootstrap", {
          method: "POST",
          cache: "no-store"
        });
      } catch {
        // Se o bootstrap falhar, retornamos null no fluxo ja existente.
      }

      profile = await fetchProfile();
    }

    if (!profile?.organization_id) {
      return null;
    }

    const displayName = peekCrmSettings().displayName?.trim();

    return {
      userId,
      organizationId: profile.organization_id,
      fullName: displayName || profile.full_name || "Equipe"
    };
  })();

  currentUserContextCache = {
    expiresAt: Date.now() + USER_CONTEXT_CACHE_TTL_MS,
    promise
  };

  return promise;
}

async function recordCrmActivity(input: {
  actor: string;
  action: string;
  target: string;
  eventType: ActivityItem["eventType"];
  subject: string;
  kind: "task" | "note";
  notes?: string;
  opportunityId?: string;
  accountId?: string;
  forceLocal?: boolean;
}) {
  const createdAt = new Date().toISOString();
  const localItem: ActivityItem = {
    id: `activity-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor: input.actor,
    action: input.action,
    target: input.target,
    when: buildRelativeActivity(createdAt),
    createdAt,
    eventType: input.eventType
  };

  if (input.forceLocal) {
    saveLocalActivity(localItem);
    return localItem;
  }

  const context = await getCurrentUserContext();

  if (!context) {
    saveLocalActivity(localItem);
    return localItem;
  }

  const { error } = await supabase.from("activities").insert({
    organization_id: context.organizationId,
    opportunity_id: input.opportunityId || null,
    account_id: input.accountId || null,
    actor_id: context.userId,
    kind: input.kind,
    subject: input.subject,
    notes: input.notes || `${AUDIT_NOTE_PREFIX}${input.eventType || "interaction"}||${input.action}||${input.target}`,
    completed_at: createdAt
  });

  if (error) {
    saveLocalActivity(localItem);
    return localItem;
  }

  notifyCrmDataChanged();
  return localItem;
}

export async function getReferenceOptions(): Promise<{
  accounts: ReferenceOption[];
  stages: ReferenceOption[];
}> {
  return getCachedQuery("references:options", async () => {
    const localCustomers = getLocalCustomers();
    const seedAccounts = seedCustomers.map((item) => ({
      id: item.id,
      label: item.tradeName || item.legalName || "Conta sem nome",
      searchText: [item.tradeName, item.legalName, item.email, item.document].filter(Boolean).join(" ").toLowerCase()
    }));

    try {
      const [accountsRes, stagesRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, trade_name, legal_name")
          .order("created_at", { ascending: false })
          .limit(REFERENCE_ITEMS_LIMIT),
        supabase.from("pipeline_stages").select("id, name, stage_order, probability").order("stage_order", { ascending: true })
      ]);

      const remoteAccounts =
        accountsRes.data?.map((item) => ({
          id: item.id,
          label: item.trade_name ?? item.legal_name ?? "Conta sem nome",
          searchText: [item.trade_name, item.legal_name].filter(Boolean).join(" ").toLowerCase()
        })) ?? [];
      const localAccounts = localCustomers.map((item) => ({
        id: item.id,
        label: item.tradeName || item.legalName || "Conta sem nome",
        searchText: [item.tradeName, item.legalName, item.email, item.document].filter(Boolean).join(" ").toLowerCase()
      }));
      const mergedAccounts = Array.from(
        new Map([...seedAccounts, ...remoteAccounts, ...localAccounts].map((item) => [item.id, item])).values()
      );

      return {
        accounts: mergedAccounts,
        stages:
          stagesRes.data?.length
              ? stagesRes.data.map((item) => ({
                id: item.id,
                label: normalizeStageLabel(item.name),
                probability: item.probability
              }))
            : DEFAULT_STAGE_OPTIONS
      };
    } catch {
      return {
        accounts: Array.from(
          new Map(
            [
              ...seedAccounts,
              ...localCustomers.map((item) => ({
                id: item.id,
                label: item.tradeName || item.legalName || "Conta sem nome",
                searchText: [item.tradeName, item.legalName, item.email, item.document].filter(Boolean).join(" ").toLowerCase()
              }))
            ].map((item) => [item.id, item])
          ).values()
        ),
        stages: DEFAULT_STAGE_OPTIONS
      };
    }
  });
}

export async function getOpportunityReferenceOptions(): Promise<Array<{ id: string; title: string; company: string }>> {
  return getCachedQuery("references:opportunities", async () => {
    const localPreviews = getLocalOpportunityPreviews();

    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, title, accounts:account_id(trade_name, legal_name)")
        .order("created_at", { ascending: false })
        .limit(REFERENCE_ITEMS_LIMIT);

      if (error || !data) {
        return localPreviews.map((item) => ({
          id: item.id,
          title: item.title,
          company: item.company
        }));
      }

      const remoteItems = data.map((item) => {
        const account = pickOne(item.accounts);

        return {
          id: item.id,
          title: item.title,
          company: account?.trade_name ?? account?.legal_name ?? "Conta sem nome"
        };
      });

      const localItems = localPreviews.map((item) => ({
        id: item.id,
        title: item.title,
        company: item.company
      }));

      return Array.from(new Map([...remoteItems, ...localItems].map((item) => [item.id, item])).values());
    } catch {
      return localPreviews.map((item) => ({
        id: item.id,
        title: item.title,
        company: item.company
      }));
    }
  });
}

export async function createCustomer(input: {
  legalName: string;
  tradeName: string;
  segment: string;
  companyContactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  document: string;
}): Promise<CustomerItem> {
  const context = await getCurrentUserContext();

  const fallbackItem: CustomerItem = {
    id: `local-customer-${Date.now()}`,
    legalName: input.legalName,
    tradeName: input.tradeName || input.legalName,
    segment: input.segment || "Nao informado",
    companyContactName: input.companyContactName,
    phone: input.phone,
    email: input.email,
    address: input.address,
    city: input.city,
    state: input.state,
    zipCode: input.zipCode,
    document: input.document,
    owner: context?.fullName ?? "Equipe",
    contacts: 0,
    status: "Ativo"
  };

  if (!context) {
    saveLocalCustomer(fallbackItem);
    await recordCrmActivity({
      actor: fallbackItem.owner,
      action: "criou cliente",
      target: fallbackItem.tradeName,
      eventType: "customer",
      subject: fallbackItem.tradeName,
      kind: "note",
      forceLocal: true
    });
    return fallbackItem;
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      organization_id: context.organizationId,
      legal_name: input.legalName,
      trade_name: input.tradeName || null,
      segment: input.segment || null,
      primary_contact_name: input.companyContactName || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      zip_code: input.zipCode || null,
      document: input.document || null,
      owner_id: context.userId
    })
    .select(
      "id, legal_name, trade_name, segment, primary_contact_name, phone, email, address, city, state, zip_code, document, status"
    )
    .single();

  if (error || !data) {
    saveLocalCustomer(fallbackItem);
    return fallbackItem;
  }

  const customerItem = {
    id: data.id,
    legalName: data.legal_name,
    tradeName: data.trade_name ?? data.legal_name,
    segment: data.segment ?? "Nao informado",
    companyContactName: data.primary_contact_name ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    address: data.address ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    zipCode: data.zip_code ?? "",
    document: data.document ?? "",
    owner: context.fullName,
    contacts: 0,
    status: mapAccountStatusToUi(data.status)
  };

  saveLocalCustomer(customerItem);
  await recordCrmActivity({
    actor: context.fullName,
    action: "criou cliente",
    target: customerItem.tradeName,
    eventType: "customer",
    subject: customerItem.tradeName,
    kind: "note",
    accountId: customerItem.id
  });
  return customerItem;
}

export async function updateCustomer(input: {
  id: string;
  legalName: string;
  tradeName: string;
  segment: string;
  companyContactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  document: string;
}): Promise<CustomerItem> {
  const context = await getCurrentUserContext();

  const fallbackItem: CustomerItem = {
    id: input.id,
    legalName: input.legalName,
    tradeName: input.tradeName || input.legalName,
    segment: input.segment || "Nao informado",
    companyContactName: input.companyContactName,
    phone: input.phone,
    email: input.email,
    address: input.address,
    city: input.city,
    state: input.state,
    zipCode: input.zipCode,
    document: input.document,
    owner: context?.fullName ?? "Equipe",
    contacts: 0,
    status: "Ativo"
  };

  if (!context || input.id.startsWith("local-customer-")) {
    saveLocalCustomer(fallbackItem);
    await recordCrmActivity({
      actor: fallbackItem.owner,
      action: "editou cliente",
      target: fallbackItem.tradeName,
      eventType: "customer",
      subject: fallbackItem.tradeName,
      kind: "note",
      forceLocal: true
    });
    return fallbackItem;
  }

  const { data, error } = await supabase
    .from("accounts")
    .update({
      legal_name: input.legalName,
      trade_name: input.tradeName || null,
      segment: input.segment || null,
      primary_contact_name: input.companyContactName || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      zip_code: input.zipCode || null,
      document: input.document || null
    })
    .eq("id", input.id)
    .select(
      "id, legal_name, trade_name, segment, primary_contact_name, phone, email, address, city, state, zip_code, document, status"
    )
    .single();

  if (error || !data) {
    saveLocalCustomer(fallbackItem);
    return fallbackItem;
  }

  const customerItem = {
    id: data.id,
    legalName: data.legal_name,
    tradeName: data.trade_name ?? data.legal_name,
    segment: data.segment ?? "Nao informado",
    companyContactName: data.primary_contact_name ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    address: data.address ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    zipCode: data.zip_code ?? "",
    document: data.document ?? "",
    owner: context.fullName,
    contacts: 0,
    status: mapAccountStatusToUi(data.status)
  };

  saveLocalCustomer(customerItem);
  await recordCrmActivity({
    actor: context.fullName,
    action: "editou cliente",
    target: customerItem.tradeName,
    eventType: "customer",
    subject: customerItem.tradeName,
    kind: "note",
    accountId: customerItem.id
  });
  return customerItem;
}

export async function deleteCustomer(input: { id: string; tradeName: string }): Promise<{ ok: boolean; message: string }> {
  if (input.id.startsWith("local-customer-")) {
    removeLocalCustomer(input.id);
    await recordCrmActivity({
      actor: "Equipe",
      action: "removeu cliente",
      target: input.tradeName,
      eventType: "customer",
      subject: input.tradeName,
      kind: "note",
      forceLocal: true
    });
    return { ok: true, message: "Cliente removido." };
  }

  const { data, error } = await supabase.from("accounts").delete().eq("id", input.id).select("id").maybeSingle();

  if (error || !data) {
    return { ok: false, message: "Nao foi possivel excluir o cliente." };
  }

  removeLocalCustomer(input.id);
  const context = await getCurrentUserContext();
  await recordCrmActivity({
    actor: context?.fullName ?? "Equipe",
    action: "removeu cliente",
    target: input.tradeName,
    eventType: "customer",
    subject: input.tradeName,
    kind: "note",
    forceLocal: !context
  });

  return { ok: true, message: "Cliente excluido." };
}

export async function createOpportunity(input: {
  title: string;
  accountId: string;
  stageId: string;
  leadSource?: string;
  nextStep?: string;
  amount: number;
  baseAmount: number;
  isRecurring: boolean;
  months: number;
  probability?: number;
  expectedCloseDate: string;
  status?: string;
  conclusionStatus?: string;
  conclusionReason?: string;
  concludedAt?: string;
  accountLabel?: string;
  stageLabel?: string;
}): Promise<OpportunityItem> {
  const context = await getCurrentUserContext();

  const fallbackItem: OpportunityItem = {
    id: `local-opportunity-${Date.now()}`,
    title: input.title,
    company: input.accountLabel ?? "Conta selecionada",
    leadSource: input.leadSource,
    createdAt: new Date().toISOString(),
    stage: input.stageLabel ?? "Etapa selecionada",
    owner: context?.fullName ?? "Equipe",
    nextStep: input.nextStep,
    baseAmount: currency(input.baseAmount),
    isRecurring: input.isRecurring,
    months: input.months,
    amount: currency(input.amount),
    probability: Math.max(0, Math.min(100, input.probability ?? DEFAULT_STAGE_PROBABILITIES[normalizeStageLabel(input.stageLabel)] ?? 0)),
    manualProbability: input.probability,
    expectedCloseDate: formatDate(input.expectedCloseDate),
    status: input.status ?? "Em andamento",
    conclusionStatus: input.conclusionStatus,
    conclusionReason: input.conclusionReason,
    concludedAt: input.concludedAt
  };

  if (!context || !input.accountId || !input.stageId) {
    saveLocalOpportunityPreview(fallbackItem);
    await recordCrmActivity({
      actor: fallbackItem.owner,
      action: "criou oportunidade",
      target: fallbackItem.title,
      eventType: "opportunity",
      subject: fallbackItem.title,
      kind: "note",
      forceLocal: true
    });
    return fallbackItem;
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      organization_id: context.organizationId,
      account_id: input.accountId,
      stage_id: input.stageId,
      owner_id: context.userId,
      title: input.title,
      status: mapUiOpportunityStatusToDb(input.status),
      lead_source: input.leadSource || null,
      next_step: input.nextStep || null,
      base_amount: input.baseAmount,
      is_recurring: input.isRecurring,
      months: input.months,
      amount: input.amount,
      probability_override: input.probability ?? null,
      expected_close_date: input.expectedCloseDate || null,
      conclusion_status: input.conclusionStatus || null,
      conclusion_reason: input.conclusionReason || null,
      concluded_at: input.concludedAt || null
    })
    .select(
      "id, title, amount, base_amount, is_recurring, months, status, next_step, expected_close_date, conclusion_status, conclusion_reason, concluded_at, probability_override, lead_source, created_at, pipeline_stages:stage_id(name, probability), accounts:account_id(trade_name, legal_name)"
    )
    .single();

  if (error || !data) {
    saveLocalOpportunityPreview(fallbackItem);
    return fallbackItem;
  }

  const stage = pickOne(data.pipeline_stages);
  const account = pickOne(data.accounts);

  const createdItem = {
    id: data.id,
    title: data.title,
    company: account?.trade_name ?? account?.legal_name ?? "Conta sem nome",
    leadSource: data.lead_source ?? undefined,
    createdAt: data.created_at ?? undefined,
    stage: normalizeStageLabel(stage?.name),
    owner: context.fullName,
    nextStep: data.next_step ?? undefined,
    baseAmount: currency(data.base_amount),
    isRecurring: Boolean(data.is_recurring),
    months: data.months ?? input.months,
    amount: currency(data.amount),
    probability: Math.max(
      0,
      Math.min(100, data.probability_override ?? stage?.probability ?? DEFAULT_STAGE_PROBABILITIES[normalizeStageLabel(stage?.name)] ?? 0)
    ),
    manualProbability: data.probability_override ?? undefined,
    expectedCloseDate: formatDate(data.expected_close_date),
    status: mapDbOpportunityStatusToUi(data.status),
    conclusionStatus: data.conclusion_status ?? undefined,
    conclusionReason: data.conclusion_reason ?? undefined,
    concludedAt: data.concluded_at ?? undefined
  };

  await recordCrmActivity({
    actor: context.fullName,
    action: "criou oportunidade",
    target: createdItem.title,
    eventType: "opportunity",
    subject: createdItem.title,
    kind: "note",
    opportunityId: createdItem.id,
    accountId: input.accountId
  });
  notifyCrmDataChanged();
  return createdItem;
}

export async function updateOpportunity(input: {
  id: string;
  title: string;
  stageId?: string;
  stageLabel?: string;
  leadSource?: string;
  nextStep?: string;
  amount: number;
  baseAmount: number;
  isRecurring: boolean;
  months: number;
  probability?: number;
  expectedCloseDate: string;
  status?: string;
  conclusionStatus?: string;
  conclusionReason?: string;
  concludedAt?: string;
  currentCompany: string;
  currentStage: string;
}): Promise<OpportunityItem> {
  const context = await getCurrentUserContext();

  const fallbackItem: OpportunityItem = {
    id: input.id,
    title: input.title,
    company: input.currentCompany,
    leadSource: input.leadSource,
    createdAt: existingLocalOpportunityCreatedAt(input.id),
    stage: input.stageLabel ?? input.currentStage,
    owner: context?.fullName ?? "Equipe",
    nextStep: input.nextStep,
    baseAmount: currency(input.baseAmount),
    isRecurring: input.isRecurring,
    months: input.months,
    amount: currency(input.amount),
    probability: Math.max(
      0,
      Math.min(100, input.probability ?? DEFAULT_STAGE_PROBABILITIES[normalizeStageLabel(input.stageLabel ?? input.currentStage)] ?? 0)
    ),
    manualProbability: input.probability,
    expectedCloseDate: formatDate(input.expectedCloseDate),
    status: input.status ?? "Em andamento",
    conclusionStatus: input.conclusionStatus,
    conclusionReason: input.conclusionReason,
    concludedAt: input.concludedAt
  };

  if (!context || input.id.startsWith("local-opportunity-")) {
    updateLocalOpportunityPreview(fallbackItem);
    await recordCrmActivity({
      actor: fallbackItem.owner,
      action: "editou oportunidade",
      target: fallbackItem.title,
      eventType: "opportunity",
      subject: fallbackItem.title,
      kind: "note",
      forceLocal: true
    });
    return fallbackItem;
  }

  const { data, error } = await supabase
    .from("opportunities")
    .update({
      title: input.title,
      stage_id: input.stageId || undefined,
      status: mapUiOpportunityStatusToDb(input.status),
      lead_source: input.leadSource || null,
      next_step: input.nextStep || null,
      base_amount: input.baseAmount,
      is_recurring: input.isRecurring,
      months: input.months,
      amount: input.amount,
      probability_override: input.probability ?? null,
      expected_close_date: input.expectedCloseDate || null,
      conclusion_status: input.conclusionStatus || null,
      conclusion_reason: input.conclusionReason || null,
      concluded_at: input.concludedAt || null
    })
    .eq("id", input.id)
    .select(
      "id, title, amount, base_amount, is_recurring, months, status, next_step, expected_close_date, conclusion_status, conclusion_reason, concluded_at, probability_override, lead_source, created_at, pipeline_stages:stage_id(name, probability), accounts:account_id(trade_name, legal_name)"
    )
    .single();

  if (error || !data) {
    updateLocalOpportunityPreview(fallbackItem);
    return fallbackItem;
  }

  const stage = pickOne(data.pipeline_stages);
  const account = pickOne(data.accounts);

  const updatedItem = {
    id: data.id,
    title: data.title,
    company: account?.trade_name ?? account?.legal_name ?? input.currentCompany,
    leadSource: data.lead_source ?? undefined,
    createdAt: data.created_at ?? undefined,
    stage: normalizeStageLabel(input.stageLabel ?? stage?.name ?? input.currentStage),
    owner: context.fullName,
    nextStep: data.next_step ?? undefined,
    baseAmount: currency(data.base_amount),
    isRecurring: Boolean(data.is_recurring),
    months: data.months ?? input.months,
    amount: currency(data.amount),
    probability: Math.max(
      0,
      Math.min(
        100,
        data.probability_override ??
          stage?.probability ??
          DEFAULT_STAGE_PROBABILITIES[normalizeStageLabel(input.stageLabel ?? stage?.name ?? input.currentStage)] ??
          0
      )
    ),
    manualProbability: data.probability_override ?? undefined,
    expectedCloseDate: formatDate(data.expected_close_date),
    status: mapDbOpportunityStatusToUi(data.status),
    conclusionStatus: data.conclusion_status ?? undefined,
    conclusionReason: data.conclusion_reason ?? undefined,
    concludedAt: data.concluded_at ?? undefined
  };

  await recordCrmActivity({
    actor: context.fullName,
    action: "editou oportunidade",
    target: updatedItem.title,
    eventType: "opportunity",
    subject: updatedItem.title,
    kind: "note",
    opportunityId: updatedItem.id
  });
  notifyCrmDataChanged();
  return updatedItem;
}

export async function deleteOpportunity(input: { id: string; title: string }): Promise<{ ok: boolean; message: string }> {
  if (input.id.startsWith("local-opportunity-")) {
    removeLocalOpportunityPreview(input.id);
    await recordCrmActivity({
      actor: "Equipe",
      action: "removeu oportunidade",
      target: input.title,
      eventType: "opportunity",
      subject: input.title,
      kind: "note",
      forceLocal: true
    });
    return { ok: true, message: "Oportunidade removida." };
  }

  const [tasksRes, activitiesRes] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("opportunity_id", input.id),
    supabase.from("activities").select("id", { count: "exact", head: true }).eq("opportunity_id", input.id)
  ]);

  const taskCount = tasksRes.count ?? 0;
  const activityCount = activitiesRes.count ?? 0;

  if (taskCount > 0 || activityCount > 0) {
    const dependencyLabels = [
      taskCount ? `${taskCount} tarefa(s)` : null,
      activityCount ? `${activityCount} atividade(s)` : null
    ].filter(Boolean);

    return {
      ok: false,
      message: `Exclusao bloqueada. Esta oportunidade ainda possui ${dependencyLabels.join(", ")} vinculadas.`
    };
  }

  const { error } = await supabase.from("opportunities").delete().eq("id", input.id);

  if (error) {
    return { ok: false, message: "Nao foi possivel excluir a oportunidade." };
  }

  removeLocalOpportunityPreview(input.id);
  const context = await getCurrentUserContext();
  await recordCrmActivity({
    actor: context?.fullName ?? "Equipe",
    action: "removeu oportunidade",
    target: input.title,
    eventType: "opportunity",
    subject: input.title,
    kind: "note",
    forceLocal: !context
  });

  return { ok: true, message: "Oportunidade excluida." };
}

export async function moveOpportunityToStage(input: {
  opportunityId: string;
  targetStage: string;
}): Promise<OpportunityItem | null> {
  const opportunities = await getOpportunities();
  const currentItem = opportunities.find((item) => item.id === input.opportunityId);

  if (!currentItem) {
    return null;
  }

  const nextItem: OpportunityItem = {
    ...currentItem,
    stage: normalizeStageLabel(input.targetStage),
    probability:
      typeof currentItem.manualProbability === "number"
        ? currentItem.manualProbability
        : DEFAULT_STAGE_PROBABILITIES[normalizeStageLabel(input.targetStage)] ?? currentItem.probability,
    concludedAt:
      isConclusionStage(input.targetStage) && !currentItem.concludedAt
        ? new Date().toISOString()
        : !isConclusionStage(input.targetStage)
          ? undefined
          : currentItem.concludedAt
  };

  const movementAction = `moveu ${nextItem.title} de ${currentItem.stage || "Sem etapa"} para`;

  updateLocalOpportunityPreview(nextItem);

  if (input.opportunityId.startsWith("local-opportunity-")) {
    await recordCrmActivity({
      actor: nextItem.owner || "Equipe",
      action: movementAction,
      target: input.targetStage,
      eventType: "movement",
      subject: nextItem.title,
      kind: "note",
      notes: `${STAGE_NOTE_PREFIX}${currentItem.stage || "Sem etapa"}||${input.targetStage}`,
      forceLocal: true
    });
    return nextItem;
  }

  const context = await getCurrentUserContext();

  if (!context) {
    await recordCrmActivity({
      actor: nextItem.owner || "Equipe",
      action: movementAction,
      target: input.targetStage,
      eventType: "movement",
      subject: nextItem.title,
      kind: "note",
      notes: `${STAGE_NOTE_PREFIX}${currentItem.stage || "Sem etapa"}||${input.targetStage}`,
      forceLocal: true
    });
    return nextItem;
  }

  const { data: stageRows } = await supabase
    .from("pipeline_stages")
    .select("id, name");

  const stageRow = stageRows?.find((item) => normalizeStageLabel(item.name) === normalizeStageLabel(input.targetStage));

  if (!stageRow?.id) {
    await recordCrmActivity({
      actor: nextItem.owner || "Equipe",
      action: movementAction,
      target: input.targetStage,
      eventType: "movement",
      subject: nextItem.title,
      kind: "note",
      notes: `${STAGE_NOTE_PREFIX}${currentItem.stage || "Sem etapa"}||${input.targetStage}`,
      forceLocal: true
    });
    return nextItem;
  }

  const { error } = await supabase
    .from("opportunities")
    .update({
      stage_id: stageRow.id,
      concluded_at: nextItem.concludedAt ?? null
    })
    .eq("id", input.opportunityId);

  if (error) {
    await recordCrmActivity({
      actor: nextItem.owner || "Equipe",
      action: movementAction,
      target: input.targetStage,
      eventType: "movement",
      subject: nextItem.title,
      kind: "note",
      notes: `${STAGE_NOTE_PREFIX}${currentItem.stage || "Sem etapa"}||${input.targetStage}`,
      forceLocal: true
    });
    return nextItem;
  }

  await recordCrmActivity({
    actor: context.fullName,
    action: movementAction,
    target: input.targetStage,
    eventType: "movement",
    subject: nextItem.title,
    kind: "note",
    notes: `${STAGE_NOTE_PREFIX}${currentItem.stage || "Sem etapa"}||${input.targetStage}`,
    opportunityId: input.opportunityId
  });

  notifyCrmDataChanged();
  return nextItem;
}

export async function getOpportunityNotes(opportunityId: string): Promise<OpportunityNote[]> {
  const localNotes = getLocalOpportunityNotes()
    .filter((item) => item.opportunityId === opportunityId)
    .sort(sortOpportunityNotesByDateDesc);

  if (opportunityId.startsWith("local-opportunity-")) {
    return localNotes;
  }

  try {
    const { data, error } = await supabase
      .from("activities")
      .select("id, notes, created_at, actor_id, profiles:actor_id(full_name)")
      .eq("opportunity_id", opportunityId)
      .eq("kind", "note")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return localNotes;
    }

    const remoteNotes = data
      .map((item) => {
        const content = parseOpportunityNote(item.notes);

        if (!content) {
          return null;
        }

        const profile = pickOne(item.profiles);

        return {
          id: item.id,
          opportunityId,
          content,
          author: profile?.full_name ?? "Equipe",
          createdAt: item.created_at ?? new Date().toISOString()
        } satisfies OpportunityNote;
      })
      .filter((item): item is OpportunityNote => Boolean(item));

    const merged = new Map<string, OpportunityNote>();
    remoteNotes.forEach((item) => merged.set(item.id, item));
    localNotes.forEach((item) => merged.set(item.id, item));
    return Array.from(merged.values()).sort(sortOpportunityNotesByDateDesc);
  } catch {
    return localNotes;
  }
}

export async function addOpportunityNote(input: {
  opportunityId: string;
  opportunityTitle: string;
  content: string;
}): Promise<OpportunityNote> {
  const createdAt = new Date().toISOString();
  const fallbackNote: OpportunityNote = {
    id: `opportunity-note-local-${Date.now()}`,
    opportunityId: input.opportunityId,
    content: input.content.trim(),
    author: "Equipe",
    createdAt
  };

  const saveFallback = async (author?: string) => {
    const nextNote = {
      ...fallbackNote,
      author: author ?? fallbackNote.author
    };
    const next = [nextNote, ...getLocalOpportunityNotes().filter((item) => item.id !== nextNote.id)];
    saveLocalOpportunityNotes(next);
    return nextNote;
  };

  if (!input.content.trim()) {
    return fallbackNote;
  }

  if (input.opportunityId.startsWith("local-opportunity-")) {
    return saveFallback();
  }

  const context = await getCurrentUserContext();

  if (!context) {
    return saveFallback();
  }

  const { data, error } = await supabase
    .from("activities")
    .insert({
      organization_id: context.organizationId,
      opportunity_id: input.opportunityId,
      actor_id: context.userId,
      kind: "note",
      subject: input.opportunityTitle,
      notes: `${OPPORTUNITY_NOTE_PREFIX}${input.content.trim()}`,
      completed_at: createdAt
    })
    .select("id, notes, created_at")
    .single();

  if (error || !data) {
    return saveFallback(context.fullName);
  }

  notifyCrmDataChanged();

  return {
    id: data.id,
    opportunityId: input.opportunityId,
    content: parseOpportunityNote(data.notes) ?? input.content.trim(),
    author: context.fullName,
    createdAt: data.created_at ?? createdAt
  };
}

export async function getHistoryActivities(): Promise<ActivityItem[]> {
  const localActivity = getLocalActivity();
  const currentContext = await getCurrentUserContext();

  try {
    const { data, error } = await supabase
      .from("activities")
      .select(
        "id, subject, notes, kind, created_at, actor_id, profiles:actor_id(full_name), accounts:account_id(trade_name, legal_name)"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) {
      return [...localActivity, ...seedActivity];
    }

    const remoteItems: ActivityItem[] = data.map((item): ActivityItem => {
      const actor = pickOne(item.profiles);
      const account = pickOne(item.accounts);
      const move = parseStageMovement(item.notes);
      const audit = parseAuditEvent(item.notes);

      if (move) {
        return {
          id: item.id,
          actor: resolveCurrentUserLabel(currentContext, item.actor_id, actor?.full_name),
          action: `moveu ${item.subject} de ${move.fromStage || "Sem etapa"} para`,
          target: move.toStage || "Sem etapa",
          when: formatRelative(item.created_at),
          createdAt: item.created_at,
          eventType: "movement"
        };
      }

      if (audit) {
        return {
          id: item.id,
          actor: resolveCurrentUserLabel(currentContext, item.actor_id, actor?.full_name),
          action: audit.action,
          target: audit.target,
          when: formatRelative(item.created_at),
          createdAt: item.created_at,
          eventType: audit.eventType
        };
      }

      return {
        id: item.id,
        actor: resolveCurrentUserLabel(currentContext, item.actor_id, actor?.full_name),
        action: item.kind === "task" ? "criou atividade em" : "registrou interacao em",
        target: account?.trade_name ?? account?.legal_name ?? item.subject,
        when: formatRelative(item.created_at),
        createdAt: item.created_at,
        eventType: item.kind === "task" ? "task" : "interaction"
      };
    });

    return [...localActivity, ...remoteItems].sort(sortActivityByDateDesc);
  } catch {
    return [...localActivity, ...seedActivity].sort(sortActivityByDateDesc);
  }
}

export async function createAgendaEntry(input: {
  title: string;
  note: string;
  scheduledDate: string;
  scheduledTime: string;
  category?: string;
  accountId?: string;
  opportunityId?: string;
  accountName?: string;
  opportunityTitle?: string;
}): Promise<AgendaItem> {
  const scheduledAt = combineDateAndTime(input.scheduledDate, input.scheduledTime);
  const fallbackItem: AgendaItem = {
    id: `local-agenda-${Date.now()}`,
    time: input.scheduledTime || formatTime(scheduledAt),
    title: input.title,
    note: input.note || "Sem observacao",
    scheduledAt: scheduledAt ?? undefined,
    category: input.category || "Reuniao",
    accountId: input.accountId,
    accountName: input.accountName,
    opportunityId: input.opportunityId,
    opportunityTitle: input.opportunityTitle
  };

  const context = await getCurrentUserContext();

  if (!context || !scheduledAt) {
    const next = mergeAgendaItems([fallbackItem], getLocalAgenda());
    saveLocalAgenda(next);
    await recordCrmActivity({
      actor: context?.fullName ?? "Equipe",
      action: "criou item da agenda",
      target: input.title,
      eventType: "interaction",
      subject: input.title,
      kind: "note",
      forceLocal: true
    });
    return fallbackItem;
  }

  const { data, error } = await supabase
    .from("activities")
    .insert({
      organization_id: context.organizationId,
      actor_id: context.userId,
        kind: agendaKindFromCategory(input.category),
        subject: input.title,
        notes: input.note || null,
        scheduled_for: scheduledAt,
        account_id: input.accountId || null,
        opportunity_id: input.opportunityId || null
      })
    .select(
      "id, subject, notes, kind, scheduled_for, accounts:account_id(id, trade_name, legal_name), opportunities:opportunity_id(id, title)"
    )
    .single();

  if (error || !data) {
    const next = mergeAgendaItems([fallbackItem], getLocalAgenda());
    saveLocalAgenda(next);
    await recordCrmActivity({
      actor: context.fullName,
      action: "criou item da agenda",
      target: input.title,
      eventType: "interaction",
      subject: input.title,
      kind: "note",
      forceLocal: true
    });
    return fallbackItem;
  }

  const createdItem = mapAgendaItem(data);

  await recordCrmActivity({
    actor: context.fullName,
    action: "criou item da agenda",
    target: createdItem.title,
    eventType: "interaction",
    subject: createdItem.title,
    kind: "note"
  });

  notifyCrmDataChanged();
  return createdItem;
}

export async function updateAgendaEntry(input: {
  id: string;
  title: string;
  note: string;
  scheduledDate: string;
  scheduledTime: string;
  category?: string;
  accountId?: string;
  opportunityId?: string;
  accountName?: string;
  opportunityTitle?: string;
}): Promise<AgendaItem> {
  const scheduledAt = combineDateAndTime(input.scheduledDate, input.scheduledTime);
  const fallbackItem: AgendaItem = {
    id: input.id,
    time: input.scheduledTime || formatTime(scheduledAt),
    title: input.title,
    note: input.note || "Sem observacao",
    scheduledAt: scheduledAt ?? undefined,
    category: input.category || "Reuniao",
    accountId: input.accountId,
    accountName: input.accountName,
    opportunityId: input.opportunityId,
    opportunityTitle: input.opportunityTitle
  };

  const localItems = getLocalAgenda();

  if (input.id.startsWith("local-agenda-") || !scheduledAt) {
    saveLocalAgenda(mergeAgendaItems([fallbackItem], localItems));
    await recordCrmActivity({
      actor: "Equipe",
      action: "editou item da agenda",
      target: input.title,
      eventType: "interaction",
      subject: input.title,
      kind: "note",
      forceLocal: true
    });
    return fallbackItem;
  }

  const { data, error } = await supabase
    .from("activities")
    .update({
      subject: input.title,
      notes: input.note || null,
      kind: agendaKindFromCategory(input.category),
      scheduled_for: scheduledAt,
      account_id: input.accountId || null,
      opportunity_id: input.opportunityId || null
    })
    .eq("id", input.id)
    .select(
      "id, subject, notes, kind, scheduled_for, accounts:account_id(id, trade_name, legal_name), opportunities:opportunity_id(id, title)"
    )
    .single();

  if (error || !data) {
    saveLocalAgenda(mergeAgendaItems([fallbackItem], localItems));
    await recordCrmActivity({
      actor: "Equipe",
      action: "editou item da agenda",
      target: input.title,
      eventType: "interaction",
      subject: input.title,
      kind: "note",
      forceLocal: true
    });
    return fallbackItem;
  }

  const context = await getCurrentUserContext();
  const updatedItem = mapAgendaItem(data);

  await recordCrmActivity({
    actor: context?.fullName ?? "Equipe",
    action: "editou item da agenda",
    target: updatedItem.title,
    eventType: "interaction",
    subject: updatedItem.title,
    kind: "note",
    forceLocal: !context
  });

  notifyCrmDataChanged();
  return updatedItem;
}

export async function deleteAgendaEntry(input: { id: string; title: string }): Promise<boolean> {
  const localItems = getLocalAgenda();

  if (input.id.startsWith("local-agenda-")) {
    saveLocalAgenda(localItems.filter((item) => item.id !== input.id));
    await recordCrmActivity({
      actor: "Equipe",
      action: "removeu item da agenda",
      target: input.title,
      eventType: "interaction",
      subject: input.title,
      kind: "note",
      forceLocal: true
    });
    return true;
  }

  const { error } = await supabase.from("activities").delete().eq("id", input.id);

  if (error) {
    return false;
  }

  const context = await getCurrentUserContext();
  await recordCrmActivity({
    actor: context?.fullName ?? "Equipe",
    action: "removeu item da agenda",
    target: input.title,
    eventType: "interaction",
    subject: input.title,
    kind: "note",
    forceLocal: !context
  });

  notifyCrmDataChanged();
  return true;
}

export async function getAgendaEntries(): Promise<AgendaItem[]> {
  return getCachedQuery("agenda:list", async () => {
    const localAgenda = getLocalAgenda();

    try {
      const { data, error } = await supabase
        .from("activities")
        .select(
          "id, subject, notes, kind, scheduled_for, accounts:account_id(id, trade_name, legal_name), opportunities:opportunity_id(id, title)"
        )
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true })
        .limit(200);

      if (error || !data) {
        return mergeAgendaItems(localAgenda, seedAgenda);
      }

      return mergeAgendaItems(localAgenda, data.map(mapAgendaItem));
    } catch {
      return mergeAgendaItems(localAgenda, seedAgenda);
    }
  });
}

async function syncPersistedNotifications(
  drafts: NotificationRuleDraft[],
  context: Awaited<ReturnType<typeof getCurrentUserContext>>
): Promise<StoredNotification[]> {
  if (!context) {
    const current = getLocalNotifications();
    const currentByRule = new Map(current.map((item) => [item.ruleKey, item]));
    const activeRuleKeys = new Set(drafts.map((draft) => draft.ruleKey));
    const resolved = current
      .filter((item) => !activeRuleKeys.has(item.ruleKey))
      .map((item) => ({
        ...item,
        resolvedAt: item.resolvedAt ?? new Date().toISOString()
      }));
    const next = [
      ...drafts.map((draft) => createNotificationFromRule(draft, currentByRule.get(draft.ruleKey))),
      ...resolved
    ];
    saveLocalNotificationsIfChanged(next);
    return next;
  }

  const { data: existing, error: fetchError } = await supabase
    .from("notifications")
    .select("id, source_key, label, title, detail, href, priority, is_read, resolved_at")
    .eq("user_id", context.userId)
    .is("resolved_at", null);

  if (fetchError) {
    const current = getLocalNotifications();
    const currentByRule = new Map(current.map((item) => [item.ruleKey, item]));
    const activeRuleKeys = new Set(drafts.map((draft) => draft.ruleKey));
    const resolved = current
      .filter((item) => !activeRuleKeys.has(item.ruleKey))
      .map((item) => ({
        ...item,
        resolvedAt: item.resolvedAt ?? new Date().toISOString()
      }));
    const next = [
      ...drafts.map((draft) => createNotificationFromRule(draft, currentByRule.get(draft.ruleKey))),
      ...resolved
    ];
    saveLocalNotificationsIfChanged(next);
    return next;
  }

  const existingByRule = new Map(
    (existing ?? []).map((item) => [
      item.source_key,
      {
        id: item.id,
        ruleKey: item.source_key,
        label: item.label,
        title: item.title,
        detail: item.detail,
        href: item.href,
        priority: item.priority as NotificationPriority,
        isRead: Boolean(item.is_read),
        resolvedAt: item.resolved_at
      } satisfies StoredNotification
    ])
  );

  if (drafts.length) {
    await supabase.from("notifications").upsert(
      drafts.map((draft) => ({
        organization_id: context.organizationId,
        user_id: context.userId,
        source_key: draft.ruleKey,
        type: draft.type,
        label: draft.label,
        title: draft.title,
        detail: draft.detail,
        href: draft.href,
        priority: draft.priority,
        entity_type: draft.entityType || null,
        entity_id: draft.entityId || null,
        resolved_at: null,
        updated_at: new Date().toISOString()
      })),
      { onConflict: "organization_id,user_id,source_key" }
    );
  }

  const activeRuleKeys = new Set(drafts.map((draft) => draft.ruleKey));
  const staleRuleKeys = Array.from(existingByRule.keys()).filter((ruleKey) => !activeRuleKeys.has(ruleKey));

  if (staleRuleKeys.length) {
    await supabase
      .from("notifications")
      .update({
        is_read: false,
        read_at: null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("user_id", context.userId)
      .in("source_key", staleRuleKeys);
  }

  const { data: fresh, error: freshError } = await supabase
    .from("notifications")
    .select("id, source_key, label, title, detail, href, priority, is_read, resolved_at, created_at")
    .eq("user_id", context.userId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  if (freshError || !fresh) {
    return drafts.map((draft) => createNotificationFromRule(draft, existingByRule.get(draft.ruleKey)));
  }

  return fresh.map(
    (item) =>
      ({
        id: item.id,
        ruleKey: item.source_key,
        label: item.label,
        title: item.title,
        detail: item.detail,
        href: item.href,
        priority: item.priority as NotificationPriority,
        isRead: Boolean(item.is_read),
        resolvedAt: item.resolved_at
      }) satisfies StoredNotification
  );
}

export async function getNotificationItems(): Promise<NotificationItem[]> {
  const [agenda, tasks, opportunities, attention, context, settings] = await Promise.all([
    getAgendaEntries(),
    getTasks(),
    getOpportunities(),
    getPipelineAttention(10),
    getCurrentUserContext(),
    getCrmSettings()
  ]);

  if (!settings.features.notifications_center) {
    return [];
  }

  const drafts = [
    ...buildNotificationRules({
    agenda,
    tasks: settings.features.task_reminders ? tasks : [],
    opportunities
    }),
    ...(settings.features.pipeline_agent_system && settings.pipelineAgent.enabled
      ? buildPipelineAttentionNotificationRules(attention)
      : [])
  ].slice(0, 16);
  const items = await syncPersistedNotifications(drafts, context);

  return items
    .filter((item) => !item.resolvedAt)
    .map((item) => ({
      id: item.id,
      ruleKey: item.ruleKey,
      label: item.label,
      title: item.title,
      detail: item.detail,
      href: item.href,
      priority: item.priority,
      isRead: item.isRead
    }));
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const localItems = getLocalNotifications();
  const localMatch = localItems.find((item) => item.id === notificationId);

  if (localMatch) {
    saveLocalNotifications(
      localItems.map((item) =>
        item.id === notificationId
          ? {
              ...item,
              isRead: true
            }
          : item
      )
    );
    return true;
  }

  const context = await getCurrentUserContext();

  if (!context) {
    return false;
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", notificationId)
    .eq("user_id", context.userId);

  if (!error) {
    notifyCrmDataChanged();
  }

  return !error;
}

export async function markAllNotificationsAsRead(): Promise<boolean> {
  const localItems = getLocalNotifications();

  if (localItems.length) {
    saveLocalNotifications(
      localItems.map((item) => ({
        ...item,
        isRead: true
      }))
    );
  }

  const context = await getCurrentUserContext();

  if (!context) {
    return localItems.length > 0;
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("user_id", context.userId)
    .is("resolved_at", null)
    .eq("is_read", false);

  if (!error) {
    notifyCrmDataChanged();
  }

  return !error;
}

export async function getNotificationCenterItems(): Promise<StoredNotification[]> {
  const [agenda, tasks, opportunities, attention, context, settings] = await Promise.all([
    getAgendaEntries(),
    getTasks(),
    getOpportunities(),
    getPipelineAttention(10),
    getCurrentUserContext(),
    getCrmSettings()
  ]);

  if (!settings.features.notifications_center) {
    return [];
  }

  const drafts = [
    ...buildNotificationRules({
    agenda,
    tasks: settings.features.task_reminders ? tasks : [],
    opportunities
    }),
    ...(settings.features.pipeline_agent_system && settings.pipelineAgent.enabled
      ? buildPipelineAttentionNotificationRules(attention)
      : [])
  ].slice(0, 16);
  await syncPersistedNotifications(drafts, context);

  if (!context) {
    return getLocalNotifications();
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, source_key, label, title, detail, href, priority, is_read, resolved_at, entity_type, entity_id, created_at")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) {
    return getLocalNotifications();
  }

  return data.map(
    (item) =>
      ({
        id: item.id,
        ruleKey: item.source_key,
        label: item.label,
        title: item.title,
        detail: item.detail,
        href: item.href,
        priority: item.priority as NotificationPriority,
        isRead: Boolean(item.is_read),
        resolvedAt: item.resolved_at,
        entityType: item.entity_type ?? undefined,
        entityId: item.entity_id ?? undefined
      }) satisfies StoredNotification
  );
}

export async function createTask(input: {
  title: string;
  opportunityId?: string;
  opportunityTitle?: string;
  dueDate?: string;
  dueTime?: string;
  priority: string;
  companyLabel?: string;
}): Promise<TaskItem> {
  const context = await getCurrentUserContext();
  const dueAt = combineDateAndTime(input.dueDate, input.dueTime) ?? undefined;

  const fallbackItem: TaskItem = {
    id: `local-task-${Date.now()}`,
    title: input.title,
    company: input.companyLabel ?? "Sem conta",
    opportunityId: input.opportunityId,
    opportunityTitle: input.opportunityTitle,
    due: formatDateTime(dueAt),
    priority: input.priority,
    dueDate: input.dueDate,
    dueTime: input.dueTime
  };

  if (!context) {
    await recordCrmActivity({
      actor: "Equipe",
      action: "criou tarefa",
      target: input.title,
      eventType: "task",
      subject: input.title,
      kind: "task",
      forceLocal: true
    });
    return fallbackItem;
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: context.organizationId,
      opportunity_id: input.opportunityId || null,
      owner_id: context.userId,
      title: input.title,
      priority: input.priority,
      due_at: dueAt || null
    })
    .select("id, title, due_at, priority")
    .single();

  if (error || !data) {
    return fallbackItem;
  }

  const createdTask = {
    id: data.id,
    title: data.title,
    company: input.companyLabel ?? "Sem conta",
    opportunityId: input.opportunityId,
    opportunityTitle: input.opportunityTitle,
    due: formatDateTime(data.due_at),
    priority: data.priority ?? input.priority,
    dueDate: toDateInput(data.due_at),
    dueTime: toTimeInput(data.due_at)
  };

  await recordCrmActivity({
    actor: context.fullName,
    action: "criou tarefa",
    target: createdTask.title,
    eventType: "task",
    subject: createdTask.title,
    kind: "task",
    opportunityId: input.opportunityId
  });

  notifyCrmDataChanged();

  return createdTask;
}

export async function updateTask(input: {
  id: string;
  title: string;
  opportunityId?: string;
  opportunityTitle?: string;
  dueDate?: string;
  dueTime?: string;
  priority: string;
  companyLabel?: string;
}): Promise<{ ok: boolean; item: TaskItem; message?: string }> {
  const dueAt = combineDateAndTime(input.dueDate, input.dueTime) ?? undefined;
  const fallbackItem: TaskItem = {
    id: input.id,
    title: input.title,
    company: input.companyLabel ?? "Sem conta",
    opportunityId: input.opportunityId,
    opportunityTitle: input.opportunityTitle,
    due: formatDateTime(dueAt),
    priority: input.priority,
    dueDate: input.dueDate,
    dueTime: input.dueTime
  };

  if (input.id.startsWith("local-task-")) {
    await recordCrmActivity({
      actor: "Equipe",
      action: "editou tarefa",
      target: input.title,
      eventType: "task",
      subject: input.title,
      kind: "task",
      forceLocal: true
    });
    return { ok: true, item: fallbackItem };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: input.title,
      opportunity_id: input.opportunityId || null,
      priority: input.priority,
      due_at: dueAt || null
    })
    .eq("id", input.id)
    .select("id, title, due_at, priority")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      item: fallbackItem,
      message: "Nao foi possivel atualizar a tarefa."
    };
  }

  const updatedTask = {
    id: data.id,
    title: data.title,
    company: input.companyLabel ?? "Sem conta",
    opportunityId: input.opportunityId,
    opportunityTitle: input.opportunityTitle,
    due: formatDateTime(data.due_at),
    priority: data.priority ?? input.priority,
    dueDate: toDateInput(data.due_at),
    dueTime: toTimeInput(data.due_at)
  };

  const context = await getCurrentUserContext();
  await recordCrmActivity({
    actor: context?.fullName ?? "Equipe",
    action: "editou tarefa",
    target: updatedTask.title,
    eventType: "task",
    subject: updatedTask.title,
    kind: "task",
    forceLocal: !context
  });

  notifyCrmDataChanged();

  return { ok: true, item: updatedTask };
}

export async function completeTask(taskId: string, taskTitle?: string): Promise<boolean> {
  if (taskId.startsWith("local-task-")) {
    await recordCrmActivity({
      actor: "Equipe",
      action: "concluiu tarefa",
      target: taskTitle || taskId,
      eventType: "task",
      subject: taskTitle || taskId,
      kind: "task",
      forceLocal: true
    });
    return true;
  }

  const { error } = await supabase.from("tasks").update({ is_done: true }).eq("id", taskId);

  if (!error) {
    const context = await getCurrentUserContext();
    await recordCrmActivity({
      actor: context?.fullName ?? "Equipe",
      action: "concluiu tarefa",
      target: taskTitle || taskId,
      eventType: "task",
      subject: taskTitle || taskId,
      kind: "task",
      forceLocal: !context
    });

    notifyCrmDataChanged();
  }

  return !error;
}

export async function deleteTask(input: { id: string; title: string }): Promise<boolean> {
  if (input.id.startsWith("local-task-")) {
    await recordCrmActivity({
      actor: "Equipe",
      action: "removeu tarefa",
      target: input.title,
      eventType: "task",
      subject: input.title,
      kind: "task",
      forceLocal: true
    });
    return true;
  }

  const { error } = await supabase.from("tasks").delete().eq("id", input.id);

  if (error) {
    return false;
  }

  const context = await getCurrentUserContext();
  await recordCrmActivity({
    actor: context?.fullName ?? "Equipe",
    action: "removeu tarefa",
    target: input.title,
    eventType: "task",
    subject: input.title,
    kind: "task",
    forceLocal: !context
  });

  notifyCrmDataChanged();

  return true;
}

