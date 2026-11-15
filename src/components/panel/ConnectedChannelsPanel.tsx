"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildPreviewInstagramUrl } from "@/components/public/profile-visuals";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type {
  OrganicSocialProvider,
  Profile,
  SocialConnectionStatus,
  SocialConnectionView,
  SocialMediaItemView,
  SocialProvider,
  ValidationErrors,
  WhatsAppConnectionStatus,
  WhatsAppConnectionView,
} from "@/lib/types";

interface ConnectedChannelsPanelProps {
  profileId: string;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  whatsappMessage: string;
  instagramEnabled: boolean;
  instagramInput: string;
  fieldErrors: ValidationErrors;
  onFieldChange: <K extends keyof Profile>(
    field: K,
    value: Profile[K]
  ) => void;
}

type ChannelKey = "whatsapp" | "instagram" | "tiktok" | "facebook";

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

function sanitizeUiText(
  raw: string | null | undefined,
  fallback: string
): string {
  if (!raw || !raw.trim()) return fallback;
  const trimmed = raw.trim();
  if (
    /zernio|composio|cloud api|api oficial|auth config|ig_user_id|invalid request data|following fields are missing|error executing the tool|econnrefused|etimedout|stack|syntaxerror|\b[45]\d{2}\b|COMPOSIO_|ZERNIO_|META_ADS_/i.test(
      trimmed
    )
  ) {
    return fallback;
  }
  return trimmed;
}

const WHATSAPP_STATUS_META: Record<
  WhatsAppConnectionStatus,
  { label: string; badgeClass: string }
> = {
  disconnected: { label: "Desconectado", badgeClass: "badge-draft" },
  connecting: { label: "Ação necessária", badgeClass: "badge-draft" },
  incomplete: { label: "Ação necessária", badgeClass: "badge-error" },
  connected: { label: "Conectado", badgeClass: "badge-published" },
  expired: { label: "Ação necessária", badgeClass: "badge-error" },
  failed: { label: "Ação necessária", badgeClass: "badge-error" },
  ineligible: { label: "Ação necessária", badgeClass: "badge-error" },
  pending_config: { label: "Ação necessária", badgeClass: "badge-draft" },
};

const SOCIAL_STATUS_META: Record<
  SocialConnectionStatus,
  { label: string; badgeClass: string }
> = {
  disconnected: { label: "Desconectado", badgeClass: "badge-draft" },
  pending: { label: "Ação necessária", badgeClass: "badge-draft" },
  incomplete: { label: "Ação necessária", badgeClass: "badge-error" },
  connected: { label: "Conectado", badgeClass: "badge-published" },
  expired: { label: "Ação necessária", badgeClass: "badge-error" },
  failed: { label: "Ação necessária", badgeClass: "badge-error" },
  pending_config: { label: "Ação necessária", badgeClass: "badge-draft" },
};

function createEmptyChannelState<T>(): ChannelLoadState<T> {
  return { loaded: false, loading: false, error: null, data: null };
}

function channelToSocialProvider(
  channel: "instagram" | "tiktok" | "facebook"
): SocialProvider {
  return channel === "facebook" ? "meta_ads" : channel;
}

