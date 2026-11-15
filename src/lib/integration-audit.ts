import crypto from "node:crypto";
import { getDb } from "./db";
import type { Profile } from "./types";
import { getProfileByIdForOwner } from "./profiles";

const SENSITIVE_KEY_PATTERN =
  /token|secret|password|api_?key|authorization|cookie|code|phone|whatsapp/i;

export function redactSensitiveValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      if (value.length <= 4) return "***";
      return `***${value.slice(-4)}`;
    }
    if (value.length > 240) {
      return `${value.slice(0, 240)}…`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactSensitiveValue(key, item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactSensitiveValue(k, v);
    }
    return out;
  }
  return value;
}

export function maskPhoneNumber(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 6) return "***";
  const country = digits.length > 10 ? `+${digits.slice(0, 2)} ` : "";
  const tail = digits.slice(-4);
  return `${country}** *****-${tail}`;
}

export function hashOAuthState(state: string): string {
  return crypto.createHash("sha256").update(state).digest("hex");
}

export function recordIntegrationAudit(params: {
  profileId?: string | null;
  ownerId?: string | null;
  channel: string;
  action: string;
  outcome: "success" | "rejected" | "error";
  details?: Record<string, unknown>;
}): void {
  try {
    const db = getDb();
    const safeDetails = params.details
      ? redactSensitiveValue("details", params.details)
      : {};
    db.prepare(
      `INSERT INTO integration_audit_events (
        id, profile_id, owner_id, channel, action, outcome, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      params.profileId ?? null,
      params.ownerId ?? null,
      params.channel,
      params.action,
      params.outcome,
      JSON.stringify(safeDetails),
      new Date().toISOString()
    );
  } catch {
    // Audit logging must not break primary control flow.
  }
}

export function requireOwnedProfile(
  profileId: string,
  ownerId: string
): Profile | null {
  const result = getProfileByIdForOwner(profileId, ownerId);
  return result.profile ?? null;
}

