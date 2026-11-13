import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  CatalogError,
  CatalogItemInput,
  createCatalogItemForOwner,
  listCatalogItemsForOwner,
} from "@/lib/catalog";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const items = listCatalogItemsForOwner(id, user.id);
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof CatalogError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível carregar o catálogo." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
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
    const { item, slug } = createCatalogItemForOwner(
      id,
      user.id,
      body as CatalogItemInput
    );
    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/agendar`);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof CatalogError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível criar o item do catálogo." },
      { status: 500 }
    );
  }
}

