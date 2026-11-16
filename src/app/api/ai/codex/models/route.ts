import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCodexModels } from "@/lib/codex-ai";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const models = await getCodexModels(user.id);
    return NextResponse.json({ models }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível consultar os modelos Codex." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
