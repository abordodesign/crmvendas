import Link from "next/link";
import type { DashboardMetric, HighlightCard, PipelineColumn } from "@/types/crm";

type DashboardShellProps = {
  highlights: HighlightCard[];
  metrics: DashboardMetric[];
  pipeline: PipelineColumn[];
};

const navItems = ["Solucoes", "Precos", "Clientes", "Parcerias", "Conhecimento"];

const proofItems = [
  {
    score: "4,7 de 5",
    copy: "Media de avaliacoes de equipes comerciais em plataformas de software."
  },
  {
    score: "4,8 de 5",
    copy: "Excelente aderencia para prospeccao, negociacao e acompanhamento."
  }
];

const brandItems = ["Google Maps", "B2B Stack", "Capterra", "App Store", "Google Play"];

const quickFilters = ["Buscar no funil", "Filtros", "Ordenar"];

const agendaPreview = [
  {
    time: "09:00",
    title: "Ligacao com Atlas Logistica",
    detail: "Validar escopo e proximo passo"
  },
  {
    time: "11:30",
    title: "Enviar proposta revisada",
    detail: "Grupo Horizonte"
  },
  {
    time: "16:00",
    title: "Revisao de forecast",
    detail: "Fechamentos da semana"
  }
];

const summaryCards = [
  { label: "Negocios ativos", value: "20" },
  { label: "Tarefas hoje", value: "15" },
  { label: "Conversao", value: "31%" }
];

