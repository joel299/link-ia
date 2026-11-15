import crypto from "node:crypto";
import { getDb } from "./db";
import type {
  CustomLinkIconType,
  CustomLinkItem,
  PublicCustomLinkItem,
  ValidationErrors,
} from "./types";

interface CustomLinkRow {
  id: string;
  profile_id: string;
  owner_id: string;
  title: string;
  url: string;
  description: string;
  icon_type: CustomLinkIconType;
  is_active: number;
  position: number;
  created_at: string;
  updated_at: string;
}

const VALID_ICON_TYPES = new Set<CustomLinkIconType>([
  "link",
  "map",
  "store",
  "calendar",
  "phone",
  "globe",
]);

function rowToCustomLink(row: CustomLinkRow): CustomLinkItem {
  return {
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    url: row.url,
    description: row.description,
    iconType: VALID_ICON_TYPES.has(row.icon_type) ? row.icon_type : "link",
    isActive: Boolean(row.is_active),
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeLinkText(
  raw: string,
  maxLength: number
): { value: string; error?: string } {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (/[<>]/.test(normalized)) {
    return {
      value: normalized,
      error: "Não use caracteres HTML (< ou >) neste campo.",
    };
  }
  if (normalized.length > maxLength) {
    return {
      value: normalized,
      error: `Use no máximo ${maxLength} caracteres.`,
    };
  }
  return { value: normalized };
}

export function validateHttpsLinkUrl(raw: string): {
  url?: string;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Informe a URL de destino." };
  }
  if (trimmed.length > 500) {
    return { error: "A URL deve ter no máximo 500 caracteres." };
  }
  if (/[<>]/.test(trimmed) || /\s/.test(trimmed)) {
    return { error: "A URL contém caracteres inválidos." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "Informe uma URL válida começando com https://." };
  }

  if (parsed.protocol !== "https:") {
    return { error: "Por segurança, use apenas links que comecem com https://." };
  }

  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return { error: "Informe um domínio válido na URL HTTPS." };
  }

  return { url: parsed.toString() };
}

export function listCustomLinksForOwner(
  profileId: string,
  ownerId: string
): CustomLinkItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, profile_id, owner_id, title, url, description, icon_type,
              is_active, position, created_at, updated_at
       FROM profile_custom_links
       WHERE profile_id = ? AND owner_id = ?
       ORDER BY position ASC, created_at ASC`
    )
    .all(profileId, ownerId) as CustomLinkRow[];

  return rows.map(rowToCustomLink);
}

export function listActivePublicCustomLinks(
  profileId: string
): PublicCustomLinkItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, title, url, description, icon_type
       FROM profile_custom_links
       WHERE profile_id = ? AND is_active = 1
       ORDER BY position ASC, created_at ASC`
    )
    .all(profileId) as Array<{
    id: string;
    title: string;
    url: string;
    description: string;
    icon_type: CustomLinkIconType;
  }>;

  return rows
    .filter((row) => {
      const check = validateHttpsLinkUrl(row.url);
      return Boolean(check.url);
    })
    .map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      description: row.description,
      iconType: VALID_ICON_TYPES.has(row.icon_type) ? row.icon_type : "link",
    }));
}

export interface CustomLinkInput {
  title: string;
  url: string;
  description?: string;
  iconType?: CustomLinkIconType;
  isActive?: boolean;
}

