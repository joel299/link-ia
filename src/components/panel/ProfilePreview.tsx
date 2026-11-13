"use client";

import { PublicProfileView } from "@/components/public/PublicProfileView";
import {
  buildPreviewInstagramUrl,
  buildPreviewWhatsappUrl,
} from "@/components/public/profile-visuals";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { Profile, PublicCatalogItem, PublicProfile } from "@/lib/types";

interface ProfilePreviewProps {
  draft: Profile;
  internalBookingEnabled?: boolean;
  catalogItems?: PublicCatalogItem[];
}

export function ProfilePreview({
  draft,
  internalBookingEnabled = false,
  catalogItems = [],
}: ProfilePreviewProps) {
  const publicProfile: PublicProfile = {
    slug: draft.slug,
    displayName: draft.displayName,
    bio: draft.bio,
    avatarUrl: draft.avatarUrl,
    instagramUrl: draft.instagramEnabled
      ? buildPreviewInstagramUrl(draft.instagramInput)
      : null,
    whatsappUrl: draft.whatsappEnabled
      ? buildPreviewWhatsappUrl(draft.whatsappNumber, draft.whatsappMessage)
      : null,
    bookingUrl: null,
    bookingLabel: draft.bookingLabel || "Agendar horário",
    internalBookingEnabled,
    catalogItems,
    theme: draft.theme,
    updatedAt: draft.updatedAt,
  };

  return (
    <div className="preview-column">
      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Prévia ao vivo
      </div>
      <GlassSurface
        intensity="elevated"
        className="preview-phone-frame"
        withPlate={false}
      >
        <div className="preview-phone-screen">
          <PublicProfileView profile={publicProfile} isPreview />
        </div>
      </GlassSurface>
    </div>
  );
}
