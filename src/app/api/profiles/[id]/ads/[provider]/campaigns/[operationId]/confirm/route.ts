import { NextResponse } from "next/server";
import {
  AdsServiceError,
  confirmCampaignOperationForOwner,
  isAdsProvider,
} from "@/lib/ads-service";
import { getSessionUser } from "@/lib/auth";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string; provider: string; operationId: string }>;
  }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, provider, operationId } = await context.params;
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

  const payload = body as { action?: unknown; confirmed?: unknown };
  if (payload.action !== "create_paused" && payload.action !== "activate") {
    return NextResponse.json(
      { error: "Ação inválida. Use 'create_paused' ou 'activate'." },
      { status: 400 }
    );
  }

  if (payload.confirmed !== true) {
    return NextResponse.json(
      {
        error:
          "Confirmação explícita (confirmed: true) é obrigatória para criar ou ativar campanha.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await confirmCampaignOperationForOwner({
      profileId: id,
      ownerId: user.id,
      provider,
      operationId,
      action: payload.action,
      confirmed: true,
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
      { error: "Não foi possível confirmar a operação da campanha." },
      { status: 500 }
    );
  }
}
