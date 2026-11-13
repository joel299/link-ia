import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getSessionUser } from "@/lib/auth";
import { ComposioConfigError, ComposioProviderError } from "@/lib/composio";
import { getProfileByIdForOwner } from "@/lib/profiles";
import { initiateCalendarConnection } from "@/lib/scheduling";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const check = getProfileByIdForOwner(id, user.id);
  if (check.error === "not_found") {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }
  if (check.error === "forbidden" || !check.profile) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const result = await initiateCalendarConnection({
      profileId: check.profile.id,
      ownerId: user.id,
      origin: getAppBaseUrl(request.url).origin,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ComposioConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof ComposioProviderError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error(
      "[google-calendar/connect]",
      err instanceof Error ? err.message : "Erro desconhecido"
    );
    return NextResponse.json(
      { error: "Não foi possível iniciar a conexão com o Google Agenda." },
      { status: 500 }
    );
  }
}
