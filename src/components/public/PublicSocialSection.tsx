import type { PublicSocialMediaItem } from "@/lib/types";
import { isSafeHttpUrl } from "./profile-visuals";

interface PublicSocialSectionProps {
  items: PublicSocialMediaItem[];
  instagramConnectedPendingSync?: boolean;
  isPreview?: boolean;
}

function getMediaTypeLabel(mediaType: string): string {
  switch (mediaType.toUpperCase()) {
    case "REELS":
    case "REEL":
      return "Reel";
    case "VIDEO":
      return "Vídeo";
    case "CAROUSEL_ALBUM":
      return "Carrossel";
    default:
      return "Post";
  }
}

export function PublicSocialSection({
  items,
  instagramConnectedPendingSync = false,
  isPreview = false,
}: PublicSocialSectionProps) {
  const safeItems = items
    .filter((item) => isSafeHttpUrl(item.permalink))
    .slice(0, 3);

  if (safeItems.length === 0) {
    if (!instagramConnectedPendingSync) {
      return null;
    }

    return (
      <section
        className="public-social-section"
        aria-label="Publicações recentes do Instagram"
      >
        <div className="public-social-header">
          <h2 className="public-social-title">Destaques do Instagram</h2>
        </div>
        <p className="public-social-pending">
          Instagram conectado. Os destaques aparecerão aqui assim que a primeira
          sincronização for concluída.
        </p>
      </section>
    );
  }

  return (
    <section
      className="public-social-section"
      aria-label="Publicações recentes do Instagram"
    >
      <div className="public-social-header">
        <h2 className="public-social-title">Destaques do Instagram</h2>
      </div>
      <div className="public-social-grid">
        {safeItems.map((item) => {
          const thumbSrc =
            item.thumbnailUrl && isSafeHttpUrl(item.thumbnailUrl)
              ? item.thumbnailUrl
              : null;
          const label = getMediaTypeLabel(item.mediaType);

          return (
            <a
              key={item.externalId}
              href={isPreview ? undefined : item.permalink}
              target={isPreview ? undefined : "_blank"}
              rel={isPreview ? undefined : "noopener noreferrer"}
              className="public-social-card"
              aria-label={`${label}: ${item.caption || "Abrir no Instagram"}`}
            >
              <div className="public-social-thumb-wrap">
                {thumbSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbSrc}
                    alt={item.caption || `Publicação (${label})`}
                    loading="lazy"
                    decoding="async"
                    className="public-social-thumb"
                  />
                ) : (
                  <div className="public-social-thumb-fallback">{label}</div>
                )}
                <span className="public-social-badge">{label}</span>
              </div>
              {item.caption ? (
                <p className="public-social-caption">{item.caption}</p>
              ) : null}
              {typeof item.likeCount === "number" ||
              typeof item.commentCount === "number" ? (
                <p className="public-social-stats">
                  {typeof item.likeCount === "number" &&
                  typeof item.commentCount === "number"
                    ? `${item.likeCount.toLocaleString("pt-BR")} curtidas · ${item.commentCount.toLocaleString("pt-BR")} comentários`
                    : typeof item.likeCount === "number"
                      ? `${item.likeCount.toLocaleString("pt-BR")} curtidas`
                      : `${item.commentCount!.toLocaleString("pt-BR")} comentários`}
                </p>
              ) : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}

