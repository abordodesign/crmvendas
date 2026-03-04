import { NextRequest, NextResponse } from "next/server";

type BrasilApiCompany = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnae_fiscal_descricao?: string;
  ddd_telefone_1?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  qsa?: Array<{ nome_socio?: string }>;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatZipCode(value: string | undefined) {
  const digits = onlyDigits(value ?? "");

  if (digits.length !== 8) {
    return value ?? "";
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value);

  if (digits.length !== 14) {
    return value;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function joinAddressParts(parts: Array<string | undefined>) {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export async function GET(_request: NextRequest, context: { params: Promise<{ cnpj: string }> }) {
  const params = await context.params;
  const digits = onlyDigits(params.cnpj ?? "");

  if (digits.length !== 14) {
    return NextResponse.json({ error: "CNPJ invalido. Informe 14 digitos." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Nao foi possivel consultar este CNPJ agora." }, { status: response.status });
    }

    const company = (await response.json()) as BrasilApiCompany;
    const phone = company.ddd_telefone_1?.trim() || "";
    const contactName = company.qsa?.[0]?.nome_socio?.trim() || "";

    return NextResponse.json({
      document: formatCnpj(company.cnpj || digits),
      legalName: (company.razao_social ?? "").trim(),
      tradeName: (company.nome_fantasia ?? "").trim(),
      segment: (company.cnae_fiscal_descricao ?? "").trim(),
      companyContactName: contactName,
      phone,
      email: (company.email ?? "").trim(),
      address: joinAddressParts([company.logradouro, company.numero, company.bairro]),
      city: (company.municipio ?? "").trim(),
      state: (company.uf ?? "").trim(),
      zipCode: formatZipCode(company.cep)
    });
  } catch {
    return NextResponse.json({ error: "Falha ao consultar CNPJ. Tente novamente." }, { status: 502 });
  }
}
