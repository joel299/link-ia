import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "./lib/db";
import { consumeApiRateLimit, createTrustedApiContext, resolveApiScope, verifyApiToken } from "./lib/api-tokens";
import { getUserPermissions } from "./lib/permissions";

function jsonError(message: string, status: number, challenge = false) {
  return NextResponse.json({ error: { message } }, {
    status,
    headers: challenge ? { "WWW-Authenticate": 'Bearer realm="LinkIA API", error="invalid_token"' } : undefined,
  });
}

function requestHostAllowed(request: NextRequest): boolean {
  try {
    const baseUrl = process.env.APP_BASE_URL?.trim();
    const expected = baseUrl ? new URL(baseUrl).host.toLowerCase() : "linkia.iainfinito.com.br";
    const incoming = request.nextUrl.host.toLowerCase();
    const isLocalDevelopment = process.env.NODE_ENV !== "production" && ["localhost:3000", "127.0.0.1:3000"].includes(incoming);
    if (incoming !== expected && !isLocalDevelopment) return false;
    const origin = request.headers.get("origin");
    return !origin || new URL(origin).host.toLowerCase() === incoming;
  } catch {
    return false;
  }
}

function isOwnerBookingRequest(pathname: string, method: string, ownerId: string): boolean {
  if (method !== "POST") return true;
  const match = pathname.match(/^\/v1\/api\/public\/profiles\/([^/]+)\/bookings$/);
  if (!match) return true;
  const slug = decodeURIComponent(match[1]);
  const profile = getDb().prepare("SELECT id FROM profiles WHERE slug=? AND owner_id=? AND status='published'")
    .get(slug, ownerId);
  if (!profile) return false;
  return getUserPermissions(ownerId).google_calendar;
}

export function proxy(request: NextRequest) {
  if (!requestHostAllowed(request)) return jsonError("Domínio ou origem não permitidos.", 403);
  if (request.nextUrl.pathname === "/v1/api/docs" || request.nextUrl.pathname === "/v1/api/docs/") return NextResponse.next();

  const scope = resolveApiScope(request.nextUrl.pathname, request.method, request.nextUrl.searchParams);
  if (scope === null) return jsonError("Esta operação não está disponível pela API para agentes.", 404);
  if (scope === "public") return NextResponse.rewrite(new URL(request.nextUrl.pathname.replace(/^\/v1/, ""), request.url));

  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9._~-]+)$/i);
  if (!match) return jsonError("Envie seu token no campo Authorization.", 401, true);
  const principal = verifyApiToken(match[1]);
  if (!principal) return jsonError("Token inválido, expirado ou revogado.", 401, true);
  if (!principal.scopes.includes(scope)) return jsonError("Este token não tem permissão para esta ação.", 403);
  if (!consumeApiRateLimit(principal.id)) return jsonError("Limite de uso excedido. Aguarde um minuto e tente novamente.", 429);

  try {
    const allowedOwner = isOwnerBookingRequest(request.nextUrl.pathname, request.method, principal.ownerId);
    if (!allowedOwner) return jsonError("A reserva precisa pertencer ao perfil autorizado e ter agenda liberada.", 403);
  } catch {
    return jsonError("Não foi possível validar o perfil para esta operação.", 403);
  }

  const context = createTrustedApiContext(principal);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-linkia-api-context");
  requestHeaders.delete("x-linkia-api-context-signature");
  requestHeaders.set("x-linkia-api-context", context.value);
  requestHeaders.set("x-linkia-api-context-signature", context.signature);
  const destination = new URL(request.nextUrl.toString());
  destination.pathname = destination.pathname.replace(/^\/v1/, "");
  return NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
}

export const config = { matcher: ["/v1/api/:path*"] };
