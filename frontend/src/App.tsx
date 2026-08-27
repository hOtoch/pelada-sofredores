import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import sofradoresLogo from "./assets/sofredores-logo.png";
import { DashboardPage } from "./pages/DashboardPage";
import { AccountsPage } from "./pages/AccountsPage";
import { CommonUserPortalPage } from "./pages/CommonUserPortalPage";
import { LoginPage } from "./pages/LoginPage";
import { MyAccountPage } from "./pages/MyAccountPage";
import { PreMatchPage } from "./pages/PreMatchPage";
import { RankingPage } from "./pages/RankingPage";
import { RosterPage } from "./pages/RosterPage";
import type { TransactionFormValues } from "./features/dashboard/contracts";
import type {
  DashboardPaymentRankingEntry,
  DashboardPresenceRankingEntry,
  DashboardSeasonOverviewSnapshot,
} from "./features/dashboard/analytics";
import type {
  AttendanceEntry,
  AuthenticatedUser,
  CashFlowSummary,
  GeneratedTeam,
  MatchPlayerRatingInput,
  MatchPlayerRatingState,
  MatchStatsImportSummary,
  MatchSummary,
  OverallHistorySnapshot,
  PlayerSummary,
  SportsRankingSnapshot,
  TransactionRecord,
} from "./domain/types";
import type {
  PersonalAttendanceSnapshot,
  PersonalFinanceSnapshot,
  PortalCashSnapshot,
  RecentTeamSnapshot,
  UpcomingMatchSnapshot,
} from "./features/profile/contracts";
import type { AccountProfileFormValues, SignupFormValues } from "./features/auth/contracts";
import type { GuestFormValues, MatchFormValues } from "./features/pre-match/contracts";
import type {
  AccessAccountFormValues,
  AccessAccountSummary,
  PlayerFilterState,
  PlayerFormValues,
} from "./features/roster/contracts";
import {
  AUTH_TOKEN_KEY,
  changePassword,
  clearGeneratedTeams,
  createMatch as createMatchRequest,
  createAttendanceForPlayer,
  createGuestAttendance,
  createPlayer as createPlayerRequest,
  createTransaction as createTransactionRequest,
  deleteAttendance as deleteAttendanceRequest,
  downloadMatchStatsSheet,
  patchMatchStatus as patchMatchStatusRequest,
  finalizeMatch as finalizeMatchRequest,
  finalizeMatchRatings,
  generateTeams,
  getCurrentMatch,
  getFinancialSummary,
  getMatchPlayerRatings,
  getMe,
  getPaymentRanking,
  getPortalOverview,
  getPresenceRanking,
  getSeasonOverview,
  getSportsRanking,
  getOverallHistory,
  importMatchStatsSheet,
  listAttendance,
  listGuestFeeDebts,
  listMatches,
  listPlayers,
  listTransactions,
  listUserAccounts,
  login,
  logout,
  mapGeneratedTeams,
  markGuestFeePaid as markGuestFeePaidRequest,
  patchPlayerStatus,
  recalculateMatchRatings,
  resetUserAccountPassword,
  registerAccount,
  createUserAccount as createUserAccountRequest,
  submitMatchPlayerRatings,
  swapTeamPlayers,
  updateMatch as updateMatchRequest,
  updateMyAccount,
  updateTransaction as updateTransactionRequest,
  updatePlayer as updatePlayerRequest,
  updateUserAccount as updateUserAccountRequest,
  voidTransaction as voidTransactionRequest,
  waiveGuestFee as waiveGuestFeeRequest,
} from "./lib/api";

type NavigationIcon =
  "finance" | "roster" | "accounts" | "match" | "ratings" | "ranking" | "portal" | "my-account";

type NavigationItem = {
  label: string;
  path: string;
  icon: NavigationIcon;
};

const adminNavigation: NavigationItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: "finance" },
  { label: "Elenco", path: "/roster", icon: "roster" },
  { label: "Contas", path: "/accounts", icon: "accounts" },
  { label: "Pré-Jogo", path: "/pre-match", icon: "match" },
  { label: "Ranking", path: "/ranking", icon: "ranking" },
  { label: "Notas", path: "/ratings", icon: "ratings" },
  { label: "Minha conta", path: "/my-account", icon: "my-account" },
];

const commonNavigation: NavigationItem[] = [
  { label: "Painel", path: "/portal", icon: "finance" },
  { label: "Elenco", path: "/roster", icon: "roster" },
  { label: "Peladas", path: "/pre-match", icon: "match" },
  { label: "Ranking", path: "/ranking", icon: "ranking" },
  { label: "Notas", path: "/ratings", icon: "ratings" },
  { label: "Minha conta", path: "/my-account", icon: "my-account" },
];

const emptyCashFlow: CashFlowSummary = {
  currentBalance: 0,
  inflowTotal: 0,
  outflowTotal: 0,
  pendingTotal: 0,
};

const defaultRosterFilters: PlayerFilterState = {
  search: "",
  position: "ALL",
  status: "ACTIVE",
};

const emptySportsRanking: SportsRankingSnapshot = {
  topScorers: [],
  topAssistants: [],
  topWinners: [],
};

const currentReferenceMonth = () => new Date().toISOString().slice(0, 7);

const roleLabels = {
  ADMIN: "Administrador",
  COMMON: "Jogador",
} as const;

const ratingWindowDurationMs = 24 * 60 * 60 * 1000;

const getRatingWindowStartedAt = (match: MatchSummary) => {
  const timestamp = Date.parse(match.archivedAt ?? match.updatedAt ?? match.scheduledAt);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isRatingWindowOpen = (match: MatchSummary) => {
  if (match.status !== "ARCHIVED" || match.ratingsFinalizedAt) {
    return false;
  }

  const startedAt = getRatingWindowStartedAt(match);
  return startedAt !== null && Date.now() < startedAt + ratingWindowDurationMs;
};

const getLatestArchivedMatch = (matches: MatchSummary[]) =>
  [...matches]
    .filter((match) => match.status === "ARCHIVED")
    .sort((left, right) => {
      const leftArchivedAt = Date.parse(left.archivedAt ?? left.updatedAt ?? left.scheduledAt);
      const rightArchivedAt = Date.parse(right.archivedAt ?? right.updatedAt ?? right.scheduledAt);
      return (
        (Number.isFinite(rightArchivedAt) ? rightArchivedAt : 0) -
          (Number.isFinite(leftArchivedAt) ? leftArchivedAt : 0) ||
        right.scheduledAt.localeCompare(left.scheduledAt)
      );
    })[0] ?? null;

const getOpenRatingWindowMatch = (matches: MatchSummary[]) =>
  [...matches].filter(isRatingWindowOpen).sort((left, right) => {
    const leftStartedAt = getRatingWindowStartedAt(left) ?? 0;
    const rightStartedAt = getRatingWindowStartedAt(right) ?? 0;
    return rightStartedAt - leftStartedAt || right.scheduledAt.localeCompare(left.scheduledAt);
  })[0] ?? null;

function SidebarNavIcon({ icon }: { icon: NavigationIcon }) {
  switch (icon) {
    case "finance":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.6" />
          <path d="M3.5 9.2h17" />
          <circle cx="12" cy="12.4" r="2.35" />
          <path d="M7 12.4h.01M17 12.4h.01" />
        </svg>
      );
    case "roster":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="2.6" />
          <path d="M4.8 18c.5-2.35 2.6-4 5.2-4 2.58 0 4.68 1.65 5.18 4" />
          <path d="M16.6 14.1c1.6.36 2.82 1.66 3.14 3.26" />
          <path d="M15.8 6.9a2.15 2.15 0 1 1 0 4.3" />
        </svg>
      );
    case "accounts":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="6" width="17" height="12" rx="2.4" />
          <circle cx="9" cy="11" r="2.1" />
          <path d="M6.1 15.6c.8-1.55 5-1.55 5.8 0" />
          <path d="M14.5 10.2h3.6M14.5 12.7h3.6M14.5 15.2h2.4" />
        </svg>
      );
    case "portal":
    case "my-account":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8.3" r="2.9" />
          <path d="M6.1 18.2c.8-2.7 3.14-4.5 5.9-4.5 2.74 0 5.06 1.8 5.86 4.5" />
          {icon === "my-account" ? <path d="M17.9 8.1h2.2M19 7v2.2" /> : null}
        </svg>
      );
    case "match":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.1" />
          <path d="M12 5.5v13" />
          <circle cx="12" cy="12" r="2.25" />
          <path d="M3.5 9.2h2.8v5.6H3.5M20.5 9.2h-2.8v5.6h2.8" />
        </svg>
      );
    case "ratings":
    case "ranking":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {icon === "ranking" ? (
            <>
              <path d="M7 20V10.5h3.8V20M10.1 20V5h3.8v15M13.2 20v-7h3.8v7" />
              <path d="M4.2 20h15.6" />
            </>
          ) : (
            <>
              <path d="M12 3.8l2.35 4.76 5.25.76-3.8 3.7.9 5.22L12 15.78l-4.7 2.46.9-5.22-3.8-3.7 5.25-.76L12 3.8z" />
              <path d="M9.2 11.9l1.8 1.8 3.9-4.1" />
            </>
          )}
        </svg>
      );
    default:
      return null;
  }
}

