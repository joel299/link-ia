import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { disconnectCodex, getCodexConnectionStatus } from "@/lib/codex-ai";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    return NextResponse.json(await getCodexConnectionStatus(user.id), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o estado da conta Codex." }, { status: 503 });
  }
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    await disconnectCodex(user.id);
    return NextResponse.json({ disconnected: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível desconectar a conta Codex." }, { status: 503 });
  }
}
