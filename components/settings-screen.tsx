"use client";

import { useEffect, useMemo, useState } from "react";
import { CrmShell } from "@/components/crm-shell";
import {
  clearCrmOperationalData,
  getPipelineAgentExecutionHistory,
  type PipelineAgentExecutionHistoryEntry
} from "@/lib/crm-data-source";
import {
  defaultCrmSettings,
  getCrmSettings,
  saveCrmSettings,
  type CrmSettings,
  type FeatureKey,
  type PipelineAgentStageLimits,
  type SupportedLocale,
  type SupportedTimeZone,
  updateCrmPassword
} from "@/lib/crm-settings";
import { useCrmRole } from "@/lib/use-crm-role";

const featureDefinitions: Array<{
  key: FeatureKey;
  title: string;
  description: string;
}> = [
  {
    key: "notifications_center",
    title: "Central de notificacoes",
    description: "Mantem o sino, a contagem e os alertas do processo comercial."
  },
  {
    key: "browser_notifications",
    title: "Alertas do navegador",
    description: "Dispara avisos nativos para compromissos e lembretes urgentes."
  },
  {
    key: "agenda_module",
    title: "Modulo de agenda",
    description: "Exibe agenda do dia, agenda semanal e vinculacao com clientes e oportunidades."
  },
  {
    key: "task_reminders",
    title: "Lembretes de tarefas",
    description: "Ativa regras de prazo vencido, tarefas do dia e acompanhamentos prioritarios."
  },
  {
    key: "pipeline_drag_drop",
    title: "Kanban arrastavel",
    description: "Permite mover oportunidades entre etapas com drag and drop."
  },
  {
    key: "history_module",
    title: "Historico e auditoria",
    description: "Mantem o menu Historico e o rastreio de movimentacoes do sistema."
  },
  {
    key: "pipeline_agent_system",
    title: "Agente de pipeline",
    description: "Habilita analise de atencao, alertas inteligentes e automacoes do agente comercial."
  }
];

const localeOptions: Array<{ value: SupportedLocale; label: string }> = [
  { value: "pt-BR", label: "Portugues (Brasil)" },
  { value: "en-US", label: "English (United States)" },
  { value: "es-ES", label: "Espanol" }
];

const timeZoneOptions: Array<{ value: SupportedTimeZone; label: string }> = [
  { value: "system", label: "Automatico (navegador)" },
  { value: "America/Sao_Paulo", label: "Brasilia (GMT-3)" },
  { value: "America/New_York", label: "New York (GMT-5/-4)" },
  { value: "UTC", label: "UTC" }
];

