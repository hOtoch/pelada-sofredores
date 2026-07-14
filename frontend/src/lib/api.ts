import type {
  AttendanceEntry,
  AuthenticatedUser,
  CashFlowSummary,
  GeneratedTeam,
  MatchSummary,
  MatchPlayerRatingState,
  MatchStatsImportSummary,
  OverallHistorySnapshot,
  PlayerSummary,
  SportsRankingSnapshot,
  TeamGenerationResult,
  TransactionRecord,
} from "../domain/types";
import type {
  DashboardPaymentRankingEntry,
  DashboardPresenceRankingEntry,
  DashboardSeasonOverviewSnapshot,
} from "../features/dashboard/analytics";
import type {
  PersonalAttendanceSnapshot,
  PersonalFinanceSnapshot,
  UpcomingMatchSnapshot,
} from "../features/profile/contracts";
import type { AccountProfileFormValues } from "../features/auth/contracts";
import type { GuestFormValues, MatchFormValues } from "../features/pre-match/contracts";
import type { TransactionFormValues } from "../features/dashboard/contracts";
import type {
  AccessAccountFormValues,
  AccessAccountSummary,
  PlayerFormValues,
} from "../features/roster/contracts";

const API_BASE_URL = "/api";
export const AUTH_TOKEN_KEY = "peladinhas_sofredores_token";

type RawUser = {
  id: string;
  username: string;
  email: string;
  phone_number?: string;
  display_name: string;
  role: "ADMIN" | "COMMON";
  linked_player: string | null;
  must_change_password?: boolean;
  is_active?: boolean;
};

type RawUserAccount = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: "ADMIN" | "COMMON";
  is_active: boolean;
  must_change_password: boolean;
  linked_player: string | null;
  linked_player_name?: string | null;
  created_at: string;
  updated_at: string;
};

type RawPlayer = {
  id: string;
  full_name: string;
  nickname: string;
  player_type: PlayerSummary["playerType"];
  preferred_position: PlayerSummary["preferredPosition"];
  monthly_fee_amount: number | string;
  shirt_number: number | null;
  email: string;
  phone_number: string;
  joined_on: string | null;
  is_active: boolean;
  notes: string;
  overall: number;
};

type RawTransaction = {
  id: string;
  direction: TransactionRecord["direction"];
  category: TransactionRecord["category"];
  status: TransactionRecord["status"];
  amount: number | string;
  description: string;
  occurred_on: string;
  reference_month: string | null;
  related_player: string | null;
  related_player_name?: string | null;
  match: string | null;
  recorded_by_name?: string;
  notes?: string;
};

type RawMatch = {
  id: string;
  scheduled_at: string;
  location: string;
  status: MatchSummary["status"];
  expected_team_count: number;
  attendance_locked_at: string | null;
  archived_at: string | null;
  teams_generated_at: string | null;
  result_summary: string | null;
  result_recorded_at: string | null;
  ratings_finalized_at: string | null;
  notes: string;
  updated_at: string;
};

type RawAttendance = {
  id: string;
  match: string;
  player: string | null;
  display_name: string;
  is_guest: boolean;
  invited_by: string | null;
  invited_by_name?: string | null;
  attendance_status: AttendanceEntry["attendanceStatus"];
  assigned_team_number: number | null;
  assigned_team_name: string;
  confirmed_at: string | null;
  guest_fee_amount: number | string;
  guest_fee_status: AttendanceEntry["guestFeeStatus"];
  guest_fee_paid_at: string | null;
  guest_fee_is_due: boolean;
  guest_fee_outstanding: number | string;
  notes: string;
  overall: number;
};

type RawFinancialSummary = {
  current_balance: number | string;
  inflow_total: number | string;
  outflow_total: number | string;
  pending_total: number | string;
};

type RawGeneratedTeamPlayer = {
  id: string;
  display_name: string;
  is_guest: boolean;
  overall: number;
};

type RawGeneratedTeam = {
  name: string;
  total_overall: number;
  average_overall: number | string;
  players: RawGeneratedTeamPlayer[];
};

type RawTeamGenerationResult = {
  match_id: string;
  average_overall_gap: number | string;
  diagnostics: Record<string, string | number | boolean | null>;
  teams: RawGeneratedTeam[];
};

