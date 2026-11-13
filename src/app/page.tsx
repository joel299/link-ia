import Link from "next/link";
import { PublicProfileView } from "@/components/public/PublicProfileView";
import { BrandMark } from "@/components/ui/BrandMark";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { DEFAULT_DARK_THEME, type PublicProfile } from "@/lib/types";

const SAMPLE_PUBLIC_PROFILE: PublicProfile = {
  slug: "barbearia-quintana",
  displayName: "Barbearia Quintana",
  bio: "Cortes clássicos, barba e atendimento com hora marcada no centro.",
  avatarUrl: null,
  instagramUrl: "https://instagram.com/barbeariaquintana",
  whatsappUrl: "https://wa.me/5511999999999",
  bookingUrl: null,
  bookingLabel: "Agendar horário",
  internalBookingEnabled: false,
  theme: DEFAULT_DARK_THEME,
  updatedAt: "2026-11-12T00:00:00.000Z",
};

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          width: "100%",
          maxWidth: "1200px",
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
          aria-label="Navegação principal"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          <ThemeToggle />
          <Link href="/login" className="btn btn-secondary">
            Entrar
          </Link>
          <Link href="/painel" className="btn btn-primary">
            Abrir painel
          </Link>
        </nav>
      </header>

      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "24px 20px 64px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "40px",
          alignItems: "center",
        }}
      >
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <span
            className="badge"
            style={{
              alignSelf: "flex-start",
              borderColor: "var(--color-accent)",
              color: "var(--color-accent)",
            }}
          >
            LinkIA MVP · Página de Bio
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
            }}
          >
            Crie uma página de bio com a sua marca em poucos minutos.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "1.0625rem",
              color: "var(--color-text-muted)",
              maxWidth: "52ch",
            }}
          >
            Reúna Instagram, WhatsApp e agendamento em uma URL curta e leve.
            Escolha cores, fonte, tema claro ou escuro e publique sem precisar
            programar.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              paddingTop: "4px",
            }}
          >
            <Link href="/login" className="btn btn-primary">
              Começar agora
            </Link>
            <Link href="/login?demo=1" className="btn btn-secondary">
              Testar demonstração
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              marginTop: "12px",
            }}
          >
            <GlassSurface intensity="subtle">
              <div style={{ padding: "16px" }}>
                <strong style={{ display: "block", marginBottom: "4px" }}>
                  URL curta própria
                </strong>
                <span
                  style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
                >
                  Slug único e legível, pronto para colocar na bio do Instagram.
                </span>
              </div>
            </GlassSurface>
            <GlassSurface intensity="subtle">
              <div style={{ padding: "16px" }}>
                <strong style={{ display: "block", marginBottom: "4px" }}>
                  Links essenciais
                </strong>
                <span
                  style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
                >
                  WhatsApp com DDI, Instagram e link de agendamento em 1 clique.
                </span>
              </div>
            </GlassSurface>
            <GlassSurface intensity="subtle">
              <div style={{ padding: "16px" }}>
                <strong style={{ display: "block", marginBottom: "4px" }}>
                  Prévia ao vivo
                </strong>
                <span
                  style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
                >
                  Edite cores, fonte e botões vendo o resultado na hora.
                </span>
              </div>
            </GlassSurface>
          </div>
        </section>

        <section
          aria-label="Exemplo de página pública LinkIA"
          style={{ display: "flex", justifyContent: "center" }}
        >
          <GlassSurface
            intensity="elevated"
            style={{
              width: "100%",
              maxWidth: "360px",
              borderRadius: "28px",
              padding: "10px",
            }}
            withPlate={false}
          >
            <div
              style={{
                borderRadius: "20px",
                overflow: "hidden",
                border: "1px solid var(--color-border)",
              }}
            >
              <PublicProfileView profile={SAMPLE_PUBLIC_PROFILE} isPreview />
            </div>
          </GlassSurface>
        </section>
      </main>
    </div>
  );
}
