"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { GlassSurface } from "@/components/ui/GlassSurface";

function OAuthMockContent() {
  const searchParams = useSearchParams();
  const state = searchParams.get("state") || "";

  const approveHref = `/api/integrations/composio/callback?state=${encodeURIComponent(state)}&status=connected`;
  const cancelHref = `/api/integrations/composio/callback?state=${encodeURIComponent(state)}&status=cancelled`;

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
        intensity="elevated"
        style={{ maxWidth: "460px", width: "100%" }}
      >
        <div
          style={{
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <BrandMark href="/" size="sm" />

          <span
            className="badge"
            style={{
              alignSelf: "flex-start",
              borderColor: "var(--color-accent)",
              color: "var(--color-accent)",
            }}
          >
            Modo Simulação Local
          </span>

          <div>
            <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>
              Autorizar Google Agenda
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.925rem",
                color: "var(--color-text-muted)",
              }}
            >
              Esta tela simula o consentimento OAuth do Composio/Google quando{" "}
              <code>COMPOSIO_ALLOW_LOCAL_MOCK=true</code>. O LinkIA solicitará
              permissão para consultar disponibilidade e criar eventos na
              agenda.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <a href={approveHref} className="btn btn-primary">
              Autorizar Google Agenda (Simulação)
            </a>
            <a href={cancelHref} className="btn btn-secondary">
              Cancelar
            </a>
          </div>
        </div>
      </GlassSurface>
    </main>
  );
}

export default function OAuthMockPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-text-muted)",
          }}
        >
          Carregando autorização...
        </div>
      }
    >
      <OAuthMockContent />
    </Suspense>
  );
}
