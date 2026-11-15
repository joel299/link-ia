import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookieState = { token: null as string | null };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "linkia_session" && cookieState.token
        ? { name, value: cookieState.token }
        : undefined,
    set: (_name: string, value: string) => {
      cookieState.token = value || null;
    },
  }),
  headers: async () => new Headers(),
}));

import {
  authenticateUser,
  getSessionUser,
  hashPassword,
  registerUser,
  setSessionCookie,
  type SessionUser,
} from "../src/lib/auth";
import { closeDb, getDb } from "../src/lib/db";
import {
  createEmptyPermissions,
  createLegacyDefaultPermissions,
  getUserPermissions,
} from "../src/lib/permissions";
import {
  createProfile,
  getPublishedPublicProfileBySlug,
} from "../src/lib/profiles";
import {
  GET as adminListUsersGet,
  POST as adminCreateUserPost,
} from "../src/app/api/admin/users/route";
import {
  GET as adminGetUserGet,
  PATCH as adminPatchUserPatch,
} from "../src/app/api/admin/users/[userId]/route";
import { GET as socialGet } from "../src/app/api/profiles/[id]/integrations/social/[provider]/route";
import { POST as socialConnectPost } from "../src/app/api/profiles/[id]/integrations/social/[provider]/connect/route";
import { POST as socialSyncPost } from "../src/app/api/profiles/[id]/integrations/social/[provider]/sync/route";
import { GET as adsGet } from "../src/app/api/profiles/[id]/ads/[provider]/route";
import { GET as bookingSettingsGet } from "../src/app/api/profiles/[id]/booking-settings/route";
import { GET as catalogGet } from "../src/app/api/profiles/[id]/catalog/route";
import { GET as whatsappGet } from "../src/app/api/profiles/[id]/integrations/whatsapp/route";
import { PATCH as profilePatch } from "../src/app/api/profiles/[id]/route";

function actAs(user: SessionUser | null) {
  if (!user) {
    cookieState.token = null;
    return;
  }
  const res = NextResponse.json({ ok: true });
  void setSessionCookie(user, res);
  const cookie = res.cookies.get("linkia_session");
  cookieState.token = cookie?.value ?? null;
}

