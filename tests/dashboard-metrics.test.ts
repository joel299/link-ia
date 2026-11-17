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

import { registerUser, setSessionCookie, type SessionUser } from "../src/lib/auth";
import {
  clearPublicEventRateLimiterForTests,
  getDashboardSnapshotForOwner,
} from "../src/lib/dashboard";
import { closeDb, getDb } from "../src/lib/db";
import { createEmptyPermissions, saveUserPermissions } from "../src/lib/permissions";
import { createProfile } from "../src/lib/profiles";
import { GET as dashboardGet } from "../src/app/api/dashboard/route";
import { POST as publicEventsPost } from "../src/app/api/public/profiles/[slug]/events/route";

function actAs(user: SessionUser | null) {
  if (!user) {
    cookieState.token = null;
    return;
  }
  const res = NextResponse.json({ ok: true });
  void setSessionCookie(user, res);
  cookieState.token = res.cookies.get("linkia_session")?.value ?? null;
}

describe("Dashboard metrics, public interaction events, and connected account counts", () => {
  let tmpDir: string;
  let owner: SessionUser;
  let profileId: string;
  const slug = "clinica-aurora";

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkia-dashboard-"));
    process.env.DATA_DIR = tmpDir;
    process.env.SESSION_SECRET = "test-dashboard-secret-1234567890abcdef";

    owner = registerUser("aurora@linkia.test", "Aurora", "AuroraPass123!").user!;
    const created = createProfile(owner.id, {
      slug,
      displayName: "Clínica Aurora",
    });
    profileId = created.profile!.id;

    const db = getDb();
    db.prepare(
      `UPDATE profiles
       SET status = 'published',
           instagram_enabled = 1,
           instagram_url = 'https://instagram.com/clinicaaurora',
           whatsapp_enabled = 1,
           whatsapp_number = '5511999990000',
           booking_enabled = 1,
           booking_url = 'https://cal.com/clinicaaurora'
       WHERE id = ?`
    ).run(profileId);
  });

  beforeEach(() => {
    cookieState.token = null;
    clearPublicEventRateLimiterForTests();
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });

  it("validates, persists without PII, and rate-limits public interaction events", async () => {
    const badRes = await publicEventsPost(
      new Request(`http://localhost/api/public/profiles/${slug}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
        body: JSON.stringify({ eventType: "invalid_type" }),
      }),
      { params: Promise.resolve({ slug }) }
    );
    expect(badRes.status).toBe(400);

    const missingSlugRes = await publicEventsPost(
      new Request("http://localhost/api/public/profiles/nao-existe/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
        body: JSON.stringify({ eventType: "whatsapp_click" }),
      }),
      { params: Promise.resolve({ slug: "nao-existe" }) }
    );
    expect(missingSlugRes.status).toBe(404);

    for (const eventType of ["whatsapp_click", "instagram_click", "booking_click"]) {
      const okRes = await publicEventsPost(
        new Request(`http://localhost/api/public/profiles/${slug}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.2" },
          body: JSON.stringify({ eventType }),
        }),
        { params: Promise.resolve({ slug }) }
      );
      expect(okRes.status).toBe(201);
    }

    const db = getDb();
    const cols = db
      .prepare("PRAGMA table_info(public_interaction_events)")
      .all() as Array<{ name: string }>;
    expect(cols.map((c) => c.name)).toEqual([
      "id",
      "profile_id",
      "owner_id",
      "event_type",
      "created_at",
    ]);

    const rows = db
      .prepare("SELECT event_type FROM public_interaction_events WHERE profile_id = ?")
      .all(profileId) as Array<{ event_type: string }>;
    expect(rows).toHaveLength(3);

    // Rate limit enforcement after 60 requests
    for (let i = 0; i < 60; i++) {
      await publicEventsPost(
        new Request(`http://localhost/api/public/profiles/${slug}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.99" },
          body: JSON.stringify({ eventType: "whatsapp_click" }),
        }),
        { params: Promise.resolve({ slug }) }
      );
    }
    const limitedRes = await publicEventsPost(
      new Request(`http://localhost/api/public/profiles/${slug}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.99" },
        body: JSON.stringify({ eventType: "whatsapp_click" }),
      }),
      { params: Promise.resolve({ slug }) }
    );
    expect(limitedRes.status).toBe(429);
  });

  it("counts only confirmed connected accounts and separates unit charts honestly", async () => {
    const db = getDb();
    const now = new Date().toISOString();

    // 1 connected WhatsApp, 1 pending Instagram (should NOT count), 1 connected Calendar
    db.prepare(
      `INSERT INTO whatsapp_connections (id, profile_id, owner_id, zernio_profile_id, status, display_name, created_at, updated_at)
       VALUES (?, ?, ?, 'zp_1', 'connected', 'Aurora WA', ?, ?)`
    ).run("wa-1", profileId, owner.id, now, now);

    db.prepare(
      `INSERT INTO social_connections (id, profile_id, owner_id, provider, toolkit_slug, composio_user_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'instagram', 'instagram', 'cu_1', 'pending', ?, ?)`
    ).run("ig-1", profileId, owner.id, now, now);

    db.prepare(
      `INSERT INTO calendar_connections (id, profile_id, composio_user_id, status, account_label, created_at, updated_at)
       VALUES (?, ?, 'cu_1', 'connected', 'agenda@aurora.test', ?, ?)`
    ).run("cal-1", profileId, now, now);

    const snapshot = await getDashboardSnapshotForOwner({
      ownerId: owner.id,
      period: "last_30d",
    });

    expect(snapshot.connectedAccounts.total).toBe(2);
    expect(snapshot.connectedAccounts.items.map((i) => i.channel).sort()).toEqual([
      "google_calendar",
      "whatsapp",
    ]);

    expect(snapshot.interactions.whatsappClicks).toBe(61);
    expect(snapshot.interactions.instagramClicks).toBe(1);
    expect(snapshot.interactions.bookingClicks).toBe(1);

    // Separate chart units
    expect(snapshot.charts.clicks.unitLabel).toBe("cliques");
    expect(snapshot.charts.impressions.unitLabel).toBe("impressões");
    expect(snapshot.charts.reach.unitLabel).toBe("alcance");

    // Organic Instagram clicks must NOT be presented as post impressions
    expect(snapshot.impressionsCard.available).toBe(false);
    expect(snapshot.charts.impressions.available).toBe(false);
    expect(snapshot.charts.reach.available).toBe(false);
    expect(snapshot.campaigns.names).toEqual([]);
  });

  it("enforces auth and user feature permissions on GET /api/dashboard", async () => {
    const unauthRes = await dashboardGet(new Request("http://localhost/api/dashboard"));
    expect(unauthRes.status).toBe(401);

    // Restrict owner to only whatsapp
    saveUserPermissions(
      owner.id,
      {
        ...createEmptyPermissions(),
        whatsapp: true,
      },
      owner.id
    );

    actAs(owner);
    const res = await dashboardGet(
      new Request("http://localhost/api/dashboard?period=last_7d")
    );
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.dashboard.period).toBe("last_7d");
    // Calendar account excluded because google_calendar permission is false
    expect(payload.dashboard.connectedAccounts.total).toBe(1);
    expect(payload.dashboard.connectedAccounts.items[0].channel).toBe("whatsapp");
    expect(payload.dashboard.campaigns.hasAdsPermission).toBe(false);
  });

  it("validates custom date ranges and filters metrics accurately without timezone drift", async () => {
    actAs(owner);

    // Missing dates -> 400
    const missingRes = await dashboardGet(
      new Request("http://localhost/api/dashboard?period=custom")
    );
    expect(missingRes.status).toBe(400);

    // Invalid calendar date -> 400
    const invalidDateRes = await dashboardGet(
      new Request(
        "http://localhost/api/dashboard?period=custom&since=2026-02-30&until=2026-03-01"
      )
    );
    expect(invalidDateRes.status).toBe(400);

    // Reversed range -> 400
    const reversedRes = await dashboardGet(
      new Request(
        "http://localhost/api/dashboard?period=custom&since=2026-11-10&until=2026-11-01"
      )
    );
    expect(reversedRes.status).toBe(400);

    // Seed two dated events: one inside [2026-10-05, 2026-10-10] and one outside
    const db = getDb();
    db.prepare(
      `INSERT INTO public_interaction_events (id, profile_id, owner_id, event_type, created_at)
       VALUES (?, ?, ?, 'whatsapp_click', ?)`
    ).run("ev-in", profileId, owner.id, "2026-10-10T23:59:59.000Z");
    db.prepare(
      `INSERT INTO public_interaction_events (id, profile_id, owner_id, event_type, created_at)
       VALUES (?, ?, ?, 'whatsapp_click', ?)`
    ).run("ev-out", profileId, owner.id, "2026-10-11T00:00:00.000Z");

    const customRes = await dashboardGet(
      new Request(
        "http://localhost/api/dashboard?period=custom&since=2026-10-05&until=2026-10-10"
      )
    );
    expect(customRes.status).toBe(200);
    const customPayload = await customRes.json();
    expect(customPayload.dashboard.period).toBe("custom");
    expect(customPayload.dashboard.since).toBe("2026-10-05");
    expect(customPayload.dashboard.until).toBe("2026-10-10");
    expect(customPayload.dashboard.periodLabel).toBe("05/10/2026 – 10/10/2026");
    expect(customPayload.dashboard.interactions.whatsappClicks).toBe(1);
    expect(customPayload.dashboard.charts.clicks.total).toBe(1);
  });
});
