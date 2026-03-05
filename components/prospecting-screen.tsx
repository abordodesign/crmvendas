"use client";

import { useState, useTransition } from "react";
import { CrmShell } from "@/components/crm-shell";

type ProspectingItem = {
  id: string;
  name: string;
  address: string;
  phone: string;
  rating: number | null;
  website: string;
  mapsUrl: string;
  businessStatus: string;
};

type ProspectingResponse = {
  items: ProspectingItem[];
};

export function ProspectingScreen() {
  const [term, setTerm] = useState("");
  const [region, setRegion] = useState("Jaragua do Sul SC");
  const [segment, setSegment] = useState("");
  const [limit, setLimit] = useState("10");
  const [results, setResults] = useState<ProspectingItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!term.trim()) {
      setErrorMessage("Informe o que deseja buscar, por exemplo: clinica odontologica.");
      return;
    }

    setErrorMessage(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/prospecting/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            term: term.trim(),
            region: region.trim(),
            segment: segment.trim(),
            limit: Number(limit)
          })
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          setResults([]);
          setErrorMessage(payload.error ?? "Nao foi possivel consultar empresas agora.");
          return;
        }

        const payload = (await response.json()) as ProspectingResponse;
        setResults(payload.items);
      })();
    });
  }

  return (
    <CrmShell
      activePath="/dashboard/prospecting"
      title="Prospeccao"
      subtitle="Pesquisa de empresas no Google Maps para gerar novos leads."
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
                placeholder="Ex: lojas de tinta"
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
              <span style={labelStyle}>Tipo (opcional)</span>
              <input
                value={segment}
                onChange={(event) => setSegment(event.target.value)}
                placeholder="Ex: painter"
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
            <div style={hintStyle}>Dica: combine nicho + cidade para ter leads mais qualificados.</div>
            <button type="submit" disabled={isPending} style={buttonStyle}>
              {isPending ? "Consultando..." : "Pesquisar no Google Maps"}
            </button>
          </div>
          {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}
        </form>
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
                <ResultCell label="Telefone" value={item.phone || "-"} />
                <ResultCell label="Nota" value={item.rating ? item.rating.toFixed(1) : "-"} />
                <ResultCell label="Status" value={item.businessStatus || "-"} />
                <ResultCell label="Site" value={item.website ? "Abrir site" : "-"} href={item.website} />
                <ResultCell label="Maps" value={item.mapsUrl ? "Abrir no Maps" : "-"} href={item.mapsUrl} />
              </div>
            </article>
          ))}

          {!results.length ? (
            <div style={emptyStyle}>Nenhum resultado ainda. Preencha os filtros e clique em pesquisar.</div>
          ) : null}
        </div>
      </section>
    </CrmShell>
  );
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

const linkStyle: React.CSSProperties = {
  color: "var(--accent)",
  textDecoration: "none"
};
