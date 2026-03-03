"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function formatAuthErrorMessage(message: string | null | undefined) {
  const normalizedMessage = (message ?? "").trim().toLowerCase();

  if (normalizedMessage.includes("email rate limit exceeded")) {
    return "Limite de envio de e-mails atingido no Supabase. Aguarde a janela do rate limit liberar ou aumente o limite em Authentication > Rate Limits.";
  }

  if (normalizedMessage.includes("failed to fetch")) {
    return "Nao foi possivel conectar ao Supabase. Verifique a configuracao das variaveis de ambiente e a conexao de rede.";
  }

  return message || "Nao foi possivel concluir a operacao.";
}

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const submitLockRef = useRef(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resendCooldown]);

  async function handleResendEmail() {
    if (!registeredEmail || resendCooldown > 0 || isResendingEmail) {
      return;
    }

    setError(null);
    setIsResendingEmail(true);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: registeredEmail
    });

    if (resendError) {
      setError(formatAuthErrorMessage(resendError.message));
      setIsResendingEmail(false);
      return;
    }

    setSuccess("E-mail de confirmacao reenviado. Verifique sua caixa de entrada.");
    setResendCooldown(60);
    setIsResendingEmail(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitLockRef.current) {
      return;
    }

    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("A confirmacao da senha nao confere.");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    const normalizedCompanyName = companyName.trim();
    const normalizedFullName = fullName.trim();
    const normalizedDisplayName = displayName.trim() || normalizedFullName;
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: normalizedFullName,
          display_name: normalizedDisplayName,
          company_name: normalizedCompanyName,
          organization_name: normalizedCompanyName,
          role: "admin"
        }
      }
    });

    if (signUpError) {
      setError(formatAuthErrorMessage(signUpError.message));
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }

    setRegisteredEmail(normalizedEmail);

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

      router.push(nextPath);
      router.refresh();
      return;
    }

    setSuccess("Cadastro criado. Se a confirmacao de e-mail estiver ativa, valide sua caixa de entrada para acessar.");
    setResendCooldown(60);
    submitLockRef.current = false;
    setIsSubmitting(false);
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
        Novo acesso
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
        Crie sua conta
      </h2>

      <p style={{ margin: "12px 0 0", color: "var(--muted)", lineHeight: 1.75 }}>
        O cadastro cria o usuario no Supabase Auth e inicializa a organizacao automaticamente.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18, marginTop: 30 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={labelStyle}>Nome completo</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Seu nome"
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={labelStyle}>Nome de exibicao</span>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Como quer aparecer no CRM"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={labelStyle}>Empresa</span>
          <input
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Nome da sua empresa"
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={labelStyle}>E-mail</span>
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
          <span style={labelStyle}>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimo de 6 caracteres"
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={labelStyle}>Confirmar senha</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita a senha"
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

        {success ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(15, 118, 110, 0.08)",
              border: "1px solid rgba(20, 184, 166, 0.16)",
              color: "#0f766e",
              fontSize: 14
            }}
          >
            {success}
          </div>
        ) : null}

        {success && !isSubmitting ? (
          <div style={{ display: "grid", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                void handleResendEmail();
              }}
              disabled={resendCooldown > 0 || isResendingEmail}
              style={{
                ...resendButtonStyle,
                cursor: resendCooldown > 0 || isResendingEmail ? "not-allowed" : "pointer",
                opacity: resendCooldown > 0 ? 0.72 : 1,
                transform: resendCooldown > 0 ? "scale(0.99)" : "scale(1)",
                boxShadow:
                  resendCooldown > 0
                    ? "inset 0 0 0 1px rgba(79, 70, 229, 0.08)"
                    : "0 10px 22px rgba(79, 70, 229, 0.14)"
              }}
            >
              {isResendingEmail
                ? "Reenviando..."
                : resendCooldown > 0
                  ? `Reenviar email disponivel em ${resendCooldown}s`
                  : "Reenviar email agora"}
            </button>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: "rgba(79, 70, 229, 0.08)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${((60 - Math.min(resendCooldown, 60)) / 60) * 100}%`,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
                  transition: "width 0.9s linear"
                }}
              />
            </div>
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
          {isSubmitting ? "Criando conta..." : "Criar conta no CRM"}
        </button>
      </form>
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "var(--muted)"
};

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

const resendButtonStyle: React.CSSProperties = {
  minHeight: 52,
  borderRadius: 16,
  border: "1px solid rgba(79, 70, 229, 0.12)",
  background: "rgba(79, 70, 229, 0.04)",
  color: "var(--accent)",
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 900,
  transition: "all 0.25s ease"
};
