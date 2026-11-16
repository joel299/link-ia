"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CustomLinkIconType,
  CustomLinkItem,
  PublicCustomLinkItem,
} from "@/lib/types";

interface CustomLinksPanelProps {
  profileId: string;
  onLinksChange: (links: PublicCustomLinkItem[]) => void;
}

const ICON_OPTIONS: Array<{ value: CustomLinkIconType; label: string }> = [
  { value: "link", label: "Link padrão" },
  { value: "map", label: "Localização / Maps" },
  { value: "store", label: "Loja / Catálogo" },
  { value: "calendar", label: "Agenda / Evento" },
  { value: "phone", label: "Contato / Telefone" },
  { value: "globe", label: "Site / Portfólio" },
];

function toPublicLinks(items: CustomLinkItem[]): PublicCustomLinkItem[] {
  return items
    .filter((item) => item.isActive)
    .map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      description: item.description,
      iconType: item.iconType,
    }));
}

export function CustomLinksPanel({
  profileId,
  onLinksChange,
}: CustomLinksPanelProps) {
  const [items, setItems] = useState<CustomLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [iconType, setIconType] = useState<CustomLinkIconType>("link");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const syncParent = useCallback(
    (nextItems: CustomLinkItem[]) => {
      onLinksChange(toPublicLinks(nextItems));
    },
    [onLinksChange]
  );

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/links`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Não foi possível carregar os links.");
        return;
      }
      const next = Array.isArray(data.items)
        ? (data.items as CustomLinkItem[])
        : [];
      setItems(next);
      syncParent(next);
    } catch {
      setError("Erro de conexão ao carregar links personalizados.");
    } finally {
      setLoading(false);
    }
  }, [profileId, syncParent]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/profiles/${profileId}/links`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Não foi possível carregar os links.");
          setLoading(false);
          return;
        }
        const next = Array.isArray(data.items)
          ? (data.items as CustomLinkItem[])
          : [];
        setItems(next);
        syncParent(next);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão ao carregar links personalizados.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [profileId, syncParent]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setUrl("");
    setDescription("");
    setIconType("link");
    setIsActive(true);
    setFormError(null);
    setShowForm(false);
  }

  function startEdit(item: CustomLinkItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setUrl(item.url);
    setDescription(item.description);
    setIconType(item.iconType);
    setIsActive(item.isActive);
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const endpoint = editingId
        ? `/api/profiles/${profileId}/links/${editingId}`
        : `/api/profiles/${profileId}/links`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          url,
          description,
          iconType,
          isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.item) {
        const firstFieldErr =
          data.errors && typeof data.errors === "object"
            ? (Object.values(data.errors)[0] as string | undefined)
            : undefined;
        setFormError(
          firstFieldErr || data.error || "Não foi possível salvar o link."
        );
        return;
      }

      const saved = data.item as CustomLinkItem;
      const next = editingId
        ? items.map((item) => (item.id === saved.id ? saved : item))
        : [...items, saved];
      setItems(next);
      syncParent(next);
      resetForm();
    } catch {
      setFormError("Erro de conexão ao salvar link personalizado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: CustomLinkItem) {
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/links/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.item) {
        setError(data.error || "Não foi possível atualizar o status do link.");
        return;
      }
      const updated = data.item as CustomLinkItem;
      const next = items.map((row) => (row.id === updated.id ? updated : row));
      setItems(next);
      syncParent(next);
    } catch {
      setError("Erro de conexão ao atualizar link.");
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    setItems(reordered);
    syncParent(reordered);

    try {
      const res = await fetch(`/api/profiles/${profileId}/links/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderedIds: reordered.map((item) => item.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.items)) {
        setError(data.error || "Não foi possível salvar a ordem dos links.");
        void loadLinks();
        return;
      }
      setItems(data.items as CustomLinkItem[]);
      syncParent(data.items as CustomLinkItem[]);
    } catch {
      setError("Erro de conexão ao reordenar links.");
      void loadLinks();
    }
  }

  async function handleDelete(linkId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/links/${linkId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Não foi possível excluir o link.");
        return;
      }
      const next = items.filter((item) => item.id !== linkId);
      setItems(next);
      syncParent(next);
      setConfirmDeleteId(null);
    } catch {
      setError("Erro de conexão ao excluir link.");
    }
  }

  return (
    <section id="secao-links-personalizados" className="settings-block">
      <header className="settings-block-head">
        <div>
          <h3 className="settings-subtitle">Links personalizados</h3>
          <p className="field-hint">
            Botões extras na sua página pública, como endereço no Google Maps,
            site ou portfólio.
          </p>
        </div>
        {items.length > 0 ? (
          <span className="badge badge-draft">{items.length}</span>
        ) : null}
      </header>
      {error ? (
        <div role="alert" className="alert-banner alert-error">
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span className="field-hint">
          Apenas URLs seguras (https://) são aceitas.
        </span>
        {!showForm ? (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="btn btn-secondary"
          >
            + Adicionar link
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          style={{
            padding: "14px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <strong style={{ fontSize: "0.95rem" }}>
            {editingId ? "Editar link personalizado" : "Novo link personalizado"}
          </strong>

          {formError ? (
            <div role="alert" className="alert-banner alert-error">
              {formError}
            </div>
          ) : null}

          <div className="field-group">
            <label htmlFor="custom-link-title" className="field-label">
              Título do botão
            </label>
            <input
              id="custom-link-title"
              type="text"
              maxLength={80}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Como chegar (Google Maps)"
              className="input"
            />
          </div>

          <div className="field-group">
            <label htmlFor="custom-link-url" className="field-label">
              URL de destino (HTTPS)
            </label>
            <input
              id="custom-link-url"
              type="url"
              maxLength={500}
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://maps.google.com/?q=..."
              className="input"
            />
          </div>

          <div className="field-group">
            <label htmlFor="custom-link-desc" className="field-label">
              Descrição curta (opcional)
            </label>
            <input
              id="custom-link-desc"
              type="text"
              maxLength={140}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Av. Paulista, 1000 · Bela Vista"
              className="input"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <div className="field-group">
              <label htmlFor="custom-link-icon" className="field-label">
                Ícone
              </label>
              <select
                id="custom-link-icon"
                value={iconType}
                onChange={(e) => setIconType(e.target.value as CustomLinkIconType)}
                className="input"
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9rem",
                cursor: "pointer",
                paddingTop: "18px",
              }}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Exibir na página pública</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving
                ? "Salvando..."
                : editingId
                  ? "Salvar link"
                  : "Adicionar link"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="field-hint">Carregando links personalizados...</p>
      ) : items.length === 0 ? (
        <p className="field-hint" style={{ margin: 0 }}>
          Nenhum link personalizado cadastrado ainda. Use &ldquo;+ Adicionar link&rdquo; para incluir endereço no Google Maps, site ou outros atalhos.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {items.map((item, idx) => (
            <li
              key={item.id}
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.95rem" }}>{item.title}</strong>
                    <span
                      className={`badge ${
                        item.isActive ? "badge-published" : "badge-draft"
                      }`}
                    >
                      {item.isActive ? "Ativo" : "Oculto"}
                    </span>
                  </div>
                  {item.description ? (
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: "0.82rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {item.description}
                    </p>
                  ) : null}
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "0.78rem",
                      color: "var(--color-text-muted)",
                      wordBreak: "break-all",
                    }}
                  >
                    {item.url}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0}
                    aria-label={`Mover ${item.title} para cima`}
                    className="btn btn-secondary"
                    style={{ minHeight: "34px", padding: "4px 10px" }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === items.length - 1}
                    aria-label={`Mover ${item.title} para baixo`}
                    className="btn btn-secondary"
                    style={{ minHeight: "34px", padding: "4px 10px" }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    className="btn btn-secondary"
                    style={{ minHeight: "34px", padding: "4px 10px" }}
                  >
                    {item.isActive ? "Ocultar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="btn btn-secondary"
                    style={{ minHeight: "34px", padding: "4px 10px" }}
                  >
                    Editar
                  </button>
                  {confirmDeleteId === item.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="btn btn-secondary"
                        style={{
                          minHeight: "34px",
                          padding: "4px 10px",
                          borderColor: "var(--color-danger)",
                          color: "var(--color-danger)",
                        }}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="btn btn-secondary"
                        style={{ minHeight: "34px", padding: "4px 10px" }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="btn btn-secondary"
                      style={{
                        minHeight: "34px",
                        padding: "4px 10px",
                        color: "var(--color-danger)",
                      }}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
