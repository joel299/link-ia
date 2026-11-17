import { NextResponse } from "next/server";
import { recordPublicInteractionEvent } from "@/lib/dashboard";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  return "unknown";
}

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
      { error: "Corpo JSON inválido." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const result = recordPublicInteractionEvent({
    slug,
    eventType: rec.eventType,
    clientKey: getClientIp(request),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Não foi possível registrar o evento." },
      { status: result.status }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
