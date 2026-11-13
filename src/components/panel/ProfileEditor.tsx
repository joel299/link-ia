"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildPreviewInstagramUrl,
  getContrastRatio,
} from "@/components/public/profile-visuals";
import { GlassSurface } from "@/components/ui/GlassSurface";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  type ButtonStyle,
  type FontOption,
  type Profile,
  type ProfileTheme,
  type ProfileUpdateInput,
  type ValidationErrors,
} from "@/lib/types";
import { AvatarUploader } from "./AvatarUploader";
import { ColorField } from "./ColorField";
import { CatalogPanel } from "./CatalogPanel";
import { GoogleCalendarPanel } from "./GoogleCalendarPanel";
import { ProfilePreview } from "./ProfilePreview";
import { PublishStatus, type SaveState } from "./PublishStatus";

interface ProfileEditorProps {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
}

interface SlugCheckState {
  status: "idle" | "checking" | "available" | "unavailable" | "error";
  message?: string;
  suggestion?: string;
  normalized?: string;
}

const FONT_OPTIONS: { value: FontOption; label: string }[] = [
  { value: "manrope", label: "Manrope" },
  { value: "inter", label: "Inter" },
  { value: "dm-sans", label: "DM Sans" },
  { value: "system", label: "Sistema" },
];

const BUTTON_STYLES: { value: ButtonStyle; label: string }[] = [
  { value: "rounded", label: "Arredondado" },
  { value: "soft", label: "Suave" },
  { value: "sharp", label: "Reto" },
];

