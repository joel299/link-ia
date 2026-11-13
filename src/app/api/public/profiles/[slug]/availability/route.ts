import { NextResponse } from "next/server";
import {
  getAvailableSlotsForDate,
  getAvailableSlotsForRange,
  SchedulingError,
} from "@/lib/scheduling";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const date = searchParams.get("date") ?? "";
  const servicePublicId = searchParams.get("service") ?? undefined;

  try {
    const result =
      from !== null && to !== null
        ? await getAvailableSlotsForRange({ slug, from, to, servicePublicId })
        : await getAvailableSlotsForDate({ slug, date, servicePublicId });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof SchedulingError) {
      return NextResponse.json(
        { error: err.message, errors: err.errors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Não foi possível consultar a disponibilidade." },
      { status: 503 }
    );
  }
}
