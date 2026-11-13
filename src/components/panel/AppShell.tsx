"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import "./panel.css";

interface AppShellProps {
  userName: string;
  children: ReactNode;
}

export function AppShell({ userName, children }: AppShellProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="app-shell">
      <GlassSurface
        as="header"
        intensity="subtle"
        className="app-header"
        withPlate={false}
      >
        <div className="app-header-inner">
          <BrandMark href="/painel" size="sm" />
          <div className="app-header-actions">
            {userName ? (
              <span className="app-user-name">Olá, {userName}</span>
            ) : null}
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="btn btn-secondary"
              style={{ fontSize: "0.875rem" }}
            >
              {loggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </div>
      </GlassSurface>
      <main className="panel-main">{children}</main>
    </div>
  );
}
