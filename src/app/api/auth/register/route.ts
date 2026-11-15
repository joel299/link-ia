import { NextResponse } from "next/server";
import { isAdminAuthorizedRequest, registerUser } from "@/lib/auth";

export async function POST(request: Request) {
  const authorized = await isAdminAuthorizedRequest(request);
  if (!authorized) {
    return NextResponse.json(
      {
        error:
          "Cadastro público desativado. Contas são provisionadas pela administração do LinkIA.",
      },
      { status: 403 }
    );
  }

  let body: { email?: unknown; name?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição JSON inválido." },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email : "";
  const name = typeof body.name === "string" ? body.name : "";
  const password = typeof body.password === "string" ? body.password : "";

  const result = registerUser(email, name, password);
  if (!result.user) {
    return NextResponse.json(
      { error: result.error ?? "Não foi possível provisionar a conta." },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ user: result.user }, { status: 201 });
}
