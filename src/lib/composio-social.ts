import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { Composio } from "@composio/core";
import { getDb } from "./db";
import {
  hashOAuthState,
  recordIntegrationAudit,
} from "./integration-audit";
import { getMetaAdsReturnBaseUrl } from "./meta-ads-config";
import type {
  OrganicSocialProvider,
  PublicSocialMediaItem,
  SocialAssetView,
  SocialConnectionStatus,
  SocialConnectionView,
  SocialMediaItemView,
  SocialProvider,
} from "./types";
import { sanitizePlainText } from "./validation";

export type SocialComposioMode = "real" | "mock" | "unconfigured";

export const SOCIAL_MEDIA_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_PUBLIC_SOCIAL_MEDIA = 3;

export class SocialConfigError extends Error {
  readonly configRequirements: string[];

  constructor(message: string, configRequirements: string[] = []) {
    super(message);
    this.name = "SocialConfigError";
    this.configRequirements = configRequirements;
  }
}

export class SocialProviderError extends Error {
  readonly statusCode: number;
  readonly correlationId?: string;

  constructor(message: string, statusCode = 502, correlationId?: string) {
    super(message);
    this.name = "SocialProviderError";
    this.statusCode = statusCode;
    this.correlationId = correlationId;
  }
}

function redactTechnicalString(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/\b(cmp|sk|ak|tok|token|secret)_[A-Za-z0-9\-._]{6,}/gi, "[REDACTED]")
    .slice(0, 320);
}

export function sanitizeStoredSocialError(
  raw: string | null | undefined
): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (
    /invalid request data provided|following fields are missing|ig_user_id/i.test(
      trimmed
    )
  ) {
    return "Instagram conectado, mas não foi possível sincronizar as publicações. Tente novamente.";
  }
  if (
    /error executing the tool|instagram_get_|tiktok_|composio|econnrefused|etimedout|stack|syntaxerror|\{.*\}|failed:|token\s|bearer\s/i.test(
      trimmed
    )
  ) {
    return "Não foi possível concluir a operação com o provedor. Tente novamente.";
  }
  return trimmed;
}

export function mapSocialProviderError(params: {
  provider: SocialProvider;
  operation: string;
  profileId?: string;
  rawError: unknown;
}): SocialProviderError | SocialValidationError {
  if (params.rawError instanceof SocialValidationError) {
    return params.rawError;
  }
  if (
    params.rawError instanceof SocialProviderError &&
    params.rawError.correlationId
  ) {
    return params.rawError;
  }

  const correlationId = crypto.randomUUID().slice(0, 12);
  const rawMessage =
    params.rawError instanceof Error
      ? params.rawError.message
      : typeof params.rawError === "string"
        ? params.rawError
        : "Erro desconhecido no provedor social.";

  console.error("[Social]", {
    correlationId,
    provider: params.provider,
    operation: params.operation,
    profileId: params.profileId ?? null,
    error: redactTechnicalString(rawMessage),
  });

  const lower = rawMessage.toLowerCase();
  if (
    lower.includes("personal") ||
    lower.includes("pessoal") ||
    lower.includes("business or creator")
  ) {
    return new SocialValidationError(
      "Não encontramos um perfil profissional elegível. Conecte uma conta Business ou Creator.",
      422
    );
  }

  if (
    lower.includes("expired") ||
    lower.includes("expirad") ||
    lower.includes("revoked") ||
    lower.includes("revogad") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission") ||
    lower.includes("permiss")
  ) {
    return new SocialProviderError(
      "A conexão precisa ser autorizada novamente.",
      401,
      correlationId
    );
  }

  if (
    lower.includes("timeout") ||
    lower.includes("etimedout") ||
    lower.includes("econnrefused") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504") ||
    lower.includes("temporariamente")
  ) {
    return new SocialProviderError(
      "O serviço está temporariamente indisponível. Tente novamente mais tarde.",
      503,
      correlationId
    );
  }

  if (params.provider === "instagram" && params.operation.includes("sync")) {
    return new SocialProviderError(
      "Instagram conectado, mas não foi possível sincronizar as publicações. Tente novamente.",
      502,
      correlationId
    );
  }

  return new SocialProviderError(
    "Não foi possível concluir a operação com o provedor. Tente novamente.",
    502,
    correlationId
  );
}

export class SocialValidationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = "SocialValidationError";
    this.statusCode = statusCode;
  }
}

export interface SocialProviderDefinition {
  provider: SocialProvider;
  toolkitSlug: string;
  authConfigEnv: string;
  managedOAuthSupported: boolean;
  label: string;
  extraRequirements: string[];
}

export const SOCIAL_PROVIDER_DEFINITIONS: Record<
  SocialProvider,
  SocialProviderDefinition
> = {
  instagram: {
    provider: "instagram",
    toolkitSlug: "INSTAGRAM",
    authConfigEnv: "COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID",
    managedOAuthSupported: true,
    label: "Instagram",
    extraRequirements: [],
  },
  tiktok: {
    provider: "tiktok",
    toolkitSlug: "TIKTOK",
    authConfigEnv: "COMPOSIO_TIKTOK_AUTH_CONFIG_ID",
    managedOAuthSupported: false,
    label: "TikTok",
    extraRequirements: [
      "App próprio no TikTok for Developers (OAuth2 próprio, redirect URI verificada e escopos aprovados)",
    ],
  },
  meta_ads: {
    provider: "meta_ads",
    toolkitSlug: "METAADS",
    authConfigEnv: "COMPOSIO_META_ADS_AUTH_CONFIG_ID",
    managedOAuthSupported: false,
    label: "Meta Ads",
    extraRequirements: [
      "Meta App próprio com credenciais OAuth e permissões da Marketing API aprovadas",
    ],
  },
  tiktok_ads: {
    provider: "tiktok_ads",
    toolkitSlug: "TIKTOK_ADS",
    authConfigEnv: "COMPOSIO_TIKTOK_ADS_AUTH_CONFIG_ID",
    managedOAuthSupported: true,
    label: "TikTok Ads",
    extraRequirements: [],
  },
};

export interface InstagramUserInfoResult {
  igUserId: string;
  username: string;
  accountType: string;
  canonicalUrl: string;
  accountLabel: string;
}

export interface TikTokUserInfoResult {
  externalId: string;
  username: string | null;
  displayName: string;
  canonicalUrl: string | null;
  accountLabel: string;
  scopesSummary: string[];
  stats: Record<string, unknown>;
}

export interface NormalizedSocialMediaItem {
  externalId: string;
  mediaType: string;
  caption: string;
  permalink: string;
  thumbnailUrl: string | null;
  likeCount?: number | null;
  commentCount?: number | null;
  publishedAt: string | null;
}

export interface SocialComposioProvider {
  createConnectLink(params: {
    provider: SocialProvider;
    composioUserId: string;
    callbackUrl: string;
    state: string;
    profileId: string;
  }): Promise<{
    connectedAccountId: string;
    redirectUrl: string;
    isMock: boolean;
  }>;

  getConnectionStatus(params: {
    provider: SocialProvider;
    connectedAccountId: string;
    isMock: boolean;
    expectedComposioUserId?: string;
  }): Promise<{
    status: SocialConnectionStatus;
    accountLabel: string | null;
    scopesSummary?: string[];
  }>;

  disconnectAccount(params: {
    provider: SocialProvider;
    connectedAccountId: string;
    isMock: boolean;
  }): Promise<void>;

  fetchInstagramUserInfo(params: {
    composioUserId: string;
    connectedAccountId: string;
    isMock: boolean;
  }): Promise<InstagramUserInfoResult>;

