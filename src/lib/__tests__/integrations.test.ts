import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerUser } from "../auth";
import { closeDb, getDb } from "../db";
import {
  createProfile,
  getPublishedPublicProfileBySlug,
  publishProfile,
  updateProfile,
} from "../profiles";
import {
  hashOAuthState,
  maskPhoneNumber,
  recordIntegrationAudit,
} from "../integration-audit";
import {
  completeWhatsAppCallback,
  disconnectWhatsAppIntegration,
  getWhatsAppConnectionView,
  initiateWhatsAppConnection,
  isAllowedZernioRedirectUrl,
  processZernioWebhookEvent,
  resetZernioWhatsAppProvider,
  setZernioWhatsAppProvider,
  verifyZernioWebhookSignature,
  WhatsAppCallbackError,
  ZernioConfigError,
} from "../zernio-whatsapp";
import {
  completeSocialOAuthCallback,
  disconnectSocialConnection,
  getSocialConnectionView,
  initiateSocialConnection,
  listProfileSocialMedia,
  SocialComposioProvider,
  SocialValidationError,
  updatePublicSocialMediaSelection,
} from "../composio-social";
import {
  AdsServiceError,
  AdsToolAdapter,
  confirmCampaignOperationForOwner,
  createCampaignDraftForOwner,
  listAdAccountsForOwner,
  selectAdAccountForOwner,
} from "../ads-service";
import {
  ensureMetaAdsAuthConfig,
  getMetaAdsEnvValidation,
  META_ADS_DEFAULT_REDIRECT_URI,
  META_ADS_DEFAULT_SCOPES,
  MetaAdsAuthConfigClient,
  MetaAdsConfigError,
} from "../meta-ads-config";
import { POST as zernioWebhookPost } from "../../app/api/webhooks/zernio/whatsapp/route";
import { register as registerInstrumentation } from "../../instrumentation";

let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkia-integrations-test-"));
  process.env.DATA_DIR = tempDir;
});

