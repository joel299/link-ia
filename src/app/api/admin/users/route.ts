import { NextResponse } from "next/server";
import {
  createClientUserByAdmin,
  listUsersForAdmin,
} from "@/lib/admin-users";
import { requireAdminUser } from "@/lib/permissions";

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.errorResponse) return auth.errorResponse;

  const users = listUsersForAdmin();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth.errorResponse) return auth.errorResponse;

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
  if (record.role !== undefined && record.role !== "client") {
    return NextResponse.json(
      { error: "Não é permitido definir o papel administrativo por esta rota." },
      { status: 403 }
    );
  }

  const result = createClientUserByAdmin(auth.user.id, {
    name: typeof record.name === "string" ? record.name : "",
    email: typeof record.email === "string" ? record.email : "",
    password: typeof record.password === "string" ? record.password : "",
    isActive: typeof record.isActive === "boolean" ? record.isActive : true,
    permissions: record.permissions,
  });

  if (!result.user) {
    return NextResponse.json(
      { error: result.error ?? "Não foi possível criar o usuário." },
      { status: result.status }
    );
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}

