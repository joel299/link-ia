"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { DashboardPeriod, DashboardSnapshot } from "@/lib/dashboard";
import type { UserPermissions } from "@/lib/types";
import { CampaignNamesList } from "./CampaignNamesList";
import { ConnectedAccountsCircles } from "./ConnectedAccountsCircles";
import { DitherDonutChart } from "./DitherDonutChart";

interface DashboardPanelProps {
  permissions?: UserPermissions;
}

const PERIOD_OPTIONS: Array<{ id: DashboardPeriod; label: string }> = [
  { id: "last_7d", label: "7 dias" },
  { id: "last_30d", label: "30 dias" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
];

export function DashboardPanel({ permissions }: DashboardPanelProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("last_30d");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/dashboard?period=${encodeURIComponent(period)}`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Não foi possível carregar o dashboard.");
          setSnapshot(null);
          return;
        }
        setError(null);
        setSnapshot(data.dashboard as DashboardSnapshot);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão ao carregar o dashboard.");
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [period, reloadNonce]);

  function handlePeriodChange(nextPeriod: DashboardPeriod) {
    if (nextPeriod === period) return;
    setLoading(true);
    setError(null);
    setPeriod(nextPeriod);
  }

  function handleRetry() {
    setLoading(true);
    setError(null);
    setReloadNonce((n) => n + 1);
  }

  return (
    <div className="dash-root">
      <div className="dash-topbar">
        <div>
          <h1 className="section-title dash-heading">Dashboard</h1>
          <p className="field-hint">
            Resumo das contas conectadas, cliques na página pública e métricas oficiais de anúncios.
          </p>
        </div>

        <div className="dash-topbar-controls">
          <div className="dash-period-tabs" role="group" aria-label="Período das métricas">
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handlePeriodChange(opt.id)}
                  className={`dash-period-btn${active ? " is-active" : ""}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <Link href="/painel/configuracoes" className="btn btn-secondary dash-small-btn">
            Configurações do perfil
          </Link>
        </div>
      </div>

      {error ? (
        <GlassSurface intensity="subtle" className="editor-section">
          <div className="editor-section-inner">
            <div className="alert-banner alert-error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: "10px" }}
                onClick={handleRetry}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </GlassSurface>
      ) : null}

      {/* 4 KPI cards */}
      <section className="dash-kpi-grid" aria-label="Indicadores principais">
        <GlassSurface intensity="subtle" className="dash-kpi-card">
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Contas conectadas</span>
          </div>
          <div className="dash-kpi-value-row">
            <strong className="dash-kpi-value tabular-nums">
              {loading ? "—" : (snapshot?.connectedAccounts.total ?? 0)}
            </strong>
            {!loading && snapshot ? (
              <ConnectedAccountsCircles
                items={snapshot.connectedAccounts.items}
                total={snapshot.connectedAccounts.total}
              />
            ) : null}
          </div>
          <p className="dash-kpi-hint">
            Somente integrações confirmadas como conectadas pelo servidor.
          </p>
        </GlassSurface>

        <GlassSurface intensity="subtle" className="dash-kpi-card">
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">
              Cliques para iniciar conversa (WhatsApp)
            </span>
            <span
              className="dash-info-badge"
              title="Mede cliques no botão do WhatsApp na página pública; não confirma envio de mensagem."
              aria-label="Mede cliques no botão do WhatsApp na página pública; não confirma envio de mensagem."
            >
              ?
            </span>
          </div>
          <div className="dash-kpi-value-row">
            {permissions && !permissions.whatsapp ? (
              <span className="dash-badge-muted">Não habilitado</span>
            ) : (
              <strong className="dash-kpi-value tabular-nums">
                {loading
                  ? "—"
                  : (snapshot?.interactions.whatsappClicks ?? 0).toLocaleString("pt-BR")}
              </strong>
            )}
          </div>
          <p className="dash-kpi-hint">
            Cliques no botão WhatsApp no período; não comprova mensagem enviada.
          </p>
        </GlassSurface>

        <GlassSurface intensity="subtle" className="dash-kpi-card">
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Impressões de anúncios</span>
            <span
              className="dash-info-badge"
              title="Exibe somente impressões oficiais retornadas pela integração de anúncios. Cliques no Instagram não são contados como visualizações de posts."
              aria-label="Exibe somente impressões oficiais retornadas pela integração de anúncios."
            >
              ?
            </span>
          </div>
          <div className="dash-kpi-value-row">
            {loading ? (
              <strong className="dash-kpi-value tabular-nums">—</strong>
            ) : snapshot?.impressionsCard.available ? (
              <strong className="dash-kpi-value tabular-nums">
                {snapshot.impressionsCard.total.toLocaleString("pt-BR")}
              </strong>
            ) : (
              <span className="dash-badge-muted">Indisponível</span>
            )}
          </div>
          <p className="dash-kpi-hint">
            {loading
              ? "Consultando fonte oficial..."
              : snapshot?.impressionsCard.available
                ? snapshot.impressionsCard.sourceLabel
                : snapshot?.impressionsCard.unavailableReason ||
                  "Sem impressões oficiais no período."}
          </p>
        </GlassSurface>

        <GlassSurface intensity="subtle" className="dash-kpi-card">
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Agendamentos iniciados</span>
            <span
              className="dash-info-badge"
              title="Mede cliques no link de agendamento da página pública; não comprova reserva concluída."
              aria-label="Mede cliques no link de agendamento da página pública; não comprova reserva concluída."
            >
              ?
            </span>
          </div>
          <div className="dash-kpi-value-row">
            <strong className="dash-kpi-value tabular-nums">
              {loading
                ? "—"
                : (snapshot?.interactions.bookingClicks ?? 0).toLocaleString("pt-BR")}
            </strong>
          </div>
          <p className="dash-kpi-hint">
            Cliques no link de agendamento; não comprova reserva concluída.
            {!loading &&
            permissions?.google_calendar &&
            snapshot &&
            snapshot.interactions.confirmedInternalBookings > 0
              ? ` (${snapshot.interactions.confirmedInternalBookings} confirmados na agenda)`
              : ""}
          </p>
        </GlassSurface>
      </section>

      {/* 3 separate Dither Donut Charts — one per metric/unit */}
      <section className="dash-charts-grid" aria-label="Gráficos de desempenho">
        <DitherDonutChart
          title="Cliques"
          subtitle="Cliques na página pública e em anúncios"
          loading={loading}
          metric={
            snapshot?.charts.clicks ?? {
              available: false,
              total: 0,
              unitLabel: "cliques",
              segments: [],
              unavailableReason: null,
            }
          }
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 9l11 4-4.5 1.5L14 19l-5-10Z" />
              <path d="M5 5l2 2M12 2v2M2 12h2" />
            </svg>
          }
        />

        <DitherDonutChart
          title="Impressões"
          subtitle="Impressões oficiais por campanha no período"
          loading={loading}
          metric={
            snapshot?.charts.impressions ?? {
              available: false,
              total: 0,
              unitLabel: "impressões",
              segments: [],
              unavailableReason: null,
            }
          }
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />

        <DitherDonutChart
          title="Alcance"
          subtitle="Alcance oficial por campanha no período"
          loading={loading}
          metric={
            snapshot?.charts.reach ?? {
              available: false,
              total: 0,
              unitLabel: "alcance",
              segments: [],
              unavailableReason: null,
            }
          }
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
      </section>

      {/* Scrollable Campaign Names List */}
      <CampaignNamesList
        names={snapshot?.campaigns.names ?? []}
        hasAdsPermission={
          snapshot?.campaigns.hasAdsPermission ??
          Boolean(permissions?.meta_ads || permissions?.tiktok_ads)
        }
        hasConnectedAdAccount={snapshot?.campaigns.hasConnectedAdAccount ?? false}
        loading={loading}
        error={snapshot?.campaigns.error ?? null}
        periodLabel={snapshot?.periodLabel ?? "Últimos 30 dias"}
      />
    </div>
  );
}