function getChannelDisplayName(channel: ChannelKey): string {
  switch (channel) {
    case "whatsapp":
      return "WhatsApp";
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "facebook":
      return "Facebook";
  }
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
            "Conexão com o WhatsApp Business em andamento. Aguarde a confirmação da conta.",
        },
      };
    }
    if (waStatus === "cancelled" || waStatus === "connection_cancelled") {
      return {
        channel: "whatsapp",
        notice: {
          tone: "warning",
          message: sanitizeUiText(
            reason,
            "Conexão cancelada antes da conclusão. Você pode tentar novamente quando quiser."
          ),
        },
      };
    }
    if (
      waStatus === "one_whatsapp_per_profile" ||
      waStatus === "whatsapp_number_already_connected" ||
      waStatus === "whatsapp_number_pinned_to_profile"
    ) {
      return {
        channel: "whatsapp",
        notice: {
          tone: "error",
          message: sanitizeUiText(
            reason,
            "Este número de WhatsApp já está vinculado a outro perfil. Reutilize ou desvincule a conexão existente antes de tentar novamente."
          ),
        },
      };
    }
    if (waStatus === "ineligible" || waStatus === "on_premise") {
      return {
        channel: "whatsapp",
        notice: {
          tone: "error",
          message: sanitizeUiText(
            reason,
            "Esta conta ou número não pode concluir essa forma de conexão no momento."
          ),
        },
      };
    }
    return {
      channel: "whatsapp",
      notice: {
        tone: "error",
        message: sanitizeUiText(
          reason,
          "Não foi possível concluir a conexão do WhatsApp Business. Tente novamente."
        ),
      },
    };
  }

  if (
    socialStatus &&
    (provider === "instagram" || provider === "tiktok" || provider === "meta_ads")
  ) {
    const channel: ChannelKey = provider === "meta_ads" ? "facebook" : provider;
    const label = getChannelDisplayName(channel);
    if (socialStatus === "connected") {
      return {
        channel,
        notice: {
          tone: "success",
          message: `${label} conectado com sucesso.`,
        },
      };
    }
    return {
      channel,
      notice: {
        tone: socialStatus === "pending" ? "warning" : "error",
        message: sanitizeUiText(
          reason,
          `Não foi possível concluir a conexão com ${label}. Verifique as permissões e tente novamente.`
        ),
      },
    };
  }

  if (socialStatus) {
    return {
      channel: null,
      notice: {
        tone: "error",
        message: sanitizeUiText(
          reason,
          "Não foi possível concluir a autorização. Tente novamente."
        ),
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
        error: sanitizeUiText(
          data.error,
          "Não foi possível consultar o status do WhatsApp."
        ),
        data: null,
      };
    }
    return {
      error: null,
      data: data.connection as WhatsAppConnectionView,
    };
  } catch {
    return {
      error: "Erro de conexão ao consultar o WhatsApp.",
      data: null,
    };
  }
}

