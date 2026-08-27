import type {
  AttendanceEntry,
  AttendanceStatus,
  AuthenticatedUser,
  ISODateString,
  ISODateTimeString,
  MatchStatus,
  MatchSummary,
  OverallHistorySnapshot,
  PlayerSummary,
  TransactionRecord,
} from "../../domain/types";

export interface PersonalFinanceSnapshot {
  monthlyFeeAmount: number;
  paidInReferenceMonth: number;
  pendingInReferenceMonth: number;
  outstandingBalance: number;
  referenceMonth: ISODateString;
  lastPaymentOn?: ISODateString | null;
}

/** Caixa do grupo, exposto ao jogador comum pelo endpoint do portal. */
export interface PortalCashSnapshot {
  currentBalance: number;
  pendingTotal: number;
}

export interface PersonalAttendanceSnapshot {
  matchId: string;
  scheduledAt: ISODateTimeString;
  attendanceStatus: AttendanceStatus;
  assignedTeamName?: string | null;
  assignedTeamNumber?: number | null;
}

export interface UpcomingMatchSnapshot {
  matchId: string;
  scheduledAt: ISODateTimeString;
  location?: string;
  status: MatchStatus;
  expectedTeamCount: number;
}

export interface RecentTeamSnapshot {
  matchId: string;
  scheduledAt: ISODateTimeString;
  teamName: string;
  teammates: string[];
  averageOverall?: number | null;
  resultSummary?: string | null;
}

export interface CommonUserPortalPageProps {
  currentUser: AuthenticatedUser;
  linkedPlayer?: PlayerSummary | null;
  finance: PersonalFinanceSnapshot;
  transactions: TransactionRecord[];
  cash: PortalCashSnapshot;
  overallHistory?: OverallHistorySnapshot | null;
  /** Convidados com taxa pendente; a tela filtra os que este jogador levou. */
  guestDebts: AttendanceEntry[];
  players: PlayerSummary[];
  matches: MatchSummary[];
  recentAttendance: PersonalAttendanceSnapshot[];
  upcomingMatches: UpcomingMatchSnapshot[];
  recentTeams: RecentTeamSnapshot[];
  isLoading: boolean;
  onRefresh?: () => Promise<void> | void;
}
