import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getLegalAcceptanceStatusForUser,
  LegalAcceptanceError,
  recordLegalAcceptanceForUser,
} from "@/lib/legal-acceptance";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const status = getLegalAcceptanceStatusForUser(user.id);
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("[Legal] Falha ao consultar estado de aceite.");
    return NextResponse.json(
      { error: "Não foi possível consultar o registro de aceite." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: {
    profileId?: unknown;
    termsAccepted?: unknown;
    termsVersion?: unknown;
    privacyAcknowledged?: unknown;
    privacyVersion?: unknown;
    optionalProductUpdates?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição JSON inválido." },
      { status: 400 }
    );
  }

  if (
    typeof body.termsAccepted !== "boolean" ||
    typeof body.termsVersion !== "string" ||
    typeof body.privacyAcknowledged !== "boolean" ||
    typeof body.privacyVersion !== "string" ||
    (body.profileId !== undefined &&
      body.profileId !== null &&
      typeof body.profileId !== "string") ||
    (body.optionalProductUpdates !== undefined &&
      typeof body.optionalProductUpdates !== "boolean")
  ) {
    return NextResponse.json(
      { error: "Parâmetros de aceite inválidos." },
      { status: 400 }
    );
  }

  try {
    const status = recordLegalAcceptanceForUser({
      userId: user.id,
      profileId:
        typeof body.profileId === "string" ? body.profileId : undefined,
      termsAccepted: body.termsAccepted,
      termsVersion: body.termsVersion,
      privacyAcknowledged: body.privacyAcknowledged,
      privacyVersion: body.privacyVersion,
      optionalProductUpdates:
        typeof body.optionalProductUpdates === "boolean"
          ? body.optionalProductUpdates
          : undefined,
    });

    return NextResponse.json(status, { status: 201 });
  } catch (err) {
    if (err instanceof LegalAcceptanceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    console.error("[Legal] Falha ao registrar aceite.");
    return NextResponse.json(
      { error: "Não foi possível registrar o aceite." },
      { status: 500 }
    );
  }
}
