import { NextResponse } from "next/server";
import { authenticateUser, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição JSON inválido." },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  const result = authenticateUser(email, password);
  if (!result.user) {
    return NextResponse.json(
      { error: result.error ?? "Credenciais inválidas." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ user: result.user });
  await setSessionCookie(result.user, response);
  return response;
}
