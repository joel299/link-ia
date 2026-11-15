import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getSessionUser } from "@/lib/auth";
import {
  completeWhatsAppCallback,
  WhatsAppCallbackError,
} from "@/lib/zernio-whatsapp";

export async function GET(request: Request) {
  const appBaseUrl = getAppBaseUrl(request.url);
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", appBaseUrl));
  }

  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const queryStatus =
    url.searchParams.get("status") ?? url.searchParams.get("mock_status");
  const queryError = url.searchParams.get("error");
  const queryErrorCode =
    url.searchParams.get("error_code") ?? url.searchParams.get("errorCode");
  const queryReason =
    url.searchParams.get("reason") ?? url.searchParams.get("error_description");
  const queryAccountId =
    url.searchParams.get("accountId") ?? url.searchParams.get("account_id");
  const queryMigrationStatus =
    url.searchParams.get("migrationStatus") ??
    url.searchParams.get("migration_status");

  if (!state) {
    return NextResponse.redirect(
      new URL("/painel?whatsapp=invalid_state", appBaseUrl)
    );
  }

  try {
    const result = await completeWhatsAppCallback({
      state,
      ownerId: user.id,
      queryStatus,
      queryError,
      queryErrorCode,
      queryReason,
      queryAccountId,
      queryMigrationStatus,
    });

    return NextResponse.redirect(
      new URL(
        `/painel?profileId=${encodeURIComponent(result.profileId)}&whatsapp=${encodeURIComponent(result.status)}`,
        appBaseUrl
      )
    );
  } catch (err) {
    if (err instanceof WhatsAppCallbackError) {
      return NextResponse.redirect(
        new URL(
          `/painel?whatsapp=${encodeURIComponent(err.code)}&reason=${encodeURIComponent(err.message)}`,
          appBaseUrl
        )
      );
    }

    return NextResponse.redirect(
      new URL("/painel?whatsapp=failed", appBaseUrl)
    );
  }
}