const emptyPortalCash: PortalCashSnapshot = {
  currentBalance: 0,
  pendingTotal: 0,
};

const emptyPortalFinance: PersonalFinanceSnapshot = {
  monthlyFeeAmount: 0,
  paidInReferenceMonth: 0,
  pendingInReferenceMonth: 0,
  outstandingBalance: 0,
  referenceMonth: currentReferenceMonth(),
};

function deriveGeneratedTeams(entries: AttendanceEntry[]) {
  const teamsByNumber = new Map<number, GeneratedTeam>();

  entries
    .filter((entry) => entry.assignedTeamNumber != null)
    .forEach((entry) => {
      const teamNumber = entry.assignedTeamNumber as number;
      const existing = teamsByNumber.get(teamNumber);

      if (existing) {
        existing.players.push(entry);
        existing.totalOverall += entry.ratings.overall;
        existing.averageOverall = existing.totalOverall / existing.players.length;
        return;
      }

      teamsByNumber.set(teamNumber, {
        name: entry.assignedTeamName || `Time ${teamNumber}`,
        players: [entry],
        totalOverall: entry.ratings.overall,
        averageOverall: entry.ratings.overall,
      });
    });

  return Array.from(teamsByNumber.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, team]) => team);
}

function calculateAverageOverallGap(teams: GeneratedTeam[]) {
  if (teams.length < 2) {
    return null;
  }

  const averages = teams.map((team) => team.averageOverall);
  return Math.max(...averages) - Math.min(...averages);
}

function buildPortalRecentTeams(
  recentAttendance: PersonalAttendanceSnapshot[],
  matches: MatchSummary[],
): RecentTeamSnapshot[] {
  const matchesById = new Map(matches.map((match) => [match.id, match]));

  return recentAttendance
    .filter((item) => item.assignedTeamName || item.assignedTeamNumber)
    .map((item) => {
      const match = matchesById.get(item.matchId);
      return {
        matchId: item.matchId,
        scheduledAt: item.scheduledAt,
        teamName: item.assignedTeamName || `Time ${item.assignedTeamNumber}`,
        teammates: [],
        averageOverall: null,
        resultSummary: match?.resultSummary ?? null,
      };
    });
}

function downloadBlobFile(filename: string, blob: Blob) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function formatStatsImportSummary(summary: MatchStatsImportSummary) {
  const winningTeamsLabel =
    summary.winningTeams.length > 0 ? summary.winningTeams.join(", ") : "nenhum time marcado";
  return `${summary.playersProcessed} jogador(es), ${summary.goalsTotal} gol(s), ${summary.assistsTotal} assistência(s), vencedor: ${winningTeamsLabel}.`;
}

type ToastTone = "success" | "error" | "warning";

