export type ISODateString = string;
export type ISODateTimeString = string;

export type UserRole = "ADMIN" | "COMMON";
export type PlayerType = "MEMBER" | "GUEST";
export type PreferredPosition =
  | "GOALKEEPER"
  | "DEFENDER"
  | "MIDFIELDER"
  | "FORWARD"
  | "UNIVERSAL";
export type TransactionDirection = "INFLOW" | "OUTFLOW";
export type TransactionCategory =
  | "MONTHLY_FEE"
  | "EXTRA_FEE"
  | "FIELD_RENT"
  | "BARBECUE"
  | "EQUIPMENT"
  | "REFUND"
  | "ADJUSTMENT"
  | "OTHER";
export type TransactionStatus = "POSTED" | "PENDING" | "VOIDED";
export type MatchStatus = "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
export type AttendanceStatus = "CONFIRMED" | "PENDING" | "DECLINED";
export type GuestFeeStatus = "PENDING" | "PAID" | "WAIVED";

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  displayName: string;
  linkedPlayerId?: string | null;
  mustChangePassword?: boolean;
}

export interface PlayerRatings {
  overall: number;
}

export interface PlayerSummary {
  id: string;
  fullName: string;
  nickname?: string;
  playerType: PlayerType;
  preferredPosition: PreferredPosition;
  monthlyFeeAmount: number;
  shirtNumber?: number | null;
  email?: string;
  phoneNumber?: string;
  joinedOn?: ISODateString | null;
  isActive: boolean;
  notes?: string;
  ratings: PlayerRatings;
}

export interface CashFlowSummary {
  currentBalance: number;
  inflowTotal: number;
  outflowTotal: number;
  pendingTotal: number;
}

export type MonthlyFeePaymentState = "UNPAID" | "PARTIAL" | "PAID" | "EXEMPT";

export interface TransactionRecord {
  id: string;
  direction: TransactionDirection;
  category: TransactionCategory;
  status: TransactionStatus;
  amount: number;
  description: string;
  occurredOn: ISODateString;
  referenceMonth?: ISODateString | null;
  relatedPlayerId?: string | null;
  relatedPlayerName?: string | null;
  matchId?: string | null;
  recordedByName?: string;
  notes?: string;
}

export interface MonthlyFeeStatus {
  playerId: string;
  playerName: string;
  playerNickname?: string;
  referenceMonth: string;
  expectedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentState: MonthlyFeePaymentState;
  latestTransactionId?: string | null;
}

export interface MatchSummary {
  id: string;
  scheduledAt: ISODateTimeString;
  location?: string;
  status: MatchStatus;
  expectedTeamCount: number;
  attendanceLockedAt?: ISODateTimeString | null;
  archivedAt?: ISODateTimeString | null;
  teamsGeneratedAt?: ISODateTimeString | null;
  resultSummary?: string | null;
  resultRecordedAt?: ISODateTimeString | null;
  ratingsFinalizedAt?: ISODateTimeString | null;
  notes?: string;
  updatedAt?: ISODateTimeString;
}

export interface AttendanceEntry {
  id: string;
  matchId: string;
  playerId?: string | null;
  displayName: string;
  isGuest: boolean;
  invitedById?: string | null;
  attendanceStatus: AttendanceStatus;
  assignedTeamNumber?: number | null;
  assignedTeamName?: string | null;
  confirmedAt?: ISODateTimeString | null;
  guestFeeAmount: number;
  guestFeeStatus: GuestFeeStatus;
  guestFeePaidAt?: ISODateTimeString | null;
  guestFeeIsDue: boolean;
  guestFeeOutstanding: number;
  notes?: string;
  ratings: PlayerRatings;
}

export interface GeneratedTeam {
  name: string;
  players: AttendanceEntry[];
  totalOverall: number;
  averageOverall: number;
}

export interface TeamGenerationRequest {
  matchId: string;
  attendance: AttendanceEntry[];
  teamCount: number;
  randomSeed?: number;
}

export interface TeamGenerationResult {
  teams: GeneratedTeam[];
  averageOverallGap: number;
  diagnostics: Record<string, string | number | boolean | null>;
}

export interface MatchPlayerRatingItem {
  attendanceId: string;
  playerId: string;
  displayName: string;
  currentOverall: number;
  score?: number | null;
  averageScore?: number | null;
  ratingCount: number;
}

export interface MatchPlayerOverallSummary {
  attendanceId: string;
  playerId: string;
  displayName: string;
  previousOverall: number;
  currentOverall: number;
  delta: number;
  averageScore?: number | null;
  ratingCount: number;
}

export interface MatchPlayerRatingState {
  matchId: string;
  canRate: boolean;
  hasSubmitted: boolean;
  lockedReason: string;
  windowClosesAt?: ISODateTimeString | null;
  ratingsFinalizedAt?: ISODateTimeString | null;
  items: MatchPlayerRatingItem[];
  log: MatchPlayerRatingLogEntry[];
  overallSummary: MatchPlayerOverallSummary[];
}

export interface OverallHistoryPlayer {
  playerId: string;
  displayName: string;
  isActive: boolean;
}

export interface OverallHistoryPoint {
  playerId: string;
  displayName: string;
  overall: number;
}

export interface OverallHistoryMatch {
  matchId: string;
  scheduledAt: ISODateTimeString;
  location?: string;
  points: OverallHistoryPoint[];
}

export interface OverallHistorySnapshot {
  players: OverallHistoryPlayer[];
  matches: OverallHistoryMatch[];
}

export interface MatchPlayerRatingInput {
  attendanceId: string;
  score: number;
}

export interface MatchPlayerRatingLogEntry {
  raterUserId?: string | null;
  raterDisplayName: string;
  ratedAttendanceId: string;
  ratedPlayerId: string;
  ratedDisplayName: string;
  score: number;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface ApiCollectionResponse<T> {
  count: number;
  results: T[];
}