export function DashboardShell({
  highlights,
  metrics,
  pipeline
}: DashboardShellProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(79, 70, 229, 0.08), transparent 24%), radial-gradient(circle at 82% 12%, rgba(20, 184, 166, 0.08), transparent 22%), radial-gradient(circle at 50% 100%, rgba(148, 163, 184, 0.08), transparent 30%), linear-gradient(180deg, var(--background) 0%, var(--background-soft) 100%)"
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(18px)",
          background: "rgba(248, 250, 252, 0.9)",
          borderBottom: "1px solid var(--line)"
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                fontSize: "2.1rem",
                fontWeight: 900,
                letterSpacing: "-0.065em",
                color: "var(--accent)"
              }}
            >
              crmvendas
            </Link>
            <nav style={{ display: "flex", gap: 24, flexWrap: "wrap", color: "var(--muted)" }}>
              {navItems.map((item) => (
                <span key={item} style={{ fontWeight: 500 }}>
                  {item}
                </span>
              ))}
            </nav>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href="/dashboard"
              style={{
                fontWeight: 700,
                color: "var(--foreground)"
              }}
            >
              Ver dashboard
            </Link>
            <Link href="/login" style={{ fontWeight: 700, color: "var(--foreground)" }}>
              Fazer login
            </Link>
            <Link
              href="/login"
              style={{
                padding: "14px 20px",
                borderRadius: 16,
                background: "#ffffff",
                border: "1px solid rgba(79, 70, 229, 0.18)",
                color: "var(--accent)",
                fontWeight: 800,
                boxShadow: "0 10px 24px rgba(79, 70, 229, 0.08)"
              }}
            >
              Criar conta gratis
            </Link>
          </div>
        </div>
      </header>

      <section style={{ padding: "56px 24px 28px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ maxWidth: 980, margin: "0 auto", textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderRadius: 999,
                background: "#ffffff",
                border: "1px solid var(--line)",
                color: "var(--secondary)",
                fontSize: 13,
                fontWeight: 800
              }}
            >
              CRM para operacao comercial previsivel
            </div>

            <h1
              style={{
                margin: "24px 0 0",
                fontSize: "clamp(3.2rem, 7vw, 6.3rem)",
                lineHeight: 0.94,
                letterSpacing: "-0.065em",
                fontWeight: 900
              }}
            >
              Plataforma de CRM feita para
              <span
                style={{
                  display: "inline-block",
                  margin: "0 10px",
                  padding: "0 10px 6px",
                  background:
                    "linear-gradient(180deg, transparent 58%, rgba(20, 184, 166, 0.28) 58%)"
                }}
              >
                potencializar
              </span>
              vendas consultivas.
            </h1>

            <p
              style={{
                margin: "24px auto 0",
                maxWidth: 760,
                color: "var(--muted)",
                fontSize: "1.16rem",
                lineHeight: 1.8
              }}
            >
              Ganhe visibilidade e praticidade em todo o processo comercial, do primeiro
              contato ao fechamento, com funil visual, tarefas automaticas e indicadores
              confiaveis.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                maxWidth: 760,
                margin: "34px auto 0"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 18px",
                  minHeight: 60,
                  borderRadius: 18,
                  background: "#ffffff",
                  border: "1px solid var(--line)",
                  color: "var(--muted)",
                  textAlign: "left",
                  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.04)"
                }}
              >
                Digite seu e-mail
              </div>
              <Link
                href="/dashboard"
                style={{
                  display: "grid",
                  placeItems: "center",
                  minHeight: 60,
                  borderRadius: 18,
                  background: "#ffffff",
                  color: "var(--accent)",
                  fontWeight: 800,
                  border: "1px solid rgba(79, 70, 229, 0.14)"
                }}
              >
                Ver demonstracao
              </Link>
              <Link
                href="/login"
                style={{
                  display: "grid",
                  placeItems: "center",
                  minHeight: 60,
                  borderRadius: 18,
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
                  color: "#ffffff",
                  fontWeight: 800,
                  boxShadow: "0 18px 34px rgba(79, 70, 229, 0.22)"
                }}
              >
                Criar conta gratis
              </Link>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "center",
                gap: 18,
                flexWrap: "wrap",
                color: "var(--muted)",
                fontSize: 14
              }}
            >
              <span>Acesso imediato</span>
              <span>Sem cartao de credito</span>
              <span>Estrutura pronta para evolucao SaaS</span>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "18px 24px 36px" }}>
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18
          }}
        >
          {proofItems.map((item) => (
            <div
              key={item.score}
              style={{
                padding: 22,
                borderRadius: 24,
                background: "rgba(255,255,255,0.8)",
                border: "1px solid var(--line)"
              }}
            >
              <div style={{ color: "#f59e0b", fontSize: 14, fontWeight: 800 }}>5 estrelas</div>
              <div style={{ marginTop: 8, fontWeight: 800, fontSize: "1.1rem" }}>{item.score}</div>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>{item.copy}</p>
            </div>
          ))}
        </div>

        <div
          style={{
            maxWidth: 980,
            margin: "24px auto 0",
            display: "flex",
            justifyContent: "center",
            gap: 24,
            flexWrap: "wrap",
            color: "var(--muted)",
            fontWeight: 700
          }}
        >
          {brandItems.map((brand) => (
            <span key={brand}>{brand}</span>
          ))}
        </div>
      </section>

      <section style={{ padding: "0 24px 72px" }}>
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: 28,
            borderRadius: 36,
            background: "linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%)",
            border: "1px solid rgba(79, 70, 229, 0.08)"
          }}
        >
          <div
            style={{
              padding: 18,
              borderRadius: 28,
              background: "rgba(255,255,255,0.84)",
              border: "1px solid rgba(15, 23, 42, 0.06)",
              boxShadow: "var(--shadow)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
                padding: "14px 18px",
                borderRadius: 22,
                background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
                color: "#ffffff",
              marginBottom: 18
            }}
          >
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800 }}>Inicio</span>
                <span>Tarefas</span>
                <span>Empresas</span>
                <span>Pessoas</span>
                <span>Negocios</span>
                <span>Relatorios</span>
              </div>
              <div
                style={{
                  minWidth: 240,
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.72)"
                }}
              >
                Buscar
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "180px minmax(0, 1fr)",
                gap: 16
              }}
            >
              <aside
                style={{
                  padding: 14,
                  borderRadius: 22,
                  background: "#ffffff",
                  border: "1px solid rgba(15, 23, 42, 0.06)"
                }}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  {["SPO", "VOL", "VEN", "CFG"].map((item, index) => (
                    <div
                      key={item}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 16,
                        background: index === 2 ? "rgba(79, 70, 229, 0.1)" : "var(--surface-elevated)",
                        color: index === 2 ? "var(--accent)" : "var(--muted)",
                        fontWeight: 800,
                        textAlign: "center"
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </aside>

              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 12,
                    marginBottom: 14
                  }}
                >
                  {summaryCards.map((card) => (
                    <div
                      key={card.label}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 18,
                        background: "#ffffff",
                        border: "1px solid rgba(15, 23, 42, 0.06)"
                      }}
                    >
                      <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>
                        {card.label}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: "1.5rem",
                          fontWeight: 900,
                          letterSpacing: "-0.04em"
                        }}
                      >
                        {card.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 14,
                    flexWrap: "wrap",
                    marginBottom: 14
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "inline-flex",
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: "rgba(79, 70, 229, 0.08)",
                        color: "var(--accent)",
                        fontSize: 12,
                        fontWeight: 800
                      }}
                    >
                      Funil de vendas
                    </div>
                    <div style={{ marginTop: 8, fontSize: "1.7rem", fontWeight: 900, letterSpacing: "-0.04em" }}>
                      R$ 88.620,00
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap"
                    }}
                  >
                    {quickFilters.map((filter, index) => (
                      <div
                        key={filter}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 14,
                          background: index === 0 ? "#ffffff" : "var(--surface-elevated)",
                          color: "var(--muted)",
                          fontWeight: 600,
                          border: "1px solid rgba(15, 23, 42, 0.05)"
                        }}
                      >
                        {filter}
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 14
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 14
                    }}
                  >
                    {pipeline.map((column) => (
                      <article
                        key={column.id}
                        style={{
                          padding: 16,
                          borderRadius: 22,
                          background: "#ffffff",
                          border: "1px solid rgba(15, 23, 42, 0.06)"
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 12
                          }}
                        >
                          <div>
                            <strong style={{ color: "var(--accent-strong)" }}>{column.name}</strong>
                            <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>
                              {column.opportunities.length} negocios nesta etapa
                            </div>
                          </div>
                          <span
                            style={{
                              padding: "5px 9px",
                              borderRadius: 999,
                              background: "rgba(79, 70, 229, 0.08)",
                              color: "#4338ca",
                              fontSize: 12,
                              fontWeight: 800
                            }}
                          >
                            {column.opportunities.length}
                          </span>
                        </div>

                        <div style={{ display: "grid", gap: 10 }}>
                          {column.opportunities.map((opportunity, index) => (
                            <div
                              key={opportunity.id}
                              style={{
                                padding: 14,
                                borderRadius: 18,
                                background: "var(--surface-elevated)",
                                border: "1px solid rgba(15, 23, 42, 0.06)"
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  alignItems: "flex-start"
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 800 }}>{opportunity.title}</div>
                                  <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 14 }}>
                                    {opportunity.company}
                                  </div>
                                </div>
                                <span
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 999,
                                    background: index % 2 === 0 ? "var(--secondary)" : "var(--accent)",
                                    flexShrink: 0,
                                    marginTop: 4
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  marginTop: 10,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 8,
                                  flexWrap: "wrap"
                                }}
                              >
                                <div
                                  style={{
                                    display: "inline-flex",
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    background: "rgba(20, 184, 166, 0.12)",
                                    color: "#0f766e",
                                    fontSize: 12,
                                    fontWeight: 800
                                  }}
                                >
                                  {opportunity.valueLabel}
                                </div>
                                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>
                                  Follow-up hoje
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>

                  <aside
                    style={{
                      padding: 16,
                      borderRadius: 22,
                      background: "#ffffff",
                      border: "1px solid rgba(15, 23, 42, 0.06)",
                      display: "grid",
                      gap: 16,
                      alignContent: "start"
                    }}
                  >
                    <div>
                      <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 800 }}>
                        Agenda do dia
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: "1.2rem",
                          fontWeight: 900,
                          letterSpacing: "-0.03em"
                        }}
                      >
                        Tarefas prioritarias
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 12 }}>
                      {agendaPreview.map((item) => (
                        <div
                          key={item.time + item.title}
                          style={{
                            padding: 14,
                            borderRadius: 18,
                            background: "var(--surface-elevated)",
                            border: "1px solid rgba(15, 23, 42, 0.05)"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              alignItems: "center"
                            }}
                          >
                            <strong style={{ fontSize: 13 }}>{item.time}</strong>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: "rgba(79, 70, 229, 0.08)",
                                color: "var(--accent)",
                                fontSize: 11,
                                fontWeight: 800
                              }}
                            >
                              Hoje
                            </span>
                          </div>
                          <div style={{ marginTop: 8, fontWeight: 700, lineHeight: 1.4 }}>
                            {item.title}
                          </div>
                          <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                            {item.detail}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        padding: 14,
                        borderRadius: 18,
                        background: "rgba(79, 70, 229, 0.06)",
                        border: "1px solid rgba(79, 70, 229, 0.08)"
                      }}
                    >
                      <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 800 }}>
                        Proxima acao
                      </div>
                      <div style={{ marginTop: 6, fontWeight: 800 }}>Automacao de follow-up</div>
                      <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                        Lembretes e tarefas disparados por etapa do funil.
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 24px 88px" }}>
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18
          }}
        >
          {metrics.map((metric) => (
            <article
              key={metric.label}
              style={{
                padding: 26,
                borderRadius: 28,
                background: "#ffffff",
                border: "1px solid var(--line)",
                boxShadow: "0 16px 34px rgba(15, 23, 42, 0.05)"
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: 14 }}>{metric.label}</div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: "2.25rem",
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: "-0.05em"
                }}
              >
                {metric.value}
              </div>
              <div style={{ marginTop: 8, color: "var(--accent)", fontWeight: 800, fontSize: 14 }}>
                {metric.change}
              </div>
            </article>
          ))}

          {highlights.map((item) => (
            <article
              key={item.title}
              style={{
                padding: 26,
                borderRadius: 28,
                background: "#ffffff",
                border: "1px solid var(--line)"
              }}
            >
              <div style={{ color: "var(--secondary)", fontSize: 13, fontWeight: 800 }}>
                {item.eyebrow}
              </div>
              <h2 style={{ margin: "12px 0 8px", fontSize: "1.24rem", letterSpacing: "-0.03em" }}>
                {item.title}
              </h2>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.75 }}>
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
