import type { ButtonStyle, FontOption } from "@/lib/types";

export function getFontStack(font: FontOption): string {
  switch (font) {
    case "manrope":
      return "var(--font-manrope), var(--font-system)";
    case "inter":
      return "var(--font-inter), var(--font-system)";
    case "dm-sans":
      return "var(--font-dm-sans), var(--font-system)";
    case "system":
    default:
      return "var(--font-system)";
  }
}

export function getButtonRadius(style: ButtonStyle): string {
  switch (style) {
    case "sharp":
      return "4px";
    case "soft":
      return "10px";
    case "rounded":
    default:
      return "16px";
  }
}

export function getInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "LI";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function parseHexColor(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return [r, g, b];
}

function channelLuminance(c: number): number {
  const srgb = c / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  return (
    0.2126 * channelLuminance(rgb[0]) +
    0.7152 * channelLuminance(rgb[1]) +
    0.0722 * channelLuminance(rgb[2])
  );
}

export function getContrastTextColor(bgHex: string): string {
  const lum = getRelativeLuminance(bgHex);
  if (lum === null) return "#FFFFFF";
  return lum > 0.36 ? "#101312" : "#FFFFFF";
}

export function getContrastRatio(hexA: string, hexB: string): number | null {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  if (lumA === null || lumB === null) return null;
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function buildPreviewInstagramUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:") return null;
      const host = parsed.hostname.toLowerCase();
      if (host !== "instagram.com" && host !== "www.instagram.com") return null;
      const segment = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
      if (!segment || !/^[a-zA-Z0-9._]{1,30}$/.test(segment)) return null;
      return `https://instagram.com/${segment}`;
    } catch {
      return null;
    }
  }
  const handle = trimmed.replace(/^@+/, "").split(/[/?#]/)[0]?.trim();
  if (!handle || !/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return null;
  return `https://instagram.com/${handle}`;
}

export function buildPreviewWhatsappUrl(
  number: string,
  message: string
): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("0") || digits.length < 10 || digits.length > 15) {
    return null;
  }
  const base = `https://wa.me/${digits}`;
  const msg = message.trim();
  return msg ? `${base}?text=${encodeURIComponent(msg)}` : base;
}

export function buildPreviewBookingUrl(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
