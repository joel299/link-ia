import crypto from "node:crypto";
import { Composio } from "@composio/core";
import type { CalendarConnectionStatus } from "./types";

export type ComposioMode = "real" | "mock" | "unconfigured";

export class ComposioConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComposioConfigError";
  }
}

export class ComposioProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComposioProviderError";
  }
}

export interface BusyInterval {
  start: string;
  end: string;
}

export interface CalendarProvider {
  createConnectLink(params: {
    composioUserId: string;
    callbackUrl: string;
    state: string;
    profileId: string;
  }): Promise<{
    connectedAccountId: string;
    redirectUrl: string;
    isMock: boolean;
  }>;

  getConnectionStatus(params: {
    connectedAccountId: string;
    isMock: boolean;
    expectedComposioUserId?: string;
  }): Promise<{
    status: CalendarConnectionStatus;
    accountLabel: string | null;
  }>;

  disconnectAccount(params: {
    connectedAccountId: string;
    isMock: boolean;
  }): Promise<void>;

  queryFreeBusy(params: {
    composioUserId: string;
    connectedAccountId: string;
    calendarId: string;
    timeMin: string;
    timeMax: string;
    timezone: string;
    isMock: boolean;
  }): Promise<BusyInterval[]>;

  createCalendarEvent(params: {
    composioUserId: string;
    connectedAccountId: string;
    calendarId: string;
    startIso: string;
    endIso: string;
    timezone: string;
    summary: string;
    description: string;
    isMock: boolean;
  }): Promise<{ eventId: string }>;
}

/**
 * Derives a deterministic, server-controlled Composio userId isolated per owner and profile.
 */
export function deriveComposioUserId(ownerId: string, profileId: string): string {
  return `linkia_u_${ownerId}_p_${profileId}`;
}

export function getComposioMode(): ComposioMode {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  const authConfigId = process.env.COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID?.trim();
  if (apiKey && authConfigId) {
    return "real";
  }
  if (process.env.COMPOSIO_ALLOW_LOCAL_MOCK === "true") {
    return "mock";
  }
  return "unconfigured";
}

function getComposioClient(): { client: Composio; authConfigId: string } {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  const authConfigId = process.env.COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID?.trim();
  if (!apiKey || !authConfigId) {
    throw new ComposioConfigError(
      "Integração com Google Agenda não configurada no servidor. Defina COMPOSIO_API_KEY e COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID."
    );
  }
  return { client: new Composio({ apiKey }), authConfigId };
}

function mapComposioStatus(rawStatus?: string): CalendarConnectionStatus {
  switch (rawStatus) {
    case "ACTIVE":
      return "connected";
    case "INITIALIZING":
    case "INITIATED":
      return "pending";
    case "EXPIRED":
    case "INACTIVE":
    case "REVOKED":
      return "expired";
    case "FAILED":
      return "failed";
    default:
      return "failed";
  }
}

function extractSafeAccountLabel(account: Record<string, unknown>): string | null {
  const data = account.data;
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (typeof rec.email === "string" && rec.email.includes("@")) {
      return rec.email;
    }
  }
  return "Google Agenda conectada";
}

function extractBusyIntervals(
  data: Record<string, unknown>,
  calendarId: string
): BusyInterval[] {
  const root =
    data.response_data && typeof data.response_data === "object"
      ? (data.response_data as Record<string, unknown>)
      : data;

  const calendars = root.calendars;
  if (!calendars || typeof calendars !== "object") {
    return [];
  }

  const calEntry = (calendars as Record<string, unknown>)[calendarId];
  if (!calEntry || typeof calEntry !== "object") {
    return [];
  }

  const busy = (calEntry as Record<string, unknown>).busy;
  if (!Array.isArray(busy)) {
    return [];
  }

  const result: BusyInterval[] = [];
  for (const item of busy) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).start === "string" &&
      typeof (item as Record<string, unknown>).end === "string"
    ) {
      result.push({
        start: (item as Record<string, unknown>).start as string,
        end: (item as Record<string, unknown>).end as string,
      });
    }
  }
  return result;
}

function extractCreatedEventId(data: Record<string, unknown>): string | null {
  const root =
    data.response_data && typeof data.response_data === "object"
      ? (data.response_data as Record<string, unknown>)
      : data;

  if (typeof root.id === "string" && root.id.trim()) {
    return root.id.trim();
  }
  if (typeof data.id === "string" && data.id.trim()) {
    return data.id.trim();
  }
  return null;
}

