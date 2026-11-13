import crypto from "node:crypto";
import { listPublishedCatalogItemsByProfileId } from "./catalog";
import { getDb } from "./db";
import {
  DEFAULT_LIGHT_THEME,
  Profile,
  ProfileStatus,
  ProfileTheme,
  ProfileUpdateInput,
  PublicProfile,
  ValidationErrors,
} from "./types";
import {
  normalizeInstagramUrl,
  normalizeSlug,
  normalizeWhatsApp,
  sanitizePlainText,
  TEXT_LIMITS,
  validateAvatarUrl,
  validateBookingUrl,
  validateProfileForPublish,
  validateSlug,
  validateTheme,
} from "./validation";

interface ProfileRow {
  id: string;
  owner_id: string;
  slug: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  instagram_input: string;
  instagram_url: string | null;
  instagram_enabled: number;
  whatsapp_number: string;
  whatsapp_message: string;
  whatsapp_enabled: number;
  booking_url: string | null;
  booking_label: string;
  booking_enabled: number;
  theme_json: string;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

function parseThemeJson(raw: string): ProfileTheme {
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileTheme>;
    return validateTheme(parsed).theme;
  } catch {
    return { ...DEFAULT_LIGHT_THEME };
  }
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    instagramInput: row.instagram_input,
    instagramUrl: row.instagram_url,
    instagramEnabled: Boolean(row.instagram_enabled),
    whatsappNumber: row.whatsapp_number,
    whatsappMessage: row.whatsapp_message,
    whatsappEnabled: Boolean(row.whatsapp_enabled),
    bookingUrl: row.booking_url,
    bookingLabel: row.booking_label,
    bookingEnabled: Boolean(row.booking_enabled),
    theme: parseThemeJson(row.theme_json),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function suggestAvailableSlug(baseSlug: string): string | undefined {
  const db = getDb();
  const trimmedBase = baseSlug.slice(0, 36).replace(/-+$/, "");

  for (let i = 2; i <= 50; i++) {
    const candidate = `${trimmedBase}-${i}`;
    if (!validateSlug(candidate).valid) continue;
    const exists = db
      .prepare("SELECT 1 FROM profiles WHERE slug = ?")
      .get(candidate);
    if (!exists) return candidate;
  }

  const randomSuffix = crypto.randomBytes(2).toString("hex");
  const fallback = `${trimmedBase.slice(0, 35)}-${randomSuffix}`;
  if (validateSlug(fallback).valid) {
    const exists = db
      .prepare("SELECT 1 FROM profiles WHERE slug = ?")
      .get(fallback);
    if (!exists) return fallback;
  }
  return undefined;
}

export function isSlugAvailable(
  rawSlug: string,
  excludeProfileId?: string
): {
  available: boolean;
  normalized: string;
  suggestion?: string;
  error?: string;
} {
  const normalized = normalizeSlug(rawSlug);
  const check = validateSlug(normalized);

  if (!check.valid) {
    return {
      available: false,
      normalized,
      error: check.error,
    };
  }

  const db = getDb();
  const existing = excludeProfileId
    ? db
        .prepare("SELECT id FROM profiles WHERE slug = ? AND id != ?")
        .get(normalized, excludeProfileId)
    : db.prepare("SELECT id FROM profiles WHERE slug = ?").get(normalized);

  if (existing) {
    return {
      available: false,
      normalized,
      suggestion: suggestAvailableSlug(normalized),
      error: "Este slug já está em uso.",
    };
  }

  return {
    available: true,
    normalized,
  };
}

export function listProfilesByOwner(ownerId: string): Profile[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM profiles WHERE owner_id = ? ORDER BY updated_at DESC")
    .all(ownerId) as ProfileRow[];

  return rows.map(rowToProfile);
}

export function getProfileByIdForOwner(
  id: string,
  ownerId: string
): { profile?: Profile; error?: "not_found" | "forbidden" } {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM profiles WHERE id = ?")
    .get(id) as ProfileRow | undefined;

  if (!row) {
    return { error: "not_found" };
  }
  if (row.owner_id !== ownerId) {
    return { error: "forbidden" };
  }
  return { profile: rowToProfile(row) };
}

export interface CreateProfileInput {
  displayName: string;
  slug: string;
  bio?: string;
  theme?: Partial<ProfileTheme>;
}

export function createProfile(
  ownerId: string,
  input: CreateProfileInput
): {
  profile?: Profile;
  errors?: ValidationErrors;
  status?: number;
  suggestion?: string;
} {
  const errors: ValidationErrors = {};

  const nameCheck = sanitizePlainText(
    input.displayName ?? "",
    TEXT_LIMITS.displayName
  );
  if (!nameCheck.value) {
    errors.displayName = "O nome público é obrigatório.";
  } else if (nameCheck.error) {
    errors.displayName = nameCheck.error;
  }

  const bioCheck = sanitizePlainText(input.bio ?? "", TEXT_LIMITS.bio);
  if (bioCheck.error) {
    errors.bio = bioCheck.error;
  }

  const themeCheck = validateTheme(input.theme);
  Object.assign(errors, themeCheck.errors);

  const slugCheck = isSlugAvailable(input.slug ?? "");
  if (!slugCheck.available) {
    if (slugCheck.suggestion) {
      return {
        errors: {
          ...errors,
          slug: slugCheck.error ?? "Este slug já está em uso.",
        },
        status: 409,
        suggestion: slugCheck.suggestion,
      };
    }
    errors.slug = slugCheck.error ?? "Slug inválido.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, status: 400 };
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO profiles (
        id, owner_id, slug, display_name, bio, avatar_url,
        instagram_input, instagram_url, instagram_enabled,
        whatsapp_number, whatsapp_message, whatsapp_enabled,
        booking_url, booking_label, booking_enabled,
        theme_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      ownerId,
      slugCheck.normalized,
      nameCheck.value,
      bioCheck.value,
      null,
      "",
      null,
      1,
      "",
      "",
      1,
      null,
      "Agendar horário",
      1,
      JSON.stringify(themeCheck.theme),
      "draft",
      now,
      now
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("UNIQUE")) {
      return {
        errors: { slug: "Este slug já está em uso." },
        status: 409,
        suggestion: suggestAvailableSlug(slugCheck.normalized),
      };
    }
    throw err;
  }

  const created = db
    .prepare("SELECT * FROM profiles WHERE id = ?")
    .get(id) as ProfileRow;

  return { profile: rowToProfile(created), status: 201 };
}

export function updateProfile(
  id: string,
  ownerId: string,
  input: ProfileUpdateInput
): {
  profile?: Profile;
  errors?: ValidationErrors;
  status?: number;
  suggestion?: string;
} {
  const existingResult = getProfileByIdForOwner(id, ownerId);
  if (existingResult.error === "not_found") {
    return { errors: { _form: "Perfil não encontrado." }, status: 404 };
  }
  if (existingResult.error === "forbidden" || !existingResult.profile) {
    return { errors: { _form: "Acesso negado a este perfil." }, status: 403 };
  }

  const current = existingResult.profile;
  const errors: ValidationErrors = {};
  let slugConflictSuggestion: string | undefined;
  let hasSlugConflict = false;

  let nextSlug = current.slug;
  if (input.slug !== undefined) {
    const slugCheck = isSlugAvailable(input.slug, current.id);
    if (!slugCheck.available) {
      if (slugCheck.suggestion) {
        hasSlugConflict = true;
        slugConflictSuggestion = slugCheck.suggestion;
      }
      errors.slug = slugCheck.error ?? "Slug inválido ou indisponível.";
    } else {
      nextSlug = slugCheck.normalized;
    }
  }

  let nextDisplayName = current.displayName;
  if (input.displayName !== undefined) {
    const nameCheck = sanitizePlainText(
      input.displayName,
      TEXT_LIMITS.displayName
    );
    if (!nameCheck.value) {
      errors.displayName = "O nome público é obrigatório.";
    } else if (nameCheck.error) {
      errors.displayName = nameCheck.error;
    } else {
      nextDisplayName = nameCheck.value;
    }
  }

  let nextBio = current.bio;
  if (input.bio !== undefined) {
    const bioCheck = sanitizePlainText(input.bio, TEXT_LIMITS.bio);
    if (bioCheck.error) {
      errors.bio = bioCheck.error;
    } else {
      nextBio = bioCheck.value;
    }
  }

  let nextAvatarUrl = current.avatarUrl;
  if (input.avatarUrl !== undefined) {
    const avatarCheck = validateAvatarUrl(input.avatarUrl);
    if (!avatarCheck.valid) {
      errors.avatarUrl = avatarCheck.error ?? "URL de avatar inválida.";
    } else {
      nextAvatarUrl = avatarCheck.url;
    }
  }

  let nextInstagramInput = current.instagramInput;
  let nextInstagramUrl = current.instagramUrl;
  if (input.instagramInput !== undefined) {
    const igCheck = normalizeInstagramUrl(input.instagramInput);
    if (igCheck.error) {
      errors.instagramInput = igCheck.error;
    } else {
      nextInstagramInput = input.instagramInput.trim();
      nextInstagramUrl = igCheck.url;
    }
  }

  const nextInstagramEnabled =
    input.instagramEnabled !== undefined
      ? Boolean(input.instagramEnabled)
      : current.instagramEnabled;

  let nextWhatsappMessage = current.whatsappMessage;
  if (input.whatsappMessage !== undefined) {
    const msgCheck = sanitizePlainText(
      input.whatsappMessage,
      TEXT_LIMITS.whatsappMessage
    );
    if (msgCheck.error) {
      errors.whatsappMessage = msgCheck.error;
    } else {
      nextWhatsappMessage = msgCheck.value;
    }
  }

  let nextWhatsappNumber = current.whatsappNumber;
  if (input.whatsappNumber !== undefined) {
    const waCheck = normalizeWhatsApp(input.whatsappNumber, nextWhatsappMessage);
    if (waCheck.error) {
      errors.whatsappNumber = waCheck.error;
    } else {
      nextWhatsappNumber = waCheck.digits;
    }
  }

  const nextWhatsappEnabled =
    input.whatsappEnabled !== undefined
      ? Boolean(input.whatsappEnabled)
      : current.whatsappEnabled;

  let nextBookingUrl = current.bookingUrl;
  if (input.bookingUrl !== undefined) {
    const bkCheck = validateBookingUrl(input.bookingUrl ?? "");
    if (!bkCheck.valid) {
      errors.bookingUrl = bkCheck.error ?? "URL de agendamento inválida.";
    } else {
      nextBookingUrl = bkCheck.url;
    }
  }

  let nextBookingLabel = current.bookingLabel;
  if (input.bookingLabel !== undefined) {
    const labelCheck = sanitizePlainText(
      input.bookingLabel,
      TEXT_LIMITS.bookingLabel
    );
    if (labelCheck.error) {
      errors.bookingLabel = labelCheck.error;
    } else {
      nextBookingLabel = labelCheck.value || "Agendar horário";
    }
  }

  const nextBookingEnabled =
    input.bookingEnabled !== undefined
      ? Boolean(input.bookingEnabled)
      : current.bookingEnabled;

  let nextTheme = current.theme;
  if (input.theme !== undefined) {
    const themeCheck = validateTheme(input.theme, current.theme);
    if (Object.keys(themeCheck.errors).length > 0) {
      Object.assign(errors, themeCheck.errors);
    } else {
      nextTheme = themeCheck.theme;
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      status: hasSlugConflict ? 409 : 422,
      suggestion: slugConflictSuggestion,
    };
  }

  const now = new Date().toISOString();
  const db = getDb();

  try {
    db.prepare(
      `UPDATE profiles SET
        slug = ?,
        display_name = ?,
        bio = ?,
        avatar_url = ?,
        instagram_input = ?,
        instagram_url = ?,
        instagram_enabled = ?,
        whatsapp_number = ?,
        whatsapp_message = ?,
        whatsapp_enabled = ?,
        booking_url = ?,
        booking_label = ?,
        booking_enabled = ?,
        theme_json = ?,
        updated_at = ?
      WHERE id = ? AND owner_id = ?`
    ).run(
      nextSlug,
      nextDisplayName,
      nextBio,
      nextAvatarUrl,
      nextInstagramInput,
      nextInstagramUrl,
      nextInstagramEnabled ? 1 : 0,
      nextWhatsappNumber,
      nextWhatsappMessage,
      nextWhatsappEnabled ? 1 : 0,
      nextBookingUrl,
      nextBookingLabel,
      nextBookingEnabled ? 1 : 0,
      JSON.stringify(nextTheme),
      now,
      current.id,
      ownerId
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("UNIQUE")) {
      return {
        errors: { slug: "Este slug já está em uso." },
        status: 409,
        suggestion: suggestAvailableSlug(nextSlug),
      };
    }
    throw err;
  }

  const updated = db
    .prepare("SELECT * FROM profiles WHERE id = ?")
    .get(current.id) as ProfileRow;

  return { profile: rowToProfile(updated), status: 200 };
}

export function publishProfile(
  id: string,
  ownerId: string
): { profile?: Profile; errors?: ValidationErrors; status?: number } {
  const existingResult = getProfileByIdForOwner(id, ownerId);
  if (existingResult.error === "not_found") {
    return { errors: { _form: "Perfil não encontrado." }, status: 404 };
  }
  if (existingResult.error === "forbidden" || !existingResult.profile) {
    return { errors: { _form: "Acesso negado a este perfil." }, status: 403 };
  }

  const validationErrors = validateProfileForPublish(existingResult.profile);
  if (Object.keys(validationErrors).length > 0) {
    return { errors: validationErrors, status: 422 };
  }

  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    "UPDATE profiles SET status = 'published', updated_at = ? WHERE id = ? AND owner_id = ?"
  ).run(now, id, ownerId);

