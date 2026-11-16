"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { uploadImage } from "./image-upload";

interface CoverUploaderProps {
  coverUrl: string | null;
  coverBlur: number;
  displayName: string;
  onChange: (url: string | null) => void;
  onBlurChange: (value: number) => void;
  error?: string;
}

const BLUR_MIN = 0;
const BLUR_MAX = 24;

export function CoverUploader({
  coverUrl,
  coverBlur,
  displayName,
  onChange,
  onBlurChange,
  error,
}: CoverUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    const result = await uploadImage(file);
    setUploading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    if (result.error || !result.url) {
      setUploadError(result.error ?? "Não foi possível enviar a imagem.");
      return;
    }
    onChange(result.url);
  }

  const safeBlur = Math.min(BLUR_MAX, Math.max(BLUR_MIN, coverBlur));
  const combinedError = uploadError || error;

  return (
    <div className="field-group cover-field">
      <div className="field-label-row">
        <span className="field-label">Foto de capa</span>
        <span className="field-hint">Opcional</span>
      </div>
      <p className="field-hint">
        Aparece no topo da página pública, com desfoque suave na transição para
        o seu conteúdo.
      </p>

      <div
        className={`cover-preview${coverUrl ? "" : " is-empty"}`}
        style={{ ["--cover-blur" as string]: `${safeBlur}px` }}
      >
        {coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cover-preview-img"
              src={coverUrl}
              alt={`Prévia da capa de ${displayName || "perfil"}`}
            />
            <span className="cover-preview-blur" aria-hidden="true" />
          </>
        ) : (
          <span className="cover-preview-empty">
            Nenhuma capa enviada. O perfil usa o layout atual.
          </span>
        )}
      </div>

      <div className="cover-actions">
        <input
          ref={inputRef}
          id="cover-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn btn-secondary"
        >
          {uploading ? "Enviando..." : coverUrl ? "Trocar capa" : "Enviar capa"}
        </button>
        {coverUrl ? (
          <button
            type="button"
            onClick={() => {
              setUploadError(null);
              onChange(null);
            }}
            className="btn btn-ghost"
          >
            Remover capa
          </button>
        ) : null}
      </div>

      <div className="cover-blur-control">
        <label htmlFor="cover-blur" className="field-label">
          <span>Intensidade do desfoque</span>
          <span className="field-hint" aria-live="polite">
            {safeBlur}
          </span>
        </label>
        <input
          id="cover-blur"
          type="range"
          min={BLUR_MIN}
          max={BLUR_MAX}
          step={1}
          value={safeBlur}
          onChange={(event) => onBlurChange(Number(event.target.value))}
          className="cover-blur-range"
          aria-describedby="cover-blur-hint"
        />
        <p id="cover-blur-hint" className="field-hint">
          0 deixa a transição nítida; valores altos suavizam mais a divisão da
          capa.
        </p>
      </div>

      <p className="field-hint">
        PNG, JPG ou WebP até 2 MB. A imagem não é exibida com caminho técnico.
      </p>
      {combinedError ? <p className="field-error">{combinedError}</p> : null}
    </div>
  );
}
