"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/panel/AppShell";
import { PaidTrafficPanel } from "@/components/panel/PaidTrafficPanel";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { Profile } from "@/lib/types";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface TrafficSnapshot {
  unauthorized?: boolean;
  error?: string;
  user?: AuthUser;
  profiles?: Profile[];
}

async function loadTrafficSnapshot(): Promise<TrafficSnapshot> {
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
    return { error: "Erro de conexão ao carregar a área de tráfego pago." };
  }
}

export default function PainelTrafegoPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  function applySnapshot(snapshot: TrafficSnapshot) {
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
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void loadTrafficSnapshot().then((snapshot) => {
      if (!cancelled) {
        applySnapshot(snapshot);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedId) ?? null;

  return (
    <AppShell userName={user?.name ?? ""}>
      <div className="traffic-page-header">
        <div>
          <h1 className="section-title" style={{ fontSize: "1.35rem" }}>
            Tráfego pago
          </h1>
          <p className="field-hint">
            Gerencie suas contas de anúncios, consulte campanhas e revise
            rascunhos antes de criar ou ativar.
          </p>
        </div>

        {profiles.length > 0 ? (
          <div className="profile-tabs" aria-label="Selecionar perfil">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="profile-pill-btn"
                aria-current={profile.id === selectedId ? "true" : undefined}
                onClick={() => setSelectedId(profile.id)}
              >
                <span>{profile.displayName || profile.slug}</span>
                <span
                  className={`badge ${
                    profile.status === "published"
                      ? "badge-published"
                      : "badge-draft"
                  }`}
                >
                  {profile.status === "published" ? "Publicado" : "Rascunho"}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? (
        <GlassSurface intensity="subtle" className="editor-section">
          <div className="editor-section-inner">
            <p className="field-hint">Carregando área de tráfego pago...</p>
          </div>
        </GlassSurface>
      ) : loadError ? (
        <GlassSurface intensity="subtle" className="editor-section">
          <div className="editor-section-inner">
            <div className="alert-banner alert-error">
              <p>{loadError}</p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: "10px" }}
                onClick={() => {
                  setLoading(true);
                  setLoadError(null);
                  void loadTrafficSnapshot().then(applySnapshot);
                }}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </GlassSurface>
      ) : !selectedProfile ? (
        <GlassSurface intensity="subtle" className="editor-section">
          <div className="editor-section-inner">
            <h2 className="section-title">Nenhum perfil encontrado</h2>
            <p className="field-hint">
              Crie primeiro um perfil em Configurações do perfil para conectar
              suas contas de anúncios.
            </p>
            <div>
              <Link href="/painel" className="btn btn-primary">
                Ir para Configurações do perfil
              </Link>
            </div>
          </div>
        </GlassSurface>
      ) : selectedProfile.status !== "published" ? (
        <GlassSurface intensity="standard">
          <div
            role="status"
            style={{
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <strong>{selectedProfile.displayName || selectedProfile.slug}</strong>
              <span className="badge badge-draft">Rascunho</span>
            </div>
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
              Publique este perfil para configurar o tráfego pago.
            </p>
            <Link
              href={`/painel?profileId=${encodeURIComponent(selectedProfile.id)}`}
              className="btn btn-primary"
            >
              Ir para o editor e publicar
            </Link>
          </div>
        </GlassSurface>
      ) : (
        <PaidTrafficPanel key={selectedProfile.id} profile={selectedProfile} />
      )}
    </AppShell>
  );
}
