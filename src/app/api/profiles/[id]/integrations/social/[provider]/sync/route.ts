import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  isOrganicSocialProvider,
  SocialConfigError,
  SocialProviderError,
  SocialValidationError,
  syncSocialMedia,
} from "@/lib/composio-social";
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
  if (!isOrganicSocialProvider(provider)) {
    return NextResponse.json(
      { error: "Sincronização de mídia disponível apenas para Instagram e TikTok." },
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

  let force = true;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body?.force === "boolean") {
      force = body.force;
    }
  } catch {
    // Empty body is valid for on-demand sync.
  }

  try {
    const result = await syncSocialMedia({
      profileId: check.profile.id,
      ownerId: user.id,
      provider,
      force,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SocialValidationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
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
    console.error(
      `[social/${provider}/sync]`,
      err instanceof Error ? err.message : "Erro desconhecido"
    );
    return NextResponse.json(
      { error: "Não foi possível sincronizar as mídias." },
      { status: 500 }
    );
  }
}
