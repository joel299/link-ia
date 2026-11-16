"use client";

export type SectionSkeletonVariant =
  | "identity"
  | "channels"
  | "appearance"
  | "schedule"
  | "catalog"
  | "traffic"
  | "generic";

interface SectionSkeletonProps {
  variant?: SectionSkeletonVariant;
  label?: string;
  /** Rows used by the generic/channels variants. */
  rows?: number;
}

function Bar({ width = "100%", height = 12 }: { width?: string; height?: number }) {
  return (
    <span
      className="skeleton-bar"
      style={{ width, height: `${height}px` }}
      aria-hidden="true"
    />
  );
}

function FieldRow() {
  return (
    <div className="skeleton-field">
      <Bar width="34%" height={10} />
      <Bar width="100%" height={38} />
    </div>
  );
}

/**
 * Content-only placeholder shown while a section fetches its data.
 * The editor header, the Profile menu and the profile identification stay
 * fully usable outside this block.
 */
export function SectionSkeleton({
  variant = "generic",
  label = "Carregando seção",
  rows = 3,
}: SectionSkeletonProps) {
  return (
    <div className="section-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>

      {variant === "identity" ? (
        <>
          <div className="skeleton-cover" aria-hidden="true" />
          <div className="skeleton-avatar-row" aria-hidden="true">
            <span className="skeleton-avatar" />
            <div className="skeleton-stack">
              <Bar width="42%" height={12} />
              <Bar width="64%" height={10} />
            </div>
          </div>
          <FieldRow />
          <FieldRow />
          <FieldRow />
        </>
      ) : null}

      {variant === "channels" ? (
        <div className="skeleton-card-grid" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="skeleton-card" key={index}>
              <span className="skeleton-channel-icon" />
              <div className="skeleton-stack">
                <Bar width="58%" height={12} />
                <Bar width="80%" height={10} />
              </div>
              <Bar width="100%" height={32} />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "appearance" ? (
        <>
          <div className="skeleton-card-grid skeleton-card-grid-wide" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, index) => (
              <div className="skeleton-card" key={index}>
                <Bar width="52%" height={12} />
                <Bar width="100%" height={42} />
              </div>
            ))}
          </div>
          <div className="skeleton-card-grid" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="skeleton-swatch" key={index}>
                <span className="skeleton-swatch-dot" />
                <Bar width="70%" height={10} />
              </div>
            ))}
          </div>
          <FieldRow />
        </>
      ) : null}

      {variant === "schedule" ? (
        <>
          <div className="skeleton-row" aria-hidden="true">
            <span className="skeleton-dot" />
            <Bar width="40%" height={12} />
            <Bar width="22%" height={12} />
          </div>
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="skeleton-day-row" key={index} aria-hidden="true">
              <Bar width="28%" height={12} />
              <Bar width="18%" height={32} />
              <Bar width="18%" height={32} />
            </div>
          ))}
          <FieldRow />
        </>
      ) : null}

      {variant === "catalog" ? (
        <div className="skeleton-card-grid" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="skeleton-card" key={index}>
              <span className="skeleton-thumb" />
              <Bar width="72%" height={12} />
              <Bar width="45%" height={10} />
              <Bar width="100%" height={32} />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "traffic" ? (
        <div className="traffic-skeleton" aria-hidden="true">
          <div className="traffic-skeleton-card">
            <Bar width="28%" height={14} />
            <div className="traffic-skeleton-summary">
              <Bar width="76%" height={12} />
              <Bar width="64%" height={12} />
              <Bar width="52%" height={12} />
            </div>
            <Bar width="100%" height={44} />
          </div>
          <div className="traffic-skeleton-campaigns">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="traffic-skeleton-card" key={index}>
                <div className="traffic-skeleton-campaign-heading">
                  <Bar width="58%" height={14} />
                  <Bar width="18%" height={24} />
                </div>
                <Bar width="36%" height={10} />
                <div className="traffic-skeleton-summary">
                  <Bar width="78%" height={12} />
                  <Bar width="64%" height={12} />
                  <Bar width="72%" height={12} />
                  <Bar width="54%" height={12} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {variant === "generic" ? (
        <div className="skeleton-stack" aria-hidden="true">
          {Array.from({ length: rows }).map((_, index) => (
            <Bar key={index} width={index % 2 === 0 ? "100%" : "72%"} height={14} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