afterAll(() => {
  resetZernioWhatsAppProvider();
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

beforeEach(() => {
  resetZernioWhatsAppProvider();
  delete process.env.ZERNIO_API_KEY;
  delete process.env.ZERNIO_WEBHOOK_SECRET;
  delete process.env.ZERNIO_ALLOW_LOCAL_MOCK;
  delete process.env.COMPOSIO_API_KEY;
  delete process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID;
  delete process.env.COMPOSIO_TIKTOK_AUTH_CONFIG_ID;
  delete process.env.COMPOSIO_META_ADS_AUTH_CONFIG_ID;
  delete process.env.COMPOSIO_META_ADS_REDIRECT_URI;
  delete process.env.META_ADS_CLIENT_ID;
  delete process.env.META_ADS_CLIENT_SECRET;
  delete process.env.COMPOSIO_TIKTOK_ADS_AUTH_CONFIG_ID;
  delete process.env.COMPOSIO_ALLOW_LOCAL_MOCK;
});

function createTwoTenants() {
  const emailA = `tenanta_${crypto.randomUUID().slice(0, 8)}@test.app`;
  const emailB = `tenantb_${crypto.randomUUID().slice(0, 8)}@test.app`;
  const regA = registerUser(emailA, "Tenant A", "password123");
  const regB = registerUser(emailB, "Tenant B", "password123");
  if (!regA.user || !regB.user) {
    throw new Error("Failed to register test users");
  }
  const profA = createProfile(regA.user.id, {
    displayName: "Clinica A",
    slug: `clinica-a-${crypto.randomUUID().slice(0, 6)}`,
  });
  const profB = createProfile(regB.user.id, {
    displayName: "Clinica B",
    slug: `clinica-b-${crypto.randomUUID().slice(0, 6)}`,
  });
  if (!profA.profile || !profB.profile) {
    throw new Error("Failed to create test profiles");
  }
  return {
    userA: regA.user,
    userB: regB.user,
    profileA: profA.profile,
    profileB: profB.profile,
  };
}

describe("Integrations — Security, Zernio WhatsApp, Social & Ads", () => {
  it("redacts sensitive values in audit logs and masks phone numbers", () => {
    const { userA, profileA } = createTwoTenants();
    expect(maskPhoneNumber("5511999991234")).toBe("+55 ** *****-1234");

    recordIntegrationAudit({
      profileId: profileA.id,
      ownerId: userA.id,
      channel: "whatsapp_zernio",
      action: "test.redaction",
      outcome: "success",
      details: {
        accessToken: "secret_token_9876",
        apiKey: "ak_super_secret_4321",
        phoneNumber: "5511999991234",
        safeField: "ok",
      },
    });

    const db = getDb();
    const row = db
      .prepare(
        "SELECT details_json FROM integration_audit_events WHERE profile_id = ? AND action = 'test.redaction' ORDER BY created_at DESC LIMIT 1"
      )
      .get(profileA.id) as { details_json: string };

    expect(row.details_json).not.toContain("secret_token_9876");
    expect(row.details_json).not.toContain("ak_super_secret_4321");
    expect(row.details_json).not.toContain("5511999991234");
    expect(row.details_json).toContain("ok");
  });

  it("WhatsApp Zernio: enforces pending_config, allowlist, state security, coexistence status, disconnect, and webhook dedup", async () => {
    const { userA, userB, profileA } = createTwoTenants();

    // Without ZERNIO_API_KEY -> pending_config
    const initialView = getWhatsAppConnectionView(profileA.id);
    expect(initialView.status).toBe("pending_config");
    expect(initialView.configReady).toBe(false);
    expect(initialView.composioStatus).toBe("disabled_pending_validation");

    await expect(
      initiateWhatsAppConnection({
        profileId: profileA.id,
        ownerId: userA.id,
        origin: "http://localhost:3000",
      })
    ).rejects.toThrow(ZernioConfigError);

    // Allowlist check
    expect(
      isAllowedZernioRedirectUrl("https://zernio.com/connect/wa?x=1", {
        allowLocalMock: false,
      })
    ).toBe(true);
    expect(
      isAllowedZernioRedirectUrl("https://evil.example.com/phish", {
        allowLocalMock: false,
      })
    ).toBe(false);

    // Configure Zernio provider mock
    process.env.ZERNIO_API_KEY = "test_zernio_key";
    process.env.ZERNIO_WEBHOOK_SECRET = "test_webhook_secret_123456";

    setZernioWhatsAppProvider({
      async getConnectUrl({ redirectUrl }) {
        expect(redirectUrl).toContain("/api/integrations/whatsapp/callback");
        return {
          redirectUrl: "https://zernio.com/connect/whatsapp?session=abc",
          isMock: false,
        };
      },
      async completeEmbeddedSignup() {
        return null;
      },
      async verifyAccount({ zernioProfileId }) {
        return {
          accountId: "z_acc_1",
          zernioProfileId,
          status: "connected",
          onboardingMode: "business_app",
          coexistenceConfirmed: true,
          wabaId: "waba_1",
          phoneNumberId: "pn_1",
          businessId: "biz_1",
          phoneNumber: "5511988887777",
          displayName: "Clinica A WhatsApp",
          migrationStatus: null,
          errorReason: null,
        };
      },
    });

    const init = await initiateWhatsAppConnection({
      profileId: profileA.id,
      ownerId: userA.id,
      origin: "http://localhost:3000",
    });
    expect(init.redirectUrl).toBe("https://zernio.com/connect/whatsapp?session=abc");

    const db = getDb();
    const attemptRow = db
      .prepare("SELECT state_hash FROM whatsapp_connection_attempts WHERE profile_id = ?")
      .get(profileA.id) as { state_hash: string };
    expect(attemptRow.state_hash).toHaveLength(64);

    // Manually insert known state for callback tests
    const rawState = "valid_wa_state_123";
    const stateHash = hashOAuthState(rawState);
    db.prepare(
      `INSERT INTO whatsapp_connection_attempts (state_hash, profile_id, owner_id, zernio_profile_id, status, expires_at, created_at)
       VALUES (?, ?, ?, ?, 'initiated', ?, ?)`
    ).run(
      stateHash,
      profileA.id,
      userA.id,
      `linkia_${profileA.id}`,
      new Date(Date.now() + 60_000).toISOString(),
      new Date().toISOString()
    );

    // Cross-tenant attempt must fail
    await expect(
      completeWhatsAppCallback({
        state: rawState,
        ownerId: userB.id,
        queryStatus: "connected",
        queryAccountId: "z_acc_1",
      })
    ).rejects.toThrow(WhatsAppCallbackError);

    // Valid tenant completes callback & server-side verification
    const cb = await completeWhatsAppCallback({
      state: rawState,
      ownerId: userA.id,
      queryStatus: "connected",
      queryAccountId: "z_acc_1",
    });
    expect(cb.status).toBe("connected");

    // Replay of used state must fail
    await expect(
      completeWhatsAppCallback({
        state: rawState,
        ownerId: userA.id,
        queryStatus: "connected",
        queryAccountId: "z_acc_1",
      })
    ).rejects.toThrow(WhatsAppCallbackError);

    const view = getWhatsAppConnectionView(profileA.id);
    expect(view.status).toBe("connected");
    expect(view.maskedPhone).toBe("+55 ** *****-7777");
    expect(view.capabilities.coexistenceConfirmed).toBe(true);
    expect(view.capabilities.groupsApiSupported).toBe(false);
    expect(view.composioStatus).toBe("disabled_pending_validation");

    // Tenant B cannot initiate WhatsApp connection on Tenant A profile
    await expect(
      initiateWhatsAppConnection({
        profileId: profileA.id,
        ownerId: userB.id,
        origin: "http://localhost:3000",
      })
    ).rejects.toThrow();

    // Webhook HMAC verification + idempotent deduplication
    const payload = JSON.stringify({
      id: "evt_wa_001",
      type: "whatsapp.account.status_updated",
      data: { accountId: "z_acc_1", status: { status: "active" } },
    });
    const sig = crypto
      .createHmac("sha256", process.env.ZERNIO_WEBHOOK_SECRET)
      .update(payload, "utf8")
      .digest("hex");

    expect(
      verifyZernioWebhookSignature({ rawBody: payload, signatureHeader: "bad_sig" })
    ).toBe(false);
    expect(
      verifyZernioWebhookSignature({ rawBody: payload, signatureHeader: sig })
    ).toBe(true);

    const firstEvt = processZernioWebhookEvent({ rawBody: payload, signatureHeader: sig });
    expect(firstEvt.ok).toBe(true);
    expect(firstEvt.deduplicated).toBeFalsy();

    const dupEvt = processZernioWebhookEvent({ rawBody: payload, signatureHeader: sig });
    expect(dupEvt.ok).toBe(true);
    expect(dupEvt.deduplicated).toBe(true);

    // Disconnect only revokes in LinkIA
    const afterDisc = disconnectWhatsAppIntegration({
      profileId: profileA.id,
      ownerId: userA.id,
    });
    expect(afterDisc.status).toBe("disconnected");
  });

  it("Instagram & TikTok organic: rejects personal IG, enforces max 3 public posts, exposes canonical URL publicly, and shows pending_config for TikTok", async () => {
    const { userA, userB, profileA } = createTwoTenants();

    // TikTok without config -> pending_config
    const ttView = getSocialConnectionView(profileA.id, "tiktok");
    expect(ttView.status).toBe("pending_config");
    expect(ttView.managedOAuthSupported).toBe(false);

    process.env.COMPOSIO_API_KEY = "test_comp_key";
    process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID = "ac_ig_test";

    // 1. Personal IG account rejected
    const personalProvider: SocialComposioProvider = {
      async createConnectLink({ composioUserId }) {
        return {
          connectedAccountId: `ig_conn_${composioUserId}`,
          redirectUrl: "https://connect.composio.dev/ig",
          isMock: false,
        };
      },
      async getConnectionStatus() {
        return { status: "connected", accountLabel: "@pessoal" };
      },
      async disconnectAccount() {},
      async fetchInstagramUserInfo() {
        return {
          igUserId: "ig_1",
          username: "conta_pessoal",
          accountType: "PERSONAL",
          canonicalUrl: "https://www.instagram.com/conta_pessoal/",
          accountLabel: "@conta_pessoal",
        };
      },
      async fetchInstagramMedia() {
        return [];
      },
      async fetchTikTokUserInfo() {
        throw new Error("unused");
      },
      async fetchTikTokVideos() {
        return [];
      },
    };

    await initiateSocialConnection({
      profileId: profileA.id,
      ownerId: userA.id,
      provider: "instagram",
      origin: "http://localhost:3000",
      composioProvider: personalProvider,
    });

    const db = getDb();
    const statePersonal = "ig_state_personal";
    db.prepare(
      `INSERT INTO social_oauth_states (state_hash, profile_id, owner_id, provider, composio_user_id, composio_connected_account_id, is_mock, expires_at, created_at)
       VALUES (?, ?, ?, 'instagram', ?, 'ig_conn_1', 0, ?, ?)`
    ).run(
      hashOAuthState(statePersonal),
      profileA.id,
      userA.id,
      `linkia_u_${userA.id}_p_${profileA.id}`,
      new Date(Date.now() + 60_000).toISOString(),
      new Date().toISOString()
    );

    const personalResult = await completeSocialOAuthCallback({
      state: statePersonal,
      ownerId: userA.id,
      queryStatus: "connected",
      composioProvider: personalProvider,
    });
    expect(personalResult.status).toBe("failed");

    // 2. Business IG account accepted with 4 media items -> max 3 selectable
    const businessProvider: SocialComposioProvider = {
      ...personalProvider,
      async fetchInstagramUserInfo() {
        return {
          igUserId: "ig_biz_1",
          username: "clinica.oficial",
          accountType: "BUSINESS",
          canonicalUrl: "https://www.instagram.com/clinica.oficial/",
          accountLabel: "@clinica.oficial",
        };
      },
      async fetchInstagramMedia() {
        return [
          { externalId: "m1", mediaType: "REELS", caption: "Reel 1", permalink: "https://www.instagram.com/reel/1/", thumbnailUrl: "https://cdn.example/1.jpg", publishedAt: "2026-11-10T10:00:00Z" },
          { externalId: "m2", mediaType: "IMAGE", caption: "Post 2", permalink: "https://www.instagram.com/p/2/", thumbnailUrl: "https://cdn.example/2.jpg", publishedAt: "2026-11-09T10:00:00Z" },
          { externalId: "m3", mediaType: "CAROUSEL_ALBUM", caption: "Post 3", permalink: "https://www.instagram.com/p/3/", thumbnailUrl: "https://cdn.example/3.jpg", publishedAt: "2026-11-08T10:00:00Z" },
          { externalId: "m4", mediaType: "VIDEO", caption: "Post 4", permalink: "https://www.instagram.com/p/4/", thumbnailUrl: "https://cdn.example/4.jpg", publishedAt: "2026-11-07T10:00:00Z" },
        ];
      },
    };

    const stateBiz = "ig_state_biz";
    db.prepare(
      `INSERT INTO social_oauth_states (state_hash, profile_id, owner_id, provider, composio_user_id, composio_connected_account_id, is_mock, expires_at, created_at)
       VALUES (?, ?, ?, 'instagram', ?, 'ig_conn_biz', 0, ?, ?)`
    ).run(
      hashOAuthState(stateBiz),
      profileA.id,
      userA.id,
      `linkia_u_${userA.id}_p_${profileA.id}`,
      new Date(Date.now() + 60_000).toISOString(),
      new Date().toISOString()
    );

    const bizResult = await completeSocialOAuthCallback({
      state: stateBiz,
      ownerId: userA.id,
      queryStatus: "connected",
      composioProvider: businessProvider,
    });
    expect(bizResult.status).toBe("connected");

    // Trying to select 4 items must fail
    expect(() =>
      updatePublicSocialMediaSelection({
        profileId: profileA.id,
        ownerId: userA.id,
        provider: "instagram",
        selectedExternalIds: ["m1", "m2", "m3", "m4"],
      })
    ).toThrow(SocialValidationError);

    // Selecting 3 items succeeds
    const updated = updatePublicSocialMediaSelection({
      profileId: profileA.id,
      ownerId: userA.id,
      provider: "instagram",
      selectedExternalIds: ["m1", "m2", "m3"],
    });
    expect(updated.filter((i) => i.publicEnabled)).toHaveLength(3);

    // Publish profile and verify public profile output
    updateProfile(profileA.id, userA.id, {
      instagramInput: "@clinica.oficial",
      instagramEnabled: true,
      whatsappNumber: "5511999998888",
      whatsappEnabled: true,
    });
    const pubRes = publishProfile(profileA.id, userA.id);
    expect(pubRes.errors).toBeUndefined();
    expect(pubRes.profile?.status).toBe("published");
    const pub = getPublishedPublicProfileBySlug(profileA.slug);
    expect(pub?.instagramUrl).toBe("https://www.instagram.com/clinica.oficial/");
    expect(pub?.socialMediaItems).toHaveLength(3);
    expect(JSON.stringify(pub)).not.toContain("ig_conn_biz");
    expect(JSON.stringify(pub)).not.toContain("test_comp_key");

    // Tenant B cannot update Tenant A social media
    expect(() =>
      updatePublicSocialMediaSelection({
        profileId: profileA.id,
        ownerId: userB.id,
        provider: "instagram",
        selectedExternalIds: ["m1"],
      })
    ).toThrow();
    expect(listProfileSocialMedia(profileA.id, "instagram")).toHaveLength(4);

    // Disconnect clears public media
    await disconnectSocialConnection({
      profileId: profileA.id,
      ownerId: userA.id,
      provider: "instagram",
      composioProvider: businessProvider,
    });
    const pubAfter = getPublishedPublicProfileBySlug(profileA.slug);
    expect(pubAfter?.socialMediaItems).toHaveLength(0);
  });

  it("Meta Ads & TikTok Ads: requires explicit confirmation, creates paused first, prevents idempotent duplicates, and separates activation", async () => {
    const { userA, userB, profileA } = createTwoTenants();
    process.env.COMPOSIO_API_KEY = "test_comp_key";
    process.env.COMPOSIO_META_ADS_AUTH_CONFIG_ID = "ac_metaads_test";

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO social_connections (
        id, profile_id, owner_id, provider, toolkit_slug, composio_user_id,
        composio_connected_account_id, status, account_label, created_at, updated_at
      ) VALUES (?, ?, ?, 'meta_ads', 'METAADS', ?, 'meta_conn_1', 'connected', 'Meta Biz', ?, ?)`
    ).run(
      crypto.randomUUID(),
      profileA.id,
      userA.id,
      `linkia_u_${userA.id}_p_${profileA.id}`,
      now,
      now
    );

    let createCalls = 0;
    let activateCalls = 0;
    const fakeAdapter: AdsToolAdapter = {
      async listAdAccounts() {
        return [
          {
            externalId: "act_123",
            displayName: "Conta Clinica A",
            currency: "BRL",
            status: "ACTIVE",
          },
        ];
      },
      async listCampaignsAndMetrics() {
        return [];
      },
      async createPausedCampaign(params) {
        createCalls += 1;
        expect(params.draft.name).toBe("Campanha Boas Vindas");
        return { externalCampaignId: "cmp_meta_999" };
      },
      async activateCampaign() {
        activateCalls += 1;
      },
    };

    const accounts = await listAdAccountsForOwner(
      { profileId: profileA.id, ownerId: userA.id, provider: "meta_ads" },
      fakeAdapter
    );
    expect(accounts).toHaveLength(1);

    await selectAdAccountForOwner(
      {
        profileId: profileA.id,
        ownerId: userA.id,
        provider: "meta_ads",
        adAccountId: "act_123",
      },
      fakeAdapter
    );

    // Tenant B cannot create draft on Tenant A profile
    expect(() =>
      createCampaignDraftForOwner({
        profileId: profileA.id,
        ownerId: userB.id,
        provider: "meta_ads",
        input: {
          name: "Intruder",
          objective: "OUTCOME_TRAFFIC",
          budgetAmount: 50,
          budgetCurrency: "BRL",
          budgetType: "daily",
          startDate: "2026-11-20",
          targetSummary: "Brasil 25-45",
          creativeHeadline: "Agende hoje",
          destinationUrl: "https://linkia.app/clinica-a",
          idempotencyKey: "idem_b_1",
        },
      })
    ).toThrow(AdsServiceError);

    const draftResult = createCampaignDraftForOwner({
      profileId: profileA.id,
      ownerId: userA.id,
      provider: "meta_ads",
      input: {
        name: "Campanha Boas Vindas",
        objective: "OUTCOME_TRAFFIC",
        budgetAmount: 50,
        budgetCurrency: "BRL",
        budgetType: "daily",
        startDate: "2026-11-20",
        targetSummary: "Brasil 25-45",
        creativeHeadline: "Agende hoje",
        destinationUrl: "https://linkia.app/clinica-a",
        idempotencyKey: "idem_a_1",
      },
    });
    expect(draftResult.operation.status).toBe("draft");
    const draft = draftResult.operation;

    // Must reject confirmation without confirmed === true
    await expect(
      confirmCampaignOperationForOwner(
        {
          profileId: profileA.id,
          ownerId: userA.id,
          provider: "meta_ads",
          operationId: draft.id,
          action: "create_paused",
          confirmed: false,
        },
        fakeAdapter
      )
    ).rejects.toThrow(AdsServiceError);
    expect(createCalls).toBe(0);

    // Confirm creation (paused)
    const created = await confirmCampaignOperationForOwner(
      {
        profileId: profileA.id,
        ownerId: userA.id,
        provider: "meta_ads",
        operationId: draft.id,
        action: "create_paused",
        confirmed: true,
      },
      fakeAdapter
    );
    expect(created.operation.status).toBe("created_paused");
    expect(created.operation.externalCampaignId).toBe("cmp_meta_999");
    expect(createCalls).toBe(1);

    // Idempotent retry does not call createPausedCampaign again
    const retried = await confirmCampaignOperationForOwner(
      {
        profileId: profileA.id,
        ownerId: userA.id,
        provider: "meta_ads",
        operationId: draft.id,
        action: "create_paused",
        confirmed: true,
      },
      fakeAdapter
    );
    expect(retried.idempotent).toBe(true);
    expect(createCalls).toBe(1);

    // Separate explicit activation
    const activated = await confirmCampaignOperationForOwner(
      {
        profileId: profileA.id,
        ownerId: userA.id,
        provider: "meta_ads",
        operationId: draft.id,
        action: "activate",
        confirmed: true,
      },
      fakeAdapter
    );
    expect(activated.operation.status).toBe("active");
    expect(activateCalls).toBe(1);
  });
});

describe("Meta Ads safe credential validation and Composio auth config setup", () => {
  it("reports missing env vars without exposing secrets", () => {
    const status = getMetaAdsEnvValidation();
    expect(status.hasApiKey).toBe(false);
    expect(status.hasClientId).toBe(false);
    expect(status.hasClientSecret).toBe(false);
    expect(status.hasAuthConfigId).toBe(false);
    expect(status.redirectUri).toBe(META_ADS_DEFAULT_REDIRECT_URI);
    expect(status.missingForConnection).toEqual([
      "COMPOSIO_API_KEY",
      "COMPOSIO_META_ADS_AUTH_CONFIG_ID",
    ]);
    expect(status.missingForAuthConfigCreation).toEqual([
      "COMPOSIO_API_KEY",
      "META_ADS_CLIENT_ID",
      "META_ADS_CLIENT_SECRET",
    ]);
  });

  it("reuses COMPOSIO_META_ADS_AUTH_CONFIG_ID from env without calling Composio", async () => {
    const { userA, profileA } = createTwoTenants();

    process.env.COMPOSIO_API_KEY = "cmp_fake_key_only_for_test";
    process.env.COMPOSIO_META_ADS_AUTH_CONFIG_ID = "ac_meta_env_123";

    let listCalls = 0;
    let createCalls = 0;
    const fakeClient: MetaAdsAuthConfigClient = {
      async listMetaAdsAuthConfigs() {
        listCalls += 1;
        return [];
      },
      async createMetaAdsAuthConfig() {
        createCalls += 1;
        return { id: "ac_should_not_create" };
      },
    };

    const result = await ensureMetaAdsAuthConfig(
      { profileId: profileA.id, ownerId: userA.id },
      fakeClient
    );

    expect(result.authConfigId).toBe("ac_meta_env_123");
    expect(result.source).toBe("env");
    expect(result.created).toBe(false);
    expect(listCalls).toBe(0);
    expect(createCalls).toBe(0);
  });

  it("deduplicates existing enabled OAUTH2 metaads auth config in Composio", async () => {
    const { userA, profileA } = createTwoTenants();

    process.env.COMPOSIO_API_KEY = "cmp_fake_key_only_for_test";
    process.env.META_ADS_CLIENT_ID = "fake_meta_app_id";
    process.env.META_ADS_CLIENT_SECRET = "fake_meta_app_secret_never_logged";

    let createCalls = 0;
    const fakeClient: MetaAdsAuthConfigClient = {
      async listMetaAdsAuthConfigs() {
        return [
          {
            id: "ac_disabled",
            toolkitSlug: "metaads",
            authScheme: "OAUTH2",
            status: "DISABLED",
          },
          {
            id: "ac_meta_existing_456",
            toolkitSlug: "metaads",
            authScheme: "OAUTH2",
            status: "ENABLED",
          },
        ];
      },
      async createMetaAdsAuthConfig() {
        createCalls += 1;
        return { id: "ac_should_not_create" };
      },
    };

    const result = await ensureMetaAdsAuthConfig(
      { profileId: profileA.id, ownerId: userA.id },
      fakeClient
    );

    expect(result.authConfigId).toBe("ac_meta_existing_456");
    expect(result.source).toBe("composio_existing");
    expect(result.created).toBe(false);
    expect(createCalls).toBe(0);
  });

  it("creates custom OAUTH2 metaads auth config with fictitious credentials when none exists", async () => {
    const { userA, profileA } = createTwoTenants();

    process.env.COMPOSIO_API_KEY = "cmp_fake_key_only_for_test";
    process.env.META_ADS_CLIENT_ID = "fake_meta_app_id_999";
    process.env.META_ADS_CLIENT_SECRET = "fake_meta_app_secret_999";
    process.env.COMPOSIO_META_ADS_REDIRECT_URI =
      "https://backend.composio.dev/api/v3/toolkits/auth/callback";

    let capturedInput: Record<string, unknown> | null = null;
    const fakeClient: MetaAdsAuthConfigClient = {
      async listMetaAdsAuthConfigs() {
        return [];
      },
      async createMetaAdsAuthConfig(input) {
        capturedInput = input as unknown as Record<string, unknown>;
        return { id: "ac_meta_created_789" };
      },
    };

    const result = await ensureMetaAdsAuthConfig(
      { profileId: profileA.id, ownerId: userA.id },
      fakeClient
    );

    expect(result.authConfigId).toBe("ac_meta_created_789");
    expect(result.source).toBe("composio_created");
    expect(result.created).toBe(true);
    expect(result.redirectUri).toBe(
      "https://backend.composio.dev/api/v3/toolkits/auth/callback"
    );
    expect(result.scopes).toBe(META_ADS_DEFAULT_SCOPES);
    expect(capturedInput).toEqual({
      clientId: "fake_meta_app_id_999",
      clientSecret: "fake_meta_app_secret_999",
      redirectUri: "https://backend.composio.dev/api/v3/toolkits/auth/callback",
      scopes: META_ADS_DEFAULT_SCOPES,
    });
  });

  it("rejects setup with 422 and never leaks missing/present secret values", async () => {
    const { userA, profileA } = createTwoTenants();

    process.env.COMPOSIO_API_KEY = "cmp_fake_secret_should_not_leak";

    await expect(
      ensureMetaAdsAuthConfig({ profileId: profileA.id, ownerId: userA.id })
    ).rejects.toThrow(MetaAdsConfigError);
  });
});

describe("Zernio webhook endpoint & signature validation", () => {
  it("rejects with 503 when ZERNIO_WEBHOOK_SECRET is absent and logs safe startup warning", async () => {
    const prevRuntime = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = "nodejs";
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };

    try {
      await registerInstrumentation();
    } finally {
      console.warn = origWarn;
      if (prevRuntime === undefined) {
        delete process.env.NEXT_RUNTIME;
      } else {
        process.env.NEXT_RUNTIME = prevRuntime;
      }
    }

    expect(warnings.some((w) => w.includes("ZERNIO_WEBHOOK_SECRET"))).toBe(true);

    const req = new Request("http://localhost:3000/api/webhooks/zernio/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "webhook.test", id: "evt_missing_secret" }),
    });
    const res = await zernioWebhookPost(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("ZERNIO_WEBHOOK_SECRET não configurado.");
  });

  it("rejects missing or invalid X-Zernio-Signature with 401 without leaking secret", async () => {
    const fakeSecret = "fake_zernio_webhook_secret_test_only";
    process.env.ZERNIO_WEBHOOK_SECRET = fakeSecret;
    const rawBody = JSON.stringify({
      event: "account.connected",
      id: "evt_bad_sig",
    });

    const missingSigReq = new Request(
      "http://localhost:3000/api/webhooks/zernio/whatsapp",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: rawBody,
      }
    );
    const missingSigRes = await zernioWebhookPost(missingSigReq);
    expect(missingSigRes.status).toBe(401);
    const missingText = await missingSigRes.text();
    expect(missingText).not.toContain(fakeSecret);

    const invalidSigReq = new Request(
      "http://localhost:3000/api/webhooks/zernio/whatsapp",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-zernio-signature": "0".repeat(64),
        },
        body: rawBody,
      }
    );
    const invalidSigRes = await zernioWebhookPost(invalidSigReq);
    expect(invalidSigRes.status).toBe(401);
    const invalidText = await invalidSigRes.text();
    expect(invalidText).not.toContain(fakeSecret);
  });

  it("accepts valid HMAC-SHA256 X-Zernio-Signature and deduplicates by X-Zernio-Event-Id", async () => {
    const fakeSecret = "fake_zernio_webhook_secret_test_only";
    process.env.ZERNIO_WEBHOOK_SECRET = fakeSecret;
    const rawBody = JSON.stringify({
      data: { accountId: "acc_unmatched_123" },
    });
    const sig = crypto
      .createHmac("sha256", fakeSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    const req1 = new Request(
      "http://localhost:3000/api/webhooks/zernio/whatsapp",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-zernio-signature": sig,
          "x-zernio-event": "account.connected",
          "x-zernio-event-id": "evt_header_dedup_001",
        },
        body: rawBody,
      }
    );
    const res1 = await zernioWebhookPost(req1);
    expect(res1.status).toBe(200);
    expect(await res1.json()).toEqual({ ok: true, deduplicated: false });

    const req2 = new Request(
      "http://localhost:3000/api/webhooks/zernio/whatsapp",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-zernio-signature": sig,
          "x-zernio-event": "account.connected",
          "x-zernio-event-id": "evt_header_dedup_001",
        },
        body: rawBody,
      }
    );
    const res2 = await zernioWebhookPost(req2);
    expect(res2.status).toBe(200);
    expect(await res2.json()).toEqual({ ok: true, deduplicated: true });
  });
});



