"use client";

import { supabase } from "@/lib/supabase";

export type FeatureKey =
  | "notifications_center"
  | "browser_notifications"
  | "agenda_module"
  | "task_reminders"
  | "pipeline_drag_drop"
  | "history_module";

export type SupportedLocale = "pt-BR" | "en-US" | "es-ES";
export type SupportedTimeZone = "system" | "America/Sao_Paulo" | "America/New_York" | "UTC";
export type PipelineAgentStageLimits = {
  lead: number;
  qualification: number;
  diagnosis: number;
  proposal: number;
  negotiation: number;
  closing: number;
};
export type PipelineAgentSettings = {
  enabled: boolean;
  runAt: string;
  maxTasksPerDay: number;
  stageLimits: PipelineAgentStageLimits;
};

export type CrmSettings = {
  displayName: string;
  companyName: string;
  locale: SupportedLocale;
  timeZone: SupportedTimeZone;
  use24HourClock: boolean;
  features: Record<FeatureKey, boolean>;
  pipelineAgent: PipelineAgentSettings;
};

const LOCAL_SETTINGS_KEY = "crm_system_settings";
const SETTINGS_CHANGED_EVENT = "crm:settings-changed";
const SETTINGS_CACHE_TTL_MS = 5000;
const PIPELINE_AGENT_FEATURE_KEY = "__pipeline_agent";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRunAt(value: string | undefined) {
  const parsed = (value ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(parsed)) {
    return "08:00";
  }

  const [hoursRaw, minutesRaw] = parsed.split(":");
  const hours = clamp(Number(hoursRaw), 0, 23);
  const minutes = clamp(Number(minutesRaw), 0, 59);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parsePipelineAgentSettings(raw: unknown): PipelineAgentSettings {
  const base = {
    enabled: true,
    runAt: "08:00",
    maxTasksPerDay: 5,
    stageLimits: {
      lead: 7,
      qualification: 6,
      diagnosis: 6,
      proposal: 4,
      negotiation: 3,
      closing: 2
    }
  } satisfies PipelineAgentSettings;

  if (!raw || typeof raw !== "object") {
    return base;
  }

  const source = raw as Partial<PipelineAgentSettings> & {
    stageLimits?: Partial<PipelineAgentStageLimits>;
  };

  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : base.enabled,
    runAt: normalizeRunAt(typeof source.runAt === "string" ? source.runAt : base.runAt),
    maxTasksPerDay: clamp(
      typeof source.maxTasksPerDay === "number" && Number.isFinite(source.maxTasksPerDay)
        ? Math.round(source.maxTasksPerDay)
        : base.maxTasksPerDay,
      1,
      20
    ),
    stageLimits: {
      lead: clamp(source.stageLimits?.lead ?? base.stageLimits.lead, 1, 30),
      qualification: clamp(source.stageLimits?.qualification ?? base.stageLimits.qualification, 1, 30),
      diagnosis: clamp(source.stageLimits?.diagnosis ?? base.stageLimits.diagnosis, 1, 30),
      proposal: clamp(source.stageLimits?.proposal ?? base.stageLimits.proposal, 1, 30),
      negotiation: clamp(source.stageLimits?.negotiation ?? base.stageLimits.negotiation, 1, 30),
      closing: clamp(source.stageLimits?.closing ?? base.stageLimits.closing, 1, 30)
    }
  };
}

export const defaultCrmSettings: CrmSettings = {
  displayName: "Administrador CRM",
  companyName: "CRM comercial",
  locale: "pt-BR",
  timeZone: "system",
  use24HourClock: true,
  features: {
    notifications_center: true,
    browser_notifications: true,
    agenda_module: true,
    task_reminders: true,
    pipeline_drag_drop: true,
    history_module: true
  },
  pipelineAgent: parsePipelineAgentSettings(null)
};

type CurrentSettingsUserContext = {
  userId: string;
  organizationId: string;
};

const USER_CONTEXT_CACHE_TTL_MS = 5000;
let currentUserContextCache:
  | {
      expiresAt: number;
      promise: Promise<CurrentSettingsUserContext | null>;
    }
  | null = null;
let currentSettingsCache:
  | {
      expiresAt: number;
      promise: Promise<CrmSettings>;
    }
  | null = null;

function getLocalSettings() {
  if (typeof window === "undefined") {
    return defaultCrmSettings;
  }

  const raw = window.localStorage.getItem(LOCAL_SETTINGS_KEY);

  if (!raw) {
    return defaultCrmSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CrmSettings>;
    const parsedFeatures = parsed.features || {};
    const featureRecord = parsedFeatures as Partial<Record<FeatureKey, boolean>>;
    const pipelineAgentFromFeatures =
      typeof parsedFeatures === "object" && parsedFeatures
        ? (parsedFeatures as Record<string, unknown>)[PIPELINE_AGENT_FEATURE_KEY]
        : undefined;

    return {
      displayName: parsed.displayName || defaultCrmSettings.displayName,
      companyName: parsed.companyName || defaultCrmSettings.companyName,
      locale:
        parsed.locale === "pt-BR" || parsed.locale === "en-US" || parsed.locale === "es-ES"
          ? parsed.locale
          : defaultCrmSettings.locale,
      timeZone:
        parsed.timeZone === "system" ||
        parsed.timeZone === "America/Sao_Paulo" ||
        parsed.timeZone === "America/New_York" ||
        parsed.timeZone === "UTC"
          ? parsed.timeZone
          : defaultCrmSettings.timeZone,
      use24HourClock:
        typeof parsed.use24HourClock === "boolean" ? parsed.use24HourClock : defaultCrmSettings.use24HourClock,
      features: {
        ...defaultCrmSettings.features,
        ...featureRecord
      },
      pipelineAgent: parsePipelineAgentSettings(
        parsed.pipelineAgent ?? pipelineAgentFromFeatures ?? defaultCrmSettings.pipelineAgent
      )
    };
  } catch {
    return defaultCrmSettings;
  }
}

