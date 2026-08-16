"use client";

import { useState, useTransition } from "react";
import { CrmShell } from "@/components/crm-shell";

type ProspectingFreeItem = {
  id: string;
  name: string;
  address: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  osmUrl: string;
};

type ProspectingFreeResponse = {
  items: ProspectingFreeItem[];
};

export function ProspectingFreeScreen() {
  const [term, setTerm] = useState("");
  const [region, setRegion] = useState("Jaragua do Sul SC");
  const [limit, setLimit] = useState("10");
  const [results, setResults] = useState<ProspectingFreeItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGoogleMapsSearch() {
    if (!term.trim()) {
      setErrorMessage("Informe o que deseja buscar antes de abrir o Google Maps.");
      return;
    }

    setErrorMessage(null);
    window.open(buildGoogleMapsSearchUrl([term.trim(), region.trim()].filter(Boolean).join(" em ")), "_blank", "noopener,noreferrer");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!term.trim()) {
      setErrorMessage("Informe o que deseja buscar, por exemplo: lojas de tinta.");
      return;
    }

    setErrorMessage(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/prospecting/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: term.trim(),
            region: region.trim(),
            limit: Number(limit)
          })
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          setResults([]);
          setErrorMessage(payload.error ?? "Nao foi possivel consultar empresas agora.");
          return;
        }

        const payload = (await response.json()) as ProspectingFreeResponse;
        setResults(payload.items);
      })();
    });
  }

  return (
    <CrmShell
      activePath="/dashboard/prospecting-free"
      title="Prospeccao gratis"
      subtitle="Pesquisa gratuita no OpenStreetMap com acesso complementar ao Google Maps."
      primaryAction="Buscar empresas"
    >
      <section style={cardStyle}>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div style={filterGridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Termo de busca</span>
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Ex: material de construcao"
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Regiao</span>
              <input
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                placeholder="Ex: Joinville SC"
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Quantidade</span>
              <select value={limit} onChange={(event) => setLimit(event.target.value)} style={inputStyle}>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={hintStyle}>
              Busca automática pelo OpenStreetMap e consulta manual gratuita no Google Maps, sem chave de API.
            </div>
            <div style={actionRowStyle}>
              <button type="button" onClick={handleGoogleMapsSearch} style={googleMapsButtonStyle}>
                Buscar tambem no Google Maps
              </button>
              <button type="submit" disabled={isPending} style={buttonStyle}>
                {isPending ? "Consultando..." : "Pesquisar no OpenStreetMap"}
              </button>
            </div>
          </div>
          {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}
        </form>
      </section>

      <section style={googleMapsInfoStyle}>
        <div style={{ fontWeight: 900 }}>Google Maps gratuito</div>
        <div style={googleMapsInfoTextStyle}>
          A busca abre diretamente no Google Maps. Os resultados do Google nao sao importados automaticamente para o CRM.
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>Resultados da prospeccao</div>
          <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 700 }}>{results.length} empresas</div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {results.map((item) => (
            <article key={item.id} style={resultItemStyle}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900 }}>{item.name}</div>
                <div style={metaStyle}>{item.address || "-"}</div>
              </div>
              <div style={resultGridStyle}>
                <ResultCell label="Categoria" value={item.category || "-"} />
                <ResultCell label="Latitude" value={item.latitude !== null ? item.latitude.toFixed(6) : "-"} />
                <ResultCell label="Longitude" value={item.longitude !== null ? item.longitude.toFixed(6) : "-"} />
                <ResultCell label="OpenStreetMap" value="Abrir registro" href={item.osmUrl} />
                <ResultCell
                  label="Google Maps"
                  value="Localizar no Maps"
                  href={buildGoogleMapsSearchUrl([item.name, item.address].filter(Boolean).join(", "))}
                />
              </div>
            </article>
          ))}

          {!results.length ? (
            <div style={emptyStyle}>Nenhum resultado ainda. Preencha os filtros e clique em pesquisar.</div>
          ) : null}
        </div>

        <div style={attributionStyle}>
          Dados da busca automatica: ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={linkStyle}>
            colaboradores do OpenStreetMap
          </a>{" "}
          (ODbL).
        </div>
      </section>
    </CrmShell>
  );
}

function buildGoogleMapsSearchUrl(query: string) {
  const params = new URLSearchParams({
    api: "1",
    query: query.trim()
  });

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function ResultCell({
  label,
  value,
  href
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 700, overflowWrap: "anywhere" }}>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" style={linkStyle}>
            {value}
          </a>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid var(--line)"
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6
};

const labelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const inputStyle: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "9px 12px",
  outline: "none",
  font: "inherit",
  background: "#ffffff",
  width: "100%",
  boxSizing: "border-box"
};

const buttonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: 0,
  padding: "10px 14px",
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap"
};

const googleMapsButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#ffffff",
  color: "var(--accent)",
  border: "1px solid rgba(79, 70, 229, 0.22)"
};

const googleMapsInfoStyle: React.CSSProperties = {
  padding: "16px 18px",
  borderRadius: 20,
  background: "linear-gradient(135deg, rgba(79, 70, 229, 0.06), rgba(20, 184, 166, 0.08))",
  border: "1px solid rgba(79, 70, 229, 0.12)"
};

const googleMapsInfoTextStyle: React.CSSProperties = {
  marginTop: 6,
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5
};

const hintStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 13
};

const errorStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(220, 38, 38, 0.2)",
  background: "rgba(220, 38, 38, 0.08)",
  color: "#b91c1c",
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 700
};

const resultItemStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)",
  display: "grid",
  gap: 12
};

const resultGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10
};

const metaStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.4
};

const emptyStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px dashed var(--line)",
  color: "var(--muted)",
  fontSize: 13
};

const attributionStyle: React.CSSProperties = {
  marginTop: 14,
  color: "var(--muted)",
  fontSize: 11,
  lineHeight: 1.5
};

const linkStyle: React.CSSProperties = {
  color: "var(--accent)",
  textDecoration: "none"
};
