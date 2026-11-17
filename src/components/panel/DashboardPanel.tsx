"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { DashboardPeriod, DashboardSnapshot } from "@/lib/dashboard";
import type { UserPermissions } from "@/lib/types";
import { CampaignNamesList } from "./CampaignNamesList";
import { ConnectedAccountsCircles } from "./ConnectedAccountsCircles";
import { DitherDonutChart } from "./DitherDonutChart";

interface DashboardPanelProps {
  permissions?: UserPermissions;
}

interface ActiveRange {
  period: DashboardPeriod;
  since?: string;
  until?: string;
}

const PERIOD_OPTIONS: Array<{ id: DashboardPeriod; label: string }> = [
  { id: "last_7d", label: "7 dias" },
  { id: "last_30d", label: "30 dias" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "custom", label: "Personalizado" },
];

function getPresetLabel(range: ActiveRange): string {
  switch (range.period) {
    case "last_7d":
      return "Últimos 7 dias";
    case "this_month":
      return "Este mês";
    case "last_month":
      return "Mês passado";
    case "custom":
      if (range.since && range.until) {
        const format = (v: string) => {
          const [y, m, d] = v.split("-");
          return `${d}/${m}/${y}`;
        };
        return `${format(range.since)} – ${format(range.until)}`;
      }
      return "Período personalizado";
    default:
      return "Últimos 30 dias";
  }
}

