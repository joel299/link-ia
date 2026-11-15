import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteCustomLink, updateCustomLink } from "@/lib/custom-links";
import { getProfileByIdForOwner } from "@/lib/profiles";
import type { CustomLinkIconType } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; linkId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, linkId } = await context.params;
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const result = updateCustomLink(check.profile.id, linkId, user.id, {
    title: typeof record.title === "string" ? record.title : undefined,
    url: typeof record.url === "string" ? record.url : undefined,
    description:
      typeof record.description === "string" ? record.description : undefined,
    iconType:
      typeof record.iconType === "string"
        ? (record.iconType as CustomLinkIconType)
        : undefined,
    isActive:
      typeof record.isActive === "boolean" ? record.isActive : undefined,
  });

  if (!result.item) {
    return NextResponse.json(
      {
        error:
          result.errors?._form ?? "Não foi possível atualizar o link.",
        errors: result.errors,
      },
      { status: result.status ?? 422 }
    );
  }

  return NextResponse.json({ item: result.item });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; linkId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, linkId } = await context.params;
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

  const result = deleteCustomLink(check.profile.id, linkId, user.id);
  if (!result.deleted) {
    return NextResponse.json(
      { error: result.error ?? "Link não encontrado." },
      { status: result.status }
    );
  }

  return NextResponse.json({ deleted: true });
}

