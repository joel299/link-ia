"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type {
  OrganicSocialProvider,
  SocialConnectionStatus,
  SocialConnectionView,
  SocialMediaItemView,
  WhatsAppConnectionStatus,
  WhatsAppConnectionView,
} from "@/lib/types";

interface ConnectedChannelsPanelProps {
  profileId: string;
}

type ChannelKey = "whatsapp" | "instagram" | "tiktok";

interface ChannelLoadState<T> {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  data: T | null;
}

interface SocialChannelData {
  connection: SocialConnectionView;
  media: SocialMediaItemView[];
}

interface NoticeBanner {
  tone: "success" | "warning" | "error";
  message: string;
}

const WHATSAPP_STATUS_META: Record<
  WhatsAppConnectionStatus,
  { label: string; badgeClass: string }
> = {
  disconnected: { label: "Desconectado", badgeClass: "badge-draft" },
  connecting: { label: "Conectando", badgeClass: "badge-draft" },
  incomplete: { label: "Onboarding incompleto", badgeClass: "badge-error" },
  connected: { label: "Conectado", badgeClass: "badge-published" },
  expired: { label: "Sessão expirada", badgeClass: "badge-error" },
  failed: { label: "Falha na conexão", badgeClass: "badge-error" },
  ineligible: { label: "Número inelegível", badgeClass: "badge-error" },
  pending_config: {
    label: "Aguardando configuração",
    badgeClass: "badge-draft",
  },
};

const SOCIAL_STATUS_META: Record<
  SocialConnectionStatus,
  { label: string; badgeClass: string }
> = {
  disconnected: { label: "Desconectado", badgeClass: "badge-draft" },
  pending: { label: "Aguardando autorização", badgeClass: "badge-draft" },
  incomplete: { label: "Conexão incompleta", badgeClass: "badge-error" },
  connected: { label: "Conectado", badgeClass: "badge-published" },
  expired: { label: "Expirado ou revogado", badgeClass: "badge-error" },
  failed: { label: "Falha na conexão", badgeClass: "badge-error" },
  pending_config: {
    label: "Aguardando configuração",
    badgeClass: "badge-draft",
  },
};

function createEmptyChannelState<T>(): ChannelLoadState<T> {
  return { loaded: false, loading: false, error: null, data: null };
}

function buildReturnNotice(params: URLSearchParams): {
  channel: ChannelKey | null;
  notice: NoticeBanner | null;
} {
  const waStatus = params.get("whatsapp");
  const socialStatus = params.get("social");
  const provider = params.get("provider");
  const reason = params.get("reason");

  if (waStatus) {
    if (waStatus === "connected") {
      return {
        channel: "whatsapp",
        notice: {
          tone: "success",
          message: "WhatsApp Business conectado e validado com sucesso.",
        },
      };
    }
    if (waStatus === "connecting") {
      return {
        channel: "whatsapp",
        notice: {
          tone: "warning",
          message:
            "Conexão com o WhatsApp Business em andamento. Aguarde a confirmação da Meta/Zernio.",
        },
      };
    }
    if (waStatus === "ineligible") {
      return {
        channel: "whatsapp",
        notice: {
          tone: "error",
          message:
            reason ||
            "Este número foi considerado inelegível pela Meta para coexistência.",
        },
      };
    }
    return {
      channel: "whatsapp",
      notice: {
        tone: "error",
        message:
          reason ||
          `Não foi possível concluir a conexão do WhatsApp Business (${waStatus}).`,
      },
    };
  }

  if (socialStatus && (provider === "instagram" || provider === "tiktok")) {
    const label = provider === "instagram" ? "Instagram" : "TikTok";
    if (socialStatus === "connected") {
      return {
        channel: provider,
        notice: {
          tone: "success",
          message: `${label} conectado com sucesso.`,
        },
      };
    }
    return {
      channel: provider,
      notice: {
        tone: socialStatus === "pending" ? "warning" : "error",
        message:
          reason ||
          `Retorno do ${label} com estado "${socialStatus}". Verifique as permissões e tente novamente.`,
      },
    };
  }

  if (socialStatus) {
    return {
      channel: null,
      notice: {
        tone: "error",
        message:
          reason ||
          `Não foi possível concluir a autorização social (${socialStatus}).`,
      },
    };
  }

  return { channel: null, notice: null };
}

