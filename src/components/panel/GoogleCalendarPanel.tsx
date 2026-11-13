"use client";

import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import {
  DEFAULT_WEEKLY_SCHEDULE,
  type BookingSettings,
  type CalendarConnectionStatus,
  type CalendarConnectionView,
  type WeeklyAvailabilityDay,
} from "@/lib/types";

interface GoogleCalendarPanelProps {
  profileId: string;
  profileSlug: string;
  hasValidWhatsapp: boolean;
  onInternalBookingChange: (enabled: boolean) => void;
  saveBookingRef?: MutableRefObject<(() => Promise<boolean>) | null>;
}

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (Brasília)" },
  { value: "America/Fortaleza", label: "America/Fortaleza (Nordeste)" },
  { value: "America/Manaus", label: "America/Manaus (Amazonas)" },
  { value: "America/New_York", label: "America/New_York (EUA Leste)" },
  { value: "Europe/Lisbon", label: "Europe/Lisbon (Portugal)" },
  { value: "UTC", label: "UTC" },
];

const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const DURATIONS = [15, 30, 45, 60, 90];
const BUFFERS = [0, 10, 15, 30];
const MIN_NOTICES = [
  { value: 0, label: "Sem antecedência" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 1440, label: "24 horas" },
];
const HORIZONS = [7, 14, 30, 60];

const STATUS_META: Record<
  CalendarConnectionStatus,
  { label: string; badgeClass: string; description: string }
> = {
  disconnected: {
    label: "Desconectada",
    badgeClass: "badge-draft",
    description:
      "Conecte sua Google Agenda para consultar horários livres e criar reservas automaticamente.",
  },
  pending: {
    label: "Aguardando autorização",
    badgeClass: "badge-draft",
    description:
      "A autorização foi iniciada, mas ainda não foi concluída no Google.",
  },
  connected: {
    label: "Conectada",
    badgeClass: "badge-published",
    description:
      "Agenda conectada. Configure seus horários abaixo e ative o agendamento público.",
  },
  expired: {
    label: "Expirada ou revogada",
    badgeClass: "badge-error",
    description:
      "O acesso à Google Agenda expirou ou foi revogado. Reconecte para voltar a aceitar reservas.",
  },
  failed: {
    label: "Falha na conexão",
    badgeClass: "badge-error",
    description:
      "Não foi possível confirmar a conexão com o Google. Suas configurações foram preservadas; tente conectar novamente.",
  },
};

function createDefaultSettings(profileId: string): BookingSettings {
  return {
    profileId,
    timezone: "America/Sao_Paulo",
    serviceName: "Consulta / Atendimento",
    slotDurationMinutes: 30,
    bufferMinutes: 10,
    minNoticeMinutes: 60,
    horizonDays: 14,
    enabled: false,
    weeklySchedule: DEFAULT_WEEKLY_SCHEDULE.map((d) => ({ ...d })),
    updatedAt: "",
  };
}

interface CalendarSnapshot {
  connection: CalendarConnectionView | null;
  settings: BookingSettings | null;
  error?: string;
}

async function fetchCalendarSnapshot(profileId: string): Promise<CalendarSnapshot> {
  try {
    const [connRes, setRes] = await Promise.all([
      fetch(`/api/profiles/${profileId}/integrations/google-calendar`, {
        credentials: "include",
      }),
      fetch(`/api/profiles/${profileId}/booking-settings`, {
        credentials: "include",
      }),
    ]);

    if (!connRes.ok && !setRes.ok) {
      return {
        connection: null,
        settings: null,
        error: "Não foi possível carregar as configurações de agenda.",
      };
    }

    const connData = connRes.ok ? await connRes.json().catch(() => ({})) : {};
    const setData = setRes.ok ? await setRes.json().catch(() => ({})) : {};

    return {
      connection: connData.connection ?? null,
      settings: setData.settings ?? null,
    };
  } catch {
    return {
      connection: null,
      settings: null,
      error: "Erro de conexão ao carregar Google Agenda.",
    };
  }
}

