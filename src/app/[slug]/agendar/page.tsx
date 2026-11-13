import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicBookingView } from "@/components/public/PublicBookingView";
import { isSafeHttpUrl } from "@/components/public/profile-visuals";
import { getPublishedPublicProfileBySlug } from "@/lib/profiles";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ service?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = getPublishedPublicProfileBySlug(slug);

  if (!profile) {
    return {
      title: "Agendamento não encontrado",
    };
  }

  return {
    title: `Agendar com ${profile.displayName}`,
    description: `Escolha um dia e horário disponível para agendar com ${profile.displayName} no LinkIA.`,
  };
}

export default async function PublicBookingPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const requestedServiceId =
    typeof sp.service === "string" ? sp.service.trim() : "";
  const profile = getPublishedPublicProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  const selectedService = requestedServiceId
    ? profile.catalogItems?.find(
        (item) =>
          item.publicId === requestedServiceId &&
          item.flowType === "appointment" &&
          item.availabilityStatus === "available"
      ) ?? null
    : null;

  if (requestedServiceId && !selectedService) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          className="glass-surface"
          data-intensity="standard"
          style={{
            maxWidth: "440px",
            width: "100%",
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>
            Serviço indisponível
          </h1>
          <p style={{ margin: "0 0 18px", color: "var(--color-text-muted)" }}>
            O serviço selecionado não está mais disponível para agendamento neste
            perfil.
          </p>
          <Link href={`/${profile.slug}`} className="btn btn-primary">
            Voltar para o perfil
          </Link>
        </div>
      </main>
    );
  }

  if (!profile.internalBookingEnabled) {
    const reasonTitle =
      profile.internalBookingReason === "disconnected"
        ? "Agenda desconectada"
        : profile.internalBookingReason === "missing_whatsapp"
          ? "Contato de agendamento incompleto"
          : "Agendamento desativado";
    const reasonMessage =
      profile.internalBookingReason === "disconnected"
        ? `A Google Agenda de ${profile.displayName} não está conectada no momento.`
        : profile.internalBookingReason === "missing_whatsapp"
          ? `${profile.displayName} ainda não configurou um número de WhatsApp para receber agendamentos.`
          : `${profile.displayName} ainda não ativou o agendamento online neste perfil.`;

    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          className="glass-surface"
          data-intensity="standard"
          style={{ maxWidth: "440px", width: "100%", padding: "28px 24px", textAlign: "center" }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>
            {reasonTitle}
          </h1>
          <p style={{ margin: "0 0 18px", color: "var(--color-text-muted)" }}>
            {reasonMessage}
          </p>
          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {isSafeHttpUrl(profile.whatsappUrl) ? (
              <a
                href={profile.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Falar no WhatsApp
              </a>
            ) : null}
            <Link href={`/${profile.slug}`} className="btn btn-secondary">
              Voltar para o perfil
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <PublicBookingView profile={profile} selectedService={selectedService} />
  );
}
