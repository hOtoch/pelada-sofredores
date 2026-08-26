import type {
  TransactionCategory,
  TransactionDirection,
  TransactionRecord,
} from "../../domain/types";

export type DashboardAnalyticsPeriod =
  "THIS_MONTH" | "LAST_3_MONTHS" | "LAST_6_MONTHS" | "YEAR_TO_DATE" | "ALL_TIME";

export interface DashboardAnalyticsPeriodOption {
  value: DashboardAnalyticsPeriod;
  label: string;
}

export interface DashboardMonthlyPoint {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface DashboardCategorySlice {
  category: TransactionCategory;
  direction: TransactionDirection;
  amount: number;
  share: number;
}

export interface DashboardAnalyticsSnapshot {
  period: DashboardAnalyticsPeriod;
  periodLabel: string;
  inflowPosted: number;
  outflowPosted: number;
  pendingTotal: number;
  postedBalance: number;
  postedCount: number;
  averageTicket: number;
  coverageRatio: number | null;
  averageMonthlyNet: number;
  monthlySeries: DashboardMonthlyPoint[];
  categoryBreakdown: DashboardCategorySlice[];
}

export interface DashboardSeasonOverviewSnapshot {
  referenceMonth: string;
  totalMatches: number;
  matchesOpen: number;
  matchesArchived: number;
  activeMembers: number;
  attendanceConfirmed: number;
  attendancePending: number;
  attendanceDeclined: number;
  attendanceTotal: number;
  inflowTotal: number;
  outflowTotal: number;
  currentBalance: number;
  pendingTotal: number;
  adimplentMembers: number;
  delinquentMembers: number;
}

export interface DashboardPresenceRankingEntry {
  playerId: string;
  playerName: string;
  confirmedCount: number;
  pendingCount: number;
  declinedCount: number;
  totalCalls: number;
  attendanceRate: number;
}

export interface DashboardPaymentRankingEntry {
  playerId: string;
  playerName: string;
  expectedMonthlyFee: number;
  paidAmount: number;
  pendingAmount: number;
  outstandingAmount: number;
  isAdimplente: boolean;
}

export const DASHBOARD_ANALYTICS_PERIOD_OPTIONS: DashboardAnalyticsPeriodOption[] = [
  { value: "THIS_MONTH", label: "Este mes" },
  { value: "LAST_3_MONTHS", label: "Ultimos 3 meses" },
  { value: "LAST_6_MONTHS", label: "Ultimos 6 meses" },
  { value: "YEAR_TO_DATE", label: "Ano atual" },
  { value: "ALL_TIME", label: "Historico completo" },
];

const PERIOD_LABELS: Record<DashboardAnalyticsPeriod, string> = {
  THIS_MONTH: "Este mes",
  LAST_3_MONTHS: "Ultimos 3 meses",
  LAST_6_MONTHS: "Ultimos 6 meses",
  YEAR_TO_DATE: "Ano atual",
  ALL_TIME: "Historico completo",
};

const FIRST_OF_MONTH_DAY = 1;
const MONTH_HOUR = 12;

function normalizeDate(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), MONTH_HOUR, 0, 0, 0);
}

