import { NextResponse } from "next/server";
import { createBookingForProfile, SchedulingError } from "@/lib/scheduling";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição JSON inválido." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const startIso = typeof rec.startIso === "string" ? rec.startIso : "";
  const idempotencyKey =
    typeof rec.idempotencyKey === "string" ? rec.idempotencyKey : "";
  const clientName = typeof rec.clientName === "string" ? rec.clientName : "";
  const clientPhone =
    typeof rec.clientPhone === "string"
      ? rec.clientPhone
      : typeof rec.clientContact === "string"
        ? rec.clientContact
        : "";
  const notes = typeof rec.notes === "string" ? rec.notes : "";
  const servicePublicId =
    typeof rec.servicePublicId === "string" ? rec.servicePublicId : undefined;

  try {
    const result = await createBookingForProfile({
      slug,
      startIso,
      idempotencyKey,
      clientName,
      clientPhone,
      servicePublicId,
      notes,
    });

    return NextResponse.json(
      { booking: result.booking, idempotent: result.idempotent },
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (err) {
    if (err instanceof SchedulingError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível concluir o agendamento." },
      { status: 500 }
    );
  }
}
