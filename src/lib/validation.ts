import {
  ButtonStyle,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  FontOption,
  Profile,
  ProfileTheme,
  ThemeMode,
  ValidationErrors,
} from "./types";

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "register",
  "logout",
  "dashboard",
  "editor",
  "panel",
  "painel",
  "health",
  "uploads",
  "public",
  "static",
  "_next",
  "favicon.ico",
  "robots.txt",
]);

export const TEXT_LIMITS = {
  displayName: 80,
  bio: 160,
  bookingLabel: 40,
  whatsappMessage: 200,
} as const;

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const SLUG_RE = /^[a-z0-9-]+$/;
const INSTAGRAM_HANDLE_RE = /^[a-zA-Z0-9._]{1,30}$/;
const UPLOAD_PATH_RE = /^\/api\/uploads\/[a-f0-9-]+\.(png|jpg|jpeg|webp)$/;
const HTML_TAG_RE = /<[^>]+>/;
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

const VALID_MODES = new Set<ThemeMode>(["light", "dark"]);
const VALID_FONTS = new Set<FontOption>(["manrope", "inter", "dm-sans", "system"]);
const VALID_BUTTON_STYLES = new Set<ButtonStyle>(["rounded", "soft", "sharp"]);

/**
 * Normalizes any raw string into a URL-safe lowercase slug.
 */
export function normalizeSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validates an already-normalized or raw slug against length, charset, and reserved list.
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.length < 3) {
    return {
      valid: false,
      error: "O slug deve ter pelo menos 3 caracteres.",
    };
  }
  if (slug.length > 40) {
    return {
      valid: false,
      error: "O slug deve ter no máximo 40 caracteres.",
    };
  }
  if (!SLUG_RE.test(slug)) {
    return {
      valid: false,
      error: "O slug pode conter apenas letras minúsculas, números e hífens.",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return {
      valid: false,
      error: `O slug "${slug}" é reservado pelo sistema. Escolha outro.`,
    };
  }
  return { valid: true };
}

/**
 * Accepts @handle, handle, or https://(www.)instagram.com/handle.
 * Rejects unsafe schemes, spaces, and invalid handle characters.
 */
export function normalizeInstagramUrl(input: string): {
  url: string | null;
  handle: string | null;
  error?: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return { url: null, handle: null };
  }

  if (/\s/.test(trimmed)) {
    return {
      url: null,
      handle: null,
      error: "O usuário ou URL do Instagram não pode conter espaços.",
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return {
      url: null,
      handle: null,
      error: "URL do Instagram inválida.",
    };
  }

  let handle = trimmed;

  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return {
        url: null,
        handle: null,
        error: "URL do Instagram inválida.",
      };
    }

    if (parsed.protocol !== "https:") {
      return {
        url: null,
        handle: null,
        error: "A URL do Instagram deve usar HTTPS.",
      };
    }

    const host = parsed.hostname.toLowerCase();
    if (host !== "instagram.com" && host !== "www.instagram.com") {
      return {
        url: null,
        handle: null,
        error: "A URL deve pertencer ao domínio instagram.com.",
      };
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length !== 1) {
      return {
        url: null,
        handle: null,
        error: "Informe a URL direta do perfil do Instagram (ex.: https://instagram.com/seuusuario).",
      };
    }
    handle = segments[0];
  } else if (handle.startsWith("@")) {
    handle = handle.slice(1);
  }

  if (!INSTAGRAM_HANDLE_RE.test(handle) || /^\.+$/.test(handle)) {
    return {
      url: null,
      handle: null,
      error: "Usuário do Instagram inválido. Use apenas letras, números, ponto ou underline.",
    };
  }

  return {
    url: `https://instagram.com/${handle}`,
    handle,
  };
}

/**
 * Extracts digits and validates an explicit international phone number (10-15 digits, no silent DDI).
 */
export function normalizeWhatsApp(
  number: string,
  message?: string
): { url: string | null; digits: string; error?: string } {
  const trimmed = number.trim();
  if (!trimmed) {
    return { url: null, digits: "" };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15 || digits.startsWith("0")) {
    return {
      url: null,
      digits,
      error:
        "Número de WhatsApp inválido. Informe entre 10 e 15 dígitos incluindo o código do país (DDI), ex.: 5511999999999.",
    };
  }

  const cleanMessage = (message ?? "").replace(CONTROL_CHARS_RE, "").trim();
  const url = cleanMessage
    ? `https://wa.me/${digits}?text=${encodeURIComponent(cleanMessage)}`
    : `https://wa.me/${digits}`;

  return { url, digits };
}

/**
 * Validates an external booking URL, requiring strict HTTPS.
 */
export function validateBookingUrl(url: string): {
  valid: boolean;
  url: string | null;
  error?: string;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: true, url: null };
  }

  if (trimmed.length > 500) {
    return {
      valid: false,
      url: null,
      error: "A URL de agendamento é muito longa (máximo 500 caracteres).",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      url: null,
      error: "Informe uma URL válida começando com https://.",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      url: null,
      error: "A URL de agendamento deve usar HTTPS (https://).",
    };
  }

  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return {
      valid: false,
      url: null,
      error: "Informe um domínio válido para a URL de agendamento.",
    };
  }

  return { valid: true, url: parsed.toString() };
}

/**
 * Sanitizes plain text by stripping control characters, rejecting HTML tags, and enforcing max length.
 */
