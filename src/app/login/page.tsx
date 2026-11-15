"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { LegalFooter } from "@/components/ui/LegalFooter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          router.replace("/painel");
        }
      })
      .catch(() => {
        // Ignora erro silenciosamente; usuário pode prosseguir com login.
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "E-mail ou senha inválidos.");
        setSubmitting(false);
        return;
      }
      router.push("/painel");
      router.refresh();
    } catch {
      setError("Erro de conexão com o servidor. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          width: "100%",
          maxWidth: "1040px",
          margin: "0 auto",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BrandMark href="/" />
        <ThemeToggle />
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <GlassSurface
          intensity="dense"
          style={{ width: "100%", maxWidth: "440px" }}
        >
          <div
            style={{
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div>
              <h1 style={{ margin: "0 0 6px", fontSize: "1.5rem", fontWeight: 700 }}>
                Entrar no LinkIA
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.925rem",
                  color: "var(--color-text-muted)",
                }}
              >
                Acesso exclusivo para clientes e administradores autorizados
                pelo LinkIA.
              </p>
            </div>

            {error ? (
              <div
                role="alert"
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-danger-bg)",
                  border: "1px solid var(--color-danger-border)",
                  color: "var(--color-danger)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            ) : null}

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div className="field-group">
                <label htmlFor="auth-email" className="field-label">
                  E-mail
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="input"
                />
              </div>

              <div className="field-group">
                <label htmlFor="auth-password" className="field-label">
                  Senha
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="input"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "4px" }}
              >
                {submitting ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <div style={{ textAlign: "center", fontSize: "0.875rem" }}>
              <Link
                href="/"
                style={{
                  color: "var(--color-text-muted)",
                  textDecoration: "underline",
                }}
              >
                Voltar para a página inicial
              </Link>
            </div>
          </div>
        </GlassSurface>
      </main>
      <LegalFooter maxWidth="1040px" />
    </div>
  );
}
