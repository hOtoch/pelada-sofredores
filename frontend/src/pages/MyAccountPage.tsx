import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import type { AuthenticatedUser } from "../domain/types";
import type { AccountProfileFormValues } from "../features/auth/contracts";
import { themeTokens } from "../theme/tokens";

type MyAccountPageProps = {
  currentUser: AuthenticatedUser;
  isSubmittingProfile: boolean;
  isChangingPassword: boolean;
  onUpdateProfile: (values: AccountProfileFormValues) => Promise<void> | void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void> | void;
};

const hasUsernameSpace = (value: string) => /\s/.test(value.trim());

function toProfileValues(user: AuthenticatedUser): AccountProfileFormValues {
  return {
    username: user.username,
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    phoneNumber: user.phoneNumber ?? "",
  };
}

export function MyAccountPage({
  currentUser,
  isSubmittingProfile,
  isChangingPassword,
  onUpdateProfile,
  onChangePassword,
}: MyAccountPageProps) {
  const [profileValues, setProfileValues] = useState<AccountProfileFormValues>(() => toProfileValues(currentUser));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();

  useEffect(() => {
    setProfileValues(toProfileValues(currentUser));
  }, [currentUser]);

  const handleProfileField =
    (field: keyof AccountProfileFormValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setProfileValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(undefined);

    const payload: AccountProfileFormValues = {
      username: profileValues.username.trim(),
      displayName: profileValues.displayName.trim(),
      email: profileValues.email.trim(),
      phoneNumber: profileValues.phoneNumber.trim(),
    };

    if (!payload.username) {
      setProfileError("Informe um usuario.");
      return;
    }

    if (hasUsernameSpace(payload.username)) {
      setProfileError("O usuario nao pode conter espacos.");
      return;
    }

    try {
      await onUpdateProfile(payload);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Falha ao atualizar seus dados.");
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(undefined);

    if (!currentPassword || !newPassword) {
      setPasswordError("Preencha a senha atual e a nova senha.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmacao da senha precisa ser igual a nova senha.");
      return;
    }

    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Falha ao trocar a senha.");
    }
  };

  return (
    <section className="page-section">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Acesso</p>
          <h2 style={{ fontFamily: themeTokens.fontFamily.heading }}>Minha conta</h2>
          <p className="muted">Atualize seus dados de acesso e seguranca.</p>
        </div>
      </header>

      {currentUser.mustChangePassword ? (
        <div className="status-banner warning">
          Sua conta esta com senha temporaria. Atualize a senha nesta tela.
        </div>
      ) : null}

      <div className="account-page-grid">
        <section className="glass-card account-form-card">
          <div className="ledger-heading">
            <div>
              <p className="eyebrow">Perfil</p>
              <h3>Dados da conta</h3>
            </div>
            <span className={`role-chip ${currentUser.role === "ADMIN" ? "admin" : "common"}`}>
              {currentUser.role === "ADMIN" ? "Admin" : "Jogador"}
            </span>
          </div>

          <form className="form-grid compact-grid" onSubmit={handleProfileSubmit}>
            <label>
              Usuario
              <input
                className="input-field"
                value={profileValues.username}
                onChange={handleProfileField("username")}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Nome de exibicao
              <input
                className="input-field"
                value={profileValues.displayName}
                onChange={handleProfileField("displayName")}
                autoComplete="name"
              />
            </label>
            <label>
              E-mail
              <input
                className="input-field"
                type="email"
                value={profileValues.email}
                onChange={handleProfileField("email")}
                autoComplete="email"
              />
            </label>
            <label>
              Celular
              <input
                className="input-field"
                value={profileValues.phoneNumber}
                onChange={handleProfileField("phoneNumber")}
                autoComplete="tel"
                inputMode="tel"
              />
            </label>
            {profileError ? <p className="error-text form-span-2">{profileError}</p> : null}
            <div className="section-actions form-span-2">
              <button type="submit" className="primary-button" disabled={isSubmittingProfile}>
                {isSubmittingProfile ? "Salvando..." : "Salvar dados"}
              </button>
            </div>
          </form>
        </section>

        <section className="glass-card account-form-card">
          <div className="ledger-heading">
            <div>
              <p className="eyebrow">Seguranca</p>
              <h3>Alterar senha</h3>
            </div>
          </div>

          <form className="form-grid compact-grid" onSubmit={handlePasswordSubmit}>
            <label className="form-span-2">
              Senha atual
              <input
                className="input-field"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="form-span-2">
              Nova senha
              <input
                className="input-field"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="form-span-2">
              Confirmar nova senha
              <input
                className="input-field"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            {passwordError ? <p className="error-text form-span-2">{passwordError}</p> : null}
            <div className="section-actions form-span-2">
              <button type="submit" className="primary-button" disabled={isChangingPassword}>
                {isChangingPassword ? "Salvando..." : "Atualizar senha"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}
