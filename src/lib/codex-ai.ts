import crypto from "node:crypto";
import { getDb } from "./db";

const ISSUER = "https://auth.openai.com";
const TOKEN_URL = "https://auth.openai.com/api/accounts/oauth/token";
const JWKS_URL = "https://auth.openai.com/.well-known/jwks.json";
const RESOURCE = "https://api.openai.com/v1";
const REQUIRED_SCOPES = ["chatgpt.tokens.use.direct", "resource.invoke"];

function clientId(): string {
  const value = process.env.OPENAI_SIWC_CLIENT_ID?.trim();
  if (!value) throw new Error("OPENAI_SIWC_CLIENT_ID ausente.");
  return value;
}

export function oauthRedirectUri(): string {
  const configured = process.env.OPENAI_SIWC_REDIRECT_URI?.trim();
  const base = process.env.APP_BASE_URL?.trim();
  const uri = configured || (base ? `${base.replace(/\/$/, "")}/api/ai/codex/callback` : "");
  if (!uri) throw new Error("Configure APP_BASE_URL ou OPENAI_SIWC_REDIRECT_URI.");
  const parsed = new URL(uri);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("O callback OAuth precisa usar HTTPS em produção.");
  }
  const expectedOrigin = base ? new URL(base).origin : parsed.origin;
  if (parsed.origin !== expectedOrigin || parsed.pathname !== "/api/ai/codex/callback") {
    throw new Error("O callback OAuth precisa ser a rota fixa do domínio LinkIA configurado.");
  }
  return parsed.toString();
}

export function hashOAuthState(state: string): string {
  return crypto.createHash("sha256").update(state).digest("hex");
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizationUrl(args: {
  state: string;
  nonce: string;
  challenge: string;
  redirectUri: string;
}): string {
  const url = new URL("https://auth.openai.com/api/accounts/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    redirect_uri: args.redirectUri,
    scope: "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
    state: args.state,
    nonce: args.nonce,
    code_challenge: args.challenge,
    code_challenge_method: "S256",
    resource: RESOURCE,
  }).toString();
  return url.toString();
}

function encryptionKey(): Buffer {
  const key = process.env.CODEX_TOKEN_ENCRYPTION_KEY;
  if (!key || !/^[a-f\d]{64}$/i.test(key)) {
    throw new Error("CODEX_TOKEN_ENCRYPTION_KEY precisa ter 64 caracteres hexadecimais.");
  }
  return Buffer.from(key, "hex");
}