export function SettingsScreen() {
  const role = useCrmRole();
  const [draftSettings, setDraftSettings] = useState<CrmSettings>(defaultCrmSettings);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [teamMemberName, setTeamMemberName] = useState("");
  const [teamMemberDisplayName, setTeamMemberDisplayName] = useState("");
  const [teamMemberEmail, setTeamMemberEmail] = useState("");
  const [teamMemberPassword, setTeamMemberPassword] = useState("");
  const [teamMemberRole, setTeamMemberRole] = useState<"admin" | "manager" | "sales">("sales");
  const [isCreatingTeamMember, setIsCreatingTeamMember] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [agentHistory, setAgentHistory] = useState<PipelineAgentExecutionHistoryEntry[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [next, history] = await Promise.all([getCrmSettings(), getPipelineAgentExecutionHistory(12)]);

      if (isMounted) {
        setDraftSettings({
          ...defaultCrmSettings,
          ...next,
          features: {
            ...defaultCrmSettings.features,
            ...next.features
          },
          pipelineAgent: {
            ...defaultCrmSettings.pipelineAgent,
            ...next.pipelineAgent,
            stageLimits: {
              ...defaultCrmSettings.pipelineAgent.stageLimits,
              ...next.pipelineAgent.stageLimits
            }
          }
        });
        setAgentHistory(history);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeFeatureCount = useMemo(
    () => featureDefinitions.filter((feature) => Boolean(draftSettings.features[feature.key])).length,
    [draftSettings.features]
  );

  async function handleSaveIdentity() {
    await saveCrmSettings(draftSettings);
    setFeedback("Configuracoes salvas com sucesso.");
  }

  async function handleFeatureToggle(key: FeatureKey, checked: boolean) {
    const next = {
      ...draftSettings,
      features: {
        ...draftSettings.features,
        [key]: checked
      },
      pipelineAgent: {
        ...draftSettings.pipelineAgent,
        enabled: key === "pipeline_agent_system" ? (checked ? draftSettings.pipelineAgent.enabled : false) : draftSettings.pipelineAgent.enabled
      }
    };

    setDraftSettings(next);
    await saveCrmSettings(next);
    setFeedback("Funcionalidade atualizada.");
  }

  function updatePipelineStageLimit(key: keyof PipelineAgentStageLimits, value: string) {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? Math.max(1, Math.min(30, Math.round(parsed))) : 1;

    setDraftSettings((current) => ({
      ...current,
      pipelineAgent: {
        ...current.pipelineAgent,
        stageLimits: {
          ...current.pipelineAgent.stageLimits,
          [key]: safeValue
        }
      }
    }));
  }

  async function handlePasswordSave() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setFeedback("Preencha os tres campos para validar a troca de senha.");
      return;
    }

    if (newPassword.length < 6) {
      setFeedback("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback("A confirmacao da senha nao confere.");
      return;
    }

    const result = await updateCrmPassword(newPassword);
    setFeedback(result.message);

    if (result.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleTeamMemberCreate() {
    if (role !== "admin") {
      setFeedback("Apenas administradores podem cadastrar usuarios da equipe.");
      return;
    }

    if (!teamMemberName.trim() || !teamMemberEmail.trim() || !teamMemberPassword) {
      setFeedback("Preencha nome, e-mail e senha do novo usuario.");
      return;
    }

    if (teamMemberPassword.length < 6) {
      setFeedback("A senha do novo usuario precisa ter pelo menos 6 caracteres.");
      return;
    }

    setIsCreatingTeamMember(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName: teamMemberName,
          displayName: teamMemberDisplayName,
          email: teamMemberEmail,
          password: teamMemberPassword,
          role: teamMemberRole
        })
      });

      const result = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !result.ok) {
        setFeedback(result.message || "Nao foi possivel criar o usuario.");
        setIsCreatingTeamMember(false);
        return;
      }

      setTeamMemberName("");
      setTeamMemberDisplayName("");
      setTeamMemberEmail("");
      setTeamMemberPassword("");
      setTeamMemberRole("sales");
      setFeedback("Usuario da equipe criado com sucesso.");
    } catch {
      setFeedback("Falha ao comunicar com o servidor para criar o usuario.");
    } finally {
      setIsCreatingTeamMember(false);
    }
  }

  return (
    <CrmShell
      activePath="/dashboard/settings"
      title="Configuracoes"
      subtitle="Controle perfil, nome exibido e habilitacao de funcionalidades do CRM."
      primaryAction="Sistema configuravel"
    >
      <section style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <StatCard label="Funcoes ativas" value={`${activeFeatureCount}/${featureDefinitions.length}`} accent="#4f46e5" />
          <StatCard label="Nome exibido" value={draftSettings.displayName} accent="#0f766e" compact />
          <StatCard label="Empresa no CRM" value={draftSettings.companyName} accent="#b45309" compact />
          <StatCard label="Relogio" value={draftSettings.use24HourClock ? "24h" : "12h"} accent="#0f766e" compact />
        </div>

        {feedback ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 18,
              background: "#ffffff",
              border: "1px solid var(--line)",
              color: "var(--accent)",
              fontSize: 13,
              fontWeight: 800
            }}
          >
            {feedback}
          </div>
        ) : null}

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Perfil</div>
              <h2 style={sectionTitleStyle}>Identidade do sistema</h2>
              <p style={sectionTextStyle}>
                Esses campos agora persistem no navegador e no banco quando houver sessao real no Supabase.
              </p>
            </div>
          </div>

          <div style={gridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Nome exibido</span>
              <input
                value={draftSettings.displayName}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    displayName: event.target.value
                  }))
                }
                style={inputStyle}
                placeholder="Nome interno do usuario"
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Nome do sistema</span>
              <input
                value={draftSettings.companyName}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    companyName: event.target.value
                  }))
                }
                style={inputStyle}
                placeholder="Nome principal do CRM"
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Localidade</span>
              <select
                value={draftSettings.locale}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    locale: event.target.value as SupportedLocale
                  }))
                }
                style={inputStyle}
              >
                {localeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Fuso horario</span>
              <select
                value={draftSettings.timeZone}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    timeZone: event.target.value as SupportedTimeZone
                  }))
                }
                style={inputStyle}
              >
                {timeZoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Formato do relogio</span>
              <select
                value={draftSettings.use24HourClock ? "24h" : "12h"}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    use24HourClock: event.target.value === "24h"
                  }))
                }
                style={inputStyle}
              >
                <option value="24h">24 horas (padrao premium)</option>
                <option value="12h">12 horas (AM/PM)</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={handleSaveIdentity} style={primaryButtonStyle}>
              Salvar identidade e relogio
            </button>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Seguranca</div>
              <h2 style={sectionTitleStyle}>Senha e autenticacao</h2>
              <p style={sectionTextStyle}>
                A troca de senha agora usa o Supabase Auth. Em acesso local sem sessao real, o sistema informa o bloqueio.
              </p>
            </div>
          </div>

          <div style={gridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Senha atual</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                style={inputStyle}
                placeholder="Informe a senha atual"
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Nova senha</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                style={inputStyle}
                placeholder="Nova senha"
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Confirmar nova senha</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                style={inputStyle}
                placeholder="Repita a nova senha"
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={handlePasswordSave} style={primaryButtonStyle}>
              Trocar senha
            </button>
          </div>
        </div>

        {role === "admin" ? (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Equipe</div>
                <h2 style={sectionTitleStyle}>Cadastrar usuario interno</h2>
                <p style={sectionTextStyle}>
                  Cria um usuario no Supabase Auth e vincula automaticamente a mesma organizacao do admin atual.
                </p>
              </div>
            </div>

            <div style={gridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Nome completo</span>
                <input
                  value={teamMemberName}
                  onChange={(event) => setTeamMemberName(event.target.value)}
                  style={inputStyle}
                  placeholder="Nome da pessoa"
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Nome de exibicao</span>
                <input
                  value={teamMemberDisplayName}
                  onChange={(event) => setTeamMemberDisplayName(event.target.value)}
                  style={inputStyle}
                  placeholder="Opcional"
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>E-mail</span>
                <input
                  type="email"
                  value={teamMemberEmail}
                  onChange={(event) => setTeamMemberEmail(event.target.value)}
                  style={inputStyle}
                  placeholder="usuario@empresa.com"
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Senha inicial</span>
                <input
                  type="password"
                  value={teamMemberPassword}
                  onChange={(event) => setTeamMemberPassword(event.target.value)}
                  style={inputStyle}
                  placeholder="Minimo de 6 caracteres"
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Papel</span>
                <select
                  value={teamMemberRole}
                  onChange={(event) =>
                    setTeamMemberRole(event.target.value as "admin" | "manager" | "sales")
                  }
                  style={inputStyle}
                >
                  <option value="sales">Comercial</option>
                  <option value="manager">Gestor</option>
                  <option value="admin">Master</option>
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleTeamMemberCreate}
                disabled={isCreatingTeamMember}
                style={primaryButtonStyle}
              >
                {isCreatingTeamMember ? "Criando usuario..." : "Cadastrar usuario da equipe"}
              </button>
            </div>
          </div>
        ) : null}

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Agente</div>
              <h2 style={sectionTitleStyle}>Automacao do pipeline</h2>
              <p style={sectionTextStyle}>
                Define horario da rotina diaria, limite de tarefas automaticas e tempo maximo por etapa antes de considerar esfriamento.
              </p>
            </div>
          </div>

          <div style={gridStyle}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Agente ativo</span>
              <select
                value={draftSettings.pipelineAgent.enabled ? "on" : "off"}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    pipelineAgent: {
                      ...current.pipelineAgent,
                      enabled: event.target.value === "on"
                    }
                  }))
                }
                style={inputStyle}
              >
                <option value="on">Ativo</option>
                <option value="off">Desativado</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Horario da rotina</span>
              <input
                type="time"
                value={draftSettings.pipelineAgent.runAt}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    pipelineAgent: {
                      ...current.pipelineAgent,
                      runAt: event.target.value || "08:00"
                    }
                  }))
                }
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Max. tarefas automaticas/dia</span>
              <input
                type="number"
                min={1}
                max={20}
                value={draftSettings.pipelineAgent.maxTasksPerDay}
                onChange={(event) =>
                  setDraftSettings((current) => ({
                    ...current,
                    pipelineAgent: {
                      ...current.pipelineAgent,
                      maxTasksPerDay: Math.max(1, Math.min(20, Number(event.target.value) || 1))
                    }
                  }))
                }
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ ...gridStyle, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Lead (dias)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={draftSettings.pipelineAgent.stageLimits.lead}
                onChange={(event) => updatePipelineStageLimit("lead", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Qualificacao (dias)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={draftSettings.pipelineAgent.stageLimits.qualification}
                onChange={(event) => updatePipelineStageLimit("qualification", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Diagnostico (dias)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={draftSettings.pipelineAgent.stageLimits.diagnosis}
                onChange={(event) => updatePipelineStageLimit("diagnosis", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Proposta (dias)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={draftSettings.pipelineAgent.stageLimits.proposal}
                onChange={(event) => updatePipelineStageLimit("proposal", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Negociacao (dias)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={draftSettings.pipelineAgent.stageLimits.negotiation}
                onChange={(event) => updatePipelineStageLimit("negotiation", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Fechamento (dias)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={draftSettings.pipelineAgent.stageLimits.closing}
                onChange={(event) => updatePipelineStageLimit("closing", event.target.value)}
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={async () => {
                await saveCrmSettings(draftSettings);
                setFeedback("Configuracoes do agente salvas.");
              }}
              style={primaryButtonStyle}
            >
              Salvar configuracoes do agente
            </button>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Feature flags</div>
              <h2 style={sectionTitleStyle}>Habilitar e desabilitar funcionalidades</h2>
              <p style={sectionTextStyle}>
                Essas chaves ja afetam menu, central de notificacoes, lembretes, agenda e interacao do Kanban.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {featureDefinitions.map((feature) => (
              <div key={feature.key} style={featureCardStyle}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.02em" }}>{feature.title}</div>
                  <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.6 }}>{feature.description}</div>
                </div>
                <label style={toggleWrapStyle}>
                  <input
                    type="checkbox"
                    checked={draftSettings.features[feature.key]}
                    onChange={(event) => {
                      void handleFeatureToggle(feature.key, event.target.checked);
                    }}
                    style={{ display: "none" }}
                  />
                  <span
                    style={{
                      ...toggleTrackStyle,
                      background: draftSettings.features[feature.key] ? "linear-gradient(135deg, var(--accent), var(--accent-strong))" : "#cbd5e1"
                    }}
                  >
                    <span
                      style={{
                        ...toggleThumbStyle,
                        transform: draftSettings.features[feature.key] ? "translateX(22px)" : "translateX(0)"
                      }}
                    />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: draftSettings.features[feature.key] ? "var(--accent)" : "var(--muted)" }}>
                    {draftSettings.features[feature.key] ? "Ativo" : "Desativado"}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Historico do agente</div>
              <h2 style={sectionTitleStyle}>Ultimas execucoes</h2>
              <p style={sectionTextStyle}>
                Mostra quando o agente rodou, quantos negocios analisou, quantas tarefas criou e o motivo da execucao.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => setAgentHistory(await getPipelineAgentExecutionHistory(12))}
              style={secondaryGhostButtonStyle}
            >
              Atualizar historico
            </button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {agentHistory.length ? (
              agentHistory.map((item) => (
                <article
                  key={item.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "#ffffff",
                    display: "grid",
                    gap: 6
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        ...historyBadgeStyle,
                        color: item.executed ? "#0f766e" : "#b45309",
                        background: item.executed ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)"
                      }}
                    >
                      {item.executed ? "Executado" : "Nao executado"}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>
                      {formatDateTimeLabel(item.ranAt)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "var(--muted)", fontSize: 12 }}>
                    <span>Analisados: {item.reviewed}</span>
                    <span>Tarefas criadas: {item.createdTasks}</span>
                    <span>Dia-base: {item.dateKey}</span>
                  </div>
                  <div style={{ color: "var(--foreground)", fontSize: 13 }}>{item.reason}</div>
                </article>
              ))
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                Ainda nao ha execucoes registradas do agente.
              </div>
            )}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Limpeza</div>
              <h2 style={sectionTitleStyle}>Resetar dados operacionais</h2>
              <p style={sectionTextStyle}>
                Essa acao limpa oportunidades, clientes, tarefas, agenda, atividades e notificacoes locais. Se houver sessao real, tambem tenta limpar o Supabase.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setIsConfirmingReset(true)}
              style={dangerButtonStyle}
            >
              Iniciar limpeza dos dados
            </button>
          </div>
        </div>
      </section>

      {isConfirmingReset ? (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <div style={eyebrowStyle}>Confirmacao de limpeza</div>
            <h2 style={{ ...sectionTitleStyle, marginTop: 10 }}>Apagar dados operacionais do CRM?</h2>
            <div style={{ ...sectionTextStyle, marginTop: 10 }}>
              Se confirmar, o sistema vai remover:
            </div>
            <div style={modalListStyle}>
              <div>Clientes e contatos operacionais</div>
              <div>Oportunidades e tarefas</div>
              <div>Agenda, atividades e notificacoes</div>
              <div>Dados locais do navegador usados como fallback</div>
            </div>
            <div style={{ ...warningTextStyle, marginTop: 10 }}>
              Essa acao nao pode ser desfeita automaticamente.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setIsConfirmingReset(false)}
                style={secondaryGhostButtonStyle}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = await clearCrmOperationalData();
                  setFeedback(result.message);
                  setAgentHistory([]);
                  setIsConfirmingReset(false);
                }}
                style={dangerButtonStyle}
              >
                Confirmar limpeza
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CrmShell>
  );
}

function StatCard({
  label,
  value,
  accent,
  compact = false
}: {
  label: string;
  value: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 22,
        background: "#ffffff",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)"
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>{label}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: compact ? "1.1rem" : "1.9rem",
          fontWeight: 900,
          letterSpacing: "-0.04em"
        }}
      >
        {value}
      </div>
    </div>
  );
}