function saveLocalSettings(settings: CrmSettings, notify = true) {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(settings);
  const current = window.localStorage.getItem(LOCAL_SETTINGS_KEY);

  if (current === serialized) {
    return;
  }

  window.localStorage.setItem(LOCAL_SETTINGS_KEY, serialized);

  if (notify) {
    notifyCrmSettingsChanged();
  }
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
        .select("organization_id")
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
        // O fallback local continua abaixo se o bootstrap nao responder.
      }

      profile = await fetchProfile();
    }

    if (!profile?.organization_id) {
      return null;
    }

    return {
      userId,
      organizationId: profile.organization_id
    };
  })();

  currentUserContextCache = {
    expiresAt: Date.now() + USER_CONTEXT_CACHE_TTL_MS,
    promise
  };

  return promise;
}

export function notifyCrmSettingsChanged() {
  if (typeof window === "undefined") {
    return;
  }

  currentSettingsCache = null;
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

export function subscribeCrmSettingsChanged(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => {
    currentSettingsCache = null;
    callback();
  };

  window.addEventListener(SETTINGS_CHANGED_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(SETTINGS_CHANGED_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

export function peekCrmSettings(): CrmSettings {
  return getLocalSettings();
}

export async function getCrmSettings(): Promise<CrmSettings> {
  if (currentSettingsCache && currentSettingsCache.expiresAt > Date.now()) {
    return currentSettingsCache.promise;
  }

  const promise = (async () => {
    const local = getLocalSettings();
    const context = await getCurrentUserContext();

    if (!context) {
      return local;
    }

    const { data, error } = await supabase
      .from("app_settings")
      .select("display_name, company_name, locale, time_zone, use_24_hour_clock, features")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !data) {
      return local;
    }

    const next = {
      displayName: data.display_name || local.displayName,
      companyName: data.company_name || local.companyName,
      locale:
        data.locale === "pt-BR" || data.locale === "en-US" || data.locale === "es-ES" ? data.locale : local.locale,
      timeZone:
        data.time_zone === "system" ||
        data.time_zone === "America/Sao_Paulo" ||
        data.time_zone === "America/New_York" ||
        data.time_zone === "UTC"
          ? data.time_zone
          : local.timeZone,
      use24HourClock: typeof data.use_24_hour_clock === "boolean" ? data.use_24_hour_clock : local.use24HourClock,
      features: {
        ...defaultCrmSettings.features,
        ...(typeof data.features === "object" && data.features
          ? (data.features as Partial<Record<FeatureKey, boolean>>)
          : {}),
        ...local.features
      },
      pipelineAgent: parsePipelineAgentSettings(
        (typeof data.features === "object" && data.features
          ? (data.features as Record<string, unknown>)[PIPELINE_AGENT_FEATURE_KEY]
          : undefined) ?? local.pipelineAgent
      )
    };

    saveLocalSettings(next, false);
    return next;
  })();

  currentSettingsCache = {
    expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
    promise
  };

  promise.catch(() => {
    if (currentSettingsCache?.promise === promise) {
      currentSettingsCache = null;
    }
  });

  return promise;
}

export async function saveCrmSettings(settings: CrmSettings): Promise<CrmSettings> {
  const normalizedSettings: CrmSettings = {
    ...settings,
    pipelineAgent: parsePipelineAgentSettings(settings.pipelineAgent)
  };

  currentSettingsCache = {
    expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
    promise: Promise.resolve(normalizedSettings)
  };
  saveLocalSettings(normalizedSettings, false);
  const context = await getCurrentUserContext();

  if (!context) {
    notifyCrmSettingsChanged();
    return normalizedSettings;
  }

  const featuresPayload: Record<string, unknown> = {
    ...normalizedSettings.features,
    [PIPELINE_AGENT_FEATURE_KEY]: normalizedSettings.pipelineAgent
  };

  const { error } = await supabase.from("app_settings").upsert(
    {
      organization_id: context.organizationId,
      user_id: context.userId,
      display_name: normalizedSettings.displayName,
      company_name: normalizedSettings.companyName,
      locale: normalizedSettings.locale,
      time_zone: normalizedSettings.timeZone,
      use_24_hour_clock: normalizedSettings.use24HourClock,
      features: featuresPayload,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id"
    }
  );

  if (error) {
    currentSettingsCache = null;
    notifyCrmSettingsChanged();
    return normalizedSettings;
  }

  notifyCrmSettingsChanged();
  return normalizedSettings;
}

export async function updateCrmPassword(newPassword: string): Promise<{ ok: boolean; message: string }> {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      ok: false,
      message: "Nao ha uma sessao autenticada. Entre no sistema com um usuario real para trocar a senha."
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    return {
      ok: false,
      message: error.message || "Nao foi possivel atualizar a senha."
    };
  }

  return {
    ok: true,
    message: "Senha atualizada com sucesso no Supabase Auth."
  };
}
