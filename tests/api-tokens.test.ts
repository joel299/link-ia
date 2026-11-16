import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "../src/lib/db";
import { issueApiToken, verifyApiToken, createTrustedApiContext, verifyTrustedApiContext, consumeApiRateLimit, consumeMcpRateLimit, revokeApiToken, resolveApiScope } from "../src/lib/api-tokens";
import { registerUser } from "../src/lib/auth";
import { POST as mcpPost } from "../src/app/v1/mcp/route";

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
});
