export type TrackablePublicEvent =
  | "whatsapp_click"
  | "instagram_click"
  | "booking_click";

export function trackPublicInteraction(
  slug: string,
  eventType: TrackablePublicEvent
): void {
  if (typeof window === "undefined" || !slug) return;
  const endpoint = `/api/public/profiles/${encodeURIComponent(slug)}/events`;
  const payload = JSON.stringify({ eventType });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    }
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never interrupt link navigation if telemetry fails
  }
}
