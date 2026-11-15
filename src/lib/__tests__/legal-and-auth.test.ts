import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as demoPost } from "@/app/api/auth/demo/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { registerUser } from "@/lib/auth";
import { closeDb, getDb } from "@/lib/db";
import {
  getLegalAcceptanceStatusForUser,
  LegalAcceptanceError,
  recordLegalAcceptanceForUser,
} from "@/lib/legal-acceptance";
import {
  getLegalDocumentContentHash,
  PRIVACY_POLICY_DOCUMENT,
  TERMS_OF_USE_DOCUMENT,
} from "@/lib/legal-documents";
import { createProfile } from "@/lib/profiles";
import { RESERVED_SLUGS } from "@/lib/validation";

let tempDir: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "linkia-legal-test-"));
  process.env.DATA_DIR = tempDir;
  process.env.SESSION_SECRET = "test-session-secret-1234567890";
});

afterAll(() => {
  delete process.env.ADMIN_PROVISION_SECRET;
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("Public demo/register removal & legal acceptance", () => {
  it("disables public POST /api/auth/demo with 403", async () => {
    const res = await demoPost();
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("blocks public POST /api/auth/register without admin authorization and allows admin provisioning", async () => {
    const unauthReq = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Visitante",
        email: "visitante@example.com",
        password: "password123",
      }),
    });
    const unauthRes = await registerPost(unauthReq);
    expect(unauthRes.status).toBe(403);

    process.env.ADMIN_PROVISION_SECRET = "admin-provision-secret-123456";
    const adminReq = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": "admin-provision-secret-123456",
      },
      body: JSON.stringify({
        name: "Cliente Provisionado",
        email: "cliente.admin@example.com",
        password: "password123",
      }),
    });
    const adminRes = await registerPost(adminReq);
    expect(adminRes.status).toBe(201);
    const adminJson = await adminRes.json();
    expect(adminJson.user.email).toBe("cliente.admin@example.com");
  });

  it("reserves legal slugs and keeps draft markers explicit", () => {
    expect(RESERVED_SLUGS.has("termos-de-uso")).toBe(true);
    expect(RESERVED_SLUGS.has("politica-de-privacidade")).toBe(true);
    expect(TERMS_OF_USE_DOCUMENT.isDraft).toBe(true);
    expect(PRIVACY_POLICY_DOCUMENT.isDraft).toBe(true);
    expect(TERMS_OF_USE_DOCUMENT.pendingFields.length).toBeGreaterThan(0);
    expect(PRIVACY_POLICY_DOCUMENT.pendingFields.length).toBeGreaterThan(0);
  });

  it("records legal acceptance with server hash, isolates tenants, and preserves version history", () => {
    const regA = registerUser("legal-a@example.com", "Cliente A", "password123");
    const regB = registerUser("legal-b@example.com", "Cliente B", "password123");
    const userA = regA.user!;
    const userB = regB.user!;

    const profA = createProfile(userA.id, {
      displayName: "Studio A",
      slug: "studio-legal-a",
    }).profile!;
    const profB = createProfile(userB.id, {
      displayName: "Studio B",
      slug: "studio-legal-b",
    }).profile!;

    const initialA = getLegalAcceptanceStatusForUser(userA.id);
    expect(initialA.requiresAcceptance).toBe(true);

    // Rejects missing affirmative privacy acknowledgement
    expect(() =>
      recordLegalAcceptanceForUser({
        userId: userA.id,
        profileId: profA.id,
        termsAccepted: true,
        termsVersion: TERMS_OF_USE_DOCUMENT.version,
        privacyAcknowledged: false,
        privacyVersion: PRIVACY_POLICY_DOCUMENT.version,
      })
    ).toThrow(LegalAcceptanceError);

    // Rejects cross-tenant profileId
    expect(() =>
      recordLegalAcceptanceForUser({
        userId: userA.id,
        profileId: profB.id,
        termsAccepted: true,
        termsVersion: TERMS_OF_USE_DOCUMENT.version,
        privacyAcknowledged: true,
        privacyVersion: PRIVACY_POLICY_DOCUMENT.version,
      })
    ).toThrow(LegalAcceptanceError);

    // Records acceptance for userA
    const recordedA = recordLegalAcceptanceForUser({
      userId: userA.id,
      profileId: profA.id,
      termsAccepted: true,
      termsVersion: TERMS_OF_USE_DOCUMENT.version,
      privacyAcknowledged: true,
      privacyVersion: PRIVACY_POLICY_DOCUMENT.version,
      optionalProductUpdates: false,
    });

    expect(recordedA.requiresAcceptance).toBe(false);
    expect(recordedA.terms.contentHash).toBe(
      getLegalDocumentContentHash("terms_of_use")
    );
    expect(recordedA.privacy.contentHash).toBe(
      getLegalDocumentContentHash("privacy_policy")
    );
    expect(recordedA.optionalProductUpdates.granted).toBe(false);
    expect(recordedA.history).toHaveLength(3);

    // User B still requires acceptance and cannot see User A's records
    const statusB = getLegalAcceptanceStatusForUser(userB.id);
    expect(statusB.requiresAcceptance).toBe(true);
    expect(statusB.history).toHaveLength(0);

    // Simulate historical older version in DB; new acceptance preserves old rows
    getDb()
      .prepare(
        `INSERT INTO legal_acceptances (
          id, user_id, profile_id, document_type, document_version, content_hash, action, outcome, created_at
        ) VALUES (?, ?, ?, 'terms_of_use', '0.0-old', 'oldhash', 'accepted', 'recorded', ?)`
      )
      .run("old-rec-1", userA.id, profA.id, "2026-01-01T00:00:00.000Z");

    const afterHistoryCheck = getLegalAcceptanceStatusForUser(userA.id);
    expect(afterHistoryCheck.history.some((h) => h.documentVersion === "0.0-old")).toBe(
      true
    );
    expect(afterHistoryCheck.history.length).toBe(4);
  });
});

