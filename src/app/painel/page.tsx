"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/panel/AppShell";
import { DashboardPanel } from "@/components/panel/DashboardPanel";
import {
  LegalConsentGate,
  type LegalStatusClientView,
} from "@/components/panel/LegalConsentGate";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { UserPermissions, UserRole } from "@/lib/types";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  permissions?: UserPermissions;
}

export default function PainelDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [legalStatus, setLegalStatus] = useState<LegalStatusClientView | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (
        params.has("calendar") ||
        params.has("social") ||
        params.has("whatsapp")
      ) {
        router.replace(`/painel/configuracoes${window.location.search}`);
        return;
      }
    }

    let cancelled = false;

    async function init() {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (meRes.status === 401) {
          if (!cancelled) router.replace("/login");
          return;
        }
        if (!meRes.ok) {
          if (!cancelled) {
            setLoadError("Não foi possível carregar sua sessão.");
            setLoading(false);
          }
          return;
        }
        const meData = await meRes.json();
        const legalRes = await fetch("/api/legal/acceptance", {
          credentials: "include",
        });
        const nextLegal = legalRes.ok
          ? ((await legalRes.json()) as LegalStatusClientView)
          : null;

        if (!cancelled) {
          setUser(meData.user as AuthUser);
          setLegalStatus(nextLegal);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Erro de conexão ao carregar o painel.");
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const legalBlocked = Boolean(
    legalStatus && legalStatus.requiresAcceptance
  );

  return (
    <AppShell
      userName={user?.name ?? ""}
      userRole={user?.role}
      permissions={user?.permissions}
    >
      {loading ? (
        <GlassSurface intensity="subtle" className="editor-section">
          <div className="editor-section-inner">
            <p className="field-hint">Carregando dashboard...</p>
          </div>
        </GlassSurface>
      ) : loadError ? (
        <GlassSurface intensity="subtle" className="editor-section">
          <div className="editor-section-inner">
            <div className="alert-banner alert-error" role="alert">
              <p>{loadError}</p>
            </div>
          </div>
        </GlassSurface>
      ) : legalBlocked && legalStatus ? (
        <LegalConsentGate
          profileId={null}
          status={legalStatus}
          onAccepted={(updated) => setLegalStatus(updated)}
        />
      ) : (
        <DashboardPanel permissions={user?.permissions} />
      )}
    </AppShell>
  );
}
