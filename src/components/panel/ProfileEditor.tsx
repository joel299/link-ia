"use client";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  buildPreviewWhatsappUrl,
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
  type PublicBlockKey,
  type PublicCustomLinkItem,
  type UserPermissions,
  type ValidationErrors,
} from "@/lib/types";
import { AvatarUploader } from "./AvatarUploader";
import { ColorField } from "./ColorField";
import { CoverUploader } from "./CoverUploader";
import { ProfilePreview } from "./ProfilePreview";
import {
  ProfileSectionsNav,
  type ProfileSectionItem,
} from "./ProfileSectionsNav";
import { PublishStatus, type SaveState } from "./PublishStatus";
import { SectionShell } from "./SectionShell";
import { SectionSkeleton } from "./SectionSkeleton";

const ConnectedChannelsPanel = dynamic(
  () =>
    import("./ConnectedChannelsPanel").then((mod) => mod.ConnectedChannelsPanel),
  {
    ssr: false,
    loading: () => (
      <SectionSkeleton
        variant="channels"
        label="Carregando canais conectados"
      />
    ),
  }
);

const GoogleCalendarPanel = dynamic(
  () =>
    import("./GoogleCalendarPanel").then((mod) => mod.GoogleCalendarPanel),
  {
    ssr: false,
    loading: () => (
      <SectionSkeleton
        variant="schedule"
        label="Carregando configurações de agendamento"
      />
    ),
  }
);

const CatalogPanel = dynamic(
  () => import("./CatalogPanel").then((mod) => mod.CatalogPanel),
  {
    ssr: false,
    loading: () => (
      <SectionShell title="Serviços e Produtos" description="Catálogo do perfil.">
        <SectionSkeleton variant="catalog" label="Carregando serviços e produtos" />
      </SectionShell>
    ),
  }
);

const CustomLinksPanel = dynamic(
  () => import("./CustomLinksPanel").then((mod) => mod.CustomLinksPanel),
  {
    ssr: false,
    loading: () => (
      <SectionSkeleton variant="generic" rows={3} label="Carregando links" />
    ),
  }
);

interface ProfileEditorProps {
  profile: Profile;
  permissions?: UserPermissions;
  sectionNavTarget: HTMLElement | null;
  onProfileUpdated: (updated: Profile) => void;
  onProfileDeleted?: (deletedId: string) => void;
}

interface SlugCheckState {
  status: "idle" | "checking" | "available" | "unavailable" | "error";
  message?: string;
  suggestion?: string;
  normalized?: string;
}

type SectionKey =
  | "identidade"
  | "canais"
  | "aparencia"
  | "agendamento"
  | "servicos";

const ALL_SECTIONS: ProfileSectionItem[] = [
  {
    key: "identidade",
    label: "Identidade",
    description: "Nome, bio, foto e capa",
  },
  {
    key: "canais",
    label: "Canais conectados",
    description: "WhatsApp, Instagram, TikTok e Facebook",
  },
  {
    key: "aparencia",
    label: "Aparência pública",
    description: "Tema, cores, fonte e botões",
  },
  {
    key: "agendamento",
    label: "Agendamento",
    description: "Google Agenda e horários",
  },
  {
    key: "servicos",
    label: "Serviços e Produtos",
    description: "Catálogo exibido no perfil",
  },
];

