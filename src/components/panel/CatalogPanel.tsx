"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type {
  CatalogAvailabilityStatus,
  CatalogFlowType,
  CatalogItem,
  PublicCatalogItem,
} from "@/lib/types";

interface CatalogPanelProps {
  profileId: string;
  onCatalogChange?: (items: PublicCatalogItem[]) => void;
}

interface CatalogFormState {
  title: string;
  description: string;
  priceText: string;
  imageUrl: string | null;
  flowType: CatalogFlowType;
  availabilityStatus: CatalogAvailabilityStatus;
  isActive: boolean;
  durationMinutes: string;
}

const EMPTY_FORM: CatalogFormState = {
  title: "",
  description: "",
  priceText: "",
  imageUrl: null,
  flowType: "appointment",
  availabilityStatus: "available",
  isActive: true,
  durationMinutes: "",
};

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function formatCentsInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatCentsDisplay(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function toPublicItems(items: CatalogItem[]): PublicCatalogItem[] {
  return items
    .filter((i) => i.isActive)
    .map((i) => ({
      publicId: i.publicId,
      title: i.title,
      description: i.description,
      priceCents: i.priceCents,
      currency: "BRL",
      imageUrl: i.imageUrl,
      flowType: i.flowType,
      availabilityStatus: i.availabilityStatus,
      durationMinutes: i.durationMinutes,
    }));
}

export function CatalogPanel({
  profileId,
  onCatalogChange,
}: CatalogPanelProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CatalogFormState>(EMPTY_FORM);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const syncItems = useCallback(
    (next: CatalogItem[]) => {
      setItems(next);
      onCatalogChange?.(toPublicItems(next));
    },
    [onCatalogChange]
  );

  const fetchCatalog = useCallback(async (): Promise<{
    items?: CatalogItem[];
    error?: string;
  }> => {
    try {
      const res = await fetch(
        `/api/profiles/${encodeURIComponent(profileId)}/catalog`,
        {
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          error:
            typeof data.error === "string"
              ? data.error
              : "Não foi possível carregar o catálogo.",
        };
      }
      return {
        items: Array.isArray(data.items) ? (data.items as CatalogItem[]) : [],
      };
    } catch {
      return { error: "Erro de conexão ao carregar o catálogo." };
    }
  }, [profileId]);

  useEffect(() => {
    let active = true;
    void fetchCatalog().then((result) => {
      if (!active) return;
      if (result.error) {
        setLoadError(result.error);
        setLoading(false);
        return;
      }
      setLoadError(null);
      setLoading(false);
      syncItems(result.items ?? []);
    });
    return () => {
      active = false;
    };
  }, [fetchCatalog, syncItems]);

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    void fetchCatalog().then((result) => {
      if (result.error) {
        setLoadError(result.error);
        setLoading(false);
        return;
      }
      setLoadError(null);
      setLoading(false);
      syncItems(result.items ?? []);
    });
  }

  function openNewForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFieldErrors({});
    setUploadError(null);
    setActionNotice(null);
    setFormOpen(true);
  }

  function openEditForm(item: CatalogItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      priceText: formatCentsInput(item.priceCents),
      imageUrl: item.imageUrl,
      flowType: item.flowType,
      availabilityStatus: item.availabilityStatus,
      isActive: item.isActive,
      durationMinutes:
        item.durationMinutes !== null ? String(item.durationMinutes) : "",
    });
    setFormError(null);
    setFieldErrors({});
    setUploadError(null);
    setActionNotice(null);
    setFormOpen(true);
  }

  async function handleFileUpload(file: File | undefined) {
    if (!file) return;
    setUploadError(null);

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setUploadError("Formato inválido. Envie PNG, JPEG ou WEBP.");
      return;
    }
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      setUploadError("A imagem deve ter no máximo 2 MB.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.url !== "string") {
        setUploadError(
          typeof data.error === "string"
            ? data.error
            : "Não foi possível enviar a imagem."
        );
        return;
      }
      setForm((prev) => ({ ...prev, imageUrl: data.url as string }));
    } catch {
      setUploadError("Erro de conexão ao enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (saving || uploading) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    setActionNotice(null);

    const parsedDuration =
      form.flowType === "appointment" && form.durationMinutes.trim() !== ""
        ? Number(form.durationMinutes.trim())
        : null;

    const payload = {
      title: form.title,
      description: form.description,
      price: form.priceText,
      imageUrl: form.imageUrl,
      flowType: form.flowType,
      availabilityStatus: form.availabilityStatus,
      isActive: form.isActive,
      durationMinutes: parsedDuration,
    };

    try {
      const url = editingId
        ? `/api/profiles/${encodeURIComponent(profileId)}/catalog/${encodeURIComponent(editingId)}`
        : `/api/profiles/${encodeURIComponent(profileId)}/catalog`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.item) {
        setFormError(
          typeof data.error === "string"
            ? data.error
            : "Não foi possível salvar o item."
        );
        if (data.errors && typeof data.errors === "object") {
          setFieldErrors(data.errors as Record<string, string>);
        }
        return;
      }

      const saved = data.item as CatalogItem;
      const next = editingId
        ? items.map((it) => (it.id === saved.id ? saved : it))
        : [...items, saved];
      syncItems(next);
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setActionNotice(
        editingId
          ? "Item atualizado e refletido no perfil."
          : "Item adicionado ao catálogo do perfil."
      );
    } catch {
      setFormError("Erro de conexão ao salvar o item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: CatalogItem) {
    setActionNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${encodeURIComponent(profileId)}/catalog/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !item.isActive }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.item) return;
      const updated = data.item as CatalogItem;
      syncItems(items.map((it) => (it.id === updated.id ? updated : it)));
    } catch {
      // ignore transient error
    }
  }

  async function handleDelete(item: CatalogItem) {
    setActionNotice(null);
    try {
      const res = await fetch(
        `/api/profiles/${encodeURIComponent(profileId)}/catalog/${encodeURIComponent(item.id)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!res.ok) return;
      syncItems(items.filter((it) => it.id !== item.id));
      if (editingId === item.id) {
        setFormOpen(false);
        setEditingId(null);
      }
      setActionNotice("Item removido do catálogo.");
    } catch {
      // ignore
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    syncItems(reordered);

    try {
      const res = await fetch(
        `/api/profiles/${encodeURIComponent(profileId)}/catalog/reorder`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: reordered.map((i) => i.id) }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.items)) {
        syncItems(data.items as CatalogItem[]);
      }
    } catch {
      // keep optimistic order or reload on next visit
    }
  }

  return (
    <GlassSurface as="section" intensity="dense">
      <div className="editor-section-inner">
        <div
          className="editor-section-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="editor-section-title">
              Catálogo de Serviços e Produtos
            </h2>
            <p className="editor-section-desc">
              Cadastre itens para exibir em um carrossel horizontal abaixo dos
              links do seu perfil público.
            </p>
          </div>
          {!formOpen ? (
            <button
              type="button"
              onClick={openNewForm}
              className="btn btn-primary"
              style={{ minHeight: "38px" }}
            >
              + Novo item
            </button>
          ) : null}
        </div>

        {actionNotice ? (
          <div role="status" className="alert-banner alert-success">
            {actionNotice}
          </div>
        ) : null}

        {loading ? (
          <p className="field-hint">Carregando catálogo...</p>
        ) : loadError ? (
          <div role="alert" className="alert-banner alert-error">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={handleRetryLoad}
              className="btn btn-secondary"
              style={{ marginLeft: "12px", minHeight: "36px" }}
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {formOpen ? (
          <form
            onSubmit={handleSaveItem}
            className="link-card-group"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <strong>
              {editingId ? "Editar item do catálogo" : "Adicionar item ao catálogo"}
            </strong>

            <div className="field-group">
              <label htmlFor="cat-title" className="field-label">
                Nome do serviço ou produto
              </label>
              <input
                id="cat-title"
                type="text"
                required
                maxLength={80}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Avaliação Inicial ou Kit Skincare"
                className="text-input"
              />
              {fieldErrors.title ? (
                <span className="field-error">{fieldErrors.title}</span>
              ) : null}
            </div>

            <div className="field-group">
              <label htmlFor="cat-desc" className="field-label">
                Descrição resumida
              </label>
              <textarea
                id="cat-desc"
                required
                maxLength={280}
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Descreva o que está incluso no atendimento ou produto."
                className="text-input"
              />
              {fieldErrors.description ? (
                <span className="field-error">{fieldErrors.description}</span>
              ) : null}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              <div className="field-group">
                <label htmlFor="cat-price" className="field-label">
                  Preço (R$)
                </label>
                <input
                  id="cat-price"
                  type="text"
                  required
                  value={form.priceText}
                  onChange={(e) =>
                    setForm({ ...form, priceText: e.target.value })
                  }
                  placeholder="120,00"
                  className="text-input"
                />
                {fieldErrors.price ? (
                  <span className="field-error">{fieldErrors.price}</span>
                ) : null}
              </div>

              <div className="field-group">
                <label htmlFor="cat-flow" className="field-label">
                  Tipo de fluxo
                </label>
                <select
                  id="cat-flow"
                  value={form.flowType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      flowType: e.target.value as CatalogFlowType,
                    })
                  }
                  className="text-input"
                >
                  <option value="appointment">Agendamento</option>
                  <option value="whatsapp">Solicitar pelo WhatsApp</option>
                </select>
              </div>

              {form.flowType === "appointment" ? (
                <div className="field-group">
                  <label htmlFor="cat-duration" className="field-label">
                    Duração própria (min, opcional)
                  </label>
                  <input
                    id="cat-duration"
                    type="number"
                    min={15}
                    max={180}
                    step={5}
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm({ ...form, durationMinutes: e.target.value })
                    }
                    placeholder="Padrão da agenda"
                    className="text-input"
                  />
                  {fieldErrors.durationMinutes ? (
                    <span className="field-error">
                      {fieldErrors.durationMinutes}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="field-group">
                <label htmlFor="cat-avail" className="field-label">
                  Disponibilidade
                </label>
                <select
                  id="cat-avail"
                  value={form.availabilityStatus}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      availabilityStatus: e.target
                        .value as CatalogAvailabilityStatus,
                    })
                  }
                  className="text-input"
                >
                  <option value="available">Disponível</option>
                  <option value="unavailable">Indisponível</option>
                </select>
              </div>
            </div>

            {/* Image Upload */}
            <div className="field-group">
              <span className="field-label">Foto do item (PNG, JPEG ou WEBP, até 2 MB)</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt="Prévia do item"
                    width={72}
                    height={54}
                    style={{
                      width: "72px",
                      height: "54px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "1px solid var(--color-border)",
                    }}
                  />
                ) : null}

                <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                  {uploading
                    ? "Enviando..."
                    : form.imageUrl
                      ? "Trocar foto"
                      : "Enviar foto"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      void handleFileUpload(file);
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                </label>

                {form.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imageUrl: null })}
                    className="btn btn-secondary"
                  >
                    Remover foto
                  </button>
                ) : null}
              </div>
              {uploadError ? (
                <span className="field-error" role="alert">
                  {uploadError}
                </span>
              ) : null}
              {fieldErrors.imageUrl ? (
                <span className="field-error">{fieldErrors.imageUrl}</span>
              ) : null}
            </div>

            <label className="switch-label">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="switch-input"
              />
              <span>Publicado / visível no perfil público</span>
            </label>

            {formError ? (
              <div role="alert" className="alert-banner alert-error">
                {formError}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={saving || uploading}
                className="btn btn-primary"
              >
                {saving ? "Salvando..." : "Salvar item"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                  setFormError(null);
                }}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : null}

        {!loading && items.length === 0 && !formOpen ? (
          <p className="field-hint">
            Nenhum item cadastrado ainda. Enquanto estiver vazio, nenhuma seção
            extra aparece no seu perfil público.
          </p>
        ) : null}

        {items.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="link-card-group"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    minWidth: 0,
                    flex: "1 1 240px",
                  }}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      width={56}
                      height={42}
                      style={{
                        width: "56px",
                        height: "42px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: "block" }}>{item.title}</strong>
                    <span className="field-hint" style={{ display: "block" }}>
                      {formatCentsDisplay(item.priceCents)} ·{" "}
                      {item.flowType === "appointment"
                        ? `Agendamento${item.durationMinutes ? ` (${item.durationMinutes} min)` : ""}`
                        : "WhatsApp"}{" "}
                      ·{" "}
                      {item.availabilityStatus === "available"
                        ? "Disponível"
                        : "Indisponível"}{" "}
                      · {item.isActive ? "Publicado" : "Oculto"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => void handleMove(idx, -1)}
                    aria-label={`Mover ${item.title} para cima`}
                    className="btn btn-secondary"
                    style={{ minHeight: "34px", padding: "0 10px" }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1}
                    onClick={() => void handleMove(idx, 1)}
                    aria-label={`Mover ${item.title} para baixo`}
                    className="btn btn-secondary"
                    style={{ minHeight: "34px", padding: "0 10px" }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(item)}
                    className="btn btn-secondary"
                    style={{ minHeight: "34px", padding: "0 10px" }}
                  >
                    {item.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditForm(item)}
                    className="btn btn-secondary"
                    style={{ minHeight: "34px", padding: "0 10px" }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item)}
                    className="btn btn-secondary"
                    style={{ minHeight: "34px", padding: "0 10px" }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </GlassSurface>
  );
}

