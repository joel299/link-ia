"use client";

import type { ConnectedAccountItem } from "@/lib/dashboard";

interface ConnectedAccountsCirclesProps {
  items: ConnectedAccountItem[];
  total: number;
}

function ChannelGlyph({
  channel,
}: {
  channel: ConnectedAccountItem["channel"];
}) {
  switch (channel) {
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.1-5.1A8.5 8.5 0 1 1 21 11.5Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    case "facebook_social":
    case "meta_ads":
      return <span className="dash-avatar-initials">M</span>;
    case "tiktok_organic":
    case "tiktok_ads":
      return <span className="dash-avatar-initials">T</span>;
    case "google_calendar":
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
  }
}

export function ConnectedAccountsCircles({
  items,
  total,
}: ConnectedAccountsCirclesProps) {
  if (total === 0) {
    return null;
  }

  const visible = items.slice(0, 4);
  const overflow = Math.max(0, total - visible.length);

  return (
    <div
      className="dash-avatar-circles"
      aria-label={`${total} conta(s) conectada(s)`}
    >
      {visible.map((item) => (
        <span
          key={item.id}
          className={`dash-avatar-circle dash-avatar-${item.channel}`}
          title={`${item.channelLabel}: ${item.accountLabel}`}
        >
          <ChannelGlyph channel={item.channel} />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="dash-avatar-circle dash-avatar-counter"
          title={`Mais ${overflow} conta(s) conectada(s)`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