const SECTION_KEYS = new Set<string>(ALL_SECTIONS.map((item) => item.key));

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
  permissions,
  sectionNavTarget,
  onProfileUpdated,
  onProfileDeleted,
}: ProfileEditorProps) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [activeSection, setActiveSection] = useState<SectionKey>("identidade");
  const [pendingSection, setPendingSection] = useState<SectionKey | null>(null);
  const [switchingSection, setSwitchingSection] = useState(false);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<string | null>(
    null
  );
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [slugCheck, setSlugCheck] = useState<SlugCheckState>({ status: "idle" });
  const [internalBookingEnabled, setInternalBookingEnabled] = useState(false);
  const [bookingDirty, setBookingDirty] = useState(false);
  const [catalogItems, setCatalogItems] = useState<
    import("@/lib/types").PublicCatalogItem[]
  >([]);
  const [customLinks, setCustomLinks] = useState<PublicCustomLinkItem[]>([]);
  const slugTimerRef = useRef<number | null>(null);
  const saveBookingRef = useRef<(() => Promise<boolean>) | null>(null);
  const baselineRef = useRef<Profile>(profile);

  // Keep the section in the URL hash without adding history entries, so page
  // refresh keeps the section and the back button still leaves the editor.
  // The state update is deferred one tick to avoid a hydration mismatch
  // between the server-rendered section and the hashed one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!SECTION_KEYS.has(hash)) return;
    const timer = window.setTimeout(() => {
      setActiveSection(hash as SectionKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleSections = ALL_SECTIONS.filter((section) => {
    if (!permissions) return true;
    if (section.key === "canais") {
      return Boolean(
        permissions.whatsapp ||
          permissions.instagram ||
          permissions.tiktok_organic ||
          permissions.facebook_social
      );
    }
    if (section.key === "agendamento") return Boolean(permissions.google_calendar);
    if (section.key === "servicos") return Boolean(permissions.catalog);
    return true;
  });

  const effectiveSection: SectionKey = visibleSections.some(
    (section) => section.key === activeSection
  )
    ? activeSection
    : "identidade";

  function goToSection(section: SectionKey) {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.hash = section;
      window.history.replaceState({}, "", url.toString());
    }
  }

  function hasUnsavedChanges() {
    return saveState === "dirty" || bookingDirty;
  }

  // Warn before a hard navigation (refresh/close) discards unsaved edits.
  useEffect(() => {
    if (saveState !== "dirty" && !bookingDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveState, bookingDirty]);

  function requestSectionChange(nextKey: string) {
    if (!SECTION_KEYS.has(nextKey)) return;
    const next = nextKey as SectionKey;
    if (next === effectiveSection) return;
    if (hasUnsavedChanges()) {
      setPendingSection(next);
      return;
    }
    goToSection(next);
  }

  function handleDiscardAndSwitch() {
    const target = pendingSection;
    setPendingSection(null);
    setDraft(baselineRef.current);
    setFieldErrors({});
    setSlugCheck({ status: "idle" });
    setSaveState("idle");
    setBannerError(null);
    setBannerSuccess(null);
    setBookingDirty(false);
    if (target) goToSection(target);
  }

  async function handleSaveAndSwitch() {
    const target = pendingSection;
    if (!target) return;
    setSwitchingSection(true);
    const saved = await saveProfile();
    setSwitchingSection(false);
    if (saved) {
      setPendingSection(null);
      goToSection(target);
    }
  }

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
      coverUrl: draft.coverUrl,
      coverBlur: draft.coverBlur,
      instagramInput: draft.instagramInput,
      instagramEnabled: draft.instagramEnabled,
      whatsappNumber: draft.whatsappNumber,
      whatsappMessage: draft.whatsappMessage,
      whatsappEnabled: draft.whatsappEnabled,
      bookingUrl: draft.bookingUrl,
      bookingLabel: draft.bookingLabel,
      bookingEnabled: draft.bookingEnabled,
      publicOrder: draft.publicOrder,
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
      baselineRef.current = data.profile;
      onProfileUpdated(data.profile);
      if (saveBookingRef.current) {
        const bookingOk = await saveBookingRef.current();
        if (!bookingOk) {
          setSaveState("error");
          setBannerError(
            "Perfil salvo, mas revise as configurações de agendamento."
          );
          return null;
        }
        setBookingDirty(false);
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
      baselineRef.current = data.profile;
      onProfileUpdated(data.profile);
      setSaveState("saved");
      setBannerSuccess(`Perfil publicado em /${data.profile.slug}`);
    } catch {
      setBannerError("Erro de conexão ao publicar perfil.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleUnpublish() {
    setIsUnpublishing(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await fetch(`/api/profiles/${draft.id}/publish`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.profile) {
        setBannerError(
          data.error || "Não foi possível despublicar o perfil."
        );
        return;
      }
      setDraft(data.profile);
      baselineRef.current = data.profile;
      onProfileUpdated(data.profile);
      setDeleteConfirmOpen(false);
      setBannerSuccess(
        `Perfil "${data.profile.displayName || data.profile.slug}" voltou para rascunho. A página pública /${data.profile.slug} foi desativada.`
      );
    } catch {
      setBannerError("Erro de conexão ao despublicar perfil.");
    } finally {
      setIsUnpublishing(false);
    }
  }

  function handleRequestDelete() {
    setBannerError(null);
    setBannerSuccess(null);
    setDeleteConfirmMessage(null);
    setDeleteConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setBannerError(null);
    setBannerSuccess(null);
    try {
      const res = await fetch(`/api/profiles/${draft.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          confirmPublished: draft.status === "published",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.deleted) {
        setDeleteConfirmMessage(
          data.error || "Não foi possível excluir este perfil."
        );
        return;
      }
      setDeleteConfirmOpen(false);
      onProfileDeleted?.(draft.id);
    } catch {
      setDeleteConfirmMessage("Erro de conexão ao excluir perfil.");
    } finally {
      setIsDeleting(false);
    }
  }

  const contrastRatio = getContrastRatio(
    draft.theme.bgColor,
    draft.theme.textColor
  );
  const lowContrast = contrastRatio !== null && contrastRatio < 4.5;
  const currentSectionLabel =
    ALL_SECTIONS.find((section) => section.key === effectiveSection)?.label ??
    "Identidade";
  const pendingSectionLabel = pendingSection
    ? (ALL_SECTIONS.find((section) => section.key === pendingSection)?.label ??
      "a próxima seção")
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <PublishStatus
        profileName={draft.displayName}
        status={draft.status}
        slug={draft.slug}
        saveState={saveState}
        isPublishing={isPublishing}
        isUnpublishing={isUnpublishing}
        isDeleting={isDeleting}
        onSave={saveProfile}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onRequestDelete={handleRequestDelete}
      />

      {sectionNavTarget
        ? createPortal(
            <ProfileSectionsNav
              sections={visibleSections}
              activeKey={effectiveSection}
              onSelect={requestSectionChange}
            />,
            sectionNavTarget
          )
        : null}

      {pendingSection ? (
        <GlassSurface as="section" intensity="dense">
          <div
            role="alertdialog"
            aria-label="Alterações não salvas"
            className="unsaved-switch"
          >
            <div>
              <strong>Alterações não salvas</strong>
              <p className="field-hint">
                Você alterou <strong>{currentSectionLabel}</strong> e ainda não
                salvou. Salvar antes de abrir{" "}
                <strong>{pendingSectionLabel}</strong>?
              </p>
            </div>
            <div className="channel-actions">
              <button
                type="button"
                onClick={handleSaveAndSwitch}
                disabled={switchingSection}
                className="btn btn-primary"
                autoFocus
              >
                {switchingSection ? "Salvando..." : "Salvar e continuar"}
              </button>
              <button
                type="button"
                onClick={handleDiscardAndSwitch}
                disabled={switchingSection}
                className="btn btn-secondary"
              >
                Descartar e continuar
              </button>
              <button
                type="button"
                onClick={() => setPendingSection(null)}
                disabled={switchingSection}
                className="btn btn-ghost"
              >
                Cancelar
              </button>
            </div>
          </div>
        </GlassSurface>
      ) : null}

      {deleteConfirmOpen ? (
        <GlassSurface as="section" intensity="dense">
          <div
            role="alertdialog"
            aria-label="Confirmar exclusão de perfil"
            style={{
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              border: "1px solid var(--color-danger)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <strong style={{ color: "var(--color-danger)" }}>
              Excluir perfil &ldquo;{draft.displayName || draft.slug}&rdquo;?
            </strong>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
              {draft.status === "published"
                ? `Este perfil está publicado em /${draft.slug}. Ao excluir permanentemente, o link público deixará de funcionar e os vínculos de agenda, canais e catálogo deste perfil serão removidos. Se quiser apenas tirar do ar sem apagar os dados, escolha "Despublicar".`
                : `Este rascunho (/${draft.slug}) será removido permanentemente do seu painel.`}
            </p>
            {deleteConfirmMessage ? (
              <div role="alert" className="alert-banner alert-error">
                {deleteConfirmMessage}
              </div>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="btn btn-secondary"
                style={{
                  borderColor: "var(--color-danger)",
                  color: "var(--color-danger)",
                }}
              >
                {isDeleting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
              {draft.status === "published" ? (
                <button
                  type="button"
                  onClick={handleUnpublish}
                  disabled={isUnpublishing || isDeleting}
                  className="btn btn-secondary"
                >
                  {isUnpublishing ? "Despublicando..." : "Despublicar (manter rascunho)"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmMessage(null);
                }}
                disabled={isDeleting}
                className="btn btn-secondary"
                autoFocus
              >
                Cancelar
              </button>
            </div>
          </div>
        </GlassSurface>
      ) : null}

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
            minHeight: "44px",
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
            minHeight: "44px",
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
          {effectiveSection === "identidade" ? (
            <SectionShell
              id="secao-identidade"
              title="Identidade"
              description="Nome público, endereço, bio, foto de perfil e capa."
            >
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
                <div className="slug-input-row">
                  <span className="slug-prefix" aria-hidden="true">
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
                          className="slug-suggestion"
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

              <CoverUploader
                coverUrl={draft.coverUrl}
                coverBlur={draft.coverBlur}
                displayName={draft.displayName}
                onChange={(url) => updateField("coverUrl", url)}
                onBlurChange={(value) => updateField("coverBlur", value)}
                error={fieldErrors.coverUrl ?? fieldErrors.coverBlur}
              />

              <div className="settings-divider" role="presentation" />

              <CustomLinksPanel
                profileId={draft.id}
                onLinksChange={setCustomLinks}
              />
            </SectionShell>
          ) : null}

          {effectiveSection === "canais" ? (
            <SectionShell
              id="secao-canais"
              title="Canais conectados"
              description="Cada card mostra o estado real da conexão. Abra um canal para conectar, reconectar ou ajustar."
            >
              <ConnectedChannelsPanel
                key={`${draft.id}-canais`}
                profileId={draft.id}
                permissions={permissions}
                whatsappEnabled={draft.whatsappEnabled}
                whatsappNumber={draft.whatsappNumber}
                whatsappMessage={draft.whatsappMessage}
                instagramEnabled={draft.instagramEnabled}
                instagramInput={draft.instagramInput}
                fieldErrors={fieldErrors}
                onFieldChange={updateField}
              />
            </SectionShell>
          ) : null}

          {effectiveSection === "aparencia" ? (
            <SectionShell
              id="secao-aparencia"
              title="Aparência pública"
              description="Tema, cores, fonte e formato dos botões da sua página."
            >
              <div className="settings-block">
                <h3 className="settings-subtitle">Tema</h3>
                <p className="field-hint">
                  Escolha uma base clara ou escura. Você pode ajustar as cores
                  em seguida.
                </p>
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

              <div className="settings-block">
                <h3 className="settings-subtitle">Cores</h3>
                <p className="field-hint">
                  Fundo, texto, destaque principal e acento dourado.
                </p>
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
              </div>

              <div className="settings-block">
                <h3 className="settings-subtitle">Tipografia</h3>
                <p className="field-hint">Fonte usada nos textos da página.</p>
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

              <div className="settings-block">
                <h3 className="settings-subtitle">Botões</h3>
                <p className="field-hint">Formato dos botões de ação.</p>
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
            </SectionShell>
          ) : null}

          {effectiveSection === "agendamento" ? (
            <SectionShell
              id="secao-agendamento"
              title="Agendamento"
              description="Google Agenda, disponibilidade e link público de reservas."
            >
              {!permissions || permissions.google_calendar ? (
                <GoogleCalendarPanel
                  key={`${draft.id}-agendamento`}
                  profileId={draft.id}
                  profileSlug={draft.slug}
                  hasValidWhatsapp={
                    buildPreviewWhatsappUrl(
                      draft.whatsappNumber,
                      draft.whatsappMessage
                    ) !== null
                  }
                  onInternalBookingChange={setInternalBookingEnabled}
                  onDirtyChange={setBookingDirty}
                  saveBookingRef={saveBookingRef}
                />
              ) : (
                <p className="field-hint">
                  O agendamento não está liberado para esta conta.
                </p>
              )}
            </SectionShell>
          ) : null}

          {effectiveSection === "servicos" ? (
            !permissions || permissions.catalog ? (
              <CatalogPanel
                key={`${draft.id}-servicos`}
                profileId={draft.id}
                onCatalogChange={setCatalogItems}
              />
            ) : (
              <SectionShell
                id="secao-servicos"
                title="Serviços e Produtos"
                description="Catálogo exibido no perfil."
              >
                <p className="field-hint">
                  Serviços e Produtos não está liberado para esta conta.
                </p>
              </SectionShell>
            )
          ) : null}
        </div>

        <ProfilePreview
          draft={draft}
          permissions={permissions}
          internalBookingEnabled={
            (!permissions || permissions.google_calendar) &&
            internalBookingEnabled
          }
          catalogItems={
            !permissions || permissions.catalog ? catalogItems : []
          }
          customLinks={customLinks}
          unsaved={saveState === "dirty" || bookingDirty}
          onPublicOrderChange={(order: PublicBlockKey[]) =>
            updateField("publicOrder", order)
          }
        />
      </div>
    </div>
  );
}
