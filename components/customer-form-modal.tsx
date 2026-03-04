"use client";
import { useEffect, useState } from "react";

type CustomerFormValues = {
  legalName: string;
  tradeName: string;
  segment: string;
  companyContactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  document: string;
};

export function CustomerFormModal({
  open,
  title,
  submitLabel,
  values,
  onChange,
  onClose,
  onSubmit,
  isPending
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  values: CustomerFormValues;
  onChange: (field: keyof CustomerFormValues, value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const [isLookupPending, setIsLookupPending] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLookupFeedback(null);
      setIsLookupPending(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function handleLookupCnpj() {
    const digits = values.document.replace(/\D/g, "");

    if (digits.length !== 14) {
      setLookupFeedback("Informe um CNPJ valido com 14 digitos.");
      return;
    }

    setIsLookupPending(true);
    setLookupFeedback(null);

    try {
      const response = await fetch(`/api/cnpj/${digits}`, {
        method: "GET",
        cache: "no-store"
      });

      const payload = (await response.json()) as Partial<CustomerFormValues> & { error?: string };

      if (!response.ok) {
        setLookupFeedback(payload.error ?? "Nao foi possivel consultar este CNPJ.");
        return;
      }

      const fields: Array<keyof CustomerFormValues> = [
        "document",
        "legalName",
        "tradeName",
        "segment",
        "companyContactName",
        "phone",
        "email",
        "address",
        "city",
        "state",
        "zipCode"
      ];

      fields.forEach((field) => {
        const value = payload[field];

        if (typeof value === "string" && value.trim()) {
          onChange(field, value.trim());
        }
      });

      setLookupFeedback("Dados do CNPJ carregados. Revise antes de salvar.");
    } catch {
      setLookupFeedback("Falha ao consultar CNPJ. Tente novamente.");
    } finally {
      setIsLookupPending(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={badgeStyle}>Cliente</div>
            <h2 style={titleStyle}>{title}</h2>
            <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 14, lineHeight: 1.6, maxWidth: 560 }}>
              Cadastro organizado em blocos para evitar campos apertados.
            </div>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle}>
            Fechar
          </button>
        </div>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
            alignItems: "start"
          }}
        >
          <div style={formPanelStyle}>
            <div style={sectionTitleStyle}>Dados principais</div>
            <div style={fieldGridWideStyle}>
              <Field label="Razao social" value={values.legalName} onChange={(value) => onChange("legalName", value)} required />
              <Field label="Nome fantasia" value={values.tradeName} onChange={(value) => onChange("tradeName", value)} />
              <Field label="Segmento" value={values.segment} onChange={(value) => onChange("segment", value)} />
              <Field
                label="Nome do responsavel da empresa"
                value={values.companyContactName}
                onChange={(value) => onChange("companyContactName", value)}
              />
              <Field label="Telefone" value={values.phone} onChange={(value) => onChange("phone", value)} />
              <Field label="E-mail" value={values.email} onChange={(value) => onChange("email", value)} />
            </div>

            <div style={{ ...sectionTitleStyle, marginTop: 18 }}>Localizacao e documento</div>
            <div style={fieldGridCompactStyle}>
              <Field label="Endereco" value={values.address} onChange={(value) => onChange("address", value)} />
              <Field label="Cidade" value={values.city} onChange={(value) => onChange("city", value)} />
              <Field label="Estado" value={values.state} onChange={(value) => onChange("state", value)} placeholder="SP" />
              <Field label="CEP" value={values.zipCode} onChange={(value) => onChange("zipCode", value)} />
              <label style={{ display: "grid", gap: 8, minWidth: 0, width: "100%" }}>
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }}
                >
                  CNPJ ou CPF
                </span>
                <div style={documentRowStyle}>
                  <input
                    value={values.document}
                    onChange={(event) => onChange("document", event.target.value)}
                    placeholder="00.000.000/0000-00"
                    style={inputStyle}
                  />
                  <button type="button" onClick={handleLookupCnpj} disabled={isLookupPending} style={lookupButtonStyle}>
                    {isLookupPending ? "Buscando..." : "Buscar CNPJ"}
                  </button>
                </div>
              </label>
            </div>
            {lookupFeedback ? <div style={lookupFeedbackStyle}>{lookupFeedback}</div> : null}
          </div>

          <div style={sidePanelStyle}>
            <div style={summaryCardStyle}>
              <div style={sectionTitleStyle}>Resumo do cadastro</div>
              <div style={summaryBoxStyle}>
                <ModalStat label="Nome fantasia" value={values.tradeName || "Nao informado"} />
                <ModalStat label="Responsavel da empresa" value={values.companyContactName || "Nao informado"} />
                <ModalStat label="Documento" value={values.document || "Nao informado"} />
                <ModalStat label="Cidade/Estado" value={[values.city, values.state].filter(Boolean).join(" / ") || "Nao informado"} />
              </div>
            </div>

            <div style={highlightCardStyle}>
              <div style={sectionTitleStyle}>Validacao visual</div>
              <div style={{ marginTop: 8, fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.04em" }}>
                {values.legalName ? "Completo" : "Pendente"}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55 }}>
                Preencha a razao social e os dados principais para manter o cadastro consistente.
              </div>
            </div>
          </div>
        </div>

        <div style={footerStyle}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || !values.legalName.trim()}
            style={primaryButtonStyle}
          >
            {isPending ? "Salvando..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 8, minWidth: 0, width: "100%" }}>
      <span
        style={{
          color: "var(--muted)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase"
        }}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
  );
}

function ModalStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          color: "var(--muted)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase"
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1.5,
          overflowWrap: "anywhere"
        }}
      >
        {value}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: "rgba(15, 23, 42, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20
};

const modalStyle: React.CSSProperties = {
  width: "min(1260px, calc(100vw - 24px))",
  maxHeight: "min(90vh, 980px)",
  overflowY: "auto",
  overflowX: "hidden",
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.16)",
  padding: 24
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  flexWrap: "wrap"
};

const footerStyle: React.CSSProperties = {
  position: "sticky",
  bottom: -24,
  marginTop: 20,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  flexWrap: "wrap",
  paddingTop: 18,
  paddingBottom: 6,
  background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 24%)",
  borderTop: "1px solid rgba(15, 23, 42, 0.06)"
};

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "11px 14px",
  outline: "none",
  font: "inherit",
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box"
};

const closeButtonStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: "12px 16px",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: "12px 16px",
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase"
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "1.75rem",
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: "-0.04em",
  color: "var(--foreground)"
};

const formPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  minWidth: 0,
  overflow: "hidden",
  padding: 18,
  borderRadius: 20,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)"
};

const sidePanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  minWidth: 0
};

const summaryCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "linear-gradient(180deg, rgba(79, 70, 229, 0.06) 0%, rgba(79, 70, 229, 0.02) 100%)",
  border: "1px solid rgba(79, 70, 229, 0.12)"
};

const summaryBoxStyle: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid rgba(79, 70, 229, 0.08)"
};

const highlightCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "rgba(20, 184, 166, 0.08)",
  border: "1px solid rgba(20, 184, 166, 0.16)",
  color: "#0f766e"
};

const sectionTitleStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const fieldGridWideStyle: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  alignItems: "end",
  minWidth: 0
};

const fieldGridCompactStyle: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  alignItems: "end",
  minWidth: 0
};

const documentRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center"
};

const lookupButtonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "#ffffff",
  padding: "0 12px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap"
};

const lookupFeedbackStyle: React.CSSProperties = {
  marginTop: 10,
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 700
};
