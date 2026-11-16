import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildAuthorizationUrl, createPkcePair, hashOAuthState, oauthRedirectUri } from "@/lib/codex-ai";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  try {
    const state = crypto.randomBytes(32).toString("base64url");
    const nonce = crypto.randomBytes(32).toString("base64url");
    const { verifier, challenge } = createPkcePair();
    const redirectUri = oauthRedirectUri();
    const now = new Date();
    getDb().prepare("DELETE FROM codex_oauth_transactions WHERE expires_at <= ?").run(now.toISOString());
    getDb().prepare("INSERT INTO codex_oauth_transactions (state_hash, owner_id, nonce, code_verifier, redirect_uri, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      hashOAuthState(state), user.id, nonce, verifier, redirectUri,
      new Date(now.getTime() + 10 * 60_000).toISOString(), now.toISOString()
    );
    return NextResponse.redirect(buildAuthorizationUrl({ state, nonce, challenge, redirectUri }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível iniciar a conexão." }, { status: 503 });
  }
}
