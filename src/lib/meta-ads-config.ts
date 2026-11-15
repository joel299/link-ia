import { Composio } from "@composio/core";
import { recordIntegrationAudit, requireOwnedProfile } from "./integration-audit";

export const META_ADS_TOOLKIT_SLUG = "metaads";
export const META_ADS_AUTH_SCHEME = "OAUTH2";
export const META_ADS_DEFAULT_REDIRECT_URI =
  "https://backend.composio.dev/api/v3/toolkits/auth/callback";
export const META_ADS_DEFAULT_SCOPES =
  "ads_read,ads_management,business_management";

export class MetaAdsConfigError extends Error {
  readonly statusCode: number;
  readonly missingVariables: string[];

  constructor(
    message: string,
    missingVariables: string[] = [],
    statusCode = 422
  ) {
    super(message);
    this.name = "MetaAdsConfigError";
    this.statusCode = statusCode;
    this.missingVariables = missingVariables;
  }
}

export interface MetaAdsEnvValidation {
  hasApiKey: boolean;
  hasAuthConfigId: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  redirectUri: string;
  missingForConnection: string[];
  missingForAuthConfigCreation: string[];
}

export interface MetaAdsAuthConfigRecord {
  id: string;
  toolkitSlug: string;
  authScheme: string;
  status: string;
}

export interface MetaAdsAuthConfigClient {
  listMetaAdsAuthConfigs(): Promise<MetaAdsAuthConfigRecord[]>;
  updateMetaAdsAuthConfig(
    id: string,
    params: { redirectUri: string }
  ): Promise<void>;
  createMetaAdsAuthConfig(params: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string;
  }): Promise<{ id: string }>;
}

export function getMetaAdsRedirectUri(): string {
  const configured =
    process.env.META_ADS_OAUTH_REDIRECT_URI?.trim() ||
    process.env.COMPOSIO_META_ADS_REDIRECT_URI?.trim();
  if (configured && configured !== META_ADS_DEFAULT_REDIRECT_URI) {
    throw new MetaAdsConfigError(
      `META_ADS_OAUTH_REDIRECT_URI precisa ser exatamente ${META_ADS_DEFAULT_REDIRECT_URI}.`,
      ["META_ADS_OAUTH_REDIRECT_URI"],
      500
    );
  }
  return META_ADS_DEFAULT_REDIRECT_URI;
}

