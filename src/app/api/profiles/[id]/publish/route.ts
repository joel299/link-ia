import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { publishProfile } from "@/lib/profiles";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = publishProfile(id, user.id);

  if (!result.profile) {
    return NextResponse.json(
      {
        error:
          result.errors?._form ??
          "Corrija os erros antes de publicar o perfil.",
        errors: result.errors,
      },
      { status: result.status ?? 422 }
    );
  }

  return NextResponse.json({ profile: result.profile });
}