type RawMatchPlayerRatingItem = {
  attendance_id: string;
  player_id: string;
  display_name: string;
  current_overall: number;
  score: number | string | null;
  average_score: number | string | null;
  rating_count: number;
};

type RawMatchPlayerOverallSummary = {
  attendance_id: string;
  player_id: string;
  display_name: string;
  previous_overall: number;
  current_overall: number;
  delta: number;
  average_score: number | string | null;
  rating_count: number;
};

type RawMatchPlayerRatingState = {
  match_id: string;
  can_rate: boolean;
  has_submitted: boolean;
  locked_reason: string;
  window_closes_at: string | null;
  ratings_finalized_at: string | null;
  items: RawMatchPlayerRatingItem[];
  log: RawMatchPlayerRatingLogEntry[];
  overall_summary: RawMatchPlayerOverallSummary[];
};

type RawOverallHistoryPlayer = {
  player_id: string;
  display_name: string;
  is_active: boolean;
};

type RawOverallHistoryPoint = {
  player_id: string;
  display_name: string;
  overall: number;
};

type RawOverallHistoryMatch = {
  match_id: string;
  scheduled_at: string;
  location: string;
  points: RawOverallHistoryPoint[];
};

type RawOverallHistorySnapshot = {
  players: RawOverallHistoryPlayer[];
  matches: RawOverallHistoryMatch[];
};

type RawMatchPlayerRatingLogEntry = {
  rater_user_id: string | null;
  rater_display_name: string;
  rated_attendance_id: string;
  rated_player_id: string;
  rated_display_name: string;
  score: number | string;
  created_at: string;
  updated_at: string;
};

type RawPortalFinancialStatus = {
  reference_month: string;
  expected_monthly_fee: number | string;
  paid_amount: number | string;
  pending_amount: number | string;
  outstanding_amount: number | string;
  is_adimplente: boolean;
};

type RawPortalRecentAttendanceItem = {
  match_id: string;
  scheduled_at: string;
  match_status: MatchSummary["status"];
  attendance_status: AttendanceEntry["attendanceStatus"];
  assigned_team_name: string;
};

type RawPortalUpcomingMatchItem = {
  match_id: string;
  scheduled_at: string;
  location: string;
  status: MatchSummary["status"];
  expected_team_count: number;
  attendance_status: AttendanceEntry["attendanceStatus"] | null;
};

type RawPortalOverview = {
  user: RawUser;
  linked_player: RawPlayer | null;
  financial_status: RawPortalFinancialStatus;
  attendance_status: {
    confirmed_count: number;
    pending_count: number;
    declined_count: number;
    total_count: number;
  };
  recent_attendance: RawPortalRecentAttendanceItem[];
  upcoming_matches: RawPortalUpcomingMatchItem[];
};

type RawSeasonOverview = {
  reference_month: string;
  total_matches: number;
  matches_open: number;
  matches_closed: number;
  matches_archived: number;
  active_members: number;
  attendance_confirmed: number;
  attendance_pending: number;
  attendance_declined: number;
  attendance_total: number;
  inflow_total: number | string;
  outflow_total: number | string;
  current_balance: number | string;
  pending_total: number | string;
  adimplent_members: number;
  delinquent_members: number;
};

type RawPresenceRanking = {
  ranking: Array<{
    player_id: string;
    player_name: string;
    confirmed_count: number;
    pending_count: number;
    declined_count: number;
    total_calls: number;
    attendance_rate: number | string;
  }>;
};

type RawPaymentRanking = {
  reference_month: string;
  ranking: Array<{
    player_id: string;
    player_name: string;
    expected_monthly_fee: number | string;
    paid_amount: number | string;
    pending_amount: number | string;
    outstanding_amount: number | string;
    is_adimplente: boolean;
  }>;
};

type RawSportsRankingEntry = {
  player_id: string | null;
  player_name: string;
  goals: number;
  assists: number;
  wins: number;
};

type RawSportsRanking = {
  top_scorers: RawSportsRankingEntry[];
  top_assistants: RawSportsRankingEntry[];
  top_winners: RawSportsRankingEntry[];
};