function parseISODate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function monthKeyFromDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(value: string) {
  return new Date(`${value}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

function firstOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), FIRST_OF_MONTH_DAY, MONTH_HOUR, 0, 0, 0);
}

function addMonths(value: Date, delta: number) {
  return new Date(
    value.getFullYear(),
    value.getMonth() + delta,
    FIRST_OF_MONTH_DAY,
    MONTH_HOUR,
    0,
    0,
    0,
  );
}

function getPeriodStart(period: DashboardAnalyticsPeriod, now: Date) {
  if (period === "THIS_MONTH") {
    return firstOfMonth(now);
  }
  if (period === "LAST_3_MONTHS") {
    return addMonths(firstOfMonth(now), -2);
  }
  if (period === "LAST_6_MONTHS") {
    return addMonths(firstOfMonth(now), -5);
  }
  if (period === "YEAR_TO_DATE") {
    return new Date(now.getFullYear(), 0, FIRST_OF_MONTH_DAY, MONTH_HOUR, 0, 0, 0);
  }
  return null;
}

function inPeriod(value: Date, start: Date | null, end: Date) {
  if (start && value < start) {
    return false;
  }
  return value <= end;
}

function safeDivide(numerator: number, denominator: number) {
  if (denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

function buildMonthSeries(
  transactions: TransactionRecord[],
  periodStart: Date | null,
  periodEnd: Date,
) {
  const bucketMap = new Map<string, DashboardMonthlyPoint>();
  const endMonth = firstOfMonth(periodEnd);

  let seriesStart = periodStart;
  if (!seriesStart) {
    const earliestTransaction = transactions
      .map((transaction) => parseISODate(transaction.occurredOn))
      .sort((left, right) => left.getTime() - right.getTime())[0];
    seriesStart = earliestTransaction ? firstOfMonth(earliestTransaction) : endMonth;
  }

  if (seriesStart.getTime() < addMonths(endMonth, -11).getTime()) {
    seriesStart = addMonths(endMonth, -11);
  }

  for (
    let cursor = new Date(seriesStart);
    cursor.getTime() <= endMonth.getTime();
    cursor = addMonths(cursor, 1)
  ) {
    const key = monthKeyFromDate(cursor);
    bucketMap.set(key, {
      key,
      label: monthLabelFromKey(key),
      inflow: 0,
      outflow: 0,
      balance: 0,
    });
  }

  transactions.forEach((transaction) => {
    if (transaction.status !== "POSTED") {
      return;
    }
    const occurredOn = parseISODate(transaction.occurredOn);
    const key = monthKeyFromDate(occurredOn);
    const bucket = bucketMap.get(key);
    if (!bucket) {
      return;
    }

    if (transaction.direction === "INFLOW") {
      bucket.inflow += transaction.amount;
      bucket.balance += transaction.amount;
      return;
    }

    bucket.outflow += transaction.amount;
    bucket.balance -= transaction.amount;
  });

  return Array.from(bucketMap.values());
}

export function computeDashboardAnalytics(
  transactions: TransactionRecord[],
  period: DashboardAnalyticsPeriod,
  nowDate: Date = new Date(),
): DashboardAnalyticsSnapshot {
  const periodEnd = normalizeDate(nowDate);
  const periodStart = getPeriodStart(period, periodEnd);

  const filteredTransactions = transactions.filter((transaction) =>
    inPeriod(parseISODate(transaction.occurredOn), periodStart, periodEnd),
  );

  const postedTransactions = filteredTransactions.filter(
    (transaction) => transaction.status === "POSTED",
  );
  const pendingTransactions = filteredTransactions.filter(
    (transaction) => transaction.status === "PENDING",
  );

  const inflowPosted = postedTransactions
    .filter((transaction) => transaction.direction === "INFLOW")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const outflowPosted = postedTransactions
    .filter((transaction) => transaction.direction === "OUTFLOW")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const pendingTotal = pendingTransactions.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );
  const postedBalance = inflowPosted - outflowPosted;
  const postedCount = postedTransactions.length;
  const averageTicket =
    postedCount > 0
      ? postedTransactions.reduce((total, tx) => total + tx.amount, 0) / postedCount
      : 0;
  const coverageRatio = safeDivide(inflowPosted, outflowPosted);

  const monthlySeries = buildMonthSeries(filteredTransactions, periodStart, periodEnd);
  const averageMonthlyNet =
    monthlySeries.length > 0
      ? monthlySeries.reduce((total, point) => total + point.balance, 0) / monthlySeries.length
      : 0;

  const categoryAccumulator = new Map<string, DashboardCategorySlice>();
  postedTransactions.forEach((transaction) => {
    const key = `${transaction.direction}:${transaction.category}`;
    const current = categoryAccumulator.get(key);

    if (current) {
      current.amount += transaction.amount;
      return;
    }

    categoryAccumulator.set(key, {
      category: transaction.category,
      direction: transaction.direction,
      amount: transaction.amount,
      share: 0,
    });
  });

  const categoryTotal = Array.from(categoryAccumulator.values()).reduce(
    (total, entry) => total + entry.amount,
    0,
  );

  const categoryBreakdown = Array.from(categoryAccumulator.values())
    .map((entry) => ({
      ...entry,
      share: categoryTotal > 0 ? entry.amount / categoryTotal : 0,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);

  return {
    period,
    periodLabel: PERIOD_LABELS[period],
    inflowPosted,
    outflowPosted,
    pendingTotal,
    postedBalance,
    postedCount,
    averageTicket,
    coverageRatio,
    averageMonthlyNet,
    monthlySeries,
    categoryBreakdown,
  };
}