describe("Admin panel, user permissions, and server-side feature enforcement", () => {
  let tmpDir: string;
  let adminUser: SessionUser;
  let legacyUser: SessionUser;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkia-admin-perms-"));
    process.env.DATA_DIR = tmpDir;
    process.env.SESSION_SECRET = "test-admin-secret-1234567890abcdef";

    const db = getDb();
    const adminId = "user-admin-1";
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)`
    ).run(
      adminId,
      "admin@linkia.test",
      "Admin LinkIA",
      hashPassword("AdminPass123!"),
      new Date().toISOString(),
      new Date().toISOString()
    );
    adminUser = {
      id: adminId,
      email: "admin@linkia.test",
      name: "Admin LinkIA",
      role: "admin",
      isActive: true,
      permissions: createLegacyDefaultPermissions(),
    };

    legacyUser = registerUser("legacy@linkia.test", "Legacy Client", "LegacyPass123!").user!;
  });

  beforeEach(() => {
    cookieState.token = null;
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });

  it("preserves full legacy permissions when no user_feature_permissions row exists", () => {
    const perms = getUserPermissions(legacyUser.id);
    expect(perms).toEqual(createLegacyDefaultPermissions());
    expect(Object.values(perms).every(Boolean)).toBe(true);
  });

  it("applies admin bootstrap to a matching existing session", async () => {
    const user = registerUser(
      "bootstrap@linkia.test",
      "Bootstrap Client",
      "BootstrapPass123!"
    ).user!;
    const previousEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const previousPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    process.env.ADMIN_BOOTSTRAP_EMAIL = user.email;
    process.env.ADMIN_BOOTSTRAP_PASSWORD = "TemporaryBootstrapPass123!";

    try {
      actAs(user);
      const session = await getSessionUser();
      expect(session?.role).toBe("admin");
      const storedUser = getDb()
        .prepare("SELECT role FROM users WHERE id = ?")
        .get(user.id) as { role: string } | undefined;
      expect(storedUser?.role).toBe("admin");
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAIL;
      else process.env.ADMIN_BOOTSTRAP_EMAIL = previousEmail;
      if (previousPassword === undefined) delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
      else process.env.ADMIN_BOOTSTRAP_PASSWORD = previousPassword;
    }
  });

  it("rejects non-admin and unauthenticated callers on admin endpoints (401/403)", async () => {
    const unauthRes = await adminListUsersGet();
    expect(unauthRes.status).toBe(401);

    actAs(legacyUser);
    const clientListRes = await adminListUsersGet();
    expect(clientListRes.status).toBe(403);

    const clientCreateRes = await adminCreateUserPost(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Intruder",
          email: "intruder@linkia.test",
          password: "Password123!",
          permissions: {},
        }),
      })
    );
    expect(clientCreateRes.status).toBe(403);

    const clientPatchRes = await adminPatchUserPatch(
      new Request(`http://localhost/api/admin/users/${legacyUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ userId: legacyUser.id }) }
    );
    expect(clientPatchRes.status).toBe(403);
  });

  it("allows admin to create a client with partial permissions, rejects role escalation, and records audit logs", async () => {
    actAs(adminUser);

    const escalationRes = await adminCreateUserPost(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Fake Admin",
          email: "fakeadmin@linkia.test",
          password: "Password123!",
          role: "admin",
          permissions: { whatsapp: true },
        }),
      })
    );
    expect(escalationRes.status).toBe(403);

    const createRes = await adminCreateUserPost(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Clinica Solar",
          email: "clinica@linkia.test",
          password: "ClientPass123!",
          permissions: {
            whatsapp: true,
            instagram: true,
            facebook_social: false,
            meta_ads: true,
            tiktok_organic: false,
            tiktok_ads: false,
            google_calendar: false,
            catalog: false,
          },
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const createdPayload = await createRes.json();
    expect(createdPayload.user).toBeDefined();
    expect(createdPayload.user.role).toBe("client");
    expect(createdPayload.user.isActive).toBe(true);
    expect(createdPayload.user.passwordHash).toBeUndefined();
    expect(createdPayload.user.password_hash).toBeUndefined();
    expect(createdPayload.user.permissions).toEqual({
      ...createEmptyPermissions(),
      whatsapp: true,
      instagram: true,
      meta_ads: true,
    });

    const userId = createdPayload.user.id as string;

    const getRes = await adminGetUserGet(
      new Request(`http://localhost/api/admin/users/${userId}`),
      { params: Promise.resolve({ userId }) }
    );
    expect(getRes.status).toBe(200);
    const getPayload = await getRes.json();
    expect(getPayload.user.permissions.facebook_social).toBe(false);
    expect(getPayload.user.permissions.meta_ads).toBe(true);

    const db = getDb();
    const auditRows = db
      .prepare(
        `SELECT action, target_user_id FROM admin_audit_logs WHERE target_user_id = ?`
      )
      .all(userId) as Array<{ action: string; target_user_id: string }>;
    expect(auditRows.some((r) => r.action === "admin.user.create")).toBe(true);

    const roleChangeRes = await adminPatchUserPatch(
      new Request(`http://localhost/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      }),
      { params: Promise.resolve({ userId }) }
    );
    expect(roleChangeRes.status).toBe(403);
  });

  it("enforces per-feature permissions across APIs and public profile output", async () => {
    const authClient = authenticateUser("clinica@linkia.test", "ClientPass123!");
    expect(authClient.user).toBeDefined();
    const client = authClient.user!;

    const createdProfile = createProfile(client.id, {
      slug: "clinica-solar",
      displayName: "Clinica Solar",
    });
    expect(createdProfile.profile).toBeDefined();
    const profile = createdProfile.profile!;

    const db = getDb();
    db.prepare(
      `UPDATE profiles
       SET instagram_enabled = 1,
           instagram_url = 'https://instagram.com/clinicasolar',
           whatsapp_enabled = 1,
           whatsapp_number = '5511999990000',
           status = 'published'
       WHERE id = ?`
    ).run(profile.id);

    const publicView = getPublishedPublicProfileBySlug("clinica-solar");
    expect(publicView).not.toBeNull();
    expect(publicView!.instagramUrl).toContain("instagram.com");
    expect(publicView!.whatsappUrl).toContain("wa.me");
    expect(publicView!.tiktokUrl).toBeNull();
    expect(publicView!.catalogItems).toEqual([]);
    expect(publicView!.internalBookingEnabled).toBe(false);

    actAs(client);

    // Denied features return 403
    expect(
      (
        await socialGet(new Request("http://localhost"), {
          params: Promise.resolve({ id: profile.id, provider: "tiktok" }),
        })
      ).status
    ).toBe(403);

    expect(
      (
        await socialConnectPost(new Request("http://localhost", { method: "POST" }), {
          params: Promise.resolve({ id: profile.id, provider: "meta_ads" }),
        })
      ).status
    ).toBe(403);

    expect(
      (
        await socialSyncPost(new Request("http://localhost", { method: "POST" }), {
          params: Promise.resolve({ id: profile.id, provider: "tiktok" }),
        })
      ).status
    ).toBe(403);

    expect(
      (
        await adsGet(new Request("http://localhost"), {
          params: Promise.resolve({ id: profile.id, provider: "tiktok_ads" }),
        })
      ).status
    ).toBe(403);

    expect(
      (
        await bookingSettingsGet(new Request("http://localhost"), {
          params: Promise.resolve({ id: profile.id }),
        })
      ).status
    ).toBe(403);

    expect(
      (
        await catalogGet(new Request("http://localhost"), {
          params: Promise.resolve({ id: profile.id }),
        })
      ).status
    ).toBe(403);

    // Permitted features do NOT return 403
    expect(
      (
        await whatsappGet(new Request("http://localhost"), {
          params: Promise.resolve({ id: profile.id }),
        })
      ).status
    ).toBe(200);

    expect(
      (
        await socialGet(new Request("http://localhost"), {
          params: Promise.resolve({ id: profile.id, provider: "instagram" }),
        })
      ).status
    ).toBe(200);

    expect(
      (
        await adsGet(new Request("http://localhost"), {
          params: Promise.resolve({ id: profile.id, provider: "meta_ads" }),
        })
      ).status
    ).toBe(200);

    // Remove whatsapp permission via admin PATCH and verify profile PATCH & whatsapp GET are blocked
    actAs(adminUser);
    const revokeRes = await adminPatchUserPatch(
      new Request(`http://localhost/api/admin/users/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissions: {
            whatsapp: false,
            instagram: true,
            facebook_social: false,
            meta_ads: true,
            tiktok_organic: false,
            tiktok_ads: false,
            google_calendar: false,
            catalog: false,
          },
        }),
      }),
      { params: Promise.resolve({ userId: client.id }) }
    );
    expect(revokeRes.status).toBe(200);

    actAs(client);
    expect(
      (
        await whatsappGet(new Request("http://localhost"), {
          params: Promise.resolve({ id: profile.id }),
        })
      ).status
    ).toBe(403);

    expect(
      (
        await profilePatch(
          new Request(`http://localhost/api/profiles/${profile.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              whatsappEnabled: true,
              whatsappNumber: "5511988887777",
            }),
          }),
          { params: Promise.resolve({ id: profile.id }) }
        )
      ).status
    ).toBe(403);
  });

  it("suspends and reactivates accounts, invalidating active sessions and login immediately", async () => {
    const authClient = authenticateUser("clinica@linkia.test", "ClientPass123!");
    expect(authClient.user).toBeDefined();
    const client = authClient.user!;

    // Suspend via admin
    actAs(adminUser);
    const suspendRes = await adminPatchUserPatch(
      new Request(`http://localhost/api/admin/users/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ userId: client.id }) }
    );
    expect(suspendRes.status).toBe(200);
    expect((await suspendRes.json()).user.isActive).toBe(false);

    // Login fails while suspended
    expect(authenticateUser("clinica@linkia.test", "ClientPass123!").user).toBeUndefined();

    // Existing session cookie returns null
    actAs(client);
    expect(await getSessionUser()).toBeNull();

    // Admin cannot suspend self
    actAs(adminUser);
    const selfSuspendRes = await adminPatchUserPatch(
      new Request(`http://localhost/api/admin/users/${adminUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ userId: adminUser.id }) }
    );
    expect(selfSuspendRes.status).toBe(400);

    // Reactivate client
    const reactivateRes = await adminPatchUserPatch(
      new Request(`http://localhost/api/admin/users/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      }),
      { params: Promise.resolve({ userId: client.id }) }
    );
    expect(reactivateRes.status).toBe(200);
    expect(authenticateUser("clinica@linkia.test", "ClientPass123!").user).toBeDefined();
  });
});
