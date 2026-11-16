import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const target = process.env.SCALAR_DOCS_URL?.trim();
  if (!target) {
    return NextResponse.json({
      error: "A documentação Scalar ainda não foi publicada ou vinculada ao LinkIA.",
      nextStep: "Publique scalar-docs e defina SCALAR_DOCS_URL com o endereço gerado pelo Scalar.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const url = new URL(target);
    const allowed = url.protocol === "https:" && (url.hostname === "apidocumentation.com" || url.hostname.endsWith(".apidocumentation.com") || url.hostname === "scalar.com" || url.hostname.endsWith(".scalar.com"));
    if (!allowed) return NextResponse.json({ error: "O endereço configurado da documentação não é um domínio seguro do Scalar." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.redirect(url, 302);
  } catch {
    return NextResponse.json({ error: "O endereço da documentação Scalar está inválido." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
