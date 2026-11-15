import crypto from "node:crypto";
import { getDb } from "./db";
import {
  hashOAuthState,
  maskPhoneNumber,
  recordIntegrationAudit,
  requireOwnedProfile,
} from "./integration-audit";
import type {
  WhatsAppCapabilities,
  WhatsAppConnectionStatus,
  WhatsAppConnectionView,
} from "./types";

const DEFAULT_ZERNIO_API_BASE_URL = "https://zernio.com/api";
const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const ZERNIO_HTTP_TIMEOUT_MS = 15_000;
const MAX_WEBHOOK_PAYLOAD_BYTES = 1_048_576; // 1 MB

export const COMPOSIO_WHATSAPP_DISABLED_NOTE =
  "Integração Composio para WhatsApp desabilitada até validação técnica de compatibilidade com contas WABA provisionadas via Zernio.";

export type ZernioMode = "real" | "mock" | "unconfigured";

export class ZernioConfigError extends Error {
  readonly requirements: string[];
  constructor(message: string, requirements: string[] = []) {
    super(message);
    this.name = "ZernioConfigError";
    this.requirements = requirements;
  }
}

export class ZernioProviderError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "ZernioProviderError";
    this.statusCode = statusCode;
  }
}

export class WhatsAppCallbackError extends Error {
  readonly code: string;
  constructor(message: string, code = "callback_error") {
    super(message);
    this.name = "WhatsAppCallbackError";
    this.code = code;
  }
}

export interface ZernioWhatsAppAccount {
  accountId: string;
  zernioProfileId: string;
  status: WhatsAppConnectionStatus;
  wabaId: string | null;
  phoneNumberId: string | null;
  businessId: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  onboardingMode: "business_app" | "api";
  coexistenceConfirmed: boolean;
  migrationStatus: string | null;
  errorReason: string | null;
}

export interface ZernioWhatsAppProvider {
  ensureProfile?(params: {
    profileId: string;
    ownerId: string;
    existingZernioProfileId?: string | null;
    displayName?: string | null;
    slug?: string | null;
  }): Promise<string>;

  getConnectUrl(params: {
    zernioProfileId: string;
    redirectUrl: string;
    state: string;
    onboardingMode: "business_app" | "api";
    origin: string;
  }): Promise<{
    redirectUrl: string;
    isMock: boolean;
  }>;

  completeEmbeddedSignup(params: {
    zernioProfileId: string;
    action: "embedded_signup" | "select_phone_number";
    code?: string;
    wabaId?: string;
    phoneNumberId?: string;
    businessId?: string;
  }): Promise<ZernioWhatsAppAccount | null>;

  verifyAccount(params: {
    zernioProfileId: string;
    accountId?: string | null;
  }): Promise<ZernioWhatsAppAccount | null>;
}

interface WhatsAppConnectionRow {
  id: string;
  profile_id: string;
  owner_id: string;
  provider: "zernio";
  zernio_profile_id: string;
  provider_account_id: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
  business_id: string | null;
  masked_phone: string | null;
  display_name: string | null;
  onboarding_mode: "business_app" | "api";
  status: WhatsAppConnectionStatus;
  capabilities_json: string;
  composio_status: "disabled_pending_validation";
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

interface WhatsAppAttemptRow {
  state_hash: string;
  profile_id: string;
  owner_id: string;
  zernio_profile_id: string;
  status: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export function getZernioApiBaseUrl(): string {
  const raw = process.env.ZERNIO_API_BASE_URL?.trim() || DEFAULT_ZERNIO_API_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export function isZernioLocalMockAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ZERNIO_ALLOW_LOCAL_MOCK === "true"
  );
}

export function getZernioConfigStatus(): {
  mode: ZernioMode;
  configReady: boolean;
  configRequirements: string[];
} {
  const apiKey = process.env.ZERNIO_API_KEY?.trim();
  const webhookSecret = process.env.ZERNIO_WEBHOOK_SECRET?.trim();

  if (apiKey) {
    return {
      mode: "real",
      configReady: true,
      configRequirements: [],
    };
  }

  if (isZernioLocalMockAllowed()) {
    return {
      mode: "mock",
      configReady: true,
      configRequirements: [],
    };
  }

  const requirements = [
    "ZERNIO_API_KEY: defina a chave de API server-side da Zernio.",
  ];
  if (!webhookSecret) {
    requirements.push(
      "ZERNIO_WEBHOOK_SECRET: defina o segredo HMAC-SHA256 para validar webhooks da Zernio."
    );
  }

  return {
    mode: "unconfigured",
    configReady: false,
    configRequirements: requirements,
  };
}

export function buildZernioProfileId(ownerId: string, profileId: string): string {
  return `linkia_u_${ownerId}_p_${profileId}`;
}

export function isValidZernioObjectId(value: string | null | undefined): boolean {
  return Boolean(value && /^[a-f0-9]{24}$/i.test(value.trim()));
}

function mapZernioHttpError(params: {
  status: number;
  bodyText: string;
  requestId: string | null;
  context: string;
}): ZernioProviderError {
  let parsed: Record<string, unknown> = {};
  try {
    const json = JSON.parse(params.bodyText);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      parsed = json as Record<string, unknown>;
    }
  } catch {
    // non-JSON response
  }

  const code = typeof parsed.code === "string" ? parsed.code.trim() : "";
  const type = typeof parsed.type === "string" ? parsed.type.trim() : "";
  const param = typeof parsed.param === "string" ? parsed.param.trim() : "";
  const rawError =
    typeof parsed.error === "string"
      ? parsed.error.trim()
      : typeof parsed.message === "string"
        ? parsed.message.trim()
        : "";
  const combined = `${code} ${type} ${param} ${rawError}`.toLowerCase();

  console.error("[Zernio]", {
    context: params.context,
    status: params.status,
    requestId: params.requestId,
    code: code || undefined,
    type: type || undefined,
    param: param || undefined,
    error: rawError ? rawError.slice(0, 240) : undefined,
  });

  if (params.status === 401 || params.status === 403) {
    return new ZernioProviderError(
      "Credencial da Zernio inválida ou sem permissão para conectar o WhatsApp.",
      502
    );
  }

  if (params.status === 402) {
    return new ZernioProviderError(
      "A conta Zernio precisa de configuração de cobrança ou plano ativo para conectar o WhatsApp.",
      402
    );
  }

  if (params.status === 404) {
    return new ZernioProviderError(
      "O perfil de conexão da Zernio não foi localizado. Verifique a configuração da conta.",
      404
    );
  }

  if (
    param === "redirect_url" ||
    combined.includes("redirect_url") ||
    combined.includes("redirect url")
  ) {
    return new ZernioProviderError(
      "A URL de retorno (callback) precisa ser absoluta e estar configurada corretamente.",
      400
    );
  }

