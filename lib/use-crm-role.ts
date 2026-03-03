"use client";

import { useEffect, useState } from "react";
import { type AppRole } from "@/lib/access-control";
import { getDevAdminSession } from "@/lib/dev-auth";
import { supabase } from "@/lib/supabase";

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

async function fetchCurrentRole(userId: string) {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

  return normalizeAppRole(profile?.role);
}

export function useCrmRole() {
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRole() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        const devSession = getDevAdminSession();

        if (isMounted) {
          setRole(devSession?.role ?? null);
        }
        return;
      }

      let nextRole = await fetchCurrentRole(session.user.id);

      if (!nextRole) {
        try {
          await fetch("/api/auth/bootstrap", {
            method: "POST",
            cache: "no-store"
          });
        } catch {
          // Se o bootstrap falhar, ainda tentamos honrar o metadata do Auth para nao degradar a UI.
        }

        nextRole = await fetchCurrentRole(session.user.id);
      }

      if (!isMounted) {
        return;
      }

      setRole(nextRole ?? normalizeAppRole(session.user.user_metadata?.role));
    }

    void loadRole();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void loadRole();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return role;
}