export function isCodexOAuthConfigured(): boolean {
  if (!process.env.OPENAI_SIWC_CLIENT_ID?.trim() || !/^[a-f\d]{64}$/i.test(process.env.CODEX_TOKEN_ENCRYPTION_KEY || "")) return false;
  try { oauthRedirectUri(); return true; } catch { return false; }
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string): string {
  const [ivPart, tagPart, ciphertextPart] = value.split(".");
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error("Credencial armazenada inválida.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function parseJwtSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

export async function verifyIdToken(token: string, nonce: string) {
  const [head, payload, signature, extra] = token.split(".");
  if (!head || !payload || !signature || extra) throw new Error("ID token inválido.");
  const header = parseJwtSegment(head);
  const claims = parseJwtSegment(payload);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Assinatura do ID token não suportada.");
  const response = await fetch(JWKS_URL, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("Não foi possível validar a identidade OpenAI.");
  const jwks = (await response.json()) as { keys?: JsonWebKey[] };
  const jwk = jwks.keys?.find((item) => (item as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk) throw new Error("Chave de assinatura OpenAI não encontrada.");
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const valid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${head}.${payload}`),
    publicKey,
    Buffer.from(signature, "base64url")
  );
  const now = Math.floor(Date.now() / 1000);
  const audience = claims.aud;
  const audienceMatches = Array.isArray(audience) ? audience.includes(clientId()) : audience === clientId();
  if (!valid || claims.iss !== ISSUER || !audienceMatches || typeof claims.exp !== "number" || claims.exp <= now || (typeof claims.nbf === "number" && claims.nbf > now) || claims.nonce !== nonce || typeof claims.sub !== "string" || !claims.sub) {
    throw new Error("A identidade OpenAI não passou na validação de segurança.");
  }
  return claims;
}

export async function exchangeAuthorizationCode(code: string, verifier: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId(),
    code_verifier: verifier,
    resource: RESOURCE,
  });
  const secret = process.env.OPENAI_SIWC_CLIENT_SECRET;
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (secret) headers.authorization = `Basic ${Buffer.from(`${encodeURIComponent(clientId())}:${encodeURIComponent(secret)}`).toString("base64")}`;
  const response = await fetch(TOKEN_URL, { method: "POST", headers, body, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!response.ok) throw new Error("A OpenAI recusou a autorização. Inicie a conexão novamente.");
  const tokens = await response.json() as Record<string, unknown>;
  if (typeof tokens.access_token !== "string" || typeof tokens.id_token !== "string") throw new Error("A resposta OAuth não trouxe os tokens esperados.");
  return tokens;
}

export function requirePlanScopes(rawScopes: unknown): string {
  const scopes = typeof rawScopes === "string" ? rawScopes.split(/\s+/).filter(Boolean) : [];
  if (!REQUIRED_SCOPES.every((scope) => scopes.includes(scope))) {
    throw new Error("A autorização não liberou o uso do plano ChatGPT para respostas.");
  }
  return scopes.join(" ");
}

export function upsertCodexConnection(input: {
  ownerId: string;
  subject: string;
  email: string | null;
  name: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO codex_connections (
    owner_id, openai_subject, email, display_name, client_id, access_token_encrypted,
    refresh_token_encrypted, token_expires_at, granted_scopes, connected_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(owner_id) DO UPDATE SET openai_subject=excluded.openai_subject,
    email=excluded.email, display_name=excluded.display_name, client_id=excluded.client_id,
    access_token_encrypted=excluded.access_token_encrypted,
    refresh_token_encrypted=excluded.refresh_token_encrypted,
    token_expires_at=excluded.token_expires_at, granted_scopes=excluded.granted_scopes,
    connected_at=excluded.connected_at, updated_at=excluded.updated_at`).run(
      input.ownerId, input.subject, input.email, input.name, clientId(), encryptSecret(input.accessToken),
      input.refreshToken ? encryptSecret(input.refreshToken) : null, input.expiresAt,
      input.scopes, now, now
    );
}

export function getCodexConnectionStatus(ownerId: string) {
  const row = getDb().prepare("SELECT email, display_name, connected_at, token_expires_at FROM codex_connections WHERE owner_id = ?").get(ownerId) as { email: string | null; display_name: string | null; connected_at: string; token_expires_at: string | null } | undefined;
  return row ? { connected: true, email: row.email, name: row.display_name, connectedAt: row.connected_at, expiresAt: row.token_expires_at } : { connected: false, email: null, name: null, connectedAt: null, expiresAt: null };
}

export function revokeCodexConnection(ownerId: string) {
  getDb().prepare("DELETE FROM codex_connections WHERE owner_id = ?").run(ownerId);
}

export async function getCodexAccessToken(ownerId: string): Promise<string> {
  const db = getDb();
  const row = db.prepare("SELECT access_token_encrypted, refresh_token_encrypted, token_expires_at, client_id FROM codex_connections WHERE owner_id = ?").get(ownerId) as { access_token_encrypted: string; refresh_token_encrypted: string | null; token_expires_at: string | null; client_id: string } | undefined;
  if (!row) throw new Error("Conecte sua conta ChatGPT na aba IA antes de pedir uma análise.");
  if (!row.token_expires_at || Date.parse(row.token_expires_at) > Date.now() + 60_000) return decryptSecret(row.access_token_encrypted);
  if (!row.refresh_token_encrypted) throw new Error("A conexão expirou. Reconecte sua conta ChatGPT na aba IA.");
  const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptSecret(row.refresh_token_encrypted), client_id: row.client_id, resource: RESOURCE });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  const secret = process.env.OPENAI_SIWC_CLIENT_SECRET;
  if (secret) headers.authorization = `Basic ${Buffer.from(`${encodeURIComponent(row.client_id)}:${encodeURIComponent(secret)}`).toString("base64")}`;
  const response = await fetch(TOKEN_URL, { method: "POST", headers, body: form, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!response.ok) throw new Error("A conexão ChatGPT expirou. Reconecte sua conta na aba IA.");
  const refreshed = await response.json() as Record<string, unknown>;
  if (typeof refreshed.access_token !== "string") throw new Error("Não foi possível renovar a conexão ChatGPT.");
  const expiry = typeof refreshed.expires_in === "number" ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : null;
  db.prepare("UPDATE codex_connections SET access_token_encrypted=?, refresh_token_encrypted=?, token_expires_at=?, updated_at=? WHERE owner_id=?").run(
    encryptSecret(refreshed.access_token), typeof refreshed.refresh_token === "string" ? encryptSecret(refreshed.refresh_token) : row.refresh_token_encrypted, expiry, new Date().toISOString(), ownerId
  );
  return refreshed.access_token;
}

export function getAdminSystemPrompt(): string {
  const row = getDb().prepare("SELECT value FROM ai_agent_settings WHERE setting_key='system_prompt'").get() as { value: string } | undefined;
  return row?.value || "Você é o assistente de análise de tráfego pago do LinkIA. Analise apenas os dados fornecidos, explique em português claro, diferencie fatos de hipóteses e recomende próximos passos objetivos. Não invente métricas nem afirme que alterou campanhas.";
}
