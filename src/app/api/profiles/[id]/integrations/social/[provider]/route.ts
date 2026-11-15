import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  disconnectSocialConnection,
  getSocialConnectionView,
  isOrganicSocialProvider,
  isSocialProvider,
  listProfileSocialMedia,
  SocialValidationError,
  updatePublicSocialMediaSelection,
} from "@/lib/composio-social";
import { getProfileByIdForOwner } from "@/lib/profiles";
import {
  requireUserFeature,
  socialProviderToFeatureKey,
} from "@/lib/permissions";

export async function GET(
  _request: Request,
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
  const denied = await requireUserFeature(
    user.id,
    socialProviderToFeatureKey(provider)
  );
  if (denied) return denied;

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

  const connection = getSocialConnectionView(check.profile.id, provider);
  const media = isOrganicSocialProvider(provider)
    ? listProfileSocialMedia(check.profile.id, provider)
    : [];

  return NextResponse.json({ connection, media });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; provider: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, provider } = await context.params;
  if (!isOrganicSocialProvider(provider)) {
    return NextResponse.json(
      { error: "Seleção de mídia pública disponível apenas para Instagram e TikTok." },
      { status: 400 }
    );
  }
  const denied = await requireUserFeature(
    user.id,
    socialProviderToFeatureKey(provider)
  );
  if (denied) return denied;

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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const rawIds = Array.isArray(body?.publicExternalIds)
    ? body.publicExternalIds
    : Array.isArray(body?.selectedExternalIds)
      ? body.selectedExternalIds
      : null;

  if (!rawIds || !rawIds.every((item) => typeof item === "string")) {
    return NextResponse.json(
      { error: "Informe publicExternalIds como uma lista de identificadores." },
      { status: 400 }
    );
  }

  try {
    const media = updatePublicSocialMediaSelection({
      profileId: check.profile.id,
      ownerId: user.id,
      provider,
      selectedExternalIds: rawIds,
    });
    return NextResponse.json({ media });
  } catch (err) {
    if (err instanceof SocialValidationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível salvar a seleção de mídias públicas." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
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
  const denied = await requireUserFeature(
    user.id,
    socialProviderToFeatureKey(provider)
  );
  if (denied) return denied;

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

  const connection = await disconnectSocialConnection({
    profileId: check.profile.id,
    ownerId: user.id,
    provider,
  });

  return NextResponse.json({ connection });
}
