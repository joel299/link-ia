import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const cookieState = { token: null as string | null };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "linkia_session" && cookieState.token
        ? { name, value: cookieState.token }
        : undefined,
    set: (_name: string, value: string) => {
      cookieState.token = value || null;
    },
  }),
  headers: async () => new Headers(),
}));

import { closeDb, getDb } from "../src/lib/db";
import { issueApiToken, verifyApiToken, createTrustedApiContext, verifyTrustedApiContext, consumeApiRateLimit, consumeMcpRateLimit, revokeApiToken, resolveApiScope } from "../src/lib/api-tokens";
import { hashPassword, registerUser, setSessionCookie, type SessionUser } from "../src/lib/auth";
import { createLegacyDefaultPermissions } from "../src/lib/permissions";
import {
  GET as adminTokensGet,
  POST as adminTokensPost,
} from "../src/app/api/admin/users/[userId]/api-tokens/route";
import { DELETE as adminTokenDelete } from "../src/app/api/admin/users/[userId]/api-tokens/[tokenId]/route";
import { POST as mcpPost } from "../src/app/v1/mcp/route";

function actAs(user: SessionUser | null) {
  if (!user) {
    cookieState.token = null;
    return;
  }
  const res = NextResponse.json({ ok: true });
  void setSessionCookie(user, res);
  cookieState.token = res.cookies.get("linkia_session")?.value ?? null;
}

