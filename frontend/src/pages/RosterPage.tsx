import { useState, type ChangeEvent, type FormEvent } from "react";

import type { PlayerSummary } from "../domain/types";
import type {
  AccessAccountFormValues,
  AccessAccountSummary,
  PlayerFilterState,
  PlayerFormValues,
  RosterManagementPageProps,
} from "../features/roster/contracts";
import { themeTokens } from "../theme/tokens";

const defaultFormValues: PlayerFormValues = {
  fullName: "",
  nickname: "",
  preferredPosition: "UNIVERSAL",
  monthlyFeeAmount: 120,
  shirtNumber: null,
  email: "",
  phoneNumber: "",
  joinedOn: "",
  isActive: true,
  notes: "",
  ratings: {
    overall: 70,
  },
};

const positionOptions = ["ALL", "GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD", "UNIVERSAL"] as const;

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

const positionLabels: Record<(typeof positionOptions)[number], string> = {
  ALL: "Todas",
  GOALKEEPER: "Goleiro",
  DEFENDER: "Defensor",
  MIDFIELDER: "Meio-campo",
  FORWARD: "Atacante",
  UNIVERSAL: "Coringa",
};

const RatingBar = ({ label, value }: { label: string; value: number }) => (
  <div className="rating-bar">
    <span>{label}</span>
    <div className="rating-track">
      <div className="rating-value" style={{ width: `${(value / 99) * 100}%` }} />
    </div>
    <strong>{value}</strong>
  </div>
);

function clampRating(value: number) {
  return Math.max(0, Math.min(99, Math.round(value)));
}

function toFormValues(player: PlayerSummary): PlayerFormValues {
  return {
    fullName: player.fullName,
    nickname: player.nickname ?? "",
    preferredPosition: player.preferredPosition,
    monthlyFeeAmount: player.monthlyFeeAmount,
    shirtNumber: player.shirtNumber ?? null,
    email: player.email ?? "",
    phoneNumber: player.phoneNumber ?? "",
    joinedOn: player.joinedOn ?? "",
    isActive: player.isActive,
    notes: player.notes ?? "",
    ratings: player.ratings,
  };
}

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

