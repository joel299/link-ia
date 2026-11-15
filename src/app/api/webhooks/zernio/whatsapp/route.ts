import { NextResponse } from "next/server";
import { processZernioWebhookEvent } from "@/lib/zernio-whatsapp";

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler o corpo da requisição." },
      { status: 400 }
    );
  }

  const signatureHeader = request.headers.get("x-zernio-signature");
  const result = processZernioWebhookEvent({
    rawBody,
    signatureHeader,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Erro ao processar webhook." },
      { status: result.statusCode }
    );
  }

  return NextResponse.json({
    ok: true,
    deduplicated: Boolean(result.deduplicated),
  });
}