export function GoogleCalendarPanel({
  profileId,
  profileSlug,
  hasValidWhatsapp,
  onInternalBookingChange,
  saveBookingRef,
}: GoogleCalendarPanelProps) {
  const [connection, setConnection] = useState<CalendarConnectionView | null>(
    null
  );
  const [settings, setSettings] = useState<BookingSettings>(() =>
    createDefaultSettings(profileId)
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [callbackNotice, setCallbackNotice] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const applySnapshot = useCallback(
    (snap: CalendarSnapshot) => {
      if (snap.error) {
        setLoadError(snap.error);
        setLoading(false);
        return;
      }
      const nextConn = snap.connection;
      const nextSettings = snap.settings ?? createDefaultSettings(profileId);
      setConnection(nextConn);
      setSettings(nextSettings);
      setLoading(false);

      const active =
        nextConn?.status === "connected" && Boolean(nextSettings.enabled);
      onInternalBookingChange(active);

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const calParam = params.get("calendar");
        if (calParam === "connected") {
          if (nextConn?.status === "connected") {
            setCallbackNotice({
              type: "success",
              text: "Google Agenda conectada e confirmada no servidor.",
            });
          } else {
            setCallbackNotice({
              type: "warning",
              text: "Retorno recebido, mas a conexão ainda não está ativa no servidor.",
            });
          }
        } else if (calParam === "cancelled") {
          setCallbackNotice({
            type: "warning",
            text: "Autorização cancelada. Você pode conectar novamente quando quiser.",
          });
        } else if (calParam === "error") {
          setCallbackNotice({
            type: "error",
            text: "Não foi possível concluir a autorização com o Google Agenda.",
          });
        }
      }
    },
    [profileId, onInternalBookingChange]
  );

  useEffect(() => {
    let cancelled = false;
    void fetchCalendarSnapshot(profileId).then((snap) => {
      if (!cancelled) {
        applySnapshot(snap);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profileId, applySnapshot]);

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    void fetchCalendarSnapshot(profileId).then(applySnapshot);
  }

  async function handleConnect() {
    setConnecting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/integrations/google-calendar/connect`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      const targetUrl = data.redirectUrl ?? data.authorizeUrl;
      if (!res.ok || !targetUrl) {
        setActionError(
          data.error || "Não foi possível iniciar a conexão com o Google Agenda."
        );
        setConnecting(false);
        return;
      }
      window.location.assign(targetUrl);
    } catch {
      setActionError("Erro de conexão ao solicitar autorização.");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(
        `/api/profiles/${profileId}/integrations/google-calendar`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Não foi possível desconectar a agenda.");
        setDisconnecting(false);
        return;
      }
      setConnection(
        data.connection ?? {
          provider: "google_calendar",
          status: "disconnected",
          calendarId: "primary",
          accountLabel: null,
          isMock: false,
          lastError: null,
          updatedAt: null,
        }
      );
      setSettings((prev) => ({ ...prev, enabled: false }));
      onInternalBookingChange(false);
      setActionSuccess("Google Agenda desconectada e agendamentos desativados.");
    } catch {
      setActionError("Erro de conexão ao desconectar.");
    } finally {
      setDisconnecting(false);
    }
  }

  function updateDay(dayOfWeek: number, patch: Partial<WeeklyAvailabilityDay>) {
    setSettings((prev) => ({
      ...prev,
      weeklySchedule: prev.weeklySchedule.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day
      ),
    }));
    setActionSuccess(null);
    setActionError(null);
  }

  const persistSettings = useCallback(
    async (targetSettings: BookingSettings): Promise<boolean> => {
      setSavingSettings(true);
      setActionError(null);
      setActionSuccess(null);
      try {
        const res = await fetch(`/api/profiles/${profileId}/booking-settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            timezone: targetSettings.timezone,
            serviceName: targetSettings.serviceName,
            slotDurationMinutes: targetSettings.slotDurationMinutes,
            bufferMinutes: targetSettings.bufferMinutes,
            minNoticeMinutes: targetSettings.minNoticeMinutes,
            horizonDays: targetSettings.horizonDays,
            enabled: targetSettings.enabled,
            weeklySchedule: targetSettings.weeklySchedule,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.settings) {
          setActionError(
            data.error || "Verifique os horários informados antes de salvar."
          );
          setSavingSettings(false);
          return false;
        }
        setSettings(data.settings);
        const active =
          connection?.status === "connected" && Boolean(data.settings.enabled);
        onInternalBookingChange(active);
        setActionSuccess(
          active
            ? "Agendamento público ativado e salvo."
            : "Configurações de agendamento salvas."
        );
        return true;
      } catch {
        setActionError("Erro de conexão ao salvar disponibilidade.");
        return false;
      } finally {
        setSavingSettings(false);
      }
    },
    [profileId, connection, onInternalBookingChange]
  );

  useEffect(() => {
    if (!saveBookingRef) return;
    saveBookingRef.current = () => persistSettings(settings);
    return () => {
      saveBookingRef.current = null;
    };
  }, [saveBookingRef, persistSettings, settings]);

  async function handleSaveSettings() {
    await persistSettings(settings);
  }

  const status: CalendarConnectionStatus = connection?.status ?? "disconnected";
  const meta = STATUS_META[status];
  const isConnected = status === "connected";
  const hasActiveDay = settings.weeklySchedule.some((d) => d.enabled);
  const canActivate = isConnected && hasActiveDay && hasValidWhatsapp;

  return (
    <GlassSurface as="section" intensity="dense">
      <div className="editor-section-inner">
        <div className="editor-section-header">
          <div className="calendar-title-row">
            <span className="calendar-icon-box" aria-hidden="true">
              <GoogleCalendarIcon />
            </span>
            <div>
              <h2 className="editor-section-title">
                Configurações → Agendamento (Google Agenda)
              </h2>
              <p className="editor-section-desc">
                Conecte sua agenda para exibir horários livres e receber reservas
                direto no LinkIA.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="field-hint">Carregando status da Google Agenda...</p>
        ) : loadError ? (
          <div className="alert-banner alert-error" role="alert">
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
        ) : (
          <>
            {callbackNotice ? (
              <div
                role={callbackNotice.type === "error" ? "alert" : "status"}
                className={`alert-banner ${
                  callbackNotice.type === "success"
                    ? "alert-success"
                    : callbackNotice.type === "warning"
                      ? "alert-warning"
                      : "alert-error"
                }`}
              >
                {callbackNotice.text}
              </div>
            ) : null}

            {connection?.isMock ? (
              <div role="status" className="alert-banner alert-warning">
                <strong>Modo Simulação Local:</strong> a integração está usando
                agenda simulada para testes locais (sem gravação no Google real).
              </div>
            ) : null}

            {/* Connection card */}
            <div className="link-card-group">
              <div className="link-card-top" style={{ flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <strong>Google Agenda</strong>
                  <span className={`badge ${meta.badgeClass}`}>
                    {meta.label}
                  </span>
                  {connection?.accountLabel ? (
                    <span className="field-hint">
                      Conta: <strong>{connection.accountLabel}</strong>
                    </span>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {isConnected ? (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="btn btn-secondary"
                    >
                      {disconnecting ? "Desconectando..." : "Desconectar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="btn btn-primary"
                    >
                      {connecting
                        ? "Redirecionando..."
                        : status === "expired" || status === "failed"
                          ? "Reconectar Google Agenda"
                          : "Conectar Google Agenda"}
                    </button>
                  )}
                </div>
              </div>

              <p className="field-hint" style={{ margin: 0 }}>
                {meta.description}
              </p>

              {connection?.lastError ? (
                <p className="field-error" style={{ margin: 0 }}>
                  Último aviso: {connection.lastError}
                </p>
              ) : null}
            </div>

            {actionError ? (
              <div role="alert" className="alert-banner alert-error">
                {actionError}
              </div>
            ) : null}

            {actionSuccess ? (
              <div role="status" className="alert-banner alert-success">
                {actionSuccess}
              </div>
            ) : null}

            {/* Availability settings */}
            <div className="link-card-group">
              <div className="link-card-top">
                <strong>Disponibilidade e regras</strong>
                <label className="switch-label">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    disabled={!canActivate && !settings.enabled}
                    onChange={(e) => {
                      const nextEnabled = e.target.checked;
                      const nextSettings = { ...settings, enabled: nextEnabled };
                      setSettings(nextSettings);
                      onInternalBookingChange(canActivate && nextEnabled);
                      void persistSettings(nextSettings);
                    }}
                    className="switch-input"
                  />
                  <span>Ativar agendamento público</span>
                </label>
              </div>

              {isConnected && profileSlug.trim() ? (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "0.9rem" }}>
                        Link interno de agendamento
                      </strong>
                      <div className="field-hint" style={{ wordBreak: "break-all" }}>
                        <code>
                          {typeof window !== "undefined"
                            ? `${window.location.origin}/${profileSlug}/agendar`
                            : `/${profileSlug}/agendar`}
                        </code>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <a
                        href={`/${profileSlug}/agendar`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ minHeight: "36px", padding: "0 12px" }}
                      >
                        Abrir página
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          const url =
                            typeof window !== "undefined"
                              ? `${window.location.origin}/${profileSlug}/agendar`
                              : `/${profileSlug}/agendar`;
                          try {
                            await navigator.clipboard.writeText(url);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          } catch {
                            setActionError("Não foi possível copiar o link.");
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ minHeight: "36px", padding: "0 12px" }}
                      >
                        {copiedLink ? "Link copiado!" : "Copiar link"}
                      </button>
                    </div>
                  </div>
                  {!settings.enabled ? (
                    <p className="field-hint" style={{ margin: 0 }}>
                      Este link já foi gerado, mas só poderá receber reservas depois de{" "}
                      <strong>ativar o agendamento público</strong> e salvar.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  fontSize: "0.85rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <strong>Pré-requisitos para ativar o agendamento público:</strong>
                <span
                  style={{
                    color: isConnected
                      ? "var(--color-success)"
                      : "var(--color-text-muted)",
                  }}
                >
                  {isConnected ? "✓" : "○"} 1. Google Agenda conectada
                </span>
                <span
                  style={{
                    color: hasActiveDay
                      ? "var(--color-success)"
                      : "var(--color-text-muted)",
                  }}
                >
                  {hasActiveDay ? "✓" : "○"} 2. Ao menos 1 dia/horário ativo
                </span>
                <span
                  style={{
                    color: hasValidWhatsapp
                      ? "var(--color-success)"
                      : "var(--color-text-muted)",
                  }}
                >
                  {hasValidWhatsapp ? "✓" : "○"} 3. WhatsApp válido configurado
                  no perfil (mínimo 10 dígitos)
                </span>
              </div>

              <div className="field-group">
                <label htmlFor="booking-service-name" className="field-label">
                  Nome do serviço
                </label>
                <input
                  id="booking-service-name"
                  type="text"
                  maxLength={80}
                  value={settings.serviceName ?? ""}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      serviceName: e.target.value,
                    }))
                  }
                  placeholder="Consulta / Atendimento"
                  className="input"
                />
              </div>

              <div className="calendar-settings-grid">
                <div className="field-group">
                  <label htmlFor="booking-timezone" className="field-label">
                    Fuso horário (IANA)
                  </label>
                  <select
                    id="booking-timezone"
                    value={settings.timezone}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        timezone: e.target.value,
                      }))
                    }
                    className="select"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="booking-duration" className="field-label">
                    Duração do atendimento
                  </label>
                  <select
                    id="booking-duration"
                    value={settings.slotDurationMinutes}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        slotDurationMinutes: Number(e.target.value),
                      }))
                    }
                    className="select"
                  >
                    {DURATIONS.map((min) => (
                      <option key={min} value={min}>
                        {min} minutos
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="booking-buffer" className="field-label">
                    Pausa entre atendimentos
                  </label>
                  <select
                    id="booking-buffer"
                    value={settings.bufferMinutes}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        bufferMinutes: Number(e.target.value),
                      }))
                    }
                    className="select"
                  >
                    {BUFFERS.map((min) => (
                      <option key={min} value={min}>
                        {min === 0 ? "Sem pausa" : `${min} minutos`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="booking-notice" className="field-label">
                    Antecedência mínima
                  </label>
                  <select
                    id="booking-notice"
                    value={settings.minNoticeMinutes}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        minNoticeMinutes: Number(e.target.value),
                      }))
                    }
                    className="select"
                  >
                    {MIN_NOTICES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="booking-horizon" className="field-label">
                    Horizonte de agenda
                  </label>
                  <select
                    id="booking-horizon"
                    value={settings.horizonDays}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        horizonDays: Number(e.target.value),
                      }))
                    }
                    className="select"
                  >
                    {HORIZONS.map((days) => (
                      <option key={days} value={days}>
                        Próximos {days} dias
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-group">
                <span className="field-label">Dias e horários de atendimento</span>
                <div className="weekly-schedule-list">
                  {settings.weeklySchedule.map((day) => (
                    <div key={day.dayOfWeek} className="weekly-day-row">
                      <label className="switch-label" style={{ minWidth: "150px" }}>
                        <input
                          type="checkbox"
                          checked={day.enabled}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, { enabled: e.target.checked })
                          }
                          className="switch-input"
                        />
                        <span>{WEEKDAY_LABELS[day.dayOfWeek]}</span>
                      </label>

                      <div className="weekly-day-times">
                        <input
                          type="time"
                          aria-label={`Início em ${WEEKDAY_LABELS[day.dayOfWeek]}`}
                          value={day.startTime}
                          disabled={!day.enabled}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, {
                              startTime: e.target.value,
                            })
                          }
                          className="input"
                        />
                        <span className="field-hint">até</span>
                        <input
                          type="time"
                          aria-label={`Fim em ${WEEKDAY_LABELS[day.dayOfWeek]}`}
                          value={day.endTime}
                          disabled={!day.enabled}
                          onChange={(e) =>
                            updateDay(day.dayOfWeek, { endTime: e.target.value })
                          }
                          className="input"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="btn btn-primary"
                >
                  {savingSettings
                    ? "Salvando agenda..."
                    : "Salvar disponibilidade"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </GlassSurface>
  );
}

function GoogleCalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="3"
        fill="var(--color-surface)"
        stroke="var(--color-primary)"
        strokeWidth="1.75"
      />
      <path d="M3 9H21" stroke="var(--color-primary)" strokeWidth="1.75" />
      <path
        d="M8 2.5V5.5M16 2.5V5.5"
        stroke="var(--color-accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect x="7.5" y="12" width="3.5" height="3.5" rx="0.8" fill="var(--color-primary)" />
      <rect x="13" y="12" width="3.5" height="3.5" rx="0.8" fill="var(--color-accent)" />
    </svg>
  );
}
