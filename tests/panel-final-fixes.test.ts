import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AdsServiceError,
  getAdsOverviewForOwner,
} from "../src/lib/ads-service";
import { registerUser } from "../src/lib/auth";
import {
  createCustomLink,
  deleteCustomLink,
  listActivePublicCustomLinks,
  listCustomLinksForOwner,
  reorderCustomLinks,
  updateCustomLink,
  validateHttpsLinkUrl,
} from "../src/lib/custom-links";
import { closeDb } from "../src/lib/db";
import {
  createProfile,
  deleteProfileForOwner,
  getPublishedPublicProfileBySlug,
  publishProfile,
  unpublishProfile,
  updateProfile,
} from "../src/lib/profiles";
import { DEFAULT_PUBLIC_ORDER } from "../src/lib/types";

describe("Final panel fixes: CRUD, paid traffic guard, custom links, and public order", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkia-final-fixes-"));
    process.env.DATA_DIR = tmpDir;
    process.env.SESSION_SECRET = "test-session-secret-1234567890";
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });

  it("supports draft deletion, unpublish, and explicit confirmation for published profile deletion", async () => {
    const owner = registerUser(
      "owner1-final@example.com",
      "Owner One",
      "password123"
    );
    const other = registerUser(
      "owner2-final@example.com",
      "Owner Two",
      "password123"
    );
    expect(owner.user).toBeDefined();
    expect(other.user).toBeDefined();

    const ownerId = owner.user!.id;
    const otherId = other.user!.id;

    // Create draft and delete directly
    const draftRes = createProfile(ownerId, {
      displayName: "Rascunho Temporário",
      slug: "rascunho-temp-1",
    });
    expect(draftRes.profile).toBeDefined();

    const crossDelete = deleteProfileForOwner(draftRes.profile!.id, otherId);
    expect(crossDelete.status).toBe(403);

    const draftDelete = deleteProfileForOwner(draftRes.profile!.id, ownerId);
    expect(draftDelete.status).toBe(200);
    expect(draftDelete.deleted).toBe(true);

    // Create profile, set WhatsApp, publish, test unpublish & confirmed delete
    const created = createProfile(ownerId, {
      displayName: "Perfil Publicável",
      slug: "perfil-pub-final",
    });
    const profId = created.profile!.id;
    updateProfile(profId, ownerId, {
      bio: "Atendimento profissional",
      instagramEnabled: false,
      whatsappNumber: "11999990000",
      whatsappEnabled: true,
    });
    const pub = publishProfile(profId, ownerId);
    expect(pub.errors).toBeUndefined();
    expect(pub.profile?.status).toBe("published");
    expect(getPublishedPublicProfileBySlug("perfil-pub-final")).not.toBeNull();

    // Unpublish returns to draft and removes public page
    const unpub = unpublishProfile(profId, ownerId);
    expect(unpub.profile?.status).toBe("draft");
    expect(getPublishedPublicProfileBySlug("perfil-pub-final")).toBeNull();

    // Re-publish and enforce explicit confirmation on delete
    publishProfile(profId, ownerId);
    const unconfirmedDelete = deleteProfileForOwner(profId, ownerId);
    expect(unconfirmedDelete.status).toBe(409);
    expect(unconfirmedDelete.requiresConfirmation).toBe(true);
    expect(getPublishedPublicProfileBySlug("perfil-pub-final")).not.toBeNull();

    const confirmedDelete = deleteProfileForOwner(profId, ownerId, {
      confirmPublished: true,
    });
    expect(confirmedDelete.status).toBe(200);
    expect(confirmedDelete.deleted).toBe(true);
    expect(getPublishedPublicProfileBySlug("perfil-pub-final")).toBeNull();
  });

  it("blocks paid traffic backend operations on draft profiles and allows checking published profiles", async () => {
    const owner = registerUser(
      "ads-owner-final@example.com",
      "Ads Owner",
      "password123"
    );
    const ownerId = owner.user!.id;

    const created = createProfile(ownerId, {
      displayName: "Rascunho Ads",
      slug: "rascunho-ads-final",
    });
    const profId = created.profile!.id;

    try {
      await getAdsOverviewForOwner({
        profileId: profId,
        ownerId,
        provider: "meta_ads",
      });
      expect.unreachable("Should reject draft profile for meta_ads");
    } catch (err) {
      expect(err).toBeInstanceOf(AdsServiceError);
      expect((err as AdsServiceError).status).toBe(409);
      expect((err as AdsServiceError).message).toContain(
        "Publique este perfil para configurar o tráfego pago."
      );
    }

    try {
      await getAdsOverviewForOwner({
        profileId: profId,
        ownerId,
        provider: "tiktok_ads",
      });
      expect.unreachable("Should reject draft profile for tiktok_ads");
    } catch (err) {
      expect(err).toBeInstanceOf(AdsServiceError);
      expect((err as AdsServiceError).status).toBe(409);
      expect((err as AdsServiceError).message).toContain(
        "Publique este perfil para configurar o tráfego pago."
      );
    }

    updateProfile(profId, ownerId, {
      bio: "Atendimento profissional",
      instagramEnabled: false,
      whatsappNumber: "11988887777",
      whatsappEnabled: true,
    });
    const pubAds = publishProfile(profId, ownerId);
    expect(pubAds.profile?.status).toBe("published");

    const state = await getAdsOverviewForOwner({
      profileId: profId,
      ownerId,
      provider: "meta_ads",
    });
    expect(state.provider).toBe("meta_ads");
    expect(["disconnected", "pending_config"]).toContain(
      state.connection.status
    );
  });

  it("validates HTTPS-only custom links, supports CRUD + reorder, and exposes active links & publicOrder on public profile", async () => {
    const owner = registerUser(
      "links-owner-final@example.com",
      "Links Owner",
      "password123"
    );
    const ownerId = owner.user!.id;

    expect(validateHttpsLinkUrl("javascript:alert(1)").error).toBeDefined();
    expect(validateHttpsLinkUrl("http://example.com").error).toBeDefined();
    expect(validateHttpsLinkUrl("data:text/html,hi").error).toBeDefined();
    expect(validateHttpsLinkUrl("https://maps.google.com/?q=LinkIA").url).toBe(
      "https://maps.google.com/?q=LinkIA"
    );

    const created = createProfile(ownerId, {
      displayName: "Clínica Central",
      slug: "clinica-central-final",
    });
    const profId = created.profile!.id;

    // Invalid URL rejected
    const invalidLink = createCustomLink(profId, ownerId, {
      title: "XSS",
      url: "javascript:alert(1)",
    });
    expect(invalidLink.status).toBe(422);
    expect(invalidLink.errors?.url).toBeDefined();

    // Valid links created
    const link1 = createCustomLink(profId, ownerId, {
      title: "Como chegar (Maps)",
      url: "https://maps.google.com/?q=Av+Paulista+1000",
      description: "Av. Paulista, 1000",
      iconType: "map",
      isActive: true,
    });
    expect(link1.status).toBe(201);

    const link2 = createCustomLink(profId, ownerId, {
      title: "Site Oficial",
      url: "https://example.com/clinica",
      iconType: "globe",
      isActive: true,
    });
    expect(link2.status).toBe(201);

    // Reorder links: link2 first, link1 second
    const reordered = reorderCustomLinks(profId, ownerId, [
      link2.item!.id,
      link1.item!.id,
    ]);
    expect(reordered.status).toBe(200);
    expect(reordered.items?.map((i) => i.id)).toEqual([
      link2.item!.id,
      link1.item!.id,
    ]);

    // Deactivate link2 -> excluded from active public links
    const deactivated = updateCustomLink(profId, link2.item!.id, ownerId, {
      isActive: false,
    });
    expect(deactivated.item?.isActive).toBe(false);
    expect(listActivePublicCustomLinks(profId).map((i) => i.id)).toEqual([
      link1.item!.id,
    ]);

    // Update publicOrder on profile and publish
    const badOrder = updateProfile(profId, ownerId, {
      publicOrder: ["booking", "booking"] as unknown as typeof DEFAULT_PUBLIC_ORDER,
    });
    expect(badOrder.status).toBe(422);

    const customOrder = [
      "custom_links",
      "whatsapp",
      "catalog",
      "booking",
      "instagram",
      "tiktok",
      "social_highlights",
    ] as typeof DEFAULT_PUBLIC_ORDER;

    const updated = updateProfile(profId, ownerId, {
      bio: "Clínica odontológica completa",
      instagramEnabled: false,
      whatsappNumber: "11977776666",
      whatsappEnabled: true,
      publicOrder: customOrder,
    });
    expect(updated.profile?.publicOrder).toEqual(customOrder);

    publishProfile(profId, ownerId);
    const pub = getPublishedPublicProfileBySlug("clinica-central-final");
    expect(pub).not.toBeNull();
    expect(pub?.publicOrder).toEqual(customOrder);
    expect(pub?.customLinks?.length).toBe(1);
    expect(pub?.customLinks?.[0].title).toBe("Como chegar (Maps)");

    // Delete link1
    const del = deleteCustomLink(profId, link1.item!.id, ownerId);
    expect(del.deleted).toBe(true);
    expect(listCustomLinksForOwner(profId, ownerId).length).toBe(1);
  });
});