  if (
    combined.includes("one_whatsapp_per_profile") ||
    combined.includes("whatsapp_number_already_connected") ||
    combined.includes("whatsapp_number_pinned_to_profile")
  ) {
    return new ZernioProviderError(
      "Este número de WhatsApp já está vinculado a uma conexão existente na Zernio. Reutilize ou desvincule a conexão anterior antes de tentar novamente.",
      409
    );
  }

  if (params.status >= 500) {
    return new ZernioProviderError(
      `A Zernio retornou erro temporário (${params.status}) ao comunicar com o serviço.`,
      502
    );
  }

  return new ZernioProviderError(
    "Não foi possível iniciar a conexão do WhatsApp Business na Zernio. Tente novamente.",
    400
  );
}

const ALLOWED_ZERNIO_EXACT_HOSTS = new Set([
  "zernio.com",
  "facebook.com",
  "business.facebook.com",
]);

const ALLOWED_ZERNIO_SUFFIXES = [".zernio.com", ".facebook.com"];

export function isAllowedZernioRedirectUrl(
  rawUrl: string,
  options: { allowLocalMock?: boolean } = {}
): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();

  if (options.allowLocalMock && trimmed.startsWith("/oauth-mock")) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (options.allowLocalMock && parsed.pathname.startsWith("/oauth-mock")) {
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  const host = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (ALLOWED_ZERNIO_EXACT_HOSTS.has(host)) {
    return true;
  }

  return ALLOWED_ZERNIO_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function buildCapabilities(params: {
  status: WhatsAppConnectionStatus;
  coexistenceConfirmed: boolean;
}): WhatsAppCapabilities {
  if (params.status !== "connected") {
    return {
      coexistenceConfirmed: false,
      messagingSupported: false,
      templatesSupported: false,
      groupsApiSupported: false,
      note:
        params.status === "ineligible"
          ? "Número inelegível ou em migração incompatível para coexistência."
          : "Conecte um número WhatsApp Business elegível para habilitar recursos.",
    };
  }

  return {
    coexistenceConfirmed: params.coexistenceConfirmed,
    messagingSupported: true,
    templatesSupported: true,
    groupsApiSupported: params.coexistenceConfirmed ? false : false,
    note: params.coexistenceConfirmed
      ? "Modo coexistência ativo: o WhatsApp Business App continua operando no celular. Grupos via API não são suportados em números coexistentes."
      : "Conexão Cloud API ativa.",
  };
}

function parseCapabilities(
  rawJson: string | null | undefined,
  status: WhatsAppConnectionStatus
): WhatsAppCapabilities {
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Partial<WhatsAppCapabilities>;
      if (typeof parsed.coexistenceConfirmed === "boolean") {
        return {
          coexistenceConfirmed: parsed.coexistenceConfirmed,
          messagingSupported: Boolean(parsed.messagingSupported),
          templatesSupported: Boolean(parsed.templatesSupported),
          groupsApiSupported: Boolean(parsed.groupsApiSupported),
          note: typeof parsed.note === "string" ? parsed.note : undefined,
        };
      }
    } catch {
      // Fallback to status-derived capabilities
    }
  }
  return buildCapabilities({ status, coexistenceConfirmed: false });
}

function mapZernioAccountPayload(
  raw: Record<string, unknown>,
  fallbackProfileId: string
): ZernioWhatsAppAccount {
  const metadata =
    raw.metadata && typeof raw.metadata === "object"
      ? (raw.metadata as Record<string, unknown>)
      : {};

  const accountId = String(
    raw.id ?? raw._id ?? raw.accountId ?? raw.account_id ?? ""
  ).trim();

  const zernioProfileId = String(
    raw.profileId ?? raw.profile_id ?? fallbackProfileId
  ).trim();

  const rawStatus = String(raw.status ?? raw.connectionStatus ?? "")
    .trim()
    .toLowerCase();

  const migrationStatus =
    typeof (raw.migrationStatus ?? raw.migration_status ?? metadata.migrationStatus) ===
    "string"
      ? String(raw.migrationStatus ?? raw.migration_status ?? metadata.migrationStatus)
      : null;

  const onboardingRaw = String(
    raw.onboarding ??
      raw.onboardingMode ??
      raw.onboarding_mode ??
      metadata.onboardingMode ??
      "business_app"
  )
    .trim()
    .toLowerCase();

  const onboardingMode: "business_app" | "api" =
    onboardingRaw === "api" ? "api" : "business_app";

  const coexistenceFlag =
    raw.coexistence === true ||
    raw.isCoexistence === true ||
    raw.coexistenceConfirmed === true ||
    metadata.coexistence === true ||
    (onboardingMode === "business_app" &&
      (rawStatus === "connected" || rawStatus === "active"));

  let status: WhatsAppConnectionStatus = "incomplete";
  if (migrationStatus?.toUpperCase() === "ON_PREMISE") {
    status = "ineligible";
  } else if (
    rawStatus === "connected" ||
    rawStatus === "active" ||
    rawStatus === "ready"
  ) {
    status = "connected";
  } else if (rawStatus === "ineligible" || rawStatus === "unsupported") {
    status = "ineligible";
  } else if (rawStatus === "expired") {
    status = "expired";
  } else if (rawStatus === "failed" || rawStatus === "error") {
    status = "failed";
  } else if (rawStatus === "disconnected" || rawStatus === "revoked") {
    status = "disconnected";
  } else if (rawStatus === "connecting" || rawStatus === "pending") {
    status = "connecting";
  }

  const wabaId =
    raw.wabaId ?? raw.waba_id ?? metadata.wabaId ?? metadata.waba_id ?? null;
  const phoneNumberId =
    raw.phoneNumberId ??
    raw.phone_number_id ??
    metadata.phoneNumberId ??
    metadata.phone_number_id ??
    null;
  const businessId =
    raw.businessId ??
    raw.business_id ??
    metadata.businessId ??
    metadata.business_id ??
    null;
  const phoneNumber =
    raw.phoneNumber ??
    raw.phone_number ??
    raw.displayPhoneNumber ??
    metadata.phoneNumber ??
    null;
  const displayName =
    raw.displayName ??
    raw.display_name ??
    raw.verifiedName ??
    raw.name ??
    metadata.displayName ??
    null;

  return {
    accountId,
    zernioProfileId,
    status,
    wabaId: wabaId ? String(wabaId) : null,
    phoneNumberId: phoneNumberId ? String(phoneNumberId) : null,
    businessId: businessId ? String(businessId) : null,
    phoneNumber: phoneNumber ? String(phoneNumber) : null,
    displayName: displayName ? String(displayName) : null,
    onboardingMode,
    coexistenceConfirmed: status === "connected" && Boolean(coexistenceFlag),
    migrationStatus,
    errorReason:
      typeof raw.error === "string"
        ? raw.error
        : typeof raw.errorMessage === "string"
          ? raw.errorMessage
          : null,
  };
}

