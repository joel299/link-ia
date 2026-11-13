import { NextResponse } from "next/server";
import { registerUser, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
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
      { error: result.error ?? "Não foi possível criar a conta." },
      { status: result.status ?? 400 }
    );
  }

  const response = NextResponse.json({ user: result.user }, { status: 201 });
  await setSessionCookie(result.user, response);
  return response;
}
