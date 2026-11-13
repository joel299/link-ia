"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  getButtonRadius,
  getContrastTextColor,
  getFontStack,
  isSafeHttpUrl,
} from "./profile-visuals";
import { PublicAvatar } from "./PublicAvatar";
import type {
  AvailableSlot,
  PublicBookingConfirmation,
  PublicCatalogItem,
  PublicProfile,
} from "@/lib/types";

interface PublicBookingViewProps {
  profile: PublicProfile;
  selectedService?: PublicCatalogItem | null;
}

interface RangeAvailabilityResult {
  ok: boolean;
  days: Record<string, AvailableSlot[]>;
  horizonDays?: number;
  timezone?: string;
  serviceName?: string;
  slotDurationMinutes?: number;
  error?: string;
}

const WEEKDAYS_MON_FIRST = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (Brasília)" },
  { value: "America/Fortaleza", label: "America/Fortaleza (Nordeste)" },
  { value: "America/Manaus", label: "America/Manaus (Amazonas)" },
  { value: "America/Belem", label: "America/Belem (Pará)" },
  { value: "America/Cuiaba", label: "America/Cuiaba (Mato Grosso)" },
  { value: "America/New_York", label: "America/New_York (EUA Leste)" },
  { value: "Europe/Lisbon", label: "Europe/Lisbon (Portugal)" },
  { value: "UTC", label: "UTC" },
];

