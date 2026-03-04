"use client";

import { useEffect, useState, useTransition } from "react";
import { CustomerFormModal } from "@/components/customer-form-modal";
import { CrmShell, pillStyle } from "@/components/crm-shell";
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from "@/lib/crm-data-source";
import { hasPermission } from "@/lib/access-control";
import { seedCustomers } from "@/lib/crm-seed";
import { useCrmRole } from "@/lib/use-crm-role";
import type { CustomerItem } from "@/types/crm-app";

export function CustomersScreen() {
  const role = useCrmRole();
  const [customers, setCustomers] = useState<CustomerItem[]>(seedCustomers);
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [segment, setSegment] = useState("");
  const [companyContactName, setCompanyContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [document, setDocument] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerPendingDelete, setCustomerPendingDelete] = useState<CustomerItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canManageCustomers = role ? hasPermission(role, "accounts:write") : false;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const nextCustomers = await getCustomers();

      if (isMounted) {
        setCustomers(nextCustomers);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setFocusId(params.get("focus"));
  }, []);

  function handleCreateCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!canManageCustomers) {
      setFeedback("Seu perfil nao pode criar clientes.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const created = await createCustomer({
          legalName,
          tradeName,
          segment,
          companyContactName,
          phone,
          email,
          address,
          city,
          state: stateName,
          zipCode,
          document
        });

        setCustomers((current) => [created, ...current]);
        resetForm();
        setFeedback("Cliente adicionado.");
      })();
    });
  }

  function startEdit(customer: CustomerItem) {
    if (!canManageCustomers) {
      setFeedback("Seu perfil nao pode editar clientes.");
      return;
    }

    setEditingId(customer.id);
    setLegalName(customer.legalName);
    setTradeName(customer.tradeName);
    setSegment(customer.segment);
    setCompanyContactName(customer.companyContactName);
    setPhone(customer.phone);
    setEmail(customer.email);
    setAddress(customer.address);
    setCity(customer.city);
    setStateName(customer.state);
    setZipCode(customer.zipCode);
    setDocument(customer.document);
    setIsModalOpen(true);
    setFeedback(null);
  }

  function resetForm(closeModal = false) {
    setEditingId(null);
    setLegalName("");
    setTradeName("");
    setSegment("");
    setCompanyContactName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setCity("");
    setStateName("");
    setZipCode("");
    setDocument("");
    if (closeModal) {
      setIsModalOpen(false);
    }
  }

  function cancelEdit() {
    resetForm(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (editingId) {
      event.preventDefault();
      setFeedback(null);

      if (!canManageCustomers) {
        setFeedback("Seu perfil nao pode editar clientes.");
        return;
      }

      startTransition(() => {
        void (async () => {
          const updated = await updateCustomer({
            id: editingId,
            legalName,
            tradeName,
            segment,
            companyContactName,
            phone,
            email,
            address,
            city,
            state: stateName,
            zipCode,
            document
          });

          setCustomers((current) =>
            current.map((item) =>
              item.id === editingId
                ? {
                    ...item,
                    ...updated,
                    contacts: item.contacts,
                    owner: item.owner,
                    status: item.status
                  }
                : item
            )
          );
          cancelEdit();
          setFeedback("Cliente atualizado.");
        })();
      });

      return;
    }

    handleCreateCustomer(event);
  }

  function requestDelete(customer: CustomerItem) {
    if (!canManageCustomers) {
      setFeedback("Seu perfil nao pode excluir clientes.");
      return;
    }

    setCustomerPendingDelete(customer);
    setFeedback(null);
  }

  function confirmDelete() {
    if (!customerPendingDelete) {
      return;
    }

    startTransition(() => {
      void (async () => {
        const currentCustomer = customerPendingDelete;
        const success = await deleteCustomer({
          id: currentCustomer.id,
          tradeName: currentCustomer.tradeName
        });

        if (success) {
          setCustomers((current) => current.filter((item) => item.id !== currentCustomer.id));
          setFeedback("Cliente excluido.");
        } else {
          setFeedback("Nao foi possivel excluir o cliente.");
        }

        setCustomerPendingDelete(null);
      })();
    });
  }

  return (
    <CrmShell
      activePath="/dashboard/customers"
      title="Clientes"
      subtitle="Base central de empresas, responsaveis e relacionamento comercial."
      primaryAction="Novo cliente"
    >
      <CustomerFormModal
        open={isModalOpen}
        title={editingId ? "Editar cliente" : "Novo cliente"}
        submitLabel={editingId ? "Salvar alteracoes" : "Salvar cliente"}
        values={{
          legalName,
          tradeName,
          segment,
          companyContactName,
          phone,
          email,
          address,
          city,
          state: stateName,
          zipCode,
          document
        }}
        onChange={(field, value) => {
          const handlers: Record<string, (next: string) => void> = {
            legalName: setLegalName,
            tradeName: setTradeName,
            segment: setSegment,
            companyContactName: setCompanyContactName,
            phone: setPhone,
            email: setEmail,
            address: setAddress,
            city: setCity,
            state: setStateName,
            zipCode: setZipCode,
            document: setDocument
          };

          handlers[field]?.(value);
        }}
        onClose={cancelEdit}
        onSubmit={() =>
          handleSubmit({
            preventDefault() {}
          } as React.FormEvent<HTMLFormElement>)
        }
        isPending={isPending}
      />
      <DeleteCustomerModal
        customer={customerPendingDelete}
        isPending={isPending}
        onClose={() => setCustomerPendingDelete(null)}
        onConfirm={confirmDelete}
      />
      <section
        style={{
          padding: 20,
          borderRadius: 28,
          background: "#ffffff",
          border: "1px solid var(--line)"
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            resetForm();
            setIsModalOpen(true);
          }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div>
            <div style={{ fontWeight: 800 }}>Cadastro em pop-up</div>
            <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 13 }}>
              O formulario foi movido para modal para manter a visualizacao limpa em qualquer tela.
            </div>
          </div>
          <button type="submit" disabled={!canManageCustomers} style={submitButtonStyle}>
            Novo cliente
          </button>
        </form>
        {!canManageCustomers ? <div style={warningStyle}>Seu perfil pode visualizar clientes, mas nao criar ou editar.</div> : null}
        {feedback ? <div style={feedbackStyle}>{feedback}</div> : null}
      </section>

      <section
        style={{
          padding: 20,
          borderRadius: 28,
          background: "#ffffff",
          border: "1px solid var(--line)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={pillStyle}>Buscar cliente</div>
            <div style={pillStyle}>Segmento</div>
            <div style={pillStyle}>Responsavel</div>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 700 }}>
            {customers.length} contas carregadas
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {customers.map((customer) => (
            <article
              key={customer.id}
              style={{
                padding: "16px 18px",
                borderRadius: 20,
                background: "var(--surface-elevated)",
                border:
                  focusId === customer.id ? "1px solid rgba(79, 70, 229, 0.32)" : "1px solid var(--line)",
                boxShadow:
                  focusId === customer.id ? "0 12px 24px rgba(79, 70, 229, 0.12)" : "none"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap"
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: "1.02rem",
                      lineHeight: 1.15,
                      letterSpacing: "-0.03em",
                      overflowWrap: "anywhere"
                    }}
                  >
                    {customer.tradeName}
                  </div>
                  <div
                    style={{
                      marginTop: 5,
                      color: "var(--muted)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      overflowWrap: "anywhere"
                    }}
                  >
                    {customer.legalName}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <WhatsAppButton phone={customer.phone} />
                    <button
                      type="button"
                      onClick={() => startEdit(customer)}
                      disabled={!canManageCustomers}
                      style={editButtonStyle}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete(customer)}
                      disabled={!canManageCustomers}
                      style={deleteButtonStyle}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "#ffffff",
                  border: "1px solid var(--line)"
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }}
                >
                  Endereco
                </div>
                <div style={{ marginTop: 6, fontWeight: 700, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                  {[customer.address, customer.city, customer.state].filter(Boolean).join(" - ") || "-"}
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 14
                }}
              >
                <DataCell label="Segmento" value={customer.segment} />
                <DataCell label="Responsavel da empresa" value={customer.companyContactName || "-"} />
                <DataCell label="Telefone" value={customer.phone || "-"} />
                <DataCell label="E-mail" value={customer.email || "-"} />
                <DataCell label="Documento" value={customer.document || "-"} />
                <DataCell label="Cidade" value={customer.city || "-"} />
                <DataCell label="Estado" value={customer.state || "-"} />
                <DataCell label="CEP" value={customer.zipCode || "-"} />
                <DataCell label="Responsavel interno" value={customer.owner} />
                <DataCell label="Contatos" value={String(customer.contacts)} />
                <DataCell label="Status" value={customer.status} emphasis />
              </div>
            </article>
          ))}
        </div>
      </section>
    </CrmShell>
  );
}

