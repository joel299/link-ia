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

    CREATE TABLE IF NOT EXISTS social_connections (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('instagram', 'tiktok', 'meta_ads', 'tiktok_ads')),
      toolkit_slug TEXT NOT NULL,
      composio_user_id TEXT NOT NULL,
      composio_connected_account_id TEXT,
      status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'pending', 'incomplete', 'connected', 'expired', 'failed', 'pending_config')),
      account_label TEXT,
      canonical_url TEXT,
      selected_asset_id TEXT,
      selected_asset_name TEXT,
      scopes_summary_json TEXT NOT NULL DEFAULT '[]',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      last_synced_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revoked_at TEXT,
      UNIQUE(profile_id, provider),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_social_connections_owner_profile
      ON social_connections(owner_id, profile_id, provider);

    CREATE TABLE IF NOT EXISTS social_oauth_states (
      state_hash TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('instagram', 'tiktok', 'meta_ads', 'tiktok_ads')),
      composio_user_id TEXT NOT NULL,
      composio_connected_account_id TEXT,
      is_mock INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS social_assets (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('instagram', 'tiktok', 'meta_ads', 'tiktok_ads')),
      asset_type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_selected INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      UNIQUE(connection_id, asset_type, external_id),
      FOREIGN KEY (connection_id) REFERENCES social_connections(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profile_social_media (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('instagram', 'tiktok')),
      external_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      permalink TEXT NOT NULL,
      thumbnail_url TEXT,
      like_count INTEGER,
      comment_count INTEGER,
      position INTEGER NOT NULL DEFAULT 0,
      public_enabled INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      synced_at TEXT NOT NULL,
      UNIQUE(profile_id, provider, external_id),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_profile_social_media_public
      ON profile_social_media(profile_id, provider, public_enabled, position);

    CREATE TABLE IF NOT EXISTS whatsapp_connections (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'zernio',
      zernio_profile_id TEXT NOT NULL,
      provider_account_id TEXT,
      waba_id TEXT,
      phone_number_id TEXT,
      business_id TEXT,
      masked_phone TEXT,
      display_name TEXT,
      onboarding_mode TEXT NOT NULL DEFAULT 'business_app',
      status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'incomplete', 'connected', 'expired', 'failed', 'ineligible', 'pending_config')),
      capabilities_json TEXT NOT NULL DEFAULT '{}',
      composio_status TEXT NOT NULL DEFAULT 'disabled_pending_validation',
      last_verified_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS whatsapp_connection_attempts (
      state_hash TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      zernio_profile_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'initiated',
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ad_campaign_operations (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('meta_ads', 'tiktok_ads')),
      ad_account_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'created_paused', 'active', 'failed')),
      external_campaign_id TEXT,
      params_json TEXT NOT NULL,
      estimated_budget_summary TEXT NOT NULL,
      confirmed_at TEXT,
      activated_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(profile_id, provider, idempotency_key),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ad_campaign_operations_profile
      ON ad_campaign_operations(profile_id, provider, created_at DESC);

    CREATE TABLE IF NOT EXISTS integration_audit_events (
      id TEXT PRIMARY KEY,
      profile_id TEXT,
      owner_id TEXT,
      channel TEXT NOT NULL,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_events_dedup (
      event_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      received_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS legal_acceptances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      profile_id TEXT,
      document_type TEXT NOT NULL CHECK (document_type IN ('terms_of_use', 'privacy_policy', 'optional_product_updates')),
      document_version TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('accepted', 'acknowledged', 'declined', 'revoked')),
      outcome TEXT NOT NULL DEFAULT 'recorded',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_doc
      ON legal_acceptances(user_id, document_type, created_at DESC);

    CREATE TABLE IF NOT EXISTS profile_custom_links (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon_type TEXT NOT NULL DEFAULT 'link' CHECK (icon_type IN ('link', 'map', 'store', 'calendar', 'phone', 'globe')),
      is_active INTEGER NOT NULL DEFAULT 1,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_profile_custom_links_profile_pos
      ON profile_custom_links(profile_id, position ASC, created_at ASC);

    CREATE TABLE IF NOT EXISTS user_feature_permissions (
      user_id TEXT PRIMARY KEY,
      permissions_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      target_user_id TEXT,
      action TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
      ON admin_audit_logs(created_at DESC);
  `);

  try {
    db.exec(
      "ALTER TABLE booking_settings ADD COLUMN service_name TEXT NOT NULL DEFAULT 'Atendimento'"
    );
  } catch {
    // Column already exists on fresh or migrated databases.
  }

  for (const alterSql of [
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'client'",
    "ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE users ADD COLUMN updated_at TEXT",
    "ALTER TABLE bookings ADD COLUMN service_public_id TEXT",
    "ALTER TABLE bookings ADD COLUMN service_title TEXT",
    "ALTER TABLE bookings ADD COLUMN service_price_cents INTEGER",
    "ALTER TABLE profile_social_media ADD COLUMN like_count INTEGER",
    "ALTER TABLE profile_social_media ADD COLUMN comment_count INTEGER",
    "ALTER TABLE profiles ADD COLUMN public_order_json TEXT",
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
