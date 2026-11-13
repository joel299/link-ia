"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/panel/AppShell";
import { ProfileEditor } from "@/components/panel/ProfileEditor";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { Profile, ValidationErrors } from "@/lib/types";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface PanelSnapshot {
  unauthorized?: boolean;
  error?: string;
  user?: AuthUser;
  profiles?: Profile[];
}

async function loadPanelSnapshot(): Promise<PanelSnapshot> {
  try {
    const meRes = await fetch("/api/auth/me", { credentials: "include" });
    if (meRes.status === 401) {
      return { unauthorized: true };
    }
    if (!meRes.ok) {
      return { error: "Não foi possível carregar sua sessão." };
    }
    const meData = await meRes.json();

    const profRes = await fetch("/api/profiles", { credentials: "include" });
    if (!profRes.ok) {
      return {
        user: meData.user,
        error: "Não foi possível carregar seus perfis.",
      };
    }
    const profData = await profRes.json();
    const list: Profile[] = Array.isArray(profData.profiles)
      ? profData.profiles
      : [];
    return { user: meData.user, profiles: list };
  } catch {
    return { error: "Erro de conexão ao carregar o painel." };
  }
}

export default function PainelPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // New profile inline form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<ValidationErrors>({});
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);

  function applySnapshot(snapshot: PanelSnapshot) {
    if (snapshot.unauthorized) {
      router.replace("/login");
      return;
    }
    if (snapshot.user) {
      setUser(snapshot.user);
    }
    if (snapshot.error) {
      setLoadError(snapshot.error);
      setLoading(false);
      return;
    }
    const list = snapshot.profiles ?? [];
    setProfiles(list);
    if (list.length > 0) {
      const urlProfileId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("profileId")
          : null;
      setSelectedId((prev) => {
        if (urlProfileId && list.some((p) => p.id === urlProfileId)) {
          return urlProfileId;
        }
        return prev && list.some((p) => p.id === prev) ? prev : list[0].id;
      });
    } else {
      setSelectedId(null);
      setShowCreate(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void loadPanelSnapshot().then((snapshot) => {
      if (!cancelled) {
        applySnapshot(snapshot);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRetry() {
    setLoading(true);
    setLoadError(null);
    void loadPanelSnapshot().then(applySnapshot);
  }

  async function handleCreateProfile(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateFieldErrors({});
    setSlugSuggestion(null);
    setCreating(true);

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: newName.trim(),
          slug: newSlug.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.profile) {
        const errors: ValidationErrors =
          data.errors && typeof data.errors === "object" ? data.errors : {};
        setCreateFieldErrors(errors);
        setCreateError(
          data.error ||
            errors.slug ||
            errors.displayName ||
            "Não foi possível criar o perfil."
        );
        if (data.suggestion) {
          setSlugSuggestion(data.suggestion);
        }
        setCreating(false);
        return;
      }

      const created: Profile = data.profile;
      setProfiles((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setNewName("");
      setNewSlug("");
      setShowCreate(false);
    } catch {
      setCreateError("Erro de conexão ao criar o perfil.");
    } finally {
      setCreating(false);
    }
  }

  function handleProfileUpdated(updated: Profile) {
    setProfiles((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  const activeProfile =
    profiles.find((p) => p.id === selectedId) ?? profiles[0] ?? null;

  if (loading) {
    return (
      <AppShell userName="">
        <GlassSurface intensity="standard">
          <div style={{ padding: "32px", textAlign: "center" }}>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Carregando seu painel LinkIA...
            </p>
          </div>
        </GlassSurface>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell userName={user?.name || ""}>
        <GlassSurface intensity="standard">
          <div
            style={{
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              textAlign: "center",
            }}
          >
            <p className="field-error" style={{ fontSize: "1rem" }}>
              {loadError}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="btn btn-primary"
            >
              Tentar novamente
            </button>
          </div>
        </GlassSurface>
      </AppShell>
    );
  }

  return (
    <AppShell userName={user?.name || ""}>
      <section aria-label="Seus perfis" className="profile-bar">
        <div className="profile-tabs">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={activeProfile?.id === p.id ? "true" : undefined}
              onClick={() => {
                setSelectedId(p.id);
                setShowCreate(false);
              }}
              className="profile-pill-btn"
            >
              <span>{p.displayName || p.slug}</span>
              <span
                className={`badge ${
                  p.status === "published" ? "badge-published" : "badge-draft"
                }`}
              >
                {p.status === "published" ? "Publicado" : "Rascunho"}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreate((prev) => !prev);
            setCreateError(null);
            setCreateFieldErrors({});
            setSlugSuggestion(null);
          }}
          className="btn btn-secondary"
        >
          {showCreate ? "Cancelar" : "+ Novo perfil"}
        </button>
      </section>

      {showCreate ? (
        <GlassSurface as="section" intensity="dense">
          <form
            onSubmit={handleCreateProfile}
            style={{
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
              Criar novo perfil
            </h2>

            {createError ? (
              <div role="alert" className="alert-banner alert-error">
                <span>{createError}</span>
                {slugSuggestion ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNewSlug(slugSuggestion);
                      setCreateError(null);
                      setCreateFieldErrors({});
                      setSlugSuggestion(null);
                    }}
                    style={{
                      marginLeft: "10px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-primary)",
                      background: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Usar {slugSuggestion}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
              }}
            >
              <div className="field-group">
                <label htmlFor="new-profile-name" className="field-label">
                  Nome público
                </label>
                <input
                  id="new-profile-name"
                  type="text"
                  required
                  maxLength={80}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex.: Clínica Vida"
                  aria-invalid={Boolean(createFieldErrors.displayName)}
                  aria-describedby={
                    createFieldErrors.displayName
                      ? "new-profile-name-error"
                      : undefined
                  }
                  className="input"
                />
                {createFieldErrors.displayName ? (
                  <p id="new-profile-name-error" className="field-error">
                    {createFieldErrors.displayName}
                  </p>
                ) : null}
              </div>

              <div className="field-group">
                <label htmlFor="new-profile-slug" className="field-label">
                  Slug (URL curta)
                </label>
                <input
                  id="new-profile-slug"
                  type="text"
                  required
                  maxLength={40}
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="clinica-vida"
                  aria-invalid={Boolean(createFieldErrors.slug)}
                  aria-describedby={
                    createFieldErrors.slug
                      ? "new-profile-slug-error"
                      : undefined
                  }
                  className="input"
                />
                {createFieldErrors.slug ? (
                  <p id="new-profile-slug-error" className="field-error">
                    {createFieldErrors.slug}
                  </p>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={creating}
                className="btn btn-primary"
              >
                {creating ? "Criando..." : "Criar rascunho"}
              </button>
            </div>
          </form>
        </GlassSurface>
      ) : null}

      {activeProfile ? (
        <ProfileEditor
          key={activeProfile.id}
          profile={activeProfile}
          onProfileUpdated={handleProfileUpdated}
        />
      ) : !showCreate ? (
        <GlassSurface intensity="standard">
          <div
            style={{
              padding: "36px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <h2 style={{ margin: 0 }}>Você ainda não tem um perfil</h2>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Crie seu primeiro perfil para configurar links e publicar sua URL.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="btn btn-primary"
            >
              Criar primeiro perfil
            </button>
          </div>
        </GlassSurface>
      ) : null}
    </AppShell>
  );
}