  fetchInstagramMedia(params: {
    composioUserId: string;
    connectedAccountId: string;
    igUserId?: string;
    isMock: boolean;
    limit?: number;
  }): Promise<NormalizedSocialMediaItem[]>;

  fetchTikTokUserInfo(params: {
    composioUserId: string;
    connectedAccountId: string;
    isMock: boolean;
  }): Promise<TikTokUserInfoResult>;

  fetchTikTokVideos(params: {
    composioUserId: string;
    connectedAccountId: string;
    isMock: boolean;
    limit?: number;
  }): Promise<NormalizedSocialMediaItem[]>;
}

interface SocialConnectionRow {
  id: string;
  profile_id: string;
  owner_id: string;
  provider: SocialProvider;
  toolkit_slug: string;
  composio_user_id: string;
  composio_connected_account_id: string | null;
  status: SocialConnectionStatus;
  account_label: string | null;
  canonical_url: string | null;
  selected_asset_id: string | null;
  selected_asset_name: string | null;
  scopes_summary_json: string;
  metadata_json: string;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

interface SocialOAuthStateRow {
  state_hash: string;
  profile_id: string;
  owner_id: string;
  provider: SocialProvider;
  composio_user_id: string;
  composio_connected_account_id: string | null;
  is_mock: number;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface SocialAssetRow {
  id: string;
  connection_id: string;
  profile_id: string;
  provider: SocialProvider;
  asset_type: string;
  external_id: string;
  display_name: string;
  is_selected: number;
  metadata_json: string;
  updated_at: string;
}

interface SocialMediaRow {
  id: string;
  profile_id: string;
  provider: OrganicSocialProvider;
  external_id: string;
  media_type: string;
  caption: string;
  permalink: string;
  thumbnail_url: string | null;
  like_count: number | null;
  comment_count: number | null;
  position: number;
  public_enabled: number;
  published_at: string | null;
  synced_at: string;
}

export function isSocialProvider(value: string): value is SocialProvider {
  return (
    value === "instagram" ||
    value === "tiktok" ||
    value === "meta_ads" ||
    value === "tiktok_ads"
  );
}

export function isOrganicSocialProvider(
  value: string
): value is OrganicSocialProvider {
  return value === "instagram" || value === "tiktok";
}

/**
 * Derives a deterministic, server-controlled Composio userId isolated per owner and profile.
 */
export function deriveSocialComposioUserId(
  ownerId: string,
  profileId: string
): string {
  return `linkia_u_${ownerId}_p_${profileId}`;
}

export function getSocialProviderConfigStatus(provider: SocialProvider): {
  mode: SocialComposioMode;
  configReady: boolean;
  configRequirements: string[];
  toolkitSlug: string;
  managedOAuthSupported: boolean;
} {
  const def = SOCIAL_PROVIDER_DEFINITIONS[provider];
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  const authConfigId = process.env[def.authConfigEnv]?.trim();

  if (apiKey && authConfigId) {
    return {
      mode: "real",
      configReady: true,
      configRequirements: [],
      toolkitSlug: def.toolkitSlug,
      managedOAuthSupported: def.managedOAuthSupported,
    };
  }

  if (process.env.COMPOSIO_ALLOW_LOCAL_MOCK === "true") {
    return {
      mode: "mock",
      configReady: true,
      configRequirements: [],
      toolkitSlug: def.toolkitSlug,
      managedOAuthSupported: def.managedOAuthSupported,
    };
  }

  const missing: string[] = [];
  if (!apiKey) missing.push("COMPOSIO_API_KEY");
  if (!authConfigId) missing.push(def.authConfigEnv);
  missing.push(...def.extraRequirements);

  return {
    mode: "unconfigured",
    configReady: false,
    configRequirements: missing,
    toolkitSlug: def.toolkitSlug,
    managedOAuthSupported: def.managedOAuthSupported,
  };
}

export function getSocialComposioClient(provider: SocialProvider): {
  client: Composio;
  authConfigId: string;
} {
  const def = SOCIAL_PROVIDER_DEFINITIONS[provider];
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  const authConfigId = process.env[def.authConfigEnv]?.trim();

  if (!apiKey || !authConfigId) {
    const status = getSocialProviderConfigStatus(provider);
    throw new SocialConfigError(
      `Integração com ${def.label} aguardando configuração no servidor (${status.configRequirements.join(", ")}).`,
      status.configRequirements
    );
  }

  return { client: new Composio({ apiKey }), authConfigId };
}

function mapComposioStatus(rawStatus?: string): SocialConnectionStatus {
  switch (rawStatus) {
    case "ACTIVE":
      return "connected";
    case "INITIALIZING":
    case "INITIATED":
      return "pending";
    case "EXPIRED":
    case "INACTIVE":
    case "REVOKED":
      return "expired";
    case "FAILED":
      return "failed";
    default:
      return "failed";
  }
}

function unwrapToolData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const rec = data as Record<string, unknown>;
  if (rec.response_data && typeof rec.response_data === "object") {
    return rec.response_data as Record<string, unknown>;
  }
  return rec;
}

function validateSafeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/^@+/, "");
  if (!cleaned || !/^[a-zA-Z0-9._]{1,64}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function normalizeTimestamp(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    return new Date(ms).toISOString();
  }
  return null;
}

function normalizeInstagramMediaType(item: Record<string, unknown>): string {
  const productType =
    typeof item.media_product_type === "string"
      ? item.media_product_type.toUpperCase()
      : "";
  const rawType =
    typeof item.media_type === "string" ? item.media_type.toUpperCase() : "";

  if (productType === "REELS" || rawType === "REELS") return "REELS";
  if (rawType === "CAROUSEL_ALBUM") return "CAROUSEL_ALBUM";
  if (rawType === "VIDEO") return "VIDEO";
  return "IMAGE";
}

function parseJsonStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function isInstagramProfessionalAccount(accountType: string): boolean {
  const normalized = accountType.trim().toUpperCase();
  return (
    normalized === "BUSINESS" ||
    normalized === "MEDIA_CREATOR" ||
    normalized === "CREATOR"
  );
}

