"use client";

import { supabase } from "@/lib/supabase";

export type FeatureKey =
  | "notifications_center"
  | "browser_notifications"
  | "agenda_module"
  | "task_reminders"
  | "pipeline_drag_drop"
  | "history_module";

export type CrmSettings = {
  displayName: string;
  companyName: string;
  features: Record<FeatureKey, boolean>;
};

const LOCAL_SETTINGS_KEY = "crm_system_settings";
const SETTINGS_CHANGED_EVENT = "crm:settings-changed";

export const defaultCrmSettings: CrmSettings = {
  displayName: "Administrador CRM",
  companyName: "CRM comercial",
  features: {
    notifications_center: true,
    browser_notifications: true,
    agenda_module: true,
    task_reminders: true,
    pipeline_drag_drop: true,
    history_module: true
  }
};

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

    return {
      displayName: parsed.displayName || defaultCrmSettings.displayName,
      companyName: parsed.companyName || defaultCrmSettings.companyName,
      features: {
        ...defaultCrmSettings.features,
        ...(parsed.features || {})
      }
    };
  } catch {
    return defaultCrmSettings;
  }
}

function saveLocalSettings(settings: CrmSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  notifyCrmSettingsChanged();
}

async function getCurrentUserContext() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.organization_id) {
    return null;
  }

  return {
    userId,
    organizationId: profile.organization_id
  };
}

export function notifyCrmSettingsChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

export function subscribeCrmSettingsChanged(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(SETTINGS_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(SETTINGS_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export async function getCrmSettings(): Promise<CrmSettings> {
  const local = getLocalSettings();
  const context = await getCurrentUserContext();

  if (!context) {
    return local;
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("display_name, company_name, features")
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error || !data) {
    return local;
  }

  const next = {
    displayName: data.display_name || local.displayName,
    companyName: data.company_name || local.companyName,
    features: {
      ...defaultCrmSettings.features,
      ...(typeof data.features === "object" && data.features ? (data.features as Partial<Record<FeatureKey, boolean>>) : {}),
      ...local.features
    }
  };

  saveLocalSettings(next);
  return next;
}

export async function saveCrmSettings(settings: CrmSettings): Promise<CrmSettings> {
  saveLocalSettings(settings);
  const context = await getCurrentUserContext();

  if (!context) {
    return settings;
  }

  const { error } = await supabase.from("app_settings").upsert(
    {
      organization_id: context.organizationId,
      user_id: context.userId,
      display_name: settings.displayName,
      company_name: settings.companyName,
      features: settings.features,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id"
    }
  );

  if (error) {
    return settings;
  }

  notifyCrmSettingsChanged();
  return settings;
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
