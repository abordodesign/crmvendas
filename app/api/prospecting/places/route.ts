import { NextRequest, NextResponse } from "next/server";

type GooglePlacesSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    rating?: number;
    websiteUri?: string;
    googleMapsUri?: string;
    businessStatus?: string;
  }>;
};

function clampLimit(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return 10;
  }

  return Math.min(20, Math.max(1, Math.floor(numberValue)));
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY nao configurada no servidor." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    term?: string;
    region?: string;
    segment?: string;
    limit?: number;
  };

  const term = (body.term ?? "").trim();
  const region = (body.region ?? "").trim();
  const segment = (body.segment ?? "").trim();
  const limit = clampLimit(body.limit);

  if (!term) {
    return NextResponse.json({ error: "Informe um termo de busca." }, { status: 400 });
  }

  const textQuery = [term, region].filter(Boolean).join(" em ");

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.websiteUri,places.googleMapsUri,places.businessStatus"
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "pt-BR",
      regionCode: "BR",
      maxResultCount: limit,
      includedType: segment || undefined
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    if (response.status === 429) {
      return NextResponse.json(
        { error: "Limite da API do Google atingido. Tente novamente em alguns minutos." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Nao foi possivel consultar empresas no Google agora." },
      { status: 502 }
    );
  }

  const payload = (await response.json()) as GooglePlacesSearchResponse;
  const items = (payload.places ?? []).map((place, index) => ({
    id: place.id ?? `result-${index}`,
    name: place.displayName?.text ?? "Sem nome",
    address: place.formattedAddress ?? "",
    phone: place.nationalPhoneNumber ?? "",
    rating: typeof place.rating === "number" ? place.rating : null,
    website: place.websiteUri ?? "",
    mapsUrl: place.googleMapsUri ?? "",
    businessStatus: place.businessStatus ?? ""
  }));

  return NextResponse.json({ items });
}
