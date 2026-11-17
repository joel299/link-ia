"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiTokenScope } from "@/lib/api-tokens";
import type { UserPermissions } from "@/lib/types";

type TokenView = {
  id: string;
  label: string;
  scopes: ApiTokenScope[];
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const scopeOptions: Array<{ key: ApiTokenScope; label: string; risk?: string }> = [
  { key: "profiles:read", label: "Ver perfis" },
  { key: "profiles:write", label: "Editar perfis" },
  { key: "profiles:publish", label: "Publicar e despublicar perfis", risk: "Muda o que está visível ao público." },
  { key: "profiles:delete", label: "Excluir perfis", risk: "A exclusão remove um perfil." },
  { key: "links:read", label: "Ver links" },
  { key: "links:write", label: "Criar, editar e excluir links" },
  { key: "catalog:read", label: "Ver serviços e produtos" },
  { key: "catalog:write", label: "Editar serviços e produtos" },
  { key: "ads:read", label: "Ver campanhas e resultados de anúncios" },
  { key: "ads:sync", label: "Atualizar dados de anúncios" },
  { key: "ads:draft", label: "Preparar rascunhos de campanha" },
  { key: "ads:confirm", label: "Confirmar campanhas", risk: "Pode ativar anúncios e gerar gastos." },
  { key: "ads:manage", label: "Gerenciar configurações de anúncios" },
  { key: "social:read", label: "Ver contas e publicações sociais" },
  { key: "social:sync", label: "Atualizar dados das redes sociais" },
  { key: "social:manage", label: "Editar ou desconectar contas sociais" },
  { key: "whatsapp:read", label: "Ver conexão do WhatsApp" },
  { key: "whatsapp:manage", label: "Conectar ou desconectar WhatsApp" },
  { key: "calendar:read", label: "Ver configurações da agenda" },
  { key: "calendar:manage", label: "Editar ou desconectar a agenda" },
  { key: "booking:create", label: "Criar agendamentos", risk: "Cria uma reserva real e pode enviar dados ao calendário." },
  { key: "public:read", label: "Consultar páginas públicas" },
  { key: "legal:read", label: "Consultar aceite de termos" },
  { key: "legal:write", label: "Registrar aceite de termos" },
];

function enabledByUser(scope: ApiTokenScope, p: UserPermissions): boolean {
  if (scope.startsWith("ads:")) return p.meta_ads || p.tiktok_ads;
  if (scope.startsWith("social:")) return p.instagram || p.facebook_social || p.tiktok_organic;
  if (scope.startsWith("whatsapp:")) return p.whatsapp;
  if (scope.startsWith("calendar:") || scope === "booking:create") return p.google_calendar;
  if (scope.startsWith("catalog:")) return p.catalog;
  return true;
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

function buildMcpClientConfig(mcpUrl: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        linkia: {
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2
  );
}

function friendlyApiError(status: number, code?: unknown): string {
  if (code === "API_JWT_SECRET_INVALID") {
    return "Não foi possível gerar o acesso agora. Tente novamente mais tarde. Se o problema continuar, fale com o suporte.";
  }
  if (status === 400) return "Confira as informações e permissões selecionadas e tente novamente.";
  if (status === 403) return "A conta selecionada não tem acesso a uma ou mais permissões. Revise as opções e tente novamente.";
  if (status === 404) return "Não encontramos essa conta. Atualize a página e tente novamente.";
  if (status === 429) return "Muitas tentativas foram feitas em pouco tempo. Aguarde um minuto e tente novamente.";
  return "Não foi possível concluir agora. Tente novamente em alguns minutos. Se o problema continuar, fale com o suporte.";
}

export function AdminApiTokensPanel({
  userId,
  userName,
  permissions,
}: {
  userId: string;
  userName: string;
  permissions: UserPermissions;
}) {
  const [tokens, setTokens] = useState<TokenView[]>([]);
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(30);
  const [scopes, setScopes] = useState<ApiTokenScope[]>(["profiles:read", "public:read"]);
  const [oneTimeToken, setOneTimeToken] = useState("");
  const [issuedMcpUrl, setIssuedMcpUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    const response = await fetch(`/api/admin/users/${userId}/api-tokens`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(friendlyApiError(response.status, data.code));
    setTokens(Array.isArray(data.tokens) ? (data.tokens as TokenView[]) : []);
    setMcpUrl(typeof data.mcpUrl === "string" ? data.mcpUrl : null);
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload().catch(() =>
        setError("Não foi possível carregar os acessos agora. Atualize a página e tente novamente.")
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  async function createToken() {
    setBusy(true);
    setError("");
    setNotice("");
    setOneTimeToken("");
    setIssuedMcpUrl(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/api-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, expiresInDays: days, scopes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(friendlyApiError(response.status, data.code));
        return;
      }
      setOneTimeToken(data.token as string);
      setIssuedMcpUrl(typeof data.mcpUrl === "string" ? data.mcpUrl : mcpUrl);
      setLabel("");
      setNotice("Token criado. Copie e guarde agora; ele não será exibido novamente.");
      await reload();
    } catch {
      setError("Não foi possível gerar o acesso agora. Confira sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(tokenId: string) {
    if (!window.confirm("Revogar este token? Agentes que o usam perderão o acesso imediatamente.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${userId}/api-tokens/${tokenId}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(friendlyApiError(response.status, data.code));
        return;
      }
      setNotice("Token revogado.");
      await reload();
    } catch {
      setError("Não foi possível atualizar os acessos agora. Confira sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setError("");
      setNotice(successMessage);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o valor e copie manualmente.");
    }
  }

  const effectiveMcpUrl = issuedMcpUrl || mcpUrl;
  const readyConfig =
    oneTimeToken && effectiveMcpUrl ? buildMcpClientConfig(effectiveMcpUrl, oneTimeToken) : "";

  return (
    <section className="editor-section" aria-labelledby={`api-tokens-${userId}`} style={{ marginTop: 18 }}>
      <h3 id={`api-tokens-${userId}`} style={{ marginTop: 0 }}>
        Acesso da API e MCP para {userName}
      </h3>
      <p className="field-hint">
        Gere um token Bearer para conectar clientes MCP ou automações externas (como n8n). O acesso respeita somente as permissões selecionadas abaixo e os recursos liberados para esta conta.
      </p>

      {effectiveMcpUrl ? (
        <div style={{ marginBlock: 12 }}>
          <label className="field-label" htmlFor={`mcp-url-${userId}`}>
            URL do servidor MCP
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              id={`mcp-url-${userId}`}
              className="input"
              readOnly
              value={effectiveMcpUrl}
              style={{ flex: "1 1 280px", fontFamily: "monospace" }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void copyText(effectiveMcpUrl, "URL MCP copiada.")}
            >
              Copiar URL
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="alert-banner alert-error" role="alert">
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {notice ? (
        <p className="alert-banner alert-success" role="status">
          {notice}
        </p>
      ) : null}

      {oneTimeToken ? (
        <div
          className="editor-section"
          style={{
            marginBlock: 12,
            padding: 14,
            border: "1px solid var(--color-primary)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <label className="field-label" htmlFor={`token-${userId}`}>
            Token Bearer — exibido somente agora
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              id={`token-${userId}`}
              className="input"
              readOnly
              value={oneTimeToken}
              autoComplete="off"
              style={{ flex: "1 1 280px", fontFamily: "monospace" }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void copyText(oneTimeToken, "Token Bearer copiado.")}
            >
              Copiar token
            </button>
          </div>

          {readyConfig ? (
            <div style={{ marginTop: 14 }}>
              <label className="field-label" htmlFor={`mcp-config-${userId}`}>
                Configuração pronta para copiar (MCP / Streamable HTTP)
              </label>
              <textarea
                id={`mcp-config-${userId}`}
                className="input"
                readOnly
                rows={10}
                value={readyConfig}
                style={{ fontFamily: "monospace", fontSize: "0.82rem", width: "100%" }}
              />
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void copyText(readyConfig, "Configuração MCP copiada.")}
                >
                  Copiar configuração
                </button>
              </div>
            </div>
          ) : null}

          <div className="field-hint" style={{ marginTop: 12 }}>
            <strong>Como conectar, testar e rotacionar:</strong>
            <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li>
                No cliente MCP ou n8n, informe a URL MCP acima e o cabeçalho{" "}
                <code>Authorization: Bearer &lt;token&gt;</code>.
              </li>
              <li>
                Teste a conexão executando a inicialização MCP (<code>initialize</code>) ou listando ferramentas (<code>tools/list</code>).
              </li>
              <li>
                Para rotacionar ou cancelar o acesso, revogue este token na lista abaixo e gere um novo. Não cole o token em código-fonte ou conversas.
              </li>
            </ol>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        <label>
          <span className="field-label">Nome do acesso</span>
          <input
            className="input"
            value={label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: agente de análise"
          />
        </label>
        <label>
          <span className="field-label">Validade</span>
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={180}>180 dias</option>
            <option value={365}>1 ano</option>
          </select>
        </label>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: "16px 0" }}>
        <legend className="field-label">O que o agente pode fazer</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 8 }}>
          {scopeOptions.map((option) => {
            const enabled = enabledByUser(option.key, permissions);
            return (
              <label
                key={option.key}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  padding: 10,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  opacity: enabled ? 1 : 0.55,
                }}
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(option.key)}
                  disabled={!enabled}
                  onChange={(e) =>
                    setScopes((current) =>
                      e.target.checked
                        ? [...current, option.key]
                        : current.filter((item) => item !== option.key)
                    )
                  }
                />
                <span>
                  {option.label}
                  {option.risk ? (
                    <small style={{ display: "block", color: "var(--color-text-muted)" }}>
                      {option.risk}
                    </small>
                  ) : null}
                  {!enabled ? (
                    <small style={{ display: "block", color: "var(--color-text-muted)" }}>
                      Recurso não liberado para este usuário
                    </small>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !label.trim() || scopes.length === 0}
        onClick={() => void createToken()}
      >
        {busy ? "Processando…" : "Gerar token"}
      </button>

      <h4>Tokens já criados</h4>
      {tokens.length ? (
        <ul style={{ paddingLeft: 20 }}>
          {tokens.map((token) => (
            <li key={token.id} style={{ marginBlock: 10 }}>
              <strong>{token.label}</strong> — vence em {formatDate(token.expiresAt)};{" "}
              {token.revokedAt ? "revogado" : "ativo"}
              {token.lastUsedAt
                ? `; usado em ${formatDate(token.lastUsedAt)}`
                : "; ainda não usado"}
              {!token.revokedAt ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => void revoke(token.id)}
                  >
                    Revogar
                  </button>
                </>
              ) : null}
              <div className="field-hint">
                Permissões:{" "}
                {token.scopes
                  .map((s) => scopeOptions.find((option) => option.key === s)?.label || s)
                  .join(", ")}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">Nenhum token criado.</p>
      )}
    </section>
  );
}
