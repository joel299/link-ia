import crypto from "node:crypto";
import {
  BusyInterval,
  CalendarProvider,
  ComposioProviderError,
  defaultCalendarProvider,
  deriveComposioUserId,
  getComposioMode,
} from "./composio";
import { formatPriceBRL, getPublishedAppointmentService } from "./catalog";
import { getDb } from "./db";
import {
  AvailableSlot,
  BookingSettings,
  CalendarConnectionStatus,
  CalendarConnectionView,
  DEFAULT_WEEKLY_SCHEDULE,
  PublicBookingConfirmation,
  ValidationErrors,
  WeeklyAvailabilityDay,
} from "./types";
import { normalizeWhatsApp, sanitizePlainText } from "./validation";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class SchedulingError extends Error {
  status: number;
  errors?: ValidationErrors;

  constructor(message: string, status = 400, errors?: ValidationErrors) {
    super(message);
    this.name = "SchedulingError";
    this.status = status;
    this.errors = errors;
  }
}

export class BookingConflictError extends SchedulingError {
  constructor(message = "Este horário acabou de ser ocupado. Por favor, escolha outro horário.") {
    super(message, 409);
    this.name = "BookingConflictError";
  }
}

export class SchedulingValidationError extends SchedulingError {
  constructor(message: string, errors?: ValidationErrors) {
    super(message, 422, errors);
    this.name = "SchedulingValidationError";
  }
}

interface CalendarConnectionRow {
  id: string;
  profile_id: string;
  provider: string;
  composio_user_id: string;
  composio_connected_account_id: string | null;
  status: CalendarConnectionStatus;
  calendar_id: string;
  account_label: string | null;
  is_mock: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

interface OAuthStateRow {
  state: string;
  profile_id: string;
  owner_id: string;
  composio_user_id: string;
  composio_connected_account_id: string | null;
  is_mock: number;
  expires_at: string;
  created_at: string;
}

interface BookingSettingsRow {
  profile_id: string;
  timezone: string;
  service_name?: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  min_notice_minutes: number;
  horizon_days: number;
  enabled: number;
  weekly_schedule_json: string;
  updated_at: string;
}

interface BookingRow {
  id: string;
  profile_id: string;
  provider_event_id: string;
  idempotency_key: string;
  start_iso: string;
  end_iso: string;
  timezone: string;
  client_name: string;
  client_contact: string;
  notes: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

export function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== "string") return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }
  const hour = map.hour === 24 ? 0 : map.hour;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour,
    minute: map.minute,
    second: map.second,
  };
}

/**
 * Converts a YYYY-MM-DD + HH:MM wall-clock time in an IANA timezone into a UTC Date.
 */
export function zonedWallTimeToUtc(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidateMs = targetUtcMs;

  for (let i = 0; i < 2; i++) {
    const zoned = getZonedParts(new Date(candidateMs), timezone);
    const zonedAsUtcMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
      0
    );
    const diffMs = zonedAsUtcMs - targetUtcMs;
    if (diffMs === 0) break;
    candidateMs -= diffMs;
  }

  return new Date(candidateMs);
}

export function getDateStringInTimezone(date: Date, timezone: string): string {
  const parts = getZonedParts(date, timezone);
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}