type AppToast = {
  id: number;
  tone: ToastTone;
  message: string;
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginRoute = location.pathname === "/login";
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(token));
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isCreatingPublicAccount, setIsCreatingPublicAccount] = useState(false);
  const [loginError, setLoginError] = useState<string>();
  const [signupError, setSignupError] = useState<string>();
  const [screenError, setScreenError] = useState<string>();
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [summary, setSummary] = useState<CashFlowSummary>(emptyCashFlow);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [guestFeeDebts, setGuestFeeDebts] = useState<AttendanceEntry[]>([]);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [accounts, setAccounts] = useState<AccessAccountSummary[]>([]);
  const [seasonOverview, setSeasonOverview] = useState<DashboardSeasonOverviewSnapshot | null>(
    null,
  );
  const [presenceRanking, setPresenceRanking] = useState<DashboardPresenceRankingEntry[]>([]);
  const [paymentRanking, setPaymentRanking] = useState<DashboardPaymentRankingEntry[]>([]);
  const [sportsRanking, setSportsRanking] = useState<SportsRankingSnapshot>(emptySportsRanking);
  const [portalLinkedPlayer, setPortalLinkedPlayer] = useState<PlayerSummary | null>(null);
  const [portalFinance, setPortalFinance] = useState<PersonalFinanceSnapshot>(emptyPortalFinance);
  const [portalCash, setPortalCash] = useState<PortalCashSnapshot>(emptyPortalCash);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const hasAnimatedNavRef = useRef(false);
  const [portalRecentAttendance, setPortalRecentAttendance] = useState<
    PersonalAttendanceSnapshot[]
  >([]);
  const [portalUpcomingMatches, setPortalUpcomingMatches] = useState<UpcomingMatchSnapshot[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [currentMatch, setCurrentMatch] = useState<MatchSummary | null>(null);
  const [overallHistory, setOverallHistory] = useState<OverallHistorySnapshot | null>(null);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [generatedTeams, setGeneratedTeams] = useState<GeneratedTeam[]>([]);
  const [averageOverallGap, setAverageOverallGap] = useState<number | null>(null);
  const [matchRatingState, setMatchRatingState] = useState<MatchPlayerRatingState | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [isPreMatchLoading, setIsPreMatchLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [isGeneratingTeams, setIsGeneratingTeams] = useState(false);
  const [isClearingTeams, setIsClearingTeams] = useState(false);
  const [isSwappingTeamPlayers, setIsSwappingTeamPlayers] = useState(false);
  const [isSubmittingMatch, setIsSubmittingMatch] = useState(false);
  const [isImportingStatsSheet, setIsImportingStatsSheet] = useState(false);
  const [isSubmittingRatings, setIsSubmittingRatings] = useState(false);
  const [isFinalizingRatings, setIsFinalizingRatings] = useState(false);
  const [isRecalculatingRatings, setIsRecalculatingRatings] = useState(false);
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const [isSubmittingRoster, setIsSubmittingRoster] = useState(false);
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false);
  const [rosterFilters, setRosterFilters] = useState<PlayerFilterState>(defaultRosterFilters);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const fetchFinancialData = async (authToken: string) =>
    Promise.all([
      getFinancialSummary(authToken),
      listTransactions(authToken),
      listGuestFeeDebts(authToken),
    ]);

  const fetchPortalData = async (authToken: string) => getPortalOverview(authToken);

  const fetchAdminData = async (authToken: string) => {
    const referenceMonth = currentReferenceMonth();
    const [userAccounts, overview, presence, payment] = await Promise.all([
      listUserAccounts(authToken),
      getSeasonOverview(authToken),
      getPresenceRanking(authToken, 8),
      getPaymentRanking(authToken, referenceMonth, 8),
    ]);

    return {
      userAccounts,
      overview,
      presence,
      paymentRanking: payment.ranking,
    };
  };

  const fetchMatchData = async (authToken: string, preferredMatchId?: string | null) => {
    const [openMatch, allMatches] = await Promise.all([
      getCurrentMatch(authToken),
      listMatches(authToken),
    ]);
    const latestArchivedMatch = getLatestArchivedMatch(allMatches);
    const openRatingWindowMatch = getOpenRatingWindowMatch(allMatches);
    const currentSelectedMatch = currentMatch
      ? allMatches.find((entry) => entry.id === currentMatch.id)
      : null;
    const shouldPreferLatestArchivedMatch = location.pathname === "/ratings";

    const nextMatch =
      (preferredMatchId ? allMatches.find((entry) => entry.id === preferredMatchId) : null) ??
      (shouldPreferLatestArchivedMatch
        ? (latestArchivedMatch ?? currentSelectedMatch)
        : currentSelectedMatch) ??
      (!shouldPreferLatestArchivedMatch ? openRatingWindowMatch : null) ??
      (openMatch ? (allMatches.find((entry) => entry.id === openMatch.id) ?? openMatch) : null) ??
      allMatches[0] ??
      null;

    return {
      matches: allMatches,
      selectedMatch: nextMatch,
    };
  };

  const dismissToast = (toastId: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  };

  const pushToast = (tone: ToastTone, message: string) => {
    const toastId = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id: toastId, tone, message }]);
    window.setTimeout(() => {
      dismissToast(toastId);
    }, 4200);
  };

  const reportSuccess = (message: string) => {
    setScreenError(undefined);
    pushToast("success", message);
  };

  const reportError = (fallbackMessage: string, error: unknown) => {
    const message = error instanceof Error ? error.message : fallbackMessage;
    setScreenError(message);
    pushToast("error", message);
    return message;
  };

  const applyAdminData = (adminData: Awaited<ReturnType<typeof fetchAdminData>> | null) => {
    if (!adminData) {
      setAccounts([]);
      setSeasonOverview(null);
      setPresenceRanking([]);
      setPaymentRanking([]);
      return;
    }

    setAccounts(adminData.userAccounts);
    setSeasonOverview(adminData.overview);
    setPresenceRanking(adminData.presence);
    setPaymentRanking(adminData.paymentRanking);
  };

  // Abertura do menu no celular. No desktop o bloco fica sempre visivel, entao
  // qualquer estilo inline aplicado aqui e limpo.
  useEffect(() => {
    const menu = navMenuRef.current;
    if (!menu) {
      return;
    }

    const mobileQuery = window.matchMedia("(max-width: 900px)");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const applyState = () => {
      const context = gsap.context(() => {
        if (!mobileQuery.matches) {
          gsap.set(menu, { clearProps: "all" });
          return;
        }

        // na primeira renderizacao o estado inicial e aplicado sem animar
        const isFirstRun = !hasAnimatedNavRef.current;
        const duration = isFirstRun || prefersReducedMotion ? 0 : 0.34;

        if (isNavOpen) {
          gsap.fromTo(
            menu,
            { height: 0, autoAlpha: 0 },
            { height: "auto", autoAlpha: 1, duration, ease: "power3.out" },
          );
          gsap.fromTo(
            menu.querySelectorAll(".side-user-card, .nav-link, .nav-footer"),
            { y: -12, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: duration ? 0.26 : 0,
              stagger: duration ? 0.04 : 0,
              ease: "power2.out",
              delay: duration ? 0.08 : 0,
              clearProps: "transform",
            },
          );
        } else {
          gsap.to(menu, {
            height: 0,
            autoAlpha: 0,
            duration: duration ? 0.22 : 0,
            ease: "power2.in",
          });
        }

        hasAnimatedNavRef.current = true;
      }, menu);

      return context;
    };

    let context = applyState();
    const handleBreakpointChange = () => {
      context?.revert();
      context = applyState();
    };

    mobileQuery.addEventListener("change", handleBreakpointChange);

    return () => {
      mobileQuery.removeEventListener("change", handleBreakpointChange);
      context?.revert();
    };
    // currentUser entra nas dependencias porque o menu so existe depois do login
  }, [currentUser, isNavOpen]);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      setAccounts([]);
      setGuestFeeDebts([]);
      setOverallHistory(null);
      setSeasonOverview(null);
      setPresenceRanking([]);
      setPaymentRanking([]);
      setSportsRanking(emptySportsRanking);
      setPortalLinkedPlayer(null);
      setPortalFinance(emptyPortalFinance);
      setPortalCash(emptyPortalCash);
      setPortalCash(emptyPortalCash);
      setPortalRecentAttendance([]);
      setPortalUpcomingMatches([]);
      setIsAuthLoading(false);
      return;
    }

    let isCancelled = false;

    const restoreSession = async () => {
      try {
        const user = await getMe(token);
        if (!isCancelled) {
          setCurrentUser(user);
          setLoginError(undefined);
        }
      } catch {
        if (!isCancelled) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          setToken(null);
          setCurrentUser(null);
          setLoginError("Sua sessão expirou. Entre novamente.");
        }
      } finally {
        if (!isCancelled) {
          setIsAuthLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!currentUser || !token) {
      return;
    }

    let isCancelled = false;

    const loadData = async () => {
      setScreenError(undefined);
      setIsDashboardLoading(true);
      setIsRosterLoading(true);
      setIsPreMatchLoading(true);
      setIsPortalLoading(currentUser.role === "COMMON");
      setIsRankingLoading(true);

      try {
        const adminPromise =
          currentUser.role === "ADMIN" ? fetchAdminData(token) : Promise.resolve(null);
        const portalPromise =
          currentUser.role === "COMMON" ? fetchPortalData(token) : Promise.resolve(null);

        const financePromise =
          currentUser.role === "ADMIN"
            ? fetchFinancialData(token)
            : Promise.all([
                Promise.resolve(emptyCashFlow),
                listTransactions(token),
                listGuestFeeDebts(token),
              ] as const);

        const [
          [financialSummary, ledger, nextGuestFeeDebts],
          squad,
          matchData,
          overallHistoryData,
          sportsRankingData,
          portalData,
          adminData,
        ] = await Promise.all([
          financePromise,
          listPlayers(token),
          fetchMatchData(token),
          getOverallHistory(token),
          getSportsRanking(token, 20),
          portalPromise,
          adminPromise,
        ]);

        if (isCancelled) {
          return;
        }

        setSummary(financialSummary);
        setTransactions(ledger);
        setGuestFeeDebts(nextGuestFeeDebts);
        setPlayers(squad);
        setOverallHistory(overallHistoryData);
        setSportsRanking(sportsRankingData);
        const visibleMatches = matchData.matches;
        const visibleCurrentMatch =
          currentUser.role === "COMMON"
            ? (visibleMatches.find((entry) => entry.id === matchData.selectedMatch?.id) ??
              visibleMatches[0] ??
              null)
            : matchData.selectedMatch;

        setMatches(visibleMatches);
        setCurrentMatch(visibleCurrentMatch);
        if (portalData) {
          setPortalLinkedPlayer(portalData.linkedPlayer);
          setPortalFinance(portalData.finance);
          setPortalCash(portalData.cash);
          setPortalCash(portalData.cash);
          setPortalRecentAttendance(portalData.recentAttendance);
          setPortalUpcomingMatches(portalData.upcomingMatches);
        } else {
          setPortalLinkedPlayer(null);
          setPortalFinance(emptyPortalFinance);
          setPortalCash(emptyPortalCash);
          setPortalCash(emptyPortalCash);
          setPortalCash(emptyPortalCash);
          setPortalRecentAttendance([]);
          setPortalUpcomingMatches([]);
        }
        applyAdminData(adminData);
      } catch (error) {
        if (!isCancelled) {
          setScreenError(
            error instanceof Error ? error.message : "Nao foi possível sincronizar os dados.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsDashboardLoading(false);
          setIsRosterLoading(false);
          setIsPreMatchLoading(false);
          setIsPortalLoading(false);
          setIsRankingLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [currentUser, token]);

  useEffect(() => {
    if (!token || !currentMatch) {
      setAttendance([]);
      setGeneratedTeams([]);
      setAverageOverallGap(null);
      setMatchRatingState(null);
      return;
    }

    let isCancelled = false;

    const loadAttendance = async () => {
      setIsPreMatchLoading(true);
      setScreenError(undefined);

      try {
        const [entries, ratingState] = await Promise.all([
          listAttendance(token, currentMatch.id),
          getMatchPlayerRatings(token, currentMatch.id).catch(() => null),
        ]);
        if (!isCancelled) {
          const derivedTeams = deriveGeneratedTeams(entries);
          setAttendance(entries);
          setGeneratedTeams(derivedTeams);
          setAverageOverallGap(calculateAverageOverallGap(derivedTeams));
          setMatchRatingState(ratingState);
          if (
            ratingState?.ratingsFinalizedAt &&
            currentMatch.ratingsFinalizedAt !== ratingState.ratingsFinalizedAt
          ) {
            setCurrentMatch((prev) =>
              prev?.id === currentMatch.id
                ? { ...prev, ratingsFinalizedAt: ratingState.ratingsFinalizedAt }
                : prev,
            );
            setMatches((prev) =>
              prev.map((entry) =>
                entry.id === currentMatch.id
                  ? { ...entry, ratingsFinalizedAt: ratingState.ratingsFinalizedAt }
                  : entry,
              ),
            );
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setScreenError(
            error instanceof Error ? error.message : "Falha ao carregar a presença da pelada.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsPreMatchLoading(false);
        }
      }
    };

    void loadAttendance();

    return () => {
      isCancelled = true;
    };
  }, [currentMatch, token]);

  useEffect(() => {
    if (location.pathname !== "/ratings" || matches.length === 0) {
      return;
    }

    const latestArchivedMatch = getLatestArchivedMatch(matches);
    if (latestArchivedMatch && latestArchivedMatch.id !== currentMatch?.id) {
      setCurrentMatch(latestArchivedMatch);
    }
  }, [currentMatch?.id, location.pathname, matches]);

  const handleLogin = async (identifier: string, password: string) => {
    setIsSubmittingLogin(true);
    setLoginError(undefined);
    setSignupError(undefined);

    try {
      const session = await login(identifier, password);
      localStorage.setItem(AUTH_TOKEN_KEY, session.token);
      setToken(session.token);
      setCurrentUser(session.user);
      navigate(
        session.user.mustChangePassword
          ? "/my-account"
          : session.user.role === "COMMON"
            ? "/portal"
            : "/dashboard",
        { replace: true },
      );
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Falha ao autenticar.");
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handlePublicSignup = async (values: SignupFormValues) => {
    setIsCreatingPublicAccount(true);
    setLoginError(undefined);
    setSignupError(undefined);

    try {
      const session = await registerAccount(values);
      localStorage.setItem(AUTH_TOKEN_KEY, session.token);
      setToken(session.token);
      setCurrentUser(session.user);
      navigate(session.user.mustChangePassword ? "/my-account" : "/portal", { replace: true });
    } catch (error) {
      setSignupError(error instanceof Error ? error.message : "Falha ao criar conta.");
      throw error;
    } finally {
      setIsCreatingPublicAccount(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await logout(token);
      } catch {
        // Ignore logout failures and clear the local session anyway.
      }
    }

    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setCurrentUser(null);
    setAccounts([]);
    setSeasonOverview(null);
    setPresenceRanking([]);
    setPaymentRanking([]);
    setSportsRanking(emptySportsRanking);
    setPortalLinkedPlayer(null);
    setPortalFinance(emptyPortalFinance);
    setPortalCash(emptyPortalCash);
    setPortalRecentAttendance([]);
    setPortalUpcomingMatches([]);
    setMatches([]);
    setCurrentMatch(null);
    setAttendance([]);
    setGeneratedTeams([]);
    setAverageOverallGap(null);
    setMatchRatingState(null);
    navigate("/login", { replace: true });
  };

  const handleGenerateTeams = async (teamCount: number) => {
    if (!token || !currentMatch) {
      return;
    }

    setIsGeneratingTeams(true);
    setScreenError(undefined);

    try {
      const result = await generateTeams(token, currentMatch.id, teamCount);
      const refreshedAttendance = await listAttendance(token, currentMatch.id);
      setAttendance(refreshedAttendance);
      const mapped = mapGeneratedTeams(result, refreshedAttendance);
      setGeneratedTeams(mapped.teams);
      setAverageOverallGap(mapped.averageOverallGap);
      reportSuccess("Times equilibrados gerados com sucesso.");
    } catch (error) {
      reportError("Falha ao gerar times.", error);
    } finally {
      setIsGeneratingTeams(false);
    }
  };

  const handleClearGeneratedTeams = async () => {
    if (!token || !currentMatch) {
      return;
    }

    setIsClearingTeams(true);
    setScreenError(undefined);

    try {
      const updatedMatch = await clearGeneratedTeams(token, currentMatch.id);
      const refreshedAttendance = await listAttendance(token, currentMatch.id);
      setAttendance(refreshedAttendance);
      setMatches((prev) =>
        prev.map((entry) => (entry.id === updatedMatch.id ? updatedMatch : entry)),
      );
      setCurrentMatch(updatedMatch);
      resetGeneratedTeams();
      reportSuccess("Times desfeitos. Gere uma nova sugestão quando quiser.");
    } catch (error) {
      reportError("Falha ao desfazer times.", error);
    } finally {
      setIsClearingTeams(false);
    }
  };

  const handleSwapTeamPlayers = async (sourceAttendanceId: string, targetAttendanceId: string) => {
    if (!token || !currentMatch) {
      return;
    }

    setIsSwappingTeamPlayers(true);
    setScreenError(undefined);

    try {
      const refreshedAttendance = await swapTeamPlayers(
        token,
        currentMatch.id,
        sourceAttendanceId,
        targetAttendanceId,
      );
      const nextTeams = deriveGeneratedTeams(refreshedAttendance);
      setAttendance(refreshedAttendance);
      setGeneratedTeams(nextTeams);
      setAverageOverallGap(calculateAverageOverallGap(nextTeams));
      reportSuccess("Jogadores trocados entre os times.");
    } catch (error) {
      reportError("Falha ao trocar jogadores entre os times.", error);
    } finally {
      setIsSwappingTeamPlayers(false);
    }
  };

  const handleExportStatsSheet = async () => {
    if (!token || !currentMatch) {
      return;
    }

    setScreenError(undefined);

    try {
      const { blob, filename } = await downloadMatchStatsSheet(token, currentMatch.id);
      downloadBlobFile(filename, blob);
      reportSuccess("Planilha da pelada exportada.");
    } catch (error) {
      reportError("Falha ao exportar a planilha da pelada.", error);
      throw error;
    }
  };

  const handleImportStatsSheet = async (file: File) => {
    if (!token || !currentMatch) {
      return;
    }

    setIsImportingStatsSheet(true);
    setScreenError(undefined);

    try {
      const summary = await importMatchStatsSheet(token, currentMatch.id, file);
      const nextSportsRanking = await getSportsRanking(token, 20);
      setSportsRanking(nextSportsRanking);
      reportSuccess(`Planilha importada. ${formatStatsImportSummary(summary)}`);
    } catch (error) {
      reportError("Falha ao importar a planilha preenchida.", error);
      throw error;
    } finally {
      setIsImportingStatsSheet(false);
    }
  };

  const handleSubmitPlayerRatings = async (ratings: MatchPlayerRatingInput[]) => {
    if (!token || !currentMatch) {
      return;
    }

    setIsSubmittingRatings(true);
    setScreenError(undefined);

    try {
      const nextRatingState = await submitMatchPlayerRatings(token, currentMatch.id, ratings);
      const [nextPlayers, nextAttendance] = await Promise.all([
        listPlayers(token),
        listAttendance(token, currentMatch.id),
      ]);
      setMatchRatingState(nextRatingState);
      setPlayers(nextPlayers);
      setAttendance(nextAttendance);
      reportSuccess("Notas enviadas. Overalls serão atualizados ao final da janela de 24h.");
    } catch (error) {
      reportError("Falha ao enviar notas.", error);
      throw error;
    } finally {
      setIsSubmittingRatings(false);
    }
  };

  const handleFinalizeRatings = async () => {
    if (!token || !currentMatch) {
      return;
    }

    setIsFinalizingRatings(true);
    setScreenError(undefined);

    try {
      const nextRatingState = await finalizeMatchRatings(token, currentMatch.id);
      const [nextPlayers, matchData, nextAttendance, overallHistoryData] = await Promise.all([
        listPlayers(token),
        fetchMatchData(token, currentMatch.id),
        listAttendance(token, currentMatch.id),
        getOverallHistory(token),
      ]);
      setMatchRatingState(nextRatingState);
      setPlayers(nextPlayers);
      setMatches(matchData.matches);
      setCurrentMatch(matchData.selectedMatch);
      setAttendance(nextAttendance);
      setOverallHistory(overallHistoryData);
      reportSuccess("Janela de notas finalizada e overalls atualizados.");
    } catch (error) {
      reportError("Falha ao finalizar a janela de notas.", error);
      throw error;
    } finally {
      setIsFinalizingRatings(false);
    }
  };

  const handleRecalculateRatings = async () => {
    if (!token || !currentMatch) {
      return;
    }

    setIsRecalculatingRatings(true);
    setScreenError(undefined);

    try {
      const nextRatingState = await recalculateMatchRatings(token, currentMatch.id);
      const [nextPlayers, nextAttendance, overallHistoryData] = await Promise.all([
        listPlayers(token),
        listAttendance(token, currentMatch.id),
        getOverallHistory(token),
      ]);
      setMatchRatingState(nextRatingState);
      setPlayers(nextPlayers);
      setAttendance(nextAttendance);
      setOverallHistory(overallHistoryData);
      reportSuccess("Overalls recalculados com a regra atual.");
    } catch (error) {
      reportError("Falha ao recalcular os overalls.", error);
      throw error;
    } finally {
      setIsRecalculatingRatings(false);
    }
  };

  const handleSelectMatch = (matchId: string) => {
    const selectedMatch = matches.find((entry) => entry.id === matchId) ?? null;
    setCurrentMatch(selectedMatch);
  };

  const handleCreateMatch = async (values: MatchFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmittingMatch(true);
    setScreenError(undefined);

    try {
      const createdMatch = await createMatchRequest(token, values);
      const [matchData] = await Promise.all([
        fetchMatchData(token, createdMatch.id),
        refreshAdminDataState(token),
      ]);
      setMatches(matchData.matches);
      setCurrentMatch(matchData.selectedMatch);
      reportSuccess("Pelada criada com sucesso.");
    } catch (error) {
      reportError("Falha ao criar a pelada.", error);
      throw error;
    } finally {
      setIsSubmittingMatch(false);
    }
  };

  const handleEditMatch = async (matchId: string, values: MatchFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmittingMatch(true);
    setScreenError(undefined);

    try {
      await updateMatchRequest(token, matchId, values);
      const [matchData] = await Promise.all([
        fetchMatchData(token, matchId),
        refreshAdminDataState(token),
      ]);
      setMatches(matchData.matches);
      setCurrentMatch(matchData.selectedMatch);
      reportSuccess("Pelada atualizada com sucesso.");
    } catch (error) {
      reportError("Falha ao atualizar a pelada.", error);
      throw error;
    } finally {
      setIsSubmittingMatch(false);
    }
  };

  const handleUpdateMatchStatus = async (matchId: string, nextStatus: MatchSummary["status"]) => {
    if (!token) {
      return;
    }

    setIsSubmittingMatch(true);
    setScreenError(undefined);

    try {
      await patchMatchStatusRequest(token, matchId, nextStatus);
      const [matchData, financialData, overallHistoryData] = await Promise.all([
        fetchMatchData(token, matchId),
        isAdmin ? fetchFinancialData(token) : Promise.resolve(null),
        getOverallHistory(token),
        refreshAdminDataState(token),
      ]);
      setMatches(matchData.matches);
      setCurrentMatch(matchData.selectedMatch);
      setOverallHistory(overallHistoryData);
      if (financialData) {
        const [cashFlow, ledger, nextGuestFeeDebts] = financialData;
        setSummary(cashFlow);
        setTransactions(ledger);
        setGuestFeeDebts(nextGuestFeeDebts);
      }
      reportSuccess("Status da pelada atualizado.");
    } catch (error) {
      reportError("Falha ao atualizar o status da pelada.", error);
      throw error;
    } finally {
      setIsSubmittingMatch(false);
    }
  };

  const handleFinalizeMatch = async (matchId: string, winningTeamNumber: number | null) => {
    if (!token) {
      return;
    }

    setIsSubmittingMatch(true);
    setScreenError(undefined);

    try {
      await finalizeMatchRequest(token, matchId, winningTeamNumber);
      const [matchData, financialData, overallHistoryData, nextSportsRanking] = await Promise.all([
        fetchMatchData(token, matchId),
        isAdmin ? fetchFinancialData(token) : Promise.resolve(null),
        getOverallHistory(token),
        getSportsRanking(token, 20),
        refreshAdminDataState(token),
      ]);
      setMatches(matchData.matches);
      setCurrentMatch(matchData.selectedMatch);
      setOverallHistory(overallHistoryData);
      setSportsRanking(nextSportsRanking);
      if (financialData) {
        const [cashFlow, ledger, nextGuestFeeDebts] = financialData;
        setSummary(cashFlow);
        setTransactions(ledger);
        setGuestFeeDebts(nextGuestFeeDebts);
      }
      reportSuccess(
        winningTeamNumber == null
          ? "Pelada finalizada."
          : "Pelada finalizada e vitorias registradas para o time vencedor.",
      );
    } catch (error) {
      reportError("Falha ao finalizar a pelada.", error);
      throw error;
    } finally {
      setIsSubmittingMatch(false);
    }
  };

  const handleCreateTransaction = async (values: TransactionFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmittingTransaction(true);
    setScreenError(undefined);

    try {
      await createTransactionRequest(token, values);
      const [[financialSummary, ledger, nextGuestFeeDebts]] = await Promise.all([
        fetchFinancialData(token),
        refreshAdminDataState(token),
      ]);
      setSummary(financialSummary);
      setTransactions(ledger);
      setGuestFeeDebts(nextGuestFeeDebts);
      reportSuccess("Movimentação lançada no caixa.");
    } catch (error) {
      reportError("Falha ao lançar movimento.", error);
      throw error;
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const handleEditTransaction = async (transactionId: string, values: TransactionFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmittingTransaction(true);
    setScreenError(undefined);

    try {
      await updateTransactionRequest(token, transactionId, values);
      const [[financialSummary, ledger, nextGuestFeeDebts]] = await Promise.all([
        fetchFinancialData(token),
        refreshAdminDataState(token),
      ]);
      setSummary(financialSummary);
      setTransactions(ledger);
      setGuestFeeDebts(nextGuestFeeDebts);
      reportSuccess("Lançamento atualizado com sucesso.");
    } catch (error) {
      reportError("Falha ao atualizar lançamento.", error);
      throw error;
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const handleVoidTransaction = async (transactionId: string) => {
    if (!token) {
      return;
    }

    setIsSubmittingTransaction(true);
    setScreenError(undefined);

    try {
      await voidTransactionRequest(token, transactionId);
      const [[financialSummary, ledger, nextGuestFeeDebts]] = await Promise.all([
        fetchFinancialData(token),
        refreshAdminDataState(token),
      ]);
      setSummary(financialSummary);
      setTransactions(ledger);
      setGuestFeeDebts(nextGuestFeeDebts);
      reportSuccess("Lançamento estornado com sucesso.");
    } catch (error) {
      reportError("Falha ao estornar lançamento.", error);
      throw error;
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const handleCreatePlayer = async (values: PlayerFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmittingRoster(true);
    setScreenError(undefined);

    try {
      const created = await createPlayerRequest(token, values);
      setPlayers((prev) =>
        [...prev, created].sort((left, right) => left.fullName.localeCompare(right.fullName)),
      );
      await refreshAdminDataState(token);
      reportSuccess("Jogador criado com sucesso.");
    } catch (error) {
      reportError("Falha ao criar jogador.", error);
      throw error;
    } finally {
      setIsSubmittingRoster(false);
    }
  };

  const handleEditPlayer = async (playerId: string, values: PlayerFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmittingRoster(true);
    setScreenError(undefined);

    try {
      const updated = await updatePlayerRequest(token, playerId, values);
      setPlayers((prev) =>
        prev
          .map((player) => (player.id === playerId ? updated : player))
          .sort((left, right) => left.fullName.localeCompare(right.fullName)),
      );
      await refreshAdminDataState(token);
      reportSuccess("Jogador atualizado com sucesso.");
    } catch (error) {
      reportError("Falha ao atualizar jogador.", error);
      throw error;
    } finally {
      setIsSubmittingRoster(false);
    }
  };

  const handleTogglePlayerStatus = async (playerId: string, nextActive: boolean) => {
    if (!token) {
      return;
    }

    setIsSubmittingRoster(true);
    setScreenError(undefined);

    try {
      const updated = await patchPlayerStatus(token, playerId, nextActive);
      setPlayers((prev) => prev.map((player) => (player.id === playerId ? updated : player)));
      await refreshAdminDataState(token);
      reportSuccess(nextActive ? "Jogador reativado." : "Jogador inativado.");
    } catch (error) {
      reportError("Falha ao atualizar status do jogador.", error);
      throw error;
    } finally {
      setIsSubmittingRoster(false);
    }
  };

  const handleCreateAccount = async (values: AccessAccountFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmittingAccount(true);
    setScreenError(undefined);

    try {
      await createUserAccountRequest(token, values);
      const nextAccounts = await listUserAccounts(token);
      setAccounts(nextAccounts);
      reportSuccess("Conta de acesso criada com sucesso.");
    } catch (error) {
      reportError("Falha ao criar conta.", error);
      throw error;
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const handleEditAccount = async (accountId: string, values: AccessAccountFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmittingAccount(true);
    setScreenError(undefined);

    try {
      const updated = await updateUserAccountRequest(token, accountId, values);
      setAccounts((prev) => prev.map((account) => (account.id === accountId ? updated : account)));

      if (currentUser?.id === accountId) {
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                displayName: updated.displayName,
                email: updated.email,
                role: updated.role,
                linkedPlayerId: updated.linkedPlayerId,
                mustChangePassword: updated.mustChangePassword,
              }
            : prev,
        );
      }
      reportSuccess("Conta atualizada com sucesso.");
    } catch (error) {
      reportError("Falha ao atualizar conta.", error);
      throw error;
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const handleResetAccountPassword = async (accountId: string, newPassword: string) => {
    if (!token) {
      return;
    }

    setIsSubmittingAccount(true);
    setScreenError(undefined);

    try {
      const updated = await resetUserAccountPassword(token, accountId, newPassword);
      setAccounts((prev) => prev.map((account) => (account.id === accountId ? updated : account)));

      if (currentUser?.id === accountId) {
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                mustChangePassword: true,
              }
            : prev,
        );
      }
      reportSuccess("Senha temporária redefinida para a conta.");
    } catch (error) {
      reportError("Falha ao resetar a senha da conta.", error);
      throw error;
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const resetGeneratedTeams = () => {
    setGeneratedTeams([]);
    setAverageOverallGap(null);
  };

  const handleConfirmPlayer = async (playerId: string) => {
    if (!token || !currentMatch) {
      return;
    }

    const player = players.find((entry) => entry.id === playerId);
    if (!player) {
      return;
    }

    setIsSubmittingAttendance(true);
    setScreenError(undefined);

    try {
      const created = await createAttendanceForPlayer(token, currentMatch.id, player);
      setAttendance((prev) =>
        [...prev, created].sort((left, right) => left.displayName.localeCompare(right.displayName)),
      );
      await refreshAdminDataState(token);
      resetGeneratedTeams();
      reportSuccess("Presença confirmada na pelada.");
    } catch (error) {
      reportError("Falha ao confirmar presença.", error);
      throw error;
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleAddGuest = async (values: GuestFormValues) => {
    if (!token || !currentMatch) {
      return;
    }

    setIsSubmittingAttendance(true);
    setScreenError(undefined);

    try {
      const created = await createGuestAttendance(token, currentMatch.id, values);
      setAttendance((prev) =>
        [...prev, created].sort((left, right) => left.displayName.localeCompare(right.displayName)),
      );
      await refreshAdminDataState(token);
      resetGeneratedTeams();
      reportSuccess("Convidado adicionado com sucesso.");
    } catch (error) {
      reportError("Falha ao adicionar convidado.", error);
      throw error;
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleRemoveAttendance = async (attendanceId: string) => {
    if (!token) {
      return;
    }

    setIsSubmittingAttendance(true);
    setScreenError(undefined);

    try {
      await deleteAttendanceRequest(token, attendanceId);
      setAttendance((prev) => prev.filter((entry) => entry.id !== attendanceId));
      await refreshAdminDataState(token);
      resetGeneratedTeams();
      reportSuccess("Entrada removida da lista de presença.");
    } catch (error) {
      reportError("Falha ao remover presença.", error);
      throw error;
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleMarkGuestFeePaid = async (attendanceId: string) => {
    if (!token) {
      return;
    }

    setIsSubmittingAttendance(true);
    setScreenError(undefined);

    try {
      const updated = await markGuestFeePaidRequest(token, attendanceId);
      const [cashFlow, ledger, nextGuestFeeDebts] = isAdmin
        ? await fetchFinancialData(token)
        : ([summary, transactions, guestFeeDebts] as const);
      setAttendance((prev) => prev.map((entry) => (entry.id === attendanceId ? updated : entry)));
      if (isAdmin) {
        setSummary(cashFlow);
        setTransactions(ledger);
        setGuestFeeDebts(nextGuestFeeDebts);
        await refreshAdminDataState(token);
      }
      reportSuccess("Taxa de convidado marcada como paga.");
    } catch (error) {
      reportError("Falha ao marcar taxa do convidado como paga.", error);
      throw error;
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const handleWaiveGuestFee = async (attendanceId: string) => {
    if (!token) {
      return;
    }

    setIsSubmittingAttendance(true);
    setScreenError(undefined);

    try {
      const updated = await waiveGuestFeeRequest(token, attendanceId);
      const [cashFlow, ledger, nextGuestFeeDebts] = isAdmin
        ? await fetchFinancialData(token)
        : ([summary, transactions, guestFeeDebts] as const);
      setAttendance((prev) => prev.map((entry) => (entry.id === attendanceId ? updated : entry)));
      if (isAdmin) {
        setSummary(cashFlow);
        setTransactions(ledger);
        setGuestFeeDebts(nextGuestFeeDebts);
        await refreshAdminDataState(token);
      }
      reportSuccess("Taxa de convidado desconsiderada.");
    } catch (error) {
      reportError("Falha ao desconsiderar taxa do convidado.", error);
      throw error;
    } finally {
      setIsSubmittingAttendance(false);
    }
  };

  const refreshAdminDataState = async (authToken: string) => {
    if (!isAdmin) {
      return;
    }

    const adminData = await fetchAdminData(authToken);
    applyAdminData(adminData);
  };

  const handleRefreshPortal = async () => {
    if (!token || !isCommonUser) {
      return;
    }

    setIsPortalLoading(true);
    setScreenError(undefined);

    try {
      const [portalData, matchData, personalLedger, squad, nextGuestFeeDebts] = await Promise.all([
        fetchPortalData(token),
        fetchMatchData(token),
        listTransactions(token),
        listPlayers(token),
        listGuestFeeDebts(token),
      ]);
      const visibleMatches = matchData.matches;
      setPortalLinkedPlayer(portalData.linkedPlayer);
      setPortalFinance(portalData.finance);
      setPortalCash(portalData.cash);
      setPortalRecentAttendance(portalData.recentAttendance);
      setPortalUpcomingMatches(portalData.upcomingMatches);
      setTransactions(personalLedger);
      setGuestFeeDebts(nextGuestFeeDebts);
      setPlayers(squad);
      setMatches(visibleMatches);
      setCurrentMatch(
        visibleMatches.find((entry) => entry.id === matchData.selectedMatch?.id) ??
          visibleMatches[0] ??
          null,
      );
      reportSuccess("Portal atualizado com sucesso.");
    } catch (error) {
      reportError("Falha ao atualizar seu portal.", error);
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleUpdateMyAccount = async (values: AccountProfileFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmittingProfile(true);

    try {
      const updatedUser = await updateMyAccount(token, values);
      setCurrentUser(updatedUser);
      setAccounts((prev) =>
        prev.map((account) =>
          account.id === updatedUser.id
            ? {
                ...account,
                username: updatedUser.username,
                email: updatedUser.email,
                displayName: updatedUser.displayName,
              }
            : account,
        ),
      );
      reportSuccess("Dados da conta atualizados.");
    } catch (error) {
      reportError("Falha ao atualizar seus dados.", error);
      throw error;
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleAccountPasswordChange = async (currentPassword: string, newPassword: string) => {
    if (!token) {
      return;
    }

    setIsChangingPassword(true);

    try {
      const session = await changePassword(token, currentPassword, newPassword);
      localStorage.setItem(AUTH_TOKEN_KEY, session.token);
      setToken(session.token);
      setCurrentUser(session.user);
      reportSuccess("Senha atualizada com sucesso.");
    } catch (error) {
      reportError("Falha ao trocar a senha.", error);
      throw error;
    } finally {
      setIsChangingPassword(false);
    }
  };

  const filteredPlayers = players.filter((player) => {
    if (rosterFilters.status === "ACTIVE" && !player.isActive) {
      return false;
    }
    if (rosterFilters.status === "INACTIVE" && player.isActive) {
      return false;
    }
    if (rosterFilters.position !== "ALL" && player.preferredPosition !== rosterFilters.position) {
      return false;
    }
    if (rosterFilters.search.trim()) {
      const term = rosterFilters.search.trim().toLowerCase();
      return (
        player.fullName.toLowerCase().includes(term) ||
        (player.nickname ?? "").toLowerCase().includes(term)
      );
    }
    return true;
  });

  const isAdmin = currentUser?.role === "ADMIN";
  const isCommonUser = currentUser?.role === "COMMON";
  const navigation = isCommonUser ? commonNavigation : adminNavigation;
  const portalRecentTeams = buildPortalRecentTeams(portalRecentAttendance, matches);
  const currentUserName = currentUser?.displayName || currentUser?.username || "Jogador";
  const attendancePlayerIds = new Set(attendance.map((entry) => entry.playerId).filter(Boolean));
  const availablePlayers = players.filter(
    (player) =>
      player.isActive && player.playerType === "MEMBER" && !attendancePlayerIds.has(player.id),
  );
  const responsiblePlayers = players.filter(
    (player) => player.isActive && player.playerType === "MEMBER",
  );

  const renderProtected = (element: JSX.Element) => {
    if (isAuthLoading) {
      return <section className="empty-state">Restaurando sessão...</section>;
    }
    if (!currentUser) {
      return <Navigate to="/login" replace />;
    }
    return element;
  };

  return (
    <div className={`app-shell ${isLoginRoute ? "login-route" : ""}`}>
      {toasts.length > 0 ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast-card ${toast.tone}`}>
              <div>
                <strong>
                  {toast.tone === "success"
                    ? "Sucesso"
                    : toast.tone === "warning"
                      ? "Aviso"
                      : "Erro"}
                </strong>
                <p>{toast.message}</p>
              </div>
              <button type="button" className="toast-close" onClick={() => dismissToast(toast.id)}>
                Fechar
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {!isLoginRoute && currentUser && (
        <aside className={`side-nav ${isNavOpen ? "open" : ""}`}>
          <div className="side-nav-top">
            <div className="brand">
              <div className="brand-mark">
                <img src={sofradoresLogo} alt="Sofredores 027" className="brand-logo" />
              </div>
              <div className="brand-copy">
                <p>Peladinhas Sofredores</p>
              </div>
            </div>
            <button
              type="button"
              className="nav-toggle"
              aria-expanded={isNavOpen}
              aria-controls="side-nav-menu"
              aria-label={isNavOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setIsNavOpen((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {isNavOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
          <div className="side-nav-menu" id="side-nav-menu" ref={navMenuRef}>
            <div className="side-user-card">
              <div className="side-user-copy">
                <strong>{currentUserName}</strong>
                <small>@{currentUser.username}</small>
              </div>
              <span
                className={`side-role-badge ${currentUser.role === "ADMIN" ? "admin" : "common"}`}
              >
                {roleLabels[currentUser.role]}
              </span>
            </div>
            <nav className="nav-list">
              {navigation.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                  onClick={() => setIsNavOpen(false)}
                >
                  <span className="nav-link-icon">
                    <SidebarNavIcon icon={item.icon} />
                  </span>
                  <span className="nav-link-copy">
                    <span className="nav-label">{item.label}</span>
                  </span>
                </NavLink>
              ))}
            </nav>
            <div className="nav-footer">
              <button type="button" className="ghost-button" onClick={handleLogout}>
                Encerrar sessão
              </button>
            </div>
          </div>
        </aside>
      )}
      <main className="main-area">
        {screenError ? <div className="status-banner error">{screenError}</div> : null}
        {currentUser?.mustChangePassword && !isLoginRoute ? (
          <div className="status-banner warning">
            Sua conta esta com senha temporaria. Atualize a senha em Minha conta.
          </div>
        ) : null}
        <Routes>
          <Route
            path="/login"
            element={
              currentUser ? (
                <Navigate to={isCommonUser ? "/portal" : "/dashboard"} replace />
              ) : (
                <LoginPage
                  isSubmitting={isSubmittingLogin}
                  isCreatingAccount={isCreatingPublicAccount}
                  errorMessage={loginError}
                  signupErrorMessage={signupError}
                  canCreateAccount
                  onSubmit={(values) => {
                    void handleLogin(values.identifier, values.password);
                  }}
                  onCreateAccount={(values) => handlePublicSignup(values)}
                />
              )
            }
          />
          <Route
            path="/portal"
            element={renderProtected(
              isCommonUser ? (
                <CommonUserPortalPage
                  currentUser={currentUser as AuthenticatedUser}
                  linkedPlayer={portalLinkedPlayer}
                  finance={portalFinance}
                  cash={portalCash}
                  overallHistory={overallHistory}
                  guestDebts={guestFeeDebts}
                  transactions={transactions}
                  players={players}
                  matches={matches}
                  recentAttendance={portalRecentAttendance}
                  upcomingMatches={portalUpcomingMatches}
                  recentTeams={portalRecentTeams}
                  isLoading={isPortalLoading}
                  onRefresh={() => handleRefreshPortal()}
                />
              ) : (
                <Navigate to="/dashboard" replace />
              ),
            )}
          />
          <Route
            path="/dashboard"
            element={renderProtected(
              isAdmin ? (
                <DashboardPage
                  summary={summary}
                  transactions={transactions}
                  players={players}
                  matches={matches}
                  guestFeeDebts={guestFeeDebts}
                  seasonOverview={seasonOverview}
                  presenceRanking={presenceRanking}
                  paymentRanking={paymentRanking}
                  isLoading={isDashboardLoading}
                  isSubmittingTransaction={isSubmittingTransaction}
                  isSubmittingGuestFee={isSubmittingAttendance}
                  canManageCash={isAdmin}
                  onAddTransaction={(values) => handleCreateTransaction(values)}
                  onEditTransaction={(transactionId, values) =>
                    handleEditTransaction(transactionId, values)
                  }
                  onVoidTransaction={(transactionId) => handleVoidTransaction(transactionId)}
                  onMarkGuestFeePaid={(attendanceId) => handleMarkGuestFeePaid(attendanceId)}
                  onWaiveGuestFee={(attendanceId) => handleWaiveGuestFee(attendanceId)}
                  onOpenLedger={() => null}
                />
              ) : (
                <Navigate to="/portal" replace />
              ),
            )}
          />
          <Route
            path="/roster"
            element={renderProtected(
              isAdmin ? (
                <RosterPage
                  players={filteredPlayers}
                  allPlayers={players}
                  accounts={accounts}
                  filters={rosterFilters}
                  isLoading={isRosterLoading}
                  isSubmitting={isSubmittingRoster}
                  isSubmittingAccount={isSubmittingAccount}
                  canEdit={isAdmin}
                  onFilterChange={setRosterFilters}
                  onCreatePlayer={(values) => handleCreatePlayer(values)}
                  onEditPlayer={(playerId, values) => handleEditPlayer(playerId, values)}
                  onCreateAccount={(values) => handleCreateAccount(values)}
                  onEditAccount={(accountId, values) => handleEditAccount(accountId, values)}
                  onResetAccountPassword={(accountId, newPassword) =>
                    handleResetAccountPassword(accountId, newPassword)
                  }
                  onTogglePlayerStatus={(playerId, nextActive) =>
                    handleTogglePlayerStatus(playerId, nextActive)
                  }
                />
              ) : (
                <RosterPage
                  players={filteredPlayers}
                  allPlayers={players}
                  filters={rosterFilters}
                  isLoading={isRosterLoading}
                  isSubmitting={false}
                  canEdit={false}
                  onFilterChange={setRosterFilters}
                  onCreatePlayer={async () => undefined}
                  onEditPlayer={async () => undefined}
                  onTogglePlayerStatus={async () => undefined}
                />
              ),
            )}
          />
          <Route
            path="/accounts"
            element={renderProtected(
              isAdmin ? (
                <AccountsPage
                  accounts={accounts}
                  players={players}
                  isLoading={isRosterLoading}
                  isSubmitting={isSubmittingAccount}
                  canEdit={isAdmin}
                  onCreateAccount={(values) => handleCreateAccount(values)}
                  onEditAccount={(accountId, values) => handleEditAccount(accountId, values)}
                  onResetAccountPassword={(accountId, newPassword) =>
                    handleResetAccountPassword(accountId, newPassword)
                  }
                />
              ) : (
                <Navigate to="/portal" replace />
              ),
            )}
          />
          <Route
            path="/my-account"
            element={renderProtected(
              <MyAccountPage
                currentUser={currentUser as AuthenticatedUser}
                isSubmittingProfile={isSubmittingProfile}
                isChangingPassword={isChangingPassword}
                onUpdateProfile={(values) => handleUpdateMyAccount(values)}
                onChangePassword={(currentPassword, newPassword) =>
                  handleAccountPasswordChange(currentPassword, newPassword)
                }
              />,
            )}
          />
          <Route
            path="/pre-match"
            element={renderProtected(
              <PreMatchPage
                matches={matches}
                match={currentMatch}
                activeSection="match"
                attendance={attendance}
                availablePlayers={availablePlayers}
                responsiblePlayers={responsiblePlayers}
                generatedTeams={generatedTeams}
                averageOverallGap={averageOverallGap}
                isLoading={isPreMatchLoading}
                isGeneratingTeams={isGeneratingTeams}
                isClearingTeams={isClearingTeams}
                isSwappingTeamPlayers={isSwappingTeamPlayers}
                isSubmittingRatings={isSubmittingRatings}
                isFinalizingRatings={isFinalizingRatings}
                isRecalculatingRatings={isRecalculatingRatings}
                isSubmittingMatch={isSubmittingMatch}
                isSubmittingAttendance={isSubmittingAttendance}
                canManageAttendance={isAdmin}
                canManageMatch={isAdmin}
                onSelectMatch={(matchId) => handleSelectMatch(matchId)}
                onCreateMatch={(values) => handleCreateMatch(values)}
                onEditMatch={(matchId, values) => handleEditMatch(matchId, values)}
                onUpdateMatchStatus={(matchId, nextStatus) =>
                  handleUpdateMatchStatus(matchId, nextStatus)
                }
                onFinalizeMatch={(matchId, winningTeamNumber) =>
                  handleFinalizeMatch(matchId, winningTeamNumber)
                }
                onConfirmPlayer={(playerId) => handleConfirmPlayer(playerId)}
                onAddGuest={(values) => handleAddGuest(values)}
                onRemoveAttendance={(attendanceId) => handleRemoveAttendance(attendanceId)}
                onMarkGuestFeePaid={(attendanceId) => handleMarkGuestFeePaid(attendanceId)}
                onWaiveGuestFee={(attendanceId) => handleWaiveGuestFee(attendanceId)}
                onGenerateTeams={(teamCount) => void handleGenerateTeams(teamCount)}
                onClearGeneratedTeams={() => void handleClearGeneratedTeams()}
                onSwapTeamPlayers={(sourceAttendanceId, targetAttendanceId) =>
                  handleSwapTeamPlayers(sourceAttendanceId, targetAttendanceId)
                }
                ratingState={matchRatingState}
                overallHistory={overallHistory}
                onFinalizeRatings={() => handleFinalizeRatings()}
                onRecalculateRatings={() => handleRecalculateRatings()}
                onSubmitPlayerRatings={(ratings) => handleSubmitPlayerRatings(ratings)}
              />,
            )}
          />
          <Route
            path="/ranking"
            element={renderProtected(
              <RankingPage
                ranking={sportsRanking}
                isLoading={isRankingLoading}
                matches={matches}
                selectedMatch={currentMatch}
                canManageStatsSheet={isAdmin}
                isImportingStatsSheet={isImportingStatsSheet}
                onSelectMatch={(matchId) => handleSelectMatch(matchId)}
                onExportStatsSheet={() => handleExportStatsSheet()}
                onImportStatsSheet={(file) => handleImportStatsSheet(file)}
              />,
            )}
          />
          <Route
            path="/ratings"
            element={renderProtected(
              <PreMatchPage
                matches={matches}
                match={currentMatch}
                activeSection="ratings"
                attendance={attendance}
                availablePlayers={availablePlayers}
                responsiblePlayers={responsiblePlayers}
                generatedTeams={generatedTeams}
                averageOverallGap={averageOverallGap}
                isLoading={isPreMatchLoading}
                isGeneratingTeams={isGeneratingTeams}
                isClearingTeams={isClearingTeams}
                isSwappingTeamPlayers={isSwappingTeamPlayers}
                isSubmittingRatings={isSubmittingRatings}
                isFinalizingRatings={isFinalizingRatings}
                isRecalculatingRatings={isRecalculatingRatings}
                isSubmittingMatch={isSubmittingMatch}
                isSubmittingAttendance={isSubmittingAttendance}
                canManageAttendance={isAdmin}
                canManageMatch={isAdmin}
                onSelectMatch={(matchId) => handleSelectMatch(matchId)}
                onCreateMatch={(values) => handleCreateMatch(values)}
                onEditMatch={(matchId, values) => handleEditMatch(matchId, values)}
                onUpdateMatchStatus={(matchId, nextStatus) =>
                  handleUpdateMatchStatus(matchId, nextStatus)
                }
                onFinalizeMatch={(matchId, winningTeamNumber) =>
                  handleFinalizeMatch(matchId, winningTeamNumber)
                }
                onConfirmPlayer={(playerId) => handleConfirmPlayer(playerId)}
                onAddGuest={(values) => handleAddGuest(values)}
                onRemoveAttendance={(attendanceId) => handleRemoveAttendance(attendanceId)}
                onMarkGuestFeePaid={(attendanceId) => handleMarkGuestFeePaid(attendanceId)}
                onWaiveGuestFee={(attendanceId) => handleWaiveGuestFee(attendanceId)}
                onGenerateTeams={(teamCount) => void handleGenerateTeams(teamCount)}
                onClearGeneratedTeams={() => void handleClearGeneratedTeams()}
                onSwapTeamPlayers={(sourceAttendanceId, targetAttendanceId) =>
                  handleSwapTeamPlayers(sourceAttendanceId, targetAttendanceId)
                }
                ratingState={matchRatingState}
                overallHistory={overallHistory}
                onFinalizeRatings={() => handleFinalizeRatings()}
                onRecalculateRatings={() => handleRecalculateRatings()}
                onSubmitPlayerRatings={(ratings) => handleSubmitPlayerRatings(ratings)}
              />,
            )}
          />
          <Route
            path="/"
            element={
              <Navigate
                to={
                  currentUser
                    ? currentUser.mustChangePassword
                      ? "/my-account"
                      : isCommonUser
                        ? "/portal"
                        : "/dashboard"
                    : "/login"
                }
                replace
              />
            }
          />
          <Route
            path="*"
            element={
              <Navigate
                to={
                  currentUser
                    ? currentUser.mustChangePassword
                      ? "/my-account"
                      : isCommonUser
                        ? "/portal"
                        : "/dashboard"
                    : "/login"
                }
                replace
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}
