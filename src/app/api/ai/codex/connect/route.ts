import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { startCodexDeviceLogin } from "@/lib/codex-ai";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  try {
    const login = await startCodexDeviceLogin(user.id);
    return NextResponse.json(login, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível iniciar o login do Codex neste servidor. Verifique a instalação do Codex CLI." }, { status: 503 });
  }
}
