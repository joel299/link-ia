import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listOrganicSocialConnections } from "@/lib/composio-social";
import {
  getUserPermissions,
  socialProviderToFeatureKey,
} from "@/lib/permissions";
import { getProfileByIdForOwner } from "@/lib/profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const check = getProfileByIdForOwner(id, user.id);
  if (check.error === "not_found") {
    return NextResponse.json(
      { error: "Perfil não encontrado." },
      { status: 404 }
    );
  }
  if (check.error === "forbidden" || !check.profile) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const perms = getUserPermissions(user.id);
  const connections = listOrganicSocialConnections(check.profile.id).filter(
    (conn) => perms[socialProviderToFeatureKey(conn.provider)] === true
  );
  return NextResponse.json({ connections });
}