async function fetchSocialSnapshot(
  targetProfileId: string,
  channel: "instagram" | "tiktok" | "facebook"
): Promise<{
  error: string | null;
  data: SocialChannelData | null;
}> {
  const provider = channelToSocialProvider(channel);
  const label = getChannelDisplayName(channel);
  try {
    const res = await fetch(
      `/api/profiles/${targetProfileId}/integrations/social/${provider}`,
      { credentials: "include" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.connection) {
      return {
        error: sanitizeUiText(
          data.error,
          `Não foi possível consultar o status do ${label}.`
        ),
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
      error: `Erro de conexão ao consultar ${label}.`,
      data: null,
    };
  }
}

export function ConnectedChannelsPanel({
  profileId,
  whatsappEnabled,
  whatsappNumber,
  whatsappMessage,
  instagramEnabled,
  instagramInput,
  fieldErrors,
  onFieldChange,
}: ConnectedChannelsPanelProps) {
  const [initialReturn] = useState(readInitialReturnState);
  const [expanded, setExpanded] = useState<Record<ChannelKey, boolean>>(() => ({
    whatsapp: initialReturn.channel === "whatsapp",
    instagram: initialReturn.channel === "instagram",
    tiktok: initialReturn.channel === "tiktok",
    facebook: initialReturn.channel === "facebook",
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
  const [facebookState, setFacebookState] = useState<
    ChannelLoadState<SocialChannelData>
  >(() => ({
    ...createEmptyChannelState(),
    loading: initialReturn.channel === "facebook",
  }));

  const [notice, setNotice] = useState<NoticeBanner | null>(
    () => initialReturn.notice
  );
  const [waConnectError, setWaConnectError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<ChannelKey | null>(
    null
  );
  const [igSavingSelection, setIgSavingSelection] = useState(false);

  const activeProfileRef = useRef(profileId);
  useEffect(() => {
    activeProfileRef.current = profileId;
  }, [profileId]);

  const setSocialState = useCallback(
    (
      channel: "instagram" | "tiktok" | "facebook",
      updater:
        | ChannelLoadState<SocialChannelData>
        | ((
            prev: ChannelLoadState<SocialChannelData>
          ) => ChannelLoadState<SocialChannelData>)
    ) => {
      if (channel === "instagram") setInstagramState(updater);
      else if (channel === "tiktok") setTiktokState(updater);
      else setFacebookState(updater);
    },
    []
  );

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
    async (
      targetProfileId: string,
      channel: "instagram" | "tiktok" | "facebook"
    ) => {
      setSocialState(channel, (prev) => ({ ...prev, loading: true, error: null }));
      const snap = await fetchSocialSnapshot(targetProfileId, channel);
      if (activeProfileRef.current !== targetProfileId) return;
      setSocialState(channel, {
        loaded: true,
        loading: false,
        error: snap.error,
        data: snap.data,
      });
    },
    [setSocialState]
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
      void fetchSocialSnapshot(profileId, targetChannel).then((snap) => {
        if (cancelled) return;
        setSocialState(targetChannel, {
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
  }, [profileId, initialReturn, setSocialState]);

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
    } else if (
      channel === "facebook" &&
      !facebookState.loaded &&
      !facebookState.loading
    ) {
      void loadSocialChannel(profileId, "facebook");
    }
  }

  async function handleConnectWhatsApp() {
    if (actionBusy === "whatsapp:connect") return;
    setActionBusy("whatsapp:connect");
    setNotice(null);
    setWaConnectError(null);
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
        const errMsg = sanitizeUiText(
          data.error,
          "Não foi possível iniciar a conexão do WhatsApp Business. Tente novamente."
        );
        setWaConnectError(errMsg);
        setNotice({
          tone: res.status === 503 ? "warning" : "error",
          message: errMsg,
        });
        setActionBusy(null);
        return;
      }

      if (typeof data.redirectUrl === "string" && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      const fallbackMsg =
        "Não foi possível abrir a autorização do WhatsApp. Tente novamente.";
      setWaConnectError(fallbackMsg);
      setNotice({ tone: "error", message: fallbackMsg });
    } catch {
      const connErr =
        "Erro de conexão ao iniciar a vinculação do WhatsApp Business.";
      setWaConnectError(connErr);
      setNotice({ tone: "error", message: connErr });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDisconnectWhatsApp() {
    if (actionBusy === "whatsapp:disconnect") return;
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
          message: sanitizeUiText(
            data.error,
            "Não foi possível desconectar o WhatsApp deste perfil."
          ),
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
          message: "WhatsApp desconectado deste perfil.",
        });
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao desconectar o WhatsApp.",
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleConnectSocial(
    channel: "instagram" | "tiktok" | "facebook"
  ) {
    if (actionBusy === `${channel}:connect`) return;
    const provider = channelToSocialProvider(channel);
    const label = getChannelDisplayName(channel);
    setActionBusy(`${channel}:connect`);
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
          message: sanitizeUiText(
            data.error,
            `Não foi possível iniciar a conexão com ${label}. Tente novamente.`
          ),
        });
        await loadSocialChannel(profileId, channel);
        setActionBusy(null);
        return;
      }

      if (typeof data.redirectUrl === "string" && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      setNotice({
        tone: "error",
        message: `Não foi possível abrir a autorização do ${label}. Tente novamente.`,
      });
    } catch {
      setNotice({
        tone: "error",
        message: `Erro de conexão ao iniciar autorização do ${label}.`,
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDisconnectSocial(
    channel: "instagram" | "tiktok" | "facebook"
  ) {
    if (actionBusy === `${channel}:disconnect`) return;
    const provider = channelToSocialProvider(channel);
    const label = getChannelDisplayName(channel);
    setActionBusy(`${channel}:disconnect`);
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
          message: sanitizeUiText(
            data.error,
            `Não foi possível desconectar ${label}.`
          ),
        });
      } else {
        setSocialState(channel, {
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
          message: `${label} desconectado deste perfil.`,
        });
      }
    } catch {
      setNotice({
        tone: "error",
        message: `Erro de conexão ao desconectar ${label}.`,
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSyncSocial(provider: OrganicSocialProvider) {
    if (actionBusy === `${provider}:sync`) return;
    const label = getChannelDisplayName(provider);
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
          message: sanitizeUiText(
            data.error,
            "Não foi possível sincronizar as publicações."
          ),
        });
        await loadSocialChannel(profileId, provider);
      } else {
        setSocialState(provider, {
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
          message: `${label} sincronizado com sucesso.`,
        });
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao sincronizar publicações.",
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function handleToggleInstagramPublicItem(externalId: string) {
    if (!instagramState.data) return;
    const currentMedia = instagramState.data.media;
    const selectedIds = currentMedia
      .filter((item) => item.publicEnabled)
      .map((item) => item.externalId);
    const isSelected = selectedIds.includes(externalId);
    const nextIds = isSelected
      ? selectedIds.filter((id) => id !== externalId)
      : [...selectedIds, externalId];

    if (nextIds.length > 3) {
      setNotice({
        tone: "warning",
        message:
          "Você pode exibir no máximo 3 publicações do Instagram no perfil público. Desmarque uma antes de escolher outra.",
      });
      return;
    }

    setIgSavingSelection(true);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/integrations/social/instagram`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ selectedExternalIds: nextIds }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({
          tone: "error",
          message: sanitizeUiText(
            data.error,
            "Não foi possível atualizar as publicações exibidas."
          ),
        });
      } else {
        setInstagramState((prev) =>
          prev.data
            ? {
                ...prev,
                data: {
                  ...prev.data,
                  media: Array.isArray(data.media)
                    ? (data.media as SocialMediaItemView[])
                    : prev.data.media,
                },
              }
            : prev
        );
      }
    } catch {
      setNotice({
        tone: "error",
        message: "Erro de conexão ao salvar seleção do Instagram.",
      });
    } finally {
      setIgSavingSelection(false);
    }
  }

  const waConn = whatsappState.data;
  const igData = instagramState.data;
  const ttData = tiktokState.data;
  const fbData = facebookState.data;

  const resolvedIg = buildPreviewInstagramUrl(instagramInput);
  const igSelectedCount = igData
    ? igData.media.filter((item) => item.publicEnabled).length
    : 0;

  return (
    <div id="canais-conectados">
      <GlassSurface
        as="section"
        intensity="dense"
        className="editor-section"
      >
      <div className="editor-section-inner">
        <div className="editor-section-header">
          <h2 className="editor-section-title">2. Canais conectados</h2>
          <p className="editor-section-desc">
            Gerencie em um único lugar WhatsApp, Instagram, TikTok e Facebook.
            Cada canal consulta seus dados somente quando você abre.
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
          {/* 1. WhatsApp */}
          <div className="channel-item">
            <button
              type="button"
              className="channel-header"
              aria-expanded={expanded.whatsapp}
              onClick={() => handleToggleChannel("whatsapp")}
            >
              <div className="channel-header-info">
                <span className="channel-name">WhatsApp</span>
                <span className="channel-subtitle">
                  Vincule sua conta Business ou configure o número do botão
                  público
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
                  <span className="badge badge-draft">Conectar</span>
                )}
                <span className="channel-chevron" aria-hidden="true">
                  {expanded.whatsapp ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {expanded.whatsapp ? (
              <div className="channel-body">
                {/* Caminho 1: Vincular uma conta do WhatsApp Business */}
                <div className="link-card-group">
                  <div className="link-card-top">
                    <strong>1. Vincular uma conta do WhatsApp Business</strong>
                    {waConn ? (
                      <span
                        className={`badge ${WHATSAPP_STATUS_META[waConn.status].badgeClass}`}
                      >
                        {WHATSAPP_STATUS_META[waConn.status].label}
                      </span>
                    ) : null}
                  </div>

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
                      <p className="field-hint">
                        Conecte sua conta empresarial mantendo o WhatsApp
                        Business App no celular quando o número for elegível.
                      </p>

                      {waConn.status === "pending_config" ||
                      !waConn.configReady ? (
                        <div className="alert-banner alert-warning">
                          Integração aguardando configuração do servidor. Você
                          ainda pode informar seu número público abaixo.
                        </div>
                      ) : null}

                      {waConn.status === "ineligible" ? (
                        <div className="alert-banner alert-warning">
                          Esta conta ou número não pôde concluir essa forma de
                          conexão no momento. Você pode continuar usando o
                          número público abaixo para receber mensagens ou tentar
                          outro número elegível.
                        </div>
                      ) : null}

                      {waConnectError ? (
                        <div className="alert-banner alert-error">
                          <p style={{ margin: 0 }}>{waConnectError}</p>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: "8px" }}
                            disabled={actionBusy === "whatsapp:connect"}
                            onClick={() => void handleConnectWhatsApp()}
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : null}

                      {waConn.lastError &&
                      waConn.lastError !== waConnectError ? (
                        <div className="alert-banner alert-error">
                          {sanitizeUiText(
                            waConn.lastError,
                            "Não foi possível concluir a conexão. Tente novamente."
                          )}
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
                          <span className="channel-kv-label">Coexistência</span>
                          <span className="channel-kv-value">
                            {waConn.capabilities.coexistenceConfirmed
                              ? "Confirmada"
                              : "Validação durante a conexão"}
                          </span>
                        </div>
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
                            ? "Redirecionando..."
                            : waConn.status === "connected"
                              ? "Reconectar"
                              : waConn.status === "connecting" ||
                                  waConn.status === "incomplete"
                                ? "Continuar"
                                : "Conectar WhatsApp Business"}
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={whatsappState.loading}
                          onClick={() => void loadWhatsApp(profileId)}
                        >
                          Atualizar status
                        </button>

                        {waConn.status !== "disconnected" &&
                        waConn.status !== "pending_config" ? (
                          confirmDisconnect === "whatsapp" ? (
                            <div className="channel-confirm-box">
                              <p className="field-hint">
                                Desconectar remove apenas o vínculo deste perfil
                                no LinkIA.
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
                              Desconectar
                            </button>
                          )
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Caminho 2: Informar um número para receber mensagens */}
                <div className="link-card-group">
                  <div className="link-card-top">
                    <strong>2. Informar um número para receber mensagens</strong>
                    <label className="switch-label">
                      <input
                        type="checkbox"
                        checked={whatsappEnabled}
                        onChange={(e) =>
                          onFieldChange("whatsappEnabled", e.target.checked)
                        }
                        className="switch-input"
                      />
                      <span>{whatsappEnabled ? "Ativo" : "Desativado"}</span>
                    </label>
                  </div>
                  <p className="field-hint">
                    Define o número usado pelo botão público do seu perfil. Este
                    preenchimento não vincula uma conta empresarial.
                  </p>

                  <div className="field-group">
                    <label htmlFor="whatsappNumber" className="field-label">
                      <span>Número com DDI</span>
                    </label>
                    <input
                      id="whatsappNumber"
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) =>
                        onFieldChange("whatsappNumber", e.target.value)
                      }
                      placeholder="5511999999999"
                      aria-invalid={Boolean(fieldErrors.whatsappNumber)}
                      aria-describedby={
                        fieldErrors.whatsappNumber
                          ? "whatsappNumber-error"
                          : "whatsappNumber-hint"
                      }
                      className="input"
                    />
                    <p id="whatsappNumber-hint" className="field-hint">
                      Inclua o código do país (ex.: 55 para Brasil + DDD +
                      número).
                    </p>
                    {fieldErrors.whatsappNumber ? (
                      <p id="whatsappNumber-error" className="field-error">
                        {fieldErrors.whatsappNumber}
                      </p>
                    ) : null}
                    {whatsappNumber.trim().length > 0 ? (
                      <div style={{ marginTop: "8px" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ minHeight: "34px", fontSize: "0.85rem" }}
                          onClick={() => {
                            onFieldChange("whatsappNumber", "");
                            onFieldChange("whatsappEnabled", false);
                          }}
                        >
                          Remover número
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="field-group">
                    <label htmlFor="whatsappMessage" className="field-label">
                      <span>Mensagem inicial (opcional)</span>
                    </label>
                    <input
                      id="whatsappMessage"
                      type="text"
                      maxLength={200}
                      value={whatsappMessage}
                      onChange={(e) =>
                        onFieldChange("whatsappMessage", e.target.value)
                      }
                      placeholder="Olá! Vim pelo seu LinkIA."
                      className="input"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* 2. Instagram */}
          <div className="channel-item">
            <button
              type="button"
              className="channel-header"
              aria-expanded={expanded.instagram}
              onClick={() => handleToggleChannel("instagram")}
            >
              <div className="channel-header-info">
                <span className="channel-name">Instagram</span>
                <span className="channel-subtitle">
                  Link público e publicações recentes da conta conectada
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
                  <span className="badge badge-draft">Conectar</span>
                )}
                <span className="channel-chevron" aria-hidden="true">
                  {expanded.instagram ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {expanded.instagram ? (
              <div className="channel-body">
                {/* Link público do Instagram */}
                <div className="link-card-group">
                  <div className="link-card-top">
                    <strong>Link público do Instagram</strong>
                    <label className="switch-label">
                      <input
                        type="checkbox"
                        checked={instagramEnabled}
                        onChange={(e) =>
                          onFieldChange("instagramEnabled", e.target.checked)
                        }
                        className="switch-input"
                      />
                      <span>{instagramEnabled ? "Ativo" : "Desativado"}</span>
                    </label>
                  </div>

                  <div className="field-group">
                    <label htmlFor="instagramInput" className="field-label">
                      <span>Usuário ou URL do Instagram</span>
                    </label>
                    <input
                      id="instagramInput"
                      type="text"
                      value={instagramInput}
                      onChange={(e) =>
                        onFieldChange("instagramInput", e.target.value)
                      }
                      placeholder="@seuperfil ou https://instagram.com/seuperfil"
                      aria-invalid={Boolean(fieldErrors.instagramInput)}
                      aria-describedby={
                        fieldErrors.instagramInput
                          ? "instagramInput-error"
                          : "instagramInput-hint"
                      }
                      className="input"
                    />
                    <p id="instagramInput-hint" className="field-hint">
                      {resolvedIg
                        ? `Destino: ${resolvedIg}`
                        : "Informe seu @usuário ou o link completo do perfil."}
                    </p>
                    {fieldErrors.instagramInput ? (
                      <p id="instagramInput-error" className="field-error">
                        {fieldErrors.instagramInput}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Conexão da conta Instagram */}
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
                        Integração Instagram aguardando configuração no
                        servidor.
                      </div>
                    ) : null}

                    {igData.connection.lastError ? (
                      <div className="alert-banner alert-error">
                        <p>
                          {sanitizeUiText(
                            igData.connection.lastError,
                            "Não foi possível concluir a operação no Instagram. Tente novamente."
                          )}
                        </p>
                        <p className="field-hint" style={{ marginTop: "4px" }}>
                          Contas pessoais do Instagram não são elegíveis. Use
                          uma conta Business ou Creator e conceda as permissões
                          solicitadas.
                        </p>
                        <div
                          className="channel-actions"
                          style={{ marginTop: "8px" }}
                        >
                          {igData.connection.status === "connected" ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ minHeight: "36px" }}
                              disabled={actionBusy === "instagram:sync"}
                              onClick={() => void handleSyncSocial("instagram")}
                            >
                              {actionBusy === "instagram:sync"
                                ? "Sincronizando..."
                                : "Tentar novamente"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ minHeight: "36px" }}
                            disabled={
                              actionBusy === "instagram:connect" ||
                              !igData.connection.configReady
                            }
                            onClick={() => void handleConnectSocial("instagram")}
                          >
                            {actionBusy === "instagram:connect"
                              ? "Redirecionando..."
                              : "Reconectar"}
                          </button>
                        </div>
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
                            : igData.connection.status === "connected"
                              ? "Conectada; sincronização pendente"
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
                            : "Sincronizar publicações"}
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
                            Publicações recentes ({igSelectedCount}/3 no perfil
                            público)
                          </span>
                          {igSavingSelection ? (
                            <span className="field-hint">Salvando...</span>
                          ) : null}
                        </div>

                        {igData.media.length === 0 ? (
                          <p className="field-hint">
                            {igData.connection.lastSyncedAt
                              ? "Nenhuma publicação acessível encontrada."
                              : "Nenhuma publicação carregada ainda. Clique em \u201CSincronizar publicações\u201D para buscar suas publicações recentes."}
                          </p>
                        ) : (
                          <>
                            {igData.connection.lastError ? (
                              <p
                                className="field-hint"
                                style={{ marginBottom: "8px" }}
                              >
                                Exibindo últimas publicações carregadas.
                              </p>
                            ) : null}
                            <div className="social-media-grid">
                              {igData.media.slice(0, 3).map((item) => {
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
                                      <p className="field-hint">
                                        Curtidas:{" "}
                                        {typeof item.likeCount === "number"
                                          ? item.likeCount.toLocaleString(
                                              "pt-BR"
                                            )
                                          : "Indisponível para esta conta/permissão"}
                                        {" · "}
                                        Comentários:{" "}
                                        {typeof item.commentCount === "number"
                                          ? item.commentCount.toLocaleString(
                                              "pt-BR"
                                            )
                                          : "Indisponível para esta conta/permissão"}
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
                          </>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* 3. TikTok */}
          <div className="channel-item">
            <button
              type="button"
              className="channel-header"
              aria-expanded={expanded.tiktok}
              onClick={() => handleToggleChannel("tiktok")}
            >
              <div className="channel-header-info">
                <span className="channel-name">TikTok</span>
                <span className="channel-subtitle">
                  Perfil conectado e publicações recentes autorizadas
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
                  <span className="badge badge-draft">Conectar</span>
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
                        TikTok aguardando configuração de aplicativo e
                        permissões no servidor.
                      </div>
                    ) : null}

                    {ttData.connection.lastError ? (
                      <div className="alert-banner alert-error">
                        {sanitizeUiText(
                          ttData.connection.lastError,
                          "Não foi possível concluir a operação no TikTok. Tente novamente."
                        )}
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
                        <span className="channel-kv-label">Perfil público</span>
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
                            : "Sincronizar publicações"}
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

                    {ttData.connection.status === "connected" ? (
                      <div className="channel-media-section">
                        <span className="channel-kv-label">
                          Publicações recentes ({Math.min(ttData.media.length, 3)})
                        </span>
                        {ttData.media.length === 0 ? (
                          <p className="field-hint">
                            {ttData.connection.lastSyncedAt
                              ? "Nenhuma publicação acessível encontrada."
                              : "Nenhuma publicação carregada ainda. Clique em \u201CSincronizar publicações\u201D."}
                          </p>
                        ) : (
                          <div className="social-media-grid">
                            {ttData.media.slice(0, 3).map((item) => (
                              <div key={item.id} className="social-media-card">
                                <div className="social-media-meta">
                                  <span className="badge badge-draft">
                                    {item.mediaType}
                                  </span>
                                  <p className="social-media-caption">
                                    {item.caption || "Sem legenda"}
                                  </p>
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
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* 4. Facebook */}
          <div className="channel-item">
            <button
              type="button"
              className="channel-header"
              aria-expanded={expanded.facebook}
              onClick={() => handleToggleChannel("facebook")}
            >
              <div className="channel-header-info">
                <span className="channel-name">Facebook</span>
                <span className="channel-subtitle">
                  Conta e página conectadas para recursos da plataforma
                </span>
              </div>
              <div className="channel-header-meta">
                {fbData ? (
                  <span
                    className={`badge ${SOCIAL_STATUS_META[fbData.connection.status].badgeClass}`}
                  >
                    {SOCIAL_STATUS_META[fbData.connection.status].label}
                  </span>
                ) : (
                  <span className="badge badge-draft">Conectar</span>
                )}
                <span className="channel-chevron" aria-hidden="true">
                  {expanded.facebook ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {expanded.facebook ? (
              <div className="channel-body">
                {facebookState.loading ? (
                  <p className="field-hint">
                    Consultando status do Facebook...
                  </p>
                ) : facebookState.error ? (
                  <div className="alert-banner alert-error">
                    <p>{facebookState.error}</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ marginTop: "8px", minHeight: "36px" }}
                      onClick={() =>
                        void loadSocialChannel(profileId, "facebook")
                      }
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : fbData ? (
                  <>
                    <p className="field-hint" style={{ marginBottom: "8px" }}>
                      Esta conexão refere-se ao perfil ou página do Facebook.
                      Para conectar contas de anúncios e consultar campanhas do
                      Meta Ads, acesse a aba Tráfego pago.
                    </p>
                    {fbData.connection.status === "pending_config" ||
                    !fbData.connection.configReady ? (
                      <div className="alert-banner alert-warning">
                        Integração Facebook aguardando configuração no servidor.
                      </div>
                    ) : null}

                    {fbData.connection.lastError ? (
                      <div className="alert-banner alert-error">
                        {sanitizeUiText(
                          fbData.connection.lastError,
                          "Não foi possível concluir a conexão com o Facebook. Tente novamente."
                        )}
                      </div>
                    ) : null}

                    <div className="channel-kv-grid">
                      <div>
                        <span className="channel-kv-label">Conta conectada</span>
                        <span className="channel-kv-value">
                          {fbData.connection.accountLabel || "Não conectada"}
                        </span>
                      </div>
                      <div>
                        <span className="channel-kv-label">
                          Conta / página ativa
                        </span>
                        <span className="channel-kv-value">
                          {fbData.connection.selectedAssetName ||
                            (fbData.connection.status === "connected"
                              ? "Disponível na aba Tráfego pago"
                              : "—")}
                        </span>
                      </div>
                    </div>

                    <div className="channel-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          actionBusy === "facebook:connect" ||
                          !fbData.connection.configReady
                        }
                        onClick={() => void handleConnectSocial("facebook")}
                      >
                        {actionBusy === "facebook:connect"
                          ? "Redirecionando..."
                          : fbData.connection.status === "connected"
                            ? "Reconectar Facebook"
                            : "Conectar Facebook"}
                      </button>

                      {fbData.connection.status === "connected" ? (
                        <Link
                          href="/painel/trafego"
                          className="btn btn-secondary"
                        >
                          Abrir Tráfego pago
                        </Link>
                      ) : null}

                      {fbData.connection.status !== "disconnected" &&
                      fbData.connection.status !== "pending_config" ? (
                        confirmDisconnect === "facebook" ? (
                          <div className="channel-confirm-box">
                            <p className="field-hint">
                              Desconectar remove o vínculo da conta Facebook
                              neste perfil.
                            </p>
                            <div className="channel-actions">
                              <button
                                type="button"
                                className="btn btn-danger"
                                disabled={actionBusy === "facebook:disconnect"}
                                onClick={() =>
                                  void handleDisconnectSocial("facebook")
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
                            onClick={() => setConfirmDisconnect("facebook")}
                          >
                            Desconectar
                          </button>
                        )
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </GlassSurface>
    </div>
  );
}
