import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getProfileByIdForOwner, updateProfile } from "@/lib/profiles";
import type { ProfileUpdateInput } from "@/lib/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = getProfileByIdForOwner(id, user.id);

  if (result.error === "not_found") {
    return NextResponse.json(
      { error: "Perfil não encontrado." },
      { status: 404 }
    );
  }
  if (result.error === "forbidden" || !result.profile) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar este perfil." },
      { status: 403 }
    );
  }

  return NextResponse.json({ profile: result.profile });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const STRING_FIELDS = [
  "displayName",
  "bio",
  "slug",
  "instagramInput",
  "whatsappNumber",
  "whatsappMessage",
  "bookingLabel",
] as const;

const BOOLEAN_FIELDS = [
  "instagramEnabled",
  "whatsappEnabled",
  "bookingEnabled",
] as const;

const NULLABLE_STRING_FIELDS = ["avatarUrl", "bookingUrl"] as const;

function isValidProfilePatchPayload(
  body: unknown
): body is ProfileUpdateInput {
  if (!isPlainObject(body)) return false;

  for (const field of STRING_FIELDS) {
    if (body[field] !== undefined && typeof body[field] !== "string") {
      return false;
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    if (body[field] !== undefined && typeof body[field] !== "boolean") {
      return false;
    }
  }
  for (const field of NULLABLE_STRING_FIELDS) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      return false;
    }
  }
  if (body.theme !== undefined && !isPlainObject(body.theme)) {
    return false;
  }

  return true;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição JSON inválido." },
      { status: 400 }
    );
  }

  if (!isValidProfilePatchPayload(body)) {
    return NextResponse.json(
      { error: "Payload inválido." },
      { status: 400 }
    );
  }

  const result = updateProfile(id, user.id, body);
  if (!result.profile) {
    return NextResponse.json(
      {
        error:
          result.errors?._form ?? "Verifique os campos destacados antes de salvar.",
        errors: result.errors,
        suggestion: result.suggestion,
      },
      { status: result.status ?? 422 }
    );
  }

  return NextResponse.json({ profile: result.profile });
}
