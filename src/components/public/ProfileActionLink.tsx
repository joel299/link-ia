"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  trackPublicInteraction,
  type TrackablePublicEvent,
} from "./track-public-event";

interface ProfileActionLinkProps {
  href: string;
  label: string;
  sublabel?: string;
  variant: "booking" | "whatsapp" | "instagram";
  icon: ReactNode;
  trackSlug?: string;
  trackEvent?: TrackablePublicEvent;
  internalLink?: boolean;
}

export function ProfileActionLink({
  href,
  label,
  sublabel,
  variant,
  icon,
  trackSlug,
  trackEvent,
  internalLink = false,
}: ProfileActionLinkProps) {
  function handleClick() {
    if (trackSlug && trackEvent) {
      trackPublicInteraction(trackSlug, trackEvent);
    }
  }

  const content = (
    <>
      <span className="public-action-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="public-action-text">
        <span className="public-action-label">{label}</span>
        {sublabel ? (
          <span className="public-action-sublabel">{sublabel}</span>
        ) : null}
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
        {internalLink ? (
          <path d="M5 12h14M12 5l7 7-7 7" />
        ) : (
          <path d="M7 17 17 7M7 7h10v10" />
        )}
      </svg>
    </>
  );

  if (internalLink) {
    return (
      <Link
        href={href}
        onClick={handleClick}
        className={`public-action-link public-action-${variant}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`public-action-link public-action-${variant}`}
    >
      {content}
    </a>
  );
}
