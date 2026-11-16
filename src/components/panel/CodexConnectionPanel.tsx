"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";

type Connection = {
  connected: boolean;
  status: "connected" | "pending" | "disconnected";
  verificationUrl: string | null;
  userCode: string | null;
  connectedAt: string | null;
};
const initial: Connection = { connected: false, status: "disconnected", verificationUrl: null, userCode: null, connectedAt: null };

export function CodexConnectionPanel() {
  const [status, setStatus] = useState<Connection>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/ai/codex/status", { cache: "no-store" });
    if (response.ok) setStatus(await response.json() as Connection);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (status.status !== "pending") return;
    const timer = window.setInterval(() => { void refresh(); }, 3000);
    return () => window.clearInterval(timer);
  }, [status.status, refresh]);

  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/codex/connect", { method: "POST" });
      const data = await response.json().catch(() => ({})) as Partial<Connection> & { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar o login do Codex.");
      setStatus({ ...initial, status: "pending", verificationUrl: data.verificationUrl || null, userCode: data.userCode || null });
      setMessage("O Codex iniciou o login. Se o código ainda não apareceu, aguarde alguns segundos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar a conexão.");
    } finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/codex/status", { method: "DELETE" });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível remover a conexão.");
      setStatus(initial);
      setMessage("Conta desconectada do LinkIA.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível desconectar.");
    } finally { setBusy(false); }
  }

  async function copyCode() {
    if (!status.userCode) return;
    try { await navigator.clipboard.writeText(status.userCode); setMessage("Código copiado."); }
    catch { setMessage("Não foi possível copiar automaticamente. Selecione e copie o código exibido."); }
  }

  return (
    <GlassSurface intensity="subtle" className="editor-section">
      <div className="editor-section-inner">
        <div className="traffic-header-row">
          <div>
            <h2 className="section-title">Conexão com Codex</h2>
            <p className="field-hint">Conecte sua conta pessoal usando o código temporário do Codex.</p>
          </div>
          <span className={`badge ${status.connected ? "badge-published" : "badge-draft"}`}>{status.connected ? "Conectado" : status.status === "pending" ? "Aguardando autorização" : "Desconectado"}</span>
        </div>
        {status.connected ? <p className="field-hint">Sua conta Codex está conectada neste perfil LinkIA.</p> : null}
        {status.status === "pending" ? (
          <div className="editor-section" style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <p className="field-hint">Abra a página oficial da OpenAI, informe o código abaixo e conclua o login da sua conta.</p>
            {status.verificationUrl ? <a className="btn btn-secondary" href={status.verificationUrl} target="_blank" rel="noreferrer">Abrir autenticação oficial</a> : <p className="field-hint">Gerando o endereço e o código de autenticação…</p>}
            {status.userCode ? <div><label className="field-label" htmlFor="codex-device-code">Código temporário</label><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><input id="codex-device-code" className="input" readOnly value={status.userCode} style={{ maxWidth: 240, fontFamily: "monospace", letterSpacing: ".12em" }} /><button type="button" className="btn btn-secondary" onClick={() => void copyCode()}>Copiar código</button></div></div> : <p className="field-hint" role="status">Aguardando o Codex gerar o código…</p>}
            <p className="field-hint" role="status">Depois de autorizar, esta tela reconhecerá a conexão automaticamente.</p>
          </div>
        ) : null}
        {message ? <p className="field-hint" role="status">{message}</p> : null}
        <div className="channel-actions">
          {status.connected ? <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void disconnect()}>{busy ? "Desconectando…" : "Desconectar conta"}</button> : status.status !== "pending" ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void connect()}>{busy ? "Iniciando Codex…" : "Conectar conta ChatGPT / Codex"}</button> : <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void disconnect()}>{busy ? "Cancelando…" : "Cancelar conexão"}</button>}
        </div>
        <p className="field-hint">Cada usuário LinkIA mantém uma sessão Codex isolada. O LinkIA não recebe sua senha.</p>
      </div>
    </GlassSurface>
  );
}