class DefaultZernioWhatsAppProvider implements ZernioWhatsAppProvider {
  async ensureProfile(params: {
    profileId: string;
    ownerId: string;
    existingZernioProfileId?: string | null;
    displayName?: string | null;
    slug?: string | null;
  }): Promise<string> {
    const config = getZernioConfigStatus();
    if (!config.configReady) {
      throw new ZernioConfigError(
        "Integração Zernio WhatsApp não configurada no servidor.",
        config.configRequirements
      );
    }

    const externalId = buildZernioProfileId(params.ownerId, params.profileId);

    if (config.mode === "mock") {
      return params.existingZernioProfileId?.trim() || externalId;
    }

    if (isValidZernioObjectId(params.existingZernioProfileId)) {
      return params.existingZernioProfileId!.trim();
    }

    const apiKey = process.env.ZERNIO_API_KEY!.trim();
    const baseUrl = getZernioApiBaseUrl();

    const findExistingProfile = async (): Promise<string | null> => {
      let listRes: Response;
      try {
        listRes = await fetch(`${baseUrl}/v1/profiles`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(ZERNIO_HTTP_TIMEOUT_MS),
        });
      } catch {
        throw new ZernioProviderError(
          "Não foi possível conectar ao serviço da Zernio no momento. Tente novamente.",
          502
        );
      }

      if (!listRes.ok) {
        const errText = await listRes.text().catch(() => "");
        throw mapZernioHttpError({
          status: listRes.status,
          bodyText: errText,
          requestId:
            listRes.headers.get("x-request-id") ??
            listRes.headers.get("x-correlation-id"),
          context: "list_profiles",
        });
      }

      const data = (await listRes.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.profiles)
          ? data.profiles
          : Array.isArray(data.data)
            ? data.data
            : [];

      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const id = typeof rec._id === "string" ? rec._id : typeof rec.id === "string" ? rec.id : "";
        if (!isValidZernioObjectId(id)) continue;
        if (rec.externalId === externalId) {
          return id.trim();
        }
      }
      return null;
    };

    const existingId = await findExistingProfile();
    if (existingId) {
      return existingId;
    }

    const cleanLabel = (params.displayName || params.slug || "Perfil")
      .trim()
      .slice(0, 40);
    const uniqueName = `LinkIA ${cleanLabel} (${params.profileId.slice(0, 8)})`;

    let createRes: Response;
    try {
      createRes = await fetch(`${baseUrl}/v1/profiles`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": `linkia-profile-${params.profileId}`,
        },
        body: JSON.stringify({
          name: uniqueName,
          description: "Perfil LinkIA WhatsApp Business",
          externalId,
        }),
        signal: AbortSignal.timeout(ZERNIO_HTTP_TIMEOUT_MS),
      });
    } catch {
      throw new ZernioProviderError(
        "Não foi possível conectar ao serviço da Zernio no momento. Tente novamente.",
        502
      );
    }

    const createText = await createRes.text().catch(() => "");
    let createJson: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(createText);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        createJson = parsed as Record<string, unknown>;
      }
    } catch {
      // non-JSON
    }

    if (createRes.status === 409) {
      const details =
        createJson.details && typeof createJson.details === "object"
          ? (createJson.details as Record<string, unknown>)
          : {};
      const conflictId =
        typeof details.existingProfileId === "string"
          ? details.existingProfileId
          : null;
      if (isValidZernioObjectId(conflictId)) {
        return conflictId!.trim();
      }
      const recovered = await findExistingProfile();
      if (recovered) {
        return recovered;
      }
    }

    if (!createRes.ok) {
      throw mapZernioHttpError({
        status: createRes.status,
        bodyText: createText,
        requestId:
          createRes.headers.get("x-request-id") ??
          createRes.headers.get("x-correlation-id"),
        context: "create_profile",
      });
    }

    const profileObj =
      createJson.profile && typeof createJson.profile === "object"
        ? (createJson.profile as Record<string, unknown>)
        : createJson;
    const createdId =
      typeof profileObj._id === "string"
        ? profileObj._id
        : typeof profileObj.id === "string"
          ? profileObj.id
          : "";

    if (!isValidZernioObjectId(createdId)) {
      throw new ZernioProviderError(
        "A Zernio não retornou um identificador válido de perfil.",
        502
      );
    }

    return createdId.trim();
  }

  async getConnectUrl(params: {
    zernioProfileId: string;
    redirectUrl: string;
    state: string;
    onboardingMode: "business_app" | "api";
    origin: string;
  }): Promise<{ redirectUrl: string; isMock: boolean }> {
    const config = getZernioConfigStatus();
    if (!config.configReady) {
      throw new ZernioConfigError(
        "Integração Zernio WhatsApp não configurada no servidor.",
        config.configRequirements
      );
    }

    if (config.mode === "mock") {
      const mockUrl = new URL("/oauth-mock", params.origin);
      mockUrl.searchParams.set("provider", "whatsapp");
      mockUrl.searchParams.set("state", params.state);
      return {
        redirectUrl: mockUrl.toString(),
        isMock: true,
      };
    }

    const apiKey = process.env.ZERNIO_API_KEY!.trim();
    const baseUrl = getZernioApiBaseUrl();
    const endpoint = new URL(`${baseUrl}/v1/connect/whatsapp`);
    endpoint.searchParams.set("profileId", params.zernioProfileId);
    endpoint.searchParams.set("redirect_url", params.redirectUrl);
    endpoint.searchParams.set("onboarding", params.onboardingMode);

    let response: Response;
    try {
      response = await fetch(endpoint.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(ZERNIO_HTTP_TIMEOUT_MS),
      });
    } catch {
      throw new ZernioProviderError(
        "Não foi possível conectar ao serviço da Zernio no momento. Tente novamente."
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw mapZernioHttpError({
        status: response.status,
        bodyText: errorText,
        requestId:
          response.headers.get("x-request-id") ??
          response.headers.get("x-correlation-id"),
        context: "connect_whatsapp",
      });
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const candidateUrl = String(
      payload.authUrl ??
        payload.url ??
        payload.redirectUrl ??
        payload.redirect_url ??
        payload.connectUrl ??
        ""
    ).trim();

    if (!isAllowedZernioRedirectUrl(candidateUrl, { allowLocalMock: false })) {
      throw new ZernioProviderError(
        "URL de redirecionamento retornada pela Zernio não pertence à allowlist HTTPS permitida."
      );
    }

    return {
      redirectUrl: candidateUrl,
      isMock: false,
    };
  }

  async completeEmbeddedSignup(params: {
    zernioProfileId: string;
    action: "embedded_signup" | "select_phone_number";
    code?: string;
    wabaId?: string;
    phoneNumberId?: string;
    businessId?: string;
  }): Promise<ZernioWhatsAppAccount | null> {
    const config = getZernioConfigStatus();
    if (!config.configReady) {
      throw new ZernioConfigError(
        "Integração Zernio WhatsApp não configurada no servidor.",
        config.configRequirements
      );
    }

    if (config.mode === "mock") {
      return {
        accountId: `mock_wa_acc_${params.zernioProfileId}`,
        zernioProfileId: params.zernioProfileId,
        status: "connected",
        wabaId: params.wabaId ?? "mock_waba_1001",
        phoneNumberId: params.phoneNumberId ?? "mock_phone_2002",
        businessId: params.businessId ?? "mock_biz_3003",
        phoneNumber: "+55 11 99999-1234",
        displayName: "WhatsApp Business (Simulação)",
        onboardingMode: "business_app",
        coexistenceConfirmed: true,
        migrationStatus: null,
        errorReason: null,
      };
    }

    const apiKey = process.env.ZERNIO_API_KEY!.trim();
    const baseUrl = getZernioApiBaseUrl();
    const pathSegment =
      params.action === "select_phone_number"
        ? "/v1/connect/whatsapp/select-phone-number"
        : "/v1/connect/whatsapp/embedded-signup";

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${pathSegment}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          profileId: params.zernioProfileId,
          code: params.code,
          wabaId: params.wabaId,
          phoneNumberId: params.phoneNumberId,
          businessId: params.businessId,
          onboarding: "business_app",
        }),
        signal: AbortSignal.timeout(ZERNIO_HTTP_TIMEOUT_MS),
      });
    } catch {
      throw new ZernioProviderError(
        "Falha de comunicação ao finalizar onboarding WhatsApp na Zernio."
      );
    }

    if (!response.ok) {
      throw new ZernioProviderError(
        `A Zernio retornou erro (${response.status}) ao finalizar o onboarding WhatsApp.`,
        response.status >= 500 ? 502 : 400
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const accountObj =
      payload.account && typeof payload.account === "object"
        ? (payload.account as Record<string, unknown>)
        : payload;

    return mapZernioAccountPayload(accountObj, params.zernioProfileId);
  }

  async verifyAccount(params: {
    zernioProfileId: string;
    accountId?: string | null;
  }): Promise<ZernioWhatsAppAccount | null> {
    const config = getZernioConfigStatus();
    if (!config.configReady) {
      throw new ZernioConfigError(
        "Integração Zernio WhatsApp não configurada no servidor.",
        config.configRequirements
      );
    }

    if (config.mode === "mock") {
      return {
        accountId: params.accountId || `mock_wa_acc_${params.zernioProfileId}`,
        zernioProfileId: params.zernioProfileId,
        status: "connected",
        wabaId: "mock_waba_1001",
        phoneNumberId: "mock_phone_2002",
        businessId: "mock_biz_3003",
        phoneNumber: "+55 11 99999-1234",
        displayName: "WhatsApp Business (Simulação)",
        onboardingMode: "business_app",
        coexistenceConfirmed: true,
        migrationStatus: null,
        errorReason: null,
      };
    }

    const apiKey = process.env.ZERNIO_API_KEY!.trim();
    const baseUrl = getZernioApiBaseUrl();

    if (params.accountId) {
      let response: Response;
      try {
        response = await fetch(
          `${baseUrl}/v1/accounts/${encodeURIComponent(params.accountId)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(ZERNIO_HTTP_TIMEOUT_MS),
          }
        );
      } catch {
        throw new ZernioProviderError(
          "Falha de comunicação ao verificar conta WhatsApp na Zernio."
        );
      }

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        const accountObj =
          data.account && typeof data.account === "object"
            ? (data.account as Record<string, unknown>)
            : data;
        const mapped = mapZernioAccountPayload(accountObj, params.zernioProfileId);
        if (mapped.zernioProfileId === params.zernioProfileId) {
          return mapped;
        }
      } else if (response.status >= 500) {
        throw new ZernioProviderError(
          `Erro (${response.status}) ao consultar conta na Zernio.`
        );
      }
    }

    const listUrl = new URL(`${baseUrl}/v1/accounts`);
    listUrl.searchParams.set("profileId", params.zernioProfileId);
    listUrl.searchParams.set("platform", "whatsapp");

    let listResponse: Response;
    try {
      listResponse = await fetch(listUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(ZERNIO_HTTP_TIMEOUT_MS),
      });
    } catch {
      throw new ZernioProviderError(
        "Falha de comunicação ao listar contas WhatsApp na Zernio."
      );
    }

    if (!listResponse.ok) {
      throw new ZernioProviderError(
        `A Zernio retornou erro (${listResponse.status}) ao consultar contas.`,
        listResponse.status >= 500 ? 502 : 400
      );
    }

    const listData = (await listResponse.json()) as Record<string, unknown>;
    const items = Array.isArray(listData.accounts)
      ? listData.accounts
      : Array.isArray(listData.data)
        ? listData.data
        : Array.isArray(listData)
          ? listData
          : [];

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const rawItem = item as Record<string, unknown>;
      const platform = String(rawItem.platform ?? "whatsapp").toLowerCase();
      if (platform !== "whatsapp") continue;

      const mapped = mapZernioAccountPayload(rawItem, params.zernioProfileId);
      if (mapped.zernioProfileId === params.zernioProfileId) {
        return mapped;
      }
    }

    return null;
  }
}

let activeProvider: ZernioWhatsAppProvider = new DefaultZernioWhatsAppProvider();

export function setZernioWhatsAppProvider(
  provider: ZernioWhatsAppProvider
): void {
  activeProvider = provider;
}

export function resetZernioWhatsAppProvider(): void {
  activeProvider = new DefaultZernioWhatsAppProvider();
}

export function getZernioWhatsAppProvider(): ZernioWhatsAppProvider {
  return activeProvider;
}

export function getWhatsAppConnectionView(
  profileId: string
): WhatsAppConnectionView {
  const config = getZernioConfigStatus();
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM whatsapp_connections WHERE profile_id = ?")
    .get(profileId) as WhatsAppConnectionRow | undefined;

  if (!row) {
    const status: WhatsAppConnectionStatus = config.configReady
      ? "disconnected"
      : "pending_config";

    return {
      provider: "zernio",
      status,
      configReady: config.configReady,
      configRequirements: config.configRequirements,
      onboardingMode: "business_app",
      maskedPhone: null,
      displayName: null,
      hasWaba: false,
      hasPhoneNumberId: false,
      capabilities: buildCapabilities({ status, coexistenceConfirmed: false }),
      composioStatus: "disabled_pending_validation",
      composioNote: COMPOSIO_WHATSAPP_DISABLED_NOTE,
      lastVerifiedAt: null,
      lastError: null,
      updatedAt: null,
    };
  }

  const effectiveStatus: WhatsAppConnectionStatus =
    !config.configReady && row.status === "disconnected"
      ? "pending_config"
      : row.status;

  return {
    provider: "zernio",
    status: effectiveStatus,
    configReady: config.configReady,
    configRequirements: config.configRequirements,
    onboardingMode: row.onboarding_mode,
    maskedPhone: row.masked_phone,
    displayName: row.display_name,
    hasWaba: Boolean(row.waba_id),
    hasPhoneNumberId: Boolean(row.phone_number_id),
    capabilities: parseCapabilities(row.capabilities_json, effectiveStatus),
    composioStatus: "disabled_pending_validation",
    composioNote: COMPOSIO_WHATSAPP_DISABLED_NOTE,
    lastVerifiedAt: row.last_verified_at,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

function upsertWhatsAppConnectionRow(params: {
  profileId: string;
  ownerId: string;
  zernioProfileId: string;
  providerAccountId?: string | null;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  businessId?: string | null;
  maskedPhone?: string | null;
  displayName?: string | null;
  onboardingMode?: "business_app" | "api";
  status: WhatsAppConnectionStatus;
  capabilities?: WhatsAppCapabilities;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  revokedAt?: string | null;
}): void {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT * FROM whatsapp_connections WHERE profile_id = ?")
    .get(params.profileId) as WhatsAppConnectionRow | undefined;

  const capabilities =
    params.capabilities ??
    buildCapabilities({ status: params.status, coexistenceConfirmed: false });

  if (!existing) {
    db.prepare(
      `INSERT INTO whatsapp_connections (
        id, profile_id, owner_id, provider, zernio_profile_id,
        provider_account_id, waba_id, phone_number_id, business_id,
        masked_phone, display_name, onboarding_mode, status,
        capabilities_json, composio_status, last_verified_at, last_error,
        created_at, updated_at, revoked_at
      ) VALUES (?, ?, ?, 'zernio', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disabled_pending_validation', ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      params.profileId,
      params.ownerId,
      params.zernioProfileId,
      params.providerAccountId ?? null,
      params.wabaId ?? null,
      params.phoneNumberId ?? null,
      params.businessId ?? null,
      params.maskedPhone ?? null,
      params.displayName ?? null,
      params.onboardingMode ?? "business_app",
      params.status,
      JSON.stringify(capabilities),
      params.lastVerifiedAt ?? null,
      params.lastError ?? null,
      now,
      now,
      params.revokedAt ?? null
    );
    return;
  }

  db.prepare(
    `UPDATE whatsapp_connections
     SET owner_id = ?,
         zernio_profile_id = ?,
         provider_account_id = COALESCE(?, provider_account_id),
         waba_id = COALESCE(?, waba_id),
         phone_number_id = COALESCE(?, phone_number_id),
         business_id = COALESCE(?, business_id),
         masked_phone = COALESCE(?, masked_phone),
         display_name = COALESCE(?, display_name),
         onboarding_mode = ?,
         status = ?,
         capabilities_json = ?,
         composio_status = 'disabled_pending_validation',
         last_verified_at = COALESCE(?, last_verified_at),
         last_error = ?,
         updated_at = ?,
         revoked_at = ?
     WHERE profile_id = ?`
  ).run(
    params.ownerId,
    params.zernioProfileId,
    params.providerAccountId ?? null,
    params.wabaId ?? null,
    params.phoneNumberId ?? null,
    params.businessId ?? null,
    params.maskedPhone ?? null,
    params.displayName ?? null,
    params.onboardingMode ?? existing.onboarding_mode,
    params.status,
    JSON.stringify(capabilities),
    params.lastVerifiedAt ?? null,
    params.lastError ?? null,
    now,
    params.revokedAt ?? null,
    params.profileId
  );
}

export async function initiateWhatsAppConnection(params: {
  profileId: string;
  ownerId: string;
  origin: string;
  onboardingMode?: "business_app" | "api";
}): Promise<{
  redirectUrl: string;
  attemptId: string;
  isMock: boolean;
  connection: WhatsAppConnectionView;
}> {
  const config = getZernioConfigStatus();
  if (!config.configReady) {
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "connect_initiate",
      outcome: "rejected",
      details: { reason: "pending_config" },
    });
    throw new ZernioConfigError(
      "Integração WhatsApp via Zernio pendente de configuração no servidor.",
      config.configRequirements
    );
  }

  if (!requireOwnedProfile(params.profileId, params.ownerId)) {
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "connect_initiate",
      outcome: "rejected",
      details: { reason: "forbidden_profile" },
    });
    throw new ZernioProviderError("Perfil não encontrado ou sem permissão.");
  }

  const db = getDb();
  const profileMeta = db
    .prepare("SELECT display_name, slug FROM profiles WHERE id = ? AND owner_id = ?")
    .get(params.profileId, params.ownerId) as
    | { display_name?: string; slug?: string }
    | undefined;
  const existingConn = db
    .prepare("SELECT zernio_profile_id FROM whatsapp_connections WHERE profile_id = ?")
    .get(params.profileId) as { zernio_profile_id?: string } | undefined;

  const provider = getZernioWhatsAppProvider();
  const zernioProfileId = provider.ensureProfile
    ? await provider.ensureProfile({
        profileId: params.profileId,
        ownerId: params.ownerId,
        existingZernioProfileId: existingConn?.zernio_profile_id ?? null,
        displayName: profileMeta?.display_name ?? null,
        slug: profileMeta?.slug ?? null,
      })
    : existingConn?.zernio_profile_id?.trim() ||
      buildZernioProfileId(params.ownerId, params.profileId);

  const rawState = crypto.randomBytes(32).toString("hex");
  const stateHash = hashOAuthState(rawState);
  const attemptId = stateHash.slice(0, 16);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + STATE_TTL_MS).toISOString();
  const onboardingMode = params.onboardingMode ?? "business_app";

  const callbackUrl = new URL("/api/integrations/whatsapp/callback", params.origin);
  callbackUrl.searchParams.set("state", rawState);

  const connectResult = await provider.getConnectUrl({
    zernioProfileId,
    redirectUrl: callbackUrl.toString(),
    state: rawState,
    onboardingMode,
    origin: params.origin,
  });

  if (
    !isAllowedZernioRedirectUrl(connectResult.redirectUrl, {
      allowLocalMock: connectResult.isMock && isZernioLocalMockAllowed(),
    })
  ) {
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "connect_initiate",
      outcome: "rejected",
      details: { reason: "disallowed_redirect_url" },
    });
    throw new ZernioProviderError(
      "URL de redirecionamento retornada pelo provedor não é permitida."
    );
  }

  db.prepare(
    `INSERT INTO whatsapp_connection_attempts (
      state_hash, profile_id, owner_id, zernio_profile_id, status, expires_at, created_at
    ) VALUES (?, ?, ?, ?, 'initiated', ?, ?)`
  ).run(
    stateHash,
    params.profileId,
    params.ownerId,
    zernioProfileId,
    expiresAt,
    now.toISOString()
  );

  upsertWhatsAppConnectionRow({
    profileId: params.profileId,
    ownerId: params.ownerId,
    zernioProfileId,
    onboardingMode,
    status: "connecting",
    lastError: null,
    revokedAt: null,
  });

  recordIntegrationAudit({
    profileId: params.profileId,
    ownerId: params.ownerId,
    channel: "whatsapp_zernio",
    action: "connect_initiate",
    outcome: "success",
    details: {
      onboardingMode,
      isMock: connectResult.isMock,
    },
  });

  return {
    redirectUrl: connectResult.redirectUrl,
    attemptId,
    isMock: connectResult.isMock,
    connection: getWhatsAppConnectionView(params.profileId),
  };
}

