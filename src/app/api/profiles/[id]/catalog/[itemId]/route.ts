import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  CatalogError,
  CatalogItemInput,
  deleteCatalogItemForOwner,
  updateCatalogItemForOwner,
} from "@/lib/catalog";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, itemId } = await context.params;
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
    const { item, slug } = updateCatalogItemForOwner(
      id,
      itemId,
      user.id,
      body as CatalogItemInput
    );
    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/agendar`);
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof CatalogError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível atualizar o item." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, itemId } = await context.params;
  try {
    const { slug } = deleteCatalogItemForOwner(id, itemId, user.id);
    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/agendar`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CatalogError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível excluir o item." },
      { status: 500 }
    );
  }
}

