import type { ReactNode } from "react";

interface ProfileActionLinkProps {
  href: string;
  label: string;
  sublabel?: string;
  variant: "booking" | "whatsapp" | "instagram";
  icon: ReactNode;
}

export function ProfileActionLink({
  href,
  label,
  sublabel,
  variant,
  icon,
}: ProfileActionLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`public-action-link public-action-${variant}`}
    >
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
        <path d="M7 17 17 7M7 7h10v10" />
      </svg>
    </a>
  );
}
