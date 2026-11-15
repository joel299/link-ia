import crypto from "node:crypto";
import { Composio } from "@composio/core";
import { deriveComposioUserId } from "./composio";
import { sanitizeStoredSocialError } from "./composio-social";
import { getDb } from "./db";
import { recordIntegrationAudit } from "./integration-audit";
import { getProfileByIdForOwner } from "./profiles";
import type {
  AdCampaignOperationView,
  AdCampaignView,
  AdsDatePreset,
  AdsDateRangeFilter,
  AdsProvider,
  SocialAssetView,
  SocialConnectionStatus,
  ValidationErrors,
} from "./types";
import { sanitizePlainText } from "./validation";

export class AdsServiceError extends Error {
  status: number;
  errors?: ValidationErrors;

  constructor(message: string, status = 400, errors?: ValidationErrors) {
    super(message);
    this.name = "AdsServiceError";
    this.status = status;
    this.errors = errors;
  }
}

const VALID_ADS_DATE_PRESETS: ReadonlySet<AdsDatePreset> = new Set([
  "last_7d",
  "last_30d",
  "this_month",
  "last_month",
  "custom",
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateAdsDateRange(input?: {
  datePreset?: string | null;
  since?: string | null;
  until?: string | null;
}): AdsDateRangeFilter {
  const rawPreset = (input?.datePreset ?? "last_30d").trim() as AdsDatePreset;
  const datePreset: AdsDatePreset = VALID_ADS_DATE_PRESETS.has(rawPreset)
    ? rawPreset
    : "last_30d";

  if (datePreset !== "custom") {
    return { datePreset };
  }

  const since = (input?.since ?? "").trim();
  const until = (input?.until ?? "").trim();
  if (!ISO_DATE_RE.test(since) || !ISO_DATE_RE.test(until)) {
    throw new AdsServiceError(
      "Informe as datas inicial e final no formato YYYY-MM-DD para o período personalizado.",
      400
    );
  }
  if (since > until) {
    throw new AdsServiceError(
      "A data inicial não pode ser maior que a data final.",
      400
    );
  }
  return { datePreset: "custom", since, until };
}

function extractDeepAdsErrorText(err: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();

  function visit(val: unknown, depth: number) {
    if (!val || depth > 4) return;
    if (typeof val === "string") {
      parts.push(val);
      return;
    }
    if (typeof val !== "object" || seen.has(val)) return;
    seen.add(val);

    const rec = val as Record<string, unknown>;
    for (const key of [
      "message",
      "slug",
      "code",
      "status",
      "error",
      "details",
      "cause",
      "requestId",
      "request_id",
    ]) {
      if (key in rec && rec[key] !== undefined && rec[key] !== null) {
        if (typeof rec[key] === "string" || typeof rec[key] === "number") {
          parts.push(`${key}=${String(rec[key])}`);
        } else {
          visit(rec[key], depth + 1);
        }
      }
    }
  }

  visit(err, 0);
  if (parts.length === 0) {
    parts.push(String(err ?? ""));
  }
  return parts.join(" | ").slice(0, 800);
}

export function sanitizeAdsErrorMessage(
  err: unknown,
  context: string
): { message: string; status: number } {
  const raw = extractDeepAdsErrorText(err);
  const correlationId = crypto.randomUUID().slice(0, 12);
  console.error("[Ads]", {
    correlationId,
    context,
    error: raw,
  });

  const lower = raw.toLowerCase();
  if (
    lower.includes("connectedaccount_toolkitmismatch") ||
    lower.includes("code=633") ||
    lower.includes("belongs to facebook") ||
    lower.includes("can not be used for metaads") ||
    lower.includes("cannot be used for metaads")
  ) {
    return {
      message:
        "A conexão atual não possui autorização para o Meta Ads. Reconecte sua conta na aba Tráfego pago.",
      status: 409,
    };
  }
  if (
    lower.includes("expired") ||
    lower.includes("expirad") ||
    lower.includes("revoked") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission") ||
    lower.includes("permiss")
  ) {
    return {
      message:
        "A conexão expirou ou falta autorização. Reconecte sua conta na aba Tráfego pago.",
      status: 401,
    };
  }
  if (
    lower.includes("no ad account") ||
    (lower.includes("ad account") && lower.includes("not found"))
  ) {
    return {
      message: "Não encontramos uma conta de anúncios disponível para este acesso.",
      status: 404,
    };
  }
  if (
    lower.includes("timeout") ||
    lower.includes("etimedout") ||
    lower.includes("econnrefused") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504")
  ) {
    return {
      message:
        "O serviço de anúncios está temporariamente indisponível. Tente novamente mais tarde.",
      status: 503,
    };
  }
  return {
    message:
      "Não foi possível consultar os dados de anúncios no momento. Tente novamente.",
    status: 502,
  };
}

export interface AdAccountInfo {
  externalId: string;
  displayName: string;
  currency?: string;
  status?: string;
}

export interface CreateCampaignDraftInput {
  name: string;
  objective: string;
  budgetAmount: number;
  budgetCurrency: string;
  budgetType: "daily" | "lifetime";
  startDate: string;
  endDate?: string;
  targetSummary: string;
  creativeHeadline: string;
  destinationUrl: string;
  idempotencyKey: string;
}

export interface AdsToolAdapter {
  listAdAccounts(params: {
    provider: AdsProvider;
    composioUserId: string;
    connectedAccountId: string;
  }): Promise<AdAccountInfo[]>;

  listCampaignsAndMetrics(params: {
    provider: AdsProvider;
    composioUserId: string;
    connectedAccountId: string;
    adAccountId: string;
    dateRange?: AdsDateRangeFilter;
  }): Promise<AdCampaignView[]>;

  createPausedCampaign(params: {
    provider: AdsProvider;
    composioUserId: string;
    connectedAccountId: string;
    adAccountId: string;
    draft: AdCampaignOperationView["params"];
    idempotencyKey: string;
  }): Promise<{ externalCampaignId: string }>;

  activateCampaign(params: {
    provider: AdsProvider;
    composioUserId: string;
    connectedAccountId: string;
    adAccountId: string;
    externalCampaignId: string;
  }): Promise<void>;
}

interface SocialConnectionRow {
  id: string;
  profile_id: string;
  owner_id: string;
  provider: AdsProvider;
  toolkit_slug: string;
  composio_user_id: string;
  composio_connected_account_id: string | null;
  status: SocialConnectionStatus;
  account_label: string | null;
  selected_asset_id: string | null;
  selected_asset_name: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string;
}

interface SocialAssetRow {
  id: string;
  connection_id: string;
  profile_id: string;
  provider: AdsProvider;
  asset_type: string;
  external_id: string;
  display_name: string;
  is_selected: number;
  metadata_json: string;
  updated_at: string;
}

interface AdCampaignOperationRow {
  id: string;
  profile_id: string;
  owner_id: string;
  provider: AdsProvider;
  ad_account_id: string;
  idempotency_key: string;
  status: "draft" | "created_paused" | "active" | "failed";
  external_campaign_id: string | null;
  params_json: string;
  estimated_budget_summary: string;
  confirmed_at: string | null;
  activated_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const OBJECTIVE_RE = /^[A-Z0-9_]{2,64}$/;
const IDEMPOTENCY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

export function isAdsProvider(value: string): value is AdsProvider {
  return value === "meta_ads" || value === "tiktok_ads";
}

export function getAdsToolkitSlug(provider: AdsProvider): string {
  return provider === "meta_ads" ? "METAADS" : "TIKTOK_ADS";
}

function getAdAccountAssetType(provider: AdsProvider): string {
  return provider === "meta_ads" ? "meta_ad_account" : "tiktok_advertiser";
}

export function getAdsConfigStatus(provider: AdsProvider): {
  configReady: boolean;
  configRequirements: string[];
  toolkitSlug: string;
  managedOAuthSupported: boolean;
} {
  const missing: string[] = [];
  if (!process.env.COMPOSIO_API_KEY?.trim()) {
    missing.push("COMPOSIO_API_KEY");
  }
  const authEnvName =
    provider === "meta_ads"
      ? "COMPOSIO_META_ADS_AUTH_CONFIG_ID"
      : "COMPOSIO_TIKTOK_ADS_AUTH_CONFIG_ID";
  if (!process.env[authEnvName]?.trim()) {
    missing.push(authEnvName);
    if (provider === "meta_ads") {
      const hasClientId = Boolean(process.env.META_ADS_CLIENT_ID?.trim());
      const hasClientSecret = Boolean(process.env.META_ADS_CLIENT_SECRET?.trim());
      if (!hasClientId) {
        missing.push("META_ADS_CLIENT_ID");
      }
      if (!hasClientSecret) {
        missing.push("META_ADS_CLIENT_SECRET");
      }
      if (hasClientId && hasClientSecret) {
        missing.push(
          "Execute POST /api/profiles/{id}/ads/meta_ads/setup para criar/validar a auth config metaads no Composio",
        );
      }
      if (
        !process.env.META_ADS_OAUTH_REDIRECT_URI?.trim() &&
        !process.env.COMPOSIO_META_ADS_REDIRECT_URI?.trim()
      ) {
        missing.push(
          "META_ADS_OAUTH_REDIRECT_URI (opcional; padrão https://backend.composio.dev/api/v3/toolkits/auth/callback)",
        );
      }
    }
  }

  return {
    configReady: missing.length === 0,
    configRequirements: missing,
    toolkitSlug: getAdsToolkitSlug(provider),
    managedOAuthSupported: false,
  };
}

function getComposioClient(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new AdsServiceError(
      "COMPOSIO_API_KEY não configurada no servidor.",
      503
    );
  }
  return new Composio({ apiKey });
}

function unwrapResponseData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const rec = data as Record<string, unknown>;
  if (rec.response_data && typeof rec.response_data === "object") {
    return rec.response_data as Record<string, unknown>;
  }
  if (rec.data && typeof rec.data === "object" && !Array.isArray(rec.data)) {
    return rec.data as Record<string, unknown>;
  }
  return rec;
}

function extractArray(root: Record<string, unknown>, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const val = root[key];
    if (Array.isArray(val)) {
      return val.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    }
  }
  return [];
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export const defaultAdsToolAdapter: AdsToolAdapter = {
  async listAdAccounts({ provider, composioUserId, connectedAccountId }) {
    const client = getComposioClient();
    const toolName =
      provider === "meta_ads"
        ? "METAADS_GET_AD_ACCOUNTS"
        : "TIKTOK_ADS_GET_ADVERTISER_ACCOUNTS";

    const response = await client.tools.execute(toolName, {
      userId: composioUserId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: {},
    });

    if (!response.successful) {
      throw new AdsServiceError(
        response.error || `Falha ao listar contas de anúncios (${provider}).`,
        502
      );
    }

    const root = unwrapResponseData(response.data);
    const items = extractArray(root, ["data", "list", "accounts", "ad_accounts", "advertisers"]);

    const accounts: AdAccountInfo[] = [];
    for (const item of items) {
      const externalId =
        asString(item.id) ||
        asString(item.account_id) ||
        asString(item.advertiser_id);
      if (!externalId) continue;

      const displayName =
        asString(item.name) ||
        asString(item.advertiser_name) ||
        asString(item.account_name) ||
        `Conta ${externalId}`;

      accounts.push({
        externalId,
        displayName,
        currency: asString(item.currency) ?? undefined,
        status: asString(item.account_status) ?? asString(item.status) ?? undefined,
      });
    }
    return accounts;
  },

  async listCampaignsAndMetrics({
    provider,
    composioUserId,
    connectedAccountId,
    adAccountId,
    dateRange,
  }) {
    const client = getComposioClient();

    if (provider === "meta_ads") {
      const campaignsRes = await client.tools.execute("METAADS_LIST_CAMPAIGNS", {
        userId: composioUserId,
        connectedAccountId,
        dangerouslySkipVersionCheck: true,
        arguments: {
          ad_account_id: adAccountId,
          effective_status: [
            "ACTIVE",
            "PAUSED",
            "ARCHIVED",
            "IN_PROCESS",
            "WITH_ISSUES",
          ],
          limit: 50,
        },
      });

      if (!campaignsRes.successful) {
        throw new AdsServiceError(
          campaignsRes.error || "Falha ao listar campanhas do Meta Ads.",
          502
        );
      }

      const insightsArgs: Record<string, unknown> = {
        object_id: adAccountId,
        level: "campaign",
        fields: [
          "impressions",
          "clicks",
          "spend",
          "reach",
          "cpc",
          "cpm",
          "ctr",
          "campaign_name",
          "campaign_id",
          "objective",
          "date_start",
          "date_stop",
        ],
      };
      if (
        dateRange?.datePreset === "custom" &&
        dateRange.since &&
        dateRange.until
      ) {
        insightsArgs.time_range = {
          since: dateRange.since,
          until: dateRange.until,
        };
      } else {
        insightsArgs.date_preset = dateRange?.datePreset ?? "last_30d";
      }

      const insightsRes = await client.tools.execute("METAADS_GET_INSIGHTS", {
        userId: composioUserId,
        connectedAccountId,
        dangerouslySkipVersionCheck: true,
        arguments: insightsArgs,
      });

      const metricsByCampaign = new Map<string, Record<string, unknown>>();
      if (insightsRes.successful) {
        const insightsRoot = unwrapResponseData(insightsRes.data);
        const insightRows = extractArray(insightsRoot, ["data", "insights", "list"]);
        for (const row of insightRows) {
          const cid = asString(row.campaign_id) || asString(row.id);
          if (cid) metricsByCampaign.set(cid, row);
        }
      }

      const campaignsRoot = unwrapResponseData(campaignsRes.data);
      const campaignRows = extractArray(campaignsRoot, ["data", "campaigns", "list"]);

      return campaignRows
        .map((row): AdCampaignView | null => {
          const id = asString(row.id) || asString(row.campaign_id);
          if (!id) return null;
          const insight = metricsByCampaign.get(id);
          return {
            id,
            name: asString(row.name) || `Campanha ${id}`,
            status: asString(row.status) || asString(row.effective_status) || "UNKNOWN",
            objective: asString(row.objective) || "UNKNOWN",
            dailyBudget: asString(row.daily_budget),
            spend: asString(insight?.spend),
            impressions: asString(insight?.impressions),
            clicks: asString(insight?.clicks),
            reach: asString(insight?.reach),
            ctr: asString(insight?.ctr),
            cpc: asString(insight?.cpc),
            cpm: asString(insight?.cpm),
          };
        })
        .filter((c): c is AdCampaignView => c !== null);
    }

    // tiktok_ads
    const campaignsRes = await client.tools.execute("TIKTOK_ADS_LIST_CAMPAIGNS", {
      userId: composioUserId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: {
        advertiser_id: adAccountId,
        page_size: 50,
      },
    });

    if (!campaignsRes.successful) {
      throw new AdsServiceError(
        campaignsRes.error || "Falha ao listar campanhas do TikTok Ads.",
        502
      );
    }

    const reportRes = await client.tools.execute("TIKTOK_ADS_GET_REPORT_INTEGRATED", {
      userId: composioUserId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: {
        advertiser_id: adAccountId,
        report_type: "BASIC",
        data_level: "AUCTION_CAMPAIGN",
        dimensions: ["campaign_id"],
        metrics: ["spend", "impressions", "clicks"],
      },
    });

    const metricsByCampaign = new Map<string, Record<string, unknown>>();
    if (reportRes.successful) {
      const reportRoot = unwrapResponseData(reportRes.data);
      const rows = extractArray(reportRoot, ["list", "data", "rows"]);
      for (const row of rows) {
        const dims = (row.dimensions as Record<string, unknown> | undefined) ?? row;
        const metrics = (row.metrics as Record<string, unknown> | undefined) ?? row;
        const cid = asString(dims.campaign_id);
        if (cid) metricsByCampaign.set(cid, metrics);
      }
    }

    const campaignsRoot = unwrapResponseData(campaignsRes.data);
    const campaignRows = extractArray(campaignsRoot, ["list", "data", "campaigns"]);

    return campaignRows
      .map((row): AdCampaignView | null => {
        const id = asString(row.campaign_id) || asString(row.id);
        if (!id) return null;
        const metrics = metricsByCampaign.get(id);
        return {
          id,
          name: asString(row.campaign_name) || asString(row.name) || `Campanha ${id}`,
          status: asString(row.operation_status) || asString(row.secondary_status) || "UNKNOWN",
          objective: asString(row.objective_type) || asString(row.objective) || "UNKNOWN",
          dailyBudget: asString(row.budget),
          spend: asString(metrics?.spend),
          impressions: asString(metrics?.impressions),
          clicks: asString(metrics?.clicks),
        };
      })
      .filter((c): c is AdCampaignView => c !== null);
  },

  async createPausedCampaign({
    provider,
    composioUserId,
    connectedAccountId,
    adAccountId,
    draft,
  }) {
    const client = getComposioClient();

    if (provider === "meta_ads") {
      const response = await client.tools.execute("METAADS_CREATE_CAMPAIGN", {
        userId: composioUserId,
        connectedAccountId,
        dangerouslySkipVersionCheck: true,
        arguments: {
          ad_account_id: adAccountId,
          name: draft.name,
          objective: draft.objective,
          status: "PAUSED",
          special_ad_categories: [],
        },
      });

      if (!response.successful) {
        throw new AdsServiceError(
          response.error || "Falha ao criar campanha pausada no Meta Ads.",
          502
        );
      }

      const root = unwrapResponseData(response.data);
      const externalCampaignId = asString(root.id) || asString(root.campaign_id);
      if (!externalCampaignId) {
        throw new AdsServiceError(
          "Meta Ads não retornou o ID da campanha criada.",
          502
        );
      }
      return { externalCampaignId };
    }

    // tiktok_ads: always DISABLE initially
    const response = await client.tools.execute("TIKTOK_ADS_CREATE_CAMPAIGN", {
      userId: composioUserId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: {
        advertiser_id: adAccountId,
        campaign_name: draft.name,
        objective_type: draft.objective,
        budget_mode: draft.budgetType === "daily" ? "BUDGET_MODE_DAY" : "BUDGET_MODE_TOTAL",
        budget: draft.budgetAmount,
        operation_status: "DISABLE",
      },
    });

    if (!response.successful) {
      throw new AdsServiceError(
        response.error || "Falha ao criar campanha pausada no TikTok Ads.",
        502
      );
    }

    const root = unwrapResponseData(response.data);
    const externalCampaignId = asString(root.campaign_id) || asString(root.id);
    if (!externalCampaignId) {
      throw new AdsServiceError(
        "TikTok Ads não retornou o ID da campanha criada.",
        502
      );
    }
    return { externalCampaignId };
  },

  async activateCampaign({
    provider,
    composioUserId,
    connectedAccountId,
    adAccountId,
    externalCampaignId,
  }) {
    const client = getComposioClient();

    if (provider === "meta_ads") {
      const response = await client.tools.execute("METAADS_SET_AD_OBJECT_STATUS", {
        userId: composioUserId,
        connectedAccountId,
        dangerouslySkipVersionCheck: true,
        arguments: {
          object_id: externalCampaignId,
          status: "ACTIVE",
        },
      });

      if (!response.successful) {
        throw new AdsServiceError(
          response.error || "Falha ao ativar campanha no Meta Ads.",
          502
        );
      }
      return;
    }

    const response = await client.tools.execute("TIKTOK_ADS_UPDATE_CAMPAIGN_STATUS", {
      userId: composioUserId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: {
        advertiser_id: adAccountId,
        campaign_ids: [externalCampaignId],
        operation_status: "ENABLE",
      },
    });

    if (!response.successful) {
      throw new AdsServiceError(
        response.error || "Falha ao ativar campanha no TikTok Ads.",
        502
      );
    }
  },
};

function requireAuthorizedProfile(profileId: string, ownerId: string) {
  const check = getProfileByIdForOwner(profileId, ownerId);
  if (check.error === "not_found") {
    throw new AdsServiceError("Perfil não encontrado.", 404);
  }
  if (check.error === "forbidden" || !check.profile) {
    throw new AdsServiceError("Acesso negado.", 403);
  }
  return check.profile;
}

function getSocialConnectionRow(
  profileId: string,
  ownerId: string,
  provider: AdsProvider
): SocialConnectionRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, profile_id, owner_id, provider, toolkit_slug, composio_user_id,
              composio_connected_account_id, status, account_label,
              selected_asset_id, selected_asset_name, last_synced_at,
              last_error, updated_at
       FROM social_connections
       WHERE profile_id = ? AND owner_id = ? AND provider = ?`
    )
    .get(profileId, ownerId, provider) as SocialConnectionRow | undefined;
  return row ?? null;
}

function requireConnectedAdsConnection(
  profileId: string,
  ownerId: string,
  provider: AdsProvider
): SocialConnectionRow {
  const row = getSocialConnectionRow(profileId, ownerId, provider);
  if (!row || row.status !== "connected" || !row.composio_connected_account_id) {
    throw new AdsServiceError(
      `Conexão com ${provider === "meta_ads" ? "Meta Ads" : "TikTok Ads"} não está ativa.`,
      409
    );
  }
  const expectedUserId = deriveComposioUserId(ownerId, profileId);
  if (row.composio_user_id !== expectedUserId) {
    throw new AdsServiceError(
      "Conexão inválida para o perfil autorizado.",
      403
    );
  }
  return row;
}

function listAssetsForConnection(connectionId: string): SocialAssetView[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, asset_type, external_id, display_name, is_selected
       FROM social_assets
       WHERE connection_id = ?
       ORDER BY is_selected DESC, display_name ASC`
    )
    .all(connectionId) as Pick<
    SocialAssetRow,
    "id" | "asset_type" | "external_id" | "display_name" | "is_selected"
  >[];

  return rows.map((row) => ({
    id: row.id,
    assetType: row.asset_type,
    externalId: row.external_id,
    displayName: row.display_name,
    isSelected: Boolean(row.is_selected),
  }));
}

