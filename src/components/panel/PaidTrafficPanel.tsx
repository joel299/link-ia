"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type {
  AdCampaignOperationView,
  AdCampaignView,
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
    label: "Facebook / Meta Ads",
    subtitle: "Contas de anúncios, campanhas e criação pausada com revisão",
  },
  {
    id: "tiktok_ads",
    label: "TikTok Ads",
    subtitle: "Contas de anunciante (advertiser) e campanhas autorizadas",
  },
];

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

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
  sync = false
): Promise<{
  error: string | null;
  data: AdsOverviewPayload | null;
}> {
  try {
    const query = sync ? "?sync=1" : "";
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

  // Ad account selection state
  const [selectedAccountInput, setSelectedAccountInput] = useState("");

  // Campaign draft form state
  const [draftName, setDraftName] = useState("");
  const [draftObjective, setDraftObjective] = useState("TRAFFIC");
  const [draftBudgetAmount, setDraftBudgetAmount] = useState("50");
  const [draftBudgetCurrency, setDraftBudgetCurrency] = useState("BRL");
  const [draftBudgetType, setDraftBudgetType] = useState<"daily" | "lifetime">(
    "daily"
  );
  const [draftStartDate, setDraftStartDate] = useState(getTodayIso);
  const [draftEndDate, setDraftEndDate] = useState("");
  const [draftTargetSummary, setDraftTargetSummary] = useState("");
  const [draftHeadline, setDraftHeadline] = useState("");
  const [draftDestinationUrl, setDraftDestinationUrl] = useState(
    profile.slug ? `https://linkia.app/${profile.slug}` : ""
  );
  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey);
  const [draftFieldErrors, setDraftFieldErrors] = useState<
    Record<string, string>
  >({});

  // Explicit confirmation checkboxes per operation ID
  const [createCheckboxes, setCreateCheckboxes] = useState<
    Record<string, boolean>
  >({});
  const [activateCheckboxes, setActivateCheckboxes] = useState<
    Record<string, boolean>
  >({});

  const activeProfileRef = useRef(profile.id);
  useEffect(() => {
    activeProfileRef.current = profile.id;
  }, [profile.id]);

  const loadProvider = useCallback(
    async (targetProfileId: string, provider: AdsProvider, sync = false) => {
      setTabs((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], loading: true, error: null },
      }));
      const snap = await fetchAdsOverviewSnapshot(
        targetProfileId,
        provider,
        sync
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

  async function handleCreateDraft(e: FormEvent) {
    e.preventDefault();
    setBusyAction("create-draft");
    setNotice(null);
    setDraftFieldErrors({});

    const amount = Number(draftBudgetAmount);
    try {
      const res = await fetch(
        `/api/profiles/${profile.id}/ads/${activeTab}/campaigns`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: draftName.trim(),
            objective: draftObjective,
            budgetAmount: Number.isFinite(amount) ? amount : 0,
            budgetCurrency: draftBudgetCurrency,
            budgetType: draftBudgetType,
            startDate: draftStartDate,
            endDate: draftEndDate.trim() || undefined,
            targetSummary: draftTargetSummary.trim(),
            creativeHeadline: draftHeadline.trim(),
            destinationUrl: draftDestinationUrl.trim(),
            idempotencyKey,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.errors && typeof data.errors === "object") {
          setDraftFieldErrors(data.errors as Record<string, string>);
        }
        setNotice({
          tone: "error",
          message:
            data.error || "Não foi possível salvar o rascunho da campanha.",
        });
        return;
      }

      setNotice({
        tone: "success",
        message:
          "Rascunho salvo! Revise os valores abaixo e confirme explicitamente para criar a campanha PAUSADA.",
      });
      setDraftName("");
      setDraftTargetSummary("");
      setDraftHeadline("");
      setIdempotencyKey(generateIdempotencyKey());
      await loadProvider(profile.id, activeTab, false);
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao salvar rascunho.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConfirmOperation(
    operationId: string,
    action: "create_paused" | "activate"
  ) {
    setBusyAction(`${action}:${operationId}`);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profile.id}/ads/${activeTab}/campaigns/${operationId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action, confirmed: true }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: "error",
          message:
            data.error || "Não foi possível confirmar a operação da campanha.",
        });
        await loadProvider(profile.id, activeTab, false);
        return;
      }

      setNotice({
        tone: "success",
        message:
          action === "create_paused"
            ? "Campanha criada em estado PAUSADO na conta de anúncios."
            : "Campanha ativada com sucesso.",
      });
      await loadProvider(profile.id, activeTab, true);
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao confirmar operação.",
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
                      ? "Conexão Facebook / Meta Ads"
                      : "Conexão TikTok Ads"}
                  </h2>
                  <p className="field-hint">
                    Conexão exclusiva para anúncios, separada do perfil
                    orgânico.
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
                {activeTab === "meta_ads" ? (
                  <Link
                    href="/painel#canais-conectados"
                    className={
                      isConnected ? "btn btn-secondary" : "btn btn-primary"
                    }
                  >
                    {isConnected
                      ? "Gerenciar conexão em Canais conectados"
                      : "Conectar Facebook em Canais conectados"}
                  </Link>
                ) : (
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
                        ? "Reconectar conta"
                        : "Conectar conta"}
                  </button>
                )}

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

                {activeTab !== "meta_ads" &&
                overview.connection.status !== "disconnected" &&
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
              <h2 className="section-title">Campanhas e métricas</h2>
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
                  Nenhuma campanha encontrada para a conta selecionada.
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
                        <span className="badge badge-draft">{camp.status}</span>
                      </div>
                      <div className="campaign-metrics-row">
                        <span>
                          Orçamento diário: {camp.dailyBudget || "—"}
                        </span>
                        <span>Gasto: {camp.spend || "—"}</span>
                        <span>Impressões: {camp.impressions || "—"}</span>
                        <span>Cliques: {camp.clicks || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassSurface>

          {/* 3. Campaign Draft Form */}
          <GlassSurface intensity="subtle" className="editor-section">
            <div className="editor-section-inner">
              <div>
                <h2 className="section-title">Preparar rascunho de campanha</h2>
                <p className="field-hint">
                  Salvar o rascunho não cria anúncio nem gera cobrança. A
                  criação ocorre apenas após revisão final e confirmação
                  explícita, sempre em estado PAUSADO.
                </p>
              </div>

              {!isConnected || !hasSelectedAccount ? (
                <p className="field-hint">
                  Conecte sua conta e selecione uma conta de anúncios antes de
                  preparar um rascunho.
                </p>
              ) : (
                <form onSubmit={handleCreateDraft} className="traffic-draft-form">
                  <div className="calendar-settings-grid">
                    <div className="field-group">
                      <label htmlFor="campName" className="field-label">
                        Nome da campanha
                      </label>
                      <input
                        id="campName"
                        type="text"
                        className="input"
                        required
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder="Ex.: Agenda Novembro - LinkIA"
                      />
                      {draftFieldErrors.name ? (
                        <span className="field-error">
                          {draftFieldErrors.name}
                        </span>
                      ) : null}
                    </div>

                    <div className="field-group">
                      <label htmlFor="campObjective" className="field-label">
                        Objetivo
                      </label>
                      <select
                        id="campObjective"
                        className="input"
                        value={draftObjective}
                        onChange={(e) => setDraftObjective(e.target.value)}
                      >
                        <option value="TRAFFIC">Tráfego (visitas ao link)</option>
                        <option value="LEADS">Cadastros / Leads</option>
                        <option value="ENGAGEMENT">Engajamento</option>
                        <option value="AWARENESS">Reconhecimento</option>
                      </select>
                    </div>
                  </div>

                  <div className="calendar-settings-grid">
                    <div className="field-group">
                      <label htmlFor="campBudget" className="field-label">
                        Valor do orçamento
                      </label>
                      <input
                        id="campBudget"
                        type="number"
                        min="1"
                        step="0.01"
                        className="input"
                        required
                        value={draftBudgetAmount}
                        onChange={(e) => setDraftBudgetAmount(e.target.value)}
                      />
                      {draftFieldErrors.budgetAmount ? (
                        <span className="field-error">
                          {draftFieldErrors.budgetAmount}
                        </span>
                      ) : null}
                    </div>

                    <div className="field-group">
                      <label htmlFor="campCurrency" className="field-label">
                        Moeda
                      </label>
                      <select
                        id="campCurrency"
                        className="input"
                        value={draftBudgetCurrency}
                        onChange={(e) => setDraftBudgetCurrency(e.target.value)}
                      >
                        <option value="BRL">BRL (R$)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>

                    <div className="field-group">
                      <label htmlFor="campBudgetType" className="field-label">
                        Tipo de orçamento
                      </label>
                      <select
                        id="campBudgetType"
                        className="input"
                        value={draftBudgetType}
                        onChange={(e) =>
                          setDraftBudgetType(
                            e.target.value === "lifetime" ? "lifetime" : "daily"
                          )
                        }
                      >
                        <option value="daily">Diário</option>
                        <option value="lifetime">Total (vitalício)</option>
                      </select>
                    </div>
                  </div>

                  <div className="calendar-settings-grid">
                    <div className="field-group">
                      <label htmlFor="campStartDate" className="field-label">
                        Data de início
                      </label>
                      <input
                        id="campStartDate"
                        type="date"
                        className="input"
                        required
                        value={draftStartDate}
                        onChange={(e) => setDraftStartDate(e.target.value)}
                      />
                      {draftFieldErrors.startDate ? (
                        <span className="field-error">
                          {draftFieldErrors.startDate}
                        </span>
                      ) : null}
                    </div>

                    <div className="field-group">
                      <label htmlFor="campEndDate" className="field-label">
                        Data de término (opcional)
                      </label>
                      <input
                        id="campEndDate"
                        type="date"
                        className="input"
                        value={draftEndDate}
                        onChange={(e) => setDraftEndDate(e.target.value)}
                      />
                      {draftFieldErrors.endDate ? (
                        <span className="field-error">
                          {draftFieldErrors.endDate}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="field-group">
                    <label htmlFor="campTarget" className="field-label">
                      Público / segmentação
                    </label>
                    <input
                      id="campTarget"
                      type="text"
                      className="input"
                      required
                      value={draftTargetSummary}
                      onChange={(e) => setDraftTargetSummary(e.target.value)}
                      placeholder="Ex.: São Paulo, 25–45 anos, interesses em bem-estar"
                    />
                    {draftFieldErrors.targetSummary ? (
                      <span className="field-error">
                        {draftFieldErrors.targetSummary}
                      </span>
                    ) : null}
                  </div>

                  <div className="calendar-settings-grid">
                    <div className="field-group">
                      <label htmlFor="campHeadline" className="field-label">
                        Título do criativo
                      </label>
                      <input
                        id="campHeadline"
                        type="text"
                        className="input"
                        required
                        value={draftHeadline}
                        onChange={(e) => setDraftHeadline(e.target.value)}
                        placeholder="Ex.: Agende sua consulta online"
                      />
                      {draftFieldErrors.creativeHeadline ? (
                        <span className="field-error">
                          {draftFieldErrors.creativeHeadline}
                        </span>
                      ) : null}
                    </div>

                    <div className="field-group">
                      <label htmlFor="campUrl" className="field-label">
                        URL de destino (HTTPS)
                      </label>
                      <input
                        id="campUrl"
                        type="url"
                        className="input"
                        required
                        value={draftDestinationUrl}
                        onChange={(e) => setDraftDestinationUrl(e.target.value)}
                        placeholder="https://..."
                      />
                      {draftFieldErrors.destinationUrl ? (
                        <span className="field-error">
                          {draftFieldErrors.destinationUrl}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={busyAction === "create-draft"}
                    >
                      {busyAction === "create-draft"
                        ? "Salvando rascunho..."
                        : "Salvar rascunho para revisão"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </GlassSurface>

          {/* 4. Final Review & Explicit Confirmation */}
          <GlassSurface intensity="subtle" className="editor-section">
            <div className="editor-section-inner">
              <h2 className="section-title">
                Revisão final e confirmação explícita
              </h2>

              {overview.operations.length === 0 ? (
                <p className="field-hint">
                  Nenhum rascunho ou operação registrada ainda.
                </p>
              ) : (
                <div className="operations-list">
                  {overview.operations.map((op) => {
                    const createChecked = Boolean(createCheckboxes[op.id]);
                    const activateChecked = Boolean(activateCheckboxes[op.id]);
                    return (
                      <div key={op.id} className="operation-review-box">
                        <div className="campaign-card-top">
                          <div>
                            <strong className="campaign-name">
                              {op.params.name}
                            </strong>
                            <span className="field-hint">
                              Conta: {op.adAccountId} · Objetivo:{" "}
                              {op.params.objective}
                            </span>
                          </div>
                          <span
                            className={`badge ${
                              op.status === "active"
                                ? "badge-published"
                                : op.status === "failed"
                                  ? "badge-error"
                                  : "badge-draft"
                            }`}
                          >
                            {op.status === "draft"
                              ? "Rascunho (aguardando confirmação)"
                              : op.status === "created_paused"
                                ? "Criada PAUSADA"
                                : op.status === "active"
                                  ? "Ativa"
                                  : "Falhou"}
                          </span>
                        </div>

                        <div className="channel-kv-grid">
                          <div>
                            <span className="channel-kv-label">
                              Orçamento e moeda
                            </span>
                            <span className="channel-kv-value">
                              {op.params.budgetCurrency}{" "}
                              {op.params.budgetAmount.toFixed(2)} (
                              {op.params.budgetType === "daily"
                                ? "Diário"
                                : "Vitalício"}
                              )
                            </span>
                          </div>
                          <div>
                            <span className="channel-kv-label">Duração</span>
                            <span className="channel-kv-value">
                              {op.params.startDate}
                              {op.params.endDate
                                ? ` até ${op.params.endDate}`
                                : " (sem data de término)"}
                            </span>
                          </div>
                          <div>
                            <span className="channel-kv-label">Resumo</span>
                            <span className="channel-kv-value">
                              {op.estimatedBudgetSummary}
                            </span>
                          </div>
                          <div>
                            <span className="channel-kv-label">Destino</span>
                            <span className="channel-kv-value">
                              {op.params.destinationUrl}
                            </span>
                          </div>
                        </div>

                        <p className="field-hint">
                          Público: {op.params.targetSummary} · Título:{" "}
                          {op.params.creativeHeadline}
                        </p>

                        {op.externalCampaignId ? (
                          <p className="field-hint">
                            ID externo da campanha:{" "}
                            <code>{op.externalCampaignId}</code>
                          </p>
                        ) : null}

                        {op.lastError ? (
                          <div className="alert-banner alert-error">
                            {op.lastError}
                          </div>
                        ) : null}

                        {op.status === "draft" ? (
                          <div className="operation-confirm-block">
                            <label className="checkbox-inline">
                              <input
                                type="checkbox"
                                checked={createChecked}
                                onChange={(e) =>
                                  setCreateCheckboxes((prev) => ({
                                    ...prev,
                                    [op.id]: e.target.checked,
                                  }))
                                }
                              />
                              <span>
                                Confirmo os valores, moeda, duração e conta
                                acima para criar esta campanha em estado
                                PAUSADO.
                              </span>
                            </label>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={
                                !createChecked ||
                                busyAction === `create_paused:${op.id}`
                              }
                              onClick={() =>
                                void handleConfirmOperation(
                                  op.id,
                                  "create_paused"
                                )
                              }
                            >
                              {busyAction === `create_paused:${op.id}`
                                ? "Criando campanha..."
                                : "Criar campanha PAUSADA"}
                            </button>
                          </div>
                        ) : null}

                        {op.status === "created_paused" ? (
                          <div className="operation-confirm-block">
                            <label className="checkbox-inline">
                              <input
                                type="checkbox"
                                checked={activateChecked}
                                onChange={(e) =>
                                  setActivateCheckboxes((prev) => ({
                                    ...prev,
                                    [op.id]: e.target.checked,
                                  }))
                                }
                              />
                              <span>
                                Confirmo que desejo ATIVAR esta campanha e
                                autorizar a veiculação com o orçamento
                                configurado.
                              </span>
                            </label>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={
                                !activateChecked ||
                                busyAction === `activate:${op.id}`
                              }
                              onClick={() =>
                                void handleConfirmOperation(op.id, "activate")
                              }
                            >
                              {busyAction === `activate:${op.id}`
                                ? "Ativando..."
                                : "Ativar campanha"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </GlassSurface>
        </>
      ) : null}
    </div>
  );
}
