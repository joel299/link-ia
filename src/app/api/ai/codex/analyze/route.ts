import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildCampaignAnalysisPrompt, getAdminSystemPrompt, runCodexAnalysis, type CodexEffort } from "@/lib/codex-ai";
import { AdsServiceError, getAdsOverviewForOwner, isAdsProvider } from "@/lib/ads-service";
import { adsProviderToFeatureKey, requireUserFeature } from "@/lib/permissions";
import { getProfileByIdForOwner } from "@/lib/profiles";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const profileId = typeof input.profileId === "string" ? input.profileId : "";
  const provider = input.provider;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 4000) : "";
  const model = typeof input.model === "string" ? input.model : "";
  const effort = typeof input.effort === "string" ? input.effort : "medium";
  const conversation = Array.isArray(input.conversation)
    ? input.conversation.slice(-8).flatMap((message) => {
        if (!message || typeof message !== "object" || Array.isArray(message)) return [];
        const item = message as Record<string, unknown>;
        if ((item.role !== "user" && item.role !== "assistant") || typeof item.text !== "string") return [];
        return [{ role: item.role as "user" | "assistant", content: item.text.slice(0, 3000) }];
      })
    : [];
  if (!profileId || !prompt || prompt.length < 3 || typeof provider !== "string" || !isAdsProvider(provider)) return NextResponse.json({ error: "Informe a conta e a pergunta para análise." }, { status: 400 });
  const denied = await requireUserFeature(user.id, adsProviderToFeatureKey(provider));
  if (denied) return denied;
  try {
    const profileResult = getProfileByIdForOwner(profileId, user.id);
    if (!profileResult.profile) return NextResponse.json({ error: "Perfil não encontrado." }, { status: profileResult.error === "forbidden" ? 403 : 404 });
    const profile = profileResult.profile;
    const overview = await getAdsOverviewForOwner({ profileId, ownerId: user.id, provider });
    const campaigns = overview.campaigns.filter((campaign) => campaign.status.toUpperCase() === "ACTIVE").map((campaign) => ({
      name: campaign.name, status: campaign.status, objective: campaign.objective, dailyBudget: campaign.dailyBudget,
      spend: campaign.spend, impressions: campaign.impressions, clicks: campaign.clicks, reach: campaign.reach,
      ctr: campaign.ctr, cpc: campaign.cpc, cpm: campaign.cpm,
    }));
    const account = overview.connection.selectedAdAccountName || overview.connection.accountLabel;
    if (!campaigns.length) return NextResponse.json({ error: "Não há campanhas ativas carregadas para este perfil e provedor." }, { status: 409 });
    const analysisPrompt = buildCampaignAnalysisPrompt({
      systemPrompt: getAdminSystemPrompt(), profileName: profile.displayName, provider,
      account: account || "não informada", campaigns, conversation, prompt,
    });
    const answer = await runCodexAnalysis({ ownerId: user.id, model, effort: effort as CodexEffort, prompt: analysisPrompt });
    return NextResponse.json({ answer }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof AdsServiceError ? error.message : error instanceof Error ? error.message : "Não foi possível analisar as campanhas.";
    console.error("[Codex analyze] Falha na análise", {
      source: error instanceof AdsServiceError ? "ads-service" : "analysis",
      errorName: error instanceof Error ? error.name : "UnknownError",
      status: error instanceof AdsServiceError ? error.status : 502,
    });
    return NextResponse.json({ error: message }, { status: error instanceof AdsServiceError ? error.status : 502, headers: { "Cache-Control": "no-store" } });
  }
}