type RawMatchStatsImportSummary = {
  match_id: string;
  players_processed: number;
  goals_total: number;
  assists_total: number;
  winning_teams: string[];
  replaced_existing: number;
};

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractApiErrorMessage(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  if ("detail" in data && data.detail) {
    return String(data.detail);
  }

  if ("non_field_errors" in data && Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
    return String(data.non_field_errors[0]);
  }

  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value[0]) {
      return String(value[0]);
    }

    if (typeof value === "string" && value) {
      return value;
    }
  }

  return null;
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Token ${token}`);
  }

  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 204) {
    return null as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractApiErrorMessage(data) || `Falha na chamada da API (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

async function requestBlob(path: string, init?: RequestInit, token?: string) {
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Token ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = extractApiErrorMessage(data) || `Falha na chamada da API (${response.status}).`;
    throw new ApiError(message, response.status);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = /filename="([^"]+)"/.exec(disposition);
  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? "estatisticas-pelada.csv",
  };
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function mapUser(raw: RawUser): AuthenticatedUser {
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email,
    phoneNumber: raw.phone_number ?? "",
    role: raw.role,
    displayName: raw.display_name || raw.username,
    linkedPlayerId: raw.linked_player,
    mustChangePassword: raw.must_change_password ?? false,
  };
}

