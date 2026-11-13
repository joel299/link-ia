import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicProfileView } from "@/components/public/PublicProfileView";
import { getPublishedPublicProfileBySlug } from "@/lib/profiles";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = getPublishedPublicProfileBySlug(slug);

  if (!profile) {
    return {
      title: "Perfil não encontrado",
      description: "Esta página do LinkIA não foi encontrada ou ainda está em rascunho.",
    };
  }

  const description =
    profile.bio ||
    `Confira os links de contato e agendamento de ${profile.displayName} no LinkIA.`;

  return {
    title: profile.displayName,
    description,
    openGraph: {
      title: `${profile.displayName} | LinkIA`,
      description,
      type: "profile",
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const profile = getPublishedPublicProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  return <PublicProfileView profile={profile} />;
}
