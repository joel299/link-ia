"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCatalogItem } from "@/lib/types";
import { isSafeHttpUrl } from "./profile-visuals";

interface PublicCatalogCarouselProps {
  slug: string;
  professionalName: string;
  items: PublicCatalogItem[];
  whatsappUrl: string | null;
  internalBookingEnabled: boolean;
  isPreview?: boolean;
}

function formatPriceBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function buildItemWhatsappUrl(
  baseWhatsappUrl: string | null,
  item: PublicCatalogItem,
  professionalName: string
): string | null {
  if (!baseWhatsappUrl || !isSafeHttpUrl(baseWhatsappUrl)) return null;
  try {
    const parsed = new URL(baseWhatsappUrl);
    const digits = parsed.pathname.replace(/\D/g, "");
    if (digits.length < 10) return null;
    const priceLabel = formatPriceBRL(item.priceCents);
    const msg = `Olá, ${professionalName}! Tenho interesse em "${item.title}" (${priceLabel}). Gostaria de continuar o atendimento.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  } catch {
    return null;
  }
}

export function PublicCatalogCarousel({
  slug,
  professionalName,
  items,
  whatsappUrl,
  internalBookingEnabled,
  isPreview = false,
}: PublicCatalogCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const updateScrollBounds = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const raf = window.requestAnimationFrame(updateScrollBounds);
    window.addEventListener("resize", updateScrollBounds);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateScrollBounds);
    };
  }, [items.length, updateScrollBounds]);

  if (items.length === 0) {
    return null;
  }

  function scrollByStep(direction: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(240, Math.round(el.clientWidth * 0.85));
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: direction * step,
      behavior: prefersReduced ? "auto" : "smooth",
    });
  }

  const showArrows = canPrev || canNext;

  return (
    <section
      className="linkia-cat-section"
      aria-label="Serviços e produtos"
    >
      <div className="linkia-cat-header">
        <h2 className="linkia-cat-heading">Serviços e produtos</h2>
        {showArrows ? (
          <div className="linkia-cat-arrows">
            <button
              type="button"
              onClick={() => scrollByStep(-1)}
              disabled={!canPrev}
              aria-label="Ver itens anteriores"
              className="linkia-cat-arrow-btn"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollByStep(1)}
              disabled={!canNext}
              aria-label="Ver próximos itens"
              className="linkia-cat-arrow-btn"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={trackRef}
        onScroll={updateScrollBounds}
        className={`linkia-cat-track ${isPreview ? "is-preview" : ""}`}
        tabIndex={0}
        role="region"
        aria-roledescription="carrossel"
        aria-label={`Catálogo de ${professionalName}`}
      >
        {items.map((item, idx) => {
          const isUnavailable = item.availabilityStatus === "unavailable";
          const imgBroken = Boolean(failedImages[item.publicId]);
          const waHref =
            item.flowType === "whatsapp"
              ? buildItemWhatsappUrl(whatsappUrl, item, professionalName)
              : null;

          return (
            <article key={item.publicId} className="linkia-cat-card">
              <div className="linkia-cat-media">
                {item.imageUrl && !imgBroken ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    width={320}
                    height={200}
                    loading={idx < 3 ? "eager" : "lazy"}
                    decoding="async"
                    className="linkia-cat-img"
                    onError={() =>
                      setFailedImages((prev) => ({
                        ...prev,
                        [item.publicId]: true,
                      }))
                    }
                  />
                ) : (
                  <div className="linkia-cat-img-fallback" aria-hidden="true">
                    {item.title.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {isUnavailable ? (
                  <span className="linkia-cat-badge-unavail">Indisponível</span>
                ) : null}
              </div>

              <div className="linkia-cat-body">
                <div className="linkia-cat-title-row">
                  <h3 className="linkia-cat-title">{item.title}</h3>
                  <strong className="linkia-cat-price">
                    {formatPriceBRL(item.priceCents)}
                  </strong>
                </div>
                <p className="linkia-cat-desc">{item.description}</p>
                {item.flowType === "appointment" && item.durationMinutes ? (
                  <span className="linkia-cat-meta">
                    Duração: {item.durationMinutes} min
                  </span>
                ) : null}
              </div>

              <div className="linkia-cat-footer">
                {isUnavailable ? (
                  <button
                    type="button"
                    disabled
                    className="linkia-cat-cta is-disabled"
                  >
                    Indisponível
                  </button>
                ) : item.flowType === "appointment" ? (
                  isPreview ? (
                    <span className="linkia-cat-cta">Agendar</span>
                  ) : internalBookingEnabled ? (
                    <Link
                      href={`/${slug}/agendar?service=${encodeURIComponent(item.publicId)}`}
                      className="linkia-cat-cta"
                    >
                      Agendar
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="linkia-cat-cta is-disabled"
                      title="Agenda indisponível no momento"
                    >
                      Agenda indisponível
                    </button>
                  )
                ) : waHref && !isPreview ? (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="linkia-cat-cta"
                  >
                    Solicitar no WhatsApp
                  </a>
                ) : isPreview ? (
                  <span className="linkia-cat-cta">Solicitar no WhatsApp</span>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="linkia-cat-cta is-disabled"
                  >
                    WhatsApp indisponível
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

