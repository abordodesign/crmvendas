"use client";

import { createContext, useContext } from "react";
import type { AppRole } from "@/lib/access-control";

type CrmAuthState = {
  role: AppRole | null;
  fullName: string;
  isLoading: boolean;
};

const CrmAuthContext = createContext<CrmAuthState>({
  role: null,
  fullName: "",
  isLoading: true
});

export function CrmAuthProvider({
  value,
  children
}: {
  value: CrmAuthState;
  children: React.ReactNode;
}) {
  return <CrmAuthContext.Provider value={value}>{children}</CrmAuthContext.Provider>;
}

export function useCrmAuth() {
  return useContext(CrmAuthContext);
}