export const defaultSocialComposioProvider: SocialComposioProvider = {
  async createConnectLink({ provider, composioUserId, callbackUrl, state }) {
    const config = getSocialProviderConfigStatus(provider);
    if (!config.configReady) {
      throw new SocialConfigError(
        `Integração com ${SOCIAL_PROVIDER_DEFINITIONS[provider].label} não configurada no servidor.`,
        config.configRequirements
      );
    }

    if (config.mode === "mock") {
      return {
        connectedAccountId: `mock_${provider}_${crypto.randomUUID()}`,
        redirectUrl: `/api/integrations/social/callback?state=${encodeURIComponent(state)}&status=connected`,
        isMock: true,
      };
    }

    const { client, authConfigId } = getSocialComposioClient(provider);
    let request;
    try {
      request = await client.connectedAccounts.link(
        composioUserId,
        authConfigId,
        { callbackUrl, allowMultiple: true } as Parameters<
          typeof client.connectedAccounts.link
        >[2]
      );
    } catch (err) {
      throw new SocialProviderError(
        err instanceof Error
          ? `Falha ao gerar link no Composio (${provider}): ${err.message}`
          : `Falha ao gerar link no Composio (${provider}).`
      );
    }

    if (!request.redirectUrl) {
      throw new SocialProviderError(
        "Composio não retornou URL de autorização."
      );
    }

    return {
      connectedAccountId: request.id,
      redirectUrl: request.redirectUrl,
      isMock: false,
    };
  },

  async getConnectionStatus({
    provider,
    connectedAccountId,
    isMock,
    expectedComposioUserId,
  }) {
    if (isMock) {
      return {
        status: "connected",
        accountLabel: `${SOCIAL_PROVIDER_DEFINITIONS[provider].label} (Simulação)`,
        scopesSummary: ["mock:read"],
      };
    }

    const { client } = getSocialComposioClient(provider);
    const account = await client.connectedAccounts.get(connectedAccountId);
    const accountRecord = account as unknown as Record<string, unknown>;

    if (
      expectedComposioUserId &&
      typeof accountRecord.userId === "string" &&
      accountRecord.userId !== expectedComposioUserId
    ) {
      throw new SocialProviderError(
        "A conta conectada não pertence ao perfil autorizado.",
        403
      );
    }

    const status = mapComposioStatus(account.status);
    const dataRec =
      accountRecord.data && typeof accountRecord.data === "object"
        ? (accountRecord.data as Record<string, unknown>)
        : {};

    const rawLabel =
      (typeof dataRec.username === "string" && `@${dataRec.username.replace(/^@+/, "")}`) ||
      (typeof dataRec.name === "string" && dataRec.name) ||
      (typeof dataRec.email === "string" && dataRec.email) ||
      `${SOCIAL_PROVIDER_DEFINITIONS[provider].label} conectada`;

    return {
      status,
      accountLabel: status === "connected" ? rawLabel : null,
      scopesSummary: Array.isArray(dataRec.scope)
        ? dataRec.scope.filter((s): s is string => typeof s === "string")
        : typeof dataRec.scope === "string"
          ? dataRec.scope.split(/[\s,]+/).filter(Boolean)
          : [],
    };
  },

  async disconnectAccount({ provider, connectedAccountId, isMock }) {
    if (isMock || !connectedAccountId) return;
    const config = getSocialProviderConfigStatus(provider);
    if (config.mode !== "real") return;

    try {
      const { client } = getSocialComposioClient(provider);
      await client.connectedAccounts.delete(connectedAccountId);
    } catch {
      // Best-effort revocation; local connection and media are still cleaned up.
    }
  },

  async fetchInstagramUserInfo({ composioUserId, connectedAccountId, isMock }) {
    if (isMock) {
      return {
        igUserId: "mock_ig_17841400000000001",
        username: "linkia.studio",
        accountType: "BUSINESS",
        canonicalUrl: "https://www.instagram.com/linkia.studio/",
        accountLabel: "@linkia.studio",
      };
    }

    const { client } = getSocialComposioClient("instagram");
    const response = await client.tools.execute("INSTAGRAM_GET_USER_INFO", {
      userId: composioUserId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: {
        ig_user_id: "me",
        fields: "id,user_id,username,name,account_type,media_count",
      },
    });

    if (!response.successful) {
      throw mapSocialProviderError({
        provider: "instagram",
        operation: "get_user_info",
        rawError: response.error || "Falha ao consultar dados da conta no Instagram.",
      });
    }

    const root = unwrapToolData(response.data);
    const accountType =
      typeof root.account_type === "string" ? root.account_type : "";

    if (accountType && !isInstagramProfessionalAccount(accountType)) {
      throw new SocialValidationError(
        "Não encontramos um perfil profissional elegível. Conecte uma conta Business ou Creator.",
        422
      );
    }

    const username = sanitizeHandle(root.username);
    if (!username) {
      throw mapSocialProviderError({
        provider: "instagram",
        operation: "get_user_info",
        rawError: "Instagram não retornou username válido para a conta conectada.",
      });
    }

    const rawId =
      typeof root.id === "string" && root.id.trim()
        ? root.id.trim()
        : typeof root.user_id === "string" && root.user_id.trim()
          ? root.user_id.trim()
          : "";
    if (!rawId || rawId.toLowerCase() === username.toLowerCase()) {
      throw mapSocialProviderError({
        provider: "instagram",
        operation: "get_user_info",
        rawError: "Instagram não retornou ig_user_id numérico válido.",
      });
    }

    return {
      igUserId: rawId,
      username,
      accountType: accountType || "BUSINESS",
      canonicalUrl: `https://www.instagram.com/${username}/`,
      accountLabel: `@${username}`,
    };
  },

  async fetchInstagramMedia({
    composioUserId,
    connectedAccountId,
    igUserId,
    isMock,
    limit = MAX_PUBLIC_SOCIAL_MEDIA,
  }) {
    const maxItems = Math.min(Math.max(1, limit), MAX_PUBLIC_SOCIAL_MEDIA);
    if (isMock) {
      const now = new Date().toISOString();
      return [
        {
          externalId: "mock_ig_media_1",
          mediaType: "REELS",
          caption: "Bastidores do atendimento de hoje no estúdio.",
          permalink: "https://www.instagram.com/reel/mock1/",
          thumbnailUrl: null,
          likeCount: 42,
          commentCount: 5,
          publishedAt: now,
        },
        {
          externalId: "mock_ig_media_2",
          mediaType: "CAROUSEL_ALBUM",
          caption: "Guia rápido de cuidados após o procedimento.",
          permalink: "https://www.instagram.com/p/mock2/",
          thumbnailUrl: null,
          likeCount: 18,
          commentCount: 2,
          publishedAt: now,
        },
        {
          externalId: "mock_ig_media_3",
          mediaType: "IMAGE",
          caption: "Agenda aberta para esta semana.",
          permalink: "https://www.instagram.com/p/mock3/",
          thumbnailUrl: null,
          likeCount: null,
          commentCount: null,
          publishedAt: now,
        },
      ].slice(0, maxItems);
    }

    if (!igUserId || !igUserId.trim()) {
      throw mapSocialProviderError({
        provider: "instagram",
        operation: "sync_media_missing_id",
        rawError: "ig_user_id ausente para sincronização.",
      });
    }

    const { client } = getSocialComposioClient("instagram");
    const normalized: NormalizedSocialMediaItem[] = [];
    const seenIds = new Set<string>();
    let afterCursor: string | undefined;

    for (let page = 0; page < 3 && normalized.length < maxItems; page++) {
      const response = await client.tools.execute(
        "INSTAGRAM_GET_IG_USER_MEDIA",
        {
          userId: composioUserId,
          connectedAccountId,
          dangerouslySkipVersionCheck: true,
          arguments: {
            ig_user_id: igUserId.trim(),
            limit: maxItems,
            fields:
              "id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,username,like_count,comments_count,total_like_count,total_comments_count",
            ...(afterCursor ? { after: afterCursor } : {}),
          },
        }
      );

      if (!response.successful) {
        throw mapSocialProviderError({
          provider: "instagram",
          operation: "sync_media",
          rawError:
            response.error || "Falha ao buscar mídias recentes do Instagram.",
        });
      }

      const root = unwrapToolData(response.data);
      const rawList = Array.isArray(root.data)
        ? root.data
        : Array.isArray(root.media)
          ? root.media
          : Array.isArray(response.data)
            ? response.data
            : [];

      for (const entry of rawList) {
        if (normalized.length >= maxItems) break;
        if (!entry || typeof entry !== "object") continue;
        const item = entry as Record<string, unknown>;
        const externalId =
          typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
        const permalink = validateSafeHttpsUrl(item.permalink);
        if (!externalId || !permalink || seenIds.has(externalId)) continue;
        seenIds.add(externalId);

        const mediaType = normalizeInstagramMediaType(item);
        const thumbnailUrl =
          validateSafeHttpsUrl(item.thumbnail_url) ??
          (mediaType !== "VIDEO" && mediaType !== "REELS"
            ? validateSafeHttpsUrl(item.media_url)
            : null);
        const captionCheck = sanitizePlainText(
          typeof item.caption === "string" ? item.caption : "",
          220
        );

        const rawLike = item.like_count ?? item.total_like_count;
        const rawComment = item.comments_count ?? item.total_comments_count;
        const likeCount =
          typeof rawLike === "number" && Number.isFinite(rawLike) && rawLike >= 0
            ? Math.trunc(rawLike)
            : null;
        const commentCount =
          typeof rawComment === "number" &&
          Number.isFinite(rawComment) &&
          rawComment >= 0
            ? Math.trunc(rawComment)
            : null;

        normalized.push({
          externalId,
          mediaType,
          caption: captionCheck.value,
          permalink,
          thumbnailUrl,
          likeCount,
          commentCount,
          publishedAt: normalizeTimestamp(item.timestamp),
        });
      }

      const paging =
        root.paging && typeof root.paging === "object"
          ? (root.paging as Record<string, unknown>)
          : null;
      const cursors =
        paging?.cursors && typeof paging.cursors === "object"
          ? (paging.cursors as Record<string, unknown>)
          : null;
      const nextAfter =
        typeof cursors?.after === "string" && cursors.after.trim()
          ? cursors.after.trim()
          : undefined;
      if (!nextAfter || rawList.length === 0) {
        break;
      }
      afterCursor = nextAfter;
    }

    return normalized.slice(0, maxItems);
  },

  async fetchTikTokUserInfo({ composioUserId, connectedAccountId, isMock }) {
    if (isMock) {
      return {
        externalId: "mock_tt_user_1",
        username: "linkia.oficial",
        displayName: "LinkIA Oficial",
        canonicalUrl: "https://www.tiktok.com/@linkia.oficial",
        accountLabel: "@linkia.oficial",
        scopesSummary: ["user.info.basic", "video.list"],
        stats: { follower_count: 0 },
      };
    }

    const { client } = getSocialComposioClient("tiktok");
    const scopesSummary: string[] = [];
    let creatorData: Record<string, unknown> = {};
    let statsData: Record<string, unknown> = {};

    try {
      const creatorRes = await client.tools.execute(
        "TIKTOK_QUERY_CREATOR_INFO",
        {
          userId: composioUserId,
          connectedAccountId,
          dangerouslySkipVersionCheck: true,
          arguments: {},
        }
      );
      if (creatorRes.successful) {
        creatorData = unwrapToolData(creatorRes.data);
        scopesSummary.push("creator.info");
      }
    } catch {
      // Scope may not be granted for this TikTok app.
    }

    try {
      const statsRes = await client.tools.execute("TIKTOK_GET_USER_STATS", {
        userId: composioUserId,
        connectedAccountId,
        dangerouslySkipVersionCheck: true,
        arguments: {},
      });
      if (statsRes.successful) {
        statsData = unwrapToolData(statsRes.data);
        scopesSummary.push("user.info.stats");
      }
    } catch {
      // Scope may not be granted for this TikTok app.
    }

    const nestedUser =
      (creatorData.user && typeof creatorData.user === "object"
        ? (creatorData.user as Record<string, unknown>)
        : null) ??
      (statsData.user && typeof statsData.user === "object"
        ? (statsData.user as Record<string, unknown>)
        : null) ??
      {};

    const username =
      sanitizeHandle(creatorData.creator_username) ??
      sanitizeHandle(creatorData.username) ??
      sanitizeHandle(statsData.username) ??
      sanitizeHandle(nestedUser.username);

    const displayNameRaw =
      (typeof creatorData.creator_nickname === "string" &&
        creatorData.creator_nickname) ||
      (typeof statsData.display_name === "string" && statsData.display_name) ||
      (typeof nestedUser.display_name === "string" && nestedUser.display_name) ||
      username ||
      "Conta TikTok";

    const displayName = sanitizePlainText(displayNameRaw, 80).value || "Conta TikTok";

    const deepLink =
      validateSafeHttpsUrl(creatorData.profile_deep_link) ??
      validateSafeHttpsUrl(statsData.profile_deep_link) ??
      validateSafeHttpsUrl(nestedUser.profile_deep_link);

    const canonicalUrl = username
      ? `https://www.tiktok.com/@${username}`
      : deepLink;

    const externalId =
      (typeof nestedUser.open_id === "string" && nestedUser.open_id) ||
      (typeof statsData.open_id === "string" && statsData.open_id) ||
      username ||
      connectedAccountId;

    return {
      externalId,
      username,
      displayName,
      canonicalUrl,
      accountLabel: username ? `@${username}` : displayName,
      scopesSummary,
      stats: statsData,
    };
  },

  async fetchTikTokVideos({
    composioUserId,
    connectedAccountId,
    isMock,
    limit = 12,
  }) {
    if (isMock) {
      return [
        {
          externalId: "mock_tt_vid_1",
          mediaType: "VIDEO",
          caption: "Apresentação rápida dos serviços.",
          permalink: "https://www.tiktok.com/@linkia.oficial/video/1",
          thumbnailUrl: null,
          publishedAt: new Date().toISOString(),
        },
      ];
    }

    const { client } = getSocialComposioClient("tiktok");
    const response = await client.tools.execute("TIKTOK_LIST_VIDEOS", {
      userId: composioUserId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: { max_count: limit },
    });

    if (!response.successful) {
      throw new SocialProviderError(
        response.error || "Falha ao listar vídeos do TikTok."
      );
    }

    const root = unwrapToolData(response.data);
    const dataNested =
      root.data && typeof root.data === "object"
        ? (root.data as Record<string, unknown>)
        : {};
    const rawVideos = Array.isArray(root.videos)
      ? root.videos
      : Array.isArray(dataNested.videos)
        ? dataNested.videos
        : Array.isArray(root.list)
          ? root.list
          : [];

    const normalized: NormalizedSocialMediaItem[] = [];
    for (const entry of rawVideos) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const externalId =
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : typeof item.video_id === "string" && item.video_id.trim()
            ? item.video_id.trim()
            : null;
      const permalink =
        validateSafeHttpsUrl(item.share_url) ??
        validateSafeHttpsUrl(item.embed_link);

      if (!externalId || !permalink) continue;

      const captionRaw =
        (typeof item.video_description === "string" && item.video_description) ||
        (typeof item.title === "string" && item.title) ||
        "";

      normalized.push({
        externalId,
        mediaType: "VIDEO",
        caption: sanitizePlainText(captionRaw, 220).value,
        permalink,
        thumbnailUrl: validateSafeHttpsUrl(item.cover_image_url),
        publishedAt: normalizeTimestamp(item.create_time),
      });
    }

    return normalized.slice(0, limit);
  },
};

