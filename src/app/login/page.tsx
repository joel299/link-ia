"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type AuthMode = "login" | "register";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemoShortcut = searchParams.get("demo") === "1";

  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          router.replace("/painel");
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleDemoLogin() {
    setError(null);
    setDemoLoading(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Não foi possível entrar no modo demonstração.");
        setDemoLoading(false);
        return;
      }
      router.push("/painel");
      router.refresh();
    } catch {
      setError("Erro de conexão ao iniciar a demonstração.");
      setDemoLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const endpoint =
      mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      mode === "login" ? { email, password } : { name, email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error ||
            (mode === "login"
              ? "E-mail ou senha inválidos."
              : "Não foi possível criar sua conta.")
        );
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
                {mode === "login" ? "Entrar no LinkIA" : "Criar conta no LinkIA"}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.925rem",
                  color: "var(--color-text-muted)",
                }}
              >
                {isDemoShortcut
                  ? "Use o acesso rápido de demonstração ou entre com sua conta."
                  : "Configure sua página de bio, pré-visualize e publique em minutos."}
              </p>
            </div>

            {/* Demo quick access */}
            <div
              style={{
                padding: "14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-accent)",
                background: "var(--color-warning-bg)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                Quer testar sem cadastro?
              </div>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={demoLoading || submitting || checkingSession}
                className="btn btn-accent"
                style={{ width: "100%" }}
              >
                {demoLoading
                  ? "Abrindo demonstração..."
                  : "Entrar no modo demonstração"}
              </button>
            </div>

            {/* Mode tabs */}
            <div
              role="tablist"
              aria-label="Modo de acesso"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                padding: "4px",
                borderRadius: "var(--radius-md)",
                background: "var(--color-surface-subtle)",
                border: "1px solid var(--color-border)",
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="btn"
                style={{
                  minHeight: "40px",
                  background:
                    mode === "login" ? "var(--color-surface)" : "transparent",
                  borderColor:
                    mode === "login" ? "var(--color-border-strong)" : "transparent",
                }}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className="btn"
                style={{
                  minHeight: "40px",
                  background:
                    mode === "register" ? "var(--color-surface)" : "transparent",
                  borderColor:
                    mode === "register"
                      ? "var(--color-border-strong)"
                      : "transparent",
                }}
              >
                Criar conta
              </button>
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
              {mode === "register" ? (
                <div className="field-group">
                  <label htmlFor="auth-name" className="field-label">
                    Seu nome
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Joel Quintana"
                    className="input"
                  />
                </div>
              ) : null}

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
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="input"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || demoLoading || checkingSession}
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "4px" }}
              >
                {submitting
                  ? mode === "login"
                    ? "Entrando..."
                    : "Criando conta..."
                  : mode === "login"
                    ? "Entrar"
                    : "Criar conta e ir ao painel"}
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
    </div>
  );
}

export default function LoginPage() {
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
          Carregando acesso...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
