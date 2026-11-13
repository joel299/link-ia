import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createProfile, listProfilesByOwner } from "@/lib/profiles";
import type { ProfileTheme } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const profiles = listProfilesByOwner(user.id);
  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: {
    displayName?: unknown;
    slug?: unknown;
    bio?: unknown;
    theme?: Partial<ProfileTheme>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição JSON inválido." },
      { status: 400 }
    );
  }

  const result = createProfile(user.id, {
    displayName: typeof body.displayName === "string" ? body.displayName : "",
    slug: typeof body.slug === "string" ? body.slug : "",
    bio: typeof body.bio === "string" ? body.bio : undefined,
    theme:
      body.theme && typeof body.theme === "object" ? body.theme : undefined,
  });

  if (!result.profile) {
    return NextResponse.json(
      {
        error: "Não foi possível criar o perfil.",
        errors: result.errors,
        suggestion: result.suggestion,
      },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ profile: result.profile }, { status: 201 });
}