export async function finalizeWhatsAppEmbeddedSignup(params: {
  profileId: string;
  ownerId: string;
  action: "embedded_signup" | "select_phone_number";
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
}): Promise<WhatsAppConnectionView> {
  const zernioProfileId = buildZernioProfileId(params.ownerId, params.profileId);
  const provider = getZernioWhatsAppProvider();

  const account = await provider.completeEmbeddedSignup({
    zernioProfileId,
    action: params.action,
    code: params.code,
    wabaId: params.wabaId,
    phoneNumberId: params.phoneNumberId,
    businessId: params.businessId,
  });

  if (!account) {
    throw new ZernioProviderError(
      "Não foi possível confirmar a conta WhatsApp após o Embedded Signup."
    );
  }

  // Re-verify server-side via GET /v1/accounts before marking connected.
  const verified =
    (await provider.verifyAccount({
      zernioProfileId,
      accountId: account.accountId || null,
    })) ?? account;

  applyVerifiedAccountToConnection({
    profileId: params.profileId,
    ownerId: params.ownerId,
    zernioProfileId,
    account: verified,
  });

  recordIntegrationAudit({
    profileId: params.profileId,
    ownerId: params.ownerId,
    channel: "whatsapp_zernio",
    action: params.action,
    outcome: verified.status === "connected" ? "success" : "rejected",
    details: {
      status: verified.status,
      coexistenceConfirmed: verified.coexistenceConfirmed,
      hasWaba: Boolean(verified.wabaId),
      hasPhoneNumberId: Boolean(verified.phoneNumberId),
    },
  });

  return getWhatsAppConnectionView(params.profileId);
}

