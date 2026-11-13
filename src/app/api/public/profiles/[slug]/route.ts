import { NextResponse } from "next/server";
import { getPublishedPublicProfileBySlug } from "@/lib/profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const profile = getPublishedPublicProfileBySlug(slug);

  if (!profile) {
    return NextResponse.json(
      { error: "Perfil público não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { profile },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