function DeleteCustomerModal({
  customer,
  isPending,
  onClose,
  onConfirm
}: {
  customer: CustomerItem | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!customer) {
    return null;
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={confirmCardStyle} onClick={(event) => event.stopPropagation()}>
        <div style={confirmEyebrowStyle}>Confirmar exclusao</div>
        <h2 style={confirmTitleStyle}>Excluir cliente?</h2>
        <div style={confirmTextStyle}>Confira os dados antes de remover definitivamente este cadastro.</div>
        <div style={confirmDataGridStyle}>
          <DataCell label="Nome fantasia" value={customer.tradeName} />
          <DataCell label="Razao social" value={customer.legalName} />
          <DataCell label="Contato" value={customer.companyContactName || "-"} />
          <DataCell label="Telefone" value={customer.phone || "-"} />
          <DataCell label="E-mail" value={customer.email || "-"} />
          <DataCell label="Documento" value={customer.document || "-"} />
        </div>
        <div style={confirmActionsStyle}>
          <button type="button" onClick={onClose} style={cancelButtonStyle}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending} style={deleteButtonStyle}>
            {isPending ? "Excluindo..." : "Excluir cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildWhatsAppHref(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const normalized = digits.length <= 11 && !digits.startsWith("55") ? `55${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

function WhatsAppButton({ phone }: { phone: string }) {
  const href = buildWhatsAppHref(phone);

  if (!href) {
    return (
      <button type="button" disabled style={disabledWhatsAppButtonStyle}>
        WhatsApp
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" style={whatsAppButtonStyle}>
      WhatsApp
    </a>
  );
}

function DataCell({
  label,
  value,
  emphasis = false
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div style={{ minWidth: 0 }}>
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
          fontWeight: emphasis ? 900 : 700,
          color: emphasis ? "var(--accent)" : "inherit",
          fontSize: emphasis ? 13.5 : 13,
          letterSpacing: emphasis ? "-0.01em" : "0",
          overflowWrap: "anywhere",
          lineHeight: 1.45
        }}
      >
        {value}
      </div>
    </div>
  );
}

const submitButtonStyle: React.CSSProperties = {
  minHeight: 48,
  border: 0,
  borderRadius: 14,
  padding: "12px 14px",
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const feedbackStyle: React.CSSProperties = {
  marginTop: 12,
  color: "var(--secondary)",
  fontSize: 13,
  fontWeight: 700
};

const warningStyle: React.CSSProperties = {
  marginTop: 12,
  color: "#a16207",
  fontSize: 13,
  fontWeight: 700
};

const editButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontWeight: 800,
  cursor: "pointer"
};

const deleteButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(220, 38, 38, 0.1)",
  color: "#b91c1c",
  fontWeight: 800,
  cursor: "pointer"
};

const whatsAppButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(22, 163, 74, 0.12)",
  border: "1px solid rgba(22, 163, 74, 0.2)",
  color: "#15803d",
  fontWeight: 800,
  textDecoration: "none"
};

const disabledWhatsAppButtonStyle: React.CSSProperties = {
  ...whatsAppButtonStyle,
  opacity: 0.45,
  cursor: "not-allowed"
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(15, 23, 42, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20
};

const confirmCardStyle: React.CSSProperties = {
  width: "min(640px, calc(100vw - 24px))",
  borderRadius: 24,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.16)",
  padding: 24
};

const confirmEyebrowStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase"
};

const confirmTitleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: "1.4rem",
  fontWeight: 900,
  letterSpacing: "-0.03em"
};

const confirmTextStyle: React.CSSProperties = {
  marginTop: 10,
  color: "var(--muted)",
  lineHeight: 1.6
};

const confirmDataGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  padding: 16,
  borderRadius: 18,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)"
};

const confirmActionsStyle: React.CSSProperties = {
  marginTop: 18,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  flexWrap: "wrap"
};

const cancelButtonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "10px 12px",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};