describe("API JWT e MCP Streamable HTTP", () => {
  let tmpDir: string;
  let ownerId: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkia-api-tokens-"));
    process.env.DATA_DIR = tmpDir;
    process.env.SESSION_SECRET = "test-session-secret-32-characters-long";
    process.env.API_JWT_SECRET = "test-api-jwt-secret-32-characters-long";
    process.env.APP_BASE_URL = "https://linkia.iainfinito.com.br";
    ownerId = registerUser("api-owner@linkia.test", "API Owner", "test1234").user!.id;
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
    delete process.env.SESSION_SECRET;
    delete process.env.API_JWT_SECRET;
    delete process.env.APP_BASE_URL;
  });

  it("assina JWT vinculado ao dono, scopes, expiração e revogação", () => {
    const token = issueApiToken({ ownerId, createdBy: ownerId, label: "Teste", scopes: ["profiles:read"], expiresInDays: 7 });
    const principal = verifyApiToken(token.token);
    expect(principal?.ownerId).toBe(ownerId);
    expect(principal?.scopes).toEqual(["profiles:read"]);
    const context = createTrustedApiContext(principal!);
    expect(verifyTrustedApiContext(context.value, context.signature)?.ownerId).toBe(ownerId);
    expect(consumeApiRateLimit(token.id, 2)).toBe(true);
    expect(consumeApiRateLimit(token.id, 2)).toBe(true);
    expect(consumeApiRateLimit(token.id, 2)).toBe(false);
    expect(consumeMcpRateLimit(token.id, 2)).toBe(true);
    expect(consumeMcpRateLimit(token.id, 2)).toBe(true);
    expect(consumeMcpRateLimit(token.id, 2)).toBe(false);
    expect(revokeApiToken(token.id, ownerId)).toBe(true);
    expect(verifyApiToken(token.token)).toBeNull();
  });

  it("separa consultas, escritas e rotas internas por escopo", () => {
    expect(resolveApiScope("/v1/api/profiles", "GET", new URLSearchParams())).toBe("profiles:read");
    expect(resolveApiScope("/v1/api/profiles/abc/ads/meta_ads/campaigns", "POST", new URLSearchParams())).toBe("ads:draft");
    expect(resolveApiScope("/v1/api/profiles/abc/ads/meta_ads/campaigns/op-1/confirm", "POST", new URLSearchParams())).toBe("ads:confirm");
    expect(resolveApiScope("/v1/api/auth/login", "POST", new URLSearchParams())).toBeNull();
    expect(resolveApiScope("/v1/api/profiles/abc/ads/meta_ads", "GET", new URLSearchParams("sync=1"))).toBe("ads:sync");
  });

  it("inicializa MCP em resposta Streamable HTTP e lista ferramentas em SSE", async () => {
    const token = issueApiToken({ ownerId, createdBy: ownerId, label: "MCP test", scopes: ["profiles:read", "public:read"], expiresInDays: 7 });
    const request = new Request("https://linkia.iainfinito.com.br/v1/mcp", {
      method: "POST", headers: { Authorization: `Bearer ${token.token}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } }),
    });
    const response = await mcpPost(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain('"protocolVersion":"2025-06-18"');
  });

  it("responde JSON quando o cliente não pede SSE", async () => {
    const token = issueApiToken({ ownerId, createdBy: ownerId, label: "JSON MCP", scopes: ["profiles:read"], expiresInDays: 7 });
    const request = new Request("https://linkia.iainfinito.com.br/v1/mcp", {
      method: "POST", headers: { Authorization: `Bearer ${token.token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping", params: {} }),
    });
    const response = await mcpPost(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ jsonrpc: "2.0", id: 2, result: {} });
  });

  it("responde JSON para lote JSON-RPC mesmo quando o cliente aceita SSE", async () => {
    const token = issueApiToken({ ownerId, createdBy: ownerId, label: "Batch MCP", scopes: ["profiles:read"], expiresInDays: 7 });
    const request = new Request("https://linkia.iainfinito.com.br/v1/mcp", {
      method: "POST", headers: { Authorization: `Bearer ${token.token}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: 3, method: "ping", params: {} },
        { jsonrpc: "2.0", id: 4, method: "ping", params: {} },
      ]),
    });
    const response = await mcpPost(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toHaveLength(2);
  });

  it("emite token e URL MCP via rota admin, trata ausência de API_JWT_SECRET e nunca reexibe o token", async () => {
    const db = getDb();
    const adminId = "api-admin-test-1";
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)`
    ).run(
      adminId,
      "api-admin@linkia.test",
      "Admin API",
      hashPassword("AdminApiPass123!"),
      new Date().toISOString(),
      new Date().toISOString()
    );
    const adminUser: SessionUser = {
      id: adminId,
      email: "api-admin@linkia.test",
      name: "Admin API",
      role: "admin",
      isActive: true,
      permissions: createLegacyDefaultPermissions(),
    };
    const clientUser: SessionUser = {
      id: ownerId,
      email: "api-owner@linkia.test",
      name: "API Owner",
      role: "client",
      isActive: true,
      permissions: createLegacyDefaultPermissions(),
    };

    // Non-admin rejected
    actAs(clientUser);
    const forbiddenRes = await adminTokensPost(
      new Request("https://evil.example/api/admin/users/" + ownerId + "/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "n8n", expiresInDays: 30, scopes: ["profiles:read"] }),
      }),
      { params: Promise.resolve({ userId: ownerId }) }
    );
    expect(forbiddenRes.status).toBe(403);

    // Admin issues token (URL comes from APP_BASE_URL, ignoring request host)
    actAs(adminUser);
    const createRes = await adminTokensPost(
      new Request("http://127.0.0.1:3000/api/admin/users/" + ownerId + "/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "n8n produção", expiresInDays: 30, scopes: ["profiles:read"] }),
      }),
      { params: Promise.resolve({ userId: ownerId }) }
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(typeof created.token).toBe("string");
    expect(created.mcpUrl).toBe("https://linkia.iainfinito.com.br/mcp");

    // Listing returns mcpUrl and metadata, never the full token
    const listRes = await adminTokensGet(
      new Request("http://127.0.0.1:3000/api/admin/users/" + ownerId + "/api-tokens"),
      { params: Promise.resolve({ userId: ownerId }) }
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.mcpUrl).toBe("https://linkia.iainfinito.com.br/mcp");
    expect(JSON.stringify(listBody)).not.toContain(created.token);

    // Missing/short API_JWT_SECRET uses a separate key derived from SESSION_SECRET.
    const prevSecret = process.env.API_JWT_SECRET;
    const countBefore = (
      db.prepare("SELECT COUNT(*) AS c FROM api_access_tokens WHERE owner_id = ?").get(ownerId) as { c: number }
    ).c;
    try {
      for (const invalidSecret of [undefined, "short"]) {
        if (invalidSecret) process.env.API_JWT_SECRET = invalidSecret;
        else delete process.env.API_JWT_SECRET;
        const fallbackRes = await adminTokensPost(
          new Request("http://127.0.0.1:3000/api/admin/users/" + ownerId + "/api-tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: "fallback", expiresInDays: 30, scopes: ["profiles:read"] }),
          }),
          { params: Promise.resolve({ userId: ownerId }) }
        );
        expect(fallbackRes.status).toBe(201);
        const fallbackBody = await fallbackRes.json();
        expect(verifyApiToken(fallbackBody.token)?.ownerId).toBe(ownerId);
        expect(revokeApiToken(fallbackBody.id, ownerId)).toBe(true);
      }
      const countAfter = (
        db.prepare("SELECT COUNT(*) AS c FROM api_access_tokens WHERE owner_id = ?").get(ownerId) as { c: number }
      ).c;
      expect(countAfter).toBe(countBefore + 2);
    } finally {
      if (prevSecret) process.env.API_JWT_SECRET = prevSecret;
      else delete process.env.API_JWT_SECRET;
    }

    // Revoke via DELETE invalidates token immediately
    const delRes = await adminTokenDelete(
      new Request(`http://127.0.0.1:3000/api/admin/users/${ownerId}/api-tokens/${created.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ userId: ownerId, tokenId: created.id }) }
    );
    expect(delRes.status).toBe(200);
    expect(verifyApiToken(created.token)).toBeNull();
  });
});
