"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function AuthCookieSync() {
  useEffect(() => {
    let isMounted = true;

    async function syncCurrentSession() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session?.access_token) {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            accessToken: session.access_token,
            expiresAt: session.expires_at
          })
        });
        await fetch("/api/auth/bootstrap", {
          method: "POST"
        });
      } else {
        await fetch("/api/auth/session", {
          method: "DELETE"
        });
      }
    }

    void syncCurrentSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            accessToken: session.access_token,
            expiresAt: session.expires_at
          })
        });
        await fetch("/api/auth/bootstrap", {
          method: "POST"
        });
      } else {
        await fetch("/api/auth/session", {
          method: "DELETE"
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
