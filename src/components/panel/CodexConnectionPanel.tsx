"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination */

import { useEffect, useState } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";

interface Status { connected: boolean; email: string | null; name: string | null; configured: boolean; }

export function CodexConnectionPanel() {
  const [status, setStatus] = useState<Status>({ connected: false, email: null, name: null, configured: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/ai/codex/status", { cache: "no-store" }).then(async (response) => {
      if (response.ok) setStatus(await response.json() as Status);
    });
    const url = new URL(window.location.href);
    const result = url.searchParams.get("codex");
    if (result) {
      const statusMessage = result === "connected" ? "Conta ChatGPT conectada." : result === "cancelled" ? "Conexão cancelada." : "Não foi possível concluir. Verifique as configurações e tente novamente.";
      void Promise.resolve().then(() => setMessage(statusMessage));
      url.searchParams.delete("codex");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function disconnect() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/codex/status", { method: "DELETE" });
      if (!response.ok) throw new Error("Não foi possível remover a conexão.");
      setStatus({ connected: false, email: null, name: null, configured: status.configured });
      setMessage("Conta desconectada do LinkIA.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível desconectar.");
    } finally { setBusy(false); }
  }

  return (
    <GlassSurface intensity="subtle" className="editor-section">
      <div className="editor-section-inner">
        <div className="traffic-header-row">
          <div>
            <h2 className="section-title">Conexão com ChatGPT</h2>
            <p className="field-hint">Conecte sua própria conta. As análises usam a autorização e os limites do seu plano.</p>
          </div>
          <span className={`badge ${status.connected ? "badge-published" : "badge-draft"}`}>{status.connected ? "Conectado" : "Desconectado"}</span>
        </div>
        {status.connected ? <p className="field-hint">{status.name || "Conta conectada"}{status.email ? ` · ${status.email}` : ""}</p> : null}
        {!status.configured ? <p className="alert-banner alert-warning">Conexão ainda não configurada pelo administrador. O ambiente precisa receber o client OAuth aprovado e a chave de criptografia.</p> : null}
        {message ? <p className="field-hint" role="status">{message}</p> : null}
        <div className="channel-actions">
          {status.connected ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void disconnect()}>{busy ? "Desconectando..." : "Desconectar conta"}</button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={!status.configured} data-oai-siwc-button onClick={() => window.location.assign("/api/ai/codex/connect")}>Conectar conta ChatGPT / Codex</button>
          )}
        </div>
        <p className="field-hint">A conta Codex/ChatGPT conectada pertence somente ao seu usuário LinkIA. O LinkIA não recebe sua senha.</p>
      </div>
    </GlassSurface>
  );
}
