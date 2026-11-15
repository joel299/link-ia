"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type {
  AdCampaignOperationView,
  AdCampaignView,
  AdsDatePreset,
  AdsProvider,
  Profile,
  SocialAssetView,
  SocialConnectionStatus,
} from "@/lib/types";

interface PaidTrafficPanelProps {
  profile: Profile;
}

interface AdsOverviewPayload {
  provider: AdsProvider;
  config: {
    configReady: boolean;
    configRequirements: string[];
    managedOAuthSupported: boolean;
  };
  connection: {
    status: SocialConnectionStatus;
    accountLabel: string | null;
    selectedAdAccountId: string | null;
    selectedAdAccountName: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
    updatedAt: string | null;
  };
  assets: SocialAssetView[];
  campaigns: AdCampaignView[];
  campaignsError: string | null;
  operations: AdCampaignOperationView[];
}

interface TabState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  data: AdsOverviewPayload | null;
}

const PROVIDER_TABS: { id: AdsProvider; label: string; subtitle: string }[] = [
  {
    id: "meta_ads",
    label: "Meta Ads",
    subtitle: "Contas de anúncios, campanhas e indicadores por período",
  },
  {
    id: "tiktok_ads",
    label: "TikTok Ads",
    subtitle: "Contas de anunciante (advertiser) e campanhas autorizadas",
  },
];

function formatCampaignStatus(status: string): string {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "Ativa";
    case "PAUSED":
      return "Pausada";
    case "ARCHIVED":
      return "Encerrada";
    case "IN_PROCESS":
      return "Em análise";
    case "WITH_ISSUES":
      return "Com pendências";
    default:
      return status || "Sem status";
  }
}

const STATUS_META: Record<
  SocialConnectionStatus,
  { label: string; badgeClass: string }
> = {
  disconnected: { label: "Desconectado", badgeClass: "badge-draft" },
  pending: { label: "Ação necessária", badgeClass: "badge-draft" },
  incomplete: { label: "Ação necessária", badgeClass: "badge-error" },
  connected: { label: "Conectado", badgeClass: "badge-published" },
  expired: { label: "Ação necessária", badgeClass: "badge-error" },
  failed: { label: "Ação necessária", badgeClass: "badge-error" },
  pending_config: {
    label: "Ação necessária",
    badgeClass: "badge-draft",
  },
};

function createEmptyTabState(): TabState {
  return { loaded: false, loading: false, error: null, data: null };
}

function readInitialTrafficReturn(): {
  tab: AdsProvider;
  syncOnMount: boolean;
  notice: { tone: "success" | "warning" | "error"; message: string } | null;
} {
  if (typeof window === "undefined") {
    return { tab: "meta_ads", syncOnMount: false, notice: null };
  }
  const params = new URLSearchParams(window.location.search);
  const social = params.get("social");
  const provider = params.get("provider");
  const reason = params.get("reason");

  if (!social) {
    return { tab: "meta_ads", syncOnMount: false, notice: null };
  }

  if (provider === "meta_ads" || provider === "tiktok_ads") {
    const label = provider === "meta_ads" ? "Facebook / Meta Ads" : "TikTok Ads";
    return {
      tab: provider,
      syncOnMount: true,
      notice: {
        tone:
          social === "connected"
            ? "success"
            : social === "pending"
              ? "warning"
              : "error",
        message:
          reason ||
          (social === "connected"
            ? `${label} conectado com sucesso.`
            : `Retorno do ${label} com estado "${social}".`),
      },
    };
  }

  return {
    tab: "meta_ads",
    syncOnMount: false,
    notice: {
      tone: "error",
      message: reason || `Não foi possível concluir a autorização (${social}).`,
    },
  };
}

