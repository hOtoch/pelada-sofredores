import { useId, useState, type ChangeEvent, type FormEvent } from "react";

import sofredoresLogo from "../assets/sofredores-logo.png";
import type { LoginFormValues, LoginPageProps, SignupFormValues } from "../features/auth/contracts";
import { themeTokens } from "../theme/tokens";

const initialValues: LoginFormValues = {
  identifier: "",
  password: "",
  rememberMe: true,
};

const initialSignupValues: SignupFormValues = {
  fullName: "",
  phoneNumber: "",
  username: "",
  password: "",
};

const hasUsernameSpace = (value: string) => /\s/.test(value.trim());

export function LoginPage({
  isSubmitting,
  isCreatingAccount = false,
  errorMessage,
  signupErrorMessage,
  canCreateAccount,
  onSubmit,
  onCreateAccount,
}: LoginPageProps) {
  const [values, setValues] = useState(initialValues);
  const [signupValues, setSignupValues] = useState(initialSignupValues);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [localSignupError, setLocalSignupError] = useState<string>();
  const id = useId();

  const handleChange =
    (field: keyof LoginFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = field === "rememberMe" ? event.target.checked : event.target.value;
      setValues((prev) => ({ ...prev, [field]: nextValue }));
    };

  const handleSignupChange =
    (field: keyof SignupFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      setLocalSignupError(undefined);
      setSignupValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(values);
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateAccount) {
      return;
    }
    if (hasUsernameSpace(signupValues.username)) {
      setLocalSignupError("O usuario nao pode conter espacos.");
      return;
    }
    try {
      await onCreateAccount({
        ...signupValues,
        username: signupValues.username.trim(),
      });
    } catch {
      // Parent state renders the API error inside the modal.
    }
  };

  return (
    <>
      <section className="glass-card login-card">
        <div className="login-brand-block login-brand-block-minimal">
          <img src={sofredoresLogo} alt="Sofredores 027" className="login-logo" />
          <div className="login-copy">
            <h1 style={{ fontFamily: themeTokens.fontFamily.heading, margin: 0 }}>
              PELADINHA SOFREDORES
            </h1>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.75rem" }}
        >
          <label>
            Usuário ou celular
            <input
              type="text"
              value={values.identifier}
              onChange={handleChange("identifier")}
              className="input-field"
              placeholder="usuario ou celular"
              autoComplete="username"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={values.password}
              onChange={handleChange("password")}
              className="input-field"
              placeholder="senha"
              autoComplete="current-password"
            />
          </label>
          <label className="checkbox-field" htmlFor={`${id}-remember`}>
            <input id={`${id}-remember`} type="checkbox" checked={values.rememberMe} onChange={handleChange("rememberMe")} />
            Lembrar sessão
          </label>
          {errorMessage && <p className="error-text">{errorMessage}</p>}
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Validando..." : "Entrar"}
          </button>
          {canCreateAccount && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setLocalSignupError(undefined);
                setIsSignupOpen(true);
              }}
            >
              Criar minha conta
            </button>
          )}
        </form>
      </section>

      {isSignupOpen && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card login-signup-modal">
            <div className="ledger-heading">
              <h3>Criar minha conta</h3>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setLocalSignupError(undefined);
                  setIsSignupOpen(false);
                }}
              >
                Fechar
              </button>
            </div>
            <form className="form-grid compact-grid" onSubmit={handleSignupSubmit}>
              <label className="form-span-2">
                Nome completo
                <input
                  className="input-field"
                  value={signupValues.fullName}
                  onChange={handleSignupChange("fullName")}
                  autoComplete="name"
                  required
                />
              </label>
              <label className="form-span-2">
                Celular
                <input
                  className="input-field"
                  value={signupValues.phoneNumber}
                  onChange={handleSignupChange("phoneNumber")}
                  autoComplete="tel"
                  inputMode="tel"
                  required
                />
              </label>
              <label className="form-span-2">
                Usuário
                <input
                  className="input-field"
                  value={signupValues.username}
                  onChange={handleSignupChange("username")}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="form-span-2">
                Senha
                <input
                  className="input-field"
                  type="password"
                  value={signupValues.password}
                  onChange={handleSignupChange("password")}
                  autoComplete="new-password"
                  required
                />
              </label>
              {(localSignupError || signupErrorMessage) && (
                <p className="error-text form-span-2">{localSignupError || signupErrorMessage}</p>
              )}
              <div className="section-actions form-span-2">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setLocalSignupError(undefined);
                    setIsSignupOpen(false);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={isCreatingAccount}>
                  {isCreatingAccount ? "Criando..." : "Criar conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