function applyVerifiedAccountToConnection(params: {
  profileId: string;
  ownerId: string;
  zernioProfileId: string;
  account: ZernioWhatsAppAccount;
}): void {
  const now = new Date().toISOString();
  const maskedPhone = maskPhoneNumber(params.account.phoneNumber);
  const capabilities = buildCapabilities({
    status: params.account.status,
    coexistenceConfirmed: params.account.coexistenceConfirmed,
  });

  let lastError: string | null = null;
  if (params.account.migrationStatus?.toUpperCase() === "ON_PREMISE") {
    lastError =
      "Número em estado ON_PREMISE (migração incompatível). Onboarding automático interrompido; solicite suporte para migração.";
  } else if (params.account.status === "ineligible") {
    lastError =
      params.account.errorReason ||
      "Número inelegível para coexistência no WhatsApp Business App.";
  } else if (params.account.status !== "connected") {
    lastError = params.account.errorReason;
  }

  upsertWhatsAppConnectionRow({
    profileId: params.profileId,
    ownerId: params.ownerId,
    zernioProfileId: params.zernioProfileId,
    providerAccountId: params.account.accountId || null,
    wabaId: params.account.wabaId,
    phoneNumberId: params.account.phoneNumberId,
    businessId: params.account.businessId,
    maskedPhone,
    displayName: params.account.displayName,
    onboardingMode: params.account.onboardingMode,
    status: params.account.status,
    capabilities,
    lastVerifiedAt: now,
    lastError,
    revokedAt: null,
  });
}

