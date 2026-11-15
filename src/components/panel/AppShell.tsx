"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import "./panel.css";

interface AppShellProps {
  userName: string;
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/painel", label: "Configurações do perfil", matchExact: true },
  { href: "/painel/trafego", label: "Tráfego pago", matchExact: false },
];

export function AppShell({ userName, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
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
          <div className="app-header-brand-nav">
            <BrandMark href="/painel" size="sm" />
            <nav className="app-nav" aria-label="Navegação do painel">
              {NAV_ITEMS.map((item) => {
                const isActive = item.matchExact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`app-nav-link${isActive ? " is-active" : ""}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
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
