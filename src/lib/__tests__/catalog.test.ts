import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerUser } from "../auth";
import {
  CatalogError,
  createCatalogItemForOwner,
  deleteCatalogItemForOwner,
  formatPriceBRL,
  getPublishedAppointmentService,
  listCatalogItemsForOwner,
  listPublishedCatalogItemsByProfileId,
  parseBrazilianPriceToCents,
  reorderCatalogItemsForOwner,
  updateCatalogItemForOwner,
} from "../catalog";
import { closeDb } from "../db";
import { createProfile, getPublishedPublicProfileBySlug, publishProfile, updateProfile } from "../profiles";

let tmpDir = "";

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkia-catalog-test-"));
  process.env.DATA_DIR = tmpDir;
});

afterAll(() => {
  closeDb();
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("catalog unit & isolation tests", () => {
  it("parses Brazilian prices safely into integer cents", () => {
    expect(parseBrazilianPriceToCents("120,00").cents).toBe(12000);
    expect(parseBrazilianPriceToCents("R$ 1.250,50").cents).toBe(125050);
    expect(parseBrazilianPriceToCents("99.90").cents).toBe(9990);
    expect(parseBrazilianPriceToCents("0,00").cents).toBe(0);
    expect(parseBrazilianPriceToCents("-10,00").cents).toBeNull();
    expect(parseBrazilianPriceToCents("abc").cents).toBeNull();
    expect(formatPriceBRL(12000)).toContain("120,00");
  });

  it("rejects base64 data URLs and enforces owner isolation", () => {
    const userA = registerUser("profa@catalog.test", "Prof A", "Senha123!").user!;
    const userB = registerUser("profb@catalog.test", "Prof B", "Senha123!").user!;

    const profA = createProfile(userA.id, { displayName: "Estúdio A", slug: "estudio-a" }).profile!;
    updateProfile(profA.id, userA.id, {
      whatsappNumber: "5511999991111",
      whatsappEnabled: true,
      instagramEnabled: false,
      bookingEnabled: false,
    });
    publishProfile(profA.id, userA.id);

    const profB = createProfile(userB.id, { displayName: "Estúdio B", slug: "estudio-b" }).profile!;

    // Base64 rejected
    expect(() =>
      createCatalogItemForOwner(profA.id, userA.id, {
        title: "Corte",
        description: "Corte masculino completo",
        price: "80,00",
        imageUrl: "data:image/png;base64,AAAA",
        flowType: "appointment",
        availabilityStatus: "available",
      })
    ).toThrow(CatalogError);

    // Create 2 valid items for A
    const { item: item1 } = createCatalogItemForOwner(profA.id, userA.id, {
      title: "Avaliação Facial",
      description: "Análise completa de pele",
      price: "150,00",
      imageUrl: "/api/uploads/11111111-1111-1111-1111-111111111111.webp",
      flowType: "appointment",
      availabilityStatus: "available",
      isActive: true,
      durationMinutes: 45,
    });

    const { item: item2 } = createCatalogItemForOwner(profA.id, userA.id, {
      title: "Sérum Vitamina C",
      description: "Produto home care 30ml",
      price: "89,90",
      imageUrl: null,
      flowType: "whatsapp",
      availabilityStatus: "unavailable",
      isActive: true,
    });

    const { item: hiddenItem } = createCatalogItemForOwner(profA.id, userA.id, {
      title: "Item Oculto",
      description: "Não deve aparecer publicamente",
      price: "50,00",
      flowType: "whatsapp",
      availabilityStatus: "available",
      isActive: false,
    });

    // Cross-owner isolation (userB cannot read, edit, reorder, or delete profA's catalog)
    expect(() => listCatalogItemsForOwner(profA.id, userB.id)).toThrow(CatalogError);
    expect(() =>
      updateCatalogItemForOwner(profA.id, item1.id, userB.id, { title: "Hack" })
    ).toThrow(CatalogError);
    expect(() =>
      deleteCatalogItemForOwner(profA.id, item1.id, userB.id)
    ).toThrow(CatalogError);
    expect(() =>
      reorderCatalogItemsForOwner(profA.id, userB.id, [item2.id, item1.id, hiddenItem.id])
    ).toThrow(CatalogError);

    // Public profile only returns active items for profA, not profB, and not hiddenItem
    const pubA = getPublishedPublicProfileBySlug("estudio-a");
    expect(pubA?.catalogItems?.map((i) => i.title)).toEqual([
      "Avaliação Facial",
      "Sérum Vitamina C",
    ]);
    expect(listPublishedCatalogItemsByProfileId(profB.id)).toEqual([]);

    // Reorder persists
    reorderCatalogItemsForOwner(profA.id, userA.id, [item2.id, item1.id, hiddenItem.id]);
    const pubAReordered = getPublishedPublicProfileBySlug("estudio-a");
    expect(pubAReordered?.catalogItems?.map((i) => i.title)).toEqual([
      "Sérum Vitamina C",
      "Avaliação Facial",
    ]);

    // Appointment service lookup enforces active + available + appointment + profileId
    expect(getPublishedAppointmentService(profA.id, item1.publicId)?.durationMinutes).toBe(45);
    expect(getPublishedAppointmentService(profA.id, item2.publicId)).toBeNull(); // whatsapp + unavailable
    expect(getPublishedAppointmentService(profA.id, hiddenItem.publicId)).toBeNull(); // inactive
    expect(getPublishedAppointmentService(profB.id, item1.publicId)).toBeNull(); // wrong profile
  });
});

