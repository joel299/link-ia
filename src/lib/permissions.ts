import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "./auth";
import { getDb } from "./db";
import {
  ALL_FEATURE_KEYS,
  type AdsProvider,
  type FeatureKey,
  type SocialProvider,
  type UserPermissions,
} from "./types";

export const PERMISSIONS_SCHEMA_VERSION = 1;

export function createEmptyPermissions(): UserPermissions {
  return {
    whatsapp: false,
    instagram: false,
    facebook_social: false,
    meta_ads: false,
    tiktok_organic: false,
    tiktok_ads: false,
    google_calendar: false,
    catalog: false,
  };
}

/**
 * Legacy compatibility rule:
 * Users created prior to the feature-permissions system (i.e. with no row in
 * `user_feature_permissions`) preserve access to existing features so existing
 * accounts do not lose functionality on upgrade. Once an explicit row exists in
 * `user_feature_permissions`, any missing or false key is strictly denied.
 */
export function createLegacyDefaultPermissions(): UserPermissions {
  return {
    whatsapp: true,
    instagram: true,
    facebook_social: true,
    meta_ads: true,
    tiktok_organic: true,
    tiktok_ads: true,
    google_calendar: true,
    catalog: true,
  };
}

export function normalizePermissionsInput(raw: unknown): UserPermissions {
  const result = createEmptyPermissions();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return result;
  }
  const record = raw as Record<string, unknown>;
  for (const key of ALL_FEATURE_KEYS) {
    result[key] = record[key] === true;
  }
  return result;
}

export function parseStoredPermissions(rawJson: string): UserPermissions {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return normalizePermissionsInput(parsed);
  } catch {
    return createEmptyPermissions();
  }
}

export function getUserPermissions(userId: string): UserPermissions {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT permissions_json FROM user_feature_permissions WHERE user_id = ?"
    )
    .get(userId) as { permissions_json: string } | undefined;

  if (!row) {
    const userRow = db
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(userId) as { role?: string } | undefined;
    if (!userRow) {
      return createEmptyPermissions();
    }
    return createLegacyDefaultPermissions();
  }

  return parseStoredPermissions(row.permissions_json);
}

export function saveUserPermissions(
  userId: string,
  permissions: UserPermissions,
  actorUserId: string
): UserPermissions {
  const db = getDb();
  const normalized = normalizePermissionsInput(permissions);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO user_feature_permissions (user_id, permissions_json, version, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       permissions_json = excluded.permissions_json,
       version = excluded.version,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`
  ).run(
    userId,
    JSON.stringify(normalized),
    PERMISSIONS_SCHEMA_VERSION,
    actorUserId,
    now
  );

  return normalized;
}

export function recordAdminAuditLog(params: {
  actorUserId: string;
  targetUserId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}): void {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const safeDetails: Record<string, unknown> = {};
  if (params.details) {
    for (const [k, v] of Object.entries(params.details)) {
      if (
        k.toLowerCase().includes("password") ||
        k.toLowerCase().includes("secret") ||
        k.toLowerCase().includes("token")
      ) {
        continue;
      }
      safeDetails[k] = v;
    }
  }

  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_user_id, target_user_id, action, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.actorUserId,
    params.targetUserId ?? null,
    params.action,
    JSON.stringify(safeDetails),
    now
  );
}

export function hasUserFeature(userId: string, feature: FeatureKey): boolean {
  const perms = getUserPermissions(userId);
  return perms[feature] === true;
}

export function socialProviderToFeatureKey(
  provider: SocialProvider
): FeatureKey {
  switch (provider) {
    case "instagram":
      return "instagram";
    case "tiktok":
      return "tiktok_organic";
    case "meta_ads":
      return "facebook_social";
    case "tiktok_ads":
      return "tiktok_ads";
  }
}

export function adsProviderToFeatureKey(provider: AdsProvider): FeatureKey {
  return provider === "meta_ads" ? "meta_ads" : "tiktok_ads";
}

export async function requireAuthenticatedUser(): Promise<
  { user: SessionUser; errorResponse?: never } | { user?: never; errorResponse: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }
  return { user };
}

export async function requireAdminUser(): Promise<
  { user: SessionUser; errorResponse?: never } | { user?: never; errorResponse: NextResponse }
> {
  const auth = await requireAuthenticatedUser();
  if (auth.errorResponse) return auth;

  if (auth.user.role !== "admin") {
    return {
      errorResponse: NextResponse.json(
        { error: "Acesso restrito a administradores." },
        { status: 403 }
      ),
    };
  }
  return { user: auth.user };
}

export async function requireUserFeature(
  userId: string,
  feature: FeatureKey
): Promise<NextResponse | null> {
  if (!hasUserFeature(userId, feature)) {
    return NextResponse.json(
      { error: "Recurso não liberado para esta conta." },
      { status: 403 }
    );
  }
  return null;
}