function mapUserAccount(raw: RawUserAccount): AccessAccountSummary {
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email,
    displayName: raw.display_name || raw.username,
    role: raw.role,
    isActive: raw.is_active,
    mustChangePassword: raw.must_change_password,
    linkedPlayerId: raw.linked_player,
    linkedPlayerName: raw.linked_player_name ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapPlayer(raw: RawPlayer): PlayerSummary {
  return {
    id: raw.id,
    fullName: raw.full_name,
    nickname: raw.nickname,
    playerType: raw.player_type,
    preferredPosition: raw.preferred_position,
    monthlyFeeAmount: toNumber(raw.monthly_fee_amount),
    shirtNumber: raw.shirt_number,
    email: raw.email,
    phoneNumber: raw.phone_number,
    joinedOn: raw.joined_on,
    isActive: raw.is_active,
    notes: raw.notes,
    ratings: {
      overall: raw.overall,
    },
  };
}

function mapTransaction(raw: RawTransaction): TransactionRecord {
  return {
    id: raw.id,
    direction: raw.direction,
    category: raw.category,
    status: raw.status,
    amount: toNumber(raw.amount),
    description: raw.description,
    occurredOn: raw.occurred_on,
    referenceMonth: raw.reference_month ? raw.reference_month.slice(0, 7) : null,
    relatedPlayerId: raw.related_player,
    relatedPlayerName: raw.related_player_name ?? null,
    matchId: raw.match,
    recordedByName: raw.recorded_by_name,
    notes: raw.notes,
  };
}

function mapMatch(raw: RawMatch): MatchSummary {
  return {
    id: raw.id,
    scheduledAt: raw.scheduled_at,
    location: raw.location,
    status: raw.status,
    expectedTeamCount: raw.expected_team_count,
    attendanceLockedAt: raw.attendance_locked_at,
    archivedAt: raw.archived_at,
    teamsGeneratedAt: raw.teams_generated_at,
    resultSummary: raw.result_summary,
    resultRecordedAt: raw.result_recorded_at,
    ratingsFinalizedAt: raw.ratings_finalized_at,
    notes: raw.notes,
    updatedAt: raw.updated_at,
  };
}

function mapAttendance(raw: RawAttendance): AttendanceEntry {
  return {
    id: raw.id,
    matchId: raw.match,
    playerId: raw.player,
    displayName: raw.display_name,
    isGuest: raw.is_guest,
    invitedById: raw.invited_by,
    invitedByName: raw.invited_by_name ?? null,
    attendanceStatus: raw.attendance_status,
    assignedTeamNumber: raw.assigned_team_number,
    assignedTeamName: raw.assigned_team_name || undefined,
    confirmedAt: raw.confirmed_at,
    guestFeeAmount: toNumber(raw.guest_fee_amount),
    guestFeeStatus: raw.guest_fee_status,
    guestFeePaidAt: raw.guest_fee_paid_at,
    guestFeeIsDue: raw.guest_fee_is_due,
    guestFeeOutstanding: toNumber(raw.guest_fee_outstanding),
    notes: raw.notes,
    ratings: {
      overall: raw.overall,
    },
  };
}

function mapFinancialSummary(raw: RawFinancialSummary): CashFlowSummary {
  return {
    currentBalance: toNumber(raw.current_balance),
    inflowTotal: toNumber(raw.inflow_total),
    outflowTotal: toNumber(raw.outflow_total),
    pendingTotal: toNumber(raw.pending_total),
  };
}

function mapSeasonOverview(raw: RawSeasonOverview): DashboardSeasonOverviewSnapshot {
  return {
    referenceMonth: raw.reference_month,
    totalMatches: raw.total_matches,
    matchesOpen: raw.matches_open,
    matchesClosed: raw.matches_closed,
    matchesArchived: raw.matches_archived,
    activeMembers: raw.active_members,
    attendanceConfirmed: raw.attendance_confirmed,
    attendancePending: raw.attendance_pending,
    attendanceDeclined: raw.attendance_declined,
    attendanceTotal: raw.attendance_total,
    inflowTotal: toNumber(raw.inflow_total),
    outflowTotal: toNumber(raw.outflow_total),
    currentBalance: toNumber(raw.current_balance),
    pendingTotal: toNumber(raw.pending_total),
    adimplentMembers: raw.adimplent_members,
    delinquentMembers: raw.delinquent_members,
  };
}

function mapPresenceRanking(raw: RawPresenceRanking): DashboardPresenceRankingEntry[] {
  return raw.ranking.map((entry) => ({
    playerId: entry.player_id,
    playerName: entry.player_name,
    confirmedCount: entry.confirmed_count,
    pendingCount: entry.pending_count,
    declinedCount: entry.declined_count,
    totalCalls: entry.total_calls,
    attendanceRate: toNumber(entry.attendance_rate),
  }));
}

function mapPaymentRanking(raw: RawPaymentRanking): DashboardPaymentRankingEntry[] {
  return raw.ranking.map((entry) => ({
    playerId: entry.player_id,
    playerName: entry.player_name,
    expectedMonthlyFee: toNumber(entry.expected_monthly_fee),
    paidAmount: toNumber(entry.paid_amount),
    pendingAmount: toNumber(entry.pending_amount),
    outstandingAmount: toNumber(entry.outstanding_amount),
    isAdimplente: entry.is_adimplente,
  }));
}

function mapSportsRankingEntry(raw: RawSportsRankingEntry) {
  return {
    playerId: raw.player_id,
    playerName: raw.player_name,
    goals: raw.goals,
    assists: raw.assists,
    wins: raw.wins,
  };
}

function mapSportsRanking(raw: RawSportsRanking): SportsRankingSnapshot {
  return {
    topScorers: raw.top_scorers.map(mapSportsRankingEntry),
    topAssistants: raw.top_assistants.map(mapSportsRankingEntry),
    topWinners: raw.top_winners.map(mapSportsRankingEntry),
  };
}

function mapMatchStatsImportSummary(raw: RawMatchStatsImportSummary): MatchStatsImportSummary {
  return {
    matchId: raw.match_id,
    playersProcessed: raw.players_processed,
    goalsTotal: raw.goals_total,
    assistsTotal: raw.assists_total,
    winningTeams: raw.winning_teams,
    replacedExisting: raw.replaced_existing,
  };
}

export function mapGeneratedTeams(
  raw: RawTeamGenerationResult,
  attendance: AttendanceEntry[],
): TeamGenerationResult {
  const attendanceById = new Map(attendance.map((entry) => [entry.id, entry]));
  const teams: GeneratedTeam[] = raw.teams.map((team) => ({
    name: team.name,
    totalOverall: team.total_overall,
    averageOverall: toNumber(team.average_overall),
    players: team.players.map((player) => {
      const entry = attendanceById.get(player.id);
      return (
        entry ?? {
          id: player.id,
          matchId: raw.match_id,
          displayName: player.display_name,
          isGuest: player.is_guest,
          attendanceStatus: "CONFIRMED",
          guestFeeAmount: player.is_guest ? 14 : 0,
          guestFeeStatus: player.is_guest ? "PENDING" : "WAIVED",
          guestFeePaidAt: null,
          guestFeeIsDue: false,
          guestFeeOutstanding: 0,
          ratings: {
            overall: player.overall,
          },
        }
      );
    }),
  }));

  return {
    teams,
    averageOverallGap: toNumber(raw.average_overall_gap),
    diagnostics: raw.diagnostics,
  };
}

function mapMatchPlayerRatingState(raw: RawMatchPlayerRatingState): MatchPlayerRatingState {
  return {
    matchId: raw.match_id,
    canRate: raw.can_rate,
    hasSubmitted: raw.has_submitted,
    lockedReason: raw.locked_reason,
    windowClosesAt: raw.window_closes_at,
    ratingsFinalizedAt: raw.ratings_finalized_at,
    items: raw.items.map((item) => ({
      attendanceId: item.attendance_id,
      playerId: item.player_id,
      displayName: item.display_name,
      currentOverall: item.current_overall,
      score: item.score == null ? null : toNumber(item.score),
      averageScore: item.average_score == null ? null : toNumber(item.average_score),
      ratingCount: item.rating_count,
    })),
    log: raw.log.map((entry) => ({
      raterUserId: entry.rater_user_id,
      raterDisplayName: entry.rater_display_name,
      ratedAttendanceId: entry.rated_attendance_id,
      ratedPlayerId: entry.rated_player_id,
      ratedDisplayName: entry.rated_display_name,
      score: toNumber(entry.score),
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    })),
    overallSummary: (raw.overall_summary ?? []).map((item) => ({
      attendanceId: item.attendance_id,
      playerId: item.player_id,
      displayName: item.display_name,
      previousOverall: item.previous_overall,
      currentOverall: item.current_overall,
      delta: item.delta,
      averageScore: item.average_score == null ? null : toNumber(item.average_score),
      ratingCount: item.rating_count,
    })),
  };
}

function mapOverallHistorySnapshot(raw: RawOverallHistorySnapshot): OverallHistorySnapshot {
  return {
    players: raw.players.map((player) => ({
      playerId: player.player_id,
      displayName: player.display_name,
      isActive: player.is_active,
    })),
    matches: raw.matches.map((match) => ({
      matchId: match.match_id,
      scheduledAt: match.scheduled_at,
      location: match.location || undefined,
      points: match.points.map((point) => ({
        playerId: point.player_id,
        displayName: point.display_name,
        overall: point.overall,
      })),
    })),
  };
}

export async function login(identifier: string, password: string) {
  const data = await request<{ token: string; user: RawUser }>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

  return {
    token: data.token,
    user: mapUser(data.user),
  };
}

export async function registerAccount(values: {
  fullName: string;
  phoneNumber: string;
  username: string;
  password: string;
}) {
  const data = await request<{ token: string; user: RawUser }>("/auth/register/", {
    method: "POST",
    body: JSON.stringify({
      full_name: values.fullName,
      phone_number: values.phoneNumber,
      username: values.username,
      password: values.password,
    }),
  });

  return {
    token: data.token,
    user: mapUser(data.user),
  };
}

export async function getMe(token: string) {
  const data = await request<RawUser>("/auth/me/", undefined, token);
  return mapUser(data);
}

export async function updateMyAccount(token: string, values: AccountProfileFormValues) {
  const data = await request<RawUser>(
    "/auth/me/",
    {
      method: "PATCH",
      body: JSON.stringify({
        username: values.username,
        display_name: values.displayName,
        email: values.email,
        phone_number: values.phoneNumber,
      }),
    },
    token,
  );
  return mapUser(data);
}

export async function getPortalOverview(token: string) {
  const data = await request<RawPortalOverview>("/portal/me/overview/", undefined, token);

  return {
    user: mapUser(data.user),
    linkedPlayer: data.linked_player ? mapPlayer(data.linked_player) : null,
    finance: {
      monthlyFeeAmount: toNumber(data.financial_status.expected_monthly_fee),
      paidInReferenceMonth: toNumber(data.financial_status.paid_amount),
      pendingInReferenceMonth: toNumber(data.financial_status.pending_amount),
      outstandingBalance: toNumber(data.financial_status.outstanding_amount),
      referenceMonth: data.financial_status.reference_month,
    } satisfies PersonalFinanceSnapshot,
    attendanceSummary: {
      confirmedCount: data.attendance_status.confirmed_count,
      pendingCount: data.attendance_status.pending_count,
      declinedCount: data.attendance_status.declined_count,
      totalCount: data.attendance_status.total_count,
    },
    recentAttendance: data.recent_attendance.map(
      (item) =>
        ({
          matchId: item.match_id,
          scheduledAt: item.scheduled_at,
          attendanceStatus: item.attendance_status,
          assignedTeamName: item.assigned_team_name || null,
        }) satisfies PersonalAttendanceSnapshot,
    ),
    upcomingMatches: data.upcoming_matches.map(
      (item) =>
        ({
          matchId: item.match_id,
          scheduledAt: item.scheduled_at,
          location: item.location,
          status: item.status,
          expectedTeamCount: item.expected_team_count,
        }) satisfies UpcomingMatchSnapshot,
    ),
  };
}

export async function listUserAccounts(token: string) {
  const data = await request<RawUserAccount[]>("/users/", undefined, token);
  return data.map(mapUserAccount);
}

function toUserAccountPayload(values: AccessAccountFormValues) {
  return {
    username: values.username,
    email: values.email,
    display_name: values.displayName,
    role: values.role,
    is_active: values.isActive,
    must_change_password: values.mustChangePassword,
    linked_player: values.linkedPlayerId || null,
    password: values.password || "",
  };
}

export async function createUserAccount(token: string, values: AccessAccountFormValues) {
  const data = await request<RawUserAccount>(
    "/users/",
    {
      method: "POST",
      body: JSON.stringify(toUserAccountPayload(values)),
    },
    token,
  );
  return mapUserAccount(data);
}

export async function updateUserAccount(token: string, accountId: string, values: AccessAccountFormValues) {
  const data = await request<RawUserAccount>(
    `/users/${accountId}/`,
    {
      method: "PUT",
      body: JSON.stringify(toUserAccountPayload(values)),
    },
    token,
  );
  return mapUserAccount(data);
}

export async function resetUserAccountPassword(token: string, accountId: string, newPassword: string) {
  const data = await request<RawUserAccount>(
    `/users/${accountId}/reset-password/`,
    {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    },
    token,
  );
  return mapUserAccount(data);
}

export async function changePassword(token: string, currentPassword: string, newPassword: string) {
  const data = await request<{ token: string; user: RawUser }>(
    "/auth/change-password/",
    {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
    token,
  );

  return {
    token: data.token,
    user: mapUser(data.user),
  };
}

export async function getSeasonOverview(token: string) {
  const data = await request<RawSeasonOverview>("/analytics/season-overview/", undefined, token);
  return mapSeasonOverview(data);
}

export async function getPresenceRanking(token: string, limit = 8) {
  const data = await request<RawPresenceRanking>(`/analytics/presence-ranking/?limit=${limit}`, undefined, token);
  return mapPresenceRanking(data);
}

export async function getPaymentRanking(token: string, referenceMonth?: string, limit = 8) {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));
  if (referenceMonth) {
    searchParams.set("reference_month", referenceMonth);
  }

  const data = await request<RawPaymentRanking>(
    `/analytics/payment-ranking/?${searchParams.toString()}`,
    undefined,
    token,
  );
  return {
    referenceMonth: data.reference_month,
    ranking: mapPaymentRanking(data),
  };
}