function rowToOperationView(row: AdCampaignOperationRow): AdCampaignOperationView {
  let params: AdCampaignOperationView["params"];
  try {
    params = JSON.parse(row.params_json) as AdCampaignOperationView["params"];
  } catch {
    params = {
      name: "",
      objective: "",
      budgetAmount: 0,
      budgetCurrency: "BRL",
      budgetType: "daily",
      startDate: "",
      targetSummary: "",
      creativeHeadline: "",
      destinationUrl: "",
    };
  }

  return {
    id: row.id,
    provider: row.provider,
    adAccountId: row.ad_account_id,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    externalCampaignId: row.external_campaign_id,
    params,
    estimatedBudgetSummary: row.estimated_budget_summary,
    confirmedAt: row.confirmed_at,
    activatedAt: row.activated_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

function listOperationsForProfile(
  profileId: string,
  ownerId: string,
  provider: AdsProvider
): AdCampaignOperationView[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, profile_id, owner_id, provider, ad_account_id, idempotency_key,
              status, external_campaign_id, params_json, estimated_budget_summary,
              confirmed_at, activated_at, last_error, created_at, updated_at
       FROM ad_campaign_operations
       WHERE profile_id = ? AND owner_id = ? AND provider = ?
       ORDER BY created_at DESC
       LIMIT 30`
    )
    .all(profileId, ownerId, provider) as AdCampaignOperationRow[];

  return rows.map(rowToOperationView);
}

function upsertAdAccountAssets(params: {
  connectionId: string;
  profileId: string;
  provider: AdsProvider;
  selectedAssetId: string | null;
  accounts: AdAccountInfo[];
}): SocialAssetView[] {
  const db = getDb();
  const now = new Date().toISOString();
  const assetType = getAdAccountAssetType(params.provider);

  const tx = db.transaction(() => {
    const stmt = db.prepare(
      `INSERT INTO social_assets (
        id, connection_id, profile_id, provider, asset_type, external_id,
        display_name, is_selected, metadata_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(connection_id, asset_type, external_id) DO UPDATE SET
        display_name = excluded.display_name,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at`
    );

    for (const acc of params.accounts) {
      const isSelected = params.selectedAssetId === acc.externalId ? 1 : 0;
      stmt.run(
        crypto.randomUUID(),
        params.connectionId,
        params.profileId,
        params.provider,
        assetType,
        acc.externalId,
        acc.displayName,
        isSelected,
        JSON.stringify({
          currency: acc.currency ?? null,
          status: acc.status ?? null,
        }),
        now
      );
    }
  });

  tx();
  return listAssetsForConnection(params.connectionId);
}

export async function listAdAccountsForOwner(
  params: {
    profileId: string;
    ownerId: string;
    provider: AdsProvider;
  },
  adapter: AdsToolAdapter = defaultAdsToolAdapter
): Promise<SocialAssetView[]> {
  requireAuthorizedProfile(params.profileId, params.ownerId);
  const connection = requireConnectedAdsConnection(
    params.profileId,
    params.ownerId,
    params.provider
  );

  try {
    const accounts = await adapter.listAdAccounts({
      provider: params.provider,
      composioUserId: connection.composio_user_id,
      connectedAccountId: connection.composio_connected_account_id!,
    });

    const assets = upsertAdAccountAssets({
      connectionId: connection.id,
      profileId: params.profileId,
      provider: params.provider,
      selectedAssetId: connection.selected_asset_id,
      accounts,
    });

    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: params.provider,
      action: "ads.list_accounts",
      outcome: "success",
      details: { count: accounts.length },
    });

    return assets;
  } catch (err) {
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: params.provider,
      action: "ads.list_accounts",
      outcome: "error",
      details: { message: err instanceof Error ? err.message : "unknown_error" },
    });
    if (err instanceof AdsServiceError) throw err;
    const mapped = sanitizeAdsErrorMessage(err, `${params.provider}.list_accounts`);
    throw new AdsServiceError(mapped.message, mapped.status);
  }
}

export async function selectAdAccountForOwner(
  params: {
    profileId: string;
    ownerId: string;
    provider: AdsProvider;
    adAccountId: string;
  },
  adapter: AdsToolAdapter = defaultAdsToolAdapter
): Promise<{
  selectedAdAccountId: string;
  selectedAdAccountName: string;
  assets: SocialAssetView[];
}> {
  requireAuthorizedProfile(params.profileId, params.ownerId);
  const connection = requireConnectedAdsConnection(
    params.profileId,
    params.ownerId,
    params.provider
  );

  const adAccountId = typeof params.adAccountId === "string" ? params.adAccountId.trim() : "";
  if (!adAccountId) {
    throw new AdsServiceError("Informe a conta de anúncios para selecionar.", 400, {
      adAccountId: "Conta de anúncios é obrigatória.",
    });
  }

  const db = getDb();
  const assetType = getAdAccountAssetType(params.provider);

  let targetAsset = db
    .prepare(
      `SELECT id, external_id, display_name
       FROM social_assets
       WHERE connection_id = ? AND provider = ? AND asset_type = ? AND external_id = ?`
    )
    .get(connection.id, params.provider, assetType, adAccountId) as
    | { id: string; external_id: string; display_name: string }
    | undefined;

  if (!targetAsset) {
    // Sync accessible accounts from provider to confirm tenant authorization
    await listAdAccountsForOwner(
      {
        profileId: params.profileId,
        ownerId: params.ownerId,
        provider: params.provider,
      },
      adapter
    );

    targetAsset = db
      .prepare(
        `SELECT id, external_id, display_name
         FROM social_assets
         WHERE connection_id = ? AND provider = ? AND asset_type = ? AND external_id = ?`
      )
      .get(connection.id, params.provider, assetType, adAccountId) as
      | { id: string; external_id: string; display_name: string }
      | undefined;
  }

  if (!targetAsset) {
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: params.provider,
      action: "ads.select_account",
      outcome: "rejected",
      details: { adAccountId, reason: "account_not_accessible" },
    });
    throw new AdsServiceError(
      "Conta de anúncios não encontrada ou não autorizada para esta conexão.",
      403
    );
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE social_assets SET is_selected = 0, updated_at = ? WHERE connection_id = ?`
    ).run(now, connection.id);

    db.prepare(
      `UPDATE social_assets SET is_selected = 1, updated_at = ? WHERE id = ?`
    ).run(now, targetAsset.id);

    db.prepare(
      `UPDATE social_connections
       SET selected_asset_id = ?, selected_asset_name = ?, updated_at = ?
       WHERE id = ?`
    ).run(targetAsset.external_id, targetAsset.display_name, now, connection.id);
  });
  tx();

  recordIntegrationAudit({
    profileId: params.profileId,
    ownerId: params.ownerId,
    channel: params.provider,
    action: "ads.select_account",
    outcome: "success",
    details: { adAccountId: targetAsset.external_id },
  });

  return {
    selectedAdAccountId: targetAsset.external_id,
    selectedAdAccountName: targetAsset.display_name,
    assets: listAssetsForConnection(connection.id),
  };
}