function rowToSocialConnectionView(
  provider: SocialProvider,
  row: SocialConnectionRow | undefined,
  assets: SocialAssetRow[]
): SocialConnectionView {
  const config = getSocialProviderConfigStatus(provider);
  const effectiveStatus: SocialConnectionStatus = !row
    ? config.configReady
      ? "disconnected"
      : "pending_config"
    : !config.configReady && row.status === "disconnected"
      ? "pending_config"
      : row.status;

  return {
    provider,
    toolkitSlug: config.toolkitSlug,
    status: effectiveStatus,
    configReady: config.configReady,
    configRequirements: config.configRequirements,
    managedOAuthSupported: config.managedOAuthSupported,
    accountLabel: row?.account_label ?? null,
    canonicalUrl: row?.canonical_url ?? null,
    selectedAssetId: row?.selected_asset_id ?? null,
    selectedAssetName: row?.selected_asset_name ?? null,
    scopesSummary: row ? parseJsonStringArray(row.scopes_summary_json) : [],
    lastSyncedAt: row?.last_synced_at ?? null,
    lastError: sanitizeStoredSocialError(row?.last_error),
    updatedAt: row?.updated_at ?? null,
    assets: assets.map((a): SocialAssetView => ({
      id: a.id,
      assetType: a.asset_type,
      externalId: a.external_id,
      displayName: a.display_name,
      isSelected: Boolean(a.is_selected),
    })),
  };
}