export function DashboardPanel({ permissions }: DashboardPanelProps) {
  const [selectedControlPeriod, setSelectedControlPeriod] =
    useState<DashboardPeriod>("last_30d");
  const [activeRange, setActiveRange] = useState<ActiveRange>({
    period: "last_30d",
  });
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const params = new URLSearchParams();
        params.set("period", activeRange.period);
        if (
          activeRange.period === "custom" &&
          activeRange.since &&
          activeRange.until
        ) {
          params.set("since", activeRange.since);
          params.set("until", activeRange.until);
        }

        const res = await fetch(`/api/dashboard?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setError(data.error || "Não foi possível carregar o dashboard.");
          setSnapshot(null);
          return;
        }
        setError(null);
        setSnapshot(data.dashboard as DashboardSnapshot);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Erro de conexão ao carregar o dashboard.");
        setSnapshot(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      controller.abort();
    };
  }, [activeRange, reloadNonce]);

  function handleSelectPeriod(nextPeriod: DashboardPeriod) {
    setRangeError(null);
    setSelectedControlPeriod(nextPeriod);
    if (nextPeriod === "custom") {
      return;
    }
    if (
      activeRange.period === nextPeriod &&
      snapshot &&
      !error
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    setSnapshot(null);
    setActiveRange({ period: nextPeriod });
  }

  function handleApplyCustomRange(e: FormEvent) {
    e.preventDefault();
    if (!customSince || !customUntil) {
      setRangeError("Informe a data inicial e a data final para aplicar o período.");
      return;
    }
    if (customSince > customUntil) {
      setRangeError("A data inicial não pode ser posterior à data final.");
      return;
    }
    setRangeError(null);
    setLoading(true);
    setError(null);
    setSnapshot(null);
    setActiveRange({
      period: "custom",
      since: customSince,
      until: customUntil,
    });
  }

  function handleRetry() {
    setLoading(true);
    setError(null);
    setSnapshot(null);
    setReloadNonce((n) => n + 1);
  }

  const displayedPeriodLabel = snapshot?.periodLabel ?? getPresetLabel(activeRange);
  const hasPendingCustomDraft =
    selectedControlPeriod === "custom" &&
    (activeRange.period !== "custom" ||
      activeRange.since !== customSince ||
      activeRange.until !== customUntil);

  return (
    <div className="dash-root">
      <div className="dash-topbar">
        <div>
          <h1 className="section-title dash-heading">Dashboard</h1>
          <p className="field-hint">
            Resumo das contas conectadas, cliques na página pública e métricas oficiais de anúncios{" "}
            <span className="dash-period-indicator">({displayedPeriodLabel})</span>.
          </p>
        </div>

        <div className="dash-topbar-controls">
          <div className="dash-period-tabs" role="group" aria-label="Período das métricas">
            {PERIOD_OPTIONS.map((opt) => {
              const active = selectedControlPeriod === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSelectPeriod(opt.id)}
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

      {selectedControlPeriod === "custom" ? (
        <form
          onSubmit={handleApplyCustomRange}
          className="dash-custom-range"
          aria-label="Selecionar intervalo personalizado"
        >
          <div className="dash-custom-fields">
            <label className="dash-date-field">
              <span className="field-label">Data inicial</span>
              <input
                type="date"
                className="input dash-date-input"
                value={customSince}
                onChange={(e) => {
                  setCustomSince(e.target.value);
                  setRangeError(null);
                }}
              />
            </label>
            <label className="dash-date-field">
              <span className="field-label">Data final</span>
              <input
                type="date"
                className="input dash-date-input"
                value={customUntil}
                onChange={(e) => {
                  setCustomUntil(e.target.value);
                  setRangeError(null);
                }}
              />
            </label>
            <button type="submit" className="btn btn-primary dash-small-btn">
              Aplicar período
            </button>
          </div>
          {rangeError ? (
            <p className="field-error" role="alert" style={{ margin: 0 }}>
              {rangeError}
            </p>
          ) : hasPendingCustomDraft ? (
            <p className="field-hint" style={{ margin: 0 }}>
              Exibindo dados de: <strong>{displayedPeriodLabel}</strong>. Clique em &ldquo;Aplicar período&rdquo; para atualizar para o intervalo escolhido.
            </p>
          ) : null}
        </form>
      ) : null}

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
        <GlassSurface intensity="subtle" className="dash-kpi-card" aria-busy={loading}>
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Contas conectadas</span>
          </div>
          <div className="dash-kpi-value-row">
            {loading ? (
              <>
                <span className="skeleton-bar" style={{ width: 44, height: 30 }} aria-hidden="true" />
                <div className="dash-skeleton-circles" aria-hidden="true">
                  <span className="skeleton-avatar dash-skeleton-circle" />
                  <span className="skeleton-avatar dash-skeleton-circle" />
                </div>
                <span className="sr-only">Carregando contas conectadas...</span>
              </>
            ) : (
              <>
                <strong className="dash-kpi-value tabular-nums">
                  {snapshot?.connectedAccounts.total ?? 0}
                </strong>
                {snapshot ? (
                  <ConnectedAccountsCircles
                    items={snapshot.connectedAccounts.items}
                    total={snapshot.connectedAccounts.total}
                  />
                ) : null}
              </>
            )}
          </div>
          <p className="dash-kpi-hint">
            Somente integrações confirmadas como conectadas pelo servidor.
          </p>
        </GlassSurface>

        <GlassSurface intensity="subtle" className="dash-kpi-card" aria-busy={loading}>
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
            {loading ? (
              <>
                <span className="skeleton-bar" style={{ width: 64, height: 30 }} aria-hidden="true" />
                <span className="sr-only">Carregando cliques no WhatsApp...</span>
              </>
            ) : permissions && !permissions.whatsapp ? (
              <span className="dash-badge-muted">Não habilitado</span>
            ) : (
              <strong className="dash-kpi-value tabular-nums">
                {(snapshot?.interactions.whatsappClicks ?? 0).toLocaleString("pt-BR")}
              </strong>
            )}
          </div>
          <p className="dash-kpi-hint">
            Cliques no botão WhatsApp no período; não comprova mensagem enviada.
          </p>
        </GlassSurface>

        <GlassSurface intensity="subtle" className="dash-kpi-card" aria-busy={loading}>
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
              <>
                <span className="skeleton-bar" style={{ width: 88, height: 30 }} aria-hidden="true" />
                <span className="sr-only">Carregando impressões...</span>
              </>
            ) : snapshot?.impressionsCard.available ? (
              <strong className="dash-kpi-value tabular-nums">
                {snapshot.impressionsCard.total.toLocaleString("pt-BR")}
              </strong>
            ) : (
              <span className="dash-badge-muted">Indisponível</span>
            )}
          </div>
          {loading ? (
            <span className="skeleton-bar" style={{ width: "85%", height: 12 }} aria-hidden="true" />
          ) : (
            <p className="dash-kpi-hint">
              {snapshot?.impressionsCard.available
                ? snapshot.impressionsCard.sourceLabel
                : snapshot?.impressionsCard.unavailableReason ||
                  "Sem impressões oficiais no período."}
            </p>
          )}
        </GlassSurface>

        <GlassSurface intensity="subtle" className="dash-kpi-card" aria-busy={loading}>
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
            {loading ? (
              <>
                <span className="skeleton-bar" style={{ width: 64, height: 30 }} aria-hidden="true" />
                <span className="sr-only">Carregando agendamentos iniciados...</span>
              </>
            ) : (
              <strong className="dash-kpi-value tabular-nums">
                {(snapshot?.interactions.bookingClicks ?? 0).toLocaleString("pt-BR")}
              </strong>
            )}
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
        periodLabel={displayedPeriodLabel}
      />
    </div>
  );
}
