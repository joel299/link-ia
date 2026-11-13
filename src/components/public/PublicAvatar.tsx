"use client";

import { useState } from "react";
import { getInitials } from "./profile-visuals";

interface PublicAvatarProps {
  avatarUrl: string | null;
  displayName: string;
}

export function PublicAvatar({ avatarUrl, displayName }: PublicAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasFailed = avatarUrl !== null && failedUrl === avatarUrl;

  if (avatarUrl && !hasFailed) {
    return (
      <img
        key={avatarUrl}
        src={avatarUrl}
        alt={`Foto de ${displayName || "perfil"}`}
        width={96}
        height={96}
        className="public-avatar-img"
        onError={() => setFailedUrl(avatarUrl)}
      />
    );
  }

  return (
    <div className="public-avatar-fallback" aria-hidden="true">
      {getInitials(displayName)}
    </div>
  );
}
