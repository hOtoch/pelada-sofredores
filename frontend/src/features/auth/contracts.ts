import type { AuthenticatedUser } from "../../domain/types";

export interface LoginFormValues {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginPageProps {
  isSubmitting: boolean;
  isCreatingAccount?: boolean;
  errorMessage?: string;
  signupErrorMessage?: string;
  canCreateAccount?: boolean;
  onSubmit: (values: LoginFormValues) => Promise<void> | void;
  onCreateAccount?: (values: SignupFormValues) => Promise<void> | void;
}

export interface SignupFormValues {
  fullName: string;
  phoneNumber: string;
  username: string;
  password: string;
}

export interface SessionSummaryProps {
  user: AuthenticatedUser;
  onLogout: () => void;
}
