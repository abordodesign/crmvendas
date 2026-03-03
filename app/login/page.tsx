import Link from "next/link";
import { LoginForm } from "@/components/login-form";

const valueItems = [
  "Centralize clientes, contatos e oportunidades em um unico lugar.",
  "Automatize tarefas e reduza atrasos de follow-up.",
  "Tenha visibilidade real do funil e da previsao de receita."
];

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = resolvedSearchParams?.next || "/dashboard";

  return (
    <main style={{ minHeight: "100vh", padding: "28px 24px 64px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 34
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: "2.05rem",
              fontWeight: 900,
              letterSpacing: "-0.065em",
              color: "var(--accent)"
            }}
          >
            crmvendas
          </Link>
          <Link href="/" style={{ color: "var(--muted)", fontWeight: 700 }}>
            Voltar para a pagina inicial
          </Link>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24
          }}
        >
          <div
            style={{
              padding: 40,
              borderRadius: 36,
              background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
              border: "1px solid rgba(79, 70, 229, 0.08)",
              boxShadow: "var(--shadow)"
            }}
          >
            <div
              style={{
                display: "inline-flex",
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(79, 70, 229, 0.08)",
                color: "var(--accent)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase"
              }}
            >
              Acesso ao CRM
            </div>

            <h1
              style={{
                margin: "22px 0 0",
                fontSize: "clamp(3rem, 6vw, 5.2rem)",
                lineHeight: 0.94,
                letterSpacing: "-0.06em",
                fontWeight: 900,
                maxWidth: 640
              }}
            >
              Entre para acompanhar vendas com mais clareza.
            </h1>

            <p
              style={{
                margin: "20px 0 0",
                maxWidth: 620,
                color: "var(--muted)",
                fontSize: "1.06rem",
                lineHeight: 1.85
              }}
            >
              O CRM foi desenhado para times que precisam manter ritmo comercial,
              contexto completo do cliente e previsao confiavel em uma rotina simples.
            </p>

            <div style={{ display: "grid", gap: 14, marginTop: 30 }}>
              {valueItems.map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    padding: 18,
                    borderRadius: 22,
                    background: "#ffffff",
                    border: "1px solid var(--line)"
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "var(--secondary)",
                      marginTop: 7,
                      flexShrink: 0
                    }}
                  />
                  <span style={{ lineHeight: 1.7 }}>{item}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 22,
                padding: "18px 20px",
                borderRadius: 22,
                background: "rgba(79, 70, 229, 0.04)",
                border: "1px solid rgba(79, 70, 229, 0.08)"
              }}
            >
              <div style={{ fontWeight: 800 }}>Estrutura pronta para uso interno e escalabilidade</div>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.7 }}>
                Autenticacao com Supabase, perfis separados e base preparada para multi-tenant.
              </p>
              <Link
                href="/dashboard"
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  color: "var(--accent)",
                  fontWeight: 800
                }}
              >
                Ver dashboard demonstrativa
              </Link>
              <Link
                href="/cadastro"
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  marginLeft: 18,
                  color: "var(--secondary)",
                  fontWeight: 800
                }}
              >
                Criar nova conta
              </Link>
            </div>
          </div>

          <LoginForm nextPath={nextPath} />
        </section>
      </div>
    </main>
  );
}
