import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isSlugAvailable } from "@/lib/profiles";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "";
  const excludeId = searchParams.get("excludeId") ?? undefined;

  const result = isSlugAvailable(slug, excludeId);
  return NextResponse.json(result);
}
