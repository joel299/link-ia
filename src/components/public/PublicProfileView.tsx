import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  DEFAULT_PUBLIC_ORDER,
  type CustomLinkIconType,
  type PublicBlockKey,
  type PublicProfile,
} from "@/lib/types";
import { ProfileActionLink } from "./ProfileActionLink";
import { PublicAvatar } from "./PublicAvatar";
import { PublicCatalogCarousel } from "./PublicCatalogCarousel";
import { PublicSocialSection } from "./PublicSocialSection";
import {
  getButtonRadius,
  getContrastTextColor,
  getFontStack,
  isSafeHttpUrl,
} from "./profile-visuals";
import "./public-profile.css";

interface PublicProfileViewProps {
  profile: PublicProfile;
  isPreview?: boolean;
}

export function PublicProfileView({
  profile,
  isPreview = false,
}: PublicProfileViewProps) {
  const { theme } = profile;

  const customVars = {
    "--pub-bg": theme.bgColor,
    "--pub-text": theme.textColor,
    "--pub-primary": theme.primaryColor,
    "--pub-on-primary": getContrastTextColor(theme.primaryColor),
    "--pub-accent": theme.accentColor,
    "--pub-font": getFontStack(theme.fontFamily),
    "--pub-radius": getButtonRadius(theme.buttonStyle),
  } as CSSProperties;

  const showInternalBooking = Boolean(profile.internalBookingEnabled);
  const whatsappHref = isSafeHttpUrl(profile.whatsappUrl)
    ? profile.whatsappUrl
    : null;
  const instagramHref = isSafeHttpUrl(profile.instagramUrl)
    ? profile.instagramUrl
    : null;
  const tiktokHref = isSafeHttpUrl(profile.tiktokUrl)
    ? profile.tiktokUrl
    : null;

  const customLinks = (profile.customLinks ?? []).filter((item) =>
    isSafeHttpUrl(item.url)
  );

  const orderedBlocks: PublicBlockKey[] = (() => {
    const raw = profile.publicOrder ?? DEFAULT_PUBLIC_ORDER;
    const seen = new Set<PublicBlockKey>();
    const list: PublicBlockKey[] = [];
    for (const key of raw) {
      if (DEFAULT_PUBLIC_ORDER.includes(key) && !seen.has(key)) {
        seen.add(key);
        list.push(key);
      }
    }
    for (const key of DEFAULT_PUBLIC_ORDER) {
      if (!seen.has(key)) list.push(key);
    }
    return list;
  })();

  const hasAnyLink = Boolean(
    showInternalBooking ||
      whatsappHref ||
      instagramHref ||
      tiktokHref ||
      customLinks.length > 0
  );
  const HeadingTag = isPreview ? "h2" : "h1";

  const renderBlock = (key: PublicBlockKey): ReactNode => {
    switch (key) {
      case "booking":
        if (!showInternalBooking) return null;
        return isPreview ? (
          <div
            key="booking"
            className="public-action-link public-action-booking"
          >
            <span className="public-action-icon" aria-hidden="true">
              <CalendarIcon />
            </span>
            <span className="public-action-text">
              <span className="public-action-label">
                {profile.bookingLabel || "Agendar horário"}
              </span>
              <span className="public-action-sublabel">
                Escolher dia e horário
              </span>
            </span>
          </div>
        ) : (
          <Link
            key="booking"
            href={`/${profile.slug}/agendar`}
            className="public-action-link public-action-booking"
          >
            <span className="public-action-icon" aria-hidden="true">
              <CalendarIcon />
            </span>
            <span className="public-action-text">
              <span className="public-action-label">
                {profile.bookingLabel || "Agendar horário"}
              </span>
              <span className="public-action-sublabel">
                Escolher dia e horário
              </span>
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="public-action-arrow"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        );
      case "whatsapp":
        if (!whatsappHref) return null;
        return (
          <ProfileActionLink
            key="whatsapp"
            href={whatsappHref}
            label="Falar no WhatsApp"
            sublabel="Iniciar conversa direta"
            variant="whatsapp"
            icon={<WhatsAppIcon />}
          />
        );
      case "instagram":
        if (!instagramHref) return null;
        return (
          <ProfileActionLink
            key="instagram"
            href={instagramHref}
            label="Seguir no Instagram"
            sublabel="Ver perfil oficial"
            variant="instagram"
            icon={<InstagramIcon />}
          />
        );
      case "tiktok":
        if (!tiktokHref) return null;
        return (
          <ProfileActionLink
            key="tiktok"
            href={tiktokHref}
            label="Seguir no TikTok"
            sublabel="Ver perfil oficial"
            variant="instagram"
            icon={<TikTokIcon />}
          />
        );
      case "custom_links":
        if (customLinks.length === 0) return null;
        return (
          <div key="custom_links" className="public-actions-list">
            {customLinks.map((item) => (
              <ProfileActionLink
                key={item.id}
                href={item.url}
                label={item.title}
                sublabel={item.description || undefined}
                variant="booking"
                icon={<CustomLinkIcon type={item.iconType} />}
              />
            ))}
          </div>
        );
      case "social_highlights":
        return (
          <PublicSocialSection
            key="social_highlights"
            items={profile.socialMediaItems ?? []}
            instagramConnectedPendingSync={
              profile.instagramConnectedPendingSync
            }
            isPreview={isPreview}
          />
        );
      case "catalog":
        return (
          <PublicCatalogCarousel
            key="catalog"
            slug={profile.slug}
            professionalName={profile.displayName || "Profissional"}
            items={profile.catalogItems ?? []}
            whatsappUrl={whatsappHref}
            internalBookingEnabled={showInternalBooking}
            isPreview={isPreview}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`public-page-shell ${isPreview ? "is-preview" : ""}`.trim()}
      data-pub-mode={theme.mode}
      style={customVars}
    >
      <main className="public-profile-container">
        <header className="public-profile-header">
          <div className="public-avatar-ring">
            <PublicAvatar
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
            />
          </div>
          <HeadingTag className="public-profile-name">
            {profile.displayName || "Seu Nome"}
          </HeadingTag>
          {profile.bio ? (
            <p className="public-profile-bio">{profile.bio}</p>
          ) : null}
        </header>

        <div
          className="public-actions-list"
          aria-label={`Conteúdo de ${profile.displayName || "perfil"}`}
        >
          {orderedBlocks.map((key) => renderBlock(key))}

          {!hasAnyLink ? (
            <div className="public-empty-links">
              {isPreview
                ? "Ative pelo menos um link (Instagram, WhatsApp, Agendamento ou Link personalizado) para exibi-lo aqui."
                : "Nenhum link disponível no momento."}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="public-footer">
        <span>Criado com</span>
        {isPreview ? (
          <strong>LinkIA</strong>
        ) : (
          <Link href="/">LinkIA</Link>
        )}
      </footer>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

function CustomLinkIcon({ type }: { type: CustomLinkIconType }) {
  if (type === "map") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }
  if (type === "store") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l1-5h16l1 5" />
        <path d="M4 9v11h16V9" />
      </svg>
    );
  }
  if (type === "calendar") {
    return <CalendarIcon />;
  }
  if (type === "phone") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  }
  if (type === "globe") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" x2="22" y1="12" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
