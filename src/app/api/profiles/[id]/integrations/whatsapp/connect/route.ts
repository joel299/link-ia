import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getSessionUser } from "@/lib/auth";
import { getProfileByIdForOwner } from "@/lib/profiles";
import {
  finalizeWhatsAppEmbeddedSignup,
  getWhatsAppConnectionView,
  initiateWhatsAppConnection,
  ZernioConfigError,
  ZernioProviderError,
} from "@/lib/zernio-whatsapp";

interface ConnectBody {
  action?: "initiate" | "embedded_signup" | "select_phone_number";
  onboardingMode?: "business_app" | "api";
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const check = getProfileByIdForOwner(id, user.id);
  if (check.error === "not_found") {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 404 });
  }
  if (check.error === "forbidden" || !check.profile) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  let body: ConnectBody = {};
  try {
    const raw = await request.text();
    if (raw.trim()) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as ConnectBody;
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Corpo JSON inválido." },
      { status: 400 }
    );
  }

  try {
    if (
      body.action === "embedded_signup" ||
      body.action === "select_phone_number"
    ) {
      const connection = await finalizeWhatsAppEmbeddedSignup({
        profileId: check.profile.id,
        ownerId: user.id,
        action: body.action,
        code: typeof body.code === "string" ? body.code : undefined,
        wabaId: typeof body.wabaId === "string" ? body.wabaId : undefined,
        phoneNumberId:
          typeof body.phoneNumberId === "string"
            ? body.phoneNumberId
            : undefined,
        businessId:
          typeof body.businessId === "string" ? body.businessId : undefined,
      });
      return NextResponse.json({ connection });
    }

    const onboardingMode =
      body.onboardingMode === "api" ? "api" : "business_app";

    const result = await initiateWhatsAppConnection({
      profileId: check.profile.id,
      ownerId: user.id,
      origin: getAppBaseUrl(request.url).origin,
      onboardingMode,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZernioConfigError) {
      return NextResponse.json(
        {
          error: err.message,
          configReady: false,
          configRequirements: err.requirements,
          connection: getWhatsAppConnectionView(check.profile.id),
        },
        { status: 503 }
      );
    }
    if (err instanceof ZernioProviderError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      { error: "Não foi possível iniciar a conexão com o WhatsApp Business." },
      { status: 500 }
    );
  }
}
