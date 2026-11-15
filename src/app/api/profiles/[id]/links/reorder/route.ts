import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { reorderCustomLinks } from "@/lib/custom-links";
import { getProfileByIdForOwner } from "@/lib/profiles";

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

  const orderedIds =
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { orderedIds?: unknown }).orderedIds)
      ? ((body as { orderedIds: unknown[] }).orderedIds.filter(
          (item): item is string => typeof item === "string"
        ) as string[])
      : null;

  if (!orderedIds) {
    return NextResponse.json(
      { error: "Informe orderedIds como lista de IDs." },
      { status: 400 }
    );
  }

  const result = reorderCustomLinks(check.profile.id, user.id, orderedIds);
  if (!result.items) {
    return NextResponse.json(
      { error: result.error ?? "Não foi possível reordenar os links." },
      { status: result.status }
    );
  }

  return NextResponse.json({ items: result.items });
}

