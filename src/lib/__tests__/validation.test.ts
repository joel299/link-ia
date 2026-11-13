import { describe, expect, it } from "vitest";
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME, Profile } from "../types";
import {
  normalizeInstagramUrl,
  normalizeSlug,
  normalizeWhatsApp,
  sanitizePlainText,
  validateBookingUrl,
  validateProfileForPublish,
  validateSlug,
  validateTheme,
} from "../validation";

describe("normalizeSlug & validateSlug", () => {
  it("normalizes accents, spaces, underscores, and trims hyphens", () => {
    expect(normalizeSlug("  João_Silva & Cia!  ")).toBe("joao-silva-cia");
    expect(normalizeSlug("---Clínica___Estética---")).toBe("clinica-estetica");
    expect(normalizeSlug("Água Pura 2026")).toBe("agua-pura-2026");
  });

  it("rejects slugs shorter than 3 or longer than 40 chars", () => {
    expect(validateSlug("ab").valid).toBe(false);
    expect(validateSlug("a".repeat(41)).valid).toBe(false);
    expect(validateSlug("abc").valid).toBe(true);
    expect(validateSlug("a".repeat(40)).valid).toBe(true);
  });

  it("rejects reserved slugs", () => {
    for (const reserved of ["admin", "api", "login", "painel", "health", "uploads"]) {
      const res = validateSlug(reserved);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("reservado");
    }
  });
});

describe("normalizeInstagramUrl", () => {
  it("accepts @handle, plain handle, and https instagram URLs", () => {
    expect(normalizeInstagramUrl("@joel.barber")).toEqual({
      url: "https://instagram.com/joel.barber",
      handle: "joel.barber",
    });
    expect(normalizeInstagramUrl("joel_barber")).toEqual({
      url: "https://instagram.com/joel_barber",
      handle: "joel_barber",
    });
    expect(normalizeInstagramUrl("https://www.instagram.com/joel.barber/")).toEqual({
      url: "https://instagram.com/joel.barber",
      handle: "joel.barber",
    });
  });

  it("rejects javascript:, spaces, http:, and non-instagram domains", () => {
    expect(normalizeInstagramUrl("javascript:alert(1)").error).toBeDefined();
    expect(normalizeInstagramUrl("joel barber").error).toBeDefined();
    expect(normalizeInstagramUrl("http://instagram.com/joel").error).toBeDefined();
    expect(normalizeInstagramUrl("https://evil.com/joel").error).toBeDefined();
  });
});

describe("normalizeWhatsApp", () => {
  it("builds wa.me URL with explicit DDI and optional encoded message", () => {
    expect(normalizeWhatsApp("+55 (11) 99999-9999")).toEqual({
      url: "https://wa.me/5511999999999",
      digits: "5511999999999",
    });
    expect(normalizeWhatsApp("5511999999999", "Olá mundo!")).toEqual({
      url: "https://wa.me/5511999999999?text=Ol%C3%A1%20mundo!",
      digits: "5511999999999",
    });
  });

  it("does not silently prepend 55 and rejects short/invalid numbers with clear DDI message", () => {
    const res = normalizeWhatsApp("99999999");
    expect(res.url).toBeNull();
    expect(res.error).toContain("código do país");

    const zeroPrefix = normalizeWhatsApp("0551199999999");
    expect(zeroPrefix.url).toBeNull();
    expect(zeroPrefix.error).toBeDefined();
  });
});

describe("validateBookingUrl", () => {
  it("accepts valid https URLs and rejects http, javascript, data", () => {
    expect(validateBookingUrl("https://cal.com/joel-quintana").valid).toBe(true);
    expect(validateBookingUrl("http://cal.com/joel").valid).toBe(false);
    expect(validateBookingUrl("javascript:alert(1)").valid).toBe(false);
    expect(validateBookingUrl("data:text/html,<script>").valid).toBe(false);
  });
});

describe("sanitizePlainText", () => {
  it("trims, strips control chars, enforces maxLength, and rejects HTML tags", () => {
    expect(sanitizePlainText("  Joel\x00 Quintana  ", 80)).toEqual({
      value: "Joel Quintana",
    });
    expect(sanitizePlainText("<b>Joel</b>", 80).error).toBeDefined();
    expect(sanitizePlainText("<script>alert(1)</script>", 80).error).toBeDefined();
    expect(sanitizePlainText("a".repeat(81), 80).error).toBeDefined();
  });
});

describe("validateTheme", () => {
  it("merges valid partial theme and rejects invalid colors/enums", () => {
    const ok = validateTheme({ mode: "dark", primaryColor: "#33B978" });
    expect(ok.errors).toEqual({});
    expect(ok.theme.mode).toBe("dark");
    expect(ok.theme.primaryColor).toBe("#33B978");

    const bad = validateTheme(
      { bgColor: "red", fontFamily: "comic-sans" as never },
      DEFAULT_LIGHT_THEME
    );
    expect(bad.errors["theme.bgColor"]).toBeDefined();
    expect(bad.errors["theme.fontFamily"]).toBeDefined();
  });
});

describe("validateProfileForPublish", () => {
  const baseProfile: Profile = {
    id: "p1",
    ownerId: "u1",
    slug: "joel-teste",
    displayName: "Joel Teste",
    bio: "Barbearia",
    avatarUrl: null,
    instagramInput: "@joel",
    instagramUrl: "https://instagram.com/joel",
    instagramEnabled: true,
    whatsappNumber: "5511999999999",
    whatsappMessage: "Oi",
    whatsappEnabled: true,
    bookingUrl: "https://cal.com/joel",
    bookingLabel: "Agendar",
    bookingEnabled: true,
    theme: DEFAULT_DARK_THEME,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("passes when all enabled links and required fields are valid", () => {
    expect(validateProfileForPublish(baseProfile)).toEqual({});
  });

  it("does not require the removed external booking URL", () => {
    expect(
      validateProfileForPublish({ ...baseProfile, bookingUrl: null })
    ).toEqual({});
  });

  it("blocks publish when an enabled link is empty or invalid", () => {
    const invalid: Profile = {
      ...baseProfile,
      displayName: "",
      whatsappNumber: "123",
    };
    const errors = validateProfileForPublish(invalid);
    expect(errors.displayName).toBeDefined();
    expect(errors.whatsappNumber).toBeDefined();
  });

  it("allows empty links when they are disabled", () => {
    const disabledLinks: Profile = {
      ...baseProfile,
      instagramInput: "",
      instagramUrl: null,
      instagramEnabled: false,
      whatsappNumber: "",
      whatsappEnabled: false,
      bookingUrl: null,
      bookingEnabled: false,
    };
    expect(validateProfileForPublish(disabledLinks)).toEqual({});
  });
});