async function fetchAdsOverviewSnapshot(
  targetProfileId: string,
  provider: AdsProvider,
  sync = false,
  dateRange?: { datePreset: AdsDatePreset; since?: string; until?: string }
): Promise<{
  error: string | null;
  data: AdsOverviewPayload | null;
}> {
  try {
    const params = new URLSearchParams();
    if (sync) params.set("sync", "1");
    if (dateRange) {
      params.set("datePreset", dateRange.datePreset);
      if (dateRange.datePreset === "custom") {
        if (dateRange.since) params.set("since", dateRange.since);
        if (dateRange.until) params.set("until", dateRange.until);
      }
    }
    const qs = params.toString();
    const query = qs ? `?${qs}` : "";
    const res = await fetch(
      `/api/profiles/${targetProfileId}/ads/${provider}${query}`,
      { credentials: "include" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        error: data.error || "Não foi possível carregar dados de anúncios.",
        data: null,
      };
    }
    return {
      error: null,
      data: data as AdsOverviewPayload,
    };
  } catch {
    return {
      error: "Erro de conexão ao consultar provedor de anúncios.",
      data: null,
    };
  }
}

export function PaidTrafficPanel({ profile }: PaidTrafficPanelProps) {
  const [initialReturn] = useState(readInitialTrafficReturn);
  const [activeTab, setActiveTab] = useState<AdsProvider>(
    () => initialReturn.tab
  );
  const [tabs, setTabs] = useState<Record<AdsProvider, TabState>>(() => ({
    meta_ads: {
      ...createEmptyTabState(),
      loading: initialReturn.tab === "meta_ads",
    },
    tiktok_ads: {
      ...createEmptyTabState(),
      loading: initialReturn.tab === "tiktok_ads",
    },
  }));

  const [notice, setNotice] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(() => initialReturn.notice);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // Ad account selection & period filter state
  const [selectedAccountInput, setSelectedAccountInput] = useState("");
  const [datePreset, setDatePreset] = useState<AdsDatePreset>("last_30d");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");

  const activeProfileRef = useRef(profile.id);
  useEffect(() => {
    activeProfileRef.current = profile.id;
  }, [profile.id]);

  const dateRangeRef = useRef<{
    datePreset: AdsDatePreset;
    since?: string;
    until?: string;
  }>({ datePreset: "last_30d" });
  useEffect(() => {
    dateRangeRef.current = {
      datePreset,
      since: customSince || undefined,
      until: customUntil || undefined,
    };
  }, [datePreset, customSince, customUntil]);

  const loadProvider = useCallback(
    async (
      targetProfileId: string,
      provider: AdsProvider,
      sync = false,
      overrideRange?: { datePreset: AdsDatePreset; since?: string; until?: string }
    ) => {
      setTabs((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], loading: true, error: null },
      }));
      const snap = await fetchAdsOverviewSnapshot(
        targetProfileId,
        provider,
        sync,
        overrideRange ?? dateRangeRef.current
      );
      if (activeProfileRef.current !== targetProfileId) return;

      setTabs((prev) => ({
        ...prev,
        [provider]: {
          loaded: true,
          loading: false,
          error: snap.error,
          data: snap.data,
        },
      }));

      if (snap.data) {
        setSelectedAccountInput(
          snap.data.connection.selectedAdAccountId ||
            snap.data.assets.find((a) => a.isSelected)?.externalId ||
            snap.data.assets[0]?.externalId ||
            ""
        );
      }
    },
    []
  );

  // Clean OAuth return query params if present and load ONLY the initial active tab
  useEffect(() => {
    if (typeof window !== "undefined" && initialReturn.notice) {
      const url = new URL(window.location.href);
      url.searchParams.delete("social");
      url.searchParams.delete("provider");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }

    let cancelled = false;
    const targetTab = initialReturn.tab;
    void fetchAdsOverviewSnapshot(
      profile.id,
      targetTab,
      initialReturn.syncOnMount
    ).then((snap) => {
      if (cancelled) return;
      setTabs((prev) => ({
        ...prev,
        [targetTab]: {
          loaded: true,
          loading: false,
          error: snap.error,
          data: snap.data,
        },
      }));
      if (snap.data) {
        setSelectedAccountInput(
          snap.data.connection.selectedAdAccountId ||
            snap.data.assets.find((a) => a.isSelected)?.externalId ||
            snap.data.assets[0]?.externalId ||
            ""
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [profile.id, initialReturn]);

  function handleTabChange(nextTab: AdsProvider) {
    setActiveTab(nextTab);
    setConfirmDisconnect(false);
    setNotice(null);
    const current = tabs[nextTab];
    if (!current.loaded && !current.loading) {
      void loadProvider(profile.id, nextTab, false);
    } else if (current.data) {
      setSelectedAccountInput(
        current.data.connection.selectedAdAccountId ||
          current.data.assets.find((a) => a.isSelected)?.externalId ||
          current.data.assets[0]?.externalId ||
          ""
      );
    }
  }

  async function handleConnect(provider: AdsProvider) {
    setBusyAction("connect");
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profile.id}/integrations/social/${provider}/connect`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: res.status === 503 ? "warning" : "error",
          message:
            data.error || "Não foi possível iniciar a conexão de anúncios.",
        });
        await loadProvider(profile.id, provider, false);
        return;
      }

      if (typeof data.redirectUrl === "string" && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      setNotice({
        tone: "error",
        message: "URL de autorização não recebida do servidor.",
      });
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao iniciar autorização.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSetupMetaAds() {
    setBusyAction("setup_meta_ads");
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profile.id}/ads/meta_ads/setup`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: res.status === 422 ? "warning" : "error",
          message:
            data.error ||
            "Não foi possível validar/criar a auth config Meta Ads.",
        });
        await loadProvider(profile.id, "meta_ads", false);
        return;
      }

      setNotice({
        tone: "success",
        message: "Configuração de anúncios validada com sucesso.",
      });
      await loadProvider(profile.id, "meta_ads", false);
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao validar/criar a auth config Meta Ads.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect(provider: AdsProvider) {
    setBusyAction("disconnect");
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profile.id}/integrations/social/${provider}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: "error",
          message: data.error || "Não foi possível desconectar a conta.",
        });
      } else {
        setConfirmDisconnect(false);
        setNotice({
          tone: "success",
          message: "Integração de anúncios desconectada deste perfil.",
        });
        await loadProvider(profile.id, provider, false);
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao desconectar.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSelectAccount(e: FormEvent) {
    e.preventDefault();
    if (!selectedAccountInput) return;
    setBusyAction("select-account");
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profile.id}/ads/${activeTab}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ adAccountId: selectedAccountInput }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: "error",
          message: data.error || "Não foi possível selecionar a conta.",
        });
      } else {
        setNotice({
          tone: "success",
          message: "Conta de anúncios selecionada.",
        });
        await loadProvider(profile.id, activeTab, true);
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao selecionar conta.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  const currentTab = tabs[activeTab];
  const overview = currentTab.data;
  const isConnected = overview?.connection.status === "connected";
  const hasSelectedAccount = Boolean(overview?.connection.selectedAdAccountId);

  return (
    <div className="traffic-workspace">
      <div className="traffic-tabs" role="tablist" aria-label="Provedores de tráfego pago">
        {PROVIDER_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`traffic-tab-btn${selected ? " is-active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="traffic-tab-title">{tab.label}</span>
              <span className="traffic-tab-subtitle">{tab.subtitle}</span>
            </button>
          );
        })}
      </div>

      {notice ? (
        <div
          role="status"
          className={`alert-banner ${
            notice.tone === "success"
              ? "alert-success"
              : notice.tone === "warning"
                ? "alert-warning"
                : "alert-error"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      {currentTab.loading ? (
        <GlassSurface intensity="subtle" className="editor-section">
          <div className="editor-section-inner">
            <p className="field-hint">Carregando dados de tráfego pago...</p>
          </div>
        </GlassSurface>
      ) : currentTab.error ? (
        <GlassSurface intensity="subtle" className="editor-section">
          <div className="editor-section-inner">
            <div className="alert-banner alert-error">
              <p>{currentTab.error}</p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: "10px" }}
                onClick={() => void loadProvider(profile.id, activeTab, false)}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </GlassSurface>
      ) : overview ? (
        <>
          {/* 1. Connection & Ad Account Selection */}
          <GlassSurface intensity="subtle" className="editor-section">
            <div className="editor-section-inner">
              <div className="traffic-header-row">
                <div>
                  <h2 className="section-title">
                    {activeTab === "meta_ads"
                      ? "Conexão Meta Ads"
                      : "Conexão TikTok Ads"}
                  </h2>
                  <p className="field-hint">
                    {activeTab === "meta_ads"
                      ? "Conexão exclusiva para anúncios no Meta Ads, separada do perfil orgânico e da conexão social do Facebook."
                      : "Conexão exclusiva para anúncios, separada do perfil orgânico."}
                  </p>
                </div>
                <span
                  className={`badge ${STATUS_META[overview.connection.status].badgeClass}`}
                >
                  {STATUS_META[overview.connection.status].label}
                </span>
              </div>

              {!overview.config.configReady ||
              overview.connection.status === "pending_config" ? (
                <div className="alert-banner alert-warning">
                  <strong>Configuração pendente no servidor.</strong>
                  <p className="field-hint" style={{ marginTop: "4px" }}>
                    Entre em contato com o administrador para concluir a
                    configuração deste canal de anúncios.
                  </p>
                  {activeTab === "meta_ads" && !overview.config.configReady ? (
                    <div style={{ marginTop: "0.75rem" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyAction === "setup_meta_ads"}
                        onClick={() => void handleSetupMetaAds()}
                      >
                        {busyAction === "setup_meta_ads"
                          ? "Verificando configuração..."
                          : "Verificar configuração"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {overview.connection.lastError ? (
                <div className="alert-banner alert-error">
                  {overview.connection.lastError}
                </div>
              ) : null}

              <div className="channel-kv-grid">
                <div>
                  <span className="channel-kv-label">Conta conectada</span>
                  <span className="channel-kv-value">
                    {overview.connection.accountLabel || "Não conectada"}
                  </span>
                </div>
                <div>
                  <span className="channel-kv-label">
                    {activeTab === "meta_ads"
                      ? "Conta de anúncios ativa"
                      : "Advertiser ativo"}
                  </span>
                  <span className="channel-kv-value">
                    {overview.connection.selectedAdAccountName ||
                      overview.connection.selectedAdAccountId ||
                      "Nenhuma selecionada"}
                  </span>
                </div>
                <div>
                  <span className="channel-kv-label">Última atualização</span>
                  <span className="channel-kv-value">
                    {overview.connection.lastSyncedAt
                      ? new Date(
                          overview.connection.lastSyncedAt
                        ).toLocaleString("pt-BR")
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="channel-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    busyAction === "connect" || !overview.config.configReady
                  }
                  onClick={() => void handleConnect(activeTab)}
                >
                  {busyAction === "connect"
                    ? "Redirecionando..."
                    : isConnected
                      ? activeTab === "meta_ads"
                        ? "Reconectar Meta Ads"
                        : "Reconectar conta"
                      : activeTab === "meta_ads"
                        ? "Conectar Meta Ads"
                        : "Conectar conta"}
                </button>

                {isConnected ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyAction === "sync"}
                    onClick={() => {
                      setBusyAction("sync");
                      void loadProvider(profile.id, activeTab, true).finally(
                        () => setBusyAction(null)
                      );
                    }}
                  >
                    {busyAction === "sync" ? "Atualizando..." : "Atualizar dados"}
                  </button>
                ) : null}

                {overview.connection.status !== "disconnected" &&
                overview.connection.status !== "pending_config" ? (
                  confirmDisconnect ? (
                    <div className="channel-confirm-box">
                      <p className="field-hint">
                        Desconectar revoga o vínculo de anúncios neste perfil.
                      </p>
                      <div className="channel-actions">
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busyAction === "disconnect"}
                          onClick={() => void handleDisconnect(activeTab)}
                        >
                          Confirmar desconexão
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setConfirmDisconnect(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setConfirmDisconnect(true)}
                    >
                      Desconectar
                    </button>
                  )
                ) : null}
              </div>

              {isConnected ? (
                <form
                  onSubmit={handleSelectAccount}
                  className="traffic-account-form"
                >
                  <label htmlFor="adAccountSelect" className="field-label">
                    {activeTab === "meta_ads"
                      ? "Selecionar conta de anúncios"
                      : "Selecionar conta de anunciante"}
                  </label>
                  {overview.assets.length === 0 ? (
                    <p className="field-hint">
                      Não encontramos uma conta de anúncios disponível para este
                      acesso. Verifique as permissões da conta conectada ou
                      clique em &ldquo;Atualizar dados&rdquo;.
                    </p>
                  ) : (
                    <div className="traffic-account-row">
                      <select
                        id="adAccountSelect"
                        className="input"
                        value={selectedAccountInput}
                        onChange={(e) =>
                          setSelectedAccountInput(e.target.value)
                        }
                      >
                        {overview.assets.map((asset) => (
                          <option key={asset.id} value={asset.externalId}>
                            {asset.displayName} ({asset.externalId})
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="btn btn-secondary"
                        disabled={
                          busyAction === "select-account" ||
                          !selectedAccountInput
                        }
                      >
                        {busyAction === "select-account"
                          ? "Salvando..."
                          : "Usar esta conta"}
                      </button>
                    </div>
                  )}
                </form>
              ) : null}
            </div>
          </GlassSurface>

          {/* 2. Campaigns & Metrics */}
          <GlassSurface intensity="subtle" className="editor-section">
            <div className="editor-section-inner">
              <div className="traffic-header-row">
                <h2 className="section-title">Campanhas e métricas</h2>
                {isConnected && hasSelectedAccount ? (
                  <div
                    className="traffic-account-row"
                    style={{ gap: "8px", flexWrap: "wrap" }}
                  >
                    <select
                      aria-label="Período das métricas"
                      className="input"
                      style={{ width: "auto", minWidth: "160px" }}
                      value={datePreset}
                      onChange={(e) => {
                        const next = e.target.value as AdsDatePreset;
                        setDatePreset(next);
                        if (next !== "custom") {
                          void loadProvider(profile.id, activeTab, true, {
                            datePreset: next,
                          });
                        }
                      }}
                    >
                      <option value="last_7d">Últimos 7 dias</option>
                      <option value="last_30d">Últimos 30 dias</option>
                      <option value="this_month">Este mês</option>
                      <option value="last_month">Mês passado</option>
                      <option value="custom">Personalizado</option>
                    </select>
                    {datePreset === "custom" ? (
                      <>
                        <input
                          type="date"
                          aria-label="Data inicial"
                          className="input"
                          style={{ width: "auto" }}
                          value={customSince}
                          onChange={(e) => setCustomSince(e.target.value)}
                        />
                        <input
                          type="date"
                          aria-label="Data final"
                          className="input"
                          style={{ width: "auto" }}
                          value={customUntil}
                          onChange={(e) => setCustomUntil(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={
                            busyAction === "sync" || !customSince || !customUntil
                          }
                          onClick={() => {
                            setBusyAction("sync");
                            void loadProvider(profile.id, activeTab, true, {
                              datePreset: "custom",
                              since: customSince,
                              until: customUntil,
                            }).finally(() => setBusyAction(null));
                          }}
                        >
                          Aplicar período
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {overview.campaignsError ? (
                <div className="alert-banner alert-warning">
                  {overview.campaignsError}
                </div>
              ) : null}

              {!isConnected || !hasSelectedAccount ? (
                <p className="field-hint">
                  Conecte uma conta e selecione um identificador de anúncios
                  acima para listar campanhas e indicadores.
                </p>
              ) : overview.campaigns.length === 0 ? (
                <p className="field-hint">
                  Nenhuma campanha com dados no período selecionado.
                </p>
              ) : (
                <div className="campaigns-list">
                  {overview.campaigns.map((camp) => (
                    <div key={camp.id} className="campaign-card">
                      <div className="campaign-card-top">
                        <div>
                          <strong className="campaign-name">{camp.name}</strong>
                          <span className="field-hint">
                            ID: {camp.id} · Objetivo: {camp.objective}
                          </span>
                        </div>
                        <span className="badge badge-draft">
                          {formatCampaignStatus(camp.status)}
                        </span>
                      </div>
                      <div className="campaign-metrics-row">
                        <span>
                          Orçamento diário: {camp.dailyBudget || "—"}
                        </span>
                        <span>Gasto: {camp.spend || "Sem dados no período"}</span>
                        <span>Impressões: {camp.impressions || "—"}</span>
                        <span>Cliques: {camp.clicks || "—"}</span>
                        {camp.reach ? <span>Alcance: {camp.reach}</span> : null}
                        {camp.ctr ? <span>CTR: {camp.ctr}%</span> : null}
                        {camp.cpc ? <span>CPC: {camp.cpc}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassSurface>
        </>
      ) : null}
    </div>
  );
}