export function sanitizePlainText(
  text: string,
  maxLength: number
): { value: string; error?: string } {
  const cleaned = text.replace(CONTROL_CHARS_RE, "").trim();

  if (HTML_TAG_RE.test(cleaned)) {
    return {
      value: cleaned,
      error: "Tags HTML não são permitidas; use apenas texto simples.",
    };
  }

  if (cleaned.length > maxLength) {
    return {
      value: cleaned,
      error: `O texto excede o limite máximo de ${maxLength} caracteres.`,
    };
  }

  return { value: cleaned };
}

/**
 * Validates an avatar URL (either internal /api/uploads/... or https://...).
 */
export function validateAvatarUrl(url: string | null | undefined): {
  valid: boolean;
  url: string | null;
  error?: string;
} {
  if (url === null || url === undefined) {
    return { valid: true, url: null };
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: true, url: null };
  }
  if (UPLOAD_PATH_RE.test(trimmed)) {
    return { valid: true, url: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return {
        valid: false,
        url: null,
        error: "A imagem de avatar deve usar HTTPS ou ser enviada pelo painel.",
      };
    }
    return { valid: true, url: parsed.toString() };
  } catch {
    return {
      valid: false,
      url: null,
      error: "URL de avatar inválida.",
    };
  }
}

/**
 * Validates and merges a partial ProfileTheme against a base theme.
 */
export function validateTheme(
  partial: Partial<ProfileTheme> | undefined | null,
  baseTheme?: ProfileTheme
): { theme: ProfileTheme; errors: ValidationErrors } {
  const errors: ValidationErrors = {};
  const input = partial ?? {};

  let mode: ThemeMode = baseTheme?.mode ?? "light";
  if (input.mode !== undefined) {
    if (VALID_MODES.has(input.mode)) {
      mode = input.mode;
    } else {
      errors["theme.mode"] = "Modo de tema inválido. Use 'light' ou 'dark'.";
    }
  }

  const defaults =
    baseTheme ?? (mode === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME);

  const colorFields = [
    "bgColor",
    "textColor",
    "primaryColor",
    "accentColor",
  ] as const;

  const resolvedColors: Record<(typeof colorFields)[number], string> = {
    bgColor: defaults.bgColor,
    textColor: defaults.textColor,
    primaryColor: defaults.primaryColor,
    accentColor: defaults.accentColor,
  };

  for (const field of colorFields) {
    const candidate = input[field];
    if (candidate !== undefined) {
      if (typeof candidate === "string" && HEX_COLOR_RE.test(candidate.trim())) {
        resolvedColors[field] = candidate.trim();
      } else {
        errors[`theme.${field}`] =
          "Cor inválida. Use formato hexadecimal de 6 dígitos (ex.: #16784E).";
      }
    }
  }

  let fontFamily: FontOption = defaults.fontFamily;
  if (input.fontFamily !== undefined) {
    if (VALID_FONTS.has(input.fontFamily)) {
      fontFamily = input.fontFamily;
    } else {
      errors["theme.fontFamily"] = "Fonte selecionada inválida.";
    }
  }

  let buttonStyle: ButtonStyle = defaults.buttonStyle;
  if (input.buttonStyle !== undefined) {
    if (VALID_BUTTON_STYLES.has(input.buttonStyle)) {
      buttonStyle = input.buttonStyle;
    } else {
      errors["theme.buttonStyle"] = "Estilo de botão inválido.";
    }
  }

  return {
    theme: {
      mode,
      ...resolvedColors,
      fontFamily,
      buttonStyle,
    },
    errors,
  };
}

/**
 * Validates that a profile has all required fields and valid enabled links before publishing.
 */
export function validateProfileForPublish(profile: Profile): ValidationErrors {
  const errors: ValidationErrors = {};

  const nameCheck = sanitizePlainText(
    profile.displayName,
    TEXT_LIMITS.displayName
  );
  if (!nameCheck.value) {
    errors.displayName = "O nome público é obrigatório para publicar.";
  } else if (nameCheck.error) {
    errors.displayName = nameCheck.error;
  }

  const slugCheck = validateSlug(profile.slug);
  if (!slugCheck.valid && slugCheck.error) {
    errors.slug = slugCheck.error;
  }

  const bioCheck = sanitizePlainText(profile.bio, TEXT_LIMITS.bio);
  if (bioCheck.error) {
    errors.bio = bioCheck.error;
  }

  if (profile.instagramEnabled) {
    if (!profile.instagramInput.trim()) {
      errors.instagramInput =
        "Informe o usuário ou URL do Instagram, ou desative este link.";
    } else {
      const ig = normalizeInstagramUrl(profile.instagramInput);
      if (ig.error || !ig.url) {
        errors.instagramInput = ig.error ?? "Instagram inválido.";
      }
    }
  }

  if (profile.whatsappEnabled) {
    if (!profile.whatsappNumber.trim()) {
      errors.whatsappNumber =
        "Informe o número de WhatsApp com DDI, ou desative este link.";
    } else {
      const wa = normalizeWhatsApp(
        profile.whatsappNumber,
        profile.whatsappMessage
      );
      if (wa.error || !wa.url) {
        errors.whatsappNumber = wa.error ?? "WhatsApp inválido.";
      }
    }
    const msgCheck = sanitizePlainText(
      profile.whatsappMessage,
      TEXT_LIMITS.whatsappMessage
    );
    if (msgCheck.error) {
      errors.whatsappMessage = msgCheck.error;
    }
  }

  const themeCheck = validateTheme(profile.theme);
  Object.assign(errors, themeCheck.errors);

  return errors;
}
