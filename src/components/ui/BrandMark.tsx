import Link from "next/link";

interface BrandMarkProps {
  href?: string;
  size?: "sm" | "md";
}

export function BrandMark({ href = "/", size = "md" }: BrandMarkProps) {
  const iconSize = size === "sm" ? 26 : 32;
  const fontSize = size === "sm" ? "1.05rem" : "1.2rem";

  const content = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        fontWeight: 700,
        fontSize,
        letterSpacing: "-0.02em",
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <rect
          width="32"
          height="32"
          rx="9"
          fill="#101312"
          stroke="var(--color-border-strong)"
          strokeWidth="1"
        />
        <path d="M9 9H13.5V19H22.5V23H9V9Z" fill="#33B978" />
        <circle cx="21.5" cy="11.5" r="3" fill="#E2C987" />
      </svg>
      <span>
        Link<span style={{ color: "var(--color-primary)" }}>IA</span>
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        minHeight: "44px",
      }}
    >
      {content}
    </Link>
  );
}
