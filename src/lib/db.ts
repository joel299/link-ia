import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DEFAULT_DARK_THEME } from "./types";

let cachedDb: Database.Database | null = null;
let cachedDbPath: string | null = null;

export function getDataDir(): string {
  const dir = path.resolve(process.env.DATA_DIR || "./data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getUploadsDir(): string {
  const dir = path.join(getDataDir(), "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function hashSeedPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function initSchema(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      instagram_input TEXT NOT NULL DEFAULT '',
      instagram_url TEXT,
      instagram_enabled INTEGER NOT NULL DEFAULT 1,
      whatsapp_number TEXT NOT NULL DEFAULT '',
      whatsapp_message TEXT NOT NULL DEFAULT '',
      whatsapp_enabled INTEGER NOT NULL DEFAULT 1,
      booking_url TEXT,
      booking_label TEXT NOT NULL DEFAULT 'Agendar horário',
      booking_enabled INTEGER NOT NULL DEFAULT 1,
      theme_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON profiles(owner_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(slug);

    CREATE TABLE IF NOT EXISTS calendar_connections (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'google_calendar',
      composio_user_id TEXT NOT NULL,
      composio_connected_account_id TEXT,
      status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'pending', 'connected', 'expired', 'failed')),
      calendar_id TEXT NOT NULL DEFAULT 'primary',
      account_label TEXT,
      is_mock INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      composio_user_id TEXT NOT NULL,
      composio_connected_account_id TEXT,
      is_mock INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS booking_settings (
      profile_id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
      service_name TEXT NOT NULL DEFAULT 'Atendimento',
      slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
      buffer_minutes INTEGER NOT NULL DEFAULT 10,
      min_notice_minutes INTEGER NOT NULL DEFAULT 60,
      horizon_days INTEGER NOT NULL DEFAULT 14,
      enabled INTEGER NOT NULL DEFAULT 0,
      weekly_schedule_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      provider_event_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      start_iso TEXT NOT NULL,
      end_iso TEXT NOT NULL,
      timezone TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_contact TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
      created_at TEXT NOT NULL,
      UNIQUE(profile_id, idempotency_key),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_profile_start ON bookings(profile_id, start_iso, end_iso);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot ON bookings(profile_id, start_iso) WHERE status = 'confirmed';

    CREATE TABLE IF NOT EXISTS catalog_items (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      public_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'BRL',
      image_url TEXT,
      flow_type TEXT NOT NULL CHECK (flow_type IN ('appointment', 'whatsapp')),
      availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'unavailable')),
      is_active INTEGER NOT NULL DEFAULT 1,
      duration_minutes INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_items_profile_order
      ON catalog_items(profile_id, is_active, sort_order, created_at);
  `);

  try {
    db.exec(
      "ALTER TABLE booking_settings ADD COLUMN service_name TEXT NOT NULL DEFAULT 'Atendimento'"
    );
  } catch {
    // Column already exists on fresh or migrated databases.
  }

  for (const alterSql of [
    "ALTER TABLE bookings ADD COLUMN service_public_id TEXT",
    "ALTER TABLE bookings ADD COLUMN service_title TEXT",
    "ALTER TABLE bookings ADD COLUMN service_price_cents INTEGER",
  ]) {
    try {
      db.exec(alterSql);
    } catch {
      // Column already exists on fresh or migrated databases.
    }
  }
}

export function ensureDemoSeed(db: Database.Database): {
  userId: string;
  email: string;
  name: string;
} {
  const demoEmail = "demo@linkia.app";
  const now = new Date().toISOString();

  let user = db
    .prepare("SELECT id, email, name FROM users WHERE email = ?")
    .get(demoEmail) as { id: string; email: string; name: string } | undefined;

  if (!user) {
    const userId = crypto.randomUUID();
    const passwordHash = hashSeedPassword("demo1234");
    db.prepare(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(userId, demoEmail, "Joel Quintana (Demo)", passwordHash, now);
    user = { id: userId, email: demoEmail, name: "Joel Quintana (Demo)" };
  }

  const existingProfile = db
    .prepare("SELECT id FROM profiles WHERE slug = ?")
    .get("joel-quintana") as { id: string } | undefined;

  if (!existingProfile) {
    db.prepare(
      `INSERT INTO profiles (
        id, owner_id, slug, display_name, bio, avatar_url,
        instagram_input, instagram_url, instagram_enabled,
        whatsapp_number, whatsapp_message, whatsapp_enabled,
        booking_url, booking_label, booking_enabled,
        theme_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      user.id,
      "joel-quintana",
      "Joel Quintana",
      "Barbearia & Visagismo • Atendimento com horário marcado.",
      null,
      "@joelquintana.barber",
      "https://instagram.com/joelquintana.barber",
      1,
      "5511999999999",
      "Olá Joel! Vim pelo seu LinkIA e gostaria de agendar um horário.",
      1,
      "https://cal.com/joel-quintana",
      "Agendar horário",
      1,
      JSON.stringify(DEFAULT_DARK_THEME),
      "published",
      now,
      now
    );
  }

  return { userId: user.id, email: user.email, name: user.name };
}

export function getDb(): Database.Database {
  const dbPath = path.join(getDataDir(), "linkia.db");

  if (cachedDb && cachedDbPath === dbPath) {
    return cachedDb;
  }

  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
    cachedDbPath = null;
  }

  const db = new Database(dbPath);
  initSchema(db);
  ensureDemoSeed(db);

  cachedDb = db;
  cachedDbPath = dbPath;
  return db;
}

export function closeDb(): void {
  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
    cachedDbPath = null;
  }
}
