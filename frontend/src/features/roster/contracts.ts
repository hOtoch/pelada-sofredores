import type {
  PlayerRatings,
  PlayerSummary,
  PreferredPosition,
  UserRole,
} from "../../domain/types";

export interface PlayerFilterState {
  search: string;
  status: "ALL" | "ACTIVE" | "INACTIVE";
  position: PreferredPosition | "ALL";
}

export interface PlayerFormValues {
  fullName: string;
  nickname: string;
  preferredPosition: PreferredPosition;
  monthlyFeeAmount: number;
  shirtNumber?: number | null;
  email?: string;
  phoneNumber?: string;
  joinedOn?: string | null;
  isActive: boolean;
  notes?: string;
  ratings: PlayerRatings;
}

export interface PlayerTableProps {
  players: PlayerSummary[];
  isLoading: boolean;
  onEditPlayer: (playerId: string) => void;
  onTogglePlayerStatus: (playerId: string) => void;
}

export interface RatingsEditorProps {
  value: PlayerRatings;
  onChange: (nextValue: PlayerRatings) => void;
}

export interface PlayerEditorDrawerProps {
  mode: "create" | "edit";
  initialValues: PlayerFormValues;
  isSubmitting: boolean;
  onSubmit: (values: PlayerFormValues) => Promise<void> | void;
  onCancel: () => void;
}

export interface AccessAccountSummary {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  linkedPlayerId?: string | null;
  linkedPlayerName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccessAccountFormValues {
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  linkedPlayerId?: string | null;
  password?: string;
}

export interface RosterManagementPageProps {
  players: PlayerSummary[];
  allPlayers?: PlayerSummary[];
  accounts?: AccessAccountSummary[];
  filters: PlayerFilterState;
  isLoading: boolean;
  isSubmitting: boolean;
  isSubmittingAccount?: boolean;
  canEdit: boolean;
  onFilterChange: (nextFilters: PlayerFilterState) => void;
  onCreatePlayer: (values: PlayerFormValues) => Promise<void> | void;
  onEditPlayer: (playerId: string, values: PlayerFormValues) => Promise<void> | void;
  onTogglePlayerStatus: (playerId: string, nextActive: boolean) => Promise<void> | void;
  onCreateAccount?: (values: AccessAccountFormValues) => Promise<void> | void;
  onEditAccount?: (accountId: string, values: AccessAccountFormValues) => Promise<void> | void;
  onResetAccountPassword?: (accountId: string, newPassword: string) => Promise<void> | void;
}
