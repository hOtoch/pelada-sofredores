import type {
  AttendanceStatus,
  AuthenticatedUser,
  ISODateString,
  ISODateTimeString,
  MatchStatus,
  MatchSummary,
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
  players: PlayerSummary[];
  matches: MatchSummary[];
  recentAttendance: PersonalAttendanceSnapshot[];
  upcomingMatches: UpcomingMatchSnapshot[];
  recentTeams: RecentTeamSnapshot[];
  isLoading: boolean;
  onRefresh?: () => Promise<void> | void;
}
