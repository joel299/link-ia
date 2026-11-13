import crypto from "node:crypto";
import { getDb } from "./db";
import type {
  CatalogAvailabilityStatus,
  CatalogFlowType,
  CatalogItem,
  PublicCatalogItem,
  ValidationErrors,
} from "./types";
import { sanitizePlainText } from "./validation";

const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 280;
const MAX_PRICE_CENTS = 100_000_000; // R$ 1.000.000,00
const SAFE_UPLOAD_PATH_RE = /^\/api\/uploads\/[a-f0-9-]+\.(png|jpg|jpeg|webp)$/;

export class CatalogError extends Error {
  status: number;
  errors?: ValidationErrors;

  constructor(message: string, status = 400, errors?: ValidationErrors) {
    super(message);
    this.name = "CatalogError";
    this.status = status;
    this.errors = errors;
  }
}

interface CatalogRow {
  id: string;
  profile_id: string;
  public_id: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  flow_type: CatalogFlowType;
  availability_status: CatalogAvailabilityStatus;
  is_active: number;
  duration_minutes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function mapRowToCatalogItem(row: CatalogRow): CatalogItem {
  return {
    id: row.id,
    profileId: row.profile_id,
    publicId: row.public_id,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    currency: "BRL",
    imageUrl: row.image_url,
    flowType: row.flow_type,
    availabilityStatus: row.availability_status,
    isActive: row.is_active === 1,
    durationMinutes: row.duration_minutes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToPublicCatalogItem(row: CatalogRow): PublicCatalogItem {
  return {
    publicId: row.public_id,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    currency: "BRL",
    imageUrl: row.image_url,
    flowType: row.flow_type,
    availabilityStatus: row.availability_status,
    durationMinutes: row.duration_minutes,
  };
}

export function parseBrazilianPriceToCents(input: unknown): {
  cents: number | null;
  error?: string;
} {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || !Number.isInteger(input) || input < 0 || input > MAX_PRICE_CENTS) {
      return { cents: null, error: "Informe um preço válido entre R$ 0,00 e R$ 1.000.000,00." };
    }
    return { cents: input };
  }

  if (typeof input !== "string") {
    return { cents: null, error: "Informe um preço válido (ex.: 120,00)." };
  }

  const cleaned = input.replace(/R\$/gi, "").replace(/\s+/g, "").trim();
  if (!cleaned) {
    return { cents: null, error: "Informe o preço do serviço ou produto." };
  }

  // Normalize Brazilian ("1.250,50" or "120,00") or dot decimal ("120.50")
  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(cleaned)) {
    normalized = cleaned;
  } else if (/^\d+$/.test(cleaned)) {
    normalized = cleaned;
  } else {
    return { cents: null, error: "Formato de preço inválido. Use ex.: 120,00." };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { cents: null, error: "Formato de preço inválido. Use ex.: 120,00." };
  }

  const [wholePart, fracPart = ""] = normalized.split(".");
  const cents = Number(wholePart) * 100 + Number(fracPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_PRICE_CENTS) {
    return { cents: null, error: "Informe um preço válido entre R$ 0,00 e R$ 1.000.000,00." };
  }

  return { cents };
}

export function formatPriceBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function validateImageUrl(input: unknown): {
  value: string | null;
  error?: string;
} {
  if (input === null || input === undefined || input === "") {
    return { value: null };
  }
  if (typeof input !== "string") {
    return { value: null, error: "URL da imagem inválida." };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { value: null };
  }
  if (/^data:/i.test(trimmed)) {
    return {
      value: null,
      error: "Imagens em base64 não são permitidas. Faça upload pelo painel.",
    };
  }
  if (SAFE_UPLOAD_PATH_RE.test(trimmed)) {
    return { value: trimmed };
  }
  return {
    value: null,
    error: "Caminho de imagem inválido. Envie a foto pelo uploader do painel.",
  };
}

function assertOwnedProfile(profileId: string, ownerId: string): {
  id: string;
  slug: string;
} {
  const db = getDb();
  const profile = db
    .prepare("SELECT id, owner_id, slug FROM profiles WHERE id = ?")
    .get(profileId) as { id: string; owner_id: string; slug: string } | undefined;

  if (!profile) {
    throw new CatalogError("Perfil não encontrado.", 404);
  }
  if (profile.owner_id !== ownerId) {
    throw new CatalogError("Acesso negado a este perfil.", 403);
  }
  return { id: profile.id, slug: profile.slug };
}

export interface CatalogItemInput {
  title?: unknown;
  description?: unknown;
  price?: unknown;
  priceCents?: unknown;
  imageUrl?: unknown;
  flowType?: unknown;
  availabilityStatus?: unknown;
  isActive?: unknown;
  durationMinutes?: unknown;
}

