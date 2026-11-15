"use client";

import { useId, useState, type ReactNode } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";

interface CollapsibleSectionProps {
  id?: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  leadingIcon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  description,
  defaultOpen = false,
  leadingIcon,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const autoId = useId();
  const contentId = id ? `${id}-content` : `section-content-${autoId}`;

  return (
    <GlassSurface as="section" intensity="dense" className="editor-section">
      <div id={id} className="editor-section-inner">
        <button
          type="button"
          className="collapsible-trigger"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="collapsible-trigger-main">
            {leadingIcon ? (
              <span className="collapsible-trigger-icon" aria-hidden="true">
                {leadingIcon}
              </span>
            ) : null}
            <span className="collapsible-trigger-text">
              <span className="editor-section-title">{title}</span>
              {description ? (
                <span className="editor-section-desc">{description}</span>
              ) : null}
            </span>
          </span>

          <span className="collapsible-trigger-meta">
            {badge}
            <span
              className={`collapsible-chevron ${isOpen ? "is-open" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </span>
        </button>

        <div
          id={contentId}
          hidden={!isOpen}
          className="collapsible-body"
        >
          {children}
        </div>
      </div>
    </GlassSurface>
  );
}

