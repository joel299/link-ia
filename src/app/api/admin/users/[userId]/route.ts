import { NextResponse } from "next/server";
import {
  getUserForAdmin,
  updateClientUserByAdmin,
} from "@/lib/admin-users";
import { requireAdminUser } from "@/lib/permissions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminUser();
  if (auth.errorResponse) return auth.errorResponse;

  const { userId } = await context.params;
  const user = getUserForAdmin(userId);
  if (!user) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({ user });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminUser();
  if (auth.errorResponse) return auth.errorResponse;

  const { userId } = await context.params;

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
  if (record.role !== undefined) {
    return NextResponse.json(
      { error: "Não é permitido alterar o papel do usuário por esta rota." },
      { status: 403 }
    );
  }

  if (
    record.isActive !== undefined &&
    typeof record.isActive !== "boolean"
  ) {
    return NextResponse.json(
      { error: "O campo isActive deve ser booleano." },
      { status: 400 }
    );
  }

  if (
    record.permissions !== undefined &&
    (typeof record.permissions !== "object" ||
      record.permissions === null ||
      Array.isArray(record.permissions))
  ) {
    return NextResponse.json(
      { error: "O campo permissions deve ser um objeto." },
      { status: 400 }
    );
  }

  const result = updateClientUserByAdmin(auth.user.id, userId, {
    isActive:
      typeof record.isActive === "boolean" ? record.isActive : undefined,
    permissions: record.permissions,
  });

  if (!result.user) {
    return NextResponse.json(
      { error: result.error ?? "Não foi possível atualizar o usuário." },
      { status: result.status }
    );
  }

  return NextResponse.json({ user: result.user });
}

