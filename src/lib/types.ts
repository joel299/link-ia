export type ThemeMode = "light" | "dark";

export type FontOption = "manrope" | "inter" | "dm-sans" | "system";

export type ButtonStyle = "rounded" | "soft" | "sharp";

export type ProfileStatus = "draft" | "published";

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
  instagramInput: string;
  instagramUrl: string | null;
  instagramEnabled: boolean;
  whatsappNumber: string;
  whatsappMessage: string;
  whatsappEnabled: boolean;
  bookingUrl: string | null;
  bookingLabel: string;
  bookingEnabled: boolean;
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
  instagramInput?: string;
  instagramEnabled?: boolean;
  whatsappNumber?: string;
  whatsappMessage?: string;
  whatsappEnabled?: boolean;
  bookingUrl?: string | null;
  bookingLabel?: string;
  bookingEnabled?: boolean;
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

