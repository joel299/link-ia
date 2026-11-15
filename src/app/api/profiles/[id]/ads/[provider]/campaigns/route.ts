import { NextResponse } from "next/server";
import {
  AdsServiceError,
  createCampaignDraftForOwner,
  type CreateCampaignDraftInput,
  isAdsProvider,
} from "@/lib/ads-service";
import { getSessionUser } from "@/lib/auth";

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

  try {
    const { operation, idempotent } = createCampaignDraftForOwner({
      profileId: id,
      ownerId: user.id,
      provider,
      input: body as Partial<CreateCampaignDraftInput>,
    });

    return NextResponse.json(
      { operation, idempotent },
      { status: idempotent ? 200 : 201 }
    );
  } catch (err) {
    if (err instanceof AdsServiceError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível criar o rascunho de campanha." },
      { status: 500 }
    );
  }
}
