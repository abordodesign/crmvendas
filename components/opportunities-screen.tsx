"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CustomerFormModal } from "@/components/customer-form-modal";
import { CrmShell, pillStyle } from "@/components/crm-shell";
import { hasPermission } from "@/lib/access-control";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency-input";
import { defaultCrmSettings, getCrmSettings, subscribeCrmSettingsChanged } from "@/lib/crm-settings";
import {
  CONCLUSION_REASON_OPTIONS,
  CONCLUSION_STATUS_OPTIONS,
  DEFAULT_STAGE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  addOpportunityNote,
  createCustomer,
  deleteOpportunity,
  createOpportunity,
  getOpportunities,
  getOpportunityNotes,
  getPipelineStatistics,
  getReferenceOptions,
  isConclusionStage,
  moveOpportunityToStage,
  subscribeCrmDataChanged,
  updateOpportunity
} from "@/lib/crm-data-source";
import { seedOpportunities } from "@/lib/crm-seed";
import { useCrmRole } from "@/lib/use-crm-role";
import type { OpportunityItem, OpportunityNote } from "@/types/crm-app";

const NEW_ACCOUNT_OPTION = "__new__";
const STAGE_FLOW = ["Lead", "Qualificacao", "Diagnostico", "Proposta enviada", "Negociacao", "Fechamento"];

function upsertOpportunity(items: OpportunityItem[], nextItem: OpportunityItem) {
  return [nextItem, ...items.filter((item) => item.id !== nextItem.id)];
}

