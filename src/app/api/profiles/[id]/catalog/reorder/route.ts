import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { CatalogError, reorderCatalogItemsForOwner } from "@/lib/catalog";

export async function PUT(
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

  const orderedIds =
    typeof body === "object" && body !== null && "orderedIds" in body
      ? (body as { orderedIds: unknown }).orderedIds
      : null;

  if (!Array.isArray(orderedIds)) {
    return NextResponse.json(
      { error: "Informe 'orderedIds' como lista de IDs." },
      { status: 400 }
    );
  }

  try {
    const { items, slug } = reorderCatalogItemsForOwner(
      id,
      user.id,
      orderedIds as string[]
    );
    revalidatePath(`/${slug}`);
    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof CatalogError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível reordenar o catálogo." },
      { status: 500 }
    );
  }
}

