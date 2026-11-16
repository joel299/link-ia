import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { ensureDemoSeed, getDb } from "./db";
import { getUserPermissions } from "./permissions";
import type { UserPermissions } from "./types";
import { sanitizePlainText } from "./validation";
import { verifyTrustedApiContext } from "./api-tokens";

export const SESSION_COOKIE_NAME = "linkia_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role?: "admin" | "client";
  isActive?: boolean;
  permissions?: UserPermissions;
}

interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  exp: number;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (
      !secret ||
      secret.length < 16 ||
      secret === "change-me-to-a-long-random-secret" ||
      secret === "dev-linkia-secret-change-in-prod"
    ) {
      throw new Error(
        "SESSION_SECRET inválido ou ausente em produção. Defina um segredo com pelo menos 16 caracteres."
      );
    }
    return secret;
  }
  return secret || "dev-linkia-secret-change-in-prod";
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;

  try {
    const keyBuf = Buffer.from(keyHex, "hex");
    const derivedBuf = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derivedBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, derivedBuf);
  } catch {
    return false;
  }
}

function signData(data: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(data)
    .digest("base64url");
}

export function signSessionToken(user: SessionUser): string {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = signData(encoded);
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;

  const encoded = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!encoded || !providedSig) return null;

  const expectedSig = signData(encoded);
  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;

    if (!payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const requestHeaders = await headers();
    const apiContext = requestHeaders.get("x-linkia-api-context");
    if (apiContext) {
      const principal = verifyTrustedApiContext(apiContext, requestHeaders.get("x-linkia-api-context-signature") || "");
      if (!principal) return null;
      return {
        id: principal.ownerId,
        email: principal.email,
        name: principal.name,
        role: "client",
        isActive: true,
        permissions: getUserPermissions(principal.ownerId),
      };
    }
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const decoded = verifySessionToken(token);
    if (!decoded) return null;

    ensureAdminBootstrapFromEnv();

    const db = getDb();
    const row = db
      .prepare("SELECT id, email, name, role, is_active FROM users WHERE id = ?")
      .get(decoded.id) as
      | {
          id: string;
          email: string;
          name: string;
          role?: string;
          is_active?: number;
        }
      | undefined;

    if (!row) return null;
    if (row.is_active === 0) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role === "admin" ? "admin" : "client",
      isActive: true,
      permissions: getUserPermissions(row.id),
    };
  } catch {
    return null;
  }
}

export async function isAdminAuthorizedRequest(
  request: Request
): Promise<boolean> {
  const adminSecret = process.env.ADMIN_PROVISION_SECRET?.trim();
  if (adminSecret && adminSecret.length >= 16) {
    const headerSecret =
      request.headers.get("x-admin-secret")?.trim() ||
      request.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "")
        .trim() ||
      "";
    if (headerSecret) {
      const a = Buffer.from(headerSecret, "utf8");
      const b = Buffer.from(adminSecret, "utf8");
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true;
      }
    }
  }

  const user = await getSessionUser();
  return user?.role === "admin";
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge,
  };
}

export async function setSessionCookie(
  user: SessionUser,
  response?: NextResponse
): Promise<void> {
  const token = signSessionToken(user);
  const opts = getCookieOptions(SESSION_TTL_SECONDS);

  if (response) {
    response.cookies.set(SESSION_COOKIE_NAME, token, opts);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, opts);
}

export async function clearSessionCookie(
  response?: NextResponse
): Promise<void> {
  const opts = getCookieOptions(0);

  if (response) {
    response.cookies.set(SESSION_COOKIE_NAME, "", opts);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", opts);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registerUser(
  rawEmail: string,
  rawName: string,
  password: string
): { user?: SessionUser; error?: string; status?: number } {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { error: "Informe um e-mail válido.", status: 400 };
  }

  const nameCheck = sanitizePlainText(rawName, 80);
  if (!nameCheck.value) {
    return { error: "Informe seu nome.", status: 400 };
  }
  if (nameCheck.error) {
    return { error: nameCheck.error, status: 400 };
  }

  if (typeof password !== "string" || password.length < 6) {
    return {
      error: "A senha deve ter pelo menos 6 caracteres.",
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
  const passwordHash = hashPassword(password);

  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, email, nameCheck.value, passwordHash, now);

  return {
    user: { id, email, name: nameCheck.value },
  };
}

export function ensureAdminBootstrapFromEnv(): void {
  const rawEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const rawPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!rawEmail || !rawPassword || rawPassword.length < 8) {
    return;
  }
  const db = getDb();
  const existing = db
    .prepare("SELECT id, role FROM users WHERE email = ?")
    .get(rawEmail) as { id: string; role?: string } | undefined;

  if (existing) {
    if (existing.role !== "admin") {
      db.prepare("UPDATE users SET role = 'admin', is_active = 1 WHERE id = ?").run(
        existing.id
      );
    }
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(rawPassword);
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, 'admin', 1, ?)"
  ).run(id, rawEmail, "Administrador LinkIA", passwordHash, now);
}

export function authenticateUser(
  rawEmail: string,
  password: string
): { user?: SessionUser; error?: string } {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  ensureAdminBootstrapFromEnv();

  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, email, name, password_hash, role, is_active FROM users WHERE email = ?"
    )
    .get(email) as
    | {
        id: string;
        email: string;
        name: string;
        password_hash: string;
        role?: string;
        is_active?: number;
      }
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    return { error: "E-mail ou senha inválidos." };
  }

  if (row.is_active === 0) {
    return {
      error: "Sua conta está suspensa. Entre em contato com a administração.",
    };
  }

  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role === "admin" ? "admin" : "client",
      isActive: true,
      permissions: getUserPermissions(row.id),
    },
  };
}

export function authenticateDemoUser(): SessionUser {
  const db = getDb();
  const seeded = ensureDemoSeed(db);
  return {
    id: seeded.userId,
    email: seeded.email,
    name: seeded.name,
  };
}
