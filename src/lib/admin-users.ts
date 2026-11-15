import crypto from "node:crypto";
import { hashPassword } from "./auth";
import { getDb } from "./db";
import {
  getUserPermissions,
  normalizePermissionsInput,
  recordAdminAuditLog,
  saveUserPermissions,
} from "./permissions";
import type { AdminUserView, UserPermissions } from "./types";
import { sanitizePlainText } from "./validation";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rowToAdminUserView(row: AdminUserRow): AdminUserView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === "admin" ? "admin" : "client",
    isActive: row.is_active !== 0,
    permissions: getUserPermissions(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

export function listUsersForAdmin(): AdminUserView[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, email, role, is_active, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    )
    .all() as AdminUserRow[];

  return rows.map(rowToAdminUserView);
}

export function getUserForAdmin(userId: string): AdminUserView | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, name, email, role, is_active, created_at, updated_at
       FROM users
       WHERE id = ?`
    )
    .get(userId) as AdminUserRow | undefined;

  return row ? rowToAdminUserView(row) : null;
}

export interface CreateClientUserInput {
  name: string;
  email: string;
  password: string;
  isActive?: boolean;
  permissions?: unknown;
}

export function createClientUserByAdmin(
  actorAdminId: string,
  input: CreateClientUserInput
): { user?: AdminUserView; error?: string; status: number } {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { error: "Informe um e-mail válido.", status: 400 };
  }

  const nameCheck = sanitizePlainText(input.name ?? "", 80);
  if (!nameCheck.value) {
    return { error: "Informe o nome do usuário.", status: 400 };
  }
  if (nameCheck.error) {
    return { error: nameCheck.error, status: 400 };
  }

  if (typeof input.password !== "string" || input.password.length < 6) {
    return {
      error: "A senha inicial deve ter pelo menos 6 caracteres.",
      status: 400,
    };
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);
  if (existing) {
    return { error: "Este e-mail já está cadastrado.", status: 409 };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(input.password);
  const isActive = input.isActive !== false;
  const normalizedPerms = normalizePermissionsInput(input.permissions);

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'client', ?, ?, ?)`
    ).run(id, email, nameCheck.value, passwordHash, isActive ? 1 : 0, now, now);

    saveUserPermissions(id, normalizedPerms, actorAdminId);

    recordAdminAuditLog({
      actorUserId: actorAdminId,
      targetUserId: id,
      action: "admin.user.create",
      details: {
        role: "client",
        isActive,
        permissions: normalizedPerms,
      },
    });
  });
  tx();

  const created = getUserForAdmin(id);
  return { user: created!, status: 201 };
}

export interface UpdateClientUserInput {
  isActive?: boolean;
  permissions?: Partial<UserPermissions> | unknown;
}

export function updateClientUserByAdmin(
  actorAdminId: string,
  targetUserId: string,
  input: UpdateClientUserInput
): { user?: AdminUserView; error?: string; status: number } {
  const db = getDb();
  const target = db
    .prepare(
      "SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?"
    )
    .get(targetUserId) as AdminUserRow | undefined;

  if (!target) {
    return { error: "Usuário não encontrado.", status: 404 };
  }

  if (target.id === actorAdminId && input.isActive === false) {
    return {
      error: "Não é possível suspender a sua própria conta de administrador.",
      status: 400,
    };
  }

  const now = new Date().toISOString();
  const nextIsActive =
    typeof input.isActive === "boolean"
      ? input.isActive
      : target.is_active !== 0;

  let nextPermissions: UserPermissions | null = null;
  if (input.permissions !== undefined) {
    nextPermissions = normalizePermissionsInput(input.permissions);
  }

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?"
    ).run(nextIsActive ? 1 : 0, now, targetUserId);

    if (nextPermissions) {
      saveUserPermissions(targetUserId, nextPermissions, actorAdminId);
    }

    recordAdminAuditLog({
      actorUserId: actorAdminId,
      targetUserId,
      action: "admin.user.update",
      details: {
        isActive: nextIsActive,
        permissionsUpdated: Boolean(nextPermissions),
        permissions: nextPermissions ?? undefined,
      },
    });
  });
  tx();

  const updated = getUserForAdmin(targetUserId);
  return { user: updated!, status: 200 };
}

