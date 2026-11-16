import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { exchangeAuthorizationCode, hashOAuthState, requirePlanScopes, upsertCodexConnection, verifyIdToken } from "@/lib/codex-ai";
import { getDb } from "@/lib/db";

function panelRedirect(result: string) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const url = new URL("/painel", base);
  url.searchParams.set("codex", result);
  url.hash = "ia";
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return panelRedirect("session_expired");
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  if (!state) return panelRedirect("invalid_state");
  const db = getDb();
  const tx = db.prepare("SELECT owner_id, nonce, code_verifier, redirect_uri, expires_at FROM codex_oauth_transactions WHERE state_hash=?").get(hashOAuthState(state)) as { owner_id: string; nonce: string; code_verifier: string; redirect_uri: string; expires_at: string } | undefined;
  db.prepare("DELETE FROM codex_oauth_transactions WHERE state_hash=?").run(hashOAuthState(state));
  if (!tx || tx.owner_id !== user.id || Date.parse(tx.expires_at) <= Date.now()) return panelRedirect("invalid_state");
  if (url.searchParams.has("error") || !url.searchParams.get("code")) return panelRedirect("cancelled");
  try {
    const tokens = await exchangeAuthorizationCode(url.searchParams.get("code")!, tx.code_verifier, tx.redirect_uri);
    const scopes = requirePlanScopes(tokens.scope);
    const claims = await verifyIdToken(tokens.id_token as string, tx.nonce);
    const expiresAt = typeof tokens.expires_in === "number" ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    upsertCodexConnection({
      ownerId: user.id,
      subject: claims.sub as string,
      email: typeof claims.email === "string" ? claims.email : null,
      name: typeof claims.name === "string" ? claims.name : null,
      accessToken: tokens.access_token as string,
      refreshToken: typeof tokens.refresh_token === "string" ? tokens.refresh_token : null,
      expiresAt,
      scopes,
    });
    return panelRedirect("connected");
  } catch (error) {
    console.error("Codex OAuth callback failed", error instanceof Error ? error.message : "unknown");
    return panelRedirect("failed");
  }
}