function verifyAuthorizedSelectedAdAccount(
  connection: SocialConnectionRow
): string {
  const selectedId = connection.selected_asset_id?.trim();
  if (!selectedId) {
    throw new AdsServiceError(
      "Selecione uma conta de anúncios antes de continuar.",
      409
    );
  }

  const db = getDb();
  const assetType = getAdAccountAssetType(connection.provider);
  const ownedAsset = db
    .prepare(
      `SELECT 1 FROM social_assets
       WHERE connection_id = ? AND profile_id = ? AND provider = ? AND asset_type = ? AND external_id = ?`
    )
    .get(
      connection.id,
      connection.profile_id,
      connection.provider,
      assetType,
      selectedId
    );

  if (!ownedAsset) {
    throw new AdsServiceError(
      "A conta de anúncios selecionada não está autorizada para este perfil.",
      403
    );
  }

  return selectedId;
}

export async function listCampaignsForOwner(
  params: {
    profileId: string;
    ownerId: string;
    provider: AdsProvider;
    dateRange?: AdsDateRangeFilter;
  },
  adapter: AdsToolAdapter = defaultAdsToolAdapter
): Promise<AdCampaignView[]> {
  requireAuthorizedProfile(params.profileId, params.ownerId);
  const connection = requireConnectedAdsConnection(
    params.profileId,
    params.ownerId,
    params.provider
  );
  const adAccountId = verifyAuthorizedSelectedAdAccount(connection);

  try {
    const campaigns = await adapter.listCampaignsAndMetrics({
      provider: params.provider,
      composioUserId: connection.composio_user_id,
      connectedAccountId: connection.composio_connected_account_id!,
      adAccountId,
      dateRange: params.dateRange,
    });

    const now = new Date().toISOString();
    getDb()
      .prepare(`UPDATE social_connections SET last_synced_at = ?, updated_at = ? WHERE id = ?`)
      .run(now, now, connection.id);

    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: params.provider,
      action: "ads.list_campaigns",
      outcome: "success",
      details: { adAccountId, count: campaigns.length },
    });

    return campaigns;
  } catch (err) {
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: params.provider,
      action: "ads.list_campaigns",
      outcome: "error",
      details: {
        adAccountId,
        message: err instanceof Error ? err.message : "unknown_error",
      },
    });
    if (err instanceof AdsServiceError) throw err;
    const mapped = sanitizeAdsErrorMessage(err, `${params.provider}.list_campaigns`);
    throw new AdsServiceError(mapped.message, mapped.status);
  }
}

