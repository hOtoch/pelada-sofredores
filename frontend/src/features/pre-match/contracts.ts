import type {
  AttendanceEntry,
  GeneratedTeam,
  MatchPlayerRatingInput,
  MatchPlayerRatingState,
  MatchStatus,
  MatchSummary,
  OverallHistorySnapshot,
  PlayerSummary,
  PlayerRatings,
} from "../../domain/types";

export interface MatchFormValues {
  scheduledAt: string;
  location: string;
  expectedTeamCount: number;
  status: MatchStatus;
  notes?: string;
}

export interface GuestFormValues {
  displayName: string;
  invitedById?: string | null;
  ratings: PlayerRatings;
  notes?: string;
}

export interface GuestFormProps {
  initialValues: GuestFormValues;
  isSubmitting: boolean;
  onSubmit: (values: GuestFormValues) => Promise<void> | void;
  onCancel: () => void;
}

export interface TeamGeneratorPanelProps {
  presentCount: number;
  availableTeamCounts: number[];
  selectedTeamCount: number;
  isGenerating: boolean;
  lastGenerationGap?: number;
  onSelectTeamCount: (teamCount: number) => void;
  onGenerate: () => void;
}

export interface GeneratedTeamsBoardProps {
  teams: GeneratedTeam[];
  onShuffle?: () => void;
}

export interface PreMatchPageProps {
  matches: MatchSummary[];
  match: MatchSummary | null;
  activeSection?: "match" | "ratings";
  attendance: AttendanceEntry[];
  availablePlayers: PlayerSummary[];
  responsiblePlayers: PlayerSummary[];
  generatedTeams: GeneratedTeam[];
  averageOverallGap?: number | null;
  isLoading: boolean;
  isGeneratingTeams: boolean;
  isClearingTeams: boolean;
  isSubmittingRatings: boolean;
  isFinalizingRatings: boolean;
  isRecalculatingRatings: boolean;
  isSubmittingAttendance: boolean;
  isSubmittingMatch: boolean;
  canManageAttendance: boolean;
  canManageMatch: boolean;
  onSelectMatch: (matchId: string) => void;
  onCreateMatch: (values: MatchFormValues) => Promise<void> | void;
  onEditMatch: (matchId: string, values: MatchFormValues) => Promise<void> | void;
  onUpdateMatchStatus: (matchId: string, nextStatus: MatchStatus) => Promise<void> | void;
  onUpdateMatchResult: (matchId: string, resultSummary: string) => Promise<void> | void;
  onConfirmPlayer: (playerId: string) => Promise<void> | void;
  onAddGuest: (values: GuestFormValues) => Promise<void> | void;
  onRemoveAttendance: (attendanceId: string) => Promise<void> | void;
  onMarkGuestFeePaid: (attendanceId: string) => Promise<void> | void;
  onWaiveGuestFee: (attendanceId: string) => Promise<void> | void;
  onGenerateTeams: (teamCount: number) => Promise<void> | void;
  onClearGeneratedTeams: () => Promise<void> | void;
  ratingState?: MatchPlayerRatingState | null;
  overallHistory?: OverallHistorySnapshot | null;
  onFinalizeRatings?: () => Promise<void> | void;
  onRecalculateRatings?: () => Promise<void> | void;
  onSubmitPlayerRatings?: (ratings: MatchPlayerRatingInput[]) => Promise<void> | void;
}
