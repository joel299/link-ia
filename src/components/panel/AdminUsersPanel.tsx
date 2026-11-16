"use client";

import { useEffect, useState, type FormEvent } from "react";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { AdminAiAgentSettings } from "./AdminAiAgentSettings";
import {
  ALL_FEATURE_KEYS,
  FEATURE_CATALOG,
  type AdminUserView,
  type FeatureKey,
  type UserPermissions,
} from "@/lib/types";

interface AdminUsersPanelProps {
  currentUserId: string;
}

function buildEmptyPermissions(): UserPermissions {
  return {
    whatsapp: false,
    instagram: false,
    facebook_social: false,
    meta_ads: false,
    tiktok_organic: false,
    tiktok_ads: false,
    google_calendar: false,
    catalog: false,
  };
}

export function AdminUsersPanel({ currentUserId }: AdminUsersPanelProps) {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create form state (all permissions unchecked by default)
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<"form" | "review">("form");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPermissions, setNewPermissions] = useState<UserPermissions>(
    buildEmptyPermissions
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit user state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<UserPermissions>(
    buildEmptyPermissions
  );
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch("/api/admin/users", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Não foi possível carregar os usuários.");
          return;
        }
        setUsers(Array.isArray(data.users) ? (data.users as AdminUserView[]) : []);
      } catch {
        if (!cancelled) {
          setError("Erro de conexão ao carregar usuários.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetCreateForm() {
    setShowCreate(false);
    setCreateStep("form");
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setShowPassword(false);
    setNewPermissions(buildEmptyPermissions());
    setCreateError(null);
  }

  function handleReviewCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError("Informe o nome do usuário.");
      return;
    }
    if (!newEmail.trim() || !newEmail.includes("@")) {
      setCreateError("Informe um e-mail válido.");
      return;
    }
    if (newPassword.length < 6) {
      setCreateError("A senha inicial deve ter pelo menos 6 caracteres.");
      return;
    }
    setCreateStep("review");
  }

  async function handleConfirmCreate() {
    setCreating(true);
    setCreateError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          isActive: true,
          permissions: newPermissions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) {
        setCreateError(data.error || "Não foi possível criar o usuário.");
        setCreateStep("form");
        return;
      }

      const created = data.user as AdminUserView;
      setUsers((prev) => [created, ...prev]);
      setNotice(`Usuário cliente "${created.name}" (${created.email}) criado com sucesso.`);
      resetCreateForm();
    } catch {
      setCreateError("Erro de conexão ao criar o usuário.");
      setCreateStep("form");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(user: AdminUserView) {
    setEditingUserId(user.id);
    setEditPermissions({ ...user.permissions });
    setEditIsActive(user.isActive);
    setEditError(null);
    setNotice(null);
  }

  async function handleSaveEdit(userId: string) {
    setSavingEdit(true);
    setEditError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isActive: editIsActive,
          permissions: editPermissions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) {
        setEditError(data.error || "Não foi possível salvar as alterações.");
        return;
      }
      const updated = data.user as AdminUserView;
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingUserId(null);
      setNotice(`Permissões de "${updated.name}" atualizadas com sucesso.`);
    } catch {
      setEditError("Erro de conexão ao atualizar usuário.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleQuickToggleActive(user: AdminUserView) {
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) {
        setError(data.error || "Não foi possível alterar o estado da conta.");
        return;
      }
      const updated = data.user as AdminUserView;
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setNotice(
        `Conta "${updated.name}" ${updated.isActive ? "ativada" : "suspensa"}.`
      );
    } catch {
      setError("Erro de conexão ao alterar estado da conta.");
    }
  }

  const enabledKeysInNew = ALL_FEATURE_KEYS.filter((k) => newPermissions[k]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <GlassSurface as="section" intensity="dense">
        <div
          style={{
            padding: "22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
              Administração de usuários e permissões
            </h1>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.92rem",
                color: "var(--color-text-muted)",
              }}
            >
              Crie contas clientes, controle o acesso individual a cada canal e
              suspenda ou reative usuários.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (showCreate) {
                resetCreateForm();
              } else {
                setShowCreate(true);
                setCreateStep("form");
              }
            }}
            className={showCreate ? "btn btn-secondary" : "btn btn-primary"}
          >
            {showCreate ? "Cancelar" : "+ Criar usuário cliente"}
          </button>
        </div>
      </GlassSurface>

      {error ? (
        <div role="alert" className="alert-banner alert-error">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div role="status" className="alert-banner alert-success">
          {notice}
        </div>
      ) : null}

      {showCreate ? (
        <GlassSurface as="section" intensity="dense">
          <div
            style={{
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
              {createStep === "form"
                ? "Novo usuário cliente"
                : "Resumo antes de salvar"}
            </h2>

            {createError ? (
              <div role="alert" className="alert-banner alert-error">
                {createError}
              </div>
            ) : null}

            {createStep === "form" ? (
              <form
                onSubmit={handleReviewCreate}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "14px",
                  }}
                >
                  <div className="field-group">
                    <label htmlFor="admin-new-name" className="field-label">
                      Nome
                    </label>
                    <input
                      id="admin-new-name"
                      type="text"
                      required
                      maxLength={80}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ex.: Clínica Bella"
                      className="input"
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="admin-new-email" className="field-label">
                      E-mail
                    </label>
                    <input
                      id="admin-new-email"
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="cliente@empresa.com"
                      className="input"
                    />
                  </div>

                  <div className="field-group">
                    <label
                      htmlFor="admin-new-password"
                      className="field-label"
                    >
                      Senha temporária (mín. 6 caracteres)
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        id="admin-new-password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Defina uma senha inicial"
                        className="input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="btn btn-secondary"
                        style={{ flexShrink: 0 }}
                      >
                        {showPassword ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <strong style={{ fontSize: "0.95rem" }}>
                    Recursos liberados para este cliente
                  </strong>
                  <p className="field-hint" style={{ margin: 0 }}>
                    Nenhum recurso vem marcado por padrão. Selecione
                    explicitamente o que o cliente poderá acessar.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {FEATURE_CATALOG.map((feature) => (
                      <label
                        key={feature.key}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "12px",
                          borderRadius: "var(--radius-md)",
                          border: newPermissions[feature.key]
                            ? "1px solid var(--color-primary)"
                            : "1px solid var(--color-border)",
                          background: newPermissions[feature.key]
                            ? "var(--color-success-bg)"
                            : "var(--color-surface-subtle)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={newPermissions[feature.key]}
                          onChange={(e) =>
                            setNewPermissions((prev) => ({
                              ...prev,
                              [feature.key]: e.target.checked,
                            }))
                          }
                          style={{ marginTop: "3px" }}
                        />
                        <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <strong style={{ fontSize: "0.9rem" }}>
                            {feature.label}
                          </strong>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            {feature.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={resetCreateForm}
                    className="btn btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Revisar resumo
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div>
                    <strong>Nome:</strong> {newName.trim()}
                  </div>
                  <div>
                    <strong>E-mail:</strong> {newEmail.trim().toLowerCase()}
                  </div>
                  <div>
                    <strong>Papel:</strong> Cliente (acesso padrão ao painel)
                  </div>
                  <div>
                    <strong>Estado inicial:</strong> Ativo
                  </div>
                  <div>
                    <strong>Recursos liberados ({enabledKeysInNew.length}):</strong>{" "}
                    {enabledKeysInNew.length > 0
                      ? enabledKeysInNew
                          .map(
                            (k) =>
                              FEATURE_CATALOG.find((f) => f.key === k)?.label ??
                              k
                          )
                          .join(", ")
                      : "Nenhum recurso adicional liberado (apenas perfil básico e links personalizados)."}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setCreateStep("form")}
                    disabled={creating}
                    className="btn btn-secondary"
                  >
                    Voltar e editar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCreate}
                    disabled={creating}
                    className="btn btn-primary"
                  >
                    {creating ? "Criando..." : "Confirmar e criar usuário"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </GlassSurface>
      ) : null}

      <GlassSurface as="section" intensity="dense">
        <div
          style={{
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
            Usuários cadastrados ({users.length})
          </h2>

          {loading ? (
            <p className="field-hint">Carregando usuários...</p>
          ) : users.length === 0 ? (
            <p className="field-hint">Nenhum usuário encontrado.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {users.map((u) => {
                const isEditing = editingUserId === u.id;
                const enabledLabels = FEATURE_CATALOG.filter(
                  (f) => u.permissions[f.key]
                ).map((f) => f.label);

                return (
                  <div
                    key={u.id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong>{u.name}</strong>
                          <span
                            className={`badge ${
                              u.isActive ? "badge-published" : "badge-draft"
                            }`}
                          >
                            {u.isActive ? "Ativo" : "Suspenso"}
                          </span>
                          <span className="badge badge-draft">
                            {u.role === "admin" ? "Admin" : "Cliente"}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "0.875rem",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {u.email}
                        </p>
                        <div
                          style={{
                            marginTop: "8px",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                          }}
                        >
                          {enabledLabels.length > 0 ? (
                            enabledLabels.map((label) => (
                              <span key={label} className="badge badge-draft">
                                {label}
                              </span>
                            ))
                          ) : (
                            <span className="field-hint">
                              Sem canais/recursos adicionais liberados
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? setEditingUserId(null) : startEdit(u)
                          }
                          className="btn btn-secondary"
                        >
                          {isEditing ? "Fechar" : "Editar permissões"}
                        </button>
                        {u.id !== currentUserId ? (
                          <button
                            type="button"
                            onClick={() => handleQuickToggleActive(u)}
                            className="btn btn-secondary"
                          >
                            {u.isActive ? "Suspender" : "Reativar"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {isEditing ? (
                      <div
                        style={{
                          paddingTop: "12px",
                          borderTop: "1px solid var(--color-border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        {editError ? (
                          <div role="alert" className="alert-banner alert-error">
                            {editError}
                          </div>
                        ) : null}

                        {u.id !== currentUserId ? (
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              cursor: "pointer",
                              fontSize: "0.9rem",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={editIsActive}
                              onChange={(e) =>
                                setEditIsActive(e.target.checked)
                              }
                            />
                            <span>Conta ativa (pode fazer login)</span>
                          </label>
                        ) : null}

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(240px, 1fr))",
                            gap: "8px",
                          }}
                        >
                          {FEATURE_CATALOG.map((feature) => (
                            <label
                              key={feature.key}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "8px",
                                padding: "10px",
                                borderRadius: "var(--radius-sm)",
                                border: editPermissions[feature.key]
                                  ? "1px solid var(--color-primary)"
                                  : "1px solid var(--color-border)",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={editPermissions[feature.key]}
                                onChange={(e) =>
                                  setEditPermissions((prev) => ({
                                    ...prev,
                                    [feature.key as FeatureKey]:
                                      e.target.checked,
                                  }))
                                }
                                style={{ marginTop: "3px" }}
                              />
                              <span style={{ fontSize: "0.875rem" }}>
                                <strong>{feature.label}</strong>
                              </span>
                            </label>
                          ))}
                        </div>

                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => setEditingUserId(null)}
                            disabled={savingEdit}
                            className="btn btn-secondary"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(u.id)}
                            disabled={savingEdit}
                            className="btn btn-primary"
                          >
                            {savingEdit ? "Salvando..." : "Salvar permissões"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GlassSurface>
      <AdminAiAgentSettings />
    </div>
  );
}