function formatDateIso(year: number, monthZeroBased: number, day: number): string {
  const m = String(monthZeroBased + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function getTodayDateIsoInTz(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback below
  }
  const now = new Date();
  return formatDateIso(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDaysToIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return formatDateIso(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function getMonthRange(year: number, monthZeroBased: number): {
  from: string;
  to: string;
} {
  const daysInMonth = new Date(year, monthZeroBased + 1, 0).getDate();
  return {
    from: formatDateIso(year, monthZeroBased, 1),
    to: formatDateIso(year, monthZeroBased, daysInMonth),
  };
}

function buildCalendarCells(year: number, monthZeroBased: number): Array<{
  iso: string;
  day: number;
  inCurrentMonth: boolean;
}> {
  const firstDay = new Date(year, monthZeroBased, 1);
  // Convert JS getDay() (0=Sun..6=Sat) to Monday-first index (0=Mon..6=Sun)
  const leadingEmpty = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthZeroBased + 1, 0).getDate();

  const cells: Array<{ iso: string; day: number; inCurrentMonth: boolean }> = [];

  const prevMonthDays = new Date(year, monthZeroBased, 0).getDate();
  for (let i = leadingEmpty - 1; i >= 0; i -= 1) {
    const d = prevMonthDays - i;
    const prevDate = new Date(year, monthZeroBased - 1, d);
    cells.push({
      iso: formatDateIso(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate()),
      day: d,
      inCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({
      iso: formatDateIso(year, monthZeroBased, d),
      day: d,
      inCurrentMonth: true,
    });
  }

  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const trailing = 7 - remainder;
    for (let d = 1; d <= trailing; d += 1) {
      const nextDate = new Date(year, monthZeroBased + 1, d);
      cells.push({
        iso: formatDateIso(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()),
        day: d,
        inCurrentMonth: false,
      });
    }
  }

  return cells;
}

function formatSlotTime(
  startIso: string,
  timezone: string,
  format: "12h" | "24h"
): string {
  try {
    return new Intl.DateTimeFormat(format === "12h" ? "en-US" : "pt-BR", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: format === "12h",
    }).format(new Date(startIso));
  } catch {
    return new Date(startIso).toISOString().slice(11, 16);
  }
}

function formatSelectedDateTitle(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dt);
}

function createAttemptIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function fetchMonthAvailability(
  slug: string,
  from: string,
  to: string,
  servicePublicId?: string
): Promise<RangeAvailabilityResult> {
  try {
    const qs = new URLSearchParams({ from, to });
    if (servicePublicId) qs.set("service", servicePublicId);
    const res = await fetch(
      `/api/public/profiles/${encodeURIComponent(slug)}/availability?${qs.toString()}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        days: {},
        error:
          typeof data.error === "string"
            ? data.error
            : "Não foi possível consultar a disponibilidade.",
      };
    }
    return {
      ok: true,
      days:
        data.days && typeof data.days === "object"
          ? (data.days as Record<string, AvailableSlot[]>)
          : {},
      horizonDays:
        typeof data.horizonDays === "number" ? data.horizonDays : undefined,
      timezone: typeof data.timezone === "string" ? data.timezone : undefined,
      serviceName:
        typeof data.serviceName === "string" ? data.serviceName : undefined,
      slotDurationMinutes:
        typeof data.slotDurationMinutes === "number"
          ? data.slotDurationMinutes
          : undefined,
    };
  } catch {
    return {
      ok: false,
      days: {},
      error: "Erro de conexão ao consultar horários disponíveis.",
    };
  }
}

export function PublicBookingView({
  profile,
  selectedService = null,
}: PublicBookingViewProps) {
  const { theme } = profile;
  const isDark = theme.mode === "dark";

  const themeVars = {
    "--pub-bg": isDark ? "#090a0b" : "#f4f6f4",
    "--pub-text": isDark ? "#f2f4f3" : "#141c18",
    "--pub-surface": isDark ? "#121416" : "#ffffff",
    "--pub-border": isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(20, 28, 24, 0.14)",
    "--pub-primary": theme.primaryColor,
    "--pub-on-primary": getContrastTextColor(theme.primaryColor),
    "--pub-accent": theme.accentColor,
    "--pub-font": getFontStack(theme.fontFamily),
    "--pub-radius": getButtonRadius(theme.buttonStyle),
  } as CSSProperties;

  const [profileTimezone, setProfileTimezone] = useState(
    profile.bookingTimezone ?? "America/Sao_Paulo"
  );
  const [displayTimezone, setDisplayTimezone] = useState(
    profile.bookingTimezone ?? "America/Sao_Paulo"
  );
  const [horizonDays, setHorizonDays] = useState(
    profile.bookingHorizonDays ?? 14
  );
  const [serviceName, setServiceName] = useState(
    selectedService?.title ?? profile.bookingServiceName ?? "Atendimento"
  );
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(
    selectedService?.durationMinutes ??
      profile.bookingSlotDurationMinutes ??
      30
  );
  const servicePriceFormatted = useMemo(() => {
    if (!selectedService) return null;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(selectedService.priceCents / 100);
  }, [selectedService]);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("24h");

  const todayIso = useMemo(
    () => getTodayDateIsoInTz(profileTimezone),
    [profileTimezone]
  );
  const maxDateIso = useMemo(
    () => addDaysToIso(todayIso, horizonDays),
    [todayIso, horizonDays]
  );

  const [todayYear, todayMonth] = useMemo(() => {
    const [y, m] = todayIso.split("-").map(Number);
    return [y, m - 1];
  }, [todayIso]);

  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const [daysMap, setDaysMap] = useState<Record<string, AvailableSlot[]>>({});
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [monthError, setMonthError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<PublicBookingConfirmation | null>(null);

  const applyMonthSnapshot = useCallback((snap: RangeAvailabilityResult) => {
    if (!snap.ok) {
      setDaysMap({});
      setMonthError(snap.error ?? "Não foi possível consultar os horários.");
      setLoadingMonth(false);
      return;
    }

    if (snap.horizonDays) setHorizonDays(snap.horizonDays);
    if (snap.timezone) setProfileTimezone(snap.timezone);
    if (snap.serviceName) setServiceName(snap.serviceName);
    if (snap.slotDurationMinutes) {
      setSlotDurationMinutes(snap.slotDurationMinutes);
    }

    setDaysMap(snap.days);
    setMonthError(null);
    setLoadingMonth(false);

    setSelectedDate((current) => {
      if (snap.days[current] && snap.days[current].length > 0) {
        return current;
      }
      const firstAvailable = Object.keys(snap.days)
        .sort()
        .find((d) => (snap.days[d]?.length ?? 0) > 0);
      return firstAvailable ?? current;
    });
  }, []);

  const refreshVisibleMonth = useCallback(
    (slug: string, year: number, month: number) => {
      setLoadingMonth(true);
      setMonthError(null);
      const { from, to } = getMonthRange(year, month);
      void fetchMonthAvailability(
        slug,
        from,
        to,
        selectedService?.publicId
      ).then(applyMonthSnapshot);
    },
    [applyMonthSnapshot, selectedService?.publicId]
  );

  useEffect(() => {
    let active = true;
    const { from, to } = getMonthRange(viewYear, viewMonth);
    void fetchMonthAvailability(
      profile.slug,
      from,
      to,
      selectedService?.publicId
    ).then((snap) => {
      if (active) applyMonthSnapshot(snap);
    });
    return () => {
      active = false;
    };
  }, [
    applyMonthSnapshot,
    profile.slug,
    selectedService?.publicId,
    viewYear,
    viewMonth,
  ]);

  const calendarCells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthTitle = useMemo(() => {
    const dt = new Date(Date.UTC(viewYear, viewMonth, 15, 12, 0, 0));
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }).format(dt);
  }, [viewYear, viewMonth]);

  const canGoPrevMonth =
    viewYear > todayYear || (viewYear === todayYear && viewMonth > todayMonth);

  const nextMonthStartIso = useMemo(() => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    return formatDateIso(next.getFullYear(), next.getMonth(), 1);
  }, [viewYear, viewMonth]);
  const canGoNextMonth = nextMonthStartIso <= maxDateIso;

  function goPrevMonth() {
    if (!canGoPrevMonth) return;
    const prev = new Date(viewYear, viewMonth - 1, 1);
    setLoadingMonth(true);
    setMonthError(null);
    setViewYear(prev.getFullYear());
    setViewMonth(prev.getMonth());
  }

  function goNextMonth() {
    if (!canGoNextMonth) return;
    const next = new Date(viewYear, viewMonth + 1, 1);
    setLoadingMonth(true);
    setMonthError(null);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function handleSelectDay(dateIso: string) {
    setSelectedDate(dateIso);
    setSelectedSlot(null);
    setSubmitError(null);
  }

  function handleSelectSlot(slot: AvailableSlot) {
    setSelectedSlot(slot);
    setIdempotencyKey(createAttemptIdempotencyKey());
    setSubmitError(null);
    setConfirmation(null);
    setModalOpen(true);
  }

  function handleCloseModal() {
    if (submitting) return;
    setModalOpen(false);
    if (confirmation) {
      setConfirmation(null);
      setSelectedSlot(null);
      setClientName("");
      setClientPhone("");
    }
  }

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || submitting) return;

    const trimmedName = clientName.trim();
    const digits = clientPhone.replace(/\D/g, "");
    if (trimmedName.length < 2) {
      setSubmitError("Informe seu nome completo.");
      return;
    }
    if (digits.length < 10 || digits.length > 15) {
      setSubmitError("Informe um telefone/WhatsApp válido com DDD (10 a 15 dígitos).");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const attemptKey = idempotencyKey || createAttemptIdempotencyKey();
      const res = await fetch(
        `/api/public/profiles/${encodeURIComponent(profile.slug)}/bookings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startIso: selectedSlot.startIso,
            clientName: trimmedName,
            clientPhone: digits,
            servicePublicId: selectedService?.publicId,
            idempotencyKey: attemptKey,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(
          typeof data.error === "string"
            ? data.error
            : "Não foi possível concluir o agendamento. Tente outro horário."
        );
        if (res.status === 409) {
          refreshVisibleMonth(profile.slug, viewYear, viewMonth);
        }
        return;
      }

      const confirmed = data.booking as PublicBookingConfirmation;
      setConfirmation(confirmed);
      setModalOpen(false);
      setSelectedSlot(null);
      setClientName("");
      setClientPhone("");
      refreshVisibleMonth(profile.slug, viewYear, viewMonth);

      if (
        isSafeHttpUrl(confirmed.whatsappContactUrl) &&
        typeof window !== "undefined"
      ) {
        window.setTimeout(() => {
          try {
            window.location.assign(confirmed.whatsappContactUrl!);
          } catch {
            // Fallback button "Abrir WhatsApp" remains visible on the page
          }
        }, 150);
      }
    } catch {
      setSubmitError("Erro de conexão ao confirmar agendamento. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const daySlots = daysMap[selectedDate] ?? [];

  const availableTimezones = useMemo(() => {
    const hasProfileTz = TIMEZONE_OPTIONS.some(
      (opt) => opt.value === profileTimezone
    );
    if (hasProfileTz) return TIMEZONE_OPTIONS;
    return [
      { value: profileTimezone, label: profileTimezone },
      ...TIMEZONE_OPTIONS,
    ];
  }, [profileTimezone]);

  return (
    <main className="linkia-cal-page" style={themeVars}>
      {/* Compact profile identity bar */}
      <div className="linkia-cal-topbar">
        <div className="linkia-cal-profile-pill">
          <PublicAvatar
            avatarUrl={profile.avatarUrl}
            displayName={profile.displayName}
          />
          <div>
            <strong style={{ display: "block", fontSize: "0.95rem" }}>
              {profile.displayName}
            </strong>
            <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
              {serviceName}
              {servicePriceFormatted ? ` · ${servicePriceFormatted}` : ""} ·{" "}
              {slotDurationMinutes} min
            </span>
          </div>
        </div>

        <Link
          href={`/${profile.slug}`}
          style={{
            color: "var(--pub-text)",
            fontSize: "0.85rem",
            opacity: 0.8,
            textDecoration: "none",
          }}
        >
          ← Voltar para o perfil
        </Link>
      </div>

      {/* Non-blocking inline confirmation & WhatsApp fallback */}
      {confirmation ? (
        <section
          className="linkia-cal-card"
          role="status"
          aria-live="polite"
          style={{ padding: "22px 24px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
              Agendamento confirmado
            </h2>
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid var(--pub-border)",
                fontSize: "0.9rem",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <span>
                <strong>Serviço:</strong> {confirmation.serviceName}
              </span>
              <span>
                <strong>Profissional:</strong> {confirmation.professionalName}
              </span>
              <span>
                <strong>Data:</strong>{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "long",
                  timeZone: displayTimezone,
                }).format(new Date(confirmation.startIso))}
              </span>
              <span>
                <strong>Horário:</strong>{" "}
                {formatSlotTime(confirmation.startIso, displayTimezone, timeFormat)} (
                {displayTimezone})
              </span>
            </div>

            <p style={{ margin: 0, fontSize: "0.86rem", opacity: 0.82 }}>
              Seu horário foi reservado na agenda. Estamos abrindo o WhatsApp de{" "}
              <strong>{confirmation.professionalName}</strong> para você revisar e
              enviar a mensagem. Se não abrir automaticamente, toque no botão abaixo:
            </p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {isSafeHttpUrl(confirmation.whatsappContactUrl) ? (
                <a
                  href={confirmation.whatsappContactUrl}
                  className="linkia-cal-slot-btn is-selected"
                  style={{
                    flex: "2 1 200px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                  }}
                >
                  Abrir WhatsApp
                </a>
              ) : null}
              <Link
                href={`/${profile.slug}`}
                className="linkia-cal-slot-btn"
                style={{
                  flex: "1 1 160px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                }}
              >
                Voltar para o perfil
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Main reference-inspired scheduling card */}
      <section className="linkia-cal-card" aria-label="Agendamento de horário">
        <header className="linkia-cal-header">
          <h1>Agende seu horário</h1>
          <p>
            Escolha uma data e o melhor horário para {serviceName.toLowerCase()} com{" "}
            {profile.displayName}.
          </p>
        </header>

        <div className="linkia-cal-body">
          {/* Left column: Monthly Calendar */}
          <div className="linkia-cal-left">
            <div className="linkia-cal-month-row">
              <h2 className="linkia-cal-month-title">{monthTitle}</h2>
              <div className="linkia-cal-nav-group">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  disabled={!canGoPrevMonth}
                  aria-label="Mês anterior"
                  className="linkia-cal-nav-btn"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goNextMonth}
                  disabled={!canGoNextMonth}
                  aria-label="Próximo mês"
                  className="linkia-cal-nav-btn"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="linkia-cal-weekdays" aria-hidden="true">
              {WEEKDAYS_MON_FIRST.map((wd) => (
                <span key={wd}>{wd}</span>
              ))}
            </div>

            <div className="linkia-cal-grid" role="grid" aria-label={monthTitle}>
              {calendarCells.map((cell) => {
                const isPastOrOutOfHorizon =
                  !cell.inCurrentMonth ||
                  cell.iso < todayIso ||
                  cell.iso > maxDateIso;
                const cellSlots = daysMap[cell.iso] ?? [];
                const hasSlots = cellSlots.length > 0;
                const isDisabled = isPastOrOutOfHorizon || (!loadingMonth && !hasSlots);
                const isSelected = cell.iso === selectedDate;
                const isToday = cell.iso === todayIso;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectDay(cell.iso)}
                    aria-pressed={isSelected}
                    aria-label={`${cell.day}, ${hasSlots ? `${cellSlots.length} horários disponíveis` : "indisponível"}`}
                    className={`linkia-cal-day ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
                  >
                    <span>{cell.day}</span>
                    {cell.inCurrentMonth && !isPastOrOutOfHorizon && hasSlots ? (
                      <span className="linkia-cal-dot" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right column: Timezone, Date + 12h/24h, Vertical Slots */}
          <div className="linkia-cal-right">
            <div>
              <label
                htmlFor="booking-tz-select"
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  opacity: 0.7,
                  marginBottom: "4px",
                }}
              >
                Fuso horário
              </label>
              <select
                id="booking-tz-select"
                value={displayTimezone}
                onChange={(e) => setDisplayTimezone(e.target.value)}
                className="linkia-cal-tz-select"
              >
                {availableTimezones.map((tz) => (
                  <option key={tz.value} value={tz.value} style={{ color: "#111" }}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="linkia-cal-date-bar">
              <strong style={{ fontSize: "0.95rem", textTransform: "capitalize" }}>
                {formatSelectedDateTitle(selectedDate)}
              </strong>
              <div
                className="linkia-cal-format-toggle"
                role="group"
                aria-label="Formato de hora"
              >
                <button
                  type="button"
                  onClick={() => setTimeFormat("12h")}
                  className={`linkia-cal-format-btn ${timeFormat === "12h" ? "is-active" : ""}`}
                >
                  12h
                </button>
                <button
                  type="button"
                  onClick={() => setTimeFormat("24h")}
                  className={`linkia-cal-format-btn ${timeFormat === "24h" ? "is-active" : ""}`}
                >
                  24h
                </button>
              </div>
            </div>

            {loadingMonth ? (
              <p style={{ margin: "12px 0", fontSize: "0.88rem", opacity: 0.72 }}>
                Consultando horários disponíveis na Google Agenda...
              </p>
            ) : monthError ? (
              <div
                role="alert"
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(239, 68, 68, 0.45)",
                  background: "rgba(239, 68, 68, 0.12)",
                  fontSize: "0.86rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <span>{monthError}</span>
                <button
                  type="button"
                  onClick={() => refreshVisibleMonth(profile.slug, viewYear, viewMonth)}
                  className="linkia-cal-slot-btn"
                >
                  Tentar novamente
                </button>
              </div>
            ) : daySlots.length === 0 ? (
              <p style={{ margin: "12px 0", fontSize: "0.88rem", opacity: 0.72 }}>
                Nenhum horário livre nesta data. Escolha um dia marcado com ponto no
                calendário.
              </p>
            ) : (
              <div className="linkia-cal-slots-list">
                {daySlots.map((slot) => {
                  const isSlotSelected = selectedSlot?.startIso === slot.startIso;
                  return (
                    <button
                      key={slot.startIso}
                      type="button"
                      onClick={() => handleSelectSlot(slot)}
                      aria-pressed={isSlotSelected}
                      className={`linkia-cal-slot-btn ${isSlotSelected ? "is-selected" : ""}`}
                    >
                      {formatSlotTime(slot.startIso, displayTimezone, timeFormat)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Modal for client details & confirmation */}
      {modalOpen && selectedSlot ? (
        <div
          className="linkia-cal-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bookingModalTitle"
        >
          <div className="linkia-cal-modal">
            {confirmation ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <h2 id="bookingModalTitle" style={{ margin: 0, fontSize: "1.2rem" }}>
                  Agendamento confirmado
                </h2>
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--pub-border)",
                    fontSize: "0.9rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <span>
                    <strong>Serviço:</strong> {confirmation.serviceName}
                  </span>
                  <span>
                    <strong>Profissional:</strong> {confirmation.professionalName}
                  </span>
                  <span>
                    <strong>Data:</strong>{" "}
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "long",
                      timeZone: displayTimezone,
                    }).format(new Date(confirmation.startIso))}
                  </span>
                  <span>
                    <strong>Horário:</strong>{" "}
                    {formatSlotTime(confirmation.startIso, displayTimezone, timeFormat)} (
                    {displayTimezone})
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.8 }}>
                  Seu horário foi reservado na agenda. Clique abaixo para abrir o
                  WhatsApp, revisar a mensagem preenchida e enviar ao atendimento.
                </p>

                {isSafeHttpUrl(confirmation.whatsappContactUrl) ? (
                  <a
                    href={confirmation.whatsappContactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="linkia-cal-slot-btn is-selected"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textDecoration: "none",
                    }}
                  >
                    Falar com {confirmation.professionalName} no WhatsApp
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="linkia-cal-slot-btn"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleConfirmBooking}
                style={{ display: "flex", flexDirection: "column", gap: "14px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <h2 id="bookingModalTitle" style={{ margin: 0, fontSize: "1.15rem" }}>
                    Confirmar horário
                  </h2>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={submitting}
                    aria-label="Fechar janela"
                    className="linkia-cal-nav-btn"
                  >
                    ✕
                  </button>
                </div>

                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--pub-border)",
                    fontSize: "0.85rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                  }}
                >
                  <span>
                    <strong>Serviço:</strong> {serviceName} ({slotDurationMinutes} min)
                  </span>
                  <span>
                    <strong>Data e hora:</strong> {formatSelectedDateTitle(selectedDate)} às{" "}
                    {formatSlotTime(selectedSlot.startIso, displayTimezone, timeFormat)}
                  </span>
                  <span>
                    <strong>Fuso:</strong> {displayTimezone}
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="bookingClientName"
                    style={{ display: "block", fontSize: "0.84rem", marginBottom: "5px" }}
                  >
                    Nome completo
                  </label>
                  <input
                    id="bookingClientName"
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Seu nome"
                    className="linkia-cal-tz-select"
                  />
                </div>

                <div>
                  <label
                    htmlFor="bookingClientPhone"
                    style={{ display: "block", fontSize: "0.84rem", marginBottom: "5px" }}
                  >
                    Telefone / WhatsApp
                  </label>
                  <input
                    id="bookingClientPhone"
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="linkia-cal-tz-select"
                  />
                </div>

                {submitError ? (
                  <div
                    role="alert"
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(239, 68, 68, 0.45)",
                      background: "rgba(239, 68, 68, 0.14)",
                      fontSize: "0.84rem",
                    }}
                  >
                    {submitError}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={submitting}
                    className="linkia-cal-slot-btn"
                    style={{ flex: "1 1 110px" }}
                  >
                    Escolher outro
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="linkia-cal-slot-btn is-selected"
                    style={{ flex: "2 1 180px" }}
                  >
                    {submitting ? "Agendando…" : "Confirmar agendamento"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
