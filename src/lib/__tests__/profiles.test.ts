import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticateUser, registerUser } from "../auth";
import { closeDb } from "../db";
import {
  createProfile,
  getProfileByIdForOwner,
  getPublishedPublicProfileBySlug,
  isSlugAvailable,
  listProfilesByOwner,
  publishProfile,
  updateProfile,
} from "../profiles";

let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkia-test-"));
  process.env.DATA_DIR = tempDir;
});

afterAll(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("profiles & auth persistence (SQLite)", () => {
  it("registers and authenticates a user, seeds demo profile", () => {
    const demoPublic = getPublishedPublicProfileBySlug("joel-quintana");
    expect(demoPublic).not.toBeNull();
    expect(demoPublic?.displayName).toBe("Joel Quintana");
    expect((demoPublic as unknown as Record<string, unknown>).ownerId).toBeUndefined();
    expect((demoPublic as unknown as Record<string, unknown>).id).toBeUndefined();
    expect((demoPublic as unknown as Record<string, unknown>).status).toBeUndefined();

    const reg = registerUser("maria@exemplo.com", "Maria", "segredo123");
    expect(reg.user).toBeDefined();
    expect(reg.user?.email).toBe("maria@exemplo.com");

    const auth = authenticateUser("maria@exemplo.com", "segredo123");
    expect(auth.user?.id).toBe(reg.user?.id);

    const wrong = authenticateUser("maria@exemplo.com", "errada");
    expect(wrong.user).toBeUndefined();
  });

  it("enforces unique slug, draft privacy, update, publish, and public projection", () => {
    const reg = registerUser("carlos@exemplo.com", "Carlos", "senha123");
    const ownerId = reg.user!.id;

    const otherReg = registerUser("outro@exemplo.com", "Outro", "senha123");
    const otherId = otherReg.user!.id;

    // Create draft
    const created = createProfile(ownerId, {
      displayName: "Carlos Studio",
      slug: "Carlos Studio!",
      bio: "Estúdio criativo",
    });
    expect(created.status).toBe(201);
    expect(created.profile?.slug).toBe("carlos-studio");
    expect(created.profile?.status).toBe("draft");

    // Draft must NOT be exposed publicly
    expect(getPublishedPublicProfileBySlug("carlos-studio")).toBeNull();

    // Ownership check (403 for other user, 404 for unknown)
    expect(getProfileByIdForOwner(created.profile!.id, otherId).error).toBe("forbidden");
    expect(getProfileByIdForOwner("non-existent", ownerId).error).toBe("not_found");

    // Duplicate slug returns 409 + suggestion
    const dup = createProfile(otherId, {
      displayName: "Outro Carlos",
      slug: "carlos-studio",
    });
    expect(dup.status).toBe(409);
    expect(dup.suggestion).toBe("carlos-studio-2");

    const avail = isSlugAvailable("carlos-studio");
    expect(avail.available).toBe(false);
    expect(avail.suggestion).toBe("carlos-studio-2");

    // Update profile with valid links (and one disabled link)
    const updated = updateProfile(created.profile!.id, ownerId, {
      instagramInput: "@carlos.studio",
      instagramEnabled: true,
      whatsappNumber: "+55 11 98888-7777",
      whatsappMessage: "Oi Carlos!",
      whatsappEnabled: true,
      bookingUrl: "https://cal.com/carlos",
      bookingEnabled: false,
    });
    expect(updated.status).toBe(200);
    expect(updated.profile?.instagramUrl).toBe("https://instagram.com/carlos.studio");

    // Publish
    const pub = publishProfile(created.profile!.id, ownerId);
    expect(pub.status).toBe(200);
    expect(pub.profile?.status).toBe("published");

    // Public profile now available, disabled bookingUrl is null
    const pubView = getPublishedPublicProfileBySlug("carlos-studio");
    expect(pubView).not.toBeNull();
    expect(pubView?.instagramUrl).toBe("https://instagram.com/carlos.studio");
    expect(pubView?.whatsappUrl).toBe("https://wa.me/5511988887777?text=Oi%20Carlos!");
    expect(pubView?.bookingUrl).toBeNull();

    // List profiles by owner
    const list = listProfilesByOwner(ownerId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(created.profile!.id);
  });
});
