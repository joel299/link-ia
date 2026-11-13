import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getSessionUser } from "@/lib/auth";
import { completeCalendarOAuthCallback, SchedulingError } from "@/lib/scheduling";

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
      new URL("/painel?calendar=invalid_state", appBaseUrl)
    );
  }

  try {
    const result = await completeCalendarOAuthCallback({
      state,
      ownerId: user.id,
      queryStatus,
      queryError,
      queryConnectedAccountId,
    });

    return NextResponse.redirect(
      new URL(
        `/painel?profileId=${encodeURIComponent(result.profileId)}&calendar=${encodeURIComponent(result.status)}`,
        appBaseUrl
      )
    );
  } catch (err) {
    if (err instanceof SchedulingError) {
      return NextResponse.redirect(
        new URL(
          `/painel?calendar=error&reason=${encodeURIComponent(err.message)}`,
          appBaseUrl
        )
      );
    }
    return NextResponse.redirect(
      new URL("/painel?calendar=error", appBaseUrl)
    );
  }
}