export async function getSportsRanking(token: string, limit = 20) {
  const data = await request<RawSportsRanking>(`/analytics/sports-ranking/?limit=${limit}`, undefined, token);
  return mapSportsRanking(data);
}

export async function logout(token: string) {
  await request("/auth/logout/", { method: "POST" }, token);
}

export async function getFinancialSummary(token: string) {
  const data = await request<RawFinancialSummary>("/dashboard/financial-summary/", undefined, token);
  return mapFinancialSummary(data);
}

export async function listTransactions(token: string) {
  const data = await request<RawTransaction[]>("/transactions/", undefined, token);
  return data.map(mapTransaction);
}

function normalizeReferenceMonth(referenceMonth?: string | null) {
  if (!referenceMonth) {
    return null;
  }

  if (/^\d{4}-\d{2}$/.test(referenceMonth)) {
    return `${referenceMonth}-01`;
  }

  return referenceMonth;
}

function clampRating(value: number) {
  return Math.max(0, Math.min(99, Math.round(value)));
}

function toTransactionPayload(values: TransactionFormValues) {
  return {
    direction: values.direction,
    category: values.category,
    status: values.status,
    amount: values.amount,
    description: values.description,
    occurred_on: values.occurredOn,
    reference_month: normalizeReferenceMonth(values.referenceMonth),
    related_player: values.relatedPlayerId || null,
    notes: values.notes || "",
  };
}

