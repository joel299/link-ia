import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/permissions";
import { getAdminSystemPrompt } from "@/lib/codex-ai";
import { getDb } from "@/lib/db";

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.errorResponse) return auth.errorResponse;
  return NextResponse.json({ systemPrompt: getAdminSystemPrompt() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const auth = await requireAdminUser();
  if (auth.errorResponse) return auth.errorResponse;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const prompt = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).systemPrompt : null;
  if (typeof prompt !== "string" || prompt.trim().length < 20 || prompt.length > 12000) {
    return NextResponse.json({ error: "O prompt precisa ter entre 20 e 12.000 caracteres." }, { status: 400 });
  }
  getDb().prepare(`INSERT INTO ai_agent_settings (setting_key, value, updated_by, updated_at) VALUES ('system_prompt', ?, ?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
    .run(prompt.trim(), auth.user.id, new Date().toISOString());
  return NextResponse.json({ saved: true });
}
