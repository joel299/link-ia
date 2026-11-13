import Link from "next/link";
import type { CSSProperties } from "react";
import type { PublicProfile } from "@/lib/types";
import { ProfileActionLink } from "./ProfileActionLink";
import { PublicAvatar } from "./PublicAvatar";
import { PublicCatalogCarousel } from "./PublicCatalogCarousel";
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

  const hasAnyLink = Boolean(
    showInternalBooking || whatsappHref || instagramHref
  );
  const HeadingTag = isPreview ? "h2" : "h1";

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

        <nav
          className="public-actions-list"
          aria-label={`Links de ${profile.displayName || "perfil"}`}
        >
          {showInternalBooking ? (
            isPreview ? (
              <div className="public-action-link public-action-booking">
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
            )
          ) : null}

          {whatsappHref ? (
            <ProfileActionLink
              href={whatsappHref}
              label="Falar no WhatsApp"
              sublabel="Iniciar conversa direta"
              variant="whatsapp"
              icon={<WhatsAppIcon />}
            />
          ) : null}

          {instagramHref ? (
            <ProfileActionLink
              href={instagramHref}
              label="Seguir no Instagram"
              sublabel="Ver perfil oficial"
              variant="instagram"
              icon={<InstagramIcon />}
            />
          ) : null}

          {!hasAnyLink ? (
            <div className="public-empty-links">
              {isPreview
                ? "Ative pelo menos um link (Instagram, WhatsApp ou Agendamento) para exibi-lo aqui."
                : "Nenhum link disponível no momento."}
            </div>
          ) : null}
        </nav>
      </main>

      <PublicCatalogCarousel
        slug={profile.slug}
        professionalName={profile.displayName || "Profissional"}
        items={profile.catalogItems ?? []}
        whatsappUrl={whatsappHref}
        internalBookingEnabled={showInternalBooking}
        isPreview={isPreview}
      />

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