export async function createTransaction(token: string, values: TransactionFormValues) {
  const data = await request<RawTransaction>(
    "/transactions/",
    {
      method: "POST",
      body: JSON.stringify(toTransactionPayload(values)),
    },
    token,
  );
  return mapTransaction(data);
}

export async function updateTransaction(token: string, transactionId: string, values: TransactionFormValues) {
  const data = await request<RawTransaction>(
    `/transactions/${transactionId}/`,
    {
      method: "PUT",
      body: JSON.stringify(toTransactionPayload(values)),
    },
    token,
  );
  return mapTransaction(data);
}

export async function voidTransaction(token: string, transactionId: string) {
  const data = await request<RawTransaction>(
    `/transactions/${transactionId}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "VOIDED" }),
    },
    token,
  );
  return mapTransaction(data);
}

export async function listPlayers(token: string) {
  const data = await request<RawPlayer[]>("/players/", undefined, token);
  return data.map(mapPlayer);
}

export async function getCurrentMatch(token: string) {
  const data = await request<RawMatch | null>("/matches/current/", undefined, token);
  return data ? mapMatch(data) : null;
}

function toMatchPayload(values: MatchFormValues) {
  return {
    scheduled_at: new Date(values.scheduledAt).toISOString(),
    location: values.location,
    expected_team_count: values.expectedTeamCount,
    status: values.status,
    notes: values.notes ?? "",
  };
}

export async function listMatches(token: string) {
  const data = await request<RawMatch[]>("/matches/", undefined, token);
  return data.map(mapMatch);
}

export async function createMatch(token: string, values: MatchFormValues) {
  const data = await request<RawMatch>(
    "/matches/",
    {
      method: "POST",
      body: JSON.stringify(toMatchPayload(values)),
    },
    token,
  );
  return mapMatch(data);
}

export async function updateMatch(token: string, matchId: string, values: MatchFormValues) {
  const data = await request<RawMatch>(
    `/matches/${matchId}/`,
    {
      method: "PUT",
      body: JSON.stringify(toMatchPayload(values)),
    },
    token,
  );
  return mapMatch(data);
}

export async function patchMatchStatus(token: string, matchId: string, status: MatchSummary["status"]) {
  const data = await request<RawMatch>(
    `/matches/${matchId}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
    token,
  );
  return mapMatch(data);
}

