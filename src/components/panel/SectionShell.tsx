"use client";

import type { ReactNode } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";

interface SectionShellProps {
  id?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * Single visible editor section. Unlike the old accordion, only the selected
 * section is mounted at a time, so the heading is informational (not a toggle).
 */
export function SectionShell({
  id,
  title,
  description,
  aside,
  children,
}: SectionShellProps) {
  return (
    <GlassSurface as="section" intensity="dense" className="editor-section">
      <div id={id} className="editor-section-inner">
        <header className="editor-section-heading">
          <div className="editor-section-heading-text">
            <h2 className="editor-section-title">{title}</h2>
            {description ? (
              <p className="editor-section-desc">{description}</p>
            ) : null}
          </div>
          {aside ? <div className="editor-section-aside">{aside}</div> : null}
        </header>
        <div className="editor-section-content">{children}</div>
      </div>
    </GlassSurface>
  );
}