export async function completeWhatsAppCallback(params: {
  state: string;
  ownerId: string;
  queryConnected?: string | null;
  queryZernioProfileId?: string | null;
  queryUsername?: string | null;
  queryStatus?: string | null;
  queryError?: string | null;
  queryErrorCode?: string | null;
  queryReason?: string | null;
  queryAccountId?: string | null;
  queryMigrationStatus?: string | null;
}): Promise<{
  profileId: string;
  status:
    | WhatsAppConnectionStatus
    | "cancelled"
    | "on_premise"
    | "one_whatsapp_per_profile"
    | "whatsapp_number_already_connected"
    | "whatsapp_number_pinned_to_profile";
}> {
  const db = getDb();
  const stateHash = hashOAuthState(params.state);
  const attempt = db
    .prepare("SELECT * FROM whatsapp_connection_attempts WHERE state_hash = ?")
    .get(stateHash) as WhatsAppAttemptRow | undefined;

  if (!attempt) {
    recordIntegrationAudit({
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback",
      outcome: "rejected",
      details: { reason: "unknown_state" },
    });
    throw new WhatsAppCallbackError("Estado de conexão inválido.", "invalid_state");
  }

  if (attempt.owner_id !== params.ownerId) {
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback",
      outcome: "rejected",
      details: { reason: "owner_mismatch" },
    });
    throw new WhatsAppCallbackError(
      "Sessão não pertence ao titular da tentativa.",
      "forbidden_state"
    );
  }

  if (attempt.used_at !== null) {
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback",
      outcome: "rejected",
      details: { reason: "state_replayed" },
    });
    throw new WhatsAppCallbackError(
      "Esta tentativa de conexão já foi utilizada.",
      "reused_state"
    );
  }

  const nowIso = new Date().toISOString();
  if (new Date(attempt.expires_at).getTime() <= Date.now()) {
    db.prepare(
      "UPDATE whatsapp_connection_attempts SET status = 'expired', used_at = ? WHERE state_hash = ? AND used_at IS NULL"
    ).run(nowIso, stateHash);

    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "expired",
      lastError: "Sessão de onboarding expirada. Inicie a conexão novamente.",
    });

    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback",
      outcome: "rejected",
      details: { reason: "state_expired" },
    });

    return { profileId: attempt.profile_id, status: "expired" };
  }

  // Consume single-use state atomically.
  const consumeResult = db
    .prepare(
      "UPDATE whatsapp_connection_attempts SET used_at = ?, status = 'consumed' WHERE state_hash = ? AND used_at IS NULL"
    )
    .run(nowIso, stateHash);

  if (consumeResult.changes !== 1) {
    throw new WhatsAppCallbackError(
      "Tentativa de conexão já consumida.",
      "reused_state"
    );
  }

  const statusNorm = (params.queryStatus ?? "").trim().toLowerCase();
  const connectedNorm = (params.queryConnected ?? "").trim().toLowerCase();
  const errorNorm = (params.queryError ?? "").trim().toLowerCase();
  const errorCodeNorm = (params.queryErrorCode ?? "").trim().toUpperCase();
  const migrationNorm = (params.queryMigrationStatus ?? "").trim().toUpperCase();
  const reasonNorm = (params.queryReason ?? "").trim().toUpperCase();
  const combinedError = `${errorNorm} ${errorCodeNorm.toLowerCase()} ${reasonNorm.toLowerCase()}`;

  if (
    params.queryZernioProfileId &&
    params.queryZernioProfileId.trim() !== attempt.zernio_profile_id
  ) {
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_profile_mismatch",
      outcome: "rejected",
    });
    throw new WhatsAppCallbackError(
      "O perfil retornado no retorno OAuth não corresponde à tentativa iniciada.",
      "profile_mismatch"
    );
  }

  if (
    statusNorm === "cancelled" ||
    statusNorm === "canceled" ||
    errorNorm === "access_denied" ||
    errorNorm === "user_cancelled" ||
    errorNorm === "connection_cancelled" ||
    combinedError.includes("connection_cancelled")
  ) {
    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "disconnected",
      lastError: "Conexão cancelada pelo usuário antes da conclusão.",
    });
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_cancelled",
      outcome: "rejected",
    });
    return { profileId: attempt.profile_id, status: "cancelled" };
  }

  if (statusNorm === "expired" || errorNorm === "expired") {
    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "expired",
      lastError: "Sessão expirada durante o fluxo na Meta/Zernio.",
    });
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_expired",
      outcome: "rejected",
    });
    return { profileId: attempt.profile_id, status: "expired" };
  }

  if (
    migrationNorm === "ON_PREMISE" ||
    errorCodeNorm === "ON_PREMISE" ||
    errorNorm === "on_premise" ||
    reasonNorm.includes("ON_PREMISE")
  ) {
    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "ineligible",
      lastError:
        "Número em estado ON_PREMISE (migração incompatível). Onboarding automático interrompido; solicite suporte para migração.",
    });
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_on_premise",
      outcome: "rejected",
    });
    return { profileId: attempt.profile_id, status: "on_premise" };
  }

  if (
    statusNorm === "ineligible" ||
    errorNorm === "ineligible" ||
    errorCodeNorm === "INELIGIBLE"
  ) {
    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "ineligible",
      lastError: "Número inelegível para coexistência no WhatsApp Business App.",
    });
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_ineligible",
      outcome: "rejected",
    });
    return { profileId: attempt.profile_id, status: "ineligible" };
  }

  if (statusNorm === "incomplete") {
    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "incomplete",
      lastError:
        "Onboarding incompleto. Conclua a leitura do QR/confirmação no WhatsApp Business App.",
    });
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_incomplete",
      outcome: "rejected",
    });
    return { profileId: attempt.profile_id, status: "incomplete" };
  }

  if (
    combinedError.includes("one_whatsapp_per_profile") ||
    combinedError.includes("whatsapp_number_already_connected") ||
    combinedError.includes("whatsapp_number_pinned_to_profile")
  ) {
    const conflictCode = combinedError.includes("one_whatsapp_per_profile")
      ? "one_whatsapp_per_profile"
      : combinedError.includes("whatsapp_number_pinned_to_profile")
        ? "whatsapp_number_pinned_to_profile"
        : "whatsapp_number_already_connected";

    const conflictMessage =
      conflictCode === "one_whatsapp_per_profile"
        ? "Este perfil já possui uma conta WhatsApp Business vinculada. Desconecte a conexão atual antes de vincular outra."
        : conflictCode === "whatsapp_number_pinned_to_profile"
          ? "Este número está fixado a outro perfil na Zernio. Utilize o perfil original ou desvincule o número na Zernio."
          : "Este número de WhatsApp já está conectado em outra conta. Reutilize ou desvincule o número antes de tentar novamente.";

    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "failed",
      lastError: conflictMessage,
    });
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_number_conflict",
      outcome: "rejected",
      details: { conflictCode },
    });
    return { profileId: attempt.profile_id, status: conflictCode };
  }

  if (statusNorm === "failed" || statusNorm === "error" || Boolean(errorNorm)) {
    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "failed",
      lastError: "Não foi possível concluir a verificação do WhatsApp na Zernio.",
    });
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_failed",
      outcome: "error",
      details: { error: errorNorm || statusNorm },
    });
    return { profileId: attempt.profile_id, status: "failed" };
  }

  // Always verify server-side with Zernio before marking connected.
  const provider = getZernioWhatsAppProvider();
  let verifiedAccount: ZernioWhatsAppAccount | null;
  try {
    verifiedAccount = await provider.verifyAccount({
      zernioProfileId: attempt.zernio_profile_id,
      accountId: params.queryAccountId ?? null,
    });
  } catch (err) {
    const safeMsg =
      err instanceof Error
        ? err.message
        : "Erro ao confirmar conexão com o servidor da Zernio.";
    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "failed",
      lastError: safeMsg,
    });
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_verify_error",
      outcome: "error",
      details: { reason: safeMsg },
    });
    return { profileId: attempt.profile_id, status: "failed" };
  }

  if (!verifiedAccount || !verifiedAccount.accountId) {
    upsertWhatsAppConnectionRow({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      zernioProfileId: attempt.zernio_profile_id,
      status: "incomplete",
      lastError:
        "Retorno recebido, mas a conta ainda não foi confirmada na Zernio. Conclua o fluxo e tente novamente.",
    });
    recordIntegrationAudit({
      profileId: attempt.profile_id,
      ownerId: params.ownerId,
      channel: "whatsapp_zernio",
      action: "callback_unverified",
      outcome: "rejected",
    });
    return { profileId: attempt.profile_id, status: "incomplete" };
  }

  if (!verifiedAccount.phoneNumber && params.queryUsername?.trim()) {
    verifiedAccount = {
      ...verifiedAccount,
      phoneNumber: params.queryUsername.trim(),
    };
  }
  if (connectedNorm === "whatsapp" && verifiedAccount.status === "connecting") {
    verifiedAccount = {
      ...verifiedAccount,
      status: "connected",
      coexistenceConfirmed:
        verifiedAccount.onboardingMode === "business_app"
          ? true
          : verifiedAccount.coexistenceConfirmed,
    };
  }

  applyVerifiedAccountToConnection({
    profileId: attempt.profile_id,
    ownerId: params.ownerId,
    zernioProfileId: attempt.zernio_profile_id,
    account: verifiedAccount,
  });

  recordIntegrationAudit({
    profileId: attempt.profile_id,
    ownerId: params.ownerId,
    channel: "whatsapp_zernio",
    action: "callback_verified",
    outcome: verifiedAccount.status === "connected" ? "success" : "rejected",
    details: {
      status: verifiedAccount.status,
      coexistenceConfirmed: verifiedAccount.coexistenceConfirmed,
      hasWaba: Boolean(verifiedAccount.wabaId),
      hasPhoneNumberId: Boolean(verifiedAccount.phoneNumberId),
    },
  });

  if (verifiedAccount.migrationStatus?.toUpperCase() === "ON_PREMISE") {
    return { profileId: attempt.profile_id, status: "on_premise" };
  }

  return { profileId: attempt.profile_id, status: verifiedAccount.status };
}

