import Link from "next/link";
import { RegisterForm } from "@/components/register-form";

const valueItems = [
  "Cria o usuario diretamente no Supabase Auth.",
  "Inicializa organizacao, perfil e configuracoes do CRM.",
  "Entrega o funil padrao pronto para comecar a operar."
];

export default async function RegisterPage({
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
          <Link href="/login" style={{ color: "var(--muted)", fontWeight: 700 }}>
            Ja tenho conta
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
              Cadastro no Supabase
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
              Ative seu CRM em poucos minutos.
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
              Este fluxo cria a conta, prepara a organizacao inicial e deixa o ambiente pronto para
              cadastrar clientes, tarefas e oportunidades.
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
          </div>

          <RegisterForm nextPath={nextPath} />
        </section>
      </div>
    </main>
  );
}
