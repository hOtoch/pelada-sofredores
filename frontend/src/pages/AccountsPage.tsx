import { useState, type ChangeEvent, type FormEvent } from "react";

import type { PlayerSummary } from "../domain/types";
import type {
  AccessAccountFormValues,
  AccessAccountSummary,
} from "../features/roster/contracts";
import { themeTokens } from "../theme/tokens";

type AccountsPageProps = {
  accounts: AccessAccountSummary[];
  players: PlayerSummary[];
  isLoading: boolean;
  isSubmitting: boolean;
  canEdit: boolean;
  onCreateAccount: (values: AccessAccountFormValues) => Promise<void> | void;
  onEditAccount: (accountId: string, values: AccessAccountFormValues) => Promise<void> | void;
  onResetAccountPassword: (accountId: string, newPassword: string) => Promise<void> | void;
};

const defaultAccountFormValues: AccessAccountFormValues = {
  username: "",
  email: "",
  displayName: "",
  role: "COMMON",
  isActive: true,
  mustChangePassword: true,
  linkedPlayerId: null,
  password: "",
};

const roleLabels = {
  ADMIN: "Admin",
  COMMON: "Comum",
} as const;

const hasUsernameSpace = (value: string) => /\s/.test(value.trim());

function toAccountFormValues(account: AccessAccountSummary): AccessAccountFormValues {
  return {
    username: account.username,
    email: account.email ?? "",
    displayName: account.displayName ?? "",
    role: account.role,
    isActive: account.isActive,
    mustChangePassword: account.mustChangePassword,
    linkedPlayerId: account.linkedPlayerId ?? null,
    password: "",
  };
}

