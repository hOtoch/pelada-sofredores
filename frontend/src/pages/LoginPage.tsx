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
  const [signupPasswordConfirmation, setSignupPasswordConfirmation] = useState("");
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
      // o usuario nao aceita espaco, entao ele nem chega a ser digitado
      const nextValue =
        field === "username" ? event.target.value.replace(/\s/g, "") : event.target.value;
      setSignupValues((prev) => ({ ...prev, [field]: nextValue }));
    };

  const closeSignup = () => {
    setLocalSignupError(undefined);
    setSignupPasswordConfirmation("");
    setIsSignupOpen(false);
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
      setLocalSignupError("O usuário não pode conter espaços.");
      return;
    }
    if (signupValues.password !== signupPasswordConfirmation) {
      setLocalSignupError("As senhas não batem. Confere de novo.");
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
          </div>
        </div>

        <div className="login-panel">
          <div className="login-box">
            <span className="login-jersey" aria-hidden="true">
              <svg viewBox="0 0 32 32" role="presentation" focusable="false">
                <g
                  stroke="#16101f"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                >
                  <path d="M21 14h2.5a3.5 3.5 0 0 1 0 7H21" />
                  <path d="M8 12h13v13a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3z" fill="#f5f1fa" />
                  <path d="M12 16v8M17 16v8" />
                  <path
                    d="M9.5 12a3.2 3.2 0 0 1 1.9-5.2 3.6 3.6 0 0 1 6.4-1.3A3.1 3.1 0 0 1 21 12z"
                    fill="#fffdf7"
                  />
                </g>
              </svg>
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
                  placeholder="Usuário ou celular"
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
                  placeholder="Esquece essa porra não"
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
            <button type="button" className="ghost-button login-signup-close" onClick={closeSignup}>
              Fechar
            </button>
            <div className="login-signup-header">
              <img src={sofredoresLogo} alt="" className="login-signup-logo" />
              <h3 className="login-signup-title">Quero ser um Sofredor</h3>
              <p className="login-signup-tagline">
                Que decisão de merda, hein? Prepara o emocional: aqui tem nota toda semana e ninguém
                aceita a sua.
              </p>
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
                  placeholder="sem espaço, craque"
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
              <label className="form-span-2">
                Confirmar senha
                <input
                  className="input-field"
                  type="password"
                  value={signupPasswordConfirmation}
                  onChange={(event) => {
                    setLocalSignupError(undefined);
                    setSignupPasswordConfirmation(event.target.value);
                  }}
                  autoComplete="new-password"
                  required
                />
              </label>
              {(localSignupError || signupErrorMessage) && (
                <p className="error-text form-span-2">{localSignupError || signupErrorMessage}</p>
              )}
              <div className="section-actions form-span-2">
                <button type="button" className="ghost-button" onClick={closeSignup}>
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