export async function patchMatchResult(token: string, matchId: string, resultSummary: string) {
  const data = await request<RawMatch>(
    `/matches/${matchId}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ result_summary: resultSummary }),
    },
    token,
  );
  return mapMatch(data);
}

export async function listAttendance(token: string, matchId: string) {
  const data = await request<RawAttendance[]>(`/attendance/?match=${matchId}`, undefined, token);
  return data.map(mapAttendance);
}

export async function listGuestFeeDebts(token: string) {
  const data = await request<RawAttendance[]>("/attendance/?guest_fee_due=true", undefined, token);
  return data.map(mapAttendance);
}

export async function generateTeams(token: string, matchId: string, teamCount: number) {
  return request<RawTeamGenerationResult>(
    `/matches/${matchId}/generate-teams/`,
    {
      method: "POST",
      body: JSON.stringify({ team_count: teamCount }),
    },
    token,
  );
}

export async function clearGeneratedTeams(token: string, matchId: string) {
  const data = await request<RawMatch>(
    `/matches/${matchId}/clear-teams/`,
    {
      method: "POST",
    },
    token,
  );
  return mapMatch(data);
}

export async function downloadMatchStatsSheet(token: string, matchId: string) {
  return requestBlob(`/matches/${matchId}/stats-sheet/`, undefined, token);
}

export async function importMatchStatsSheet(token: string, matchId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const data = await request<RawMatchStatsImportSummary>(
    `/matches/${matchId}/import-stats-sheet/`,
    {
      method: "POST",
      body: formData,
    },
    token,
  );
  return mapMatchStatsImportSummary(data);
}

export async function getMatchPlayerRatings(token: string, matchId: string) {
  const data = await request<RawMatchPlayerRatingState>(
    `/matches/${matchId}/player-ratings/`,
    undefined,
    token,
  );
  return mapMatchPlayerRatingState(data);
}

export async function getOverallHistory(token: string) {
  const data = await request<RawOverallHistorySnapshot>(
    "/matches/overall-history/",
    undefined,
    token,
  );
  return mapOverallHistorySnapshot(data);
}

export async function submitMatchPlayerRatings(
  token: string,
  matchId: string,
  ratings: Array<{ attendanceId: string; score: number }>,
) {
  const data = await request<RawMatchPlayerRatingState>(
    `/matches/${matchId}/player-ratings/`,
    {
      method: "POST",
      body: JSON.stringify({
        ratings: ratings.map((rating) => ({
          attendance_id: rating.attendanceId,
          score: rating.score,
        })),
      }),
    },
    token,
  );
  return mapMatchPlayerRatingState(data);
}

export async function finalizeMatchRatings(token: string, matchId: string) {
  const data = await request<RawMatchPlayerRatingState>(
    `/matches/${matchId}/finalize-ratings/`,
    {
      method: "POST",
    },
    token,
  );
  return mapMatchPlayerRatingState(data);
}

export async function recalculateMatchRatings(token: string, matchId: string) {
  const data = await request<RawMatchPlayerRatingState>(
    `/matches/${matchId}/recalculate-ratings/`,
    {
      method: "POST",
    },
    token,
  );
  return mapMatchPlayerRatingState(data);
}

function toPlayerPayload(values: PlayerFormValues) {
  return {
    full_name: values.fullName,
    nickname: values.nickname,
    player_type: "MEMBER",
    preferred_position: values.preferredPosition,
    monthly_fee_amount: values.monthlyFeeAmount,
    shirt_number: values.shirtNumber ?? null,
    email: values.email ?? "",
    phone_number: values.phoneNumber ?? "",
    joined_on: values.joinedOn || null,
    is_active: values.isActive,
    notes: values.notes ?? "",
    overall: clampRating(values.ratings.overall),
  };
}

export async function createPlayer(token: string, values: PlayerFormValues) {
  const data = await request<RawPlayer>(
    "/players/",
    {
      method: "POST",
      body: JSON.stringify(toPlayerPayload(values)),
    },
    token,
  );
  return mapPlayer(data);
}

export async function updatePlayer(token: string, playerId: string, values: PlayerFormValues) {
  const data = await request<RawPlayer>(
    `/players/${playerId}/`,
    {
      method: "PUT",
      body: JSON.stringify(toPlayerPayload(values)),
    },
    token,
  );
  return mapPlayer(data);
}

export async function patchPlayerStatus(token: string, playerId: string, isActive: boolean) {
  const data = await request<RawPlayer>(
    `/players/${playerId}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    },
    token,
  );
  return mapPlayer(data);
}