  const updated = db
    .prepare("SELECT * FROM profiles WHERE id = ?")
    .get(id) as ProfileRow;

  return { profile: rowToProfile(updated), status: 200 };
}

export function getPublishedPublicProfileBySlug(
  rawSlug: string
): PublicProfile | null {
  const slug = normalizeSlug(rawSlug);
  if (!slug) return null;

  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM profiles WHERE slug = ? AND status = 'published' LIMIT 1"
    )
    .get(slug) as ProfileRow | undefined;

  if (!row) return null;

  const instagramUrl =
    row.instagram_enabled && row.instagram_url ? row.instagram_url : null;

  let whatsappUrl: string | null = null;
  if (row.whatsapp_enabled && row.whatsapp_number) {
    const wa = normalizeWhatsApp(row.whatsapp_number, row.whatsapp_message);
    if (!wa.error && wa.url) {
      whatsappUrl = wa.url;
    }
  }

  const bookingUrl =
    row.booking_enabled && row.booking_url ? row.booking_url : null;

  const connRow = db
    .prepare("SELECT status FROM calendar_connections WHERE profile_id = ?")
    .get(row.id) as { status: string } | undefined;
  const settingsRow = db
    .prepare(
      "SELECT enabled, horizon_days, service_name, timezone, slot_duration_minutes FROM booking_settings WHERE profile_id = ?"
    )
    .get(row.id) as
    | {
        enabled: number;
        horizon_days: number;
        service_name: string | null;
        timezone: string;
        slot_duration_minutes: number;
      }
    | undefined;
  const hasValidWhatsapp = Boolean(
    row.whatsapp_number &&
      (() => {
        const wa = normalizeWhatsApp(row.whatsapp_number);
        return !wa.error && Boolean(wa.url);
      })()
  );
  const internalBookingEnabled = Boolean(
    connRow?.status === "connected" &&
      settingsRow?.enabled === 1 &&
      hasValidWhatsapp
  );
  const internalBookingReason:
    | "active"
    | "disabled"
    | "disconnected"
    | "missing_whatsapp" =
    connRow?.status !== "connected"
      ? "disconnected"
      : !hasValidWhatsapp
        ? "missing_whatsapp"
        : settingsRow?.enabled === 1
          ? "active"
          : "disabled";

  return {
    slug: row.slug,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    instagramUrl,
    whatsappUrl,
    bookingUrl,
    bookingLabel: row.booking_label || "Agendar horário",
    internalBookingEnabled,
    internalBookingReason,
    bookingHorizonDays: settingsRow?.horizon_days,
    bookingServiceName: settingsRow?.service_name ?? undefined,
    bookingTimezone: settingsRow?.timezone,
    bookingSlotDurationMinutes: settingsRow?.slot_duration_minutes,
    catalogItems: listPublishedCatalogItemsByProfileId(row.id),
    theme: parseThemeJson(row.theme_json),
    updatedAt: row.updated_at,
  };
}
