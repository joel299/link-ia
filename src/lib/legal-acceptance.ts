import crypto from "node:crypto";
import { getDb } from "./db";
import {
  getLegalDocumentContentHash,
  OPTIONAL_PRODUCT_UPDATES_VERSION,
  PRIVACY_POLICY_DOCUMENT,
  TERMS_OF_USE_DOCUMENT,
  type LegalDocumentType,
} from "./legal-documents";
import { getProfileByIdForOwner } from "./profiles";

export interface LegalAcceptanceRecord {
  id: string;
  userId: string;
  profileId: string | null;
  documentType: LegalDocumentType;
  documentVersion: string;
  contentHash: string;
  action: "accepted" | "acknowledged" | "declined" | "revoked";
  outcome: string;
  createdAt: string;
}

export interface LegalAcceptanceStatusView {
  requiresAcceptance: boolean;
  terms: {
    version: string;
    contentHash: string;
    acceptedCurrent: boolean;
    acceptedAt: string | null;
  };
  privacy: {
    version: string;
    contentHash: string;
    acknowledgedCurrent: boolean;
    acknowledgedAt: string | null;
  };
  optionalProductUpdates: {
    version: string;
    granted: boolean;
    updatedAt: string | null;
  };
  history: LegalAcceptanceRecord[];
}

export class LegalAcceptanceError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "LegalAcceptanceError";
    this.statusCode = statusCode;
  }
}

export function getLegalAcceptanceStatusForUser(
  userId: string
): LegalAcceptanceStatusView {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, profile_id, document_type, document_version, content_hash, action, outcome, created_at
       FROM legal_acceptances
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(userId) as Array<{
    id: string;
    user_id: string;
    profile_id: string | null;
    document_type: LegalDocumentType;
    document_version: string;
    content_hash: string;
    action: "accepted" | "acknowledged" | "declined" | "revoked";
    outcome: string;
    created_at: string;
  }>;

  const currentTermsHash = getLegalDocumentContentHash("terms_of_use");
  const currentPrivacyHash = getLegalDocumentContentHash("privacy_policy");

  const termsRow = rows.find(
    (r) =>
      r.document_type === "terms_of_use" &&
      r.document_version === TERMS_OF_USE_DOCUMENT.version &&
      r.content_hash === currentTermsHash &&
      r.action === "accepted"
  );

  const privacyRow = rows.find(
    (r) =>
      r.document_type === "privacy_policy" &&
      r.document_version === PRIVACY_POLICY_DOCUMENT.version &&
      r.content_hash === currentPrivacyHash &&
      r.action === "acknowledged"
  );

  const optionalRow = rows.find(
    (r) => r.document_type === "optional_product_updates"
  );

  return {
    requiresAcceptance: !termsRow || !privacyRow,
    terms: {
      version: TERMS_OF_USE_DOCUMENT.version,
      contentHash: currentTermsHash,
      acceptedCurrent: Boolean(termsRow),
      acceptedAt: termsRow?.created_at ?? null,
    },
    privacy: {
      version: PRIVACY_POLICY_DOCUMENT.version,
      contentHash: currentPrivacyHash,
      acknowledgedCurrent: Boolean(privacyRow),
      acknowledgedAt: privacyRow?.created_at ?? null,
    },
    optionalProductUpdates: {
      version: OPTIONAL_PRODUCT_UPDATES_VERSION,
      granted: optionalRow?.action === "accepted",
      updatedAt: optionalRow?.created_at ?? null,
    },
    history: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      profileId: r.profile_id,
      documentType: r.document_type,
      documentVersion: r.document_version,
      contentHash: r.content_hash,
      action: r.action,
      outcome: r.outcome,
      createdAt: r.created_at,
    })),
  };
}

export function recordLegalAcceptanceForUser(params: {
  userId: string;
  profileId?: string | null;
  termsAccepted: boolean;
  termsVersion: string;
  privacyAcknowledged: boolean;
  privacyVersion: string;
  optionalProductUpdates?: boolean;
}): LegalAcceptanceStatusView {
  if (params.termsAccepted !== true) {
    throw new LegalAcceptanceError(
      "É necessário aceitar os Termos de Uso por ação afirmativa.",
      400
    );
  }
  if (params.privacyAcknowledged !== true) {
    throw new LegalAcceptanceError(
      "É necessário registrar ciência da Política de Privacidade.",
      400
    );
  }
  if (params.termsVersion !== TERMS_OF_USE_DOCUMENT.version) {
    throw new LegalAcceptanceError(
      "A versão dos Termos de Uso apresentada está desatualizada. Recarregue a página.",
      409
    );
  }
  if (params.privacyVersion !== PRIVACY_POLICY_DOCUMENT.version) {
    throw new LegalAcceptanceError(
      "A versão da Política de Privacidade apresentada está desatualizada. Recarregue a página.",
      409
    );
  }

  let verifiedProfileId: string | null = null;
  if (params.profileId && params.profileId.trim()) {
    const check = getProfileByIdForOwner(params.profileId.trim(), params.userId);
    if (check.error === "forbidden") {
      throw new LegalAcceptanceError(
        "Você não tem permissão para registrar aceite para outro cliente.",
        403
      );
    }
    if (check.error === "not_found" || !check.profile) {
      throw new LegalAcceptanceError("Perfil não encontrado.", 404);
    }
    verifiedProfileId = check.profile.id;
  }

  const db = getDb();
  const now = new Date().toISOString();
  const termsHash = getLegalDocumentContentHash("terms_of_use");
  const privacyHash = getLegalDocumentContentHash("privacy_policy");
  const optionalHash = getLegalDocumentContentHash("optional_product_updates");

  const insertStmt = db.prepare(
    `INSERT INTO legal_acceptances (
      id, user_id, profile_id, document_type, document_version, content_hash, action, outcome, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    insertStmt.run(
      crypto.randomUUID(),
      params.userId,
      verifiedProfileId,
      "terms_of_use",
      TERMS_OF_USE_DOCUMENT.version,
      termsHash,
      "accepted",
      "recorded",
      now
    );

    insertStmt.run(
      crypto.randomUUID(),
      params.userId,
      verifiedProfileId,
      "privacy_policy",
      PRIVACY_POLICY_DOCUMENT.version,
      privacyHash,
      "acknowledged",
      "recorded",
      now
    );

    if (typeof params.optionalProductUpdates === "boolean") {
      insertStmt.run(
        crypto.randomUUID(),
        params.userId,
        verifiedProfileId,
        "optional_product_updates",
        OPTIONAL_PRODUCT_UPDATES_VERSION,
        optionalHash,
        params.optionalProductUpdates ? "accepted" : "declined",
        "recorded",
        now
      );
    }
  });

  tx();
  return getLegalAcceptanceStatusForUser(params.userId);
}

