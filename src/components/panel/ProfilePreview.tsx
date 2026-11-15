"use client";

import { useState } from "react";
import { PublicProfileView } from "@/components/public/PublicProfileView";
import {
  buildPreviewInstagramUrl,
  buildPreviewWhatsappUrl,
} from "@/components/public/profile-visuals";
import { GlassSurface } from "@/components/ui/GlassSurface";
import {
  DEFAULT_PUBLIC_ORDER,
  type Profile,
  type PublicBlockKey,
  type PublicCatalogItem,
  type PublicCustomLinkItem,
  type PublicProfile,
} from "@/lib/types";

interface ProfilePreviewProps {
  draft: Profile;
  internalBookingEnabled?: boolean;
  catalogItems?: PublicCatalogItem[];
  customLinks?: PublicCustomLinkItem[];
  onPublicOrderChange?: (order: PublicBlockKey[]) => void;
}

const BLOCK_LABELS: Record<PublicBlockKey, string> = {
  booking: "Agendamento",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  custom_links: "Links personalizados",
  social_highlights: "Destaques do Instagram",
  catalog: "Serviços e Produtos",
};

export function ProfilePreview({
  draft,
  internalBookingEnabled = false,
  catalogItems = [],
  customLinks = [],
  onPublicOrderChange,
}: ProfilePreviewProps) {
  const [draggingKey, setDraggingKey] = useState<PublicBlockKey | null>(null);

  const instagramUrl = draft.instagramEnabled
    ? buildPreviewInstagramUrl(draft.instagramInput)
    : null;
  const whatsappUrl = draft.whatsappEnabled
    ? buildPreviewWhatsappUrl(draft.whatsappNumber, draft.whatsappMessage)
    : null;

  const currentOrder: PublicBlockKey[] = (() => {
    const raw = draft.publicOrder ?? DEFAULT_PUBLIC_ORDER;
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

  const isBlockActive: Record<PublicBlockKey, boolean> = {
    booking: internalBookingEnabled,
    whatsapp: Boolean(whatsappUrl),
    instagram: Boolean(instagramUrl),
    tiktok: false,
    custom_links: customLinks.length > 0,
    social_highlights: false,
    catalog: catalogItems.length > 0,
  };

  const activeOrderedKeys = currentOrder.filter((key) => isBlockActive[key]);

  function moveActiveBlock(key: PublicBlockKey, direction: -1 | 1) {
    if (!onPublicOrderChange) return;
    const activeIdx = activeOrderedKeys.indexOf(key);
    const targetActiveIdx = activeIdx + direction;
    if (
      activeIdx < 0 ||
      targetActiveIdx < 0 ||
      targetActiveIdx >= activeOrderedKeys.length
    ) {
      return;
    }
    const targetKey = activeOrderedKeys[targetActiveIdx];
    const next = [...currentOrder];
    const fromIdx = next.indexOf(key);
    const toIdx = next.indexOf(targetKey);
    if (fromIdx < 0 || toIdx < 0) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, key);
    onPublicOrderChange(next);
  }

  function handleDropOn(targetKey: PublicBlockKey) {
    if (!onPublicOrderChange || !draggingKey || draggingKey === targetKey) {
      setDraggingKey(null);
      return;
    }
    const next = [...currentOrder];
    const fromIdx = next.indexOf(draggingKey);
    const toIdx = next.indexOf(targetKey);
    if (fromIdx >= 0 && toIdx >= 0) {
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggingKey);
      onPublicOrderChange(next);
    }
    setDraggingKey(null);
  }

  const publicProfile: PublicProfile = {
    slug: draft.slug,
    displayName: draft.displayName,
    bio: draft.bio,
    avatarUrl: draft.avatarUrl,
    instagramUrl,
    whatsappUrl,
    bookingUrl: null,
    bookingLabel: draft.bookingLabel || "Agendar horário",
    internalBookingEnabled,
    catalogItems,
    customLinks,
    publicOrder: currentOrder,
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

      {onPublicOrderChange && activeOrderedKeys.length > 1 ? (
        <GlassSurface intensity="standard">
          <div
            style={{
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ fontSize: "0.84rem" }}>
                Ordem dos elementos
              </strong>
              <button
                type="button"
                onClick={() => onPublicOrderChange([...DEFAULT_PUBLIC_ORDER])}
                className="btn btn-secondary"
                style={{ minHeight: "30px", padding: "2px 8px", fontSize: "0.75rem" }}
              >
                Restaurar padrão
              </button>
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {activeOrderedKeys.map((key, idx) => (
                <li
                  key={key}
                  draggable
                  onDragStart={() => setDraggingKey(key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOn(key)}
                  onDragEnd={() => setDraggingKey(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "6px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    background:
                      draggingKey === key
                        ? "var(--color-success-bg)"
                        : "var(--color-surface-subtle)",
                    fontSize: "0.82rem",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        cursor: "grab",
                        touchAction: "none",
                        userSelect: "none",
                        color: "var(--color-text-muted)",
                        padding: "0 2px",
                      }}
                    >
                      ⋮⋮
                    </span>
                    <span>{BLOCK_LABELS[key]}</span>
                  </span>
                  <span style={{ display: "inline-flex", gap: "4px" }}>
                    <button
                      type="button"
                      onClick={() => moveActiveBlock(key, -1)}
                      disabled={idx === 0}
                      aria-label={`Mover ${BLOCK_LABELS[key]} para cima`}
                      className="btn btn-secondary"
                      style={{ minHeight: "28px", padding: "2px 8px", fontSize: "0.78rem" }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveActiveBlock(key, 1)}
                      disabled={idx === activeOrderedKeys.length - 1}
                      aria-label={`Mover ${BLOCK_LABELS[key]} para baixo`}
                      className="btn btn-secondary"
                      style={{ minHeight: "28px", padding: "2px 8px", fontSize: "0.78rem" }}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="field-hint" style={{ margin: 0, fontSize: "0.75rem" }}>
              Arraste ou use ↑ ↓ e clique em Salvar para publicar na mesma ordem.
            </p>
          </div>
        </GlassSurface>
      ) : null}

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
