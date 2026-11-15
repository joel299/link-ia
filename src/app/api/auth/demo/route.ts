import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Acesso público de demonstração desativado. Utilize uma conta autorizada.",
    },
    { status: 403 }
  );
}
