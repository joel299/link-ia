import { NextResponse } from "next/server";
import {
  AdsServiceError,
  getAdsOverviewForOwner,
  isAdsProvider,
  selectAdAccountForOwner,
  validateAdsDateRange,
} from "@/lib/ads-service";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; provider: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, provider } = await context.params;
  if (!isAdsProvider(provider)) {
    return NextResponse.json(
      { error: "Provedor de anúncios inválido. Use 'meta_ads' ou 'tiktok_ads'." },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const sync = url.searchParams.get("sync") === "1";

  try {
    const dateRange = validateAdsDateRange({
      datePreset: url.searchParams.get("datePreset"),
      since: url.searchParams.get("since"),
      until: url.searchParams.get("until"),
    });
    const overview = await getAdsOverviewForOwner({
      profileId: id,
      ownerId: user.id,
      provider,
      sync,
      dateRange,
    });
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof AdsServiceError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível carregar os dados de anúncios." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; provider: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, provider } = await context.params;
  if (!isAdsProvider(provider)) {
    return NextResponse.json(
      { error: "Provedor de anúncios inválido. Use 'meta_ads' ou 'tiktok_ads'." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const adAccountId = (body as { adAccountId?: unknown }).adAccountId;
  if (typeof adAccountId !== "string" || !adAccountId.trim()) {
    return NextResponse.json(
      { error: "Informe 'adAccountId' para selecionar a conta de anúncios." },
      { status: 400 }
    );
  }

  try {
    const result = await selectAdAccountForOwner({
      profileId: id,
      ownerId: user.id,
      provider,
      adAccountId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AdsServiceError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível selecionar a conta de anúncios." },
      { status: 500 }
    );
  }
}