export function formatTimeInTimezone(date: Date, timezone: string): string {
  const parts = getZonedParts(date, timezone);
  const hh = String(parts.hour).padStart(2, "0");
  const min = String(parts.minute).padStart(2, "0");
  return `${hh}:${min}`;
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getDayOfWeekFromDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function getCalendarConnectionView(
  profileId: string
): CalendarConnectionView {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM calendar_connections WHERE profile_id = ?")
    .get(profileId) as CalendarConnectionRow | undefined;

  if (!row) {
    return {
      provider: "google_calendar",
      status: "disconnected",
      calendarId: "primary",
      accountLabel: null,
      isMock: getComposioMode() === "mock",
      lastError: null,
      updatedAt: null,
    };
  }

  return {
    provider: "google_calendar",
    status: row.status,
    calendarId: row.calendar_id,
    accountLabel: row.account_label,
    isMock: Boolean(row.is_mock),
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

export async function initiateCalendarConnection(params: {
  profileId: string;
  ownerId: string;
  origin: string;
  provider?: CalendarProvider;
}): Promise<{ redirectUrl: string; isMock: boolean }> {
  const {
    profileId,
    ownerId,
    origin,
    provider = defaultCalendarProvider,
  } = params;
  const composioUserId = deriveComposioUserId(ownerId, profileId);
  const state = crypto.randomBytes(24).toString("hex");
  const callbackUrl = `${origin}/api/integrations/composio/callback?state=${encodeURIComponent(state)}`;

  const link = await provider.createConnectLink({
    composioUserId,
    callbackUrl,
    state,
    profileId,
  });

  const db = getDb();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO oauth_states (
      state, profile_id, owner_id, composio_user_id, composio_connected_account_id, is_mock, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    state,
    profileId,
    ownerId,
    composioUserId,
    link.connectedAccountId,
    link.isMock ? 1 : 0,
    expiresAt,
    now
  );

  db.prepare(
    `INSERT INTO calendar_connections (
      id, profile_id, provider, composio_user_id, composio_connected_account_id,
      status, calendar_id, account_label, is_mock, last_error, created_at, updated_at, revoked_at
    ) VALUES (?, ?, 'google_calendar', ?, ?, 'pending', 'primary', NULL, ?, NULL, ?, ?, NULL)
    ON CONFLICT(profile_id) DO UPDATE SET
      composio_user_id = excluded.composio_user_id,
      composio_connected_account_id = excluded.composio_connected_account_id,
      status = 'pending',
      is_mock = excluded.is_mock,
      last_error = NULL,
      updated_at = excluded.updated_at,
      revoked_at = NULL`
  ).run(
    crypto.randomUUID(),
    profileId,
    composioUserId,
    link.connectedAccountId,
    link.isMock ? 1 : 0,
    now,
    now
  );

  return {
    redirectUrl: link.redirectUrl,
    isMock: link.isMock,
  };
}

export async function completeCalendarOAuthCallback(params: {
  state: string;
  ownerId: string;
  queryStatus?: string | null;
  queryError?: string | null;
  queryConnectedAccountId?: string | null;
  provider?: CalendarProvider;
}): Promise<{ profileId: string; status: CalendarConnectionStatus }> {
  const {
    state,
    ownerId,
    queryStatus,
    queryError,
    queryConnectedAccountId,
    provider = defaultCalendarProvider,
  } = params;

  const db = getDb();
  const oauthRow = db
    .prepare("SELECT * FROM oauth_states WHERE state = ?")
    .get(state) as OAuthStateRow | undefined;

  if (!oauthRow) {
    throw new SchedulingError(
      "Solicitação de autorização inválida ou já utilizada.",
      400
    );
  }

  // Single-use state token
  db.prepare("DELETE FROM oauth_states WHERE state = ?").run(state);

  if (oauthRow.owner_id !== ownerId) {
    throw new SchedulingError("Sessão incompatível com a autorização.", 403);
  }

  if (new Date(oauthRow.expires_at).getTime() < Date.now()) {
    throw new SchedulingError("Solicitação de autorização expirada.", 400);
  }

  const now = new Date().toISOString();

  if (queryStatus === "cancelled") {
    db.prepare(
      `UPDATE calendar_connections
       SET status = 'disconnected', composio_connected_account_id = NULL, last_error = ?, updated_at = ?
       WHERE profile_id = ?`
    ).run("Autorização cancelada pelo usuário.", now, oauthRow.profile_id);

    return { profileId: oauthRow.profile_id, status: "disconnected" };
  }

  if (queryError) {
    db.prepare(
      `UPDATE calendar_connections
       SET status = 'failed', last_error = ?, updated_at = ?
       WHERE profile_id = ?`
    ).run(queryError.slice(0, 200), now, oauthRow.profile_id);

    return { profileId: oauthRow.profile_id, status: "failed" };
  }

  const connectedAccountId =
    oauthRow.composio_connected_account_id || queryConnectedAccountId;

  if (!connectedAccountId) {
    db.prepare(
      `UPDATE calendar_connections
       SET status = 'failed', last_error = ?, updated_at = ?
       WHERE profile_id = ?`
    ).run("Conta conectada não identificada no retorno.", now, oauthRow.profile_id);

    return { profileId: oauthRow.profile_id, status: "failed" };
  }

  try {
    const verified = await provider.getConnectionStatus({
      connectedAccountId,
      isMock: Boolean(oauthRow.is_mock),
      expectedComposioUserId: oauthRow.composio_user_id,
    });

    const lastError =
      verified.status === "connected"
        ? null
        : verified.status === "expired"
          ? "Conexão expirada ou revogada. Reconecte sua conta Google."
          : verified.status === "failed"
            ? "Não foi possível confirmar a autorização com o Google."
            : null;

    db.prepare(
      `UPDATE calendar_connections
       SET composio_connected_account_id = ?, status = ?, account_label = ?, last_error = ?, updated_at = ?
       WHERE profile_id = ?`
    ).run(
      connectedAccountId,
      verified.status,
      verified.accountLabel,
      lastError,
      now,
      oauthRow.profile_id
    );

    return { profileId: oauthRow.profile_id, status: verified.status };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message.slice(0, 200)
        : "Falha ao verificar conexão.";
    db.prepare(
      `UPDATE calendar_connections
       SET status = 'failed', last_error = ?, updated_at = ?
       WHERE profile_id = ?`
    ).run(msg, now, oauthRow.profile_id);

    return { profileId: oauthRow.profile_id, status: "failed" };
  }
}

export async function disconnectCalendarConnection(params: {
  profileId: string;
  provider?: CalendarProvider;
}): Promise<CalendarConnectionView> {
  const { profileId, provider = defaultCalendarProvider } = params;
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM calendar_connections WHERE profile_id = ?")
    .get(profileId) as CalendarConnectionRow | undefined;

  if (existing?.composio_connected_account_id) {
    await provider.disconnectAccount({
      connectedAccountId: existing.composio_connected_account_id,
      isMock: Boolean(existing.is_mock),
    });
  }

  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      `UPDATE calendar_connections
       SET status = 'disconnected', composio_connected_account_id = NULL, account_label = NULL,
           last_error = NULL, updated_at = ?, revoked_at = ?
       WHERE profile_id = ?`
    ).run(now, now, profileId);
  }

  db.prepare(
    `UPDATE booking_settings SET enabled = 0, updated_at = ? WHERE profile_id = ?`
  ).run(now, profileId);

  return getCalendarConnectionView(profileId);
}

export function getBookingSettings(profileId: string): BookingSettings {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM booking_settings WHERE profile_id = ?")
    .get(profileId) as BookingSettingsRow | undefined;

  if (!row) {
    return {
      profileId,
      timezone: "America/Sao_Paulo",
      serviceName: "Atendimento",
      slotDurationMinutes: 30,
      bufferMinutes: 10,
      minNoticeMinutes: 60,
      horizonDays: 14,
      enabled: false,
      weeklySchedule: DEFAULT_WEEKLY_SCHEDULE.map((d) => ({ ...d })),
      updatedAt: new Date().toISOString(),
    };
  }

  let weeklySchedule: WeeklyAvailabilityDay[] = DEFAULT_WEEKLY_SCHEDULE;
  try {
    const parsed = JSON.parse(row.weekly_schedule_json);
    if (Array.isArray(parsed) && parsed.length === 7) {
      weeklySchedule = parsed;
    }
  } catch {
    weeklySchedule = DEFAULT_WEEKLY_SCHEDULE;
  }

  return {
    profileId: row.profile_id,
    timezone: row.timezone,
    serviceName: row.service_name?.trim() || "Atendimento",
    slotDurationMinutes: row.slot_duration_minutes,
    bufferMinutes: row.buffer_minutes,
    minNoticeMinutes: row.min_notice_minutes,
    horizonDays: row.horizon_days,
    enabled: Boolean(row.enabled),
    weeklySchedule,
    updatedAt: row.updated_at,
  };
}

export function upsertBookingSettings(
  profileId: string,
  input: Partial<Omit<BookingSettings, "profileId" | "updatedAt">>
): { settings?: BookingSettings; errors?: ValidationErrors } {
  const current = getBookingSettings(profileId);
  const errors: ValidationErrors = {};

  let timezone = current.timezone;
  if (input.timezone !== undefined) {
    if (typeof input.timezone !== "string") {
      errors.timezone = "Fuso horário deve ser uma string IANA válida.";
    } else {
      timezone = input.timezone.trim();
      if (!isValidIanaTimezone(timezone)) {
        errors.timezone = "Fuso horário IANA inválido (ex.: America/Sao_Paulo).";
      }
    }
  }

  let serviceName = current.serviceName || "Atendimento";
  if (input.serviceName !== undefined) {
    if (typeof input.serviceName !== "string") {
      errors.serviceName = "O nome do serviço deve ser texto simples.";
    } else {
      const nameCheck = sanitizePlainText(input.serviceName, 80);
      if (nameCheck.error) {
        errors.serviceName = nameCheck.error;
      } else {
        serviceName = nameCheck.value || "Atendimento";
      }
    }
  }

  let slotDurationMinutes = current.slotDurationMinutes;
  if (input.slotDurationMinutes !== undefined) {
    if (
      typeof input.slotDurationMinutes !== "number" ||
      !Number.isFinite(input.slotDurationMinutes) ||
      !Number.isInteger(input.slotDurationMinutes) ||
      input.slotDurationMinutes < 10 ||
      input.slotDurationMinutes > 240
    ) {
      errors.slotDurationMinutes =
        "A duração do atendimento deve ser um inteiro entre 10 e 240 minutos.";
    } else {
      slotDurationMinutes = input.slotDurationMinutes;
    }
  }

  let bufferMinutes = current.bufferMinutes;
  if (input.bufferMinutes !== undefined) {
    if (
      typeof input.bufferMinutes !== "number" ||
      !Number.isFinite(input.bufferMinutes) ||
      !Number.isInteger(input.bufferMinutes) ||
      input.bufferMinutes < 0 ||
      input.bufferMinutes > 120
    ) {
      errors.bufferMinutes =
        "O intervalo entre atendimentos deve ser um inteiro entre 0 e 120 minutos.";
    } else {
      bufferMinutes = input.bufferMinutes;
    }
  }

  let minNoticeMinutes = current.minNoticeMinutes;
  if (input.minNoticeMinutes !== undefined) {
    if (
      typeof input.minNoticeMinutes !== "number" ||
      !Number.isFinite(input.minNoticeMinutes) ||
      !Number.isInteger(input.minNoticeMinutes) ||
      input.minNoticeMinutes < 0 ||
      input.minNoticeMinutes > 10080
    ) {
      errors.minNoticeMinutes =
        "A antecedência mínima deve ser um inteiro entre 0 e 10080 minutos (7 dias).";
    } else {
      minNoticeMinutes = input.minNoticeMinutes;
    }
  }

  let horizonDays = current.horizonDays;
  if (input.horizonDays !== undefined) {
    if (
      typeof input.horizonDays !== "number" ||
      !Number.isFinite(input.horizonDays) ||
      !Number.isInteger(input.horizonDays) ||
      input.horizonDays < 1 ||
      input.horizonDays > 90
    ) {
      errors.horizonDays =
        "O horizonte de reserva deve ser um inteiro entre 1 e 90 dias.";
    } else {
      horizonDays = input.horizonDays;
    }
  }

  let enabled = current.enabled;
  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") {
      errors.enabled = "O campo 'enabled' deve ser booleano.";
    } else {
      enabled = input.enabled;
    }
  }

  let weeklySchedule = current.weeklySchedule;
  if (input.weeklySchedule !== undefined) {
    if (!Array.isArray(input.weeklySchedule) || input.weeklySchedule.length !== 7) {
      errors.weeklySchedule = "Informe os 7 dias da semana (0 a 6).";
    } else {
      const normalizedDays: WeeklyAvailabilityDay[] = [];
      for (let i = 0; i < 7; i++) {
        const day = input.weeklySchedule.find(
          (d) =>
            typeof d === "object" &&
            d !== null &&
            typeof d.dayOfWeek === "number" &&
            Number.isFinite(d.dayOfWeek) &&
            d.dayOfWeek === i
        );
        if (!day) {
          errors.weeklySchedule = `Dia da semana ${i} ausente ou inválido.`;
          break;
        }
        if (
          typeof day.enabled !== "boolean" ||
          typeof day.startTime !== "string" ||
          typeof day.endTime !== "string"
        ) {
          errors.weeklySchedule = `Tipos inválidos no dia ${i}.`;
          break;
        }
        if (!TIME_RE.test(day.startTime) || !TIME_RE.test(day.endTime)) {
          errors.weeklySchedule = `Horário inválido no dia ${i}. Use formato HH:MM.`;
          break;
        }
        if (
          day.enabled &&
          timeToMinutes(day.startTime) >= timeToMinutes(day.endTime)
        ) {
          errors.weeklySchedule = `Horário de início deve ser menor que o fim no dia ${i}.`;
          break;
        }
        normalizedDays.push({
          dayOfWeek: i,
          enabled: day.enabled,
          startTime: day.startTime,
          endTime: day.endTime,
        });
      }
      if (!errors.weeklySchedule) {
        weeklySchedule = normalizedDays;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const db = getDb();

  if (enabled) {
    const conn = db
      .prepare("SELECT status FROM calendar_connections WHERE profile_id = ?")
      .get(profileId) as { status: string } | undefined;
    if (!conn || conn.status !== "connected") {
      throw new SchedulingValidationError(
        "Conecte sua Google Agenda antes de ativar o agendamento online.",
        { enabled: "Conecte sua Google Agenda antes de ativar o agendamento online." }
      );
    }

    const hasEnabledDay = weeklySchedule.some((d) => d.enabled);
    if (!hasEnabledDay) {
      throw new SchedulingValidationError(
        "Ative pelo menos um dia da semana para receber agendamentos.",
        { weeklySchedule: "Ative pelo menos um dia da semana para receber agendamentos." }
      );
    }

    const profileRow = db
      .prepare("SELECT whatsapp_number FROM profiles WHERE id = ?")
      .get(profileId) as { whatsapp_number: string } | undefined;
    const waCheck = normalizeWhatsApp(profileRow?.whatsapp_number ?? "");
    if (!profileRow?.whatsapp_number || waCheck.error || !waCheck.url) {
      throw new SchedulingValidationError(
        "Configure um número de WhatsApp válido (com DDI) no seu perfil antes de ativar o agendamento online.",
        {
          enabled:
            "Configure um número de WhatsApp válido (com DDI) no perfil antes de ativar o agendamento.",
        }
      );
    }
  }

  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO booking_settings (
      profile_id, timezone, service_name, slot_duration_minutes, buffer_minutes,
      min_notice_minutes, horizon_days, enabled, weekly_schedule_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id) DO UPDATE SET
      timezone = excluded.timezone,
      service_name = excluded.service_name,
      slot_duration_minutes = excluded.slot_duration_minutes,
      buffer_minutes = excluded.buffer_minutes,
      min_notice_minutes = excluded.min_notice_minutes,
      horizon_days = excluded.horizon_days,
      enabled = excluded.enabled,
      weekly_schedule_json = excluded.weekly_schedule_json,
      updated_at = excluded.updated_at`
  ).run(
    profileId,
    timezone,
    serviceName,
    slotDurationMinutes,
    bufferMinutes,
    minNoticeMinutes,
    horizonDays,
    enabled ? 1 : 0,
    JSON.stringify(weeklySchedule),
    now
  );

  return { settings: getBookingSettings(profileId) };
}

function overlaps(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number
): boolean {
  return aStartMs < bEndMs && aEndMs > bStartMs;
}

function getPublishedProfileAndBookingContext(slug: string) {
  const db = getDb();
  const profile = db
    .prepare(
      "SELECT id, slug, display_name, status FROM profiles WHERE slug = ? AND status = 'published' LIMIT 1"
    )
    .get(slug) as
    | { id: string; slug: string; display_name: string; status: string }
    | undefined;

  if (!profile) {
    throw new SchedulingError("Perfil público não encontrado.", 404);
  }

  const conn = db
    .prepare("SELECT * FROM calendar_connections WHERE profile_id = ?")
    .get(profile.id) as CalendarConnectionRow | undefined;

  if (!conn || conn.status !== "connected" || !conn.composio_connected_account_id) {
    throw new SchedulingError(
      "A agenda deste profissional não está conectada no momento.",
      409
    );
  }

  const settings = getBookingSettings(profile.id);
  if (!settings.enabled) {
    throw new SchedulingError(
      "O agendamento online está desativado para este perfil.",
      409
    );
  }

  return { profile, conn, settings };
}

function generateDayCandidateSlots(params: {
  date: string;
  settings: BookingSettings;
  now: Date;
}): Array<{ startMs: number; endMs: number }> {
  const { date, settings, now } = params;

  const todayInTz = getDateStringInTimezone(now, settings.timezone);
  const maxDateInTz = addDaysToDateString(todayInTz, settings.horizonDays);
  if (date < todayInTz || date > maxDateInTz) {
    return [];
  }

  const dayOfWeek = getDayOfWeekFromDateString(date);
  const dayConfig = settings.weeklySchedule.find(
    (d) => d.dayOfWeek === dayOfWeek
  );
  if (!dayConfig || !dayConfig.enabled) {
    return [];
  }

  const windowStartMs = zonedWallTimeToUtc(
    date,
    dayConfig.startTime,
    settings.timezone
  ).getTime();
  const windowEndMs = zonedWallTimeToUtc(
    date,
    dayConfig.endTime,
    settings.timezone
  ).getTime();

  const durationMs = settings.slotDurationMinutes * 60_000;
  const stepMs = (settings.slotDurationMinutes + settings.bufferMinutes) * 60_000;
  const minNoticeCutoffMs = now.getTime() + settings.minNoticeMinutes * 60_000;

  const slots: Array<{ startMs: number; endMs: number }> = [];
  for (let startMs = windowStartMs; startMs + durationMs <= windowEndMs; startMs += stepMs) {
    if (startMs < minNoticeCutoffMs) {
      continue;
    }
    slots.push({ startMs, endMs: startMs + durationMs });
  }
  return slots;
}

function parseBusyIntervals(
  externalBusy: BusyInterval[],
  localBookings: Array<{ start_iso: string; end_iso: string }>,
  bufferMinutes: number
): Array<{ startMs: number; endMs: number }> {
  const intervals: Array<{ startMs: number; endMs: number }> = [];
  const bufferMs = bufferMinutes * 60_000;

  for (const item of externalBusy) {
    const startMs = Date.parse(item.start);
    const endMs = Date.parse(item.end);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      intervals.push({ startMs, endMs });
    }
  }

  for (const b of localBookings) {
    const startMs = Date.parse(b.start_iso);
    const endMs = Date.parse(b.end_iso);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      intervals.push({ startMs, endMs: endMs + bufferMs });
    }
  }

  return intervals;
}

async function filterBusyCandidateSlots(params: {
  profileId: string;
  conn: CalendarConnectionRow;
  settings: BookingSettings;
  candidates: Array<{ date: string; startMs: number; endMs: number }>;
  provider: CalendarProvider;
}): Promise<Record<string, AvailableSlot[]>> {
  const { profileId, conn, settings, candidates, provider } = params;
  const result: Record<string, AvailableSlot[]> = {};
  if (candidates.length === 0) {
    return result;
  }

  let minMs = candidates[0].startMs;
  let maxMs = candidates[0].endMs;
  for (const c of candidates) {
    if (c.startMs < minMs) minMs = c.startMs;
    if (c.endMs > maxMs) maxMs = c.endMs;
  }

  const timeMin = new Date(minMs).toISOString();
  const timeMax = new Date(maxMs).toISOString();

  let externalBusy: BusyInterval[];
  try {
    externalBusy = await provider.queryFreeBusy({
      composioUserId: conn.composio_user_id,
      connectedAccountId: conn.composio_connected_account_id!,
      calendarId: conn.calendar_id || "primary",
      timeMin,
      timeMax,
      timezone: settings.timezone,
      isMock: Boolean(conn.is_mock),
    });
  } catch (err) {
    if (err instanceof ComposioProviderError) {
      throw new SchedulingError(err.message, 503);
    }
    throw new SchedulingError(
      "Não foi possível consultar a disponibilidade no Google Agenda.",
      503
    );
  }

  const db = getDb();
  const localBookings = db
    .prepare(
      `SELECT start_iso, end_iso FROM bookings
       WHERE profile_id = ? AND status = 'confirmed' AND end_iso > ? AND start_iso < ?`
    )
    .all(profileId, timeMin, timeMax) as Array<{
    start_iso: string;
    end_iso: string;
  }>;

  const busyIntervals = parseBusyIntervals(
    externalBusy,
    localBookings,
    settings.bufferMinutes
  );

  for (const slot of candidates) {
    const hasConflict = busyIntervals.some((b) =>
      overlaps(slot.startMs, slot.endMs, b.startMs, b.endMs)
    );
    if (!hasConflict) {
      const startDate = new Date(slot.startMs);
      const endDate = new Date(slot.endMs);
      if (!result[slot.date]) {
        result[slot.date] = [];
      }
      result[slot.date].push({
        startIso: startDate.toISOString(),
        endIso: endDate.toISOString(),
        label: formatTimeInTimezone(startDate, settings.timezone),
      });
    }
  }

  return result;
}

function resolveEffectiveServiceSettings(
  profileId: string,
  settings: BookingSettings,
  servicePublicId?: string
): {
  effectiveSettings: BookingSettings;
  service: { publicId: string; title: string; priceCents: number } | null;
} {
  const cleanServiceId = (servicePublicId ?? "").trim();
  if (!cleanServiceId) {
    return { effectiveSettings: settings, service: null };
  }

  const svc = getPublishedAppointmentService(profileId, cleanServiceId);
  if (!svc) {
    throw new SchedulingError(
      "O serviço selecionado não está disponível para agendamento no momento.",
      409
    );
  }

  return {
    effectiveSettings: {
      ...settings,
      serviceName: svc.title,
      slotDurationMinutes: svc.durationMinutes ?? settings.slotDurationMinutes,
    },
    service: {
      publicId: svc.publicId,
      title: svc.title,
      priceCents: svc.priceCents,
    },
  };
}

export async function getAvailableSlotsForRange(params: {
  slug: string;
  from: string;
  to: string;
  servicePublicId?: string;
  now?: Date;
  provider?: CalendarProvider;
}): Promise<{
  slug: string;
  from: string;
  to: string;
  timezone: string;
  serviceName: string;
  slotDurationMinutes: number;
  horizonDays: number;
  days: Record<string, AvailableSlot[]>;
}> {
  const {
    slug,
    from,
    to,
    servicePublicId,
    now = new Date(),
    provider = defaultCalendarProvider,
  } = params;

  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    throw new SchedulingError(
      "Parâmetros 'from' e 'to' inválidos. Use o formato YYYY-MM-DD.",
      400
    );
  }

  const { profile, conn, settings: rawSettings } =
    getPublishedProfileAndBookingContext(slug);
  const { effectiveSettings: settings } = resolveEffectiveServiceSettings(
    profile.id,
    rawSettings,
    servicePublicId
  );
  const todayInTz = getDateStringInTimezone(now, settings.timezone);
  const maxDateInTz = addDaysToDateString(todayInTz, settings.horizonDays);

  const effectiveFrom = from < todayInTz ? todayInTz : from;
  const effectiveTo = to > maxDateInTz ? maxDateInTz : to;

  const allCandidates: Array<{ date: string; startMs: number; endMs: number }> = [];
  const days: Record<string, AvailableSlot[]> = {};

  if (effectiveFrom <= effectiveTo) {
    let cursor = effectiveFrom;
    let safety = 0;
    while (cursor <= effectiveTo && safety < 95) {
      safety += 1;
      days[cursor] = [];
      const daySlots = generateDayCandidateSlots({
        date: cursor,
        settings,
        now,
      });
      for (const s of daySlots) {
        allCandidates.push({ date: cursor, startMs: s.startMs, endMs: s.endMs });
      }
      cursor = addDaysToDateString(cursor, 1);
    }
  }

  const filtered = await filterBusyCandidateSlots({
    profileId: profile.id,
    conn,
    settings,
    candidates: allCandidates,
    provider,
  });

  for (const [dateKey, list] of Object.entries(filtered)) {
    days[dateKey] = list;
  }

  return {
    slug: profile.slug,
    from: effectiveFrom,
    to: effectiveTo,
    timezone: settings.timezone,
    serviceName: settings.serviceName,
    slotDurationMinutes: settings.slotDurationMinutes,
    horizonDays: settings.horizonDays,
    days,
  };
}

export async function getAvailableSlotsForDate(params: {
  slug: string;
  date: string;
  servicePublicId?: string;
  now?: Date;
  provider?: CalendarProvider;
}): Promise<{
  slug: string;
  date: string;
  timezone: string;
  slotDurationMinutes: number;
  horizonDays: number;
  slots: AvailableSlot[];
}> {
  const {
    slug,
    date,
    servicePublicId,
    now = new Date(),
    provider = defaultCalendarProvider,
  } = params;

  if (!DATE_RE.test(date)) {
    throw new SchedulingError(
      "Parâmetro 'date' inválido. Use o formato YYYY-MM-DD.",
      400
    );
  }

  const { profile, conn, settings: rawSettings } =
    getPublishedProfileAndBookingContext(slug);
  const { effectiveSettings: settings } = resolveEffectiveServiceSettings(
    profile.id,
    rawSettings,
    servicePublicId
  );
  const candidates = generateDayCandidateSlots({ date, settings, now }).map(
    (s) => ({ date, startMs: s.startMs, endMs: s.endMs })
  );

  const filtered = await filterBusyCandidateSlots({
    profileId: profile.id,
    conn,
    settings,
    candidates,
    provider,
  });

  return {
    slug: profile.slug,
    date,
    timezone: settings.timezone,
    slotDurationMinutes: settings.slotDurationMinutes,
    horizonDays: settings.horizonDays,
    slots: filtered[date] ?? [],
  };
}

function buildWhatsappContactUrl(
  profileWhatsappNumber: string | null | undefined,
  details: {
    professionalName: string;
    clientName: string;
    serviceName: string;
    startIso: string;
    timezone: string;
  }
): string | null {
  const wa = normalizeWhatsApp(profileWhatsappNumber ?? "");
  if (!wa.digits || wa.error || !wa.url) return null;

  const dt = new Date(details.startIso);
  const datePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: details.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dt);
  const timePart = formatTimeInTimezone(dt, details.timezone);

  const msg = `Olá, ${details.professionalName}! Sou ${details.clientName}. Acabei de agendar ${details.serviceName} para ${datePart} às ${timePart}.`;
  return `https://wa.me/${wa.digits}?text=${encodeURIComponent(msg)}`;
}

export async function createBookingForProfile(params: {
  slug: string;
  startIso: string;
  idempotencyKey: string;
  clientName: string;
  clientPhone?: string;
  clientContact?: string;
  servicePublicId?: string;
  notes?: string;
  now?: Date;
  provider?: CalendarProvider;
}): Promise<{
  booking: PublicBookingConfirmation;
  idempotent: boolean;
}> {
  const {
    slug,
    startIso,
    idempotencyKey,
    clientName,
    clientPhone,
    clientContact,
    servicePublicId,
    notes = "",
    now = new Date(),
    provider = defaultCalendarProvider,
  } = params;

  const errors: ValidationErrors = {};
  const nameCheck = sanitizePlainText(clientName ?? "", 80);
  if (!nameCheck.value || nameCheck.value.length < 2) {
    errors.clientName = "Informe seu nome (mínimo 2 caracteres).";
  } else if (nameCheck.error) {
    errors.clientName = nameCheck.error;
  }

  const rawPhone = (clientPhone ?? clientContact ?? "").trim();
  const phoneCheck = normalizeWhatsApp(rawPhone);
  if (!rawPhone || phoneCheck.error || !phoneCheck.digits) {
    errors.clientPhone =
      "Informe um WhatsApp/telefone válido com DDD/DDI (10 a 15 dígitos, ex.: 5511999999999).";
  }

  const notesCheck = sanitizePlainText(notes ?? "", 300);
  if (notesCheck.error) {
    errors.notes = notesCheck.error;
  }

  const cleanKey = (idempotencyKey ?? "").trim();
  if (cleanKey.length < 8 || cleanKey.length > 128) {
    errors.idempotencyKey = "Chave de idempotência inválida.";
  }

  const startMs = Date.parse(startIso ?? "");
  if (Number.isNaN(startMs)) {
    errors.startIso = "Horário selecionado inválido.";
  }

  if (Object.keys(errors).length > 0) {
    throw new SchedulingValidationError(
      "Verifique os dados informados para o agendamento.",
      errors
    );
  }

  const db = getDb();

  // First check published profile existence
  const profileRow = db
    .prepare(
      "SELECT id, slug, display_name, whatsapp_number FROM profiles WHERE slug = ? AND status = 'published' LIMIT 1"
    )
    .get(slug) as
    | { id: string; slug: string; display_name: string; whatsapp_number: string }
    | undefined;

  if (!profileRow) {
    throw new SchedulingError("Perfil público não encontrado.", 404);
  }

  const currentSettings = getBookingSettings(profileRow.id);

  // Idempotency check BEFORE hitting external provider
  const existingBooking = db
    .prepare(
      "SELECT * FROM bookings WHERE profile_id = ? AND idempotency_key = ? LIMIT 1"
    )
    .get(profileRow.id, cleanKey) as BookingRow | undefined;

  if (existingBooking) {
    return {
      booking: {
        id: existingBooking.id,
        slug: profileRow.slug,
        professionalName: profileRow.display_name,
        serviceName: currentSettings.serviceName,
        startIso: existingBooking.start_iso,
        endIso: existingBooking.end_iso,
        timezone: existingBooking.timezone,
        whatsappContactUrl: buildWhatsappContactUrl(profileRow.whatsapp_number, {
          professionalName: profileRow.display_name,
          clientName: existingBooking.client_name,
          serviceName: currentSettings.serviceName,
          startIso: existingBooking.start_iso,
          timezone: existingBooking.timezone,
        }),
        status: "confirmed",
      },
      idempotent: true,
    };
  }

  const { conn, settings: rawSettings } = getPublishedProfileAndBookingContext(slug);
  const { effectiveSettings: settings, service: selectedService } =
    resolveEffectiveServiceSettings(profileRow.id, rawSettings, servicePublicId);

  // Verify the requested startIso matches a valid candidate slot in the professional's timezone
  const requestedDate = getDateStringInTimezone(new Date(startMs), settings.timezone);
  const candidates = generateDayCandidateSlots({
    date: requestedDate,
    settings,
    now,
  });
  const matchingSlot = candidates.find((c) => c.startMs === startMs);
  if (!matchingSlot) {
    throw new SchedulingError(
      "O horário escolhido não está dentro da disponibilidade configurada.",
      409
    );
  }

  const slotStartIso = new Date(matchingSlot.startMs).toISOString();
  const slotEndIso = new Date(matchingSlot.endMs).toISOString();

  // Recheck FreeBusy + SQLite immediately before creating event
  let externalBusy: BusyInterval[];
  try {
    externalBusy = await provider.queryFreeBusy({
      composioUserId: conn.composio_user_id,
      connectedAccountId: conn.composio_connected_account_id!,
      calendarId: conn.calendar_id || "primary",
      timeMin: slotStartIso,
      timeMax: slotEndIso,
      timezone: settings.timezone,
      isMock: Boolean(conn.is_mock),
    });
  } catch (err) {
    if (err instanceof ComposioProviderError) {
      throw new SchedulingError(err.message, 503);
    }
    throw new SchedulingError(
      "Não foi possível confirmar a disponibilidade na agenda.",
      503
    );
  }

  const localBookings = db
    .prepare(
      `SELECT start_iso, end_iso FROM bookings
       WHERE profile_id = ? AND status = 'confirmed' AND end_iso > ? AND start_iso < ?`
    )
    .all(profileRow.id, slotStartIso, slotEndIso) as Array<{
    start_iso: string;
    end_iso: string;
  }>;

  const busyIntervals = parseBusyIntervals(
    externalBusy,
    localBookings,
    settings.bufferMinutes
  );

  const conflict = busyIntervals.some((b) =>
    overlaps(matchingSlot.startMs, matchingSlot.endMs, b.startMs, b.endMs)
  );
  if (conflict) {
    throw new SchedulingError(
      "Este horário acabou de ser ocupado. Por favor, escolha outro horário.",
      409
    );
  }

  // Create event in Google Calendar via Composio
  let createdEvent: { eventId: string };
  try {
    createdEvent = await provider.createCalendarEvent({
      composioUserId: conn.composio_user_id,
      connectedAccountId: conn.composio_connected_account_id!,
      calendarId: conn.calendar_id || "primary",
      startIso: slotStartIso,
      endIso: slotEndIso,
      timezone: settings.timezone,
      summary: `${settings.serviceName} — ${nameCheck.value}`,
      description: [
        `Serviço: ${settings.serviceName}`,
        selectedService ? `Valor: ${formatPriceBRL(selectedService.priceCents)}` : null,
        `Cliente: ${nameCheck.value}`,
        `WhatsApp/Telefone: ${phoneCheck.digits}`,
        notesCheck.value ? `Observações: ${notesCheck.value}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      isMock: Boolean(conn.is_mock),
    });
  } catch (err) {
    if (err instanceof ComposioProviderError) {
      throw new SchedulingError(err.message, 502);
    }
    throw new SchedulingError(
      "Não foi possível criar o evento na Google Agenda. Tente novamente.",
      502
    );
  }

  const bookingId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  try {
    db.prepare(
      `INSERT INTO bookings (
        id, profile_id, provider_event_id, idempotency_key,
        start_iso, end_iso, timezone, client_name, client_contact, notes,
        service_public_id, service_title, service_price_cents, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`
    ).run(
      bookingId,
      profileRow.id,
      createdEvent.eventId,
      cleanKey,
      slotStartIso,
      slotEndIso,
      settings.timezone,
      nameCheck.value,
      phoneCheck.digits,
      notesCheck.value,
      selectedService?.publicId ?? null,
      selectedService?.title ?? null,
      selectedService?.priceCents ?? null,
      createdAt
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const code = (err as { code?: string })?.code;
    if (msg.includes("UNIQUE") || code === "SQLITE_CONSTRAINT_UNIQUE") {
      const raced = db
        .prepare(
          "SELECT * FROM bookings WHERE profile_id = ? AND idempotency_key = ? LIMIT 1"
        )
        .get(profileRow.id, cleanKey) as BookingRow | undefined;
      if (raced) {
        return {
          booking: {
            id: raced.id,
            slug: profileRow.slug,
            professionalName: profileRow.display_name,
            serviceName: settings.serviceName,
            startIso: raced.start_iso,
            endIso: raced.end_iso,
            timezone: raced.timezone,
            whatsappContactUrl: buildWhatsappContactUrl(
              profileRow.whatsapp_number,
              {
                professionalName: profileRow.display_name,
                clientName: raced.client_name,
                serviceName: settings.serviceName,
                startIso: raced.start_iso,
                timezone: raced.timezone,
              }
            ),
            status: "confirmed",
          },
          idempotent: true,
        };
      }
      throw new BookingConflictError();
    }
    throw err;
  }

  return {
    booking: {
      id: bookingId,
      slug: profileRow.slug,
      professionalName: profileRow.display_name,
      serviceName: settings.serviceName,
      startIso: slotStartIso,
      endIso: slotEndIso,
      timezone: settings.timezone,
      whatsappContactUrl: buildWhatsappContactUrl(profileRow.whatsapp_number, {
        professionalName: profileRow.display_name,
        clientName: nameCheck.value,
        serviceName: settings.serviceName,
        startIso: slotStartIso,
        timezone: settings.timezone,
      }),
      status: "confirmed",
    },
    idempotent: false,
  };
}
