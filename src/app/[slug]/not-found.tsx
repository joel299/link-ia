import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { GlassSurface } from "@/components/ui/GlassSurface";

export default function PublicProfileNotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <GlassSurface
        intensity="standard"
        style={{ maxWidth: "440px", width: "100%" }}
        plateClassName="not-found-plate"
      >
        <div
          style={{
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "16px",
          }}
        >
          <BrandMark href="/" size="sm" />
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
            Página não encontrada
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--color-text-muted)",
              fontSize: "0.95rem",
            }}
          >
            Este perfil pode ter mudado de endereço ou ainda não foi publicado.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/" className="btn btn-primary">
              Ir para o LinkIA
            </Link>
            <Link href="/login" className="btn btn-secondary">
              Criar minha página
            </Link>
          </div>
        </div>
      </GlassSurface>
    </main>
  );
}