export async function getAdsOverviewForOwner(
  params: {
    profileId: string;
    ownerId: string;
    provider: AdsProvider;
    sync?: boolean;
    dateRange?: AdsDateRangeFilter;
  },
  adapter: AdsToolAdapter = defaultAdsToolAdapter
): Promise<{
  provider: AdsProvider;
  config: ReturnType<typeof getAdsConfigStatus>;
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
}> {
  requireAuthorizedProfile(params.profileId, params.ownerId);
  const config = getAdsConfigStatus(params.provider);
  const connection = getSocialConnectionRow(
    params.profileId,
    params.ownerId,
    params.provider
  );
  const operations = listOperationsForProfile(
    params.profileId,
    params.ownerId,
    params.provider
  );

  if (!connection) {
    return {
      provider: params.provider,
      config,
      connection: {
        status: config.configReady ? "disconnected" : "pending_config",
        accountLabel: null,
        selectedAdAccountId: null,
        selectedAdAccountName: null,
        lastSyncedAt: null,
        lastError: null,
        updatedAt: null,
      },
      assets: [],
      campaigns: [],
      campaignsError: null,
      operations,
    };
  }

  let assets = listAssetsForConnection(connection.id);
  let campaigns: AdCampaignView[] = [];
  let campaignsError: string | null = null;

  if (connection.status === "connected" && connection.composio_connected_account_id) {
    if (params.sync || assets.length === 0) {
      try {
        assets = await listAdAccountsForOwner(
          {
            profileId: params.profileId,
            ownerId: params.ownerId,
            provider: params.provider,
          },
          adapter
        );
      } catch (err) {
        campaignsError =
          err instanceof AdsServiceError
            ? err.message
            : sanitizeAdsErrorMessage(err, `${params.provider}.overview_accounts`).message;
      }
    }

    if (connection.selected_asset_id) {
      try {
        campaigns = await listCampaignsForOwner(
          {
            profileId: params.profileId,
            ownerId: params.ownerId,
            provider: params.provider,
            dateRange: params.dateRange,
          },
          adapter
        );
      } catch (err) {
        campaignsError =
          err instanceof AdsServiceError
            ? err.message
            : sanitizeAdsErrorMessage(err, `${params.provider}.overview_campaigns`).message;
      }
    }
  }

  return {
    provider: params.provider,
    config,
    connection: {
      status: connection.status,
      accountLabel: connection.account_label,
      selectedAdAccountId: connection.selected_asset_id,
      selectedAdAccountName: connection.selected_asset_name,
      lastSyncedAt: connection.last_synced_at,
      lastError: sanitizeStoredSocialError(connection.last_error),
      updatedAt: connection.updated_at,
    },
    assets,
    campaigns,
    campaignsError,
    operations,
  };
}