export function ProfileEditor({
  profile,
  onProfileUpdated,
}: ProfileEditorProps) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isPublishing, setIsPublishing] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [slugCheck, setSlugCheck] = useState<SlugCheckState>({ status: "idle" });
  const [internalBookingEnabled, setInternalBookingEnabled] = useState(false);
  const [catalogItems, setCatalogItems] = useState<
    import("@/lib/types").PublicCatalogItem[]
  >([]);
  const slugTimerRef = useRef<number | null>(null);
  const saveBookingRef = useRef<(() => Promise<boolean>) | null>(null);

  function updateField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaveState("dirty");
    setBannerError(null);
    setBannerSuccess(null);
    if (key === "slug") {
      const nextSlug = String(value).trim();
      if (!nextSlug || nextSlug === profile.slug) {
        setSlugCheck({ status: "idle" });
      } else {
        setSlugCheck({ status: "checking" });
      }
    }
    if (fieldErrors[key as string]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  }

  function updateTheme<K extends keyof ProfileTheme>(
    key: K,
    value: ProfileTheme[K]
  ) {
    setDraft((prev) => ({
      ...prev,
      theme: { ...prev.theme, [key]: value },
    }));
    setSaveState("dirty");
    setBannerError(null);
    setBannerSuccess(null);
  }

  function applyThemePreset(preset: ProfileTheme) {
    setDraft((prev) => ({
      ...prev,
      theme: {
        ...preset,
        fontFamily: prev.theme.fontFamily,
        buttonStyle: prev.theme.buttonStyle,
      },
    }));
    setSaveState("dirty");
    setBannerError(null);
    setBannerSuccess(null);
  }

  // Real-time debounced slug availability check
  useEffect(() => {
    const trimmed = draft.slug.trim();
    if (!trimmed || trimmed === profile.slug) {
      return;
    }

    if (slugTimerRef.current) {
      window.clearTimeout(slugTimerRef.current);
    }

    slugTimerRef.current = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          slug: trimmed,
          excludeId: draft.id,
        });
        const res = await fetch(
          `/api/profiles/slug-availability?${params.toString()}`,
          { credentials: "include" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSlugCheck({
            status: "error",
            message: data.error || "Não foi possível verificar o slug.",
          });
          return;
        }
        if (data.available) {
          setSlugCheck({
            status: "available",
            normalized: data.normalized,
            message: `Disponível como /${data.normalized || trimmed}`,
          });
        } else {
          setSlugCheck({
            status: "unavailable",
            normalized: data.normalized,
            suggestion: data.suggestion,
            message: data.error || "Este slug já está em uso.",
          });
        }
      } catch {
        setSlugCheck({
          status: "error",
          message: "Erro ao verificar disponibilidade.",
        });
      }
    }, 350);

    return () => {
      if (slugTimerRef.current) {
        window.clearTimeout(slugTimerRef.current);
      }
    };
  }, [draft.slug, draft.id, profile.slug]);

  function buildPayload(): ProfileUpdateInput {
    return {
      slug: draft.slug,
      displayName: draft.displayName,
      bio: draft.bio,
      avatarUrl: draft.avatarUrl,
      instagramInput: draft.instagramInput,
      instagramEnabled: draft.instagramEnabled,
      whatsappNumber: draft.whatsappNumber,
      whatsappMessage: draft.whatsappMessage,
      whatsappEnabled: draft.whatsappEnabled,
      bookingUrl: draft.bookingUrl,
      bookingLabel: draft.bookingLabel,
      bookingEnabled: draft.bookingEnabled,
      theme: draft.theme,
    };
  }

  async function saveProfile(): Promise<Profile | null> {
    setSaveState("saving");
    setBannerError(null);
    setBannerSuccess(null);
    setFieldErrors({});

    try {
      const res = await fetch(`/api/profiles/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.profile) {
        setSaveState("error");
        if (data.errors && typeof data.errors === "object") {
          setFieldErrors(data.errors);
        }
        if (data.suggestion) {
          setSlugCheck((prev) => ({
            ...prev,
            status: "unavailable",
            suggestion: data.suggestion,
          }));
        }
        setBannerError(
          data.error || "Revise os campos destacados antes de salvar."
        );
        return null;
      }

      setDraft(data.profile);
      onProfileUpdated(data.profile);
      if (saveBookingRef.current) {
        const bookingOk = await saveBookingRef.current();
        if (!bookingOk) {
          setSaveState("error");
          setBannerError(
            "Perfil salvo, mas revise as configurações de agendamento abaixo."
          );
          return null;
        }
      }
      setSaveState("saved");
      return data.profile;
    } catch {
      setSaveState("error");
      setBannerError("Erro de conexão ao salvar alterações.");
      return null;
    }
  }

  async function handlePublish() {
    setIsPublishing(true);
    setBannerError(null);
    setBannerSuccess(null);
    setFieldErrors({});

    const saved = await saveProfile();
    if (!saved) {
      setIsPublishing(false);
      return;
    }

    try {
      const res = await fetch(`/api/profiles/${saved.id}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.profile) {
        if (data.errors && typeof data.errors === "object") {
          setFieldErrors(data.errors);
        }
        setBannerError(
          data.error || "Não foi possível publicar. Verifique os campos abaixo."
        );
        setIsPublishing(false);
        return;
      }

      setDraft(data.profile);
      onProfileUpdated(data.profile);
      setSaveState("saved");
      setBannerSuccess(`Perfil publicado em /${data.profile.slug}`);
    } catch {
      setBannerError("Erro de conexão ao publicar perfil.");
    } finally {
      setIsPublishing(false);
    }
  }

  const resolvedIg = buildPreviewInstagramUrl(draft.instagramInput);
  const contrastRatio = getContrastRatio(
    draft.theme.bgColor,
    draft.theme.textColor
  );
  const lowContrast = contrastRatio !== null && contrastRatio < 4.5;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <PublishStatus
        status={draft.status}
        slug={draft.slug}
        saveState={saveState}
        isPublishing={isPublishing}
        onSave={saveProfile}
        onPublish={handlePublish}
      />

      {bannerError ? (
        <div role="alert" className="alert-banner alert-error">
          {bannerError}
        </div>
      ) : null}

      {bannerSuccess ? (
        <div role="status" className="alert-banner alert-success">
          {bannerSuccess}
        </div>
      ) : null}

      {/* Mobile Edit / Preview Switcher */}
      <div
        className="mobile-mode-switcher"
        role="tablist"
        aria-label="Alternar entre edição e prévia"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "edit"}
          onClick={() => setMobileTab("edit")}
          className="btn"
          style={{
            minHeight: "40px",
            background:
              mobileTab === "edit" ? "var(--color-surface)" : "transparent",
            borderColor:
              mobileTab === "edit"
                ? "var(--color-border-strong)"
                : "transparent",
          }}
        >
          Editar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "preview"}
          onClick={() => setMobileTab("preview")}
          className="btn"
          style={{
            minHeight: "40px",
            background:
              mobileTab === "preview" ? "var(--color-surface)" : "transparent",
            borderColor:
              mobileTab === "preview"
                ? "var(--color-border-strong)"
                : "transparent",
          }}
        >
          Prévia
        </button>
      </div>

      <div className="editor-workspace" data-mobile-tab={mobileTab}>
        <div className="editor-column">
          {/* Section 1: Identidade */}
          <GlassSurface as="section" intensity="dense">
            <div className="editor-section-inner">
              <div className="editor-section-header">
                <h2 className="editor-section-title">1. Identidade</h2>
                <p className="editor-section-desc">
                  Nome público, endereço curto (slug), bio e foto de perfil.
                </p>
              </div>

              <div className="field-group">
                <label htmlFor="displayName" className="field-label">
                  <span>Nome público</span>
                  <span className="field-hint">
                    {draft.displayName.length}/80
                  </span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  maxLength={80}
                  value={draft.displayName}
                  onChange={(e) => updateField("displayName", e.target.value)}
                  placeholder="Ex.: Joel Quintana · Barbearia"
                  aria-invalid={Boolean(fieldErrors.displayName)}
                  aria-describedby={
                    fieldErrors.displayName ? "displayName-error" : undefined
                  }
                  className="input"
                />
                {fieldErrors.displayName ? (
                  <p id="displayName-error" className="field-error">
                    {fieldErrors.displayName}
                  </p>
                ) : null}
              </div>

              <div className="field-group">
                <label htmlFor="slug" className="field-label">
                  <span>Endereço da página (slug)</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "0.9rem",
                      color: "var(--color-text-muted)",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    linkia /
                  </span>
                  <input
                    id="slug"
                    type="text"
                    maxLength={40}
                    value={draft.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    placeholder="joel-quintana"
                    aria-invalid={
                      Boolean(fieldErrors.slug) ||
                      slugCheck.status === "unavailable"
                    }
                    aria-describedby="slug-status"
                    className="input"
                  />
                </div>
                <div
                  id="slug-status"
                  aria-live="polite"
                  style={{ fontSize: "0.8125rem" }}
                >
                  {fieldErrors.slug ? (
                    <span className="field-error">{fieldErrors.slug}</span>
                  ) : slugCheck.status === "checking" ? (
                    <span className="field-hint">
                      Verificando disponibilidade...
                    </span>
                  ) : slugCheck.status === "available" ? (
                    <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                      {slugCheck.message}
                    </span>
                  ) : slugCheck.status === "unavailable" ? (
                    <span style={{ color: "var(--color-danger)", fontWeight: 500 }}>
                      {slugCheck.message}{" "}
                      {slugCheck.suggestion ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateField("slug", slugCheck.suggestion!)
                          }
                          style={{
                            marginLeft: "6px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            border: "1px solid var(--color-primary)",
                            background: "var(--color-success-bg)",
                            color: "var(--color-success)",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Usar {slugCheck.suggestion}
                        </button>
                      ) : null}
                    </span>
                  ) : (
                    <span className="field-hint">
                      Use letras minúsculas, números e hífen.
                    </span>
                  )}
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="bio" className="field-label">
                  <span>Descrição curta (bio)</span>
                  <span className="field-hint">{draft.bio.length}/160</span>
                </label>
                <textarea
                  id="bio"
                  maxLength={160}
                  value={draft.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  placeholder="Conte em poucas palavras o que você faz e como atende."
                  aria-invalid={Boolean(fieldErrors.bio)}
                  aria-describedby={fieldErrors.bio ? "bio-error" : undefined}
                  className="textarea"
                />
                {fieldErrors.bio ? (
                  <p id="bio-error" className="field-error">
                    {fieldErrors.bio}
                  </p>
                ) : null}
              </div>

              <AvatarUploader
                avatarUrl={draft.avatarUrl}
                displayName={draft.displayName}
                onChange={(url) => updateField("avatarUrl", url)}
                error={fieldErrors.avatarUrl}
              />
            </div>
          </GlassSurface>

          {/* Section 2: Links */}
          <GlassSurface as="section" intensity="dense">
            <div className="editor-section-inner">
              <div className="editor-section-header">
                <h2 className="editor-section-title">2. Links de ação</h2>
                <p className="editor-section-desc">
                  Ative apenas os canais que deseja exibir na página pública. O
                  agendamento integrado é configurado na seção{" "}
                  <strong>Google Agenda</strong> abaixo.
                </p>
              </div>

              {/* WhatsApp */}
              <div className="link-card-group">
                <div className="link-card-top">
                  <strong>WhatsApp</strong>
                  <label className="switch-label">
                    <input
                      type="checkbox"
                      checked={draft.whatsappEnabled}
                      onChange={(e) =>
                        updateField("whatsappEnabled", e.target.checked)
                      }
                      className="switch-input"
                    />
                    <span>
                      {draft.whatsappEnabled ? "Ativo" : "Desativado"}
                    </span>
                  </label>
                </div>

                <div className="field-group">
                  <label htmlFor="whatsappNumber" className="field-label">
                    <span>Número com DDI</span>
                  </label>
                  <input
                    id="whatsappNumber"
                    type="tel"
                    value={draft.whatsappNumber}
                    onChange={(e) =>
                      updateField("whatsappNumber", e.target.value)
                    }
                    placeholder="5511999999999"
                    aria-invalid={Boolean(fieldErrors.whatsappNumber)}
                    aria-describedby={
                      fieldErrors.whatsappNumber
                        ? "whatsappNumber-error"
                        : "whatsappNumber-hint"
                    }
                    className="input"
                  />
                  <p id="whatsappNumber-hint" className="field-hint">
                    Inclua o código do país (ex.: 55 para Brasil + DDD + número).
                  </p>
                  {fieldErrors.whatsappNumber ? (
                    <p id="whatsappNumber-error" className="field-error">
                      {fieldErrors.whatsappNumber}
                    </p>
                  ) : null}
                </div>

                <div className="field-group">
                  <label htmlFor="whatsappMessage" className="field-label">
                    <span>Mensagem inicial (opcional)</span>
                  </label>
                  <input
                    id="whatsappMessage"
                    type="text"
                    maxLength={200}
                    value={draft.whatsappMessage}
                    onChange={(e) =>
                      updateField("whatsappMessage", e.target.value)
                    }
                    placeholder="Olá! Vim pelo seu LinkIA."
                    className="input"
                  />
                </div>
              </div>

              {/* Instagram */}
              <div className="link-card-group">
                <div className="link-card-top">
                  <strong>Instagram</strong>
                  <label className="switch-label">
                    <input
                      type="checkbox"
                      checked={draft.instagramEnabled}
                      onChange={(e) =>
                        updateField("instagramEnabled", e.target.checked)
                      }
                      className="switch-input"
                    />
                    <span>
                      {draft.instagramEnabled ? "Ativo" : "Desativado"}
                    </span>
                  </label>
                </div>

                <div className="field-group">
                  <label htmlFor="instagramInput" className="field-label">
                    <span>Usuário ou URL do Instagram</span>
                  </label>
                  <input
                    id="instagramInput"
                    type="text"
                    value={draft.instagramInput}
                    onChange={(e) =>
                      updateField("instagramInput", e.target.value)
                    }
                    placeholder="@seuperfil ou https://instagram.com/seuperfil"
                    aria-invalid={Boolean(fieldErrors.instagramInput)}
                    aria-describedby={
                      fieldErrors.instagramInput
                        ? "instagramInput-error"
                        : "instagramInput-hint"
                    }
                    className="input"
                  />
                  <p id="instagramInput-hint" className="field-hint">
                    {resolvedIg
                      ? `Destino: ${resolvedIg}`
                      : "Informe seu @usuário ou o link completo do perfil."}
                  </p>
                  {fieldErrors.instagramInput ? (
                    <p id="instagramInput-error" className="field-error">
                      {fieldErrors.instagramInput}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </GlassSurface>

          {/* Section 3: Aparência */}
          <GlassSurface as="section" intensity="dense">
            <div className="editor-section-inner">
              <div className="editor-section-header">
                <h2 className="editor-section-title">3. Aparência pública</h2>
                <p className="editor-section-desc">
                  Personalize o tema, cores, fonte e formato dos botões da sua
                  página.
                </p>
              </div>

              <div className="field-group">
                <span className="field-label">Temas prontos</span>
                <div className="choice-row">
                  <button
                    type="button"
                    onClick={() => applyThemePreset(DEFAULT_DARK_THEME)}
                    aria-pressed={draft.theme.mode === "dark"}
                    className="choice-btn"
                  >
                    LinkIA Escuro
                  </button>
                  <button
                    type="button"
                    onClick={() => applyThemePreset(DEFAULT_LIGHT_THEME)}
                    aria-pressed={draft.theme.mode === "light"}
                    className="choice-btn"
                  >
                    LinkIA Claro
                  </button>
                </div>
              </div>

              <div className="color-grid">
                <ColorField
                  id="bgColor"
                  label="Cor de fundo"
                  value={draft.theme.bgColor}
                  onChange={(val) => updateTheme("bgColor", val)}
                  error={fieldErrors["theme.bgColor"]}
                />
                <ColorField
                  id="textColor"
                  label="Cor do texto"
                  value={draft.theme.textColor}
                  onChange={(val) => updateTheme("textColor", val)}
                  error={fieldErrors["theme.textColor"]}
                />
                <ColorField
                  id="primaryColor"
                  label="Destaque principal"
                  value={draft.theme.primaryColor}
                  onChange={(val) => updateTheme("primaryColor", val)}
                  error={fieldErrors["theme.primaryColor"]}
                />
                <ColorField
                  id="accentColor"
                  label="Acento dourado"
                  value={draft.theme.accentColor}
                  onChange={(val) => updateTheme("accentColor", val)}
                  error={fieldErrors["theme.accentColor"]}
                />
              </div>

              {lowContrast ? (
                <div role="status" className="alert-banner alert-warning">
                  Contraste baixo entre fundo e texto (
                  {contrastRatio?.toFixed(1)}:1). Recomendamos pelo menos 4.5:1
                  para boa leitura.
                </div>
              ) : null}

              <div className="field-group">
                <span className="field-label">Fonte</span>
                <div className="choice-row">
                  {FONT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={draft.theme.fontFamily === opt.value}
                      onClick={() => updateTheme("fontFamily", opt.value)}
                      className="choice-btn"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <span className="field-label">Estilo dos botões</span>
                <div className="choice-row">
                  {BUTTON_STYLES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={draft.theme.buttonStyle === opt.value}
                      onClick={() => updateTheme("buttonStyle", opt.value)}
                      className="choice-btn"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GlassSurface>
          {/* Section 4: Configurações -> Agendamento (Google Agenda) */}
          <GoogleCalendarPanel
            profileId={draft.id}
            profileSlug={draft.slug}
            hasValidWhatsapp={
              draft.whatsappNumber.replace(/\D/g, "").length >= 10
            }
            onInternalBookingChange={setInternalBookingEnabled}
            saveBookingRef={saveBookingRef}
          />

          {/* Section 5: Catálogo de Serviços e Produtos */}
          <CatalogPanel
            profileId={draft.id}
            onCatalogChange={setCatalogItems}
          />
        </div>

        <ProfilePreview
          draft={draft}
          internalBookingEnabled={internalBookingEnabled}
          catalogItems={catalogItems}
        />
      </div>
    </div>
  );
}