export function AccountsPage({
  accounts,
  players,
  isLoading,
  isSubmitting,
  canEdit,
  onCreateAccount,
  onEditAccount,
  onResetAccountPassword,
}: AccountsPageProps) {
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<AccessAccountFormValues>(defaultAccountFormValues);
  const [formError, setFormError] = useState<string>();

  const linkedPlayerIds = new Set(
    accounts
      .filter((account) => account.linkedPlayerId && account.id !== editingAccountId)
      .map((account) => account.linkedPlayerId as string),
  );
  const playerOptions = players.filter(
    (player) => player.playerType === "MEMBER" && !linkedPlayerIds.has(player.id),
  );
  const editingAccount = accounts.find((account) => account.id === editingAccountId) ?? null;

  const openCreateModal = () => {
    setEditorMode("create");
    setEditingAccountId(null);
    setFormValues(defaultAccountFormValues);
    setFormError(undefined);
  };

  const openEditModal = (accountId: string) => {
    const account = accounts.find((entry) => entry.id === accountId);
    if (!account) {
      return;
    }

    setEditorMode("edit");
    setEditingAccountId(accountId);
    setFormValues(toAccountFormValues(account));
    setFormError(undefined);
  };

  const closeModal = () => {
    setEditorMode(null);
    setEditingAccountId(null);
    setFormValues(defaultAccountFormValues);
    setFormError(undefined);
  };

  const handleFieldChange =
    (field: keyof AccessAccountFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const rawValue =
        event.target instanceof HTMLInputElement && event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;
      const value = field === "linkedPlayerId" ? (rawValue === "" ? null : String(rawValue)) : rawValue;
      setFormValues((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(undefined);

    if (hasUsernameSpace(formValues.username)) {
      setFormError("O usuario nao pode conter espacos.");
      return;
    }

    const payload: AccessAccountFormValues = {
      ...formValues,
      username: formValues.username.trim(),
      linkedPlayerId: formValues.linkedPlayerId || null,
      password: formValues.password?.trim() ? formValues.password : "",
    };

    if (editorMode === "create") {
      await onCreateAccount(payload);
    } else if (editorMode === "edit" && editingAccountId) {
      await onEditAccount(editingAccountId, payload);
    }

    closeModal();
  };

  const handleResetPassword = async (accountId: string) => {
    const nextPassword = window.prompt("Digite a nova senha temporaria para esta conta:");
    if (!nextPassword || !nextPassword.trim()) {
      return;
    }

    await onResetAccountPassword(accountId, nextPassword.trim());
  };

  return (
    <section className="page-section">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Acessos</p>
          <h2 style={{ fontFamily: themeTokens.fontFamily.heading }}>Contas de acesso</h2>
          <p className="muted">
            {accounts.length > 0 ? `${accounts.length} conta(s) cadastrada(s)` : "Nenhuma conta criada ainda"}
          </p>
        </div>
        {canEdit ? (
          <div className="section-actions">
            <button type="button" className="primary-button" onClick={openCreateModal}>
              Nova conta
            </button>
          </div>
        ) : null}
      </header>

      <div className="glass-card toolbar-card">
        <div>
          <p className="eyebrow">Admin</p>
          <h3>Gestao de contas</h3>
          <p className="muted">
            Crie logins, vincule mensalistas e force troca de senha quando necessario.
          </p>
        </div>
      </div>

      <div className="accounts-grid">
        {isLoading ? (
          <p className="empty-state">Carregando contas...</p>
        ) : accounts.length === 0 ? (
          <p className="empty-state">Nenhuma conta cadastrada ainda. Crie a primeira para liberar o acesso.</p>
        ) : (
          accounts.map((account) => (
            <article key={account.id} className="glass-card account-card">
              <header>
                <div>
                  <h3>{account.displayName || account.username}</h3>
                  <p className="muted">@{account.username}</p>
                </div>
                <span className={`role-chip ${account.role === "ADMIN" ? "admin" : "common"}`}>
                  {roleLabels[account.role]}
                </span>
              </header>
              <div className="account-meta">
                <span>{account.email || "Sem e-mail"}</span>
                <span>{account.linkedPlayerName || "Sem jogador vinculado"}</span>
              </div>
              <div className="account-status-row">
                <span className={`status-chip ${account.isActive ? "paid" : "unpaid"}`}>
                  {account.isActive ? "Ativa" : "Inativa"}
                </span>
                <span className={`status-chip ${account.mustChangePassword ? "partial" : "exempt"}`}>
                  {account.mustChangePassword ? "Troca de senha pendente" : "Senha regular"}
                </span>
              </div>
              {canEdit ? (
                <div className="account-actions">
                  <button type="button" className="ghost-button" onClick={() => openEditModal(account.id)}>
                    Editar conta
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={isSubmitting}
                    onClick={() => void handleResetPassword(account.id)}
                  >
                    Resetar senha
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {editorMode ? (
        <div className="modal-backdrop">
          <div className="modal-card glass-card">
            <div className="ledger-heading">
              <div>
                <p className="eyebrow">Acesso</p>
                <h3>{editorMode === "create" ? "Nova conta" : editingAccount?.username}</h3>
              </div>
              <button type="button" className="ghost-button" onClick={closeModal}>
                Fechar
              </button>
            </div>

            <form className="form-grid compact-grid" onSubmit={handleSubmit}>
              <label>
                Usuário
                <input
                  className="input-field"
                  value={formValues.username}
                  onChange={handleFieldChange("username")}
                  required
                />
              </label>
              <label>
                Nome de exibição
                <input
                  className="input-field"
                  value={formValues.displayName}
                  onChange={handleFieldChange("displayName")}
                  required
                />
              </label>
              <label>
                E-mail
                <input
                  className="input-field"
                  type="email"
                  value={formValues.email}
                  onChange={handleFieldChange("email")}
                  required={editorMode === "create"}
                />
              </label>
              <label>
                Papel
                <select className="input-field" value={formValues.role} onChange={handleFieldChange("role")}>
                  <option value="COMMON">Comum</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <label className="form-span-2">
                Jogador vinculado
                <select
                  className="input-field"
                  value={formValues.linkedPlayerId ?? ""}
                  onChange={handleFieldChange("linkedPlayerId")}
                >
                  <option value="">Sem vinculo</option>
                  {playerOptions.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-span-2">
                {editorMode === "create" ? "Senha inicial" : "Nova senha (opcional)"}
                <input
                  className="input-field"
                  type="password"
                  value={formValues.password}
                  onChange={handleFieldChange("password")}
                  placeholder={editorMode === "create" ? "Defina a senha" : "Preencha para alterar"}
                  required={editorMode === "create"}
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={formValues.isActive}
                  onChange={handleFieldChange("isActive")}
                />
                Conta ativa
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={formValues.mustChangePassword}
                  onChange={handleFieldChange("mustChangePassword")}
                />
                Exigir troca de senha no proximo login
              </label>
              {formError ? <p className="error-text form-span-2">{formError}</p> : null}
              <div className="section-actions form-span-2">
                <button type="button" className="ghost-button" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : editorMode === "create" ? "Criar conta" : "Salvar conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