export function OpportunitiesScreen() {
  const [settings, setSettings] = useState(defaultCrmSettings);
  const role = useCrmRole();
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>(seedOpportunities);
  const [accounts, setAccounts] = useState<Array<{ id: string; label: string; searchText?: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: string; label: string; probability?: number }>>([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [service, setService] = useState("");
  const [leadSource, setLeadSource] = useState(LEAD_SOURCE_OPTIONS[0]?.id ?? "");
  const [accountId, setAccountId] = useState("");
  const [stageId, setStageId] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [amount, setAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [months, setMonths] = useState("1");
  const [manualProbability, setManualProbability] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [conclusionStatus, setConclusionStatus] = useState("");
  const [conclusionReason, setConclusionReason] = useState("");
  const [conclusionDate, setConclusionDate] = useState("");
  const [isConclusionMode, setIsConclusionMode] = useState(false);
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
  const [nearestOpenCloseDate, setNearestOpenCloseDate] = useState<string | null>(null);
  const [averageProbability, setAverageProbability] = useState(0);
  const [forecastMonth, setForecastMonth] = useState(0);
  const [opportunityNotes, setOpportunityNotes] = useState<OpportunityNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteFeedback, setNoteFeedback] = useState<string | null>(null);
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
  const [focusId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return new URLSearchParams(window.location.search).get("focus");
  });
  const [isPending, startTransition] = useTransition();
  const [isNotePending, startNoteTransition] = useTransition();

  const canCreate = role ? hasPermission(role, "opportunities:write") : true;
  const canEdit = role
    ? hasPermission(role, "records:edit") || hasPermission(role, "opportunities:write")
    : true;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [nextOpportunities, refs, stats] = await Promise.all([
        getOpportunities(),
        getReferenceOptions(),
        getPipelineStatistics()
      ]);

      if (isMounted) {
        setOpportunities(nextOpportunities);
        setAccounts(refs.accounts);
        setStages(refs.stages);
        setNearestOpenCloseDate(stats.nearestCloseDate);
        setAverageProbability(stats.averageProbability);
        setForecastMonth(stats.forecastMonth);
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

  const totalAmount = useMemo(
    () => opportunities.reduce((sum, item) => sum + amountToNumber(item.amount), 0),
    [opportunities]
  );
  const calculatedTicket = useMemo(() => {
    const baseAmount = parseCurrencyInput(amount);
    const multiplier = isRecurring ? Math.max(1, Number(months || 1)) : 1;
    return baseAmount * multiplier;
  }, [amount, isRecurring, months]);
  const selectedStageLabel = useMemo(
    () => stages.find((item) => item.id === stageId)?.label ?? DEFAULT_STAGE_OPTIONS.find((item) => item.id === stageId)?.label ?? "",
    [stageId, stages]
  );
  const selectedStageProbability = useMemo(
    () => stages.find((item) => item.id === stageId)?.probability ?? DEFAULT_STAGE_OPTIONS.find((item) => item.id === stageId)?.probability ?? 0,
    [stageId, stages]
  );
  const hasManualProbability = useMemo(() => {
    const parsed = Number(manualProbability);
    return manualProbability.trim() !== "" && Number.isFinite(parsed);
  }, [manualProbability]);
  const effectiveProbability = useMemo(() => {
    const parsed = Number(manualProbability);

    if (hasManualProbability) {
      return Math.max(0, Math.min(100, parsed));
    }

    return selectedStageProbability;
  }, [hasManualProbability, manualProbability, selectedStageProbability]);
  const showConclusionFields = isConclusionStage(selectedStageLabel);
  const shouldShowConclusionFields = showConclusionFields || isConclusionMode;
  const resolvedConclusionStatus = shouldShowConclusionFields ? conclusionStatus || CONCLUSION_STATUS_OPTIONS[0]?.id || "" : "";
  const resolvedConclusionReason = shouldShowConclusionFields ? conclusionReason || CONCLUSION_REASON_OPTIONS[0]?.id || "" : "";
  const resolvedConclusionDate =
    shouldShowConclusionFields ? conclusionDate || new Date().toISOString().slice(0, 10) : "";
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

  useEffect(() => {
    let isMounted = true;

    async function loadNotes() {
      if (!isFormModalOpen || !editingId) {
        if (isMounted) {
          setOpportunityNotes([]);
        }
        return;
      }

      const nextNotes = await getOpportunityNotes(editingId);

      if (isMounted) {
        setOpportunityNotes(nextNotes);
      }
    }

    void loadNotes();

    return () => {
      isMounted = false;
    };
  }, [editingId, isFormModalOpen]);

  function resetForm() {
    setEditingId(null);
    setService("");
    setLeadSource(LEAD_SOURCE_OPTIONS[0]?.id ?? "");
    setAmount("");
    setNextStep("");
    setIsRecurring(false);
    setMonths("1");
    setManualProbability("");
    setExpectedCloseDate("");
    setConclusionStatus("");
    setConclusionReason("");
    setConclusionDate("");
    setIsConclusionMode(false);
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
    setOpportunityNotes([]);
    setNoteDraft("");
    setNoteFeedback(null);
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
    if (isPending) {
      return;
    }

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
    setLeadSource(leadSourceIdFromLabel(opportunity.leadSource));
    setNextStep(opportunity.nextStep ?? "");
    setAmount(formatCurrencyInput(opportunity.baseAmount));
    setIsRecurring(opportunity.isRecurring);
    setMonths(String(opportunity.months));
    setManualProbability(
      typeof opportunity.manualProbability === "number" && Number.isFinite(opportunity.manualProbability)
        ? String(opportunity.manualProbability)
        : ""
    );
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
    setConclusionDate(toInputDate(opportunity.concludedAt ?? ""));
    setIsConclusionMode(false);
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

    if (isPending) {
      return;
    }

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
          const nextStatus = showConclusionFields ? resolvedConclusionStatus || "Conquistado" : "Em andamento";
          const updated = await updateOpportunity({
            id: editingId,
            title: service,
            stageId,
            stageLabel: selectedStageLabel,
            leadSource: leadSourceLabelFromId(leadSource),
            nextStep,
            amount: calculatedTicket,
            baseAmount: parseCurrencyInput(amount),
            isRecurring,
            months: isRecurring ? Math.max(1, Number(months || 1)) : 1,
            probability: hasManualProbability ? effectiveProbability : undefined,
            expectedCloseDate,
            status: nextStatus,
            conclusionStatus: showConclusionFields ? resolvedConclusionStatus : undefined,
            conclusionReason: showConclusionFields ? resolvedConclusionReason : undefined,
            concludedAt: showConclusionFields ? `${resolvedConclusionDate}T00:00:00.000Z` : undefined,
            currentCompany: currentRecord.company,
            currentStage: currentRecord.stage
          });

          setOpportunities((current) => {
            const existing = current.find((item) => item.id === editingId);
            const merged = existing
              ? {
                  ...existing,
                  ...updated,
                  owner: existing.owner
                }
              : updated;

            return upsertOpportunity(current, merged);
          });
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
          const nextStatus = showConclusionFields ? resolvedConclusionStatus || "Conquistado" : "Em andamento";
          const normalizedAccountId =
            !nextAccountId || nextAccountId === NEW_ACCOUNT_OPTION || nextAccountId.startsWith("local-customer-")
              ? ""
              : nextAccountId;
          const created = await createOpportunity({
            title: service,
            accountId: normalizedAccountId,
            stageId,
            leadSource: leadSourceLabelFromId(leadSource),
            nextStep,
            amount: calculatedTicket,
            baseAmount: parseCurrencyInput(amount),
          isRecurring,
          months: isRecurring ? Math.max(1, Number(months || 1)) : 1,
          probability: hasManualProbability ? effectiveProbability : undefined,
          expectedCloseDate,
          status: nextStatus,
            conclusionStatus: showConclusionFields ? resolvedConclusionStatus : undefined,
            conclusionReason: showConclusionFields ? resolvedConclusionReason : undefined,
            concludedAt: showConclusionFields ? `${resolvedConclusionDate}T00:00:00.000Z` : undefined,
            accountLabel: nextAccountLabel ?? selectedAccount?.label,
            stageLabel: selectedStage?.label
          });

          setOpportunities((current) => upsertOpportunity(current, created));
          setIsViewMode(false);
          setIsFormModalOpen(false);
        resetForm();
        setFeedback("Oportunidade adicionada.");
      })();
    });
  }

  function startConclusion() {
    setFeedback(null);

    if (isPending) {
      return;
    }

    if (!editingId) {
      return;
    }

    if (!canEdit) {
      setFeedback("Seu perfil nao pode concluir oportunidades.");
      return;
    }

    const currentRecord = opportunities.find((item) => item.id === editingId);

    if (!currentRecord) {
      resetForm();
      return;
    }

    const conclusionStage =
      stages.find((item) => item.label === "Fechamento") ??
      stages.find((item) => item.label === "Conclusao") ??
      DEFAULT_STAGE_OPTIONS.find((item) => item.label === "Fechamento");

    if (!conclusionStage) {
      setFeedback("Nao foi possivel localizar a etapa de conclusao.");
      return;
    }

    setStageId(conclusionStage.id);
    setIsConclusionMode(true);
    setConclusionStatus((current) => current || "conquistado");
    setConclusionReason((current) => current || CONCLUSION_REASON_OPTIONS[0]?.id || "");
    setConclusionDate((current) => current || new Date().toISOString().slice(0, 10));
  }

  function handleConcludeNow() {
    setFeedback(null);

    if (isPending) {
      return;
    }

    if (!editingId) {
      return;
    }

    if (!canEdit) {
      setFeedback("Seu perfil nao pode concluir oportunidades.");
      return;
    }

    const currentRecord = opportunities.find((item) => item.id === editingId);

    if (!currentRecord) {
      resetForm();
      return;
    }

    const conclusionStage =
      stages.find((item) => item.label === "Fechamento") ??
      stages.find((item) => item.label === "Conclusao") ??
      DEFAULT_STAGE_OPTIONS.find((item) => item.label === "Fechamento");

    if (!conclusionStage) {
      setFeedback("Nao foi possivel localizar a etapa de conclusao.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const updated = await updateOpportunity({
          id: editingId,
          title: service,
          stageId: conclusionStage.id,
          stageLabel: conclusionStage.label,
          leadSource: leadSourceLabelFromId(leadSource),
          nextStep,
          amount: calculatedTicket,
          baseAmount: parseCurrencyInput(amount),
          isRecurring,
          months: isRecurring ? Math.max(1, Number(months || 1)) : 1,
          probability: hasManualProbability ? effectiveProbability : undefined,
          expectedCloseDate,
          status: resolvedConclusionStatus || "Conquistado",
          conclusionStatus: resolvedConclusionStatus || "Conquistado",
          conclusionReason: resolvedConclusionReason || undefined,
          concludedAt: `${resolvedConclusionDate}T00:00:00.000Z`,
          currentCompany: currentRecord.company,
          currentStage: currentRecord.stage
        });

        setOpportunities((current) => {
          const existing = current.find((item) => item.id === editingId);
          const merged = existing
            ? {
                ...existing,
                ...updated,
                owner: existing.owner
              }
            : updated;

          return upsertOpportunity(current, merged);
        });
        setIsViewMode(false);
        setIsFormModalOpen(false);
        resetForm();
        setFeedback("Oportunidade concluida.");
      })();
    });
  }

  function handleSaveNote() {
    if (!editingId || !noteDraft.trim() || isNotePending) {
      return;
    }

    const currentOpportunity = opportunities.find((item) => item.id === editingId);

    if (!currentOpportunity) {
      return;
    }

    setNoteFeedback(null);

    startNoteTransition(() => {
      void (async () => {
        const saved = await addOpportunityNote({
          opportunityId: currentOpportunity.id,
          opportunityTitle: currentOpportunity.title,
          content: noteDraft
        });

        setOpportunityNotes((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        setNoteDraft("");
        setNoteFeedback("Nota salva.");
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
        const result = await deleteOpportunity({
          id: currentOpportunity.id,
          title: currentOpportunity.title
        });

        if (result.ok) {
          setOpportunities((current) => current.filter((item) => item.id !== currentOpportunity.id));
          setFeedback(result.message);
        } else {
          setFeedback(result.message);
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
        leadSource={leadSource}
        onLeadSourceChange={setLeadSource}
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
        manualProbability={manualProbability}
        onManualProbabilityChange={setManualProbability}
        hasManualProbability={hasManualProbability}
        effectiveProbability={effectiveProbability}
        expectedCloseDate={expectedCloseDate}
        onExpectedCloseDateChange={setExpectedCloseDate}
        showConclusionFields={showConclusionFields}
        conclusionStatus={resolvedConclusionStatus}
        onConclusionStatusChange={setConclusionStatus}
        conclusionReason={resolvedConclusionReason}
        onConclusionReasonChange={setConclusionReason}
        conclusionDate={resolvedConclusionDate}
        onConclusionDateChange={setConclusionDate}
        calculatedTicket={calculatedTicket}
        onEnableEdit={() => setIsViewMode(false)}
        onStartConclusion={startConclusion}
        onConclude={handleConcludeNow}
        notes={opportunityNotes}
        noteDraft={noteDraft}
        onNoteDraftChange={setNoteDraft}
        onSaveNote={handleSaveNote}
        noteFeedback={noteFeedback}
        isNotePending={isNotePending}
        onClose={() => {
          setIsViewMode(false);
          setIsFormModalOpen(false);
          resetForm();
        }}
        onSubmit={handleSubmit}
        isPending={isPending}
        canSubmit={
          Boolean(editingId ? canEdit : canCreate) &&
          Boolean(accountId && service.trim() && amount.trim() && stageId && expectedCloseDate)
        }
        canConclude={Boolean(editingId && canEdit && (!showConclusionFields || isConclusionMode))}
        isConclusionMode={isConclusionMode}
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
        <MetricCard label="Probabilidade media" value={`${averageProbability}%`} />
        <MetricCard label="Previsao do mes" value={formatCurrency(forecastMonth)} />
        <MetricCard label="Fechamento mais proximo" value={formatNearestCloseDate(nearestOpenCloseDate)} />
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
                      <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 12, lineHeight: 1.4 }}>
                        Origem: {opportunity.leadSource || "Sem origem"}
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
                            display: "flex",
                            gap: 8,
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
                              display: "inline-flex",
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: "rgba(79, 70, 229, 0.08)",
                              color: "var(--accent)",
                              fontSize: 11,
                              fontWeight: 800
                            }}
                          >
                            {opportunity.probability}%
                          </div>
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
                      <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                        Valor ponderado: {formatCurrency(amountToNumber(opportunity.amount) * (opportunity.probability / 100))}
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

function CurrencyField({
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
        onChange={(event) => onChange(formatCurrencyInput(event.target.value))}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        inputMode="decimal"
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
  leadSource,
  onLeadSourceChange,
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
  manualProbability,
  onManualProbabilityChange,
  hasManualProbability,
  effectiveProbability,
  expectedCloseDate,
  onExpectedCloseDateChange,
  showConclusionFields,
  conclusionStatus,
  onConclusionStatusChange,
  conclusionReason,
  onConclusionReasonChange,
  conclusionDate,
  onConclusionDateChange,
  calculatedTicket,
  onEnableEdit,
  onStartConclusion,
  onConclude,
  notes,
  noteDraft,
  onNoteDraftChange,
  onSaveNote,
  noteFeedback,
  isNotePending,
  onClose,
  onSubmit,
  isPending,
  canSubmit,
  canConclude,
  isConclusionMode
}: {
  open: boolean;
  editing: boolean;
  viewMode: boolean;
  service: string;
  onServiceChange: (value: string) => void;
  leadSource: string;
  onLeadSourceChange: (value: string) => void;
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
  manualProbability: string;
  onManualProbabilityChange: (value: string) => void;
  hasManualProbability: boolean;
  effectiveProbability: number;
  expectedCloseDate: string;
  onExpectedCloseDateChange: (value: string) => void;
  showConclusionFields: boolean;
  conclusionStatus: string;
  onConclusionStatusChange: (value: string) => void;
  conclusionReason: string;
  onConclusionReasonChange: (value: string) => void;
  conclusionDate: string;
  onConclusionDateChange: (value: string) => void;
  calculatedTicket: number;
  onEnableEdit: () => void;
  onStartConclusion: () => void;
  onConclude: () => void;
  notes: OpportunityNote[];
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onSaveNote: () => void;
  noteFeedback: string | null;
  isNotePending: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  canSubmit: boolean;
  canConclude: boolean;
  isConclusionMode: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <div style={modalOverlayStyle}>
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
              <SelectField
                label="Origem do lead"
                value={leadSource}
                onChange={onLeadSourceChange}
                options={LEAD_SOURCE_OPTIONS}
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
              <CurrencyField
                label="Valor base"
                value={amount}
                onChange={onAmountChange}
                placeholder="1.788,30"
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
              <Field
                label="Probabilidade manual (%)"
                value={manualProbability}
                onChange={onManualProbabilityChange}
                placeholder="Ex.: 70"
                disabled={viewMode}
              />
              <DateField
                label="Fechamento"
                value={expectedCloseDate}
                onChange={onExpectedCloseDateChange}
                disabled={viewMode}
              />
            </div>

            {showConclusionFields || isConclusionMode ? (
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
                  disabled={viewMode && !isConclusionMode}
                />
                <SelectField
                  label="Motivo da conclusao"
                  value={conclusionReason}
                  onChange={onConclusionReasonChange}
                  options={CONCLUSION_REASON_OPTIONS}
                  disabled={viewMode && !isConclusionMode}
                />
                <DateField
                  label="Data da conclusao"
                  value={conclusionDate}
                  onChange={onConclusionDateChange}
                  disabled={viewMode && !isConclusionMode}
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
                <ModalStat label="Origem" value={leadSourceLabelFromId(leadSource)} />
                <ModalStat label="Fase" value={stages.find((item) => item.id === stageId)?.label || "Selecione"} />
                <ModalStat
                  label="Probabilidade"
                  value={`${effectiveProbability}%${hasManualProbability ? " manual" : " pela etapa"}`}
                />
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
                {isRecurring ? `Valor base multiplicado por ${months || "1"} mes(es).` : "Valor unico da oportunidade."}{" "}
                Valor ponderado: {formatCurrency(calculatedTicket * (effectiveProbability / 100))}.
              </div>
            </div>

            {editing ? (
              <div
                style={{
                  padding: 18,
                  borderRadius: 20,
                  background: "#ffffff",
                  border: "1px solid var(--line)"
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
                  📝 Notas da negociacao
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <textarea
                    value={noteDraft}
                    onChange={(event) => onNoteDraftChange(event.target.value)}
                    placeholder="Registrar contexto, pendencias ou combinados desta oportunidade."
                    disabled={viewMode && !editing}
                    style={noteTextareaStyle}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      As notas ficam salvas dentro do CRM e acompanham a oportunidade.
                    </div>
                    <button
                      type="button"
                      onClick={onSaveNote}
                      disabled={!noteDraft.trim() || isNotePending}
                      style={saveNoteButtonStyle}
                    >
                      {isNotePending ? "Salvando..." : "Salvar nota"}
                    </button>
                  </div>
                  {noteFeedback ? <div style={noteFeedbackStyle}>{noteFeedback}</div> : null}
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  {notes.length ? (
                    notes.map((note) => (
                      <article key={note.id} style={noteCardStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{note.author}</div>
                          <div style={{ color: "var(--muted)", fontSize: 12 }}>{formatNoteDate(note.createdAt)}</div>
                        </div>
                        <div style={{ marginTop: 8, color: "var(--foreground)", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {note.content}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div style={emptyNotesStyle}>Nenhuma nota registrada para esta oportunidade.</div>
                  )}
                </div>
              </div>
            ) : null}
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
            <>
              {!isConclusionMode && !showConclusionFields ? (
                <button type="button" onClick={onStartConclusion} disabled={isPending || !canConclude} style={conclusionButtonStyle}>
                  Concluir
                </button>
              ) : null}
              {isConclusionMode ? (
                <button type="button" onClick={onConclude} disabled={isPending || !canConclude} style={conclusionButtonStyle}>
                  {isPending ? "Concluindo..." : "Salvar conclusao"}
                </button>
              ) : null}
              <button type="button" onClick={onEnableEdit} disabled={!canSubmit} style={submitButtonStyle}>
                Editar agora
              </button>
            </>
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
    <div style={modalOverlayStyle}>
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
  return parseCurrencyInput(value);
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

const conclusionButtonStyle: React.CSSProperties = {
  ...submitButtonStyle,
  background: "linear-gradient(135deg, #059669 0%, #047857 100%)"
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

const noteTextareaStyle: React.CSSProperties = {
  minHeight: 108,
  borderRadius: 14,
  border: "1px solid var(--line)",
  padding: "12px 14px",
  outline: "none",
  font: "inherit",
  resize: "vertical",
  width: "100%",
  boxSizing: "border-box"
};

const saveNoteButtonStyle: React.CSSProperties = {
  minHeight: 40,
  border: 0,
  borderRadius: 12,
  padding: "10px 14px",
  background: "rgba(79, 70, 229, 0.1)",
  color: "var(--accent)",
  fontWeight: 800,
  cursor: "pointer"
};

const noteFeedbackStyle: React.CSSProperties = {
  color: "var(--secondary)",
  fontSize: 12,
  fontWeight: 700
};

const noteCardStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  background: "var(--surface-elevated)",
  border: "1px solid var(--line)"
};

const emptyNotesStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px dashed var(--line)",
  color: "var(--muted)",
  fontSize: 13
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatNearestCloseDate(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Sem data";
  }

  return parsed.toLocaleDateString("pt-BR");
}

function leadSourceLabelFromId(value: string) {
  return LEAD_SOURCE_OPTIONS.find((item) => item.id === value)?.label ?? "Sem origem";
}

function leadSourceIdFromLabel(value: string | undefined) {
  if (!value) {
    return LEAD_SOURCE_OPTIONS[0]?.id ?? "";
  }

  const match = LEAD_SOURCE_OPTIONS.find((item) => item.label.toLowerCase() === value.trim().toLowerCase());
  return match?.id ?? LEAD_SOURCE_OPTIONS[0]?.id ?? "";
}

function formatNoteDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Agora";
  }

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
