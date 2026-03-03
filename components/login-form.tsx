"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isDevAdminCredential, saveDevAdminSession } from "@/lib/dev-auth";
import { supabase } from "@/lib/supabase";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      if (isDevAdminCredential(email, password)) {
        saveDevAdminSession();
        router.push(nextPath);
        router.refresh();
        setIsSubmitting(false);
        return;
      }

      setError("Nao foi possivel entrar. Verifique seus dados e tente novamente.");
      setIsSubmitting(false);
      return;
    }

    if (data.session?.access_token) {
      await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accessToken: data.session.access_token,
          expiresAt: data.session.expires_at
        })
      });
      await fetch("/api/auth/bootstrap", {
        method: "POST"
      });
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <section
      style={{
        padding: 36,
        borderRadius: 36,
        background: "#ffffff",
        border: "1px solid var(--line)",
        boxShadow: "0 20px 42px rgba(15, 23, 42, 0.07)",
        display: "grid",
        alignContent: "center"
      }}
    >
      <div
        style={{
          display: "inline-flex",
          padding: "10px 14px",
          borderRadius: 999,
          background: "var(--accent-soft)",
          color: "var(--accent)",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          width: "fit-content"
        }}
      >
        Login seguro
      </div>

      <h2
        style={{
          margin: "18px 0 0",
          fontSize: "clamp(2.2rem, 4vw, 3.4rem)",
          lineHeight: 0.95,
          letterSpacing: "-0.05em",
          fontWeight: 900
        }}
      >
        Acesse sua conta
      </h2>

      <p style={{ margin: "12px 0 0", color: "var(--muted)", lineHeight: 1.75 }}>
        Entre para visualizar clientes, tarefas, agenda e oportunidades com contexto.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18, marginTop: 30 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite sua senha"
            required
            style={inputStyle}
          />
        </label>

        {error ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(127, 29, 29, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.12)",
              color: "#991b1b",
              fontSize: 14
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            marginTop: 4,
            minHeight: 58,
            border: 0,
            borderRadius: 18,
            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
            color: "#ffffff",
            padding: "16px 18px",
            fontSize: 15,
            fontWeight: 900,
            cursor: isSubmitting ? "wait" : "pointer",
            opacity: isSubmitting ? 0.86 : 1,
            boxShadow: "0 18px 32px rgba(79, 70, 229, 0.18)"
          }}
        >
          {isSubmitting ? "Entrando..." : "Entrar no CRM"}
        </button>
      </form>

      <div
        style={{
          marginTop: 24,
          paddingTop: 18,
          borderTop: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          color: "var(--muted)",
          fontSize: 13
        }}
      >
        <span>Supabase Auth ativo</span>
        <span>Perfis: Admin, Gestor, Comercial</span>
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 18,
  padding: "15px 16px",
  fontSize: 15,
  outline: "none",
  background: "#ffffff",
  color: "var(--foreground)",
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.02)"
};
