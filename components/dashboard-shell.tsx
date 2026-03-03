import type { DashboardMetric, HighlightCard, PipelineColumn } from "@/types/crm";

type DashboardShellProps = {
  highlights: HighlightCard[];
  metrics: DashboardMetric[];
  pipeline: PipelineColumn[];
};

export function DashboardShell({
  highlights,
  metrics,
  pipeline
}: DashboardShellProps) {
  return (
    <main style={{ padding: "32px 20px 48px" }}>
      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: 28,
          border: "1px solid var(--line)",
          borderRadius: 28,
          background: "var(--surface)",
          boxShadow: "var(--shadow)",
          backdropFilter: "blur(10px)"
        }}
      >
        <header
          style={{
            display: "grid",
            gap: 12,
            marginBottom: 28
          }}
        >
          <span
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--accent)"
            }}
          >
            CRM interno
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(2.4rem, 5vw, 4.6rem)", lineHeight: 1 }}>
            Processo comercial previsivel e orientado por dados
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: "var(--muted)", fontSize: "1.05rem" }}>
            Estrutura inicial focada em visao 360 do cliente, automacoes e pipeline
            visual com base em Next.js e Supabase.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 24
          }}
        >
          {highlights.map((item) => (
            <article
              key={item.title}
              style={{
                padding: 18,
                borderRadius: 22,
                background: "var(--surface-strong)",
                border: "1px solid var(--line)"
              }}
            >
              <div style={{ color: "var(--accent)", fontSize: 13 }}>{item.eyebrow}</div>
              <h2 style={{ margin: "10px 0 8px", fontSize: "1.2rem" }}>{item.title}</h2>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
                {item.description}
              </p>
            </article>
          ))}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20
          }}
        >
          <div
            style={{
              padding: 20,
              borderRadius: 24,
              background: "var(--surface-strong)",
              border: "1px solid var(--line)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Pipeline comercial</h2>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>MVP</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 14
              }}
            >
              {pipeline.map((column) => (
                <article
                  key={column.id}
                  style={{
                    padding: 14,
                    borderRadius: 20,
                    background: "var(--accent-soft)"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 12
                    }}
                  >
                    <strong>{column.name}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>
                      {column.opportunities.length}
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {column.opportunities.map((opportunity) => (
                      <div
                        key={opportunity.id}
                        style={{
                          padding: 12,
                          borderRadius: 18,
                          background: "var(--surface-strong)",
                          border: "1px solid rgba(27, 127, 107, 0.08)"
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{opportunity.company}</div>
                        <div style={{ color: "var(--muted)", fontSize: 13 }}>
                          {opportunity.title}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          {opportunity.valueLabel}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside
            style={{
              display: "grid",
              gap: 16
            }}
          >
            <section
              style={{
                padding: 20,
                borderRadius: 24,
                background: "var(--surface-strong)",
                border: "1px solid var(--line)"
              }}
            >
              <h2 style={{ margin: "0 0 14px", fontSize: "1.1rem" }}>Indicadores</h2>
              <div style={{ display: "grid", gap: 14 }}>
                {metrics.map((metric) => (
                  <div key={metric.label}>
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>{metric.label}</div>
                    <div style={{ fontSize: "1.8rem", lineHeight: 1.1 }}>{metric.value}</div>
                    <div style={{ color: "var(--accent)", fontSize: 13 }}>{metric.change}</div>
                  </div>
                ))}
              </div>
            </section>
            <section
              style={{
                padding: 20,
                borderRadius: 24,
                background: "#1f2937",
                color: "#f9fafb"
              }}
            >
              <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Base tecnica</h2>
              <p style={{ margin: 0, color: "rgba(249, 250, 251, 0.78)", lineHeight: 1.6 }}>
                Next.js orquestra a interface e a camada de aplicacao. Supabase centraliza
                autenticacao, banco PostgreSQL e seguranca com RLS para permitir evolucao
                segura para multi-tenant no futuro.
              </p>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
