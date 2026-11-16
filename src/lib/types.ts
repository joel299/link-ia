export type ThemeMode = "light" | "dark";

export type FontOption = "manrope" | "inter" | "dm-sans" | "system";

export type ButtonStyle = "rounded" | "soft" | "sharp";

export type ProfileStatus = "draft" | "published";

export type PublicBlockKey =
  | "booking"
  | "whatsapp"
  | "instagram"
  | "tiktok"
  | "custom_links"
  | "social_highlights"
  | "catalog";

export const DEFAULT_PUBLIC_ORDER: PublicBlockKey[] = [
  "booking",
  "whatsapp",
  "instagram",
  "tiktok",
  "custom_links",
  "social_highlights",
  "catalog",
];

export type CustomLinkIconType =
  | "link"
  | "map"
  | "store"
  | "calendar"
  | "phone"
  | "globe";

export interface CustomLinkItem {
  id: string;
  profileId: string;
  title: string;
  url: string;
  description: string;
  iconType: CustomLinkIconType;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCustomLinkItem {
  id: string;
  title: string;
  url: string;
  description: string;
  iconType: CustomLinkIconType;
}

export interface ProfileTheme {
  mode: ThemeMode;
  bgColor: string;
  textColor: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: FontOption;
  buttonStyle: ButtonStyle;
}

export interface Profile {
  id: string;
  ownerId: string;
  slug: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  coverBlur: number;
  instagramInput: string;
  instagramUrl: string | null;
  instagramEnabled: boolean;
  whatsappNumber: string;
  whatsappMessage: string;
  whatsappEnabled: boolean;
  bookingUrl: string | null;
  bookingLabel: string;
  bookingEnabled: boolean;
  publicOrder?: PublicBlockKey[];
  theme: ProfileTheme;
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProfile {
  slug: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  coverBlur?: number;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  bookingUrl: string | null;
  bookingLabel: string;
  internalBookingEnabled: boolean;
  internalBookingReason?: "active" | "disabled" | "disconnected" | "missing_whatsapp";
  bookingHorizonDays?: number;
  bookingServiceName?: string;
  bookingTimezone?: string;
  bookingSlotDurationMinutes?: number;
  catalogItems?: PublicCatalogItem[];
  customLinks?: PublicCustomLinkItem[];
  publicOrder?: PublicBlockKey[];
  tiktokUrl?: string | null;
  socialMediaItems?: PublicSocialMediaItem[];
  instagramConnectedPendingSync?: boolean;
  theme: ProfileTheme;
  updatedAt: string;
}

export type CalendarConnectionStatus =
  | "disconnected"
  | "pending"
  | "connected"
  | "expired"
  | "failed";

export interface CalendarConnectionView {
  provider: "google_calendar";
  status: CalendarConnectionStatus;
  calendarId: string;
  accountLabel: string | null;
  isMock: boolean;
  lastError: string | null;
  updatedAt: string | null;
}

export interface WeeklyAvailabilityDay {
  dayOfWeek: number; // 0 (Dom) .. 6 (Sab)
  enabled: boolean;
  startTime: string; // "09:00"
  endTime: string; // "18:00"
}

export interface BookingSettings {
  profileId: string;
  timezone: string; // IANA, ex: "America/Sao_Paulo"
  serviceName: string;
  slotDurationMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
  enabled: boolean;
  weeklySchedule: WeeklyAvailabilityDay[];
  updatedAt: string;
}

export interface AvailableSlot {
  startIso: string;
  endIso: string;
  label: string;
}

export interface PublicBookingConfirmation {
  id: string;
  slug: string;
  professionalName: string;
  serviceName: string;
  startIso: string;
  endIso: string;
  timezone: string;
  whatsappContactUrl: string | null;
  status: "confirmed";
}

export const DEFAULT_WEEKLY_SCHEDULE: WeeklyAvailabilityDay[] = [
  { dayOfWeek: 0, enabled: false, startTime: "09:00", endTime: "13:00" },
  { dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 2, enabled: true, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 3, enabled: true, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 4, enabled: true, startTime: "09:00", endTime: "18:00" },
  { dayOfWeek: 5, enabled: true, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 6, enabled: false, startTime: "09:00", endTime: "13:00" },
];

export interface ProfileUpdateInput {
  slug?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  coverBlur?: number;
  instagramInput?: string;
  instagramEnabled?: boolean;
  whatsappNumber?: string;
  whatsappMessage?: string;
  whatsappEnabled?: boolean;
  bookingUrl?: string | null;
  bookingLabel?: string;
  bookingEnabled?: boolean;
  publicOrder?: PublicBlockKey[];
  theme?: Partial<ProfileTheme>;
}

export interface ValidationErrors {
  [field: string]: string;
}

export type CatalogFlowType = "appointment" | "whatsapp";
export type CatalogAvailabilityStatus = "available" | "unavailable";

export interface CatalogItem {
  id: string;
  profileId: string;
  publicId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: "BRL";
  imageUrl: string | null;
  flowType: CatalogFlowType;
  availabilityStatus: CatalogAvailabilityStatus;
  isActive: boolean;
  durationMinutes: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCatalogItem {
  publicId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: "BRL";
  imageUrl: string | null;
  flowType: CatalogFlowType;
  availabilityStatus: CatalogAvailabilityStatus;
  durationMinutes: number | null;
}

export const DEFAULT_LIGHT_THEME: ProfileTheme = {
  mode: "light",
  bgColor: "#F4F6F2",
  textColor: "#18211C",
  primaryColor: "#16784E",
  accentColor: "#9A762F",
  fontFamily: "manrope",
  buttonStyle: "rounded",
};

export const DEFAULT_DARK_THEME: ProfileTheme = {
  mode: "dark",
  bgColor: "#101312",
  textColor: "#F0F4F0",
  primaryColor: "#33B978",
  accentColor: "#E2C987",
  fontFamily: "manrope",
  buttonStyle: "rounded",
};

export type SocialProvider = "instagram" | "tiktok" | "meta_ads" | "tiktok_ads";
export type OrganicSocialProvider = "instagram" | "tiktok";
export type AdsProvider = "meta_ads" | "tiktok_ads";

export type SocialConnectionStatus =
  | "disconnected"
  | "pending"
  | "incomplete"
  | "connected"
  | "expired"
  | "failed"
  | "pending_config";

export interface SocialAssetView {
  id: string;
  assetType: string;
  externalId: string;
  displayName: string;
  isSelected: boolean;
}

export interface SocialMediaItemView {
  id: string;
  provider: OrganicSocialProvider;
  externalId: string;
  mediaType: string;
  caption: string;
  permalink: string;
  thumbnailUrl: string | null;
  likeCount: number | null;
  commentCount: number | null;
  position: number;
  publicEnabled: boolean;
  publishedAt: string | null;
  syncedAt: string;
}

export interface PublicSocialMediaItem {
  externalId: string;
  mediaType: string;
  caption: string;
  permalink: string;
  thumbnailUrl: string | null;
  likeCount: number | null;
  commentCount: number | null;
}

export interface SocialConnectionView {
  provider: SocialProvider;
  toolkitSlug: string;
  status: SocialConnectionStatus;
  configReady: boolean;
  configRequirements: string[];
  managedOAuthSupported: boolean;
  accountLabel: string | null;
  canonicalUrl: string | null;
  selectedAssetId: string | null;
  selectedAssetName: string | null;
  scopesSummary: string[];
  lastSyncedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
  assets: SocialAssetView[];
}

export type WhatsAppConnectionStatus =
  | "disconnected"
  | "connecting"
  | "incomplete"
  | "connected"
  | "expired"
  | "failed"
  | "ineligible"
  | "pending_config";

export interface WhatsAppCapabilities {
  coexistenceConfirmed: boolean;
  messagingSupported: boolean;
  templatesSupported: boolean;
  groupsApiSupported: boolean;
  note?: string;
}

export interface WhatsAppConnectionView {
  provider: "zernio";
  status: WhatsAppConnectionStatus;
  configReady: boolean;
  configRequirements: string[];
  onboardingMode: "business_app" | "api";
  maskedPhone: string | null;
  displayName: string | null;
  hasWaba: boolean;
  hasPhoneNumberId: boolean;
  capabilities: WhatsAppCapabilities;
  composioStatus: "disabled_pending_validation";
  composioNote: string;
  lastVerifiedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

export type AdsDatePreset =
  | "last_7d"
  | "last_30d"
  | "this_month"
  | "last_month"
  | "custom";

export interface AdsDateRangeFilter {
  datePreset: AdsDatePreset;
  since?: string;
  until?: string;
}

export interface AdCampaignView {
  id: string;
  name: string;
  status: string;
  objective: string;
  dailyBudget: string | null;
  spend: string | null;
  impressions: string | null;
  clicks: string | null;
  reach?: string | null;
  ctr?: string | null;
  cpc?: string | null;
  cpm?: string | null;
}

export interface AdCampaignOperationView {
  id: string;
  provider: AdsProvider;
  adAccountId: string;
  idempotencyKey: string;
  status: "draft" | "created_paused" | "active" | "failed";
  externalCampaignId: string | null;
  params: {
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
  };
  estimatedBudgetSummary: string;
  confirmedAt: string | null;
  activatedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export type UserRole = "admin" | "client";

export type FeatureKey =
  | "whatsapp"
  | "instagram"
  | "facebook_social"
  | "meta_ads"
  | "tiktok_organic"
  | "tiktok_ads"
  | "google_calendar"
  | "catalog";

export const ALL_FEATURE_KEYS: FeatureKey[] = [
  "whatsapp",
  "instagram",
  "facebook_social",
  "meta_ads",
  "tiktok_organic",
  "tiktok_ads",
  "google_calendar",
  "catalog",
];

export type UserPermissions = Record<FeatureKey, boolean>;

export interface FeatureDescriptor {
  key: FeatureKey;
  label: string;
  description: string;
  category: "Canais sociais" | "Tráfego pago" | "Agenda e catálogo";
}

export const FEATURE_CATALOG: FeatureDescriptor[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    description:
      "Link público de conversa (wa.me) e conexão do WhatsApp Business com coexistência.",
    category: "Canais sociais",
  },
  {
    key: "instagram",
    label: "Instagram",
    description:
      "Link oficial do perfil, conexão da conta e exibição de destaques na página pública.",
    category: "Canais sociais",
  },
  {
    key: "facebook_social",
    label: "Facebook social",
    description:
      "Conexão orgânica da página/perfil do Facebook em Canais conectados (separado de Meta Ads).",
    category: "Canais sociais",
  },
  {
    key: "tiktok_organic",
    label: "TikTok orgânico",
    description:
      "Conexão orgânica do perfil TikTok e exibição do link público (separado de TikTok Ads).",
    category: "Canais sociais",
  },
  {
    key: "meta_ads",
    label: "Meta Ads (Tráfego pago)",
    description:
      "Acesso à aba Tráfego pago para contas de anúncios e campanhas Meta Ads.",
    category: "Tráfego pago",
  },
  {
    key: "tiktok_ads",
    label: "TikTok Ads (Tráfego pago)",
    description:
      "Acesso à aba Tráfego pago para contas de anunciante e campanhas TikTok Ads.",
    category: "Tráfego pago",
  },
  {
    key: "google_calendar",
    label: "Google Agenda / Agendamento",
    description:
      "Conexão com Google Agenda, grade de horários e página pública de reservas.",
    category: "Agenda e catálogo",
  },
  {
    key: "catalog",
    label: "Catálogo de serviços e produtos",
    description:
      "Cadastro e gerenciamento de serviços/produtos com carrossel na página pública.",
    category: "Agenda e catálogo",
  },
];

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  permissions: UserPermissions;
  createdAt: string;
  updatedAt: string | null;
}



