"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { AdsProvider, Profile } from "@/lib/types";

interface TrafficAiChatProps { profile: Profile; provider: AdsProvider; hasActiveCampaigns: boolean; }
interface Message { role: "assistant" | "user"; text: string; }
interface AttachmentFile { id: string; name: string; content: string; }
interface PendingAnalysis { question: string; prompt: string; model: string; effort: string; attachments: AttachmentFile[]; failed: boolean; }

const planSteps = [
  "Consultar as campanhas ativas da conta selecionada",
  "Comparar investimento, alcance e resultados",
  "Preparar uma resposta clara com oportunidades e próximos passos",
];
const effortLabels: Record<string, string> = { low: "Baixo", medium: "Médio", high: "Alto", xhigh: "Extra alto", max: "Máximo" };
const defaultEfforts = ["low", "medium", "high", "xhigh"];

export function TrafficAiChat({ profile, provider, hasActiveCampaigns }: TrafficAiChatProps) {
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; label: string; efforts?: string[] }>>([]);
  const [model, setModel] = useState("");
  const [effort, setEffort] = useState("medium");
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<PendingAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const statusResponse = await fetch("/api/ai/codex/status", { cache: "no-store" });
        if (!statusResponse.ok) return;
        const status = await statusResponse.json() as { connected?: boolean };
        if (cancelled) return;
        setConnected(Boolean(status.connected));
        if (!status.connected) return;
        const response = await fetch("/api/ai/codex/models", { cache: "no-store" });
        const data = await response.json().catch(() => ({})) as { models?: Array<{ id: string; label: string; efforts?: string[] }>; error?: string };
        if (!cancelled && response.ok) {
          const available = data.models || [];
          setModels(available);
          setModel((current) => available.some((item) => item.id === current) ? current : available[0]?.id || "");
          if (!available.length && data.error) setError(data.error);
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar a conexão com a IA.");
      }
    })();
    return () => { cancelled = true; };
  }, [profile.id]);

  async function attachFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    const allowed = /\.(txt|md|csv|json)$/i;
    if (attachments.length + selected.length > 3 || selected.some((file) => !allowed.test(file.name) || file.size > 32_000)) {
      setError("Anexe até três arquivos TXT, MD, CSV ou JSON, com no máximo 32 KB cada.");
      return;
    }
    try {
      const loaded = await Promise.all(selected.map(async (file, index) => ({
        id: file.name + "-" + file.lastModified + "-" + index,
        name: file.name,
        content: await file.text(),
      })));
      setAttachments((current) => [...current, ...loaded]);
      setError("");
    } catch {
      setError("Não foi possível ler um dos arquivos anexados.");
    }
  }

  function stageAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || !model || loading || pending || !connected || !hasActiveCampaigns) return;
    const promptWithFiles = question + attachments.map((file) => "\n\nArquivo anexado: " + file.name + "\n" + file.content).join("");
    if (promptWithFiles.length > 4000) {
      setError("A pergunta e os arquivos anexados devem somar até 4.000 caracteres.");
      return;
    }
    setError("");
    setPending({ question, prompt: promptWithFiles, model, effort, attachments, failed: false });
    setPrompt("");
    setAttachments([]);
  }

  async function confirmAnalysis() {
    if (!pending || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/codex/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          provider,
          prompt: pending.prompt,
          model: pending.model,
          effort: pending.effort,
          conversation: messages,
        }),
      });
      const data = await response.json().catch(() => ({})) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "A análise não foi concluída.");
      setMessages((current) => [...current, { role: "user", text: pending.question }, { role: "assistant", text: data.answer! }]);
      setPending(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar a IA.");
      setPending((current) => current ? { ...current, failed: true } : current);
    } finally {
      setLoading(false);
    }
  }

  function cancelPlan() {
    if (!pending || loading) return;
    setPrompt(pending.question);
    setAttachments(pending.attachments);
    setPending(null);
    setError("");
  }

  const selectedEfforts = models.find((item) => item.id === model)?.efforts?.filter((item) => item in effortLabels) || defaultEfforts;
  const canSubmit = connected && hasActiveCampaigns && Boolean(model) && selectedEfforts.includes(effort) && Boolean(prompt.trim()) && !pending && !loading;

  return (
    <GlassSurface intensity="subtle" className="editor-section traffic-ai-chat">
      <div className="editor-section-inner">
        <h2 className="section-title">Análise com IA</h2>
        <p className="field-hint">Converse sobre as campanhas ativas deste perfil. Os dados são consultados no servidor para a conta selecionada.</p>
        {!connected ? <p className="alert-banner alert-warning">Conecte sua conta ChatGPT na seção IA para habilitar as análises.</p> : null}
        {!hasActiveCampaigns ? <p className="field-hint">Quando houver campanhas ativas carregadas, você poderá pedir uma análise por aqui.</p> : null}

        {messages.length > 0 ? (
          <div className="traffic-ai-transcript" aria-live="polite">
            {messages.map((message, index) => <div key={index} className={"traffic-ai-message is-" + message.role}><p>{message.text}</p></div>)}
          </div>
        ) : null}

        {pending ? (
          <div className="traffic-ai-pending" aria-live="polite">
            <div className="traffic-ai-message is-user"><p>{pending.question}</p></div>
            <section className="traffic-ai-plan" aria-labelledby={"ai-plan-title-" + profile.id}>
              <div className="traffic-ai-plan-heading">
                <h3 id={"ai-plan-title-" + profile.id}>Plano da análise</h3>
                <span className={"traffic-ai-plan-status" + (loading ? " is-running" : "")}>{loading ? "Analisando" : pending.failed ? "Falha ao executar" : "Aguardando confirmação"}</span>
              </div>
              <ol>{planSteps.map((step, index) => <li key={step} className={loading ? "is-running" : ""}><span aria-hidden="true">{loading ? "…" : index + 1}</span><span>{step}</span></li>)}</ol>
              <p className="traffic-ai-plan-note">A análise é somente leitura: nenhuma campanha será alterada. Confirme para consultar os dados e gerar a resposta.</p>
              {error ? <p className="alert-banner alert-error" role="alert">{error}</p> : null}
              <div className="traffic-ai-plan-actions">
                <button type="button" className="btn btn-secondary" onClick={cancelPlan} disabled={loading}>Cancelar</button>
                <button type="button" className="btn btn-primary" onClick={() => void confirmAnalysis()} disabled={loading}>{loading ? "Analisando campanhas..." : pending.failed ? "Tentar novamente" : "Confirmar análise"}</button>
              </div>
            </section>
          </div>
        ) : null}
        {!pending && error ? <p className="alert-banner alert-error" role="alert">{error}</p> : null}

        <form className="traffic-ai-composer" onSubmit={stageAnalysis}>
          <input ref={fileInput} type="file" multiple accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json" className="traffic-ai-file-input" tabIndex={-1} onChange={(event) => void attachFiles(event)} />
          {attachments.length > 0 ? <div className="traffic-ai-attachments">{attachments.map((file) => <span className="traffic-ai-attachment" key={file.id}><span className="traffic-ai-attachment-name">{file.name}</span><button type="button" aria-label={"Remover " + file.name} onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))}>×</button></span>)}</div> : null}
          <textarea
            id={"ai-prompt-" + profile.id}
            className="traffic-ai-prompt"
            rows={3}
            maxLength={4000}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ex.: Quais campanhas estão gastando sem gerar cliques?"
            aria-label="O que você quer entender?"
            disabled={!connected || !hasActiveCampaigns || loading || Boolean(pending)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="traffic-ai-composer-footer">
            <button type="button" className="traffic-ai-icon-button" aria-label="Anexar arquivos de texto" title="Anexar arquivos de texto" onClick={() => fileInput.current?.click()} disabled={!connected || loading || Boolean(pending)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <label className="traffic-ai-select-wrap">
              <span className="sr-only">Modelo da sua conta</span>
              <select className="traffic-ai-select" aria-label="Modelo da sua conta" value={model} onChange={(event) => { const nextModel = models.find((item) => item.id === event.target.value); setModel(event.target.value); if (nextModel?.efforts?.length && !nextModel.efforts.includes(effort)) setEffort(nextModel.efforts[0]); }} disabled={!connected || models.length === 0 || loading || Boolean(pending)}>
                {models.length === 0 ? <option value="">{connected ? "Carregando modelos..." : "Conecte o ChatGPT"}</option> : models.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
            </label>
            <label className="traffic-ai-select-wrap traffic-ai-effort">
              <span className="sr-only">Nível de análise</span>
              <select className="traffic-ai-select" aria-label="Nível de análise" value={effort} onChange={(event) => setEffort(event.target.value)} disabled={!connected || models.length === 0 || loading || Boolean(pending)}>
                {selectedEfforts.map((item) => <option key={item} value={item}>Esforço: {effortLabels[item]}</option>)}
              </select>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
            </label>
            <button type="submit" className="traffic-ai-send-button" disabled={!canSubmit} aria-label="Enviar para planejamento" title="Enviar para planejamento">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </div>
          <p className="traffic-ai-composer-hint">Enter prepara o plano; Shift + Enter quebra a linha. Cada análise começa somente após sua confirmação.</p>
        </form>
      </div>
    </GlassSurface>
  );
}
