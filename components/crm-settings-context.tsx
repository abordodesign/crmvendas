"use client";

import { createContext, useContext } from "react";
import type { CrmSettings } from "@/lib/crm-settings";

type CrmSettingsContextValue = {
  settings: CrmSettings;
};

const CrmSettingsContext = createContext<CrmSettingsContextValue | null>(null);

export function CrmSettingsProvider({
  value,
  children
}: {
  value: CrmSettingsContextValue;
  children: React.ReactNode;
}) {
  return <CrmSettingsContext.Provider value={value}>{children}</CrmSettingsContext.Provider>;
}

export function useCrmSettings() {
  const context = useContext(CrmSettingsContext);

  if (!context) {
    throw new Error("useCrmSettings must be used within CrmSettingsProvider");
  }

  return context;
}
