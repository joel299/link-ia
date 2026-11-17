import crypto from "node:crypto";
import { getDb } from "./db";

export const API_TOKEN_SCOPES = [
  "profiles:read", "profiles:write", "profiles:publish", "profiles:delete",
  "links:read", "links:write", "catalog:read", "catalog:write",
  "ads:read", "ads:sync", "ads:manage", "ads:draft", "ads:confirm",
  "social:read", "social:manage", "social:sync",
  "whatsapp:read", "whatsapp:manage",
  "calendar:read", "calendar:manage", "booking:create",
  "public:read", "legal:read", "legal:write",
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export interface ApiTokenPrincipal {
  id: string;
  ownerId: string;
  email: string;
  name: string;
  scopes: ApiTokenScope[];
  expiresAt: number;
}

function getSecret(): string {
  const apiSecret = process.env.API_JWT_SECRET?.trim();
  if (apiSecret && apiSecret.length >= 32) return apiSecret;

  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (
    sessionSecret &&
    sessionSecret.length >= 16 &&
    sessionSecret !== "change-me-to-a-long-random-secret" &&
    sessionSecret !== "dev-linkia-secret-change-in-prod"
  ) {
    // Derive a separate, stable signing key when the dedicated API key is absent or too short.
    return crypto.createHmac("sha256", sessionSecret).update("linkia-api-jwt-signing-v1").digest("base64url");
  }

  throw new Error("API_JWT_SECRET inválida e SESSION_SECRET indisponível para assinar tokens.");
}

function sign(value: string, purpose: string): string {
  return crypto.createHmac("sha256", getSecret()).update(`${purpose}.${value}`).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJson<T>(value: string): T | null {
  try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T; }
  catch { return null; }
}

export function validateApiTokenScopes(raw: unknown): ApiTokenScope[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > API_TOKEN_SCOPES.length) return null;
  if (raw.some((scope) => typeof scope !== "string" || !API_TOKEN_SCOPES.includes(scope as ApiTokenScope))) return null;
  return [...new Set(raw)] as ApiTokenScope[];
}

