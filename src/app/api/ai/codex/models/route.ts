import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCodexAccessToken } from "@/lib/codex-ai";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const token = await getCodexAccessToken(user.id);
    const response = await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível carregar os modelos disponíveis para esta conta." }, { status: 502 });
    const payload = await response.json() as { data?: Array<{ id?: unknown; display_name?: unknown }> };
    const models = (payload.data || []).filter((model) => typeof model.id === "string").map((model) => ({ id: model.id as string, label: typeof model.display_name === "string" ? model.display_name : model.id as string }));
    return NextResponse.json({ models }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar os modelos." }, { status: 400 });
  }
}
