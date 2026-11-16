"use client";

import { useEffect, useState } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";

export function AdminAiAgentSettings() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/ai-agent", { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => ({})) as { systemPrompt?: string; error?: string };
      if (response.ok) setPrompt(data.systemPrompt || "");
      else setMessage(data.error || "Não foi possível carregar as instruções.");
    }).catch(() => setMessage("Erro de conexão ao carregar as instruções.")).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ai-agent", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemPrompt: prompt }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      setMessage("Instruções salvas. Serão aplicadas às próximas análises.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  }

  return (
    <GlassSurface as="section" intensity="dense">
      <div style={{ padding: 22, display: "grid", gap: 12 }}>
        <div><h2 style={{ margin: 0, fontSize: "1.15rem" }}>Instruções do agente de tráfego</h2><p className="field-hint">Este system prompt é privado e combinado no servidor com a pergunta do usuário e os dados da campanha selecionada.</p></div>
        <label htmlFor="ai-system-prompt" className="field-label">System prompt</label>
        <textarea id="ai-system-prompt" className="input" rows={9} maxLength={12000} value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={loading || saving} placeholder="Defina o papel, limites e formato das análises..." />
        <div className="channel-actions"><button type="button" className="btn btn-primary" onClick={() => void save()} disabled={loading || saving || prompt.trim().length < 20}>{saving ? "Salvando..." : "Salvar instruções"}</button><span className="field-hint">{prompt.length}/12.000</span></div>
        {message ? <p role="status" className="field-hint">{message}</p> : null}
      </div>
    </GlassSurface>
  );
}
