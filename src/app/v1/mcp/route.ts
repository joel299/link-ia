import { NextResponse } from "next/server";
import endpointCatalogJson from "../../../../scalar-docs/endpoints.json";
import { consumeMcpRateLimit, resolveApiScope, verifyApiToken, type ApiTokenPrincipal } from "@/lib/api-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "linkia-mcp", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_RPC_BODY_BYTES = 1_000_000;
const MAX_UPSTREAM_BODY_BYTES = 1_000_000;
type EndpointEntry = { path: string; method: string; operationId: string; summary: string; scope: string | null; exposedMcp: boolean };
const endpointCatalog = (endpointCatalogJson as { operations: EndpointEntry[] }).operations;
type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

function isAllowedHost(request: Request): boolean {
  try {
    const incoming = new URL(request.url);
    const base = process.env.APP_BASE_URL?.trim();
    if (!base) return false;
    const expected = new URL(base);
    if (incoming.host.toLowerCase() !== expected.host.toLowerCase()) return false;
    const origin = request.headers.get("origin");
    return !origin || new URL(origin).host.toLowerCase() === expected.host.toLowerCase();
  } catch { return false; }
}

function rpcError(id: RpcRequest["id"], code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

function sse(message: unknown, protocolVersion: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const item of (Array.isArray(message) ? message : [message])) {
        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(item)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "Mcp-Protocol-Version": protocolVersion,
  } });
}

function jsonResponse(message: unknown, protocolVersion: string): Response {
  return NextResponse.json(message, { headers: { "Mcp-Protocol-Version": protocolVersion } });
}

function toolList() {
  return [
    {
      name: "linkia_api_catalog",
      description: "Mostra quais operações da API LinkIA este token pode usar, o que cada uma faz e os campos principais. Consulte antes de chamar uma operação.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: "linkia_api_request",
      description: "Chama uma operação documentada da API LinkIA em nome do usuário associado ao token. Use somente caminho /v1/api/... listado no catálogo. As permissões da conta e do token continuam valendo. Para campanhas, prepare o rascunho e só confirme se o usuário pedir explicitamente.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "Ação da operação mostrada no catálogo." },
          path: { type: "string", description: "Caminho iniciado por /v1/api/ e listado no catálogo. Exemplo: /v1/api/profiles/ID/ads/meta_ads" },
          query: { type: "object", additionalProperties: { type: "string" }, description: "Filtros e datas aceitos pela operação." },
          body: { type: "object", description: "Dados em JSON conforme o exemplo da documentação. Não envie campos de autenticação." },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
  ];
}

function catalogFor(principal: ApiTokenPrincipal) {
  return endpointCatalog.filter((entry) => entry.exposedMcp && entry.scope && principal.scopes.includes(entry.scope as never));
}

function pathMatchesTemplate(template: string, pathname: string): boolean {
  const pattern = `^${template.split(/(\{[^}]+\})/g).map((part) => part.startsWith("{") ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("")}/?$`;
  return new RegExp(pattern).test(pathname);
}

async function readLimited(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_UPSTREAM_BODY_BYTES) {
      await reader.cancel();
      throw new Error("A resposta excedeu o limite de 1 MB. Reduza o período ou os dados solicitados.");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(all);
}

async function callLinkiaApi(args: unknown, principal: ApiTokenPrincipal, bearer: string) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Envie os dados da operação em formato de objeto.");
  const input = args as Record<string, unknown>;
  const method = typeof input.method === "string" ? input.method.toUpperCase() : "";
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new Error("Escolha um método listado no catálogo.");
  if (typeof input.path !== "string" || !input.path.startsWith("/v1/api/") || input.path.includes("\\") || input.path.includes("#")) throw new Error("Use um caminho /v1/api listado no catálogo.");
  let target: URL;
  try { target = new URL(input.path, "https://linkia.invalid"); } catch { throw new Error("O caminho informado não é válido."); }
  if (target.origin !== "https://linkia.invalid" || target.pathname.split("/").some((part) => part === "..")) throw new Error("O caminho informado não é permitido.");
  if (input.query !== undefined) {
    if (!input.query || typeof input.query !== "object" || Array.isArray(input.query)) throw new Error("Os filtros devem ser enviados como campos de texto.");
    for (const [key, value] of Object.entries(input.query as Record<string, unknown>)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(key) || (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")) throw new Error("Um filtro possui nome ou valor inválido.");
      target.searchParams.set(key, String(value));
    }
  }
  const scope = resolveApiScope(target.pathname, method, target.searchParams);
  if (!scope || scope === "public") throw new Error("Esta rota não está disponível para chamadas de agentes.");
  if (!principal.scopes.includes(scope)) throw new Error("O token não tem permissão para esta operação.");
  const allowed = catalogFor(principal).some((entry) => entry.method.toUpperCase() === method && entry.scope === scope && pathMatchesTemplate(entry.path, target.pathname));
  if (!allowed) throw new Error("A operação não está no catálogo habilitado para este agente.");
  let body: string | undefined;
  if (input.body !== undefined) {
    if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) throw new Error("O corpo da solicitação precisa ser um objeto JSON.");
    body = JSON.stringify(input.body);
    if (new TextEncoder().encode(body).byteLength > MAX_RPC_BODY_BYTES) throw new Error("O corpo da solicitação excede 1 MB.");
  }
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  if (!appBaseUrl) throw new Error("APP_BASE_URL não está configurada para chamadas internas do MCP.");
  const origin = new URL(appBaseUrl).origin;
  const destination = new URL(`${target.pathname}${target.search}`, origin);
  const response = await fetch(destination, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body }),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await readLimited(response);
  let formatted = text;
  try { formatted = JSON.stringify(JSON.parse(text), null, 2); } catch { /* respostas de erro textuais são preservadas */ }
  return { status: response.status, contentType: response.headers.get("content-type") || "application/json", body: formatted };
}

