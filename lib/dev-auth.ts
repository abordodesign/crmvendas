"use client";

const DEV_ADMIN_EMAIL = "admin@crm.com.br";
const DEV_ADMIN_PASSWORD = "admin";
const STORAGE_KEY = "crm_dev_auth";

type DevAuthUser = {
  email: string;
  fullName: string;
  role: "admin";
};

export function isDevAdminCredential(email: string, password: string) {
  return email.trim().toLowerCase() === DEV_ADMIN_EMAIL && password === DEV_ADMIN_PASSWORD;
}

export function saveDevAdminSession() {
  if (typeof window === "undefined") {
    return;
  }

  const payload: DevAuthUser = {
    email: DEV_ADMIN_EMAIL,
    fullName: "Administrador CRM",
    role: "admin"
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearDevAdminSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function getDevAdminSession(): DevAuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as DevAuthUser;

    if (parsed?.email === DEV_ADMIN_EMAIL && parsed?.role === "admin") {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}
