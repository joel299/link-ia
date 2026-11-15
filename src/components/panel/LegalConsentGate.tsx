"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { LegalFooter } from "@/components/ui/LegalFooter";

export interface LegalStatusClientView {
  requiresAcceptance: boolean;
  terms: {
    version: string;
    contentHash: string;
    acceptedCurrent: boolean;
    acceptedAt: string | null;
  };
  privacy: {
    version: string;
    contentHash: string;
    acknowledgedCurrent: boolean;
    acknowledgedAt: string | null;
  };
  optionalProductUpdates: {
    version: string;
    granted: boolean;
    updatedAt: string | null;
  };
}

interface LegalConsentGateProps {
  profileId: string | null;
  status: LegalStatusClientView;
  onAccepted: (updated: LegalStatusClientView) => void;
}

export function LegalConsentGate({
  profileId,
  status,
  onAccepted,
}: LegalConsentGateProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [optionalProductUpdates, setOptionalProductUpdates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!termsAccepted || !privacyAcknowledged) {
      setError(
        "Confirme o aceite dos Termos de Uso e a ciência da Política de Privacidade para continuar."
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profileId,
          termsAccepted,
          termsVersion: status.terms.version,
          privacyAcknowledged,
          privacyVersion: status.privacy.version,
          optionalProductUpdates,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Não foi possível registrar seu aceite.");
        setSubmitting(false);
        return;
      }
      onAccepted(data as LegalStatusClientView);
    } catch {
      setError("Erro de conexão ao registrar o aceite.");
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        maxWidth: "680px",
        margin: "12px auto 0",
      }}
    >
      <GlassSurface intensity="dense">
        <div
          style={{
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div>
            <span className="badge badge-draft" style={{ marginBottom: "8px" }}>
              Versão {status.terms.version}
            </span>
            <h1 style={{ margin: "0 0 8px", fontSize: "1.45rem", fontWeight: 700 }}>
              Termos de Uso e Privacidade
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.95rem",
                lineHeight: 1.55,
                color: "var(--color-text-muted)",
              }}
            >
              Antes de acessar os recursos do painel LinkIA, leia os documentos
              abaixo e registre sua manifestação de forma separada. Nenhuma
              opção vem marcada previamente.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <Link
              href="/termos-de-uso"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Ler Termos de Uso
            </Link>
            <Link
              href="/politica-de-privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Ler Política de Privacidade
            </Link>
          </div>

          {error ? (
            <div role="alert" className="alert-banner alert-error">
              {error}
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                cursor: "pointer",
                fontSize: "0.94rem",
                lineHeight: 1.45,
              }}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: "3px", width: "18px", height: "18px" }}
              />
              <span>
                <strong>Aceite contratual:</strong> Li e aceito os{" "}
                <Link
                  href="/termos-de-uso"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "underline" }}
                >
                  Termos de Uso
                </Link>{" "}
                (versão {status.terms.version}).
              </span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                cursor: "pointer",
                fontSize: "0.94rem",
                lineHeight: 1.45,
              }}
            >
              <input
                type="checkbox"
                checked={privacyAcknowledged}
                onChange={(e) => setPrivacyAcknowledged(e.target.checked)}
                style={{ marginTop: "3px", width: "18px", height: "18px" }}
              />
              <span>
                <strong>Ciência de privacidade:</strong> Estou ciente da{" "}
                <Link
                  href="/politica-de-privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "underline" }}
                >
                  Política de Privacidade
                </Link>{" "}
                (versão {status.privacy.version}) sobre o tratamento de dados
                pessoais.
              </span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                cursor: "pointer",
                fontSize: "0.9rem",
                lineHeight: 1.45,
                color: "var(--color-text-muted)",
                paddingTop: "6px",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              <input
                type="checkbox"
                checked={optionalProductUpdates}
                onChange={(e) => setOptionalProductUpdates(e.target.checked)}
                style={{ marginTop: "3px", width: "18px", height: "18px" }}
              />
              <span>
                <strong>Consentimento opcional:</strong> Autorizo receber
                comunicações opcionais sobre atualizações e novidades do LinkIA.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting || !termsAccepted || !privacyAcknowledged}
              className="btn btn-primary"
              style={{ alignSelf: "flex-start", marginTop: "6px" }}
            >
              {submitting ? "Registrando aceite..." : "Confirmar e acessar painel"}
            </button>
          </form>
        </div>
      </GlassSurface>
      <LegalFooter maxWidth="680px" />
    </div>
  );
}

