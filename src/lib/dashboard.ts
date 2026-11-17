import crypto from "node:crypto";
import {
  AdsServiceError,
  getAdsOverviewForOwner,
  validateAdsDateRange,
} from "./ads-service";
import { getDb } from "./db";
import { getUserPermissions } from "./permissions";
import { getPublishedPublicProfileBySlug } from "./profiles";
import type {
  AdsDatePreset,
  AdsDateRangeFilter,
  AdsProvider,
  UserPermissions,
} from "./types";

export type PublicInteractionEventType =
  | "whatsapp_click"
  | "instagram_click"
  | "booking_click";

export type DashboardPeriod = AdsDatePreset;

export const VALID_PUBLIC_EVENT_TYPES: ReadonlySet<PublicInteractionEventType> =
  new Set(["whatsapp_click", "instagram_click", "booking_click"]);

export const VALID_DASHBOARD_PERIODS: ReadonlySet<DashboardPeriod> = new Set([
  "last_7d",
  "last_30d",
  "this_month",
  "last_month",
  "custom",
]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_EVENTS = 60;
const publicEventRateStore = new Map<
  string,
  { windowStart: number; count: number }
>();

export function clearPublicEventRateLimiterForTests(): void {
  publicEventRateStore.clear();
}

function checkPublicEventRateLimit(key: string, nowMs: number): boolean {
  const existing = publicEventRateStore.get(key);
  if (!existing || nowMs - existing.windowStart >= RATE_LIMIT_WINDOW_MS) {
    publicEventRateStore.set(key, { windowStart: nowMs, count: 1 });
    if (publicEventRateStore.size > 5000) {
      for (const [k, entry] of publicEventRateStore.entries()) {
        if (nowMs - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
          publicEventRateStore.delete(k);
        }
      }
    }
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX_EVENTS) {
    return false;
  }
  existing.count += 1;
  return true;
}

function isValidCalendarDate(isoDate: string): boolean {
  const [yStr, mStr, dStr] = isoDate.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return false;
  }
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

function formatBrDateFromIso(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function normalizeDashboardPeriod(raw?: string | null): DashboardPeriod {
  const trimmed = (raw ?? "").trim() as DashboardPeriod;
  return VALID_DASHBOARD_PERIODS.has(trimmed) ? trimmed : "last_30d";
}

export function validateDashboardDateRange(input?: {
  period?: string | null;
  since?: string | null;
  until?: string | null;
}): AdsDateRangeFilter {
  const range = validateAdsDateRange({
    datePreset: input?.period,
    since: input?.since,
    until: input?.until,
  });

  if (range.datePreset === "custom") {
    if (
      !range.since ||
      !range.until ||
      !isValidCalendarDate(range.since) ||
      !isValidCalendarDate(range.until)
    ) {
      throw new AdsServiceError(
        "Informe datas válidas no formato YYYY-MM-DD para o período personalizado.",
        400
      );
    }
  }

  return range;
}

export function getDateWindowForPeriod(
  rangeInput: DashboardPeriod | AdsDateRangeFilter,
  now: Date = new Date()
): { startIso: string; endIso: string; label: string } {
  const range: AdsDateRangeFilter =
    typeof rangeInput === "string" ? { datePreset: rangeInput } : rangeInput;
  const period = range.datePreset;

  if (period === "custom" && range.since && range.until) {
    const startIso = `${range.since}T00:00:00.000Z`;
    const endDate = new Date(`${range.until}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    return {
      startIso,
      endIso: endDate.toISOString(),
      label: `${formatBrDateFromIso(range.since)} – ${formatBrDateFromIso(range.until)}`,
    };
  }

  const end = new Date(now.getTime() + 1000);
  if (period === "last_7d") {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 7);
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: "Últimos 7 dias",
    };
  }
  if (period === "this_month") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
    );
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: "Este mês",
    };
  }
  if (period === "last_month") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0)
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
    );
    return {
      startIso: start.toISOString(),
      endIso: monthEnd.toISOString(),
      label: "Mês passado",
    };
  }
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 30);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: "Últimos 30 dias",
  };
}

export function recordPublicInteractionEvent(params: {
  slug: string;
  eventType: unknown;
  clientKey?: string;
}): { ok: boolean; status: number; error?: string } {
  const slug = (params.slug ?? "").trim().toLowerCase();
  if (!slug || slug.length > 80 || !/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, status: 400, error: "Slug inválido." };
  }

  if (
    typeof params.eventType !== "string" ||
    !VALID_PUBLIC_EVENT_TYPES.has(params.eventType as PublicInteractionEventType)
  ) {
    return { ok: false, status: 400, error: "Tipo de evento inválido." };
  }
  const eventType = params.eventType as PublicInteractionEventType;

  const clientKey = `${params.clientKey || "anon"}:${slug}`;
  if (!checkPublicEventRateLimit(clientKey, Date.now())) {
    return {
      ok: false,
      status: 429,
      error: "Muitas solicitações. Aguarde alguns instantes.",
    };
  }

  const db = getDb();
  const profileRow = db
    .prepare(
      "SELECT id, owner_id FROM profiles WHERE slug = ? AND status = 'published' LIMIT 1"
    )
    .get(slug) as { id: string; owner_id: string } | undefined;

  if (!profileRow) {
    return { ok: false, status: 404, error: "Perfil publicado não encontrado." };
  }

  const publicProfile = getPublishedPublicProfileBySlug(slug);
  if (!publicProfile) {
    return { ok: false, status: 404, error: "Perfil publicado não encontrado." };
  }

  if (eventType === "whatsapp_click" && !publicProfile.whatsappUrl) {
    return { ok: false, status: 400, error: "Canal não habilitado neste perfil." };
  }
  if (eventType === "instagram_click" && !publicProfile.instagramUrl) {
    return { ok: false, status: 400, error: "Canal não habilitado neste perfil." };
  }
  if (
    eventType === "booking_click" &&
    !publicProfile.internalBookingEnabled &&
    !publicProfile.bookingUrl
  ) {
    return { ok: false, status: 400, error: "Agendamento não habilitado neste perfil." };
  }

  db.prepare(
    `INSERT INTO public_interaction_events (id, profile_id, owner_id, event_type, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    profileRow.id,
    profileRow.owner_id,
    eventType,
    new Date().toISOString()
  );

  return { ok: true, status: 201 };
}

export interface ConnectedAccountItem {
  id: string;
  channel:
    | "whatsapp"
    | "instagram"
    | "facebook_social"
    | "tiktok_organic"
    | "meta_ads"
    | "tiktok_ads"
    | "google_calendar";
  channelLabel: string;
  accountLabel: string;
  profileId: string;
  profileName: string;
  avatarUrl: string | null;
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutMetricView {
  available: boolean;
  total: number;
  unitLabel: string;
  segments: DonutSegment[];
  unavailableReason: string | null;
}

export interface DashboardSnapshot {
  period: DashboardPeriod;
  since: string | null;
  until: string | null;
  periodLabel: string;
  profileCount: number;
  connectedAccounts: {
    total: number;
    items: ConnectedAccountItem[];
  };
  interactions: {
    whatsappClicks: number;
    instagramClicks: number;
    bookingClicks: number;
    confirmedInternalBookings: number;
  };
  impressionsCard: {
    available: boolean;
    total: number;
    sourceLabel: string;
    unavailableReason: string | null;
  };
  charts: {
    clicks: DonutMetricView;
    impressions: DonutMetricView;
    reach: DonutMetricView;
  };
  campaigns: {
    names: string[];
    hasAdsPermission: boolean;
    hasConnectedAdAccount: boolean;
    error: string | null;
  };
}

const CHART_PALETTE = [
  "#33B978",
  "#E2C987",
  "#5ED19B",
  "#C7A45B",
  "#84DCB1",
  "#96A69B",
];

function parseMetricInt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
}

function buildTopSegments(
  entries: Array<{ label: string; value: number }>,
  maxItems = 5
): DonutSegment[] {
  const positive = entries
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
  if (positive.length === 0) return [];

  const head = positive.slice(0, maxItems);
  const tail = positive.slice(maxItems);
  if (tail.length > 0) {
    head.push({
      label: "Outras campanhas",
      value: tail.reduce((acc, item) => acc + item.value, 0),
    });
  }

  return head.map((item, idx) => ({
    label: item.label,
    value: item.value,
    color: CHART_PALETTE[idx % CHART_PALETTE.length],
  }));
}

export async function getDashboardSnapshotForOwner(params: {
  ownerId: string;
  permissions?: UserPermissions;
  period?: string | null;
  since?: string | null;
  until?: string | null;
}): Promise<DashboardSnapshot> {
  const db = getDb();
  const perms = params.permissions ?? getUserPermissions(params.ownerId);
  const dateRange = validateDashboardDateRange({
    period: params.period,
    since: params.since,
    until: params.until,
  });
  const period = dateRange.datePreset;
  const window = getDateWindowForPeriod(dateRange);

  const profileRows = db
    .prepare(
      `SELECT id, display_name, slug, avatar_url
       FROM profiles
       WHERE owner_id = ?
       ORDER BY created_at ASC`
    )
    .all(params.ownerId) as Array<{
    id: string;
    display_name: string;
    slug: string;
    avatar_url: string | null;
  }>;

  const profileMap = new Map(
    profileRows.map((p) => [
      p.id,
      {
        name: p.display_name || p.slug,
        avatarUrl: p.avatar_url ?? null,
      },
    ])
  );

  // 1. Connected accounts (strictly status === 'connected', deduplicated by profileId + channel)
  const connectedMap = new Map<string, ConnectedAccountItem>();

  if (perms.whatsapp) {
    const waRows = db
      .prepare(
        `SELECT profile_id, display_name, masked_phone
         FROM whatsapp_connections
         WHERE owner_id = ? AND status = 'connected' AND revoked_at IS NULL`
      )
      .all(params.ownerId) as Array<{
      profile_id: string;
      display_name: string | null;
      masked_phone: string | null;
    }>;

    for (const row of waRows) {
      const prof = profileMap.get(row.profile_id);
      if (!prof) continue;
      const key = `${row.profile_id}:whatsapp`;
      connectedMap.set(key, {
        id: key,
        channel: "whatsapp",
        channelLabel: "WhatsApp Business",
        accountLabel: row.display_name || row.masked_phone || prof.name,
        profileId: row.profile_id,
        profileName: prof.name,
        avatarUrl: prof.avatarUrl,
      });
    }
  }

  const socialRows = db
    .prepare(
      `SELECT profile_id, provider, account_label, selected_asset_name
       FROM social_connections
       WHERE owner_id = ? AND status = 'connected' AND revoked_at IS NULL`
    )
    .all(params.ownerId) as Array<{
    profile_id: string;
    provider: "instagram" | "tiktok" | "meta_ads" | "tiktok_ads";
    account_label: string | null;
    selected_asset_name: string | null;
  }>;

  const adsProfilesToFetch: Array<{ profileId: string; provider: AdsProvider }> = [];

  for (const row of socialRows) {
    const prof = profileMap.get(row.profile_id);
    if (!prof) continue;

    if (row.provider === "instagram" && perms.instagram) {
      const key = `${row.profile_id}:instagram`;
      connectedMap.set(key, {
        id: key,
        channel: "instagram",
        channelLabel: "Instagram",
        accountLabel: row.account_label || prof.name,
        profileId: row.profile_id,
        profileName: prof.name,
        avatarUrl: prof.avatarUrl,
      });
    } else if (row.provider === "tiktok" && perms.tiktok_organic) {
      const key = `${row.profile_id}:tiktok_organic`;
      connectedMap.set(key, {
        id: key,
        channel: "tiktok_organic",
        channelLabel: "TikTok",
        accountLabel: row.account_label || prof.name,
        profileId: row.profile_id,
        profileName: prof.name,
        avatarUrl: prof.avatarUrl,
      });
    } else if (row.provider === "meta_ads") {
      if (perms.facebook_social) {
        const fbKey = `${row.profile_id}:facebook_social`;
        connectedMap.set(fbKey, {
          id: fbKey,
          channel: "facebook_social",
          channelLabel: "Facebook",
          accountLabel: row.selected_asset_name || row.account_label || prof.name,
          profileId: row.profile_id,
          profileName: prof.name,
          avatarUrl: prof.avatarUrl,
        });
      }
      if (perms.meta_ads) {
        const adsKey = `${row.profile_id}:meta_ads`;
        connectedMap.set(adsKey, {
          id: adsKey,
          channel: "meta_ads",
          channelLabel: "Meta Ads",
          accountLabel: row.selected_asset_name || row.account_label || prof.name,
          profileId: row.profile_id,
          profileName: prof.name,
          avatarUrl: prof.avatarUrl,
        });
        adsProfilesToFetch.push({ profileId: row.profile_id, provider: "meta_ads" });
      }
    } else if (row.provider === "tiktok_ads" && perms.tiktok_ads) {
      const adsKey = `${row.profile_id}:tiktok_ads`;
      connectedMap.set(adsKey, {
        id: adsKey,
        channel: "tiktok_ads",
        channelLabel: "TikTok Ads",
        accountLabel: row.selected_asset_name || row.account_label || prof.name,
        profileId: row.profile_id,
        profileName: prof.name,
        avatarUrl: prof.avatarUrl,
      });
      adsProfilesToFetch.push({ profileId: row.profile_id, provider: "tiktok_ads" });
    }
  }

  if (perms.google_calendar && profileRows.length > 0) {
    const calRows = db
      .prepare(
        `SELECT cc.profile_id, cc.account_label
         FROM calendar_connections cc
         JOIN profiles p ON p.id = cc.profile_id
         WHERE p.owner_id = ? AND cc.status = 'connected' AND cc.revoked_at IS NULL`
      )
      .all(params.ownerId) as Array<{
      profile_id: string;
      account_label: string | null;
    }>;

    for (const row of calRows) {
      const prof = profileMap.get(row.profile_id);
      if (!prof) continue;
      const key = `${row.profile_id}:google_calendar`;
      connectedMap.set(key, {
        id: key,
        channel: "google_calendar",
        channelLabel: "Google Agenda",
        accountLabel: row.account_label || prof.name,
        profileId: row.profile_id,
        profileName: prof.name,
        avatarUrl: prof.avatarUrl,
      });
    }
  }

  const connectedItems = Array.from(connectedMap.values());

  // 2. Public interaction events in the selected period
  const eventRows = db
    .prepare(
      `SELECT event_type, COUNT(*) as total
       FROM public_interaction_events
       WHERE owner_id = ? AND created_at >= ? AND created_at < ?
       GROUP BY event_type`
    )
    .all(params.ownerId, window.startIso, window.endIso) as Array<{
    event_type: PublicInteractionEventType;
    total: number;
  }>;

  let whatsappClicks = 0;
  let instagramClicks = 0;
  let bookingClicks = 0;
  for (const row of eventRows) {
    if (row.event_type === "whatsapp_click" && perms.whatsapp) {
      whatsappClicks = Number(row.total) || 0;
    } else if (row.event_type === "instagram_click" && perms.instagram) {
      instagramClicks = Number(row.total) || 0;
    } else if (row.event_type === "booking_click") {
      bookingClicks = Number(row.total) || 0;
    }
  }

  let confirmedInternalBookings = 0;
  if (perms.google_calendar) {
    const bookingRow = db
      .prepare(
        `SELECT COUNT(*) as total
         FROM bookings b
         JOIN profiles p ON p.id = b.profile_id
         WHERE p.owner_id = ? AND b.status = 'confirmed' AND b.created_at >= ? AND b.created_at < ?`
      )
      .get(params.ownerId, window.startIso, window.endIso) as
      | { total: number }
      | undefined;
    confirmedInternalBookings = Number(bookingRow?.total) || 0;
  }

  // 3. Paid traffic campaigns & metrics for the same period
  const hasAdsPermission = Boolean(perms.meta_ads || perms.tiktok_ads);
  const campaignNamesSet = new Set<string>();
  const impressionEntries: Array<{ label: string; value: number }> = [];
  const reachEntries: Array<{ label: string; value: number }> = [];
  let totalAdClicks = 0;
  let hasAdClicks = false;
  let hasReach = false;
  let hasImpressions = false;
  let adsFetchError: string | null = null;
  let hasConnectedAdAccount = false;

  if (hasAdsPermission && adsProfilesToFetch.length > 0) {
    const results = await Promise.all(
      adsProfilesToFetch.map(async ({ profileId, provider }) => {
        try {
          return await getAdsOverviewForOwner({
            profileId,
            ownerId: params.ownerId,
            provider,
            sync: false,
            dateRange,
          });
        } catch {
          return null;
        }
      })
    );

    for (const overview of results) {
      if (!overview) continue;
      if (
        overview.connection.status === "connected" &&
        overview.connection.selectedAdAccountId
      ) {
        hasConnectedAdAccount = true;
      }
      if (overview.campaignsError && !adsFetchError) {
        adsFetchError = overview.campaignsError;
      }
      for (const camp of overview.campaigns) {
        const cleanName = camp.name.trim();
        if (cleanName) {
          campaignNamesSet.add(cleanName);
        }
        const imp = parseMetricInt(camp.impressions);
        if (imp !== null) {
          hasImpressions = true;
          impressionEntries.push({
            label: cleanName || "Campanha",
            value: imp,
          });
        }
        const reach = parseMetricInt(camp.reach);
        if (reach !== null) {
          hasReach = true;
          reachEntries.push({
            label: cleanName || "Campanha",
            value: reach,
          });
        }
        const clk = parseMetricInt(camp.clicks);
        if (clk !== null) {
          hasAdClicks = true;
          totalAdClicks += clk;
        }
      }
    }
  }

  const clickSegmentsRaw: Array<{ label: string; value: number; color: string }> = [];
  if (perms.whatsapp && whatsappClicks > 0) {
    clickSegmentsRaw.push({
      label: "Cliques no WhatsApp",
      value: whatsappClicks,
      color: CHART_PALETTE[0],
    });
  }
  if (perms.instagram && instagramClicks > 0) {
    clickSegmentsRaw.push({
      label: "Cliques no Instagram",
      value: instagramClicks,
      color: CHART_PALETTE[1],
    });
  }
  if (bookingClicks > 0) {
    clickSegmentsRaw.push({
      label: "Cliques em agendamento",
      value: bookingClicks,
      color: CHART_PALETTE[2],
    });
  }
  if (hasAdClicks && totalAdClicks > 0) {
    clickSegmentsRaw.push({
      label: "Cliques em anúncios",
      value: totalAdClicks,
      color: CHART_PALETTE[3],
    });
  }
  const totalClicks =
    whatsappClicks + instagramClicks + bookingClicks + (hasAdClicks ? totalAdClicks : 0);

  const impressionSegments = buildTopSegments(impressionEntries);
  const totalImpressions = impressionEntries.reduce((acc, item) => acc + item.value, 0);

  const reachSegments = buildTopSegments(reachEntries);
  const totalReach = reachEntries.reduce((acc, item) => acc + item.value, 0);

  const impressionsUnavailableReason = !hasAdsPermission
    ? "Visualizações de posts orgânicos não são fornecidas pela sincronização atual do Instagram, e os módulos de anúncios não estão habilitados para sua conta."
    : !hasConnectedAdAccount
      ? "Conecte e selecione uma conta de anúncios em Tráfego pago para acompanhar impressões oficiais. Cliques no Instagram não são contados como visualizações."
      : adsFetchError
        ? adsFetchError
        : !hasImpressions
          ? "Nenhuma impressão de anúncio retornada para o período selecionado."
          : null;

  const reachUnavailableReason = !hasAdsPermission
    ? "Alcance oficial requer módulo de tráfego pago habilitado."
    : !hasConnectedAdAccount
      ? "Conecte e selecione uma conta de anúncios (Meta Ads) para consultar alcance no período."
      : adsFetchError
        ? adsFetchError
        : !hasReach
          ? "O provedor ou conta selecionada não retornou métrica de alcance para este período."
          : null;

  return {
    period,
    since: dateRange.datePreset === "custom" ? (dateRange.since ?? null) : null,
    until: dateRange.datePreset === "custom" ? (dateRange.until ?? null) : null,
    periodLabel: window.label,
    profileCount: profileRows.length,
    connectedAccounts: {
      total: connectedItems.length,
      items: connectedItems,
    },
    interactions: {
      whatsappClicks,
      instagramClicks,
      bookingClicks,
      confirmedInternalBookings,
    },
    impressionsCard: {
      available: hasImpressions,
      total: totalImpressions,
      sourceLabel: hasImpressions
        ? "Impressões oficiais de anúncios (tráfego pago)"
        : "Fonte oficial de visualizações indisponível",
      unavailableReason: impressionsUnavailableReason,
    },
    charts: {
      clicks: {
        available: true,
        total: totalClicks,
        unitLabel: "cliques",
        segments: clickSegmentsRaw,
        unavailableReason:
          totalClicks === 0
            ? "Nenhum clique registrado nos links públicos ou anúncios neste período."
            : null,
      },
      impressions: {
        available: hasImpressions,
        total: totalImpressions,
        unitLabel: "impressões",
        segments: impressionSegments,
        unavailableReason: impressionsUnavailableReason,
      },
      reach: {
        available: hasReach,
        total: totalReach,
        unitLabel: "alcance",
        segments: reachSegments,
        unavailableReason: reachUnavailableReason,
      },
    },
    campaigns: {
      names: Array.from(campaignNamesSet),
      hasAdsPermission,
      hasConnectedAdAccount,
      error: adsFetchError,
    },
  };
}
