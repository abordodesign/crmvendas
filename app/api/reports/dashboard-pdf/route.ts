import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type OpportunityRow = {
  id: string;
  title: string;
  stage: string;
  company: string;
  amount: number;
  status: "open" | "won" | "lost";
  expectedCloseDate: string | null;
  nextStep: string | null;
  createdAt: string | null;
};

type OpportunityStageRelation = { name: string | null } | Array<{ name: string | null }> | null;
type OpportunityAccountRelation =
  | { trade_name: string | null; legal_name: string | null }
  | Array<{ trade_name: string | null; legal_name: string | null }>
  | null;
type OpportunityQueryRow = {
  id: string;
  title: string;
  amount: number | null;
  status: "open" | "won" | "lost" | null;
  expected_close_date: string | null;
  next_step: string | null;
  created_at: string | null;
  pipeline_stages: OpportunityStageRelation;
  accounts: OpportunityAccountRelation;
};

type AttentionLevel = "Critical" | "High" | "Medium" | "Low";

function toCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayDiff(from: Date, to: Date) {
  const fromTime = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toTime = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.ceil((toTime - fromTime) / 86400000);
}

function getStageStaleLimit(stage: string) {
  const normalized = stage.trim().toLowerCase();

  if (normalized.includes("lead")) return 7;
  if (normalized.includes("qual")) return 6;
  if (normalized.includes("diagn")) return 6;
  if (normalized.includes("proposta")) return 4;
  if (normalized.includes("negoc")) return 3;
  if (normalized.includes("fech")) return 2;
  return 7;
}

