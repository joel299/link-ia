import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDashboardSnapshotForOwner } from "@/lib/dashboard";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period");

  try {
    const snapshot = await getDashboardSnapshotForOwner({
      ownerId: user.id,
      permissions: user.permissions,
      period,
    });
    return NextResponse.json({ dashboard: snapshot });
  } catch (err) {
    console.error(
      "[Dashboard] Falha ao carregar snapshot:",
      err instanceof Error ? err.message : "erro desconhecido"
    );
    return NextResponse.json(
      { error: "Não foi possível carregar os dados do dashboard." },
      { status: 500 }
    );
  }
}