function rowToSocialMediaItemView(row: SocialMediaRow): SocialMediaItemView {
  return {
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    mediaType: row.media_type,
    caption: row.caption,
    permalink: row.permalink,
    thumbnailUrl: row.thumbnail_url,
    likeCount: typeof row.like_count === "number" ? row.like_count : null,
    commentCount: typeof row.comment_count === "number" ? row.comment_count : null,
    position: row.position,
    publicEnabled: Boolean(row.public_enabled),
    publishedAt: row.published_at,
    syncedAt: row.synced_at,
  };
}

export function getSocialConnectionView(
  profileId: string,
  provider: SocialProvider
): SocialConnectionView {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM social_connections WHERE profile_id = ? AND provider = ?"
    )
    .get(profileId, provider) as SocialConnectionRow | undefined;

  const assets = row
    ? (db
        .prepare(
          "SELECT * FROM social_assets WHERE connection_id = ? ORDER BY is_selected DESC, display_name ASC"
        )
        .all(row.id) as SocialAssetRow[])
    : [];

  return rowToSocialConnectionView(provider, row, assets);
}

export function listOrganicSocialConnections(
  profileId: string
): SocialConnectionView[] {
  return (["instagram", "tiktok"] as const).map((provider) =>
    getSocialConnectionView(profileId, provider)
  );
}

export function listProfileSocialMedia(
  profileId: string,
  provider: OrganicSocialProvider
): SocialMediaItemView[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM profile_social_media
       WHERE profile_id = ? AND provider = ?
       ORDER BY position ASC, synced_at DESC`
    )
    .all(profileId, provider) as SocialMediaRow[];

  return rows.map(rowToSocialMediaItemView);
}

export function listPublicSocialMediaByProfileId(
  profileId: string
): PublicSocialMediaItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT m.external_id, m.media_type, m.caption, m.permalink, m.thumbnail_url,
              m.like_count, m.comment_count
       FROM profile_social_media m
       INNER JOIN social_connections c
         ON c.profile_id = m.profile_id AND c.provider = m.provider
       WHERE m.profile_id = ?
         AND m.public_enabled = 1
         AND c.status = 'connected'
       ORDER BY m.position ASC
       LIMIT ?`
    )
    .all(profileId, MAX_PUBLIC_SOCIAL_MEDIA) as Array<{
    external_id: string;
    media_type: string;
    caption: string;
    permalink: string;
    thumbnail_url: string | null;
    like_count: number | null;
    comment_count: number | null;
  }>;

  return rows.map((row) => ({
    externalId: row.external_id,
    mediaType: row.media_type,
    caption: row.caption,
    permalink: row.permalink,
    thumbnailUrl: row.thumbnail_url,
    likeCount: typeof row.like_count === "number" ? row.like_count : null,
    commentCount: typeof row.comment_count === "number" ? row.comment_count : null,
  }));
}

function revalidatePublicProfilePath(profileId: string): void {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT slug, status FROM profiles WHERE id = ?")
      .get(profileId) as { slug: string; status: string } | undefined;
    if (row && row.status === "published") {
      revalidatePath(`/${row.slug}`);
    }
  } catch {
    // Revalidation is a no-op outside Next.js request lifecycle (e.g. Vitest).
  }
}

