import { useId, useState, type ChangeEvent, type FormEvent } from "react";

import heroWide from "../assets/sofredor-hero-1200.webp";
import heroNarrow from "../assets/sofredor-hero-800.webp";
import sofredoresLogo from "../assets/sofredores-logo.png";
import type { LoginFormValues, LoginPageProps, SignupFormValues } from "../features/auth/contracts";
import { pickLoginFootnote } from "../features/auth/copy";
import "../features/auth/login.css";

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
  // sorteada uma vez por visita, para nao trocar de frase a cada render
  const [footnote] = useState(pickLoginFootnote);
  const id = useId();

  const handleChange = (field: keyof LoginFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
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
      <section className="login-scene">
        <div className="login-art">
          <img
            className="login-art-image"
            src={heroWide}
            srcSet={`${heroNarrow} 800w, ${heroWide} 1200w`}
            sizes="(min-width: 900px) 55vw, 100vw"
            alt="Jogador do Sofredores F.C. cabeceando a bola de cigarro na boca, com a torcida ao fundo"
          />
          <div className="login-art-copy">
            <p className="login-kicker">Sofredores F.C. · a votação está aberta</p>
            <h1 className="login-headline">Seu overall não mente.</h1>
            <p className="login-subline">
              Confirma presença, dá nota pra quem mereceu e descobre se o overall subiu ou se foi só
              impressão sua.
            </p>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-box">
            <span className="login-jersey" aria-hidden="true">
              27
            </span>
            <div className="login-box-header">
              <img src={sofredoresLogo} alt="" className="login-box-logo" />
              <div>
                <h2 className="login-box-title">Vestiário</h2>
                <p className="login-box-subtitle">A votação já abriu. Entra e assume o prejuízo.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
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
                  placeholder="a senha, nao o seu overall"
                  autoComplete="current-password"
                />
              </label>
              <label className="checkbox-field" htmlFor={`${id}-remember`}>
                <input
                  id={`${id}-remember`}
                  type="checkbox"
                  checked={values.rememberMe}
                  onChange={handleChange("rememberMe")}
                />
                Continuar conectado
              </label>
              {errorMessage && <p className="error-text">{errorMessage}</p>}
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? "Aquecendo..." : "Entrar em campo"}
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
                  Ainda não sou sofredor
                </button>
              )}
            </form>

            <p className="login-footnote">{footnote}</p>
          </div>
        </div>
      </section>

      {isSignupOpen && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card login-signup-modal">
            <div className="ledger-heading">
              <h3>Virar sofredor</h3>
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
