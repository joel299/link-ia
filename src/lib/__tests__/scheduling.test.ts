import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerUser } from "../auth";
import {
  CalendarProvider,
  ComposioProviderError,
  deriveComposioUserId,
} from "../composio";
import { closeDb, getDb } from "../db";
import {
  createProfile,
  getPublishedPublicProfileBySlug,
  publishProfile,
  updateProfile,
} from "../profiles";
import {
  completeCalendarOAuthCallback,
  createBookingForProfile,
  disconnectCalendarConnection,
  getAvailableSlotsForDate,
  getAvailableSlotsForRange,
  getCalendarConnectionView,
  initiateCalendarConnection,
  SchedulingError,
  SchedulingValidationError,
  upsertBookingSettings,
  zonedWallTimeToUtc,
} from "../scheduling";

let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkia-sched-test-"));
  process.env.DATA_DIR = tempDir;
});

afterAll(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeFakeProvider(overrides?: Partial<CalendarProvider>): CalendarProvider {
  return {
    async createConnectLink({ composioUserId }) {
      return {
        connectedAccountId: `conn_${composioUserId}`,
        redirectUrl: "https://composio.example/connect",
        isMock: false,
      };
    },
    async getConnectionStatus() {
      return {
        status: "connected",
        accountLabel: "profissional@gmail.com",
      };
    },
    async disconnectAccount() {},
    async queryFreeBusy() {
      return [];
    },
    async createCalendarEvent() {
      return { eventId: "gcal_evt_123" };
    },
    ...overrides,
  };
}

function setupPublishedProfile(
  email: string,
  slug: string,
  whatsappNumber = "5511999999999"
) {
  const user = registerUser(email, "Profissional", "senha123").user!;
  const created = createProfile(user.id, {
    displayName: "Agenda Teste",
    slug,
  });
  const profile = created.profile!;
  updateProfile(profile.id, user.id, {
    instagramEnabled: false,
    whatsappNumber,
    whatsappEnabled: Boolean(whatsappNumber),
    bookingEnabled: false,
  });
  const pub = publishProfile(profile.id, user.id);
  expect(pub.status).toBe(200);
  return { user, profile };
}

describe("Google Calendar + Composio scheduling", () => {
  it("completes OAuth authorization, enables internalBookingEnabled, and converts IANA timezone accurately", async () => {
    const { user, profile } = setupPublishedProfile("ana@exemplo.com", "ana-studio");
    const provider = makeFakeProvider();

    // Before connection: internalBookingEnabled must be false
    expect(getPublishedPublicProfileBySlug("ana-studio")?.internalBookingEnabled).toBe(false);

    const init = await initiateCalendarConnection({
      profileId: profile.id,
      ownerId: user.id,
      origin: "http://localhost:3000",
      provider,
    });
    expect(init.redirectUrl).toBe("https://composio.example/connect");

    const stateRow = getDb()
      .prepare("SELECT state FROM oauth_states WHERE profile_id = ?")
      .get(profile.id) as { state: string };

    const cb = await completeCalendarOAuthCallback({
      state: stateRow.state,
      ownerId: user.id,
      provider,
    });
    expect(cb.status).toBe("connected");

    const view = getCalendarConnectionView(profile.id);
    expect(view.status).toBe("connected");
    expect(view.accountLabel).toBe("profissional@gmail.com");

    // Enable booking settings in America/Sao_Paulo (-03:00)
    const saved = upsertBookingSettings(profile.id, {
      timezone: "America/Sao_Paulo",
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      minNoticeMinutes: 0,
      horizonDays: 30,
      enabled: true,
      weeklySchedule: [
        { dayOfWeek: 0, enabled: true, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 2, enabled: true, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 3, enabled: true, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 4, enabled: true, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 5, enabled: true, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 6, enabled: true, startTime: "09:00", endTime: "12:00" },
      ],
    });
    expect(saved.errors).toBeUndefined();

    // Now internalBookingEnabled is true
    expect(getPublishedPublicProfileBySlug("ana-studio")?.internalBookingEnabled).toBe(true);

    // 09:00 America/Sao_Paulo == 12:00 UTC
    const utcDate = zonedWallTimeToUtc("2026-11-20", "09:00", "America/Sao_Paulo");
    expect(utcDate.toISOString()).toBe("2026-11-20T12:00:00.000Z");

    const avail = await getAvailableSlotsForDate({
      slug: "ana-studio",
      date: "2026-11-20",
      now: new Date("2026-11-19T12:00:00.000Z"),
      provider,
    });
    expect(avail.timezone).toBe("America/Sao_Paulo");
    expect(avail.slots.map((s) => s.label)).toEqual(["09:00", "10:00", "11:00"]);
    expect(avail.slots[0].startIso).toBe("2026-11-20T12:00:00.000Z");
  });

  it("handles cancelled and expired OAuth states and blocks availability when disconnected/expired", async () => {
    const { user, profile } = setupPublishedProfile("bruno@exemplo.com", "bruno-barber");
    const provider = makeFakeProvider();

    await initiateCalendarConnection({
      profileId: profile.id,
      ownerId: user.id,
      origin: "http://localhost:3000",
      provider,
    });

    const stateRow = getDb()
      .prepare("SELECT state FROM oauth_states WHERE profile_id = ?")
      .get(profile.id) as { state: string };

    const cancelled = await completeCalendarOAuthCallback({
      state: stateRow.state,
      ownerId: user.id,
      queryStatus: "cancelled",
      provider,
    });
    expect(cancelled.status).toBe("disconnected");

    await expect(
      getAvailableSlotsForDate({
        slug: "bruno-barber",
        date: "2026-11-20",
        now: new Date("2026-11-19T12:00:00.000Z"),
        provider,
      })
    ).rejects.toMatchObject({ status: 409 });

    // Expired connection from provider
    const expiredProvider = makeFakeProvider({
      async getConnectionStatus() {
        return { status: "expired", accountLabel: null };
      },
    });
    await initiateCalendarConnection({
      profileId: profile.id,
      ownerId: user.id,
      origin: "http://localhost:3000",
      provider: expiredProvider,
    });
    const stateRow2 = getDb()
      .prepare("SELECT state FROM oauth_states WHERE profile_id = ?")
      .get(profile.id) as { state: string };

    const expiredCb = await completeCalendarOAuthCallback({
      state: stateRow2.state,
      ownerId: user.id,
      provider: expiredProvider,
    });
    expect(expiredCb.status).toBe("expired");
  });

  it("fails closed on provider FreeBusy or CreateEvent errors", async () => {
    const { user, profile } = setupPublishedProfile("clara@exemplo.com", "clara-clinica");
    const okProvider = makeFakeProvider();

    await initiateCalendarConnection({
      profileId: profile.id,
      ownerId: user.id,
      origin: "http://localhost:3000",
      provider: okProvider,
    });
    const stateRow = getDb()
      .prepare("SELECT state FROM oauth_states WHERE profile_id = ?")
      .get(profile.id) as { state: string };
    await completeCalendarOAuthCallback({
      state: stateRow.state,
      ownerId: user.id,
      provider: okProvider,
    });
    upsertBookingSettings(profile.id, {
      timezone: "UTC",
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      minNoticeMinutes: 0,
      horizonDays: 30,
      enabled: true,
    });

    const failingFreeBusyProvider = makeFakeProvider({
      async queryFreeBusy() {
        throw new ComposioProviderError("Google API timeout");
      },
    });

    await expect(
      getAvailableSlotsForDate({
        slug: "clara-clinica",
        date: "2026-11-20",
        now: new Date("2026-11-19T12:00:00.000Z"),
        provider: failingFreeBusyProvider,
      })
    ).rejects.toMatchObject({ status: 503 });

    const failingCreateProvider = makeFakeProvider({
      async createCalendarEvent() {
        throw new ComposioProviderError("Create event failed");
      },
    });

    await expect(
      createBookingForProfile({
        slug: "clara-clinica",
        startIso: "2026-11-20T09:00:00.000Z",
        idempotencyKey: "key-fail-1234",
        clientName: "Cliente Teste",
        clientContact: "11999999999",
        now: new Date("2026-11-19T12:00:00.000Z"),
        provider: failingCreateProvider,
      })
    ).rejects.toMatchObject({ status: 502 });

    // Ensure no booking was persisted
    const count = getDb()
      .prepare("SELECT COUNT(*) as c FROM bookings WHERE profile_id = ?")
      .get(profile.id) as { c: number };
    expect(count.c).toBe(0);
  });

  it("prevents double-booking on FreeBusy conflict and guarantees idempotency on retry", async () => {
    const { user, profile } = setupPublishedProfile("diego@exemplo.com", "diego-fit");
    const createEventSpy = vi.fn(async () => ({ eventId: "evt_diego_1" }));

    const provider = makeFakeProvider({
      async queryFreeBusy() {
        // 10:00-11:00 UTC is already busy on Google Calendar
        return [
          {
            start: "2026-11-20T10:00:00.000Z",
            end: "2026-11-20T11:00:00.000Z",
          },
        ];
      },
      createCalendarEvent: createEventSpy,
    });

    await initiateCalendarConnection({
      profileId: profile.id,
      ownerId: user.id,
      origin: "http://localhost:3000",
      provider,
    });
    const stateRow = getDb()
      .prepare("SELECT state FROM oauth_states WHERE profile_id = ?")
      .get(profile.id) as { state: string };
    await completeCalendarOAuthCallback({
      state: stateRow.state,
      ownerId: user.id,
      provider,
    });
    upsertBookingSettings(profile.id, {
      timezone: "UTC",
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      minNoticeMinutes: 0,
      horizonDays: 30,
      enabled: true,
    });

    // 10:00 UTC must NOT be listed in available slots
    const avail = await getAvailableSlotsForDate({
      slug: "diego-fit",
      date: "2026-11-20",
      now: new Date("2026-11-19T12:00:00.000Z"),
      provider,
    });
    expect(avail.slots.some((s) => s.startIso === "2026-11-20T10:00:00.000Z")).toBe(
      false
    );

    // Direct attempt to book 10:00 UTC must fail with 409
    await expect(
      createBookingForProfile({
        slug: "diego-fit",
        startIso: "2026-11-20T10:00:00.000Z",
        idempotencyKey: "conflict-key-1",
        clientName: "João",
        clientPhone: "5511977776666",
        now: new Date("2026-11-19T12:00:00.000Z"),
        provider,
      })
    ).rejects.toMatchObject({ status: 409 });

    // Book 09:00 UTC with idempotency key
    const first = await createBookingForProfile({
      slug: "diego-fit",
      startIso: "2026-11-20T09:00:00.000Z",
      idempotencyKey: "retry-key-999",
      clientName: "Maria",
      clientPhone: "5511966665555",
      now: new Date("2026-11-19T12:00:00.000Z"),
      provider,
    });
    expect(first.idempotent).toBe(false);
    expect(createEventSpy).toHaveBeenCalledTimes(1);

    // Retry with same idempotencyKey returns existing booking without calling Google Calendar again
    const retry = await createBookingForProfile({
      slug: "diego-fit",
      startIso: "2026-11-20T09:00:00.000Z",
      idempotencyKey: "retry-key-999",
      clientName: "Maria",
      clientPhone: "5511966665555",
      now: new Date("2026-11-19T12:00:00.000Z"),
      provider,
    });
    expect(retry.idempotent).toBe(true);
    expect(retry.booking.id).toBe(first.booking.id);
    expect(createEventSpy).toHaveBeenCalledTimes(1);

    // Different idempotencyKey on already booked 09:00 UTC must fail with 409
    await expect(
      createBookingForProfile({
        slug: "diego-fit",
        startIso: "2026-11-20T09:00:00.000Z",
        idempotencyKey: "other-key-888",
        clientName: "Pedro",
        clientPhone: "5511955554444",
        now: new Date("2026-11-19T12:00:00.000Z"),
        provider,
      })
    ).rejects.toMatchObject({ status: 409 });

    // Disconnect revokes and disables booking_settings
    await disconnectCalendarConnection({ profileId: profile.id, provider });
    expect(getCalendarConnectionView(profile.id).status).toBe("disconnected");
    expect(getPublishedPublicProfileBySlug("diego-fit")?.internalBookingEnabled).toBe(
      false
    );
  });

  it("isolates tenants and rejects cross-user OAuth callbacks", async () => {
    const a = setupPublishedProfile("tenant-a@exemplo.com", "tenant-a");
    const b = setupPublishedProfile("tenant-b@exemplo.com", "tenant-b");

    expect(deriveComposioUserId(a.user.id, a.profile.id)).not.toBe(
      deriveComposioUserId(b.user.id, b.profile.id)
    );

    const provider = makeFakeProvider();
    await initiateCalendarConnection({
      profileId: a.profile.id,
      ownerId: a.user.id,
      origin: "http://localhost:3000",
      provider,
    });
    const stateRow = getDb()
      .prepare("SELECT state FROM oauth_states WHERE profile_id = ?")
      .get(a.profile.id) as { state: string };

    // Tenant B trying to complete Tenant A's OAuth state must fail with 403
    await expect(
      completeCalendarOAuthCallback({
        state: stateRow.state,
        ownerId: b.user.id,
        provider,
      })
    ).rejects.toBeInstanceOf(SchedulingError);
  });

  it("blocks activation without connected calendar or WhatsApp, validates clientPhone, and includes serviceName & whatsappContactUrl", async () => {
    const { user, profile } = setupPublishedProfile("eva@exemplo.com", "eva-estetica", "");
    const createEventSpy = vi.fn(async () => ({ eventId: "evt_eva_1" }));
    const provider = makeFakeProvider({ createCalendarEvent: createEventSpy });

    // 1) Enabling without connected calendar -> 422 SchedulingValidationError
    expect(() =>
      upsertBookingSettings(profile.id, { enabled: true })
    ).toThrow(SchedulingValidationError);

    // Connect calendar
    await initiateCalendarConnection({
      profileId: profile.id,
      ownerId: user.id,
      origin: "http://localhost:3000",
      provider,
    });
    const stateRow = getDb()
      .prepare("SELECT state FROM oauth_states WHERE profile_id = ?")
      .get(profile.id) as { state: string };
    await completeCalendarOAuthCallback({
      state: stateRow.state,
      ownerId: user.id,
      provider,
    });

    // 2) Enabling without WhatsApp on profile -> 422 SchedulingValidationError
    expect(() =>
      upsertBookingSettings(profile.id, {
        enabled: true,
        serviceName: "Limpeza de Pele",
      })
    ).toThrow(SchedulingValidationError);

    // Add valid WhatsApp to profile and activate
    updateProfile(profile.id, user.id, {
      whatsappNumber: "+55 (11) 91234-5678",
      whatsappEnabled: true,
    });

    const activated = upsertBookingSettings(profile.id, {
      timezone: "America/Sao_Paulo",
      serviceName: "Limpeza de Pele",
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      minNoticeMinutes: 0,
      horizonDays: 30,
      enabled: true,
    });
    expect(activated.settings?.serviceName).toBe("Limpeza de Pele");
    expect(getPublishedPublicProfileBySlug("eva-estetica")?.internalBookingEnabled).toBe(true);

    // 3) Invalid clientPhone -> 422 SchedulingValidationError
    await expect(
      createBookingForProfile({
        slug: "eva-estetica",
        startIso: "2026-11-20T12:00:00.000Z",
        idempotencyKey: "eva-bad-phone-1",
        clientName: "Luiza",
        clientPhone: "123",
        now: new Date("2026-11-19T12:00:00.000Z"),
        provider,
      })
    ).rejects.toMatchObject({ status: 422 });

    // 4) Valid booking includes serviceName, clientPhone in event & whatsappContactUrl in confirmation
    const created = await createBookingForProfile({
      slug: "eva-estetica",
      startIso: "2026-11-20T12:00:00.000Z",
      idempotencyKey: "eva-good-key-123",
      clientName: "Luiza",
      clientPhone: "(11) 99876-5432",
      notes: "Primeira vez",
      now: new Date("2026-11-19T12:00:00.000Z"),
      provider,
    });

    expect(createEventSpy).toHaveBeenCalledTimes(1);
    const eventArg = (createEventSpy.mock.calls[0] as unknown as Array<{ summary: string; description: string }>)[0];
    expect(eventArg.summary).toBe("Limpeza de Pele — Luiza");
    expect(eventArg.description).toContain("Limpeza de Pele");
    expect(eventArg.description).toContain("11998765432");

    expect(created.booking.professionalName).toBe("Agenda Teste");
    expect(created.booking.serviceName).toBe("Limpeza de Pele");
    expect(created.booking.whatsappContactUrl).toContain("https://wa.me/5511912345678?text=");
    expect(decodeURIComponent(created.booking.whatsappContactUrl!)).toContain("Agenda Teste");
    expect(decodeURIComponent(created.booking.whatsappContactUrl!)).toContain("Limpeza de Pele");
    expect(decodeURIComponent(created.booking.whatsappContactUrl!)).toContain("09:00");
  });

  it("uses saved horizonDays instead of a fixed 14-day window", async () => {
    const { user, profile } = setupPublishedProfile("fabi@exemplo.com", "fabi-studio");
    const provider = makeFakeProvider();

    await initiateCalendarConnection({
      profileId: profile.id,
      ownerId: user.id,
      origin: "http://localhost:3000",
      provider,
    });
    const stateRow = getDb()
      .prepare("SELECT state FROM oauth_states WHERE profile_id = ?")
      .get(profile.id) as { state: string };
    await completeCalendarOAuthCallback({
      state: stateRow.state,
      ownerId: user.id,
      provider,
    });

    upsertBookingSettings(profile.id, {
      timezone: "America/Sao_Paulo",
      serviceName: "Mentoria",
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      minNoticeMinutes: 0,
      horizonDays: 5,
      enabled: true,
    });

    const now = new Date("2026-11-16T12:00:00.000Z"); // 09:00 BRT
    const withinHorizon = await getAvailableSlotsForDate({
      slug: "fabi-studio",
      date: "2026-11-20", // +4 days
      now,
      provider,
    });
    expect(withinHorizon.horizonDays).toBe(5);
    expect(withinHorizon.slots.length).toBeGreaterThan(0);

    const beyondShortHorizon = await getAvailableSlotsForDate({
      slug: "fabi-studio",
      date: "2026-11-23", // +7 days (> 5)
      now,
      provider,
    });
    expect(beyondShortHorizon.slots).toEqual([]);

    upsertBookingSettings(profile.id, { horizonDays: 25 });
    const withinExtendedHorizon = await getAvailableSlotsForDate({
      slug: "fabi-studio",
      date: "2026-12-07", // +21 days (<= 25)
      now,
      provider,
    });
    expect(withinExtendedHorizon.horizonDays).toBe(25);
    expect(withinExtendedHorizon.slots.length).toBeGreaterThan(0);

    // Range endpoint query clamps to [today, today + horizonDays] and returns per-day map
    const rangeResult = await getAvailableSlotsForRange({
      slug: "fabi-studio",
      from: "2026-11-15",
      to: "2026-11-22",
      now,
      provider,
    });
    expect(rangeResult.from).toBe("2026-11-16");
    expect(rangeResult.days["2026-11-16"]?.length).toBeGreaterThan(0);
    expect(rangeResult.days["2026-11-21"]).toEqual([]); // Saturday disabled by default
  });
});
