import type { ReactNode } from "react";

import type { AuthenticatedUser, UserRole } from "../domain/types";

export interface NavigationItem {
  key: string;
  label: string;
  route: string;
  icon?: string;
  requiresRole?: UserRole;
  badgeCount?: number;
}

export interface AppShellProps {
  currentUser: AuthenticatedUser | null;
  navigation: NavigationItem[];
  currentRoute: string;
  isMobileMenuOpen: boolean;
  onNavigate: (route: string) => void;
  onToggleMenu: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  currentUser: AuthenticatedUser | null;
  fallbackRoute: string;
  children: ReactNode;
}
