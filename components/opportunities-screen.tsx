"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CustomerFormModal } from "@/components/customer-form-modal";
import { CrmShell, pillStyle } from "@/components/crm-shell";
import { hasPermission } from "@/lib/access-control";
import { defaultCrmSettings, getCrmSettings, subscribeCrmSettingsChanged } from "@/lib/crm-settings";
import {
  CONCLUSION_REASON_OPTIONS,
  CONCLUSION_STATUS_OPTIONS,
  DEFAULT_STAGE_OPTIONS,
  createCustomer,
  deleteOpportunity,
  createOpportunity,
  getOpportunities,
  getReferenceOptions,
  isConclusionStage,
  moveOpportunityToStage,
  subscribeCrmDataChanged,
  updateOpportunity
} from "@/lib/crm-data-source";
import { seedOpportunities } from "@/lib/crm-seed";
import { useCrmRole } from "@/lib/use-crm-role";
import type { OpportunityItem } from "@/types/crm-app";

const NEW_ACCOUNT_OPTION = "__new__";
const STAGE_FLOW = ["Prospect", "Qualificado", "Apresentacao", "Proposta", "Negociacao", "Conclusao"];

export function OpportunitiesScreen() {
  const [settings, setSettings] = useState(defaultCrmSettings);
  const role = useCrmRole();
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>(seedOpportunities);
  const [accounts, setAccounts] = useState<Array<{ id: string; label: string; searchText?: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: string; label: string }>>([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [service, setService] = useState("");
  const [accountId, setAccountId] = useState("");
  const [stageId, setStageId] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [amount, setAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [months, setMonths] = useState("1");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [conclusionStatus, setConclusionStatus] = useState("");
  const [conclusionReason, setConclusionReason] = useState("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomerLegalName, setNewCustomerLegalName] = useState("");
  const [newCustomerTradeName, setNewCustomerTradeName] = useState("");
  const [newCustomerSegment, setNewCustomerSegment] = useState("");
  const [newCustomerCompanyContactName, setNewCustomerCompanyContactName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [newCustomerCity, setNewCustomerCity] = useState("");
  const [newCustomerState, setNewCustomerState] = useState("");
  const [newCustomerZipCode, setNewCustomerZipCode] = useState("");
  const [newCustomerDocument, setNewCustomerDocument] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [opportunityPendingDelete, setOpportunityPendingDelete] = useState<OpportunityItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [draggedOpportunityId, setDraggedOpportunityId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [recentlyMovedOpportunityId, setRecentlyMovedOpportunityId] = useState<string | null>(null);
  const isDragDropEnabled = settings.features.pipeline_drag_drop;

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      const next = await getCrmSettings();

      if (isMounted) {
        setSettings(next);
      }
    }

    void loadSettings();
    const unsubscribe = subscribeCrmSettingsChanged(() => {
      void loadSettings();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canCreate = role ? hasPermission(role, "opportunities:write") : true;
  const canEdit = role
    ? hasPermission(role, "records:edit") || hasPermission(role, "opportunities:write")
    : true;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [nextOpportunities, refs] = await Promise.all([getOpportunities(), getReferenceOptions()]);

      if (isMounted) {
        setOpportunities(nextOpportunities);
        setAccounts(refs.accounts);
        setStages(refs.stages);
        setAccountId((current) => current || refs.accounts[0]?.id || "");
        setAccountSearch((current) => current || refs.accounts[0]?.label || "");
        setStageId((current) => current || refs.stages[0]?.id || "");
      }
    }

    void load();
    const unsubscribe = subscribeCrmDataChanged(() => {
      void load();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setFocusId(params.get("focus"));
  }, []);

  const totalAmount = useMemo(
    () => opportunities.reduce((sum, item) => sum + amountToNumber(item.amount), 0),
    [opportunities]
  );
  const calculatedTicket = useMemo(() => {
    const baseAmount = Number(amount || 0);
    const multiplier = isRecurring ? Math.max(1, Number(months || 1)) : 1;
    return baseAmount * multiplier;
  }, [amount, isRecurring, months]);
  const selectedStageLabel = useMemo(
    () => stages.find((item) => item.id === stageId)?.label ?? DEFAULT_STAGE_OPTIONS.find((item) => item.id === stageId)?.label ?? "",
    [stageId, stages]
  );
  const showConclusionFields = isConclusionStage(selectedStageLabel);
  const boardColumns = useMemo(
    () =>
      STAGE_FLOW.map((stageLabel) => {
        const deals = opportunities.filter((item) => item.stage === stageLabel);

        return {
          id: stageLabel,
          name: stageLabel,
          deals,
          total: formatCurrency(deals.reduce((sum, item) => sum + amountToNumber(item.amount), 0))
        };
      }),
    [opportunities]
  );
  useEffect(() => {
    if (showConclusionFields) {
      setConclusionStatus((current) => current || CONCLUSION_STATUS_OPTIONS[0]?.id || "");
      setConclusionReason((current) => current || CONCLUSION_REASON_OPTIONS[0]?.id || "");
      return;
    }

    setConclusionStatus("");
    setConclusionReason("");
  }, [showConclusionFields]);

  useEffect(() => {
    if (!recentlyMovedOpportunityId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRecentlyMovedOpportunityId(null);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [recentlyMovedOpportunityId]);

  function resetForm() {
    setEditingId(null);
    setService("");
    setAmount("");
    setNextStep("");
    setIsRecurring(false);
    setMonths("1");
    setExpectedCloseDate("");
    setConclusionStatus("");
    setConclusionReason("");
    setNewCustomerLegalName("");
    setNewCustomerTradeName("");
    setNewCustomerSegment("");
    setNewCustomerCompanyContactName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerAddress("");
    setNewCustomerCity("");
    setNewCustomerState("");
    setNewCustomerZipCode("");
    setNewCustomerDocument("");
    setAccountSearch("");
    setIsAccountMenuOpen(false);
  }

  function openCreateModal() {
    resetForm();
    setAccountId(accounts[0]?.id ?? "");
    setAccountSearch(accounts[0]?.label ?? "");
    setStageId((current) => current || stages[0]?.id || DEFAULT_STAGE_OPTIONS[0]?.id || "");
    setIsViewMode(false);
    setIsFormModalOpen(true);
    setFeedback(null);
  }

  function resetCustomerDraft() {
    setNewCustomerLegalName("");
    setNewCustomerTradeName("");
    setNewCustomerSegment("");
    setNewCustomerCompanyContactName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerAddress("");
    setNewCustomerCity("");
    setNewCustomerState("");
    setNewCustomerZipCode("");
    setNewCustomerDocument("");
  }

  function handleAccountChange(value: string) {
    if (value === NEW_ACCOUNT_OPTION) {
      setIsAccountMenuOpen(false);
      setIsCustomerModalOpen(true);
      return;
    }

    setAccountId(value);
    setAccountSearch(accounts.find((item) => item.id === value)?.label ?? "");
    setIsAccountMenuOpen(false);
  }

  function handleCreateCustomerFromModal() {
    if (!newCustomerLegalName.trim()) {
      return;
    }

    startTransition(() => {
      void (async () => {
        const createdCustomer = await createCustomer({
          legalName: newCustomerLegalName,
          tradeName: newCustomerTradeName,
          segment: newCustomerSegment,
          companyContactName: newCustomerCompanyContactName,
          phone: newCustomerPhone,
          email: newCustomerEmail,
          address: newCustomerAddress,
          city: newCustomerCity,
          state: newCustomerState,
          zipCode: newCustomerZipCode,
          document: newCustomerDocument
        });

        const label = createdCustomer.tradeName || createdCustomer.legalName;
        setAccounts((current) => [
          ...current.filter((item) => item.id !== createdCustomer.id),
          {
            id: createdCustomer.id,
            label,
            searchText: [createdCustomer.tradeName, createdCustomer.legalName, createdCustomer.email, createdCustomer.document]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
          }
        ]);
        setAccountId(createdCustomer.id);
        setAccountSearch(label);
        setIsCustomerModalOpen(false);
        resetCustomerDraft();
      })();
    });
  }

  function populateOpportunity(opportunity: OpportunityItem) {
    setEditingId(opportunity.id);
    setService(opportunity.title);
    setNextStep(opportunity.nextStep ?? "");
    setAmount(String(amountToNumber(opportunity.baseAmount)));
    setIsRecurring(opportunity.isRecurring);
    setMonths(String(opportunity.months));
    setExpectedCloseDate(toInputDate(opportunity.expectedCloseDate));
    setStageId(
      stages.find((item) => item.label === opportunity.stage)?.id ??
        DEFAULT_STAGE_OPTIONS.find((item) => item.label === opportunity.stage)?.id ??
        ""
    );
    const matchedAccountId = accounts.find((item) => item.label === opportunity.company)?.id ?? "";
    setAccountId(matchedAccountId);
    setAccountSearch(opportunity.company);
    setConclusionStatus(opportunity.conclusionStatus ?? "");
    setConclusionReason(opportunity.conclusionReason ?? "");
  }

  function openView(opportunity: OpportunityItem) {
    populateOpportunity(opportunity);
    setIsViewMode(true);
    setIsFormModalOpen(true);
    setFeedback(null);
  }

  function startEdit(opportunity: OpportunityItem) {
    if (!canEdit) {
      setFeedback("Seu perfil nao pode editar oportunidades.");
      return;
    }

    populateOpportunity(opportunity);
    setIsViewMode(false);
    setIsFormModalOpen(true);
    setFeedback(null);
  }

  function handleSubmit() {
    setFeedback(null);

    if (editingId) {
      if (!canEdit) {
        setFeedback("Seu perfil nao pode editar oportunidades.");
        return;
      }

      const currentRecord = opportunities.find((item) => item.id === editingId);

      if (!currentRecord) {
        resetForm();
        return;
      }

      startTransition(() => {
        void (async () => {
          const nextConclusionDate = showConclusionFields ? new Date().toISOString() : undefined;
          const nextStatus = showConclusionFields ? conclusionStatus || "Conquistado" : "Em andamento";
          const updated = await updateOpportunity({
            id: editingId,
            title: service,
            stageId,
            stageLabel: selectedStageLabel,
            nextStep,
            amount: calculatedTicket,
            baseAmount: Number(amount || 0),
            isRecurring,
            months: isRecurring ? Math.max(1, Number(months || 1)) : 1,
            expectedCloseDate,
            status: nextStatus,
            conclusionStatus: showConclusionFields ? conclusionStatus : undefined,
            conclusionReason: showConclusionFields ? conclusionReason : undefined,
            concludedAt: showConclusionFields ? nextConclusionDate : undefined,
            currentCompany: currentRecord.company,
            currentStage: currentRecord.stage
          });

          setOpportunities((current) =>
            current.map((item) =>
              item.id === editingId
                ? {
                    ...item,
                    ...updated,
                    owner: item.owner
                  }
                : item
            )
          );
          setIsViewMode(false);
          setIsFormModalOpen(false);
          resetForm();
          setFeedback("Oportunidade atualizada.");
        })();
      });

      return;
    }

    if (!canCreate) {
      setFeedback("Seu perfil nao pode criar oportunidades.");
      return;
    }

      startTransition(() => {
        void (async () => {
          const nextAccountId = accountId;
          const nextAccountLabel = accounts.find((item) => item.id === accountId)?.label;
          const selectedAccount = accounts.find((item) => item.id === accountId);
          const selectedStage =
            stages.find((item) => item.id === stageId) ?? DEFAULT_STAGE_OPTIONS.find((item) => item.id === stageId);
          const nextConclusionDate = showConclusionFields ? new Date().toISOString() : undefined;
          const nextStatus = showConclusionFields ? conclusionStatus || "Conquistado" : "Em andamento";
          const normalizedAccountId =
            !nextAccountId || nextAccountId === NEW_ACCOUNT_OPTION || nextAccountId.startsWith("local-customer-")
              ? ""
              : nextAccountId;
          const created = await createOpportunity({
            title: service,
            accountId: normalizedAccountId,
            stageId,
            nextStep,
            amount: calculatedTicket,
            baseAmount: Number(amount || 0),
          isRecurring,
          months: isRecurring ? Math.max(1, Number(months || 1)) : 1,
          expectedCloseDate,
          status: nextStatus,
            conclusionStatus: showConclusionFields ? conclusionStatus : undefined,
            conclusionReason: showConclusionFields ? conclusionReason : undefined,
            concludedAt: showConclusionFields ? nextConclusionDate : undefined,
            accountLabel: nextAccountLabel ?? selectedAccount?.label,
            stageLabel: selectedStage?.label
          });

          setOpportunities((current) => [created, ...current]);
          setIsViewMode(false);
          setIsFormModalOpen(false);
        resetForm();
        setFeedback("Oportunidade adicionada.");
      })();
    });
  }

  function handleStageDrop(targetStage: string) {
    if (!draggedOpportunityId) {
      return;
    }

    const currentOpportunity = opportunities.find((item) => item.id === draggedOpportunityId);
    setDragOverStage(null);
    setDraggedOpportunityId(null);

    if (!currentOpportunity || currentOpportunity.stage === targetStage) {
      return;
    }

    startTransition(() => {
      void (async () => {
        await moveOpportunityToStage({
          opportunityId: currentOpportunity.id,
          targetStage
        });

        setRecentlyMovedOpportunityId(currentOpportunity.id);
        setFeedback(`${currentOpportunity.title} movida para ${targetStage}.`);
      })();
    });
  }

  function requestDelete(opportunity: OpportunityItem) {
    if (!canEdit) {
      setFeedback("Seu perfil nao pode excluir oportunidades.");
      return;
    }

    setOpportunityPendingDelete(opportunity);
    setFeedback(null);
  }

  function confirmDelete() {
    if (!opportunityPendingDelete) {
      return;
    }

    startTransition(() => {
      void (async () => {
        const currentOpportunity = opportunityPendingDelete;
        const success = await deleteOpportunity({
          id: currentOpportunity.id,
          title: currentOpportunity.title
        });

        if (success) {
          setOpportunities((current) => current.filter((item) => item.id !== currentOpportunity.id));
          setFeedback("Oportunidade excluida.");
        } else {
          setFeedback("Nao foi possivel excluir a oportunidade.");
        }

        setOpportunityPendingDelete(null);
      })();
    });
  }

  return (
    <CrmShell
      activePath="/dashboard/opportunities"
      title="Oportunidades"
      subtitle="Gestao visual do funil com valor, fase, responsavel e previsao."
      primaryAction="Nova oportunidade"
    >
      <OpportunityFormModal
        open={isFormModalOpen}
        editing={Boolean(editingId)}
        viewMode={isViewMode}
        service={service}
        onServiceChange={setService}
        nextStep={nextStep}
        onNextStepChange={setNextStep}
        accountSearch={accountSearch}
        onAccountSearchChange={setAccountSearch}
        accountId={accountId}
        onAccountChange={handleAccountChange}
        accounts={accounts}
        accountMenuOpen={isAccountMenuOpen}
        onAccountMenuOpenChange={setIsAccountMenuOpen}
        stageId={stageId}
        onStageChange={setStageId}
        stages={stages}
        amount={amount}
        onAmountChange={setAmount}
        isRecurring={isRecurring}
        onRecurringChange={setIsRecurring}
        months={months}
        onMonthsChange={setMonths}
        expectedCloseDate={expectedCloseDate}
        onExpectedCloseDateChange={setExpectedCloseDate}
        showConclusionFields={showConclusionFields}
        conclusionStatus={conclusionStatus}
        onConclusionStatusChange={setConclusionStatus}
        conclusionReason={conclusionReason}
        onConclusionReasonChange={setConclusionReason}
        calculatedTicket={calculatedTicket}
        onEnableEdit={() => setIsViewMode(false)}
        onClose={() => {
          setIsViewMode(false);
          setIsFormModalOpen(false);
          resetForm();
        }}
        onSubmit={handleSubmit}
        isPending={isPending}
        canSubmit={Boolean(editingId ? canEdit : canCreate) && Boolean(accountId)}
      />
      <CustomerFormModal
        open={isCustomerModalOpen}
        title="Novo cliente para a oportunidade"
        submitLabel="Salvar cliente e usar"
        values={{
          legalName: newCustomerLegalName,
          tradeName: newCustomerTradeName,
          segment: newCustomerSegment,
          companyContactName: newCustomerCompanyContactName,
          phone: newCustomerPhone,
          email: newCustomerEmail,
          address: newCustomerAddress,
          city: newCustomerCity,
          state: newCustomerState,
          zipCode: newCustomerZipCode,
          document: newCustomerDocument
        }}
        onChange={(field, value) => {
          const handlers: Record<string, (next: string) => void> = {
            legalName: setNewCustomerLegalName,
            tradeName: setNewCustomerTradeName,
            segment: setNewCustomerSegment,
            companyContactName: setNewCustomerCompanyContactName,
            phone: setNewCustomerPhone,
            email: setNewCustomerEmail,
            address: setNewCustomerAddress,
            city: setNewCustomerCity,
            state: setNewCustomerState,
            zipCode: setNewCustomerZipCode,
            document: setNewCustomerDocument
          };

          handlers[field]?.(value);
        }}
        onClose={() => {
          setIsCustomerModalOpen(false);
          resetCustomerDraft();
        }}
        onSubmit={handleCreateCustomerFromModal}
        isPending={isPending}
      />
      <DeleteOpportunityModal
        opportunity={opportunityPendingDelete}
        isPending={isPending}
        onClose={() => setOpportunityPendingDelete(null)}
        onConfirm={confirmDelete}
      />
      <section
        style={{
          padding: 18,
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
            gap: 14,
            flexWrap: "wrap"
          }}
        >
          <div>
            <div style={{ fontWeight: 800 }}>Cadastro de oportunidade em modal</div>
            <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 13 }}>
              Edicao e visualizacao em um unico fluxo, com todos os campos organizados.
            </div>
          </div>
          <button type="button" onClick={openCreateModal} disabled={!canCreate} style={submitButtonStyle}>
            Nova oportunidade
          </button>
        </div>
        {!canCreate ? <div style={warningStyle}>Seu perfil pode visualizar, mas nao criar oportunidades.</div> : null}
        {feedback ? <div style={feedbackStyle}>{feedback}</div> : null}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16
        }}
      >
        <MetricCard label="Oportunidades" value={String(opportunities.length)} />
        <MetricCard label="Pipeline" value={formatCurrency(totalAmount)} />
        <MetricCard label="Fechamento mais proximo" value={opportunities[0]?.expectedCloseDate ?? "Sem data"} />
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
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Kanban do funil</h2>
              <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
              {isDragDropEnabled
                ? "Arraste a oportunidade livremente entre as etapas. Cada movimento fica registrado no historico."
                : "O arraste do Kanban foi desativado em Configuracoes. A movimentacao continua disponivel pela edicao da oportunidade."}
              </div>
            </div>
          <div style={pillStyle}>{isDragDropEnabled ? "Drag and drop ativo" : "Drag and drop desativado"}</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14
          }}
        >
          {boardColumns.map((column) => (
            <article
              key={column.id}
              onDragOver={(event) => {
                if (!isDragDropEnabled || !draggedOpportunityId) {
                  return;
                }

                event.preventDefault();
                if (dragOverStage !== column.name) {
                  setDragOverStage(column.name);
                }
              }}
              onDragLeave={() => {
                if (dragOverStage === column.name) {
                  setDragOverStage(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!isDragDropEnabled) {
                  return;
                }
                handleStageDrop(column.name);
              }}
              style={{
                padding: 16,
                borderRadius: 22,
                background: "var(--surface-elevated)",
                border:
                  dragOverStage === column.name ? "1px solid rgba(79, 70, 229, 0.4)" : "1px solid var(--line)",
                boxShadow:
                  dragOverStage === column.name ? "0 0 0 4px rgba(79, 70, 229, 0.08)" : "none",
                minHeight: 208,
                transition: "border-color 120ms ease, box-shadow 120ms ease"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 12
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 900,
                      color: "var(--accent)",
                      letterSpacing: "-0.02em"
                    }}
                  >
                    {column.name}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      color: "var(--muted)",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase"
                    }}
                  >
                    {column.total}
                  </div>
                </div>
                <span
                  style={{
                    padding: "5px 9px",
                    borderRadius: 999,
                    background: "rgba(79, 70, 229, 0.08)",
                    color: "var(--accent)",
                    fontSize: 12,
                    fontWeight: 800
                  }}
                >
                  {column.deals.length}
                </span>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {column.deals.length ? (
                  column.deals.map((opportunity) => (
                    <button
                      key={opportunity.id}
                      type="button"
                      draggable={canEdit && isDragDropEnabled}
                      onDragStart={(event) => {
                        if (!canEdit || !isDragDropEnabled) {
                          return;
                        }

                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", opportunity.id);
                        setDraggedOpportunityId(opportunity.id);
                      }}
                      onDragEnd={() => {
                        setDraggedOpportunityId(null);
                        setDragOverStage(null);
                      }}
                      onClick={() => openView(opportunity)}
                      style={{
                        textAlign: "left",
                        padding: 14,
                        borderRadius: 18,
                        background: "#ffffff",
                        border:
                          recentlyMovedOpportunityId === opportunity.id
                            ? "1px solid rgba(20, 184, 166, 0.34)"
                            : "1px solid rgba(15, 23, 42, 0.06)",
                        cursor: canEdit && isDragDropEnabled ? "grab" : "pointer",
                        opacity: draggedOpportunityId === opportunity.id ? 0.55 : 1,
                        transform:
                          draggedOpportunityId === opportunity.id
                            ? "scale(0.98)"
                            : recentlyMovedOpportunityId === opportunity.id
                              ? "translateY(-2px)"
                              : "none",
                        boxShadow:
                          recentlyMovedOpportunityId === opportunity.id
                            ? "0 10px 22px rgba(20, 184, 166, 0.14)"
                            : "none",
                        transition: "opacity 120ms ease, transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease"
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: "1rem",
                          lineHeight: 1.15,
                          letterSpacing: "-0.03em"
                        }}
                      >
                        {opportunity.title}
                      </div>
                      <div
                        style={{
                          marginTop: 5,
                          color: "var(--muted)",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase"
                        }}
                      >
                        {opportunity.company}
                      </div>
                      <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                        Proximo passo: {opportunity.nextStep ?? "Definir proximo passo"}
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center"
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "rgba(20, 184, 166, 0.12)",
                            color: "#0f766e",
                            fontSize: 11,
                            fontWeight: 800
                          }}
                        >
                          {opportunity.amount}
                        </div>
                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase"
                          }}
                        >
                          Responsavel: {opportunity.owner}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px dashed var(--line)",
                      color: "var(--muted)",
                      fontSize: 13
                    }}
                  >
                    Arraste uma oportunidade para esta etapa.
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
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
              <div style={pillStyle}>Buscar oportunidade</div>
              <div style={pillStyle}>Fase</div>
              <div style={pillStyle}>Responsavel</div>
            </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {opportunities.map((opportunity) => (
            <div key={opportunity.id}>
              <article
                onClick={() => openView(opportunity)}
                style={{
                  display: "grid",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 18,
                  background: "var(--surface-elevated)",
                  border:
                    focusId === opportunity.id ? "1px solid rgba(79, 70, 229, 0.32)" : "1px solid var(--line)",
                  boxShadow:
                    focusId === opportunity.id ? "0 12px 24px rgba(79, 70, 229, 0.12)" : "none",
                  cursor: "pointer"
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
                  <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: "1.02rem",
                        lineHeight: 1.15,
                        letterSpacing: "-0.03em"
                      }}
                    >
                      {opportunity.title}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        color: "var(--muted)",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase"
                      }}
                    >
                      {opportunity.company}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        startEdit(opportunity);
                      }}
                      disabled={!canEdit}
                      style={editButtonStyle}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDelete(opportunity);
                      }}
                      disabled={!canEdit}
                      style={deleteButtonStyle}
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
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
                    Proximo passo
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      lineHeight: 1.5
                    }}
                  >
                    {opportunity.nextStep ?? "-"}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
                    gap: 10
                  }}
                >
                  <CompactCell label="Fase" value={opportunity.stage} emphasis />
                  <CompactCell label="Responsavel" value={opportunity.owner} />
                  <CompactCell label="Base" value={opportunity.baseAmount} />
                  <CompactCell label="Rec." value={opportunity.isRecurring ? "Sim" : "Nao"} />
                  <CompactCell label="Meses" value={String(opportunity.months)} />
                  <CompactCell label="Ticket" value={opportunity.amount} />
                  <CompactCell label="Fecha" value={opportunity.expectedCloseDate} />
                  <CompactCell label="Conclusao" value={opportunity.conclusionStatus ?? opportunity.status} />
                  <CompactCell label="Motivo" value={opportunity.conclusionReason ?? "-"} />
                  <CompactCell label="Data concl." value={opportunity.concludedAt ?? "-"} />
                </div>
              </article>
            </div>
          ))}
        </div>
      </section>
    </CrmShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
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
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        style={inputStyle}
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  disabled = false
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
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
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        style={{
          ...inputStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer"
        }}
      >
        <span>{checked ? "Sim" : "Nao"}</span>
        <span
          style={{
            width: 34,
            height: 20,
            borderRadius: 999,
            background: checked ? "var(--secondary)" : "var(--line)",
            position: "relative",
            display: "inline-block"
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: checked ? 16 : 2,
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#ffffff"
            }}
          />
        </span>
      </button>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string; searchText?: string }>;
  disabled?: boolean;
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
      <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} disabled={disabled}>
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function OpportunityFormModal({
  open,
  editing,
  viewMode,
  service,
  onServiceChange,
  nextStep,
  onNextStepChange,
  accountSearch,
  onAccountSearchChange,
  accountId,
  onAccountChange,
  accounts,
  accountMenuOpen,
  onAccountMenuOpenChange,
  stageId,
  onStageChange,
  stages,
  amount,
  onAmountChange,
  isRecurring,
  onRecurringChange,
  months,
  onMonthsChange,
  expectedCloseDate,
  onExpectedCloseDateChange,
  showConclusionFields,
  conclusionStatus,
  onConclusionStatusChange,
  conclusionReason,
  onConclusionReasonChange,
  calculatedTicket,
  onEnableEdit,
  onClose,
  onSubmit,
  isPending,
  canSubmit
}: {
  open: boolean;
  editing: boolean;
  viewMode: boolean;
  service: string;
  onServiceChange: (value: string) => void;
  nextStep: string;
  onNextStepChange: (value: string) => void;
  accountSearch: string;
  onAccountSearchChange: (value: string) => void;
  accountId: string;
  onAccountChange: (value: string) => void;
  accounts: Array<{ id: string; label: string; searchText?: string }>;
  accountMenuOpen: boolean;
  onAccountMenuOpenChange: (value: boolean) => void;
  stageId: string;
  onStageChange: (value: string) => void;
  stages: Array<{ id: string; label: string }>;
  amount: string;
  onAmountChange: (value: string) => void;
  isRecurring: boolean;
  onRecurringChange: (value: boolean) => void;
  months: string;
  onMonthsChange: (value: string) => void;
  expectedCloseDate: string;
  onExpectedCloseDateChange: (value: string) => void;
  showConclusionFields: boolean;
  conclusionStatus: string;
  onConclusionStatusChange: (value: string) => void;
  conclusionReason: string;
  onConclusionReasonChange: (value: string) => void;
  calculatedTicket: number;
  onEnableEdit: () => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  canSubmit: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 18,
            flexWrap: "wrap"
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
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
              }}
            >
              <span>{editing ? "Oportunidade" : "Novo registro"}</span>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: "currentColor",
                  opacity: 0.6
                }}
              />
              <span>{stages.find((item) => item.id === stageId)?.label || "Sem fase"}</span>
            </div>
            <h2
              style={{
                margin: "8px 0 0",
                fontSize: "1.75rem",
                lineHeight: 1.05,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: "var(--foreground)"
              }}
            >
              {editing ? (viewMode ? "Visualizar oportunidade" : "Editar oportunidade") : "Nova oportunidade"}
            </h2>
            <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 14, lineHeight: 1.6, maxWidth: 560 }}>
              Todos os campos da oportunidade organizados em uma unica visualizacao.
            </div>
          </div>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
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
          <div
            style={{
              display: "grid",
              gap: 18,
              minWidth: 0,
              overflow: "hidden",
              padding: 18,
              borderRadius: 20,
              background: "var(--surface-elevated)",
              border: "1px solid var(--line)"
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                alignItems: "end",
                minWidth: 0
              }}
            >
              <Field
                label="Servico"
                value={service}
                onChange={onServiceChange}
                placeholder="Implantacao de CRM"
                required
                disabled={viewMode}
              />
              <Field
                label="Proximo passo"
                value={nextStep}
                onChange={onNextStepChange}
                placeholder="Agendar reuniao"
                disabled={viewMode}
              />
              <SearchableAccountField
                label="Conta"
                searchValue={accountSearch}
                onSearchChange={onAccountSearchChange}
                value={accountId}
                onChange={onAccountChange}
                options={accounts}
                menuOpen={accountMenuOpen}
                onMenuOpenChange={onAccountMenuOpenChange}
                disabled={viewMode}
              />
              <SelectField label="Fase" value={stageId} onChange={onStageChange} options={stages} disabled={viewMode} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 14,
                alignItems: "end",
                minWidth: 0
              }}
            >
              <Field
                label="Valor base"
                value={amount}
                onChange={onAmountChange}
                placeholder="38000"
                required
                disabled={viewMode}
              />
              <ToggleField label="Recorrente" checked={isRecurring} onChange={onRecurringChange} disabled={viewMode} />
              <Field
                label="Meses"
                value={months}
                onChange={onMonthsChange}
                placeholder="6"
                disabled={viewMode || !isRecurring}
              />
              <DateField
                label="Fechamento"
                value={expectedCloseDate}
                onChange={onExpectedCloseDateChange}
                disabled={viewMode}
              />
            </div>

            {showConclusionFields ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                  alignItems: "end",
                  minWidth: 0
                }}
              >
                <SelectField
                  label="Conclusao"
                  value={conclusionStatus}
                  onChange={onConclusionStatusChange}
                  options={CONCLUSION_STATUS_OPTIONS}
                  disabled={viewMode}
                />
                <SelectField
                  label="Motivo da conclusao"
                  value={conclusionReason}
                  onChange={onConclusionReasonChange}
                  options={CONCLUSION_REASON_OPTIONS}
                  disabled={viewMode}
                />
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              minWidth: 0
            }}
          >
            <div
              style={{
                padding: 18,
                borderRadius: 20,
                background:
                  "linear-gradient(180deg, rgba(79, 70, 229, 0.06) 0%, rgba(79, 70, 229, 0.02) 100%)",
                border: "1px solid rgba(79, 70, 229, 0.12)"
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>Resumo comercial</div>
              <div
                style={{
                  marginTop: 10,
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "#ffffff",
                  border: "1px solid rgba(79, 70, 229, 0.08)"
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--muted)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase"
                  }}
                >
                  Situacao
                </div>
                <div style={{ marginTop: 6, fontWeight: 900, fontSize: "1.05rem", color: "var(--foreground)" }}>
                  {viewMode ? "Visualizacao" : editing ? "Edicao ativa" : "Criacao ativa"}
                </div>
              </div>
              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                <ModalStat label="Conta" value={accountSearch || "Selecione uma conta"} />
                <ModalStat label="Fase" value={stages.find((item) => item.id === stageId)?.label || "Selecione"} />
                <ModalStat label="Ticket" value={formatCurrency(calculatedTicket)} strong />
              </div>
            </div>

            <div
              style={{
                padding: 18,
                borderRadius: 20,
                background: "rgba(20, 184, 166, 0.08)",
                border: "1px solid rgba(20, 184, 166, 0.16)",
                color: "#0f766e"
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Ticket calculado
              </div>
              <div style={{ marginTop: 8, fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.04em" }}>
                {formatCurrency(calculatedTicket)}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55 }}>
                {isRecurring ? `Valor base multiplicado por ${months || "1"} mes(es).` : "Valor unico da oportunidade."}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "sticky",
            bottom: -18,
            marginTop: 20,
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            flexWrap: "wrap",
            paddingTop: 18,
            paddingBottom: 6,
            background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 24%)",
            borderTop: "1px solid rgba(15, 23, 42, 0.06)"
          }}
        >
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            {viewMode ? "Fechar" : "Cancelar"}
          </button>
          {editing && viewMode ? (
            <button type="button" onClick={onEnableEdit} disabled={!canSubmit} style={submitButtonStyle}>
              Editar agora
            </button>
          ) : (
            <button type="button" onClick={onSubmit} disabled={isPending || !canSubmit} style={submitButtonStyle}>
              {isPending ? "Salvando..." : editing ? "Salvar edicao" : "Salvar oportunidade"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteOpportunityModal({
  opportunity,
  isPending,
  onClose,
  onConfirm
}: {
  opportunity: OpportunityItem | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!opportunity) {
    return null;
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={confirmCardStyle} onClick={(event) => event.stopPropagation()}>
        <div style={confirmEyebrowStyle}>Confirmar exclusao</div>
        <h2 style={confirmTitleStyle}>Excluir oportunidade?</h2>
        <div style={confirmTextStyle}>Revise os dados abaixo antes de remover o registro do funil.</div>
        <div style={confirmGridStyle}>
          <CompactCell label="Servico" value={opportunity.title} />
          <CompactCell label="Conta" value={opportunity.company} />
          <CompactCell label="Fase" value={opportunity.stage} />
          <CompactCell label="Ticket" value={opportunity.amount} emphasis />
        </div>
        <div style={confirmActionsStyle}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending} style={deleteButtonStyle}>
            {isPending ? "Excluindo..." : "Excluir oportunidade"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchableAccountField({
  label,
  searchValue,
  onSearchChange,
  value,
  onChange,
  options,
  menuOpen,
  onMenuOpenChange,
  disabled = false
}: {
  label: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string; searchText?: string }>;
  menuOpen: boolean;
  onMenuOpenChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const selectedOption = options.find((option) => option.id === value);
  const normalizedQuery = normalizeSearchText(searchValue);
  const normalizedSelectedLabel = normalizeSearchText(selectedOption?.label ?? "");
  const shouldShowAll = !normalizedQuery || normalizedQuery === normalizedSelectedLabel;
  const filteredOptions = shouldShowAll
    ? options
    : options.filter((option) => normalizeSearchText(option.searchText ?? option.label).includes(normalizedQuery));

  return (
    <div style={{ display: "grid", gap: 8, position: "relative", minWidth: 0, width: "100%" }}>
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
        value={searchValue}
        onChange={(event) => {
          onSearchChange(event.target.value);
          onMenuOpenChange(true);
        }}
        onFocus={(event) => {
          onMenuOpenChange(true);
          event.currentTarget.select();
        }}
        placeholder="Buscar cliente"
        style={inputStyle}
        disabled={disabled}
      />
      {menuOpen && !disabled ? (
        <div style={accountMenuStyle}>
          {filteredOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              style={{
                ...accountOptionStyle,
                background: option.id === value ? "rgba(79, 70, 229, 0.08)" : "#ffffff",
                color: option.id === value ? "var(--accent)" : "inherit"
              }}
            >
              {option.label}
            </button>
          ))}
          <button type="button" onClick={() => onChange(NEW_ACCOUNT_OPTION)} style={accountCreateStyle}>
            Adicionar novo cliente
          </button>
          {!filteredOptions.length ? (
            <div style={{ padding: "10px 12px", color: "var(--muted)", fontSize: 13 }}>
              Nenhum cliente encontrado.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function ModalStat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
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
          fontSize: strong ? "1.2rem" : 14,
          fontWeight: strong ? 900 : 700,
          letterSpacing: strong ? "-0.03em" : "0",
          lineHeight: 1.5,
          overflowWrap: "anywhere"
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
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
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
        disabled={disabled}
      />
    </label>
  );
}

function amountToNumber(value: string) {
  const numeric = Number(value.replace(/[^\d,-]/g, "").replace(".", "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

function toInputDate(value: string) {
  const [day, month, year] = value.split("/");

  if (!day || !month || !year) {
    return "";
  }

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid var(--line)",
  padding: "11px 14px",
  outline: "none",
  font: "inherit",
  background: "#ffffff",
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box"
};

const submitButtonStyle: React.CSSProperties = {
  minHeight: 44,
  border: 0,
  borderRadius: 14,
  padding: "12px 16px",
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer"
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid var(--line)",
  padding: "12px 16px",
  background: "#ffffff",
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
  borderRadius: 14,
  padding: "8px 12px",
  background: "rgba(79, 70, 229, 0.08)",
  color: "var(--accent)",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer"
};

const deleteButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: "8px 12px",
  background: "rgba(220, 38, 38, 0.1)",
  color: "#b91c1c",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer"
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: "rgba(15, 23, 42, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20
};

const modalCardStyle: React.CSSProperties = {
  width: "min(1320px, calc(100vw - 24px))",
  maxHeight: "min(90vh, 980px)",
  overflowY: "auto",
  overflowX: "hidden",
  borderRadius: 28,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.16)",
  padding: 24
};

const confirmCardStyle: React.CSSProperties = {
  width: "min(720px, calc(100vw - 24px))",
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

const confirmGridStyle: React.CSSProperties = {
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

const accountMenuStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  zIndex: 20,
  marginTop: 6,
  padding: 6,
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 18px 36px rgba(15, 23, 42, 0.08)",
  display: "grid",
  gap: 4,
  maxHeight: 240,
  overflowY: "auto",
  overflowX: "hidden"
};

const accountOptionStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "10px 12px",
  textAlign: "left",
  font: "inherit",
  cursor: "pointer"
};

const accountCreateStyle: React.CSSProperties = {
  ...accountOptionStyle,
  marginTop: 4,
  background: "rgba(20, 184, 166, 0.08)",
  color: "#0f766e",
  fontWeight: 800
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article
      style={{
        padding: 22,
        borderRadius: 24,
        background: "#ffffff",
        border: "1px solid var(--line)"
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 700 }}>{label}</div>
      <div
        style={{
          marginTop: 10,
          fontSize: "2rem",
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: "-0.05em"
        }}
      >
        {value}
      </div>
    </article>
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
    <div>
      <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: emphasis ? 800 : 700, color: emphasis ? "var(--accent)" : "inherit" }}>
        {value}
      </div>
    </div>
  );
}

function CompactCell({
  label,
  value,
  emphasis = false
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
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
          fontWeight: emphasis ? 900 : 700,
          color: emphasis ? "var(--accent)" : "inherit",
          fontSize: emphasis ? 13.5 : 13,
          letterSpacing: emphasis ? "-0.01em" : "0",
          lineHeight: 1.45
        }}
      >
        {value}
      </div>
    </div>
  );
}
