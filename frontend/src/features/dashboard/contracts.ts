import type { CashFlowSummary, PlayerSummary, TransactionRecord } from "../../domain/types";
import type {
  DashboardAnalyticsPeriod,
  DashboardAnalyticsSnapshot,
  DashboardPaymentRankingEntry,
  DashboardPresenceRankingEntry,
  DashboardSeasonOverviewSnapshot,
} from "./analytics";

export interface TransactionFormValues {
  direction: TransactionRecord["direction"];
  category: TransactionRecord["category"];
  status: TransactionRecord["status"];
  amount: number;
  description: string;
  occurredOn: string;
  referenceMonth?: string | null;
  relatedPlayerId?: string | null;
  notes?: string;
}

export interface CashBalanceCardProps {
  label: string;
  amount: number;
  helperText?: string;
  tone?: "accent" | "neutral" | "warning";
}

export interface LedgerPreviewProps {
  transactions: TransactionRecord[];
  onSelectTransaction?: (transactionId: string) => void;
}

export interface FinanceDashboardPageProps {
  summary: CashFlowSummary;
  transactions: TransactionRecord[];
  players: PlayerSummary[];
  analyticsSnapshot?: DashboardAnalyticsSnapshot | null;
  seasonOverview?: DashboardSeasonOverviewSnapshot | null;
  presenceRanking?: DashboardPresenceRankingEntry[] | null;
  paymentRanking?: DashboardPaymentRankingEntry[] | null;
  selectedAnalyticsPeriod?: DashboardAnalyticsPeriod;
  isLoading: boolean;
  isSubmittingTransaction: boolean;
  canManageCash: boolean;
  onAddTransaction: (values: TransactionFormValues) => Promise<void> | void;
  onEditTransaction: (transactionId: string, values: TransactionFormValues) => Promise<void> | void;
  onVoidTransaction: (transactionId: string) => Promise<void> | void;
  onAnalyticsPeriodChange?: (period: DashboardAnalyticsPeriod) => void;
  onOpenLedger?: () => void;
}