async function dispatch(message: RpcRequest, principal: ApiTokenPrincipal, bearer: string) {
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") return rpcError(message.id, -32600, "Solicitação JSON-RPC inválida.");
  const id = message.id;
  if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") return null;
  if (message.method === "initialize") {
    const requested = (message.params as { protocolVersion?: unknown } | undefined)?.protocolVersion;
    if (typeof requested !== "string" || !PROTOCOL_VERSIONS.includes(requested)) return rpcError(id, -32602, "Versão MCP não suportada.", { supported: PROTOCOL_VERSIONS });
    return { jsonrpc: "2.0", id, result: {
      protocolVersion: requested,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: "Use linkia_api_catalog para ver as operações autorizadas. Cada token pertence a uma conta LinkIA e respeita as permissões dela.",
    } };
  }
  if (message.method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (message.method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: toolList() } };
  if (message.method === "tools/call") {
    const params = message.params as { name?: unknown; arguments?: unknown } | undefined;
    try {
      let text: string;
      if (params?.name === "linkia_api_catalog") {
        text = JSON.stringify(catalogFor(principal).map(({ method, path, summary, operationId, scope }) => ({ method, path, name: operationId, whatItDoes: summary, permission: scope })), null, 2);
      } else if (params?.name === "linkia_api_request") {
        const result = await callLinkiaApi(params.arguments, principal, bearer);
        text = JSON.stringify(result, null, 2);
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: result.status < 200 || result.status >= 300 } };
      } else {
        return rpcError(id, -32602, "Ferramenta MCP não encontrada.");
      }
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: false } };
    } catch (error) {
      return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: error instanceof Error ? error.message : "A operação não foi concluída." }], isError: true } };
    }
  }
  return rpcError(id, -32601, "Método MCP não encontrado.");
}

export async function POST(request: Request) {
  if (!isAllowedHost(request)) return NextResponse.json({ error: "Domínio ou origem não permitidos." }, { status: 403 });
  if (!request.headers.get("accept")?.includes("application/json") && !request.headers.get("accept")?.includes("text/event-stream")) return NextResponse.json({ error: "Envie Accept: application/json, text/event-stream." }, { status: 406 });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return NextResponse.json({ error: "Envie uma solicitação JSON-RPC." }, { status: 415 });
  const auth = request.headers.get("authorization") || "";
  const bearerMatch = auth.match(/^Bearer\s+([A-Za-z0-9._~-]+)$/i);
  if (!bearerMatch) return NextResponse.json({ error: "Envie seu token no campo Authorization." }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="LinkIA MCP", error="invalid_token"' } });
  const bearerToken = bearerMatch[1];
  const principal = verifyApiToken(bearerToken);
  if (!principal) return NextResponse.json({ error: "Token inválido, expirado ou revogado." }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="LinkIA MCP", error="invalid_token"' } });
  if (!consumeMcpRateLimit(principal.id)) return NextResponse.json({ error: "Limite de uso do MCP excedido. Aguarde um minuto e tente novamente." }, { status: 429 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_RPC_BODY_BYTES) return NextResponse.json({ error: "A solicitação excede 1 MB." }, { status: 413 });
  let bodyText: string;
  try { bodyText = await request.text(); } catch { return NextResponse.json({ error: "Não foi possível ler a solicitação." }, { status: 400 }); }
  if (new TextEncoder().encode(bodyText).byteLength > MAX_RPC_BODY_BYTES) return NextResponse.json({ error: "A solicitação excede 1 MB." }, { status: 413 });
  let payload: unknown;
  try { payload = JSON.parse(bodyText); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const headerVersion = request.headers.get("mcp-protocol-version");
  if (headerVersion && !PROTOCOL_VERSIONS.includes(headerVersion)) return NextResponse.json({ error: "Versão MCP não suportada." }, { status: 400 });
  const negotiatedVersion = headerVersion || PROTOCOL_VERSIONS[0];
  if (Array.isArray(payload)) {
    if (payload.length === 0) return NextResponse.json({ error: "Uma lista JSON-RPC não pode estar vazia." }, { status: 400 });
    const replies = [];
    for (const item of payload) replies.push(await dispatch(item as RpcRequest, principal, bearerToken));
    const responses = replies.filter(Boolean);
    return responses.length ? jsonResponse(responses, negotiatedVersion) : new Response(null, { status: 202, headers: { "Mcp-Protocol-Version": negotiatedVersion } });
  }
  const response = await dispatch(payload as RpcRequest, principal, bearerToken);
  if (response === null) return new Response(null, { status: 202, headers: { "Mcp-Protocol-Version": negotiatedVersion } });
  const accept = request.headers.get("accept") || "";
  if (accept.includes("application/json") && !accept.includes("text/event-stream")) {
    return jsonResponse(response, negotiatedVersion);
  }
  return sse(response, negotiatedVersion);
}

export async function GET() {
  return new Response("Este servidor MCP não mantém sessões em segundo plano. Envie mensagens JSON-RPC por POST.", { status: 405, headers: { Allow: "POST", "Content-Type": "text/plain; charset=utf-8" } });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
