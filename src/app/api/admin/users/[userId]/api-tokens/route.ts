import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { issueApiToken, listApiTokens, validateApiTokenScopes } from "@/lib/api-tokens";
import { getUserPermissions, requireAdminUser } from "@/lib/permissions";
import type { UserPermissions } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth.errorResponse) return auth.errorResponse;
  const { userId } = await context.params;
  const user = getDb().prepare("SELECT id FROM users WHERE id=?").get(userId);
  if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const tokens = listApiTokens(userId).map((token) => ({
    id: token.id, label: token.label, scopes: JSON.parse(token.scopesJson), expiresAt: token.expiresAt,
    createdAt: token.createdAt, lastUsedAt: token.lastUsedAt, revokedAt: token.revokedAt,
  }));
  return NextResponse.json({ tokens }, { headers: { "Cache-Control": "no-store" } });
}

function scopeAllowedByFeatures(scope: string, permissions: UserPermissions): boolean {
  if (scope.startsWith("ads:")) return permissions.meta_ads || permissions.tiktok_ads;
  if (scope.startsWith("social:")) return permissions.instagram || permissions.facebook_social || permissions.tiktok_organic;
  if (scope.startsWith("whatsapp:")) return permissions.whatsapp;
  if (scope.startsWith("calendar:") || scope === "booking:create") return permissions.google_calendar;
  if (scope.startsWith("catalog:")) return permissions.catalog;
  return true;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth.errorResponse) return auth.errorResponse;
  const { userId } = await context.params;
  const user = getDb().prepare("SELECT id FROM users WHERE id=? AND is_active=1").get(userId);
  if (!user) return NextResponse.json({ error: "Usuário não encontrado ou suspenso." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Envie os dados do token em JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const label = typeof input.label === "string" ? input.label.trim().slice(0, 60) : "";
  const scopes = validateApiTokenScopes(input.scopes);
  const expiresInDays = input.expiresInDays;
  if (!label) return NextResponse.json({ error: "Dê um nome para identificar onde o token será usado." }, { status: 400 });
  if (!scopes) return NextResponse.json({ error: "Selecione pelo menos uma permissão válida." }, { status: 400 });
  if (![7, 30, 90, 180, 365].includes(expiresInDays as number)) return NextResponse.json({ error: "Escolha uma validade entre 7 e 365 dias." }, { status: 400 });
  const permissions = getUserPermissions(userId);
  const denied = scopes.filter((scope) => !scopeAllowedByFeatures(scope, permissions));
  if (denied.length) return NextResponse.json({ error: "Algumas permissões do token não estão liberadas para este usuário." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const issued = issueApiToken({ ownerId: userId, createdBy: auth.user.id, label, scopes, expiresInDays: expiresInDays as number });
    return NextResponse.json({ token: issued.token, id: issued.id, expiresAt: issued.expiresAt }, { status: 201, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar o token." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