export async function initiateSocialConnection(params: {
  profileId: string;
  ownerId: string;
  provider: SocialProvider;
  origin: string;
  composioProvider?: SocialComposioProvider;
}): Promise<{ redirectUrl: string; isMock: boolean }> {
  const {
    profileId,
    ownerId,
    provider,
    origin,
    composioProvider = defaultSocialComposioProvider,
  } = params;

  const config = getSocialProviderConfigStatus(provider);
  if (!config.configReady) {
    recordIntegrationAudit({
      profileId,
      ownerId,
      channel: `social:${provider}`,
      action: "connect_init",
      outcome: "rejected",
      details: { reason: "pending_config", missing: config.configRequirements },
    });
    throw new SocialConfigError(
      `Integração com ${SOCIAL_PROVIDER_DEFINITIONS[provider].label} aguardando configuração no servidor.`,
      config.configRequirements
    );
  }

  const composioUserId = deriveSocialComposioUserId(ownerId, profileId);
  const state = crypto.randomBytes(24).toString("hex");
  const stateHash = hashOAuthState(state);
  const returnBaseUrl =
    provider === "meta_ads"
      ? getMetaAdsReturnBaseUrl(origin)
      : `${origin}/api/integrations/social/callback`;
  const callbackUrlObj = new URL(returnBaseUrl);
  callbackUrlObj.searchParams.set("state", state);
  const callbackUrl = callbackUrlObj.toString();

  const link = await composioProvider.createConnectLink({
    provider,
    composioUserId,
    callbackUrl,
    state,
    profileId,
  });

  let safeRedirect = false;
  try {
    const parsedRedirect = new URL(link.redirectUrl);
    if (link.isMock && process.env.COMPOSIO_ALLOW_LOCAL_MOCK === "true" && process.env.NODE_ENV !== "production") {
      safeRedirect = parsedRedirect.pathname === "/api/integrations/social/callback";
    } else {
      safeRedirect =
        parsedRedirect.protocol === "https:" &&
        !parsedRedirect.username &&
        !parsedRedirect.password;
    }
  } catch {
    safeRedirect = false;
  }

  if (!safeRedirect) {
    throw new SocialProviderError(
      "URL de redirecionamento retornada pelo provedor não é permitida."
    );
  }

  const db = getDb();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO social_oauth_states (
      state_hash, profile_id, owner_id, provider, composio_user_id,
      composio_connected_account_id, is_mock, expires_at, used_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(
    stateHash,
    profileId,
    ownerId,
    provider,
    composioUserId,
    link.connectedAccountId,
    link.isMock ? 1 : 0,
    expiresAt,
    now
  );

  db.prepare(
    `INSERT INTO social_connections (
      id, profile_id, owner_id, provider, toolkit_slug, composio_user_id,
      composio_connected_account_id, status, last_error, created_at, updated_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, NULL)
    ON CONFLICT(profile_id, provider) DO UPDATE SET
      owner_id = excluded.owner_id,
      toolkit_slug = excluded.toolkit_slug,
      composio_user_id = excluded.composio_user_id,
      composio_connected_account_id = excluded.composio_connected_account_id,
      status = 'pending',
      last_error = NULL,
      updated_at = excluded.updated_at,
      revoked_at = NULL`
  ).run(
    crypto.randomUUID(),
    profileId,
    ownerId,
    provider,
    config.toolkitSlug,
    composioUserId,
    link.connectedAccountId,
    now,
    now
  );

  recordIntegrationAudit({
    profileId,
    ownerId,
    channel: `social:${provider}`,
    action: "connect_init",
    outcome: "success",
    details: { isMock: link.isMock },
  });

  return {
    redirectUrl: link.redirectUrl,
    isMock: link.isMock,
  };
}

export async function completeSocialOAuthCallback(params: {
  state: string;
  ownerId: string;
  queryStatus?: string | null;
  queryError?: string | null;
  queryConnectedAccountId?: string | null;
  composioProvider?: SocialComposioProvider;
}): Promise<{
  profileId: string;
  provider: SocialProvider;
  status: SocialConnectionStatus;
  error?: string;
}> {
  const {
    state,
    ownerId,
    queryStatus,
    queryError,
    queryConnectedAccountId,
    composioProvider = defaultSocialComposioProvider,
  } = params;

  const db = getDb();
  const stateHash = hashOAuthState(state);
  const oauthRow = db
    .prepare("SELECT * FROM social_oauth_states WHERE state_hash = ?")
    .get(stateHash) as SocialOAuthStateRow | undefined;

  if (!oauthRow) {
    throw new SocialProviderError(
      "Solicitação de autorização inválida ou não encontrada.",
      400
    );
  }

  if (oauthRow.used_at) {
    throw new SocialProviderError(
      "Solicitação de autorização já utilizada.",
      400
    );
  }

  const now = new Date().toISOString();
  const consumeResult = db
    .prepare(
      "UPDATE social_oauth_states SET used_at = ? WHERE state_hash = ? AND used_at IS NULL"
    )
    .run(now, stateHash);

  if (consumeResult.changes !== 1) {
    throw new SocialProviderError(
      "Solicitação de autorização já utilizada.",
      400
    );
  }

  if (oauthRow.owner_id !== ownerId) {
    recordIntegrationAudit({
      profileId: oauthRow.profile_id,
      ownerId,
      channel: `social:${oauthRow.provider}`,
      action: "oauth_callback",
      outcome: "rejected",
      details: { reason: "owner_mismatch" },
    });
    throw new SocialProviderError(
      "Sessão incompatível com a autorização.",
      403
    );
  }

  const expectedComposioUserId = deriveSocialComposioUserId(
    ownerId,
    oauthRow.profile_id
  );
  if (oauthRow.composio_user_id !== expectedComposioUserId) {
    throw new SocialProviderError(
      "Identificador de isolamento incompatível com a sessão.",
      403
    );
  }

  if (new Date(oauthRow.expires_at).getTime() < Date.now()) {
    throw new SocialProviderError(
      "Solicitação de autorização expirada. Tente conectar novamente.",
      400
    );
  }

  const { profile_id: profileId, provider } = oauthRow;

  if (queryStatus === "cancelled") {
    db.prepare(
      `UPDATE social_connections
       SET status = 'disconnected', composio_connected_account_id = NULL, last_error = ?, updated_at = ?
       WHERE profile_id = ? AND provider = ?`
    ).run("Autorização cancelada pelo usuário.", now, profileId, provider);

    return { profileId, provider, status: "disconnected" };
  }

  if (queryError) {
    const safeErr =
      sanitizeStoredSocialError(queryError) ??
      "Não foi possível concluir a autorização.";
    db.prepare(
      `UPDATE social_connections
       SET status = 'failed', last_error = ?, updated_at = ?
       WHERE profile_id = ? AND provider = ?`
    ).run(safeErr, now, profileId, provider);

    return { profileId, provider, status: "failed", error: safeErr };
  }

  const connectedAccountId =
    oauthRow.composio_connected_account_id || queryConnectedAccountId;
  if (!connectedAccountId) {
    const msg = "Conta conectada não identificada no retorno.";
    db.prepare(
      `UPDATE social_connections
       SET status = 'failed', last_error = ?, updated_at = ?
       WHERE profile_id = ? AND provider = ?`
    ).run(msg, now, profileId, provider);

    return { profileId, provider, status: "failed", error: msg };
  }

  const isMock = Boolean(oauthRow.is_mock);

  try {
    const verified = await composioProvider.getConnectionStatus({
      provider,
      connectedAccountId,
      isMock,
      expectedComposioUserId,
    });

    if (verified.status !== "connected") {
      const msg =
        verified.status === "expired"
          ? "Conexão expirada ou revogada. Reconecte sua conta."
          : verified.status === "failed"
            ? "Não foi possível confirmar a autorização."
            : null;
      db.prepare(
        `UPDATE social_connections
         SET composio_connected_account_id = ?, status = ?, account_label = ?, last_error = ?, updated_at = ?
         WHERE profile_id = ? AND provider = ?`
      ).run(
        connectedAccountId,
        verified.status,
        verified.accountLabel,
        msg,
        now,
        profileId,
        provider
      );
      return {
        profileId,
        provider,
        status: verified.status,
        error: msg ?? undefined,
      };
    }

    let accountLabel = verified.accountLabel;
    let canonicalUrl: string | null = null;
    let selectedAssetId: string | null = null;
    let selectedAssetName: string | null = null;
    let scopesSummary = verified.scopesSummary ?? [];
    const finalStatus: SocialConnectionStatus = "connected";
    const lastError: string | null = null;

    if (provider === "instagram") {
      try {
        const igInfo = await composioProvider.fetchInstagramUserInfo({
          composioUserId: expectedComposioUserId,
          connectedAccountId,
          isMock,
        });
        const normalizedType = (igInfo.accountType || "").toUpperCase();
        if (
          normalizedType &&
          normalizedType !== "BUSINESS" &&
          normalizedType !== "MEDIA_CREATOR" &&
          normalizedType !== "CREATOR"
        ) {
          throw new SocialValidationError(
            "A conta Instagram conectada é pessoal. Converta para Business ou Creator e tente novamente.",
            422
          );
        }
        accountLabel = igInfo.accountLabel;
        canonicalUrl = igInfo.canonicalUrl;
        selectedAssetId = igInfo.igUserId;
        selectedAssetName = igInfo.accountLabel;

        const connRow = db
          .prepare(
            "SELECT id FROM social_connections WHERE profile_id = ? AND provider = ?"
          )
          .get(profileId, provider) as { id: string } | undefined;

        if (connRow) {
          db.prepare(
            `INSERT INTO social_assets (
              id, connection_id, profile_id, provider, asset_type, external_id,
              display_name, is_selected, metadata_json, updated_at
            ) VALUES (?, ?, ?, 'instagram', 'instagram_account', ?, ?, 1, ?, ?)
            ON CONFLICT(connection_id, asset_type, external_id) DO UPDATE SET
              display_name = excluded.display_name,
              is_selected = 1,
              metadata_json = excluded.metadata_json,
              updated_at = excluded.updated_at`
          ).run(
            crypto.randomUUID(),
            connRow.id,
            profileId,
            igInfo.igUserId,
            igInfo.accountLabel,
            JSON.stringify({ accountType: igInfo.accountType }),
            now
          );
        }
      } catch (err) {
        if (err instanceof SocialValidationError) {
          await composioProvider.disconnectAccount({
            provider,
            connectedAccountId,
            isMock,
          });
          db.prepare(
            `UPDATE social_connections
             SET composio_connected_account_id = NULL, status = 'failed',
                 account_label = NULL, canonical_url = NULL, last_error = ?, updated_at = ?
             WHERE profile_id = ? AND provider = ?`
          ).run(err.message, now, profileId, provider);

          recordIntegrationAudit({
            profileId,
            ownerId,
            channel: "social:instagram",
            action: "oauth_callback",
            outcome: "rejected",
            details: { reason: "ineligible_account" },
          });

          return {
            profileId,
            provider,
            status: "failed",
            error: err.message,
          };
        }
        throw err;
      }
    } else if (provider === "tiktok") {
      const ttInfo = await composioProvider.fetchTikTokUserInfo({
        composioUserId: expectedComposioUserId,
        connectedAccountId,
        isMock,
      });
      accountLabel = ttInfo.accountLabel;
      canonicalUrl = ttInfo.canonicalUrl;
      selectedAssetId = ttInfo.externalId;
      selectedAssetName = ttInfo.accountLabel;
      if (ttInfo.scopesSummary.length > 0) {
        scopesSummary = ttInfo.scopesSummary;
      }

      const connRow = db
        .prepare(
          "SELECT id FROM social_connections WHERE profile_id = ? AND provider = ?"
        )
        .get(profileId, provider) as { id: string } | undefined;

      if (connRow) {
        db.prepare(
          `INSERT INTO social_assets (
            id, connection_id, profile_id, provider, asset_type, external_id,
            display_name, is_selected, metadata_json, updated_at
          ) VALUES (?, ?, ?, 'tiktok', 'tiktok_account', ?, ?, 1, ?, ?)
          ON CONFLICT(connection_id, asset_type, external_id) DO UPDATE SET
            display_name = excluded.display_name,
            is_selected = 1,
            metadata_json = excluded.metadata_json,
            updated_at = excluded.updated_at`
        ).run(
          crypto.randomUUID(),
          connRow.id,
          profileId,
          ttInfo.externalId,
          ttInfo.accountLabel,
          JSON.stringify({ stats: ttInfo.stats }),
          now
        );
      }
    }

    db.prepare(
      `UPDATE social_connections
       SET composio_connected_account_id = ?,
           status = ?,
           account_label = ?,
           canonical_url = ?,
           selected_asset_id = ?,
           selected_asset_name = ?,
           scopes_summary_json = ?,
           last_error = ?,
           updated_at = ?
       WHERE profile_id = ? AND provider = ?`
    ).run(
      connectedAccountId,
      finalStatus,
      accountLabel,
      canonicalUrl,
      selectedAssetId,
      selectedAssetName,
      JSON.stringify(scopesSummary),
      lastError,
      now,
      profileId,
      provider
    );

    if (isOrganicSocialProvider(provider) && finalStatus === "connected") {
      try {
        await syncSocialMedia({
          profileId,
          ownerId,
          provider,
          force: true,
          composioProvider,
        });
      } catch (syncErr) {
        const mapped = mapSocialProviderError({
          provider,
          operation: "initial_sync",
          rawError: syncErr,
          profileId,
        });
        db.prepare(
          "UPDATE social_connections SET last_error = ?, updated_at = ? WHERE profile_id = ? AND provider = ?"
        ).run(mapped.message, new Date().toISOString(), profileId, provider);
      }
    }

    recordIntegrationAudit({
      profileId,
      ownerId,
      channel: `social:${provider}`,
      action: "oauth_callback",
      outcome: "success",
      details: { status: finalStatus },
    });

    return { profileId, provider, status: finalStatus };
  } catch (err) {
    const mapped = mapSocialProviderError({
      provider,
      operation: "oauth_callback",
      rawError: err,
      profileId,
    });
    const correlationId =
      mapped instanceof SocialProviderError ? mapped.correlationId : undefined;
    db.prepare(
      `UPDATE social_connections
       SET status = 'failed', last_error = ?, updated_at = ?
       WHERE profile_id = ? AND provider = ?`
    ).run(mapped.message, now, profileId, provider);

    recordIntegrationAudit({
      profileId,
      ownerId,
      channel: `social:${provider}`,
      action: "oauth_callback",
      outcome: "error",
      details: {
        error: mapped.message,
        correlationId: correlationId ?? null,
      },
    });

    return { profileId, provider, status: "failed", error: mapped.message };
  }
}

export async function syncSocialMedia(params: {
  profileId: string;
  ownerId: string;
  provider: OrganicSocialProvider;
  force?: boolean;
  composioProvider?: SocialComposioProvider;
}): Promise<{
  connection: SocialConnectionView;
  media: SocialMediaItemView[];
  fromCache: boolean;
}> {
  const {
    profileId,
    ownerId,
    provider,
    force = false,
    composioProvider = defaultSocialComposioProvider,
  } = params;

  const db = getDb();
  const conn = db
    .prepare(
      "SELECT * FROM social_connections WHERE profile_id = ? AND provider = ? AND owner_id = ?"
    )
    .get(profileId, provider, ownerId) as SocialConnectionRow | undefined;

  if (!conn || conn.status !== "connected" || !conn.composio_connected_account_id) {
    throw new SocialValidationError(
      `Conecte sua conta ${SOCIAL_PROVIDER_DEFINITIONS[provider].label} antes de sincronizar.`,
      409
    );
  }

  if (
    !force &&
    conn.last_synced_at &&
    Date.now() - Date.parse(conn.last_synced_at) < SOCIAL_MEDIA_CACHE_TTL_MS
  ) {
    return {
      connection: getSocialConnectionView(profileId, provider),
      media: listProfileSocialMedia(profileId, provider),
      fromCache: true,
    };
  }

  const isMock = conn.composio_connected_account_id.startsWith("mock_");

  let igUserId = conn.selected_asset_id?.trim() || "";
  if (provider === "instagram") {
    const cleanLabelHandle = (conn.account_label ?? "").replace(/^@/, "").toLowerCase();
    const looksLikeUsername =
      Boolean(igUserId) &&
      (igUserId.startsWith("@") ||
        (Boolean(cleanLabelHandle) &&
          igUserId.replace(/^@/, "").toLowerCase() === cleanLabelHandle));

    if (!igUserId || looksLikeUsername) {
      try {
        const igInfo = await composioProvider.fetchInstagramUserInfo({
          composioUserId: conn.composio_user_id,
          connectedAccountId: conn.composio_connected_account_id,
          isMock,
        });
        const resolvedId = igInfo.igUserId?.trim();
        const resolvedHandle = (igInfo.username || igInfo.accountLabel || "")
          .replace(/^@/, "")
          .toLowerCase();
        if (
          !resolvedId ||
          resolvedId.startsWith("@") ||
          (Boolean(resolvedHandle) &&
            resolvedId.replace(/^@/, "").toLowerCase() === resolvedHandle)
        ) {
          throw new SocialProviderError(
            "Conectada; sincronização pendente. Reconecte ou verifique as permissões da conta Instagram.",
            502
          );
        }
        igUserId = resolvedId;
        const nowUpdate = new Date().toISOString();
        db.prepare(
          `UPDATE social_connections
           SET selected_asset_id = ?, selected_asset_name = ?, account_label = ?, canonical_url = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          igUserId,
          igInfo.accountLabel,
          igInfo.accountLabel,
          igInfo.canonicalUrl,
          nowUpdate,
          conn.id
        );
      } catch (err) {
        const mapped = mapSocialProviderError({
          provider,
          operation: "resolve_ig_user_id",
          profileId,
          rawError: err,
        });
        const pendingMsg =
          mapped instanceof SocialValidationError
            ? mapped.message
            : "Conectada; sincronização pendente. Reconecte ou verifique as permissões da conta Instagram.";
        db.prepare(
          "UPDATE social_connections SET last_error = ?, updated_at = ? WHERE id = ?"
        ).run(pendingMsg, new Date().toISOString(), conn.id);
        recordIntegrationAudit({
          profileId,
          ownerId,
          channel: "social:instagram",
          action: "sync_media",
          outcome: "error",
          details: {
            reason: "ig_user_id_unresolved",
            correlationId:
              mapped instanceof SocialProviderError ? mapped.correlationId : undefined,
          },
        });
        throw mapped instanceof SocialValidationError
          ? mapped
          : new SocialProviderError(
              pendingMsg,
              mapped.statusCode,
              mapped.correlationId
            );
      }
    }
  }

  let items: NormalizedSocialMediaItem[];
  try {
    items =
      provider === "instagram"
        ? (
            await composioProvider.fetchInstagramMedia({
              composioUserId: conn.composio_user_id,
              connectedAccountId: conn.composio_connected_account_id,
              igUserId,
              isMock,
              limit: MAX_PUBLIC_SOCIAL_MEDIA,
            })
          ).slice(0, MAX_PUBLIC_SOCIAL_MEDIA)
        : await composioProvider.fetchTikTokVideos({
            composioUserId: conn.composio_user_id,
            connectedAccountId: conn.composio_connected_account_id,
            isMock,
            limit: 12,
          });
  } catch (err) {
    const mapped = mapSocialProviderError({
      provider,
      operation: "sync_media",
      profileId,
      rawError: err,
    });
    // Preserva mídias já carregadas e não atualiza last_synced_at.
    db.prepare(
      "UPDATE social_connections SET last_error = ?, updated_at = ? WHERE id = ?"
    ).run(mapped.message, new Date().toISOString(), conn.id);
    recordIntegrationAudit({
      profileId,
      ownerId,
      channel: `social:${provider}`,
      action: "sync_media",
      outcome: "error",
      details: {
        correlationId:
          mapped instanceof SocialProviderError ? mapped.correlationId : undefined,
      },
    });
    throw mapped;
  }

  const now = new Date().toISOString();

  const existingRows = db
    .prepare(
      "SELECT external_id, public_enabled FROM profile_social_media WHERE profile_id = ? AND provider = ?"
    )
    .all(profileId, provider) as Array<{
    external_id: string;
    public_enabled: number;
  }>;

  const preservedPublic = new Set<string>();
  for (const row of existingRows) {
    if (row.public_enabled && preservedPublic.size < MAX_PUBLIC_SOCIAL_MEDIA) {
      preservedPublic.add(row.external_id);
    }
  }

  const tx = db.transaction(() => {
    db.prepare(
      "DELETE FROM profile_social_media WHERE profile_id = ? AND provider = ?"
    ).run(profileId, provider);

    const insertStmt = db.prepare(
      `INSERT INTO profile_social_media (
        id, profile_id, provider, external_id, media_type, caption,
        permalink, thumbnail_url, like_count, comment_count,
        position, public_enabled, published_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    items.forEach((item, index) => {
      insertStmt.run(
        crypto.randomUUID(),
        profileId,
        provider,
        item.externalId,
        item.mediaType,
        item.caption,
        item.permalink,
        item.thumbnailUrl,
        typeof item.likeCount === "number" ? item.likeCount : null,
        typeof item.commentCount === "number" ? item.commentCount : null,
        index,
        preservedPublic.has(item.externalId) ? 1 : 0,
        item.publishedAt,
        now
      );
    });

    db.prepare(
      `UPDATE social_connections
       SET last_synced_at = ?, last_error = NULL, updated_at = ?
       WHERE profile_id = ? AND provider = ?`
    ).run(now, now, profileId, provider);
  });

  tx();
  revalidatePublicProfilePath(profileId);

  recordIntegrationAudit({
    profileId,
    ownerId,
    channel: `social:${provider}`,
    action: "sync_media",
    outcome: "success",
    details: { count: items.length },
  });

  return {
    connection: getSocialConnectionView(profileId, provider),
    media: listProfileSocialMedia(profileId, provider),
    fromCache: false,
  };
}

export function updatePublicSocialMediaSelection(params: {
  profileId: string;
  ownerId: string;
  provider: OrganicSocialProvider;
  selectedExternalIds: string[];
}): SocialMediaItemView[] {
  const { profileId, ownerId, provider, selectedExternalIds } = params;

  const uniqueIds = Array.from(
    new Set(
      selectedExternalIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)
    )
  );

  if (uniqueIds.length > MAX_PUBLIC_SOCIAL_MEDIA) {
    throw new SocialValidationError(
      `Você pode selecionar no máximo ${MAX_PUBLIC_SOCIAL_MEDIA} publicações para exibição pública.`,
      422
    );
  }

  const db = getDb();
  const conn = db
    .prepare(
      "SELECT id FROM social_connections WHERE profile_id = ? AND provider = ? AND owner_id = ?"
    )
    .get(profileId, provider, ownerId) as { id: string } | undefined;

  if (!conn) {
    throw new SocialValidationError(
      "Conexão social não encontrada para este perfil.",
      404
    );
  }

  const existingMedia = db
    .prepare(
      "SELECT external_id FROM profile_social_media WHERE profile_id = ? AND provider = ?"
    )
    .all(profileId, provider) as Array<{ external_id: string }>;

  const existingSet = new Set(existingMedia.map((m) => m.external_id));
  for (const selectedId of uniqueIds) {
    if (!existingSet.has(selectedId)) {
      throw new SocialValidationError(
        `Publicação não encontrada no cache sincronizado: ${selectedId}`,
        422
      );
    }
  }

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE profile_social_media SET public_enabled = 0 WHERE profile_id = ? AND provider = ?"
    ).run(profileId, provider);

    if (uniqueIds.length > 0) {
      const updateStmt = db.prepare(
        "UPDATE profile_social_media SET public_enabled = 1 WHERE profile_id = ? AND provider = ? AND external_id = ?"
      );
      for (const selectedId of uniqueIds) {
        updateStmt.run(profileId, provider, selectedId);
      }
    }
  });

  tx();
  revalidatePublicProfilePath(profileId);

  recordIntegrationAudit({
    profileId,
    ownerId,
    channel: `social:${provider}`,
    action: "select_public_media",
    outcome: "success",
    details: { selectedCount: uniqueIds.length },
  });

  return listProfileSocialMedia(profileId, provider);
}

