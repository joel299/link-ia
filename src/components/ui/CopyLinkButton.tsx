"use client";

import { useState } from "react";

interface CopyLinkButtonProps {
  url: string;
  label?: string;
  className?: string;
}

export function CopyLinkButton({
  url,
  label = "Copiar link",
  className = "",
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const fullUrl =
      url.startsWith("http") || typeof window === "undefined"
        ? url
        : `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;

    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = fullUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn btn-secondary ${className}`.trim()}
      aria-live="polite"
    >
      <CopyIcon />
      <span>{copied ? "Link copiado!" : label}</span>
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}