export async function createAttendanceForPlayer(
  token: string,
  matchId: string,
  player: PlayerSummary,
) {
  const data = await request<RawAttendance>(
    "/attendance/",
    {
      method: "POST",
      body: JSON.stringify({
        match: matchId,
        player: player.id,
        display_name: player.fullName,
        is_guest: false,
        attendance_status: "CONFIRMED",
        overall: player.ratings.overall,
      }),
    },
    token,
  );
  return mapAttendance(data);
}

export async function createGuestAttendance(
  token: string,
  matchId: string,
  values: GuestFormValues,
) {
  const data = await request<RawAttendance>(
    "/attendance/",
    {
      method: "POST",
      body: JSON.stringify({
        match: matchId,
        player: null,
        display_name: values.displayName,
        is_guest: true,
        attendance_status: "CONFIRMED",
        invited_by: values.invitedById ?? null,
        notes: values.notes ?? "",
        overall: values.ratings.overall,
      }),
    },
    token,
  );
  return mapAttendance(data);
}

export async function updateAttendanceStatus(
  token: string,
  attendanceId: string,
  nextStatus: AttendanceEntry["attendanceStatus"],
) {
  const data = await request<RawAttendance>(
    `/attendance/${attendanceId}/`,
    {
      method: "PATCH",
      body: JSON.stringify({ attendance_status: nextStatus }),
    },
    token,
  );
  return mapAttendance(data);
}

export async function deleteAttendance(token: string, attendanceId: string) {
  await request(`/attendance/${attendanceId}/`, { method: "DELETE" }, token);
}

export async function markGuestFeePaid(token: string, attendanceId: string) {
  const data = await request<RawAttendance>(
    `/attendance/${attendanceId}/mark-guest-fee-paid/`,
    { method: "POST" },
    token,
  );
  return mapAttendance(data);
}

export async function waiveGuestFee(token: string, attendanceId: string) {
  const data = await request<RawAttendance>(
    `/attendance/${attendanceId}/waive-guest-fee/`,
    { method: "POST" },
    token,
  );
  return mapAttendance(data);
}