export function issueApiToken(input: {
  ownerId: string;
  createdBy: string;
  label: string;
  scopes: ApiTokenScope[];
  expiresInDays: number;
}) {
  const id = crypto.randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = nowSeconds + input.expiresInDays * 24 * 60 * 60;
  const createdAt = new Date(nowSeconds * 1000).toISOString();
  const expiresAtIso = new Date(expiresAt * 1000).toISOString();
  const payload = {
    iss: "https://linkia.iainfinito.com.br",
    aud: "linkia-v1",
    sub: input.ownerId,
    jti: id,
    scope: input.scopes,
    iat: nowSeconds,
    exp: expiresAt,
  };
  const content = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  const token = `${content}.${sign(content, "jwt")}`;
  getDb().prepare(`INSERT INTO api_access_tokens
    (id, owner_id, label, scopes_json, expires_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, input.ownerId, input.label, JSON.stringify(input.scopes), expiresAtIso, input.createdBy, createdAt);
  return { id, token, expiresAt: expiresAtIso, createdAt };
}

export function verifyApiToken(token: string): ApiTokenPrincipal | null {
  try {
    const [headerPart, payloadPart, signature, extra] = token.split(".");
    if (!headerPart || !payloadPart || !signature || extra) return null;
    const content = `${headerPart}.${payloadPart}`;
    if (!safeEqual(signature, sign(content, "jwt"))) return null;
    const header = decodeJson<{ alg?: string; typ?: string }>(headerPart);
    const payload = decodeJson<{ iss?: string; aud?: string; sub?: string; jti?: string; scope?: unknown; iat?: number; exp?: number }>(payloadPart);
    if (header?.alg !== "HS256" || header.typ !== "JWT" || !payload || payload.iss !== "https://linkia.iainfinito.com.br" || payload.aud !== "linkia-v1") return null;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub || !payload.jti || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || (payload.exp ?? 0) <= now || (payload.iat ?? now) > now + 60) return null;
    const scopes = validateApiTokenScopes(payload.scope);
    if (!scopes) return null;
    const db = getDb();
    const row = db.prepare(`SELECT t.id, t.owner_id, t.scopes_json, t.expires_at, t.revoked_at,
        u.email, u.name, u.is_active
      FROM api_access_tokens t JOIN users u ON u.id=t.owner_id WHERE t.id=?`)
      .get(payload.jti) as { id: string; owner_id: string; scopes_json: string; expires_at: string; revoked_at: string | null; email: string; name: string; is_active: number } | undefined;
    if (!row || row.revoked_at || row.owner_id !== payload.sub || row.is_active === 0 || Date.parse(row.expires_at) <= Date.now()) return null;
    if (JSON.stringify(JSON.parse(row.scopes_json)) !== JSON.stringify(scopes)) return null;
    db.prepare("UPDATE api_access_tokens SET last_used_at=? WHERE id=? AND revoked_at IS NULL").run(new Date().toISOString(), row.id);
    return { id: row.id, ownerId: row.owner_id, email: row.email, name: row.name, scopes, expiresAt: Math.floor(Date.parse(row.expires_at) / 1000) };
  } catch {
    return null;
  }
}

export function createTrustedApiContext(principal: ApiTokenPrincipal): { value: string; signature: string } {
  const now = Math.floor(Date.now() / 1000);
  const value = encode({ sub: principal.ownerId, jti: principal.id, email: principal.email, name: principal.name, iat: now });
  return { value, signature: sign(value, "context") };
}

export function verifyTrustedApiContext(value: string, signature: string): ApiTokenPrincipal | null {
  try {
    if (!safeEqual(signature, sign(value, "context"))) return null;
    const context = decodeJson<{ sub?: string; jti?: string; email?: string; name?: string; iat?: number }>(value);
    const now = Math.floor(Date.now() / 1000);
    if (!context?.sub || !context.jti || !Number.isInteger(context.iat) || now - (context.iat ?? 0) > 60 || (context.iat ?? 0) > now + 5) return null;
    const row = getDb().prepare(`SELECT t.id, t.owner_id, t.scopes_json, t.expires_at, t.revoked_at,
        u.email, u.name, u.is_active
      FROM api_access_tokens t JOIN users u ON u.id=t.owner_id WHERE t.id=?`)
      .get(context.jti) as { id: string; owner_id: string; scopes_json: string; expires_at: string; revoked_at: string | null; email: string; name: string; is_active: number } | undefined;
    if (!row || row.revoked_at || row.owner_id !== context.sub || row.is_active === 0 || Date.parse(row.expires_at) <= Date.now()) return null;
    const scopes = validateApiTokenScopes(JSON.parse(row.scopes_json));
    if (!scopes) return null;
    return { id: row.id, ownerId: row.owner_id, email: row.email, name: row.name, scopes, expiresAt: Math.floor(Date.parse(row.expires_at) / 1000) };
  } catch {
    return null;
  }
}

export function listApiTokens(ownerId: string) {
  return getDb().prepare(`SELECT id, label, scopes_json AS scopesJson, expires_at AS expiresAt,
      created_at AS createdAt, last_used_at AS lastUsedAt, revoked_at AS revokedAt
    FROM api_access_tokens WHERE owner_id=? ORDER BY created_at DESC`).all(ownerId) as Array<{
      id: string; label: string; scopesJson: string; expiresAt: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null;
    }>;
}

export function revokeApiToken(tokenId: string, ownerId: string) {
  return getDb().prepare("UPDATE api_access_tokens SET revoked_at=? WHERE id=? AND owner_id=? AND revoked_at IS NULL")
    .run(new Date().toISOString(), tokenId, ownerId).changes > 0;
}

export function consumeApiRateLimit(tokenId: string, limit = 120): boolean {
  const windowStart = Math.floor(Date.now() / 60_000);
  const db = getDb();
  const update = db.prepare(`INSERT INTO api_access_rate_limits (token_id, window_start, request_count)
      VALUES (?, ?, 1)
      ON CONFLICT(token_id) DO UPDATE SET
        window_start=excluded.window_start,
        request_count=CASE WHEN api_access_rate_limits.window_start=excluded.window_start
          THEN api_access_rate_limits.request_count + 1 ELSE 1 END
      RETURNING request_count`)
    .get(tokenId, windowStart) as { request_count: number };
  return update.request_count <= limit;
}

export function consumeMcpRateLimit(tokenId: string, limit = 120): boolean {
  const windowStart = Math.floor(Date.now() / 60_000);
  const db = getDb();
  const update = db.prepare(`INSERT INTO api_mcp_rate_limits (token_id, window_start, request_count)
      VALUES (?, ?, 1)
      ON CONFLICT(token_id) DO UPDATE SET
        window_start=excluded.window_start,
        request_count=CASE WHEN api_mcp_rate_limits.window_start=excluded.window_start
          THEN api_mcp_rate_limits.request_count + 1 ELSE 1 END
      RETURNING request_count`)
    .get(tokenId, windowStart) as { request_count: number };
  return update.request_count <= limit;
}

export function resolveApiScope(pathname: string, method: string, searchParams: URLSearchParams): ApiTokenScope | "public" | null {
  const path = pathname.replace(/\/$/, "") || "/";
  const verb = method.toUpperCase();
  if (path === "/v1/api/health" && verb === "GET") return "public";
  if (path === "/v1/api/profiles" && verb === "GET") return "profiles:read";
  if (path === "/v1/api/profiles" && verb === "POST") return "profiles:write";
  if (path === "/v1/api/profiles/slug-availability" && verb === "GET") return "profiles:read";
  if (/^\/v1\/api\/profiles\/[^/]+$/.test(path)) return verb === "GET" ? "profiles:read" : verb === "PATCH" ? "profiles:write" : verb === "DELETE" ? "profiles:delete" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/publish$/.test(path) && ["POST", "DELETE"].includes(verb)) return "profiles:publish";
  if (/^\/v1\/api\/profiles\/[^/]+\/ads\/meta_ads\/setup$/.test(path)) return verb === "GET" ? "ads:read" : verb === "POST" ? "ads:manage" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/ads\/[^/]+$/.test(path)) return verb === "GET" ? (searchParams.get("sync") === "1" ? "ads:sync" : "ads:read") : verb === "POST" ? "ads:manage" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/ads\/[^/]+\/campaigns$/.test(path) && verb === "POST") return "ads:draft";
  if (/^\/v1\/api\/profiles\/[^/]+\/ads\/[^/]+\/campaigns\/[^/]+\/confirm$/.test(path) && verb === "POST") return "ads:confirm";
  if (/^\/v1\/api\/profiles\/[^/]+\/booking-settings$/.test(path)) return verb === "GET" ? "calendar:read" : verb === "PUT" ? "calendar:manage" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/integrations\/google-calendar$/.test(path)) return verb === "GET" ? "calendar:read" : verb === "DELETE" ? "calendar:manage" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/integrations\/social$/.test(path) && verb === "GET") return "social:read";
  if (/^\/v1\/api\/profiles\/[^/]+\/integrations\/social\/[^/]+$/.test(path)) return verb === "GET" ? "social:read" : ["PATCH", "DELETE"].includes(verb) ? "social:manage" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/integrations\/social\/[^/]+\/sync$/.test(path) && verb === "POST") return "social:sync";
  if (/^\/v1\/api\/profiles\/[^/]+\/integrations\/whatsapp$/.test(path)) return verb === "GET" ? "whatsapp:read" : verb === "DELETE" ? "whatsapp:manage" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/links$/.test(path)) return verb === "GET" ? "links:read" : verb === "POST" ? "links:write" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/links\/reorder$/.test(path) && verb === "PUT") return "links:write";
  if (/^\/v1\/api\/profiles\/[^/]+\/links\/[^/]+$/.test(path)) return verb === "PATCH" || verb === "DELETE" ? "links:write" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/catalog$/.test(path)) return verb === "GET" ? "catalog:read" : verb === "POST" ? "catalog:write" : null;
  if (/^\/v1\/api\/profiles\/[^/]+\/catalog\/reorder$/.test(path) && verb === "PUT") return "catalog:write";
  if (/^\/v1\/api\/profiles\/[^/]+\/catalog\/[^/]+$/.test(path)) return verb === "PATCH" || verb === "DELETE" ? "catalog:write" : null;
  if (/^\/v1\/api\/public\/profiles\/[^/]+$/.test(path) && verb === "GET") return "public:read";
  if (/^\/v1\/api\/public\/profiles\/[^/]+\/(availability|catalog)$/.test(path) && verb === "GET") return "public:read";
  if (/^\/v1\/api\/public\/profiles\/[^/]+\/booking$/.test(path) && verb === "GET") return "public:read";
  if (/^\/v1\/api\/public\/profiles\/[^/]+\/bookings$/.test(path) && verb === "POST") return "booking:create";
  if (path === "/v1/api/legal/acceptance") return verb === "GET" ? "legal:read" : verb === "POST" ? "legal:write" : null;
  return null;
}