function validateHttpsDestinationUrl(rawUrl: unknown): {
  valid: boolean;
  url?: string;
  error?: string;
} {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, error: "Informe a URL de destino (https://)." };
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length > 500) {
    return { valid: false, error: "A URL de destino excede 500 caracteres." };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "URL de destino inválida." };
  }
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "A URL de destino deve usar HTTPS (https://)." };
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { valid: false, error: "Informe um domínio válido para a URL de destino." };
  }
  return { valid: true, url: parsed.toString() };
}

function isValidIsoCalendarDate(dateStr: string): boolean {
  if (!DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function validateCampaignDraftInput(input: Partial<CreateCampaignDraftInput>): {
  valid: boolean;
  errors: ValidationErrors;
  normalized?: AdCampaignOperationView["params"];
  idempotencyKey?: string;
} {
  const errors: ValidationErrors = {};

  const nameRaw = typeof input.name === "string" ? input.name : "";
  const nameCheck = sanitizePlainText(nameRaw, 120);
  if (!nameCheck.value) {
    errors.name = "Informe o nome da campanha.";
  } else if (nameCheck.error) {
    errors.name = nameCheck.error;
  }

  const objectiveRaw = typeof input.objective === "string" ? input.objective.trim().toUpperCase() : "";
  if (!objectiveRaw || !OBJECTIVE_RE.test(objectiveRaw)) {
    errors.objective = "Informe um objetivo de campanha válido (ex.: OUTCOME_TRAFFIC, TRAFFIC).";
  }

  const budgetAmount =
    typeof input.budgetAmount === "number" ? input.budgetAmount : Number(input.budgetAmount);
  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
    errors.budgetAmount = "O orçamento deve ser um valor maior que zero.";
  }

  const budgetType = input.budgetType;
  if (budgetType !== "daily" && budgetType !== "lifetime") {
    errors.budgetType = "Tipo de orçamento deve ser 'daily' (diário) ou 'lifetime' (vitalício).";
  }

  const currency =
    typeof input.budgetCurrency === "string" ? input.budgetCurrency.trim().toUpperCase() : "";
  if (!CURRENCY_RE.test(currency)) {
    errors.budgetCurrency = "Informe uma moeda válida com 3 letras (ex.: BRL, USD).";
  }

  const startDate = typeof input.startDate === "string" ? input.startDate.trim() : "";
  if (!isValidIsoCalendarDate(startDate)) {
    errors.startDate = "Informe a data de início no formato YYYY-MM-DD.";
  }

  const endDate =
    typeof input.endDate === "string" && input.endDate.trim()
      ? input.endDate.trim()
      : undefined;
  if (endDate !== undefined) {
    if (!isValidIsoCalendarDate(endDate)) {
      errors.endDate = "Informe a data de término no formato YYYY-MM-DD.";
    } else if (isValidIsoCalendarDate(startDate) && endDate < startDate) {
      errors.endDate = "A data de término não pode ser anterior à data de início.";
    }
  }

  const targetRaw = typeof input.targetSummary === "string" ? input.targetSummary : "";
  const targetCheck = sanitizePlainText(targetRaw, 300);
  if (!targetCheck.value) {
    errors.targetSummary = "Informe o resumo de público/segmentação.";
  } else if (targetCheck.error) {
    errors.targetSummary = targetCheck.error;
  }

  const headlineRaw = typeof input.creativeHeadline === "string" ? input.creativeHeadline : "";
  const headlineCheck = sanitizePlainText(headlineRaw, 150);
  if (!headlineCheck.value) {
    errors.creativeHeadline = "Informe o título do criativo.";
  } else if (headlineCheck.error) {
    errors.creativeHeadline = headlineCheck.error;
  }

  const urlCheck = validateHttpsDestinationUrl(input.destinationUrl);
  if (!urlCheck.valid || !urlCheck.url) {
    errors.destinationUrl = urlCheck.error || "URL de destino inválida.";
  }

  const idempotencyKey =
    typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";
  if (!IDEMPOTENCY_RE.test(idempotencyKey)) {
    errors.idempotencyKey =
      "Informe uma chave de idempotência válida (8 a 128 caracteres alfanuméricos, '.', '_', ':' ou '-').";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    idempotencyKey,
    normalized: {
      name: nameCheck.value,
      objective: objectiveRaw,
      budgetAmount: Math.round(budgetAmount * 100) / 100,
      budgetCurrency: currency,
      budgetType: budgetType as "daily" | "lifetime",
      startDate,
      ...(endDate ? { endDate } : {}),
      targetSummary: targetCheck.value,
      creativeHeadline: headlineCheck.value,
      destinationUrl: urlCheck.url!,
    },
  };
}

export function createCampaignDraftForOwner(params: {
  profileId: string;
  ownerId: string;
  provider: AdsProvider;
  input: Partial<CreateCampaignDraftInput>;
}): { operation: AdCampaignOperationView; idempotent: boolean } {
  requireAuthorizedProfile(params.profileId, params.ownerId);
  const connection = requireConnectedAdsConnection(
    params.profileId,
    params.ownerId,
    params.provider
  );
  const adAccountId = verifyAuthorizedSelectedAdAccount(connection);

  const validation = validateCampaignDraftInput(params.input);
  if (!validation.valid || !validation.normalized || !validation.idempotencyKey) {
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: params.provider,
      action: "ads.create_draft",
      outcome: "rejected",
      details: { errors: Object.keys(validation.errors) },
    });
    throw new AdsServiceError(
      "Dados inválidos para o rascunho de campanha.",
      422,
      validation.errors
    );
  }

  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id, profile_id, owner_id, provider, ad_account_id, idempotency_key,
              status, external_campaign_id, params_json, estimated_budget_summary,
              confirmed_at, activated_at, last_error, created_at, updated_at
       FROM ad_campaign_operations
       WHERE profile_id = ? AND provider = ? AND idempotency_key = ?`
    )
    .get(params.profileId, params.provider, validation.idempotencyKey) as
    | AdCampaignOperationRow
    | undefined;

  if (existing) {
    return {
      operation: rowToOperationView(existing),
      idempotent: true,
    };
  }

  const { budgetCurrency, budgetAmount, budgetType } = validation.normalized;
  const estimatedBudgetSummary = `${budgetCurrency} ${budgetAmount.toFixed(2)} ${
    budgetType === "daily" ? "/ dia" : "(vitalício)"
  }`;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO ad_campaign_operations (
      id, profile_id, owner_id, provider, ad_account_id, idempotency_key,
      status, external_campaign_id, params_json, estimated_budget_summary,
      confirmed_at, activated_at, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, NULL, NULL, NULL, ?, ?)`
  ).run(
    id,
    params.profileId,
    params.ownerId,
    params.provider,
    adAccountId,
    validation.idempotencyKey,
    JSON.stringify(validation.normalized),
    estimatedBudgetSummary,
    now,
    now
  );

  const created = db
    .prepare(
      `SELECT id, profile_id, owner_id, provider, ad_account_id, idempotency_key,
              status, external_campaign_id, params_json, estimated_budget_summary,
              confirmed_at, activated_at, last_error, created_at, updated_at
       FROM ad_campaign_operations
       WHERE id = ?`
    )
    .get(id) as AdCampaignOperationRow;

  recordIntegrationAudit({
    profileId: params.profileId,
    ownerId: params.ownerId,
    channel: params.provider,
    action: "ads.create_draft",
    outcome: "success",
    details: {
      operationId: id,
      adAccountId,
      objective: validation.normalized.objective,
      estimatedBudgetSummary,
    },
  });

  return {
    operation: rowToOperationView(created),
    idempotent: false,
  };
}