export async function disconnectSocialConnection(params: {
  profileId: string;
  ownerId: string;
  provider: SocialProvider;
  composioProvider?: SocialComposioProvider;
}): Promise<SocialConnectionView> {
  const {
    profileId,
    ownerId,
    provider,
    composioProvider = defaultSocialComposioProvider,
  } = params;

  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM social_connections WHERE profile_id = ? AND provider = ? AND owner_id = ?"
    )
    .get(profileId, provider, ownerId) as SocialConnectionRow | undefined;

  if (row?.composio_connected_account_id) {
    const isMock = row.composio_connected_account_id.startsWith("mock_");
    await composioProvider.disconnectAccount({
      provider,
      connectedAccountId: row.composio_connected_account_id,
      isMock,
    });
  }

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    if (row) {
      db.prepare(
        `UPDATE social_connections
         SET status = 'disconnected',
             composio_connected_account_id = NULL,
             account_label = NULL,
             canonical_url = NULL,
             selected_asset_id = NULL,
             selected_asset_name = NULL,
             scopes_summary_json = '[]',
             last_error = NULL,
             revoked_at = ?,
             updated_at = ?
         WHERE id = ? AND profile_id = ? AND provider = ?`
      ).run(now, now, row.id, profileId, provider);

      db.prepare(
        "DELETE FROM social_assets WHERE connection_id = ? AND profile_id = ? AND provider = ?"
      ).run(row.id, profileId, provider);
    }

    if (isOrganicSocialProvider(provider)) {
      db.prepare(
        "DELETE FROM profile_social_media WHERE profile_id = ? AND provider = ?"
      ).run(profileId, provider);
    }
  });

  tx();
  revalidatePublicProfilePath(profileId);

  recordIntegrationAudit({
    profileId,
    ownerId,
    channel: `social:${provider}`,
    action: "disconnect",
    outcome: "success",
  });

  return getSocialConnectionView(profileId, provider);
}
