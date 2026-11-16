"use client";

import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { ProfileStatus } from "@/lib/types";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface PublishStatusProps {
  profileName: string;
  status: ProfileStatus;
  slug: string;
  saveState: SaveState;
  isPublishing: boolean;
  isUnpublishing?: boolean;
  isDeleting?: boolean;
  onSave: () => void;
  onPublish: () => void;
  onUnpublish?: () => void;
  onRequestDelete?: () => void;
}

export function PublishStatus({
  profileName,
  status,
  slug,
  saveState,
  isPublishing,
  isUnpublishing = false,
  isDeleting = false,
  onSave,
  onPublish,
  onUnpublish,
  onRequestDelete,
}: PublishStatusProps) {
  const isPublished = status === "published";
  const isBusy =
    saveState === "saving" || isPublishing || isUnpublishing || isDeleting;
  const publicPath = slug ? `/${slug}` : "";

  return (
    <GlassSurface intensity="standard">
      <div className="editor-status-bar">
        <div className="editor-status-meta">
          <h1 className="editor-profile-name">{profileName || "Perfil"}</h1>
          <span
            className={`badge ${isPublished ? "badge-published" : "badge-draft"}`}
          >
            {isPublished ? "Publicado" : "Rascunho"}
          </span>
          {publicPath ? (
            isPublished ? (
              <>
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-url-chip"
                >
                  <span>{publicPath}</span>
                  <span aria-hidden="true">↗</span>
                </a>
                <CopyLinkButton url={publicPath} />
              </>
            ) : (
              <span
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted)",
                }}
              >
                URL reservada: <strong>{publicPath}</strong>
              </span>
            )
          ) : null}

          <span
            aria-live="polite"
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color:
                saveState === "error"
                  ? "var(--color-danger)"
                  : saveState === "saved"
                    ? "var(--color-success)"
                    : "var(--color-text-muted)",
            }}
          >
            {saveState === "saving" && "Salvando..."}
            {saveState === "saved" && "Salvo"}
            {saveState === "dirty" && "Alterações não salvas"}
            {saveState === "error" && "Falha ao salvar"}
          </span>
        </div>

        <div className="editor-status-actions">
          {isPublished ? (
            <>
              <button
                type="button"
                onClick={onSave}
                disabled={isBusy}
                className="btn btn-primary"
              >
                {saveState === "saving" ? "Salvando..." : "Salvar alterações"}
              </button>
              {onUnpublish ? (
                <button
                  type="button"
                  onClick={onUnpublish}
                  disabled={isBusy}
                  className="btn btn-secondary"
                >
                  {isUnpublishing ? "Despublicando..." : "Despublicar"}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onSave}
                disabled={isBusy}
                className="btn btn-secondary"
              >
                {saveState === "saving" ? "Salvando..." : "Salvar rascunho"}
              </button>
              <button
                type="button"
                onClick={onPublish}
                disabled={isBusy}
                className="btn btn-primary"
              >
                {isPublishing ? "Publicando..." : "Publicar"}
              </button>
            </>
          )}
          {onRequestDelete ? (
            <button
              type="button"
              onClick={onRequestDelete}
              disabled={isBusy}
              className="btn btn-secondary"
              style={{
                borderColor: "var(--color-danger)",
                color: "var(--color-danger)",
              }}
            >
              Excluir
            </button>
          ) : null}
        </div>
      </div>
    </GlassSurface>
  );
}