export const defaultCalendarProvider: CalendarProvider = {
  async createConnectLink({ composioUserId, callbackUrl, state, profileId }) {
    const mode = getComposioMode();
    if (mode === "unconfigured") {
      throw new ComposioConfigError(
        "Integração com Google Agenda não configurada no servidor."
      );
    }

    if (mode === "mock") {
      const mockId = `mock_conn_${crypto.randomUUID()}`;
      const redirectUrl = `/oauth-mock?state=${encodeURIComponent(state)}&profileId=${encodeURIComponent(profileId)}`;
      return {
        connectedAccountId: mockId,
        redirectUrl,
        isMock: true,
      };
    }

    const { client, authConfigId } = getComposioClient();
    let request;
    try {
      request = await client.connectedAccounts.link(
        composioUserId,
        authConfigId,
        { callbackUrl, allowMultiple: true } as Parameters<
          typeof client.connectedAccounts.link
        >[2]
      );
    } catch (err) {
      throw new ComposioProviderError(
        err instanceof Error
          ? `Falha ao gerar link no Composio: ${err.message}`
          : "Falha ao gerar link no Composio."
      );
    }

    if (!request.redirectUrl) {
      throw new ComposioProviderError(
        "Composio não retornou URL de autorização."
      );
    }

    return {
      connectedAccountId: request.id,
      redirectUrl: request.redirectUrl,
      isMock: false,
    };
  },

  async getConnectionStatus({
    connectedAccountId,
    isMock,
    expectedComposioUserId,
  }) {
    if (isMock) {
      return {
        status: "connected",
        accountLabel: "Agenda Local (Modo Simulação)",
      };
    }

    const { client } = getComposioClient();
    const account = await client.connectedAccounts.get(connectedAccountId);
    const accountRecord = account as unknown as Record<string, unknown>;
    if (
      expectedComposioUserId &&
      typeof accountRecord.userId === "string" &&
      accountRecord.userId !== expectedComposioUserId
    ) {
      throw new ComposioProviderError(
        "A conta conectada não pertence ao perfil autorizado."
      );
    }

    const status = mapComposioStatus(account.status);
    const accountLabel =
      status === "connected"
        ? extractSafeAccountLabel(accountRecord)
        : null;

    return { status, accountLabel };
  },

  async disconnectAccount({ connectedAccountId, isMock }) {
    if (isMock || !connectedAccountId) {
      return;
    }

    const mode = getComposioMode();
    if (mode !== "real") return;

    try {
      const { client } = getComposioClient();
      await client.connectedAccounts.delete(connectedAccountId);
    } catch {
      // Best-effort revocation; local connection is still disconnected.
    }
  },

  async queryFreeBusy({
    composioUserId,
    connectedAccountId,
    calendarId,
    timeMin,
    timeMax,
    timezone,
    isMock,
  }) {
    if (isMock) {
      return [];
    }

    const { client } = getComposioClient();
    const response = await client.tools.execute("GOOGLECALENDAR_FREE_BUSY_QUERY", {
      userId: composioUserId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: {
        timeMin,
        timeMax,
        timeZone: timezone,
        items: [{ id: calendarId || "primary" }],
      },
    });

    if (!response.successful) {
      throw new ComposioProviderError(
        response.error || "Falha ao consultar disponibilidade no Google Agenda."
      );
    }

    return extractBusyIntervals(response.data, calendarId || "primary");
  },

  async createCalendarEvent({
    composioUserId,
    connectedAccountId,
    calendarId,
    startIso,
    endIso,
    timezone,
    summary,
    description,
    isMock,
  }) {
    if (isMock) {
      return { eventId: `mock_evt_${crypto.randomUUID()}` };
    }

    const { client } = getComposioClient();
    const response = await client.tools.execute("GOOGLECALENDAR_CREATE_EVENT", {
      userId: composioUserId,
      connectedAccountId,
      dangerouslySkipVersionCheck: true,
      arguments: {
        calendar_id: calendarId || "primary",
        start_datetime: startIso,
        end_datetime: endIso,
        timezone,
        summary,
        description,
      },
    });

    if (!response.successful) {
      throw new ComposioProviderError(
        response.error || "Falha ao criar evento no Google Agenda."
      );
    }

    const eventId = extractCreatedEventId(response.data);
    if (!eventId) {
      throw new ComposioProviderError(
        "Google Agenda não retornou o identificador do evento criado."
      );
    }

    return { eventId };
  },
};