export function createCustomLink(
  profileId: string,
  ownerId: string,
  input: CustomLinkInput
): {
  item?: CustomLinkItem;
  errors?: ValidationErrors;
  status?: number;
} {
  const errors: ValidationErrors = {};
  const titleCheck = sanitizeLinkText(input.title ?? "", 80);
  if (!titleCheck.value) {
    errors.title = "O título do link é obrigatório.";
  } else if (titleCheck.error) {
    errors.title = titleCheck.error;
  }

  const urlCheck = validateHttpsLinkUrl(input.url ?? "");
  if (urlCheck.error) {
    errors.url = urlCheck.error;
  }

  const descCheck = sanitizeLinkText(input.description ?? "", 140);
  if (descCheck.error) {
    errors.description = descCheck.error;
  }

  const iconType: CustomLinkIconType =
    input.iconType && VALID_ICON_TYPES.has(input.iconType)
      ? input.iconType
      : "link";

  if (Object.keys(errors).length > 0) {
    return { errors, status: 422 };
  }

  const db = getDb();
  const maxPosRow = db
    .prepare(
      "SELECT COALESCE(MAX(position), -1) AS max_pos FROM profile_custom_links WHERE profile_id = ?"
    )
    .get(profileId) as { max_pos: number } | undefined;
  const nextPosition = (maxPosRow?.max_pos ?? -1) + 1;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const isActive = input.isActive === undefined ? 1 : input.isActive ? 1 : 0;

  db.prepare(
    `INSERT INTO profile_custom_links (
      id, profile_id, owner_id, title, url, description, icon_type,
      is_active, position, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    profileId,
    ownerId,
    titleCheck.value,
    urlCheck.url!,
    descCheck.value,
    iconType,
    isActive,
    nextPosition,
    now,
    now
  );

  const created = db
    .prepare("SELECT * FROM profile_custom_links WHERE id = ?")
    .get(id) as CustomLinkRow;

  return { item: rowToCustomLink(created), status: 201 };
}

export function updateCustomLink(
  profileId: string,
  linkId: string,
  ownerId: string,
  input: Partial<CustomLinkInput>
): {
  item?: CustomLinkItem;
  errors?: ValidationErrors;
  status?: number;
} {
  const db = getDb();
  const existing = db
    .prepare(
      "SELECT * FROM profile_custom_links WHERE id = ? AND profile_id = ? AND owner_id = ?"
    )
    .get(linkId, profileId, ownerId) as CustomLinkRow | undefined;

  if (!existing) {
    return {
      errors: { _form: "Link personalizado não encontrado." },
      status: 404,
    };
  }

  const errors: ValidationErrors = {};

  let nextTitle = existing.title;
  if (input.title !== undefined) {
    const titleCheck = sanitizeLinkText(input.title, 80);
    if (!titleCheck.value) {
      errors.title = "O título do link é obrigatório.";
    } else if (titleCheck.error) {
      errors.title = titleCheck.error;
    } else {
      nextTitle = titleCheck.value;
    }
  }

  let nextUrl = existing.url;
  if (input.url !== undefined) {
    const urlCheck = validateHttpsLinkUrl(input.url);
    if (urlCheck.error) {
      errors.url = urlCheck.error;
    } else if (urlCheck.url) {
      nextUrl = urlCheck.url;
    }
  }

  let nextDescription = existing.description;
  if (input.description !== undefined) {
    const descCheck = sanitizeLinkText(input.description, 140);
    if (descCheck.error) {
      errors.description = descCheck.error;
    } else {
      nextDescription = descCheck.value;
    }
  }

  const nextIconType =
    input.iconType !== undefined
      ? VALID_ICON_TYPES.has(input.iconType)
        ? input.iconType
        : existing.icon_type
      : existing.icon_type;

  const nextIsActive =
    input.isActive !== undefined
      ? input.isActive
        ? 1
        : 0
      : existing.is_active;

  if (Object.keys(errors).length > 0) {
    return { errors, status: 422 };
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE profile_custom_links
     SET title = ?, url = ?, description = ?, icon_type = ?, is_active = ?, updated_at = ?
     WHERE id = ? AND profile_id = ? AND owner_id = ?`
  ).run(
    nextTitle,
    nextUrl,
    nextDescription,
    nextIconType,
    nextIsActive,
    now,
    linkId,
    profileId,
    ownerId
  );

  const updated = db
    .prepare("SELECT * FROM profile_custom_links WHERE id = ?")
    .get(linkId) as CustomLinkRow;

  return { item: rowToCustomLink(updated), status: 200 };
}

export function deleteCustomLink(
  profileId: string,
  linkId: string,
  ownerId: string
): { deleted: boolean; status: number; error?: string } {
  const db = getDb();
  const result = db
    .prepare(
      "DELETE FROM profile_custom_links WHERE id = ? AND profile_id = ? AND owner_id = ?"
    )
    .run(linkId, profileId, ownerId);

  if (result.changes === 0) {
    return {
      deleted: false,
      status: 404,
      error: "Link personalizado não encontrado.",
    };
  }

  return { deleted: true, status: 200 };
}

export function reorderCustomLinks(
  profileId: string,
  ownerId: string,
  orderedIds: string[]
): { items?: CustomLinkItem[]; error?: string; status: number } {
  const db = getDb();
  const existing = listCustomLinksForOwner(profileId, ownerId);
  const existingIds = new Set(existing.map((item) => item.id));

  if (
    orderedIds.length !== existing.length ||
    orderedIds.some((id) => !existingIds.has(id)) ||
    new Set(orderedIds).size !== orderedIds.length
  ) {
    return {
      error: "Lista de ordenação inválida para os links deste perfil.",
      status: 400,
    };
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(
    "UPDATE profile_custom_links SET position = ?, updated_at = ? WHERE id = ? AND profile_id = ? AND owner_id = ?"
  );

  const tx = db.transaction(() => {
    orderedIds.forEach((id, index) => {
      stmt.run(index, now, id, profileId, ownerId);
    });
  });
  tx();

  return { items: listCustomLinksForOwner(profileId, ownerId), status: 200 };
}