function computeAttentionLevel(score: number): AttentionLevel {
  if (score >= 70) return "Critical";
  if (score >= 45) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  if (maxChars <= 3) {
    return value.slice(0, maxChars);
  }

  return `${value.slice(0, Math.max(1, maxChars - 3))}...`;
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY para exportar PDF."
      },
      { status: 500 }
    );
  }

  const accessToken = request.cookies.get("crm_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "Sessao invalida." }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const {
    data: { user },
    error: userError
  } = await authClient.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ ok: false, message: "Sessao expirada. Entre novamente." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("organization_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ ok: false, message: "Nao foi possivel identificar a organizacao." }, { status: 403 });
  }

  const [opportunitiesRes, tasksRes, activitiesRes] = await Promise.all([
    serviceClient
      .from("opportunities")
      .select(
        "id, title, amount, status, next_step, expected_close_date, created_at, accounts:account_id(trade_name, legal_name), pipeline_stages:stage_id(name)"
      )
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false }),
    serviceClient
      .from("tasks")
      .select("id, opportunity_id, is_done")
      .eq("organization_id", profile.organization_id)
      .eq("is_done", false),
    serviceClient
      .from("activities")
      .select("opportunity_id, created_at")
      .eq("organization_id", profile.organization_id)
      .not("opportunity_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(4000)
  ]);

  if (opportunitiesRes.error || !opportunitiesRes.data) {
    return NextResponse.json({ ok: false, message: "Falha ao carregar oportunidades para o PDF." }, { status: 400 });
  }

  const latestActivityByOpportunity = new Map<string, string>();
  (activitiesRes.data ?? []).forEach((item) => {
    if (!item.opportunity_id || !item.created_at || latestActivityByOpportunity.has(item.opportunity_id)) {
      return;
    }

    latestActivityByOpportunity.set(item.opportunity_id, item.created_at);
  });

  const activeTaskByOpportunity = new Set(
    (tasksRes.data ?? []).filter((task) => Boolean(task.opportunity_id)).map((task) => task.opportunity_id as string)
  );

  const opportunities: OpportunityRow[] = opportunitiesRes.data.map((row) => {
    const typedRow = row as OpportunityQueryRow;
    const stageSource = typedRow.pipeline_stages;
    const accountSource = typedRow.accounts;
    const stage = Array.isArray(stageSource) ? stageSource[0]?.name ?? "Sem etapa" : stageSource?.name ?? "Sem etapa";
    const account = Array.isArray(accountSource) ? accountSource[0] : accountSource;
    const company = account?.trade_name ?? account?.legal_name ?? "Conta sem nome";

    return {
      id: typedRow.id,
      title: typedRow.title,
      stage,
      company,
      amount: typeof typedRow.amount === "number" ? typedRow.amount : 0,
      status: typedRow.status ?? "open",
      expectedCloseDate: typedRow.expected_close_date ?? null,
      nextStep: typedRow.next_step ?? null,
      createdAt: typedRow.created_at ?? null
    };
  });

  const openOpportunities = opportunities.filter((item) => item.status === "open");
  const totalPipeline = openOpportunities.reduce((sum, item) => sum + item.amount, 0);
  const averageOpenAmount = openOpportunities.length
    ? openOpportunities.reduce((sum, item) => sum + item.amount, 0) / openOpportunities.length
    : 0;
  const now = new Date();

  const attentionRows = openOpportunities.map((item) => {
    let score = 0;
    const nextStep = (item.nextStep ?? "").trim().toLowerCase();
    const stage = item.stage.toLowerCase();
    const hasPlaceholderStep = !nextStep || nextStep.includes("atualizar") || nextStep.includes("definir");

    if (hasPlaceholderStep && (stage.includes("proposta") || stage.includes("negoc") || stage.includes("fech"))) {
      score += 26;
    }

    if (!activeTaskByOpportunity.has(item.id)) {
      score += 12;
    }

    const expectedClose = parseIsoDate(item.expectedCloseDate);
    if (expectedClose) {
      const closeDiffDays = dayDiff(now, expectedClose);
      if (closeDiffDays < 0) {
        score += 32;
      } else if (closeDiffDays <= 3) {
        score += activeTaskByOpportunity.has(item.id) ? 12 : 20;
      }
    }

    const interactionRaw = latestActivityByOpportunity.get(item.id) ?? item.createdAt;
    const interactionDate = parseIsoDate(interactionRaw);
    if (interactionDate) {
      const withoutInteraction = Math.max(0, dayDiff(interactionDate, now));
      const staleLimit = getStageStaleLimit(item.stage);
      if (withoutInteraction > staleLimit) {
        score += Math.min(35, 14 + (withoutInteraction - staleLimit) * 2);
      }
    }

    if (averageOpenAmount > 0 && item.amount >= averageOpenAmount * 1.5 && score > 0) {
      score += 8;
    }

    const boundedScore = Math.min(100, Math.max(0, score));
    return {
      ...item,
      attentionScore: boundedScore,
      attentionLevel: computeAttentionLevel(boundedScore)
    };
  });

  const attentionSummary = attentionRows.reduce(
    (acc, row) => {
      if (row.attentionLevel === "Critical") acc.critical += 1;
      if (row.attentionLevel === "High") acc.high += 1;
      if (row.attentionLevel === "Medium") acc.medium += 1;
      if (row.attentionLevel === "Low") acc.low += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  const pipelineByStage = openOpportunities.reduce(
    (acc, item) => {
      const current = acc.get(item.stage) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += item.amount;
      acc.set(item.stage, current);
      return acc;
    },
    new Map<string, { count: number; amount: number }>()
  );

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([842, 595]);
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const margin = 36;
  const baseLineHeight = 14;
  let cursorY = pageHeight - margin;

  function ensureSpace(lines = 1) {
    const needed = lines * baseLineHeight;
    if (cursorY - needed > 42) {
      return;
    }

    page = pdf.addPage([842, 595]);
    cursorY = pageHeight - margin;
  }

  function drawTextLine(text: string, size = 10, isBold = false, color = rgb(0.12, 0.16, 0.22)) {
    ensureSpace(1.2);
    page.drawText(text, {
      x: margin,
      y: cursorY,
      size,
      font: isBold ? boldFont : regularFont,
      color
    });
    cursorY -= baseLineHeight;
  }

  function drawSectionTitle(title: string) {
    cursorY -= 4;
    drawTextLine(title, 12, true, rgb(0.08, 0.18, 0.35));
    cursorY -= 2;
  }

  function drawDivider() {
    ensureSpace(1);
    page.drawLine({
      start: { x: margin, y: cursorY },
      end: { x: pageWidth - margin, y: cursorY },
      thickness: 0.6,
      color: rgb(0.82, 0.85, 0.9)
    });
    cursorY -= 10;
  }

  function drawTable(headers: string[], rows: string[][], widths: number[]) {
    const tableWidth = pageWidth - margin * 2;
    const xPositions: number[] = [];
    let x = margin;
    widths.forEach((ratio) => {
      xPositions.push(x);
      x += tableWidth * ratio;
    });

    ensureSpace(2);
    headers.forEach((header, index) => {
      const cellWidth = tableWidth * widths[index];
      page.drawText(truncateText(header, Math.max(4, Math.floor(cellWidth / 7))), {
        x: xPositions[index],
        y: cursorY,
        size: 9,
        font: boldFont,
        color: rgb(0.1, 0.12, 0.18)
      });
    });
    cursorY -= 12;
    drawDivider();

    rows.forEach((row) => {
      ensureSpace(1.4);
      row.forEach((cell, index) => {
        const cellWidth = tableWidth * widths[index];
        page.drawText(truncateText(cell, Math.max(5, Math.floor(cellWidth / 6.6))), {
          x: xPositions[index],
          y: cursorY,
          size: 8.5,
          font: regularFont,
          color: rgb(0.14, 0.16, 0.2)
        });
      });
      cursorY -= 12;
    });
    cursorY -= 4;
  }

  drawTextLine("Relatorio Executivo - Dashboard CRM", 16, true);
  drawTextLine(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 9, false, rgb(0.32, 0.35, 0.42));
  drawTextLine(`Usuario: ${profile.full_name || user.email || "Equipe"}`, 9, false, rgb(0.32, 0.35, 0.42));
  drawDivider();

  drawSectionTitle("Resumo Geral");
  drawTextLine(`Oportunidades totais: ${opportunities.length}`);
  drawTextLine(`Abertas: ${openOpportunities.length} | Conquistadas: ${opportunities.filter((o) => o.status === "won").length} | Perdidas: ${opportunities.filter((o) => o.status === "lost").length}`);
  drawTextLine(`Pipeline aberto: ${toCurrency(totalPipeline)}`);
  drawDivider();

  drawSectionTitle("Pipeline por Etapa (abertas)");
  const pipelineRows = Array.from(pipelineByStage.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([stage, data]) => [stage, String(data.count), toCurrency(data.amount)]);
  drawTable(["Etapa", "Qtd", "Valor"], pipelineRows.length ? pipelineRows : [["Sem dados", "0", toCurrency(0)]], [0.52, 0.14, 0.34]);
  drawDivider();

  drawSectionTitle("Situacao (Risco)");
  drawTextLine(`Critical: ${attentionSummary.critical} | High: ${attentionSummary.high} | Medium: ${attentionSummary.medium} | Low: ${attentionSummary.low}`);
  drawDivider();

  drawSectionTitle("Oportunidades");
  const topRows = attentionRows
    .sort((a, b) => {
      if (b.attentionScore !== a.attentionScore) return b.attentionScore - a.attentionScore;
      return b.amount - a.amount;
    })
    .slice(0, 30)
    .map((row) => [
      row.title,
      row.company,
      row.stage,
      toCurrency(row.amount),
      `${row.attentionLevel} (${row.attentionScore})`
    ]);
  drawTable(
    ["Titulo", "Empresa", "Etapa", "Valor", "Situacao"],
    topRows.length ? topRows : [["Sem oportunidades", "-", "-", toCurrency(0), "-"]],
    [0.25, 0.22, 0.18, 0.15, 0.2]
  );

  const pdfBytes = await pdf.save();
  const fileDate = new Date().toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"dashboard-relatorio-${fileDate}.pdf\"`,
      "Cache-Control": "no-store"
    }
  });
}
