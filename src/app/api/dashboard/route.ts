import { NextResponse } from "next/server";
import { AdsServiceError } from "@/lib/ads-service";
import { getSessionUser } from "@/lib/auth";
import { getDashboardSnapshotForOwner } from "@/lib/dashboard";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get("period");
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");

  try {
    const snapshot = await getDashboardSnapshotForOwner({
      ownerId: user.id,
      permissions: user.permissions,
      period,
      since,
      until,
    });
    return NextResponse.json({ dashboard: snapshot });
  } catch (err) {
    if (err instanceof AdsServiceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      );
    }
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