export function RosterPage({
  players,
  allPlayers,
  accounts = [],
  filters,
  isLoading,
  isSubmitting,
  isSubmittingAccount = false,
  canEdit,
  onEditPlayer,
  onCreatePlayer,
  onFilterChange,
  onTogglePlayerStatus,
  onCreateAccount,
  onEditAccount,
  onResetAccountPassword,
}: RosterManagementPageProps) {
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<PlayerFormValues>(defaultFormValues);
  const [accountEditorMode, setAccountEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountFormValues, setAccountFormValues] = useState<AccessAccountFormValues>(
    defaultAccountFormValues,
  );

  const editingPlayer = players.find((player) => player.id === editingPlayerId) ?? null;
  const editingAccount = accounts.find((account) => account.id === editingAccountId) ?? null;
  const canManageAccounts = canEdit && (Boolean(onCreateAccount) || Boolean(onEditAccount));
  const shouldShowAccounts = canManageAccounts || accounts.length > 0;
  const linkedPlayerIds = new Set(
    accounts
      .filter((account) => account.linkedPlayerId && account.id !== editingAccountId)
      .map((account) => account.linkedPlayerId as string),
  );
  const accountPlayerOptions = (allPlayers ?? players).filter(
    (player) => player.playerType === "MEMBER" && !linkedPlayerIds.has(player.id),
  );

  const openCreateModal = () => {
    setEditorMode("create");
    setEditingPlayerId(null);
    setFormValues(defaultFormValues);
  };

  const openEditModal = (playerId: string) => {
    const player = players.find((entry) => entry.id === playerId);
    if (!player) {
      return;
    }
    setEditorMode("edit");
    setEditingPlayerId(playerId);
    setFormValues(toFormValues(player));
  };

  const closeModal = () => {
    setEditorMode(null);
    setEditingPlayerId(null);
  };

  const openCreateAccountModal = () => {
    if (!canManageAccounts) {
      return;
    }
    setAccountEditorMode("create");
    setEditingAccountId(null);
    setAccountFormValues(defaultAccountFormValues);
  };

  const openEditAccountModal = (accountId: string) => {
    if (!canManageAccounts) {
      return;
    }
    const account = accounts.find((entry) => entry.id === accountId);
    if (!account) {
      return;
    }
    setAccountEditorMode("edit");
    setEditingAccountId(accountId);
    setAccountFormValues(toAccountFormValues(account));
  };

  const closeAccountModal = () => {
    setAccountEditorMode(null);
    setEditingAccountId(null);
    setAccountFormValues(defaultAccountFormValues);
  };

  const handleFilterChange =
    (field: keyof PlayerFilterState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onFilterChange({
        ...filters,
        [field]: event.target.value,
      });
    };

  const handleFieldChange =
    (field: keyof PlayerFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const rawValue =
        event.target instanceof HTMLInputElement && event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;
      const value =
        field === "monthlyFeeAmount"
          ? Number(rawValue)
          : field === "shirtNumber"
            ? (rawValue === "" ? null : Number(rawValue))
            : rawValue;
      setFormValues((prev) => {
        return { ...prev, [field]: value };
      });
    };

  const handleRatingChange =
    (field: keyof PlayerFormValues["ratings"]) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = clampRating(Number(event.target.value));
      setFormValues((prev) => ({
        ...prev,
        ratings: {
          ...prev.ratings,
          [field]: value,
        },
      }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editorMode === "create") {
      await onCreatePlayer(formValues);
    } else if (editorMode === "edit" && editingPlayerId) {
      await onEditPlayer(editingPlayerId, formValues);
    }
    closeModal();
  };

  const handleAccountFieldChange =
    (field: keyof AccessAccountFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const rawValue =
        event.target instanceof HTMLInputElement && event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;
      const value = field === "linkedPlayerId" ? (rawValue === "" ? null : String(rawValue)) : rawValue;
      setAccountFormValues((prev) => ({ ...prev, [field]: value }));
    };

  const handleAccountSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: AccessAccountFormValues = {
      ...accountFormValues,
      linkedPlayerId: accountFormValues.linkedPlayerId || null,
      password: accountFormValues.password?.trim() ? accountFormValues.password : "",
    };

    if (accountEditorMode === "create" && onCreateAccount) {
      await onCreateAccount(payload);
    } else if (accountEditorMode === "edit" && editingAccountId && onEditAccount) {
      await onEditAccount(editingAccountId, payload);
    }
    closeAccountModal();
  };

  const handleResetPassword = async (accountId: string) => {
    if (!onResetAccountPassword) {
      return;
    }
    const nextPassword = window.prompt("Digite a nova senha temporária para esta conta:");
    if (!nextPassword || !nextPassword.trim()) {
      return;
    }
    await onResetAccountPassword(accountId, nextPassword.trim());
  };

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Elenco</p>
          <h2 style={{ fontFamily: themeTokens.fontFamily.heading }}>Mensalistas</h2>
          <p className="muted">
            Status atual: {filters.status === "ALL" ? "Todos" : filters.status === "ACTIVE" ? "ativos" : "inativos"}
          </p>
        </div>
        {canEdit && (
          <div className="section-actions">
            <button type="button" className="primary-button" onClick={openCreateModal}>
              Novo jogador
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-card glass-card">
        <label>
          Buscar
          <input
            className="input-field"
            placeholder="Nome ou apelido"
            value={filters.search}
            onChange={handleFilterChange("search")}
          />
        </label>
        <label>
          Status
          <select className="input-field" value={filters.status} onChange={handleFilterChange("status")}>
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Inativos</option>
          </select>
        </label>
        <label>
          Posição
          <select className="input-field" value={filters.position} onChange={handleFilterChange("position")}>
            {positionOptions.map((option) => (
              <option key={option} value={option}>
                {positionLabels[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="roster-grid">
        {isLoading ? (
          <p className="muted">Carregando mensalistas...</p>
        ) : players.length === 0 ? (
          <p className="empty-state">Nenhum mensalista encontrado com os filtros atuais.</p>
        ) : (
          players.map((player) => (
            <article key={player.id} className="glass-card roster-card">
              <header>
                <div>
                  <h3>{player.fullName}</h3>
                  <small className="muted">{positionLabels[player.preferredPosition]}</small>
                </div>
                <div className="roster-actions">
                  {canEdit && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => openEditModal(player.id)}
                    >
                      Editar
                    </button>
                  )}
                </div>
              </header>
              <div className="roster-meta">
                <span># {player.shirtNumber ?? "—"}</span>
                <span>{positionLabels[player.preferredPosition]}</span>
                <span>{player.isActive ? "Ativo" : "Inativo"}</span>
              </div>
              <div className="rating-stack">
                <RatingBar label="Overall" value={player.ratings.overall} />
              </div>
              <div className="roster-footer">
                <span>
                  Mensalidade{" "}
                  {player.monthlyFeeAmount.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={isSubmitting}
                    onClick={() => onTogglePlayerStatus(player.id, !player.isActive)}
                  >
                    {player.isActive ? "Inativar" : "Reativar"}
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {shouldShowAccounts && (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Acesso</p>
              <h2 style={{ fontFamily: themeTokens.fontFamily.heading }}>Contas de acesso</h2>
              <p className="muted">
                {accounts.length > 0
                  ? `${accounts.length} conta(s) cadastrada(s)`
                  : "Nenhuma conta vinculada ao elenco"}
              </p>
            </div>
            {canEdit && (
              <div className="section-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={openCreateAccountModal}
                  disabled={!canManageAccounts}
                >
                  Nova conta
                </button>
              </div>
            )}
          </div>

          <div className="accounts-grid">
            {accounts.length === 0 ? (
              <p className="empty-state">
                Nenhuma conta cadastrada ainda. Crie a primeira para liberar o acesso do elenco.
              </p>
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
              {canEdit && (
                <div className="account-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => openEditAccountModal(account.id)}
                    disabled={!canManageAccounts}
                  >
                    Editar conta
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleResetPassword(account.id)}
                    disabled={!onResetAccountPassword || isSubmittingAccount}
                  >
                    Resetar senha
                  </button>
                </div>
              )}
                </article>
              ))
            )}
          </div>
        </>
      )}

      {editorMode && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card">
            <div className="ledger-heading">
              <div>
                <p className="eyebrow">Elenco</p>
                <h3>{editorMode === "create" ? "Novo mensalista" : editingPlayer?.fullName}</h3>
              </div>
              <button type="button" className="ghost-button" onClick={closeModal}>
                Fechar
              </button>
            </div>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                Nome completo
                <input
                  className="input-field"
                  value={formValues.fullName}
                  onChange={handleFieldChange("fullName")}
                  required
                />
              </label>
              <label>
                Apelido
                <input className="input-field" value={formValues.nickname} onChange={handleFieldChange("nickname")} />
              </label>
              <label>
                Posição que joga
                <select
                  className="input-field"
                  value={formValues.preferredPosition}
                  onChange={handleFieldChange("preferredPosition")}
                >
                  {positionOptions
                    .filter((option) => option !== "ALL")
                    .map((option) => (
                      <option key={option} value={option}>
                        {positionLabels[option]}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Mensalidade
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.monthlyFeeAmount}
                  onChange={handleFieldChange("monthlyFeeAmount")}
                />
              </label>
              <label>
                Camisa
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  value={formValues.shirtNumber ?? ""}
                  onChange={handleFieldChange("shirtNumber")}
                />
              </label>
              <label>
                Email
                <input className="input-field" value={formValues.email ?? ""} onChange={handleFieldChange("email")} />
              </label>
              <label>
                Telefone
                <input
                  className="input-field"
                  value={formValues.phoneNumber ?? ""}
                  onChange={handleFieldChange("phoneNumber")}
                />
              </label>
              <label className="form-span-2">
                Observações
                <textarea
                  className="input-field textarea-field"
                  value={formValues.notes ?? ""}
                  onChange={handleFieldChange("notes")}
                />
              </label>

              <div className="form-span-2 ratings-editor">
                <label>
                  Overall
                  <input
                    className="input-field"
                    type="number"
                    min="0"
                    max="99"
                    value={formValues.ratings.overall}
                    onChange={handleRatingChange("overall")}
                  />
                </label>
              </div>

              <label className="checkbox-field form-span-2">
                <input
                  type="checkbox"
                  checked={formValues.isActive}
                  onChange={handleFieldChange("isActive")}
                />
                Jogador ativo
              </label>

              <div className="section-actions form-span-2">
                <button type="button" className="ghost-button" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : editorMode === "create" ? "Criar jogador" : "Salvar ajustes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accountEditorMode && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card">
            <div className="ledger-heading">
              <div>
                <p className="eyebrow">Acesso</p>
                <h3>{accountEditorMode === "create" ? "Nova conta" : editingAccount?.username}</h3>
              </div>
              <button type="button" className="ghost-button" onClick={closeAccountModal}>
                Fechar
              </button>
            </div>
            <form className="form-grid compact-grid" onSubmit={handleAccountSubmit}>
              <label>
                Usuário
                <input
                  className="input-field"
                  value={accountFormValues.username}
                  onChange={handleAccountFieldChange("username")}
                  required
                />
              </label>
              <label>
                Nome de exibição
                <input
                  className="input-field"
                  value={accountFormValues.displayName}
                  onChange={handleAccountFieldChange("displayName")}
                  required
                />
              </label>
              <label>
                E-mail
                <input
                  className="input-field"
                  type="email"
                  value={accountFormValues.email}
                  onChange={handleAccountFieldChange("email")}
                  required={accountEditorMode === "create"}
                />
              </label>
              <label>
                Papel
                <select
                  className="input-field"
                  value={accountFormValues.role}
                  onChange={handleAccountFieldChange("role")}
                >
                  <option value="COMMON">Comum</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <label className="form-span-2">
                Jogador vinculado
                <select
                  className="input-field"
                  value={accountFormValues.linkedPlayerId ?? ""}
                  onChange={handleAccountFieldChange("linkedPlayerId")}
                >
                  <option value="">Sem vínculo</option>
                  {accountPlayerOptions.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-span-2">
                {accountEditorMode === "create" ? "Senha inicial" : "Nova senha (opcional)"}
                <input
                  className="input-field"
                  type="password"
                  value={accountFormValues.password}
                  onChange={handleAccountFieldChange("password")}
                  placeholder={accountEditorMode === "create" ? "Defina a senha" : "Preencha para alterar"}
                  required={accountEditorMode === "create"}
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={accountFormValues.isActive}
                  onChange={handleAccountFieldChange("isActive")}
                />
                Conta ativa
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={accountFormValues.mustChangePassword}
                  onChange={handleAccountFieldChange("mustChangePassword")}
                />
                Exigir troca de senha no próximo login
              </label>
              <div className="section-actions form-span-2">
                <button type="button" className="ghost-button" onClick={closeAccountModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={isSubmittingAccount}>
                  {isSubmittingAccount ? "Salvando..." : accountEditorMode === "create" ? "Criar conta" : "Salvar conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
