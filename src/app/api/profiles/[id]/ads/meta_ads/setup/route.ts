import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  ensureMetaAdsAuthConfig,
  getMetaAdsEnvValidation,
  MetaAdsConfigError,
} from "@/lib/meta-ads-config";
import { getProfileByIdForOwner } from "@/lib/profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = getProfileByIdForOwner(id, user.id);
  if (result.error === "not_found") {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }
  if (result.error === "forbidden" || !result.profile) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  if (result.profile.status !== "published") {
    return NextResponse.json(
      { error: "Publique este perfil para configurar o tráfego pago." },
      { status: 409 }
    );
  }

  const validation = getMetaAdsEnvValidation();
  return NextResponse.json({
    toolkit: "metaads",
    authScheme: "OAUTH2",
    hasApiKey: validation.hasApiKey,
    hasAuthConfigId: validation.hasAuthConfigId,
    hasClientId: validation.hasClientId,
    hasClientSecret: validation.hasClientSecret,
    redirectUri: validation.redirectUri,
    missingForConnection: validation.missingForConnection,
    missingForAuthConfigCreation: validation.missingForAuthConfigCreation,
  });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = getProfileByIdForOwner(id, user.id);
  if (result.error === "not_found") {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }
  if (result.error === "forbidden" || !result.profile) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }
  if (result.profile.status !== "published") {
    return NextResponse.json(
      { error: "Publique este perfil para configurar o tráfego pago." },
      { status: 409 }
    );
  }

  try {
    const ensured = await ensureMetaAdsAuthConfig({
      profileId: id,
      ownerId: user.id,
    });
    return NextResponse.json({
      ok: true,
      authConfigId: ensured.authConfigId,
      source: ensured.source,
      created: ensured.created,
      redirectUri: ensured.redirectUri,
      scopes: ensured.scopes,
      envHint:
        ensured.source === "env"
          ? "COMPOSIO_META_ADS_AUTH_CONFIG_ID já está definido no ambiente."
          : "Salve o authConfigId retornado na variável COMPOSIO_META_ADS_AUTH_CONFIG_ID do .env / Coolify.",
    });
  } catch (err) {
    if (err instanceof MetaAdsConfigError) {
      return NextResponse.json(
        {
          error: err.message,
          missingVariables: err.missingVariables,
        },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      {
        error:
          "Não foi possível configurar a Auth Config do Meta Ads no Composio. Verifique as credenciais do servidor.",
      },
      { status: 502 }
    );
  }
}