export function getMetaAdsReturnBaseUrl(fallbackOrigin: string): string {
  const configured = process.env.LINKIA_META_ADS_RETURN_URL?.trim();
  const trustedOrigin = new URL(
    process.env.APP_BASE_URL?.trim() || fallbackOrigin
  ).origin;
  const callbackPath = "/api/integrations/social/callback";
  if (!configured) {
    return `${trustedOrigin}${callbackPath}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new MetaAdsConfigError(
      "LINKIA_META_ADS_RETURN_URL precisa ser uma URL HTTP ou HTTPS válida.",
      ["LINKIA_META_ADS_RETURN_URL"],
      500
    );
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.origin !== trustedOrigin ||
    parsed.pathname.replace(/\/$/, "") !== callbackPath ||
    parsed.search ||
    parsed.hash
  ) {
    throw new MetaAdsConfigError(
      "LINKIA_META_ADS_RETURN_URL deve apontar para a rota OAuth do LinkIA no domínio APP_BASE_URL.",
      ["LINKIA_META_ADS_RETURN_URL"],
      500
    );
  }
  return `${trustedOrigin}${callbackPath}`;
}

export function getMetaAdsEnvValidation(): MetaAdsEnvValidation {
  const hasApiKey = Boolean(process.env.COMPOSIO_API_KEY?.trim());
  const hasAuthConfigId = Boolean(
    process.env.COMPOSIO_META_ADS_AUTH_CONFIG_ID?.trim()
  );
  const hasClientId = Boolean(process.env.META_ADS_CLIENT_ID?.trim());
  const hasClientSecret = Boolean(process.env.META_ADS_CLIENT_SECRET?.trim());
  const redirectUri = getMetaAdsRedirectUri();

  const missingForConnection: string[] = [];
  if (!hasApiKey) missingForConnection.push("COMPOSIO_API_KEY");
  if (!hasAuthConfigId) {
    missingForConnection.push("COMPOSIO_META_ADS_AUTH_CONFIG_ID");
  }

  const missingForAuthConfigCreation: string[] = [];
  if (!hasApiKey) missingForAuthConfigCreation.push("COMPOSIO_API_KEY");
  if (!hasClientId) missingForAuthConfigCreation.push("META_ADS_CLIENT_ID");
  if (!hasClientSecret) {
    missingForAuthConfigCreation.push("META_ADS_CLIENT_SECRET");
  }

  return {
    hasApiKey,
    hasAuthConfigId,
    hasClientId,
    hasClientSecret,
    redirectUri,
    missingForConnection,
    missingForAuthConfigCreation,
  };
}

function createDefaultMetaAdsAuthConfigClient(): MetaAdsAuthConfigClient {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new MetaAdsConfigError(
      "Defina a variável COMPOSIO_API_KEY no servidor antes de configurar o Meta Ads.",
      ["COMPOSIO_API_KEY"],
      503
    );
  }
  const client = new Composio({ apiKey });

  return {
    async listMetaAdsAuthConfigs() {
      const list = await client.authConfigs.list({
        toolkit: META_ADS_TOOLKIT_SLUG,
      });
      const items = Array.isArray(list?.items) ? list.items : [];
      return items.map((item) => ({
        id: String(item.id ?? ""),
        toolkitSlug: String(item.toolkit?.slug ?? "").toLowerCase(),
        authScheme: String(item.authScheme ?? "").toUpperCase(),
        status: String(item.status ?? "").toUpperCase(),
      }));
    },
    async updateMetaAdsAuthConfig(id, { redirectUri }) {
      await client.authConfigs.update(id, {
        type: "custom",
        credentials: { oauth_redirect_uri: redirectUri },
      });
    },

    async createMetaAdsAuthConfig({
      clientId,
      clientSecret,
      redirectUri,
      scopes,
    }) {
      const created = await client.authConfigs.create(META_ADS_TOOLKIT_SLUG, {
        type: "use_custom_auth",
        name: "LinkIA Meta Ads OAuth",
        authScheme: META_ADS_AUTH_SCHEME,
        credentials: {
          client_id: clientId,
          client_secret: clientSecret,
          oauth_redirect_uri: redirectUri,
          scopes,
        },
      });
      if (!created?.id) {
        throw new MetaAdsConfigError(
          "Composio não retornou o ID da Auth Config criada para Meta Ads.",
          [],
          502
        );
      }
      return { id: String(created.id) };
    },
  };
}

export async function ensureMetaAdsAuthConfig(
  params: {
    profileId: string;
    ownerId: string;
  },
  authClient?: MetaAdsAuthConfigClient
): Promise<{
  authConfigId: string;
  source: "env" | "composio_existing" | "composio_created";
  created: boolean;
  redirectUri: string;
  scopes: string;
}> {
  if (!requireOwnedProfile(params.profileId, params.ownerId)) {
    throw new MetaAdsConfigError(
      "Perfil não encontrado ou sem permissão.",
      [],
      403
    );
  }

  const validation = getMetaAdsEnvValidation();
  const configuredAuthConfigId =
    process.env.COMPOSIO_META_ADS_AUTH_CONFIG_ID?.trim();
  const client = authClient ?? createDefaultMetaAdsAuthConfigClient();

  if (configuredAuthConfigId) {
    const configured = (await client.listMetaAdsAuthConfigs()).find(
      (item) =>
        item.id === configuredAuthConfigId &&
        item.toolkitSlug === META_ADS_TOOLKIT_SLUG &&
        item.authScheme === META_ADS_AUTH_SCHEME
    );
    if (!configured) {
      throw new MetaAdsConfigError(
        "COMPOSIO_META_ADS_AUTH_CONFIG_ID não pertence a uma Auth Config OAUTH2 do toolkit metaads.",
        ["COMPOSIO_META_ADS_AUTH_CONFIG_ID"],
        422
      );
    }
    await client.updateMetaAdsAuthConfig(configuredAuthConfigId, {
      redirectUri: validation.redirectUri,
    });
    return {
      authConfigId: configuredAuthConfigId,
      source: "env",
      created: false,
      redirectUri: validation.redirectUri,
      scopes: META_ADS_DEFAULT_SCOPES,
    };
  }

  if (validation.missingForAuthConfigCreation.length > 0) {
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: "meta_ads",
      action: "auth_config.ensure",
      outcome: "rejected",
      details: {
        missingVariables: validation.missingForAuthConfigCreation,
      },
    });
    throw new MetaAdsConfigError(
      `Preencha no servidor as variáveis: ${validation.missingForAuthConfigCreation.join(", ")}.`,
      validation.missingForAuthConfigCreation,
      503
    );
  }

  const clientId = process.env.META_ADS_CLIENT_ID!.trim();
  const clientSecret = process.env.META_ADS_CLIENT_SECRET!.trim();

  const existing = await client.listMetaAdsAuthConfigs();
  const reusable = existing.find(
    (item) =>
      item.id &&
      item.toolkitSlug === META_ADS_TOOLKIT_SLUG &&
      item.authScheme === META_ADS_AUTH_SCHEME &&
      item.status === "ENABLED"
  );

  if (reusable) {
    await client.updateMetaAdsAuthConfig(reusable.id, {
      redirectUri: validation.redirectUri,
    });
    recordIntegrationAudit({
      profileId: params.profileId,
      ownerId: params.ownerId,
      channel: "meta_ads",
      action: "auth_config.ensure",
      outcome: "success",
      details: {
        source: "composio_existing",
        authConfigId: reusable.id,
        redirectUri: validation.redirectUri,
      },
    });
    return {
      authConfigId: reusable.id,
      source: "composio_existing",
      created: false,
      redirectUri: validation.redirectUri,
      scopes: META_ADS_DEFAULT_SCOPES,
    };
  }

  const created = await client.createMetaAdsAuthConfig({
    clientId,
    clientSecret,
    redirectUri: validation.redirectUri,
    scopes: META_ADS_DEFAULT_SCOPES,
  });

  recordIntegrationAudit({
    profileId: params.profileId,
    ownerId: params.ownerId,
    channel: "meta_ads",
    action: "auth_config.ensure",
    outcome: "success",
    details: {
      source: "composio_created",
      authConfigId: created.id,
      redirectUri: validation.redirectUri,
    },
  });

  return {
    authConfigId: created.id,
    source: "composio_created",
    created: true,
    redirectUri: validation.redirectUri,
    scopes: META_ADS_DEFAULT_SCOPES,
  };
}

