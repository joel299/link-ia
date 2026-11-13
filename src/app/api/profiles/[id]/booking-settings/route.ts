import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getProfileByIdForOwner } from "@/lib/profiles";
import {
  getBookingSettings,
  SchedulingError,
  upsertBookingSettings,
} from "@/lib/scheduling";

export async function GET(
  _request: Request,
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

  const settings = getBookingSettings(check.profile.id);
  return NextResponse.json({ settings });
}

export async function PUT(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição JSON inválido." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  try {
    const result = upsertBookingSettings(
      check.profile.id,
      body as Record<string, unknown>
    );

    if (!result.settings) {
      return NextResponse.json(
        {
          error: "Verifique as configurações de agendamento.",
          errors: result.errors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ settings: result.settings });
  } catch (err) {
    if (err instanceof SchedulingError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível salvar as configurações de agendamento." },
      { status: 500 }
    );
  }
}