function validateCatalogPayload(
  input: CatalogItemInput,
  partial: boolean,
  existing?: CatalogItem
): {
  title: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  flowType: CatalogFlowType;
  availabilityStatus: CatalogAvailabilityStatus;
  isActive: boolean;
  durationMinutes: number | null;
} {
  const errors: ValidationErrors = {};

  let title = existing?.title ?? "";
  if (!partial || input.title !== undefined) {
    const titleCheck = sanitizePlainText(
      typeof input.title === "string" ? input.title : "",
      MAX_TITLE_LENGTH
    );
    if (titleCheck.error) {
      errors.title = titleCheck.error;
    } else if (titleCheck.value.length < 2) {
      errors.title = `Informe um nome entre 2 e ${MAX_TITLE_LENGTH} caracteres.`;
    } else {
      title = titleCheck.value;
    }
  }

  let description = existing?.description ?? "";
  if (!partial || input.description !== undefined) {
    const descCheck = sanitizePlainText(
      typeof input.description === "string" ? input.description : "",
      MAX_DESCRIPTION_LENGTH
    );
    if (descCheck.error) {
      errors.description = descCheck.error;
    } else if (descCheck.value.length < 4) {
      errors.description = `Informe uma descrição entre 4 e ${MAX_DESCRIPTION_LENGTH} caracteres.`;
    } else {
      description = descCheck.value;
    }
  }

  let priceCents = existing?.priceCents ?? 0;
  if (!partial || input.priceCents !== undefined || input.price !== undefined) {
    const rawPrice =
      input.priceCents !== undefined ? input.priceCents : input.price;
    const parsed = parseBrazilianPriceToCents(rawPrice);
    if (parsed.error || parsed.cents === null) {
      errors.price = parsed.error ?? "Preço inválido.";
    } else {
      priceCents = parsed.cents;
    }
  }

  let imageUrl = existing?.imageUrl ?? null;
  if (!partial || input.imageUrl !== undefined) {
    const imgCheck = validateImageUrl(input.imageUrl);
    if (imgCheck.error) {
      errors.imageUrl = imgCheck.error;
    } else {
      imageUrl = imgCheck.value;
    }
  }

  let flowType: CatalogFlowType = existing?.flowType ?? "appointment";
  if (!partial || input.flowType !== undefined) {
    if (input.flowType !== "appointment" && input.flowType !== "whatsapp") {
      errors.flowType = "Tipo de fluxo inválido.";
    } else {
      flowType = input.flowType;
    }
  }

  let availabilityStatus: CatalogAvailabilityStatus =
    existing?.availabilityStatus ?? "available";
  if (!partial || input.availabilityStatus !== undefined) {
    if (
      input.availabilityStatus !== "available" &&
      input.availabilityStatus !== "unavailable"
    ) {
      errors.availabilityStatus = "Disponibilidade inválida.";
    } else {
      availabilityStatus = input.availabilityStatus;
    }
  }

  let isActive = existing?.isActive ?? true;
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== "boolean") {
      errors.isActive = "Estado de publicação inválido.";
    } else {
      isActive = input.isActive;
    }
  }

  let durationMinutes: number | null = existing?.durationMinutes ?? null;
  if (flowType === "whatsapp") {
    durationMinutes = null;
  } else if (input.durationMinutes !== undefined) {
    if (input.durationMinutes === null || input.durationMinutes === "") {
      durationMinutes = null;
    } else if (
      typeof input.durationMinutes === "number" &&
      Number.isInteger(input.durationMinutes) &&
      input.durationMinutes >= 15 &&
      input.durationMinutes <= 180
    ) {
      durationMinutes = input.durationMinutes;
    } else {
      errors.durationMinutes = "A duração deve ser um inteiro entre 15 e 180 minutos.";
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new CatalogError("Verifique os campos do item.", 422, errors);
  }

  return {
    title,
    description,
    priceCents,
    imageUrl,
    flowType,
    availabilityStatus,
    isActive,
    durationMinutes,
  };
}

