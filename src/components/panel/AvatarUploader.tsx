"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { PublicAvatar } from "@/components/public/PublicAvatar";

interface AvatarUploaderProps {
  avatarUrl: string | null;
  displayName: string;
  onChange: (url: string | null) => void;
  error?: string;
}

export function AvatarUploader({
  avatarUrl,
  displayName,
  onChange,
  error,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (!file.type.startsWith("image/")) {
      setUploadError("Envie um arquivo de imagem (PNG, JPG ou WebP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError("A imagem deve ter no máximo 2 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setUploadError(data.error || "Não foi possível enviar a imagem.");
        return;
      }
      onChange(data.url);
    } catch {
      setUploadError("Erro de conexão ao enviar imagem.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  const combinedError = uploadError || error;

  return (
    <div className="field-group">
      <span className="field-label">Foto de perfil</span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "999px",
            overflow: "hidden",
            border: "2px solid var(--color-border-strong)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-surface-subtle)",
          }}
        >
          <PublicAvatar avatarUrl={avatarUrl} displayName={displayName} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flex: 1,
            minWidth: "200px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="sr-only"
              id="avatar-file-input"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="btn btn-secondary"
              style={{ fontSize: "0.875rem" }}
            >
              {uploading ? "Enviando..." : "Enviar imagem"}
            </button>

            {avatarUrl ? (
              <button
                type="button"
                onClick={() => {
                  setUploadError(null);
                  onChange(null);
                }}
                className="btn btn-ghost"
                style={{ fontSize: "0.875rem" }}
              >
                Remover foto
              </button>
            ) : null}
          </div>

          <input
            type="url"
            aria-label="URL da foto de perfil (opcional)"
            value={avatarUrl ?? ""}
            onChange={(e) => {
              setUploadError(null);
              const val = e.target.value.trim();
              onChange(val ? val : null);
            }}
            placeholder="Ou cole uma URL HTTPS da imagem (opcional)"
            className="input"
            style={{ fontSize: "0.875rem" }}
          />
        </div>
      </div>
      <p className="field-hint">
        PNG, JPG ou WebP até 2 MB. Se não enviar foto, exibimos suas iniciais.
      </p>
      {combinedError ? <p className="field-error">{combinedError}</p> : null}
    </div>
  );
}
