import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { CODEX_EFFORTS, CODEX_MODELS, isCodexConnected } from "@/lib/codex-ai";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await isCodexConnected(user.id))) return NextResponse.json({ error: "Conecte sua conta Codex para consultar os modelos." }, { status: 409 });
  return NextResponse.json({ models: CODEX_MODELS, efforts: CODEX_EFFORTS }, { headers: { "Cache-Control": "no-store" } });
}
