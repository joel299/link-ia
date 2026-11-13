import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getProfileByIdForOwner } from "@/lib/profiles";
import {
  disconnectCalendarConnection,
  getCalendarConnectionView,
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

  const connection = getCalendarConnectionView(check.profile.id);
  return NextResponse.json({ connection });
}

export async function DELETE(
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

  const connection = await disconnectCalendarConnection({
    profileId: check.profile.id,
  });
  return NextResponse.json({ connection });
}
