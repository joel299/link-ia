import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCodexConnectionStatus, isCodexOAuthConfigured, revokeCodexConnection } from "@/lib/codex-ai";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json({ ...getCodexConnectionStatus(user.id), configured: isCodexOAuthConfigured() }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  revokeCodexConnection(user.id);
  return NextResponse.json({ disconnected: true });
}