function readInitialReturnState(): {
  channel: ChannelKey | null;
  notice: NoticeBanner | null;
} {
  if (typeof window === "undefined") {
    return { channel: null, notice: null };
  }
  return buildReturnNotice(new URLSearchParams(window.location.search));
}

async function fetchWhatsAppSnapshot(targetProfileId: string): Promise<{
  error: string | null;
  data: WhatsAppConnectionView | null;
}> {
  try {
    const res = await fetch(
      `/api/profiles/${targetProfileId}/integrations/whatsapp`,
      { credentials: "include" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.connection) {
      return {
        error: data.error || "Não foi possível consultar o status do WhatsApp.",
        data: null,
      };
    }
    return {
      error: null,
      data: data.connection as WhatsAppConnectionView,
    };
  } catch {
    return {
      error: "Erro de conexão ao consultar o WhatsApp Business.",
      data: null,
    };
  }
}

async function fetchSocialSnapshot(
  targetProfileId: string,
  provider: OrganicSocialProvider
): Promise<{
  error: string | null;
  data: SocialChannelData | null;
}> {
  try {
    const res = await fetch(
      `/api/profiles/${targetProfileId}/integrations/social/${provider}`,
      { credentials: "include" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.connection) {
      return {
        error:
          data.error ||
          `Não foi possível consultar o status do ${provider === "instagram" ? "Instagram" : "TikTok"}.`,
        data: null,
      };
    }
    return {
      error: null,
      data: {
        connection: data.connection as SocialConnectionView,
        media: Array.isArray(data.media)
          ? (data.media as SocialMediaItemView[])
          : [],
      },
    };
  } catch {
    return {
      error: "Erro de conexão ao consultar o canal social.",
      data: null,
    };
  }
}

export function ConnectedChannelsPanel({
  profileId,
}: ConnectedChannelsPanelProps) {
  const [initialReturn] = useState(readInitialReturnState);
  const [expanded, setExpanded] = useState<Record<ChannelKey, boolean>>(() => ({
    whatsapp: initialReturn.channel === "whatsapp",
    instagram: initialReturn.channel === "instagram",
    tiktok: initialReturn.channel === "tiktok",
  }));

  const [whatsappState, setWhatsappState] = useState<
    ChannelLoadState<WhatsAppConnectionView>
  >(() => ({
    ...createEmptyChannelState(),
    loading: initialReturn.channel === "whatsapp",
  }));
  const [instagramState, setInstagramState] = useState<
    ChannelLoadState<SocialChannelData>
  >(() => ({
    ...createEmptyChannelState(),
    loading: initialReturn.channel === "instagram",
  }));
  const [tiktokState, setTiktokState] = useState<
    ChannelLoadState<SocialChannelData>
  >(() => ({
    ...createEmptyChannelState(),
    loading: initialReturn.channel === "tiktok",
  }));

  const [notice, setNotice] = useState<NoticeBanner | null>(
    () => initialReturn.notice
  );
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<ChannelKey | null>(
    null
  );
  const [igSavingSelection, setIgSavingSelection] = useState(false);

  const activeProfileRef = useRef(profileId);
  useEffect(() => {
    activeProfileRef.current = profileId;
  }, [profileId]);

  const loadWhatsApp = useCallback(async (targetProfileId: string) => {
    setWhatsappState((prev) => ({ ...prev, loading: true, error: null }));
    const snap = await fetchWhatsAppSnapshot(targetProfileId);
    if (activeProfileRef.current !== targetProfileId) return;
    setWhatsappState({
      loaded: true,
      loading: false,
      error: snap.error,
      data: snap.data,
    });
  }, []);

  const loadSocialChannel = useCallback(
    async (targetProfileId: string, provider: OrganicSocialProvider) => {
      const setTarget =
        provider === "instagram" ? setInstagramState : setTiktokState;
      setTarget((prev) => ({ ...prev, loading: true, error: null }));
      const snap = await fetchSocialSnapshot(targetProfileId, provider);
      if (activeProfileRef.current !== targetProfileId) return;
      setTarget({
        loaded: true,
        loading: false,
        error: snap.error,
        data: snap.data,
      });
    },
    []
  );

  // Clean OAuth return query params and fetch ONLY the returned channel if present
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!initialReturn.channel && !initialReturn.notice) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("whatsapp");
    url.searchParams.delete("social");
    url.searchParams.delete("provider");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);

    let cancelled = false;
    if (initialReturn.channel === "whatsapp") {
      void fetchWhatsAppSnapshot(profileId).then((snap) => {
        if (cancelled) return;
        setWhatsappState({
          loaded: true,
          loading: false,
          error: snap.error,
          data: snap.data,
        });
      });
    } else if (initialReturn.channel) {
      const targetChannel = initialReturn.channel;
      const setTarget =
        targetChannel === "instagram" ? setInstagramState : setTiktokState;
      void fetchSocialSnapshot(profileId, targetChannel).then((snap) => {
        if (cancelled) return;
        setTarget({
          loaded: true,
          loading: false,
          error: snap.error,
          data: snap.data,
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [profileId, initialReturn]);

  function handleToggleChannel(channel: ChannelKey) {
    const nextOpen = !expanded[channel];
    setExpanded((prev) => ({ ...prev, [channel]: nextOpen }));
    setConfirmDisconnect(null);

    if (!nextOpen) return;

    if (channel === "whatsapp" && !whatsappState.loaded && !whatsappState.loading) {
      void loadWhatsApp(profileId);
    } else if (
      channel === "instagram" &&
      !instagramState.loaded &&
      !instagramState.loading
    ) {
      void loadSocialChannel(profileId, "instagram");
    } else if (
      channel === "tiktok" &&
      !tiktokState.loaded &&
      !tiktokState.loading
    ) {
      void loadSocialChannel(profileId, "tiktok");
    }
  }

  async function handleConnectWhatsApp() {
    setActionBusy("whatsapp:connect");
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/integrations/whatsapp/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ onboardingMode: "business_app" }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.connection) {
          setWhatsappState({
            loaded: true,
            loading: false,
            error: null,
            data: data.connection as WhatsAppConnectionView,
          });
        }
        setNotice({
          tone: res.status === 503 ? "warning" : "error",
          message:
            data.error ||
            "Não foi possível iniciar a conexão do WhatsApp Business.",
        });
        setActionBusy(null);
        return;
      }

      if (typeof data.redirectUrl === "string" && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      setNotice({
        tone: "error",
        message: "URL de redirecionamento não recebida do servidor.",
      });
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao iniciar onboarding do WhatsApp Business.",
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDisconnectWhatsApp() {
    setActionBusy("whatsapp:disconnect");
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/integrations/whatsapp`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: "error",
          message:
            data.error || "Não foi possível desconectar o WhatsApp do LinkIA.",
        });
      } else {
        setWhatsappState({
          loaded: true,
          loading: false,
          error: null,
          data: data.connection as WhatsAppConnectionView,
        });
        setConfirmDisconnect(null);
        setNotice({
          tone: "success",
          message:
            "WhatsApp desconectado do LinkIA. Seu número não foi desregistrado da Cloud API.",
        });
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao desconectar WhatsApp.",
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleConnectSocial(provider: OrganicSocialProvider) {
    setActionBusy(`${provider}:connect`);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/integrations/social/${provider}/connect`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: res.status === 503 ? "warning" : "error",
          message:
            data.error ||
            `Não foi possível iniciar a conexão com ${provider === "instagram" ? "Instagram" : "TikTok"}.`,
        });
        await loadSocialChannel(profileId, provider);
        setActionBusy(null);
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
        message: "Erro de conexão ao iniciar autorização social.",
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDisconnectSocial(provider: OrganicSocialProvider) {
    setActionBusy(`${provider}:disconnect`);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/integrations/social/${provider}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: "error",
          message: data.error || "Não foi possível desconectar o canal.",
        });
      } else {
        const setTarget =
          provider === "instagram" ? setInstagramState : setTiktokState;
        setTarget({
          loaded: true,
          loading: false,
          error: null,
          data: {
            connection: data.connection as SocialConnectionView,
            media: [],
          },
        });
        setConfirmDisconnect(null);
        setNotice({
          tone: "success",
          message: `${provider === "instagram" ? "Instagram" : "TikTok"} desconectado deste perfil.`,
        });
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao desconectar o canal.",
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSyncSocial(provider: OrganicSocialProvider) {
    setActionBusy(`${provider}:sync`);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/integrations/social/${provider}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ force: true }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: res.status === 503 ? "warning" : "error",
          message: data.error || "Não foi possível sincronizar as mídias.",
        });
        await loadSocialChannel(profileId, provider);
      } else {
        const setTarget =
          provider === "instagram" ? setInstagramState : setTiktokState;
        setTarget({
          loaded: true,
          loading: false,
          error: null,
          data: {
            connection: data.connection as SocialConnectionView,
            media: Array.isArray(data.media)
              ? (data.media as SocialMediaItemView[])
              : [],
          },
        });
        setNotice({
          tone: "success",
          message: `${provider === "instagram" ? "Instagram" : "TikTok"} sincronizado com sucesso.`,
        });
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao sincronizar mídias.",
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleToggleInstagramPublicItem(externalId: string) {
    if (!instagramState.data) return;
    const currentMedia = instagramState.data.media;
    const currentSelected = currentMedia
      .filter((item) => item.publicEnabled)
      .map((item) => item.externalId);

    const isSelected = currentSelected.includes(externalId);
    if (!isSelected && currentSelected.length >= 3) {
      setNotice({
        tone: "warning",
        message:
          "Você pode exibir no máximo 3 mídias do Instagram no perfil público. Desmarque uma antes de escolher outra.",
      });
      return;
    }

    const nextIds = isSelected
      ? currentSelected.filter((id) => id !== externalId)
      : [...currentSelected, externalId];

    setIgSavingSelection(true);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/integrations/social/instagram`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ publicExternalIds: nextIds }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.media)) {
        setNotice({
          tone: "error",
          message:
            data.error || "Não foi possível salvar a seleção de mídias públicas.",
        });
      } else {
        setInstagramState((prev) =>
          prev.data
            ? {
                ...prev,
                data: {
                  ...prev.data,
                  media: data.media as SocialMediaItemView[],
                },
              }
            : prev
        );
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao atualizar mídias públicas.",
      });
    } finally {
      setIgSavingSelection(false);
    }
  }

  const waConn = whatsappState.data;
  const igData = instagramState.data;
  const ttData = tiktokState.data;

  const igSelectedCount = igData
    ? igData.media.filter((item) => item.publicEnabled).length
    : 0;

  return (
    <GlassSurface intensity="subtle" className="editor-section">
      <div className="editor-section-inner">
        <div>
          <h2 className="section-title">Canais conectados</h2>
          <p className="field-hint">
            Conecte seu WhatsApp Business, Instagram e TikTok sob demanda. Cada
            canal carrega seus dados somente quando você abre.
          </p>
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

        <div className="channel-accordion">
          {/* 1. WhatsApp Business (Zernio) */}
          <div className="channel-item">
            <button
              type="button"
              className="channel-header"
              aria-expanded={expanded.whatsapp}
              onClick={() => handleToggleChannel("whatsapp")}
            >
              <div className="channel-header-info">
                <span className="channel-name">WhatsApp Business (Zernio)</span>
                <span className="channel-subtitle">
                  Coexistência com WhatsApp Business App via Cloud API
                </span>
              </div>
              <div className="channel-header-meta">
                {waConn ? (
                  <span
                    className={`badge ${WHATSAPP_STATUS_META[waConn.status].badgeClass}`}
                  >
                    {WHATSAPP_STATUS_META[waConn.status].label}
                  </span>
                ) : (
                  <span className="badge badge-draft">Sob demanda</span>
                )}
                <span className="channel-chevron" aria-hidden="true">
                  {expanded.whatsapp ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {expanded.whatsapp ? (
              <div className="channel-body">
                {whatsappState.loading ? (
                  <p className="field-hint">
                    Consultando status do WhatsApp Business...
                  </p>
                ) : whatsappState.error ? (
                  <div className="alert-banner alert-error">
                    <p>{whatsappState.error}</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ marginTop: "8px", minHeight: "36px" }}
                      onClick={() => void loadWhatsApp(profileId)}
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : waConn ? (
                  <>
                    <div className="channel-info-box">
                      <p className="channel-info-title">
                        Como funciona a coexistência
                      </p>
                      <ul className="channel-bullet-list">
                        <li>
                          Mantenha o <strong>WhatsApp Business App</strong>{" "}
                          atualizado e o celular disponível durante o
                          onboarding.
                        </li>
                        <li>
                          A elegibilidade do número para coexistência é decidida
                          pela Meta durante o fluxo.
                        </li>
                        <li>
                          Grupos via API permanecem indisponíveis em números
                          coexistentes.
                        </li>
                      </ul>
                    </div>

                    {waConn.status === "pending_config" ||
                    !waConn.configReady ? (
                      <div className="alert-banner alert-warning">
                        <strong>Configuração pendente no servidor.</strong>
                        {waConn.configRequirements.length > 0 ? (
                          <ul className="channel-bullet-list">
                            {waConn.configRequirements.map((req) => (
                              <li key={req}>{req}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    {waConn.lastError ? (
                      <div className="alert-banner alert-error">
                        {waConn.lastError}
                      </div>
                    ) : null}

                    <div className="channel-kv-grid">
                      <div>
                        <span className="channel-kv-label">Número</span>
                        <span className="channel-kv-value">
                          {waConn.maskedPhone || "Não vinculado"}
                        </span>
                      </div>
                      <div>
                        <span className="channel-kv-label">Conta</span>
                        <span className="channel-kv-value">
                          {waConn.displayName || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="channel-kv-label">Modo</span>
                        <span className="channel-kv-value">
                          {waConn.onboardingMode === "business_app"
                            ? "Coexistência (Business App)"
                            : "Cloud API"}
                        </span>
                      </div>
                      <div>
                        <span className="channel-kv-label">
                          Composio (agentes)
                        </span>
                        <span className="channel-kv-value">
                          Desabilitado / validação pendente
                        </span>
                      </div>
                    </div>

                    <div className="channel-capabilities">
                      <span className="channel-kv-label">Capacidades</span>
                      <div className="choice-row">
                        <span className="badge badge-draft">
                          Coexistência:{" "}
                          {waConn.capabilities.coexistenceConfirmed
                            ? "Confirmada"
                            : "Não confirmada"}
                        </span>
                        <span className="badge badge-draft">
                          Mensagens:{" "}
                          {waConn.capabilities.messagingSupported
                            ? "Disponível"
                            : "Indisponível"}
                        </span>
                        <span className="badge badge-draft">
                          Templates:{" "}
                          {waConn.capabilities.templatesSupported
                            ? "Disponível"
                            : "Indisponível"}
                        </span>
                        <span className="badge badge-draft">
                          Grupos API:{" "}
                          {waConn.capabilities.groupsApiSupported
                            ? "Disponível"
                            : "Indisponível"}
                        </span>
                      </div>
                      {waConn.composioNote ? (
                        <p className="field-hint">{waConn.composioNote}</p>
                      ) : null}
                    </div>

                    <div className="channel-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          actionBusy === "whatsapp:connect" ||
                          !waConn.configReady
                        }
                        onClick={() => void handleConnectWhatsApp()}
                      >
                        {actionBusy === "whatsapp:connect"
                          ? "Abrindo Zernio..."
                          : waConn.status === "connected"
                            ? "Reconectar WhatsApp Business"
                            : "Conectar meu WhatsApp Business"}
                      </button>

                      {waConn.status !== "disconnected" &&
                      waConn.status !== "pending_config" ? (
                        confirmDisconnect === "whatsapp" ? (
                          <div className="channel-confirm-box">
                            <p className="field-hint">
                              Isso remove o vínculo no LinkIA, sem desregistrar
                              seu número da Cloud API da Meta.
                            </p>
                            <div className="channel-actions">
                              <button
                                type="button"
                                className="btn btn-danger"
                                disabled={actionBusy === "whatsapp:disconnect"}
                                onClick={() => void handleDisconnectWhatsApp()}
                              >
                                {actionBusy === "whatsapp:disconnect"
                                  ? "Desconectando..."
                                  : "Confirmar desconexão"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setConfirmDisconnect(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setConfirmDisconnect("whatsapp")}
                          >
                            Desconectar do LinkIA
                          </button>
                        )
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* 2. Instagram orgânico (Composio) */}
          <div className="channel-item">
            <button
              type="button"
              className="channel-header"
              aria-expanded={expanded.instagram}
              onClick={() => handleToggleChannel("instagram")}
            >
              <div className="channel-header-info">
                <span className="channel-name">Instagram orgânico</span>
                <span className="channel-subtitle">
                  Conta profissional (Business/Creator) com até 3 mídias no
                  perfil
                </span>
              </div>
              <div className="channel-header-meta">
                {igData ? (
                  <span
                    className={`badge ${SOCIAL_STATUS_META[igData.connection.status].badgeClass}`}
                  >
                    {SOCIAL_STATUS_META[igData.connection.status].label}
                  </span>
                ) : (
                  <span className="badge badge-draft">Sob demanda</span>
                )}
                <span className="channel-chevron" aria-hidden="true">
                  {expanded.instagram ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {expanded.instagram ? (
              <div className="channel-body">
                {instagramState.loading ? (
                  <p className="field-hint">Consultando status do Instagram...</p>
                ) : instagramState.error ? (
                  <div className="alert-banner alert-error">
                    <p>{instagramState.error}</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ marginTop: "8px", minHeight: "36px" }}
                      onClick={() =>
                        void loadSocialChannel(profileId, "instagram")
                      }
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : igData ? (
                  <>
                    {igData.connection.status === "pending_config" ||
                    !igData.connection.configReady ? (
                      <div className="alert-banner alert-warning">
                        <strong>
                          Integração Instagram aguardando configuração no
                          servidor.
                        </strong>
                        {igData.connection.configRequirements.length > 0 ? (
                          <ul className="channel-bullet-list">
                            {igData.connection.configRequirements.map((req) => (
                              <li key={req}>{req}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    {igData.connection.lastError ? (
                      <div className="alert-banner alert-error">
                        <p>{igData.connection.lastError}</p>
                        <p className="field-hint" style={{ marginTop: "4px" }}>
                          Contas pessoais do Instagram não são elegíveis.
                          Converta para conta Profissional (Business ou Creator)
                          e conceda as permissões solicitadas.
                        </p>
                      </div>
                    ) : null}

                    <div className="channel-kv-grid">
                      <div>
                        <span className="channel-kv-label">Conta</span>
                        <span className="channel-kv-value">
                          {igData.connection.accountLabel || "Não conectada"}
                        </span>
                      </div>
                      <div>
                        <span className="channel-kv-label">
                          Última sincronização
                        </span>
                        <span className="channel-kv-value">
                          {igData.connection.lastSyncedAt
                            ? new Date(
                                igData.connection.lastSyncedAt
                              ).toLocaleString("pt-BR")
                            : "Nunca sincronizado"}
                        </span>
                      </div>
                    </div>

                    <div className="channel-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          actionBusy === "instagram:connect" ||
                          !igData.connection.configReady
                        }
                        onClick={() => void handleConnectSocial("instagram")}
                      >
                        {actionBusy === "instagram:connect"
                          ? "Redirecionando..."
                          : igData.connection.status === "connected"
                            ? "Reconectar Instagram"
                            : "Conectar Instagram"}
                      </button>

                      {igData.connection.status === "connected" ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={actionBusy === "instagram:sync"}
                          onClick={() => void handleSyncSocial("instagram")}
                        >
                          {actionBusy === "instagram:sync"
                            ? "Sincronizando..."
                            : "Sincronizar mídias"}
                        </button>
                      ) : null}

                      {igData.connection.status !== "disconnected" &&
                      igData.connection.status !== "pending_config" ? (
                        confirmDisconnect === "instagram" ? (
                          <div className="channel-confirm-box">
                            <p className="field-hint">
                              Desconectar remove as mídias sincronizadas deste
                              perfil no LinkIA.
                            </p>
                            <div className="channel-actions">
                              <button
                                type="button"
                                className="btn btn-danger"
                                disabled={actionBusy === "instagram:disconnect"}
                                onClick={() =>
                                  void handleDisconnectSocial("instagram")
                                }
                              >
                                Confirmar desconexão
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setConfirmDisconnect(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setConfirmDisconnect("instagram")}
                          >
                            Desconectar
                          </button>
                        )
                      ) : null}
                    </div>

                    {igData.connection.status === "connected" ? (
                      <div className="channel-media-section">
                        <div className="channel-media-header">
                          <span className="channel-kv-label">
                            Mídias recentes ({igSelectedCount}/3 no perfil
                            público)
                          </span>
                          {igSavingSelection ? (
                            <span className="field-hint">Salvando...</span>
                          ) : null}
                        </div>

                        {igData.media.length === 0 ? (
                          <p className="field-hint">
                            Nenhuma mídia carregada ainda. Clique em
                            &ldquo;Sincronizar mídias&rdquo; para buscar suas
                            publicações recentes (fotos, vídeos, carrosséis e
                            Reels).
                          </p>
                        ) : (
                          <div className="social-media-grid">
                            {igData.media.map((item) => {
                              const disableNew =
                                !item.publicEnabled && igSelectedCount >= 3;
                              return (
                                <div
                                  key={item.id}
                                  className={`social-media-card${item.publicEnabled ? " is-selected" : ""}`}
                                >
                                  <div className="social-media-thumb">
                                    {item.thumbnailUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={item.thumbnailUrl}
                                        alt={
                                          item.caption ||
                                          `Publicação ${item.mediaType}`
                                        }
                                        loading="lazy"
                                      />
                                    ) : (
                                      <span>{item.mediaType}</span>
                                    )}
                                  </div>
                                  <div className="social-media-meta">
                                    <span className="badge badge-draft">
                                      {item.mediaType}
                                    </span>
                                    <p className="social-media-caption">
                                      {item.caption || "Sem legenda"}
                                    </p>
                                    <div className="social-media-actions">
                                      <label className="checkbox-inline">
                                        <input
                                          type="checkbox"
                                          checked={item.publicEnabled}
                                          disabled={
                                            igSavingSelection || disableNew
                                          }
                                          onChange={() =>
                                            void handleToggleInstagramPublicItem(
                                              item.externalId
                                            )
                                          }
                                        />
                                        <span>Exibir no perfil</span>
                                      </label>
                                      <a
                                        href={item.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="field-hint"
                                      >
                                        Ver original
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* 3. TikTok orgânico (Composio) */}
          <div className="channel-item">
            <button
              type="button"
              className="channel-header"
              aria-expanded={expanded.tiktok}
              onClick={() => handleToggleChannel("tiktok")}
            >
              <div className="channel-header-info">
                <span className="channel-name">TikTok orgânico</span>
                <span className="channel-subtitle">
                  Perfil, URL canônica e vídeos autorizados pelo app
                </span>
              </div>
              <div className="channel-header-meta">
                {ttData ? (
                  <span
                    className={`badge ${SOCIAL_STATUS_META[ttData.connection.status].badgeClass}`}
                  >
                    {SOCIAL_STATUS_META[ttData.connection.status].label}
                  </span>
                ) : (
                  <span className="badge badge-draft">Sob demanda</span>
                )}
                <span className="channel-chevron" aria-hidden="true">
                  {expanded.tiktok ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {expanded.tiktok ? (
              <div className="channel-body">
                {tiktokState.loading ? (
                  <p className="field-hint">Consultando status do TikTok...</p>
                ) : tiktokState.error ? (
                  <div className="alert-banner alert-error">
                    <p>{tiktokState.error}</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ marginTop: "8px", minHeight: "36px" }}
                      onClick={() =>
                        void loadSocialChannel(profileId, "tiktok")
                      }
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : ttData ? (
                  <>
                    {ttData.connection.status === "pending_config" ||
                    !ttData.connection.configReady ? (
                      <div className="alert-banner alert-warning">
                        <strong>
                          TikTok aguardando app e escopos configurados.
                        </strong>
                        {ttData.connection.configRequirements.length > 0 ? (
                          <ul className="channel-bullet-list">
                            {ttData.connection.configRequirements.map((req) => (
                              <li key={req}>{req}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    {ttData.connection.lastError ? (
                      <div className="alert-banner alert-error">
                        {ttData.connection.lastError}
                      </div>
                    ) : null}

                    <div className="channel-kv-grid">
                      <div>
                        <span className="channel-kv-label">Conta</span>
                        <span className="channel-kv-value">
                          {ttData.connection.accountLabel || "Não conectada"}
                        </span>
                      </div>
                      <div>
                        <span className="channel-kv-label">URL canônica</span>
                        <span className="channel-kv-value">
                          {ttData.connection.canonicalUrl ? (
                            <a
                              href={ttData.connection.canonicalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {ttData.connection.canonicalUrl}
                            </a>
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    </div>

                    {ttData.connection.scopesSummary.length > 0 ? (
                      <div className="choice-row">
                        {ttData.connection.scopesSummary.map((scope) => (
                          <span key={scope} className="badge badge-draft">
                            {scope}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="channel-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          actionBusy === "tiktok:connect" ||
                          !ttData.connection.configReady
                        }
                        onClick={() => void handleConnectSocial("tiktok")}
                      >
                        {actionBusy === "tiktok:connect"
                          ? "Redirecionando..."
                          : ttData.connection.status === "connected"
                            ? "Reconectar TikTok"
                            : "Conectar TikTok"}
                      </button>

                      {ttData.connection.status === "connected" ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={actionBusy === "tiktok:sync"}
                          onClick={() => void handleSyncSocial("tiktok")}
                        >
                          {actionBusy === "tiktok:sync"
                            ? "Sincronizando..."
                            : "Sincronizar vídeos"}
                        </button>
                      ) : null}

                      {ttData.connection.status !== "disconnected" &&
                      ttData.connection.status !== "pending_config" ? (
                        confirmDisconnect === "tiktok" ? (
                          <div className="channel-confirm-box">
                            <p className="field-hint">
                              Desconectar remove os vídeos sincronizados deste
                              perfil no LinkIA.
                            </p>
                            <div className="channel-actions">
                              <button
                                type="button"
                                className="btn btn-danger"
                                disabled={actionBusy === "tiktok:disconnect"}
                                onClick={() =>
                                  void handleDisconnectSocial("tiktok")
                                }
                              >
                                Confirmar desconexão
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setConfirmDisconnect(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setConfirmDisconnect("tiktok")}
                          >
                            Desconectar
                          </button>
                        )
                      ) : null}
                    </div>

                    {ttData.connection.status === "connected" &&
                    ttData.media.length > 0 ? (
                      <div className="channel-media-section">
                        <span className="channel-kv-label">
                          Vídeos sincronizados ({ttData.media.length})
                        </span>
                        <div className="social-media-grid">
                          {ttData.media.map((item) => (
                            <div key={item.id} className="social-media-card">
                              <div className="social-media-thumb">
                                {item.thumbnailUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.thumbnailUrl}
                                    alt={item.caption || "Vídeo TikTok"}
                                    loading="lazy"
                                  />
                                ) : (
                                  <span>{item.mediaType}</span>
                                )}
                              </div>
                              <div className="social-media-meta">
                                <p className="social-media-caption">
                                  {item.caption || "Vídeo sem descrição"}
                                </p>
                                <a
                                  href={item.permalink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="field-hint"
                                >
                                  Abrir no TikTok
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </GlassSurface>
  );
}
