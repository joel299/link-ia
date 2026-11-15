import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { LegalFooter } from "@/components/ui/LegalFooter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { LegalDocumentDefinition } from "@/lib/legal-documents";

interface LegalDocumentViewProps {
  document: LegalDocumentDefinition;
}

export function LegalDocumentView({ document }: LegalDocumentViewProps) {
  const otherHref =
    document.type === "terms_of_use"
      ? "/politica-de-privacidade"
      : "/termos-de-uso";
  const otherLabel =
    document.type === "terms_of_use"
      ? "Política de Privacidade"
      : "Termos de Uso";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          width: "100%",
          maxWidth: "960px",
          margin: "0 auto",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <BrandMark href="/" />
        <nav
          aria-label="Navegação legal"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Link href={otherHref} className="btn btn-secondary">
            {otherLabel}
          </Link>
          <Link href="/login" className="btn btn-secondary">
            Entrar
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "960px",
          margin: "0 auto",
          padding: "16px 20px 48px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <GlassSurface intensity="dense">
          <article
            style={{
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span
                className="badge"
                style={{
                  alignSelf: "flex-start",
                  borderColor: "var(--color-accent)",
                  color: "var(--color-accent)",
                }}
              >
                {document.isDraft ? "Minuta em revisão" : "Documento vigente"} · Versão{" "}
                {document.versionLabel}
              </span>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                {document.title}
              </h1>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px 24px",
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted)",
                }}
              >
                <span>
                  <strong>Última atualização:</strong> {document.lastUpdated}
                </span>
                <span>
                  <strong>Vigência:</strong> {document.intendedEffectiveDate}
                </span>
                <span>
                  <strong>Domínio oficial:</strong> {document.officialDomain}
                </span>
              </div>
            </header>

            {document.isDraft ? (
              <section
                aria-label="Aviso de conteúdo pendente"
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-accent)",
                  background: "var(--color-warning-bg)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <strong style={{ fontSize: "0.95rem" }}>
                  Conteúdo pendente de preenchimento e revisão jurídica
                </strong>
                <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
                  {document.draftNotice}
                </p>
                <div style={{ fontSize: "0.875rem" }}>
                  <strong>Campos ainda pendentes:</strong>
                  <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
                    {document.pendingFields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {document.sections.map((section) => (
                <section
                  key={section.id}
                  aria-labelledby={`sec-${section.id}`}
                  style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                >
                  <h2
                    id={`sec-${section.id}`}
                    style={{
                      margin: 0,
                      fontSize: "1.125rem",
                      fontWeight: 700,
                      lineHeight: 1.3,
                    }}
                  >
                    {section.heading}
                  </h2>
                  {section.paragraphs.map((p, idx) => (
                    <p
                      key={idx}
                      style={{
                        margin: 0,
                        fontSize: "0.95rem",
                        lineHeight: 1.6,
                        color: "var(--color-text)",
                      }}
                    >
                      {p}
                    </p>
                  ))}
                  {section.bullets && section.bullets.length > 0 ? (
                    <ul
                      style={{
                        margin: "4px 0 0",
                        paddingLeft: "22px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        fontSize: "0.95rem",
                        lineHeight: 1.55,
                      }}
                    >
                      {section.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </article>
        </GlassSurface>
      </main>

      <LegalFooter maxWidth="960px" />
    </div>
  );
}