export function listCatalogItemsForOwner(
  profileId: string,
  ownerId: string
): CatalogItem[] {
  assertOwnedProfile(profileId, ownerId);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM catalog_items
       WHERE profile_id = ?
       ORDER BY sort_order ASC, created_at ASC`
    )
    .all(profileId) as CatalogRow[];

  return rows.map(mapRowToCatalogItem);
}

export function createCatalogItemForOwner(
  profileId: string,
  ownerId: string,
  input: CatalogItemInput
): { item: CatalogItem; slug: string } {
  const { slug } = assertOwnedProfile(profileId, ownerId);
  const valid = validateCatalogPayload(input, false);

  const db = getDb();
  const maxOrderRow = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM catalog_items WHERE profile_id = ?"
    )
    .get(profileId) as { max_order: number };

  const id = crypto.randomUUID();
  const publicId = `svc_${crypto.randomBytes(6).toString("hex")}`;
  const now = new Date().toISOString();
  const sortOrder = (maxOrderRow?.max_order ?? -1) + 1;

  db.prepare(
    `INSERT INTO catalog_items (
       id, profile_id, public_id, title, description, price_cents, currency,
       image_url, flow_type, availability_status, is_active, duration_minutes,
       sort_order, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'BRL', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    profileId,
    publicId,
    valid.title,
    valid.description,
    valid.priceCents,
    valid.imageUrl,
    valid.flowType,
    valid.availabilityStatus,
    valid.isActive ? 1 : 0,
    valid.durationMinutes,
    sortOrder,
    now,
    now
  );

  const row = db
    .prepare("SELECT * FROM catalog_items WHERE id = ?")
    .get(id) as CatalogRow;

  return { item: mapRowToCatalogItem(row), slug };
}

export function updateCatalogItemForOwner(
  profileId: string,
  itemId: string,
  ownerId: string,
  input: CatalogItemInput
): { item: CatalogItem; slug: string } {
  const { slug } = assertOwnedProfile(profileId, ownerId);
  const db = getDb();
  const existingRow = db
    .prepare("SELECT * FROM catalog_items WHERE id = ? AND profile_id = ?")
    .get(itemId, profileId) as CatalogRow | undefined;

  if (!existingRow) {
    throw new CatalogError("Item do catálogo não encontrado.", 404);
  }

  const existing = mapRowToCatalogItem(existingRow);
  const valid = validateCatalogPayload(input, true, existing);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE catalog_items
     SET title = ?, description = ?, price_cents = ?, image_url = ?,
         flow_type = ?, availability_status = ?, is_active = ?,
         duration_minutes = ?, updated_at = ?
     WHERE id = ? AND profile_id = ?`
  ).run(
    valid.title,
    valid.description,
    valid.priceCents,
    valid.imageUrl,
    valid.flowType,
    valid.availabilityStatus,
    valid.isActive ? 1 : 0,
    valid.durationMinutes,
    now,
    itemId,
    profileId
  );

  const updatedRow = db
    .prepare("SELECT * FROM catalog_items WHERE id = ?")
    .get(itemId) as CatalogRow;

  return { item: mapRowToCatalogItem(updatedRow), slug };
}

export function deleteCatalogItemForOwner(
  profileId: string,
  itemId: string,
  ownerId: string
): { slug: string } {
  const { slug } = assertOwnedProfile(profileId, ownerId);
  const db = getDb();
  const result = db
    .prepare("DELETE FROM catalog_items WHERE id = ? AND profile_id = ?")
    .run(itemId, profileId);

  if (result.changes === 0) {
    throw new CatalogError("Item do catálogo não encontrado.", 404);
  }
  return { slug };
}

export function reorderCatalogItemsForOwner(
  profileId: string,
  ownerId: string,
  orderedIds: string[]
): { items: CatalogItem[]; slug: string } {
  const { slug } = assertOwnedProfile(profileId, ownerId);
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new CatalogError("Informe a ordem dos itens.", 400);
  }

  const db = getDb();
  const existingRows = db
    .prepare("SELECT id FROM catalog_items WHERE profile_id = ?")
    .all(profileId) as Array<{ id: string }>;
  const existingSet = new Set(existingRows.map((r) => r.id));

  if (
    orderedIds.length !== existingSet.size ||
    orderedIds.some((id) => typeof id !== "string" || !existingSet.has(id))
  ) {
    throw new CatalogError("Lista de ordenação inválida para este perfil.", 422);
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(
    "UPDATE catalog_items SET sort_order = ?, updated_at = ? WHERE id = ? AND profile_id = ?"
  );
  const tx = db.transaction((ids: string[]) => {
    ids.forEach((id, idx) => {
      stmt.run(idx, now, id, profileId);
    });
  });
  tx(orderedIds);

  return { items: listCatalogItemsForOwner(profileId, ownerId), slug };
}

export function listPublishedCatalogItemsByProfileId(
  profileId: string
): PublicCatalogItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM catalog_items
       WHERE profile_id = ? AND is_active = 1
       ORDER BY sort_order ASC, created_at ASC`
    )
    .all(profileId) as CatalogRow[];

  return rows.map(mapRowToPublicCatalogItem);
}

export function getPublishedAppointmentService(
  profileId: string,
  servicePublicId: string
): PublicCatalogItem | null {
  if (!servicePublicId || typeof servicePublicId !== "string") return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM catalog_items
       WHERE profile_id = ? AND public_id = ? AND is_active = 1
         AND availability_status = 'available' AND flow_type = 'appointment'`
    )
    .get(profileId, servicePublicId.trim()) as CatalogRow | undefined;

  return row ? mapRowToPublicCatalogItem(row) : null;
}
