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

type CnpjWsCompany = {
  razao_social?: string;
  estabelecimento?: {
    cnpj?: string;
    nome_fantasia?: string;
    atividade_principal?: { descricao?: string };
    telefone1?: string;
    email?: string;
    tipo_logradouro?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: { nome?: string };
    estado?: { sigla?: string };
    cep?: string;
  };
  socios?: Array<{ nome?: string }>;
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

type LookupResult = {
  document: string;
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
};

function mapBrasilApi(company: BrasilApiCompany, fallbackCnpj: string): LookupResult {
  const phone = company.ddd_telefone_1?.trim() || "";
  const contactName = company.qsa?.[0]?.nome_socio?.trim() || "";

  return {
    document: formatCnpj(company.cnpj || fallbackCnpj),
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
  };
}

function mapCnpjWs(company: CnpjWsCompany, fallbackCnpj: string): LookupResult {
  const est = company.estabelecimento;

  return {
    document: formatCnpj(est?.cnpj || fallbackCnpj),
    legalName: (company.razao_social ?? "").trim(),
    tradeName: (est?.nome_fantasia ?? "").trim(),
    segment: (est?.atividade_principal?.descricao ?? "").trim(),
    companyContactName: (company.socios?.[0]?.nome ?? "").trim(),
    phone: (est?.telefone1 ?? "").trim(),
    email: (est?.email ?? "").trim(),
    address: joinAddressParts([est?.tipo_logradouro, est?.logradouro, est?.numero, est?.bairro]),
    city: (est?.cidade?.nome ?? "").trim(),
    state: (est?.estado?.sigla ?? "").trim(),
    zipCode: formatZipCode(est?.cep)
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ cnpj: string }> }) {
  const params = await context.params;
  const digits = onlyDigits(params.cnpj ?? "");

  if (digits.length !== 14) {
    return NextResponse.json({ error: "CNPJ invalido. Informe 14 digitos." }, { status: 400 });
  }

  try {
    const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      method: "GET",
      cache: "no-store"
    });

    if (brasilApiResponse.ok) {
      const company = (await brasilApiResponse.json()) as BrasilApiCompany;
      return NextResponse.json(mapBrasilApi(company, digits));
    }

    if (brasilApiResponse.status === 404) {
      return NextResponse.json({ error: "CNPJ nao encontrado." }, { status: 404 });
    }

    const cnpjWsResponse = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`, {
      method: "GET",
      cache: "no-store"
    });

    if (cnpjWsResponse.ok) {
      const company = (await cnpjWsResponse.json()) as CnpjWsCompany;
      return NextResponse.json(mapCnpjWs(company, digits));
    }

    if (cnpjWsResponse.status === 404) {
      return NextResponse.json({ error: "CNPJ nao encontrado." }, { status: 404 });
    }

    if (brasilApiResponse.status === 429 || cnpjWsResponse.status === 429) {
      return NextResponse.json(
        { error: "Limite de consultas atingido no momento. Tente novamente em alguns minutos." },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: "Nao foi possivel consultar este CNPJ agora." }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Falha ao consultar CNPJ. Tente novamente." }, { status: 502 });
  }
}
