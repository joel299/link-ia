import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getSessionUser } from "@/lib/auth";
import {
  initiateSocialConnection,
  isSocialProvider,
  SocialConfigError,
  SocialProviderError,
} from "@/lib/composio-social";
import {
  ensureMetaAdsAuthConfig,
  MetaAdsConfigError,
} from "@/lib/meta-ads-config";
import { getProfileByIdForOwner } from "@/lib/profiles";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; provider: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, provider } = await context.params;
  if (!isSocialProvider(provider)) {
    return NextResponse.json(
      { error: "Provedor social inválido." },
      { status: 400 }
    );
  }

  const check = getProfileByIdForOwner(id, user.id);
  if (check.error === "not_found") {
    return NextResponse.json(
      { error: "Perfil não encontrado." },
      { status: 404 }
    );
  }
  if (check.error === "forbidden" || !check.profile) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  if (
    (provider === "meta_ads" || provider === "tiktok_ads") &&
    check.profile.status !== "published"
  ) {
    return NextResponse.json(
      { error: "Publique este perfil para configurar o tráfego pago." },
      { status: 409 }
    );
  }

  try {
    if (provider === "meta_ads") {
      await ensureMetaAdsAuthConfig({
        profileId: check.profile.id,
        ownerId: user.id,
      });
    }

    const result = await initiateSocialConnection({
      profileId: check.profile.id,
      ownerId: user.id,
      provider,
      origin: getAppBaseUrl(request.url).origin,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SocialConfigError) {
      return NextResponse.json(
        {
          error: err.message,
          status: "pending_config",
          configRequirements: err.configRequirements,
        },
        { status: 503 }
      );
    }
    if (err instanceof SocialProviderError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    if (err instanceof MetaAdsConfigError) {
      return NextResponse.json(
        { error: err.message, missingVariables: err.missingVariables },
        { status: err.statusCode }
      );
    }
    console.error(
      `[social/${provider}/connect]`,
      err instanceof Error ? err.message : "Erro desconhecido"
    );
    return NextResponse.json(
      { error: "Não foi possível iniciar a conexão social." },
      { status: 500 }
    );
  }
}
