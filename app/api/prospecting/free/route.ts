import { NextRequest, NextResponse } from "next/server";

type NominatimItem = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  name?: string;
  class?: string;
  type?: string;
  lat?: string;
  lon?: string;
};

function clampLimit(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 10;
  }

  return Math.min(20, Math.max(1, Math.floor(numberValue)));
}

function getPlaceName(item: NominatimItem) {
  const directName = (item.name ?? "").trim();

  if (directName) {
    return directName;
  }

  const fromDisplay = (item.display_name ?? "").split(",")[0]?.trim();
  return fromDisplay || "Sem nome";
}

function buildOsmUrl(item: NominatimItem) {
  const type = (item.osm_type ?? "").trim();
  const id = item.osm_id;

  if (!type || !id) {
    return "";
  }

  return `https://www.openstreetmap.org/${type}/${id}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    term?: string;
    region?: string;
    limit?: number;
  };

  const term = (body.term ?? "").trim();
  const region = (body.region ?? "").trim();
  const limit = clampLimit(body.limit);

  if (!term) {
    return NextResponse.json({ error: "Informe um termo de busca." }, { status: 400 });
  }

  const query = [term, region].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "br",
    addressdetails: "1",
    limit: String(limit)
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    method: "GET",
    headers: {
      "Accept-Language": "pt-BR",
      "User-Agent": "CRMVendas/1.0 (OpenStreetMap Prospecting)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    if (response.status === 429) {
      return NextResponse.json(
        { error: "Limite de consultas da fonte gratuita atingido. Aguarde e tente novamente." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Nao foi possivel consultar empresas na fonte gratuita agora." },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as NominatimItem[];
  const items = payload.map((item, index) => ({
    id: String(item.place_id ?? `result-${index}`),
    name: getPlaceName(item),
    address: (item.display_name ?? "").trim(),
    category: [item.class, item.type].filter(Boolean).join("/"),
    latitude: item.lat ? Number(item.lat) : null,
    longitude: item.lon ? Number(item.lon) : null,
    osmUrl: buildOsmUrl(item)
  }));

  return NextResponse.json({ items });
}