export function disconnectWhatsAppIntegration(params: {
  profileId: string;
  ownerId: string;
}): WhatsAppConnectionView {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT * FROM whatsapp_connections WHERE profile_id = ?")
    .get(params.profileId) as WhatsAppConnectionRow | undefined;

  // Disconnect only inside LinkIA; never deregister or migrate the phone number from Cloud API.
  if (existing) {
    db.prepare(
      `UPDATE whatsapp_connections
       SET status = 'disconnected',
           capabilities_json = ?,
           last_error = NULL,
           updated_at = ?,
           revoked_at = ?
       WHERE profile_id = ?`
    ).run(
      JSON.stringify(
        buildCapabilities({ status: "disconnected", coexistenceConfirmed: false })
      ),
      now,
      now,
      params.profileId
    );
  }

  recordIntegrationAudit({
    profileId: params.profileId,
    ownerId: params.ownerId,
    channel: "whatsapp_zernio",
    action: "disconnect_linkia_only",
    outcome: "success",
    details: { hadConnection: Boolean(existing) },
  });

  return getWhatsAppConnectionView(params.profileId);
}

export function verifyZernioWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  secret?: string;
}): boolean {
  const secret = (params.secret ?? process.env.ZERNIO_WEBHOOK_SECRET ?? "").trim();
  if (!secret || !params.signatureHeader) {
    return false;
  }

  const provided = params.signatureHeader
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(provided)) {
    return false;
  }

  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(params.rawBody, "utf8")
    .digest("hex");

  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export function processZernioWebhookEvent(params: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  eventIdHeader?: string | null | undefined;
  eventTypeHeader?: string | null | undefined;
}): {
  ok: boolean;
  statusCode: number;
  deduplicated?: boolean;
  error?: string;
} {
  if (Buffer.byteLength(params.rawBody, "utf8") > MAX_WEBHOOK_PAYLOAD_BYTES) {
    return { ok: false, statusCode: 413, error: "Payload muito grande." };
  }

  const secret = process.env.ZERNIO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      statusCode: 503,
      error: "ZERNIO_WEBHOOK_SECRET não configurado.",
    };
  }

  if (
    !verifyZernioWebhookSignature({
      rawBody: params.rawBody,
      signatureHeader: params.signatureHeader,
      secret,
    })
  ) {
    recordIntegrationAudit({
      channel: "whatsapp_zernio",
      action: "webhook_invalid_signature",
      outcome: "rejected",
    });
    return { ok: false, statusCode: 401, error: "Assinatura inválida." };
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(params.rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, statusCode: 400, error: "Payload JSON inválido." };
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, statusCode: 400, error: "JSON malformado." };
  }

  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};

  const eventIdRaw =
    params.eventIdHeader?.trim() ||
    payload.id ||
    payload.eventId ||
    payload.event_id ||
    data.eventId ||
    data.id;
  const eventId =
    typeof eventIdRaw === "string" && eventIdRaw.trim()
      ? eventIdRaw.trim()
      : crypto.createHash("sha256").update(params.rawBody, "utf8").digest("hex");

  const db = getDb();
  const now = new Date().toISOString();

  const dedupResult = db
    .prepare(
      "INSERT OR IGNORE INTO webhook_events_dedup (event_id, provider, received_at) VALUES (?, 'zernio', ?)"
    )
    .run(eventId, now);

  if (dedupResult.changes === 0) {
    return { ok: true, statusCode: 200, deduplicated: true };
  }

  const eventType = String(
    params.eventTypeHeader?.trim() ||
      payload.event ||
      payload.type ||
      payload.eventType ||
      "unknown"
  )
    .trim()
    .toLowerCase();

  const accountId =
    typeof (payload.accountId ?? data.accountId ?? data.id) === "string"
      ? String(payload.accountId ?? data.accountId ?? data.id)
      : null;

  const zernioProfileId =
    typeof (payload.profileId ?? data.profileId) === "string"
      ? String(payload.profileId ?? data.profileId)
      : null;

  let connectionRow: WhatsAppConnectionRow | undefined;
  if (accountId) {
    connectionRow = db
      .prepare("SELECT * FROM whatsapp_connections WHERE provider_account_id = ?")
      .get(accountId) as WhatsAppConnectionRow | undefined;
  }
  if (!connectionRow && zernioProfileId) {
    connectionRow = db
      .prepare("SELECT * FROM whatsapp_connections WHERE zernio_profile_id = ?")
      .get(zernioProfileId) as WhatsAppConnectionRow | undefined;
  }

  if (connectionRow) {
    const accountSource =
      Object.keys(data).length > 0 ? data : payload;
    const mapped = mapZernioAccountPayload(
      accountSource,
      connectionRow.zernio_profile_id
    );

    let nextStatus = connectionRow.status;
    if (eventType.includes("disconnected") || eventType.includes("revoked")) {
      nextStatus = "disconnected";
    } else if (eventType.includes("expired")) {
      nextStatus = "expired";
    } else if (eventType.includes("ineligible")) {
      nextStatus = "ineligible";
    } else if (eventType.includes("failed") || eventType.includes("error")) {
      nextStatus = "failed";
    } else if (eventType.includes("connected") || eventType.includes("updated")) {
      nextStatus = mapped.status;
    }

    const nextCoexistence =
      nextStatus === "connected"
        ? mapped.coexistenceConfirmed ||
          parseCapabilities(connectionRow.capabilities_json, nextStatus)
            .coexistenceConfirmed
        : false;

    const capabilities = buildCapabilities({
      status: nextStatus,
      coexistenceConfirmed: nextCoexistence,
    });

    const maskedPhone = mapped.phoneNumber
      ? maskPhoneNumber(mapped.phoneNumber)
      : connectionRow.masked_phone;

    db.prepare(
      `UPDATE whatsapp_connections
       SET status = ?,
           provider_account_id = COALESCE(?, provider_account_id),
           waba_id = COALESCE(?, waba_id),
           phone_number_id = COALESCE(?, phone_number_id),
           business_id = COALESCE(?, business_id),
           masked_phone = ?,
           display_name = COALESCE(?, display_name),
           capabilities_json = ?,
           last_verified_at = ?,
           last_error = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      nextStatus,
      mapped.accountId || null,
      mapped.wabaId,
      mapped.phoneNumberId,
      mapped.businessId,
      maskedPhone,
      mapped.displayName,
      JSON.stringify(capabilities),
      now,
      nextStatus === "connected" ? null : mapped.errorReason ?? connectionRow.last_error,
      now,
      connectionRow.id
    );

    recordIntegrationAudit({
      profileId: connectionRow.profile_id,
      ownerId: connectionRow.owner_id,
      channel: "whatsapp_zernio",
      action: "webhook_processed",
      outcome: "success",
      details: { eventId, eventType, nextStatus },
    });
  } else {
    recordIntegrationAudit({
      channel: "whatsapp_zernio",
      action: "webhook_unmatched",
      outcome: "success",
      details: { eventId, eventType },
    });
  }

  return { ok: true, statusCode: 200, deduplicated: false };
}
