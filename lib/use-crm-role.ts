"use client";

import { useEffect, useState } from "react";
import { appRoles, type AppRole } from "@/lib/access-control";
import { getDevAdminSession } from "@/lib/dev-auth";
import { supabase } from "@/lib/supabase";

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      const nextRole = appRoles.includes(profile?.role as AppRole) ? (profile?.role as AppRole) : null;

      setRole(nextRole);
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
