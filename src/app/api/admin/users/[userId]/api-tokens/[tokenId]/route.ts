import { NextResponse } from "next/server";
import { revokeApiToken } from "@/lib/api-tokens";
import { requireAdminUser } from "@/lib/permissions";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ userId: string; tokenId: string }> }) {
  const auth = await requireAdminUser();
  if (auth.errorResponse) return auth.errorResponse;
  const { userId, tokenId } = await context.params;
  if (!revokeApiToken(tokenId, userId)) return NextResponse.json({ error: "Token não encontrado ou já revogado." }, { status: 404 });
  return NextResponse.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
}
