import { NextResponse } from "next/server";
import { getPublishedPublicProfileBySlug } from "@/lib/profiles";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const profile = getPublishedPublicProfileBySlug(slug);

  if (!profile) {
    return NextResponse.json(
      { error: "Perfil público não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      booking: {
        slug: profile.slug,
        displayName: profile.displayName,
        internalBookingEnabled: profile.internalBookingEnabled,
        bookingLabel: profile.bookingLabel,
        serviceName: profile.bookingServiceName ?? "Atendimento",
        timezone: profile.bookingTimezone ?? "America/Sao_Paulo",
        horizonDays: profile.bookingHorizonDays ?? 14,
        slotDurationMinutes: profile.bookingSlotDurationMinutes ?? 30,
        hasWhatsapp: Boolean(profile.whatsappUrl),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