export async function confirmCampaignOperationForOwner(
  params: {
    profileId: string;
    ownerId: string;
    provider: AdsProvider;
    operationId: string;
    action: "create_paused" | "activate";
    confirmed: boolean;
  },
  adapter: AdsToolAdapter = defaultAdsToolAdapter
): Promise<{ operation: AdCampaignOperationView; idempotent: boolean }> {
  requireAuthorizedProfile(params.profileId, params.ownerId);

  if (params.action !== "create_paused" && params.action !== "activate") {
    throw new AdsServiceError(
      "Ação inválida. Use 'create_paused' ou 'activate'.",
      400
    );
  }

  if (params.confirmed !== true) {
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: params.provider,
      action: `ads.${params.action}`,
      outcome: "rejected",
      details: { operationId: params.operationId, reason: "missing_confirmation" },
    });
    throw new AdsServiceError(
      "Confirmação explícita (confirmed: true) é obrigatória antes de criar ou ativar campanha.",
      400
    );
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, profile_id, owner_id, provider, ad_account_id, idempotency_key,
              status, external_campaign_id, params_json, estimated_budget_summary,
              confirmed_at, activated_at, last_error, created_at, updated_at
       FROM ad_campaign_operations
       WHERE id = ? AND profile_id = ? AND owner_id = ? AND provider = ?`
    )
    .get(params.operationId, params.profileId, params.ownerId, params.provider) as
    | AdCampaignOperationRow
    | undefined;

  if (!row) {
    throw new AdsServiceError("Operação de campanha não encontrada.", 404);
  }

  const connection = requireConnectedAdsConnection(
    params.profileId,
    params.ownerId,
    params.provider
  );
  const authorizedAccountId = verifyAuthorizedSelectedAdAccount(connection);
  if (row.ad_account_id !== authorizedAccountId) {
    throw new AdsServiceError(
      "A conta de anúncios da operação não corresponde à conta selecionada e autorizada.",
      403
    );
  }

  if (params.action === "create_paused") {
    if (
      (row.status === "created_paused" || row.status === "active") &&
      row.external_campaign_id
    ) {
      return {
        operation: rowToOperationView(row),
        idempotent: true,
      };
    }

    if (row.status !== "draft" && row.status !== "failed") {
      throw new AdsServiceError(
        `Operação no estado '${row.status}' não pode ser criada novamente.`,
        409
      );
    }

    const opView = rowToOperationView(row);
    const now = new Date().toISOString();

    try {
      const result = await adapter.createPausedCampaign({
        provider: params.provider,
        composioUserId: connection.composio_user_id,
        connectedAccountId: connection.composio_connected_account_id!,
        adAccountId: row.ad_account_id,
        draft: opView.params,
        idempotencyKey: row.idempotency_key,
      });

      db.prepare(
        `UPDATE ad_campaign_operations
         SET status = 'created_paused',
             external_campaign_id = ?,
             confirmed_at = ?,
             last_error = NULL,
             updated_at = ?
         WHERE id = ?`
      ).run(result.externalCampaignId, now, now, row.id);

      const updated = db
        .prepare(
          `SELECT id, profile_id, owner_id, provider, ad_account_id, idempotency_key,
                  status, external_campaign_id, params_json, estimated_budget_summary,
                  confirmed_at, activated_at, last_error, created_at, updated_at
           FROM ad_campaign_operations
           WHERE id = ?`
        )
        .get(row.id) as AdCampaignOperationRow;

      recordIntegrationAudit({
        profileId: params.profileId,
        ownerId: params.ownerId,
        channel: params.provider,
        action: "ads.create_paused",
        outcome: "success",
        details: {
          operationId: row.id,
          adAccountId: row.ad_account_id,
          externalCampaignId: result.externalCampaignId,
          idempotencyKey: row.idempotency_key,
        },
      });

      return {
        operation: rowToOperationView(updated),
        idempotent: false,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao criar campanha pausada.";
      db.prepare(
        `UPDATE ad_campaign_operations
         SET status = 'failed', last_error = ?, updated_at = ?
         WHERE id = ?`
      ).run(errorMessage, now, row.id);

      recordIntegrationAudit({
        profileId: params.profileId,
        ownerId: params.ownerId,
        channel: params.provider,
        action: "ads.create_paused",
        outcome: "error",
        details: {
          operationId: row.id,
          adAccountId: row.ad_account_id,
          message: errorMessage,
        },
      });

      if (err instanceof AdsServiceError) throw err;
      throw new AdsServiceError(errorMessage, 502);
    }
  }

  // action === "activate"
  if (row.status === "active") {
    return {
      operation: rowToOperationView(row),
      idempotent: true,
    };
  }

  if (row.status !== "created_paused" || !row.external_campaign_id) {
    throw new AdsServiceError(
      "A campanha precisa ser criada como pausada antes de ser ativada.",
      409
    );
  }

  const now = new Date().toISOString();
  try {
    await adapter.activateCampaign({
      provider: params.provider,
      composioUserId: connection.composio_user_id,
      connectedAccountId: connection.composio_connected_account_id!,
      adAccountId: row.ad_account_id,
      externalCampaignId: row.external_campaign_id,
    });

    db.prepare(
      `UPDATE ad_campaign_operations
       SET status = 'active',
           activated_at = ?,
           last_error = NULL,
           updated_at = ?
       WHERE id = ?`
    ).run(now, now, row.id);

    const updated = db
      .prepare(
        `SELECT id, profile_id, owner_id, provider, ad_account_id, idempotency_key,
                status, external_campaign_id, params_json, estimated_budget_summary,
                confirmed_at, activated_at, last_error, created_at, updated_at
         FROM ad_campaign_operations
         WHERE id = ?`
      )
      .get(row.id) as AdCampaignOperationRow;

    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: params.provider,
      action: "ads.activate",
      outcome: "success",
      details: {
        operationId: row.id,
        adAccountId: row.ad_account_id,
        externalCampaignId: row.external_campaign_id,
      },
    });

    return {
      operation: rowToOperationView(updated),
      idempotent: false,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Erro ao ativar campanha.";
    db.prepare(
      `UPDATE ad_campaign_operations
       SET last_error = ?, updated_at = ?
       WHERE id = ?`
    ).run(errorMessage, now, row.id);

    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: params.provider,
      action: "ads.activate",
      outcome: "error",
      details: {
        operationId: row.id,
        adAccountId: row.ad_account_id,
        externalCampaignId: row.external_campaign_id,
        message: errorMessage,
      },
    });

    if (err instanceof AdsServiceError) throw err;
    throw new AdsServiceError(errorMessage, 502);
  }
}