function formatDateTimeLabel(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const sectionStyle: React.CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow)",
  display: "grid",
  gap: 18
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap"
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--accent)"
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "1.35rem",
  fontWeight: 900,
  letterSpacing: "-0.04em"
};

const sectionTextStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "var(--muted)",
  lineHeight: 1.7
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--muted)"
};

const inputStyle: React.CSSProperties = {
  minHeight: 48,
  width: "100%",
  borderRadius: 14,
  border: "1px solid var(--line)",
  background: "#ffffff",
  color: "var(--foreground)",
  fontSize: 14,
  fontWeight: 700,
  padding: "0 14px",
  outline: "none",
  boxSizing: "border-box"
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  border: 0,
  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
  color: "#ffffff",
  padding: "0 16px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer"
};

const dangerButtonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  border: 0,
  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
  color: "#ffffff",
  padding: "0 16px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer"
};

const secondaryGhostButtonStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid var(--line)",
  background: "#ffffff",
  color: "var(--foreground)",
  padding: "0 16px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer"
};

const warningTextStyle: React.CSSProperties = {
  color: "#b45309",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.6
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "rgba(15, 23, 42, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20
};

const modalCardStyle: React.CSSProperties = {
  width: "min(560px, calc(100vw - 24px))",
  borderRadius: 24,
  background: "#ffffff",
  border: "1px solid var(--line)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.16)",
  padding: 24
};

const modalListStyle: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 8,
  color: "var(--foreground)",
  fontSize: 14,
  fontWeight: 700
};

const featureCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 22,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap"
};

const toggleWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer"
};

const toggleTrackStyle: React.CSSProperties = {
  width: 46,
  height: 24,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  padding: 2,
  transition: "background 0.2s ease"
};

const toggleThumbStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 999,
  background: "#ffffff",
  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.18)",
  transition: "transform 0.2s ease"
};

const historyBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  borderRadius: 999,
  padding: "0 10px",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase"
};
