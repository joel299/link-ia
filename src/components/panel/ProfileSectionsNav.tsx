"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface ProfileSectionItem {
  key: string;
  label: string;
  description?: string;
}

interface ProfileSectionsNavProps {
  sections: ProfileSectionItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  disabled?: boolean;
}

/**
 * "Profile" dropdown used to navigate between the five editor sections.
 * It only changes which section is mounted; it never touches profile data or
 * publish state.
 */
export function ProfileSectionsNav({
  sections,
  activeKey,
  onSelect,
  disabled = false,
}: ProfileSectionsNavProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(() =>
    Math.max(
      0,
      sections.findIndex((section) => section.key === activeKey)
    )
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const activeSection =
    sections.find((section) => section.key === activeKey) ?? sections[0];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = itemRefs.current[focusIndex];
    node?.focus();
  }, [open, focusIndex]);

  function openMenu() {
    const activeIndex = Math.max(
      0,
      sections.findIndex((section) => section.key === activeKey)
    );
    setFocusIndex(activeIndex);
    setOpen(true);
  }

  function closeMenu(returnFocus = true) {
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }

  function select(key: string) {
    closeMenu();
    if (key !== activeKey) {
      onSelect(key);
    }
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusIndex((prev) => (prev + 1) % sections.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusIndex((prev) => (prev - 1 + sections.length) % sections.length);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setFocusIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setFocusIndex(sections.length - 1);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="profile-sections-nav" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="profile-sections-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter") {
            if (!open) {
              event.preventDefault();
              openMenu();
            }
          }
        }}
      >
        <span className="profile-sections-trigger-label">
          <span className="profile-sections-eyebrow">Profile</span>
          <span className="profile-sections-current">
            {activeSection?.label ?? "Seções"}
          </span>
        </span>
        <span
          className={`profile-sections-chevron${open ? " is-open" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Seções do perfil"
          className="profile-sections-menu"
          onKeyDown={handleMenuKeyDown}
        >
          {sections.map((section, index) => {
            const isActive = section.key === activeKey;
            return (
              <button
                key={section.key}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                tabIndex={index === focusIndex ? 0 : -1}
                className={`profile-sections-item${isActive ? " is-active" : ""}`}
                onClick={() => select(section.key)}
                onFocus={() => setFocusIndex(index)}
              >
                <span className="profile-sections-item-main">
                  <span className="profile-sections-item-label">
                    {section.label}
                  </span>
                  {section.description ? (
                    <span className="profile-sections-item-desc">
                      {section.description}
                    </span>
                  ) : null}
                </span>
                <span className="profile-sections-item-mark" aria-hidden="true">
                  {isActive ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
