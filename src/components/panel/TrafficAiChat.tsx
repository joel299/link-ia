"use client";

import { useEffect, useState, type FormEvent } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { AdsProvider, Profile } from "@/lib/types";

interface TrafficAiChatProps { profile: Profile; provider: AdsProvider; hasActiveCampaigns: boolean; }
interface Message { role: "assistant" | "user"; text: string; }

export function TrafficAiChat({ profile, provider, hasActiveCampaigns }: TrafficAiChatProps) {
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; label: string }>>([]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/ai/codex/status", { cache: "no-store" }).then(async (res) => {
      if (!res.ok) return;
      const status = await res.json() as { connected?: boolean };
      if (cancelled) return;
      setConnected(Boolean(status.connected));
      if (status.connected) {
        const modelResponse = await fetch("/api/ai/codex/models", { cache: "no-store" });
        const data = await modelResponse.json().catch(() => ({})) as { models?: Array<{ id: string; label: string }> };
        if (!cancelled && modelResponse.ok) {
          const available = data.models || [];
          setModels(available);
          setModel((current) => current || available[0]?.id || "");
        }
      }
    });
    return () => { cancelled = true; };
  }, [profile.id]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || !model || loading) return;
    setError("");
    setMessages((current) => [...current, { role: "user", text: question }]);
    setPrompt("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai/codex/analyze", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, provider, prompt: question, model, conversation: messages }),
      });
      const data = await response.json().catch(() => ({})) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "A análise não foi concluída.");
      setMessages((current) => [...current, { role: "assistant", text: data.answer! }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar a IA.");
    } finally { setLoading(false); }
  }

  return (
    <GlassSurface intensity="subtle" className="editor-section">
      <div className="editor-section-inner">
        <h2 className="section-title">Análise com IA</h2>
        <p className="field-hint">Converse sobre as campanhas ativas deste perfil. Os dados são consultados no servidor para a conta selecionada.</p>
        {!connected ? <p className="alert-banner alert-warning">Conecte sua conta ChatGPT na seção IA para habilitar as análises.</p> : null}
        {!hasActiveCampaigns ? <p className="field-hint">Quando houver campanhas ativas carregadas, você poderá pedir uma análise por aqui.</p> : null}
        {messages.length ? <div aria-live="polite" style={{ display: "grid", gap: 10, margin: "16px 0" }}>{messages.map((message, index) => <div key={`${index}-${message.role}`} style={{ justifySelf: message.role === "user" ? "end" : "start", maxWidth: "min(100%, 720px)", whiteSpace: "pre-wrap", padding: "12px 16px", borderRadius: 16, background: message.role === "user" ? "var(--color-primary)" : "var(--color-surface-raised, rgba(255,255,255,.06))" }}>{message.text}</div>)}</div> : null}
        {error ? <p className="alert-banner alert-error" role="alert">{error}</p> : null}
        <form onSubmit={send} style={{ display: "grid", gap: 10 }}>
          <label className="field-label" htmlFor={`ai-model-${profile.id}`}>Modelo da sua conta</label>
          <select id={`ai-model-${profile.id}`} className="input" value={model} onChange={(event) => setModel(event.target.value)} disabled={!connected || models.length === 0}>
            {models.length === 0 ? <option value="">{connected ? "Carregando modelos..." : "Conecte o ChatGPT na seção IA"}</option> : models.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <label className="field-label" htmlFor={`ai-prompt-${profile.id}`}>O que você quer entender?</label>
          <textarea id={`ai-prompt-${profile.id}`} className="input" rows={3} maxLength={4000} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex.: Quais campanhas estão gastando sem gerar cliques?" disabled={!connected || !hasActiveCampaigns || loading} />
          <div className="channel-actions"><button type="submit" className="btn btn-primary" disabled={!connected || !hasActiveCampaigns || !model || !prompt.trim() || loading}>{loading ? "Analisando campanhas..." : "Enviar para análise"}</button></div>
        </form>
      </div>
    </GlassSurface>
  );
}
