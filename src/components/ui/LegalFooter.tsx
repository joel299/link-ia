import Link from "next/link";

interface LegalFooterProps {
  maxWidth?: string;
}

export function LegalFooter({ maxWidth = "1200px" }: LegalFooterProps) {
  return (
    <footer
      style={{
        width: "100%",
        borderTop: "1px solid var(--color-border)",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth,
          margin: "0 auto",
          padding: "18px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
        }}
      >
        <span>LinkIA · https://linka.infinito.com.br</span>
        <nav
          aria-label="Documentos legais"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <Link
            href="/termos-de-uso"
            style={{
              color: "var(--color-text-muted)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Termos de Uso
          </Link>
          <Link
            href="/politica-de-privacidade"
            style={{
              color: "var(--color-text-muted)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Política de Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}

