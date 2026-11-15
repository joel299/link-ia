import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getSessionUser } from "@/lib/auth";
import {
  completeSocialOAuthCallback,
  SocialProviderError,
} from "@/lib/composio-social";
import type { SocialProvider } from "@/lib/types";

function getRedirectBasePath(provider?: SocialProvider): string {
  if (provider === "meta_ads" || provider === "tiktok_ads") {
    return "/painel/trafego";
  }
  return "/painel";
}

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
  const queryConnectedAccountId = url.searchParams.get("connectedAccountId");

  if (!state) {
    return NextResponse.redirect(
      new URL("/painel?social=invalid_state", appBaseUrl)
    );
  }

  try {
    const result = await completeSocialOAuthCallback({
      state,
      ownerId: user.id,
      queryStatus,
      queryError,
      queryConnectedAccountId,
    });

    const targetPath = getRedirectBasePath(result.provider);
    const redirectUrl = new URL(targetPath, appBaseUrl);
    redirectUrl.searchParams.set("profileId", result.profileId);
    redirectUrl.searchParams.set("provider", result.provider);
    redirectUrl.searchParams.set("social", result.status);
    if (result.error) {
      redirectUrl.searchParams.set("reason", result.error);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    const redirectUrl = new URL("/painel", appBaseUrl);
    redirectUrl.searchParams.set("social", "error");
    if (err instanceof SocialProviderError) {
      redirectUrl.searchParams.set("reason", err.message);
    }
    return NextResponse.redirect(redirectUrl);
  }
}
