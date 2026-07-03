import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import type {
  MonthlyFeePaymentState,
  MonthlyFeeStatus,
  PlayerSummary,
  TransactionCategory,
  TransactionRecord,
  TransactionStatus,
} from "../domain/types";
import type {
  FinanceDashboardPageProps,
  TransactionFormValues,
} from "../features/dashboard/contracts";
import {
  DASHBOARD_ANALYTICS_PERIOD_OPTIONS,
  computeDashboardAnalytics,
  type DashboardPaymentRankingEntry,
  type DashboardAnalyticsPeriod,
} from "../features/dashboard/analytics";
import { themeTokens } from "../theme/tokens";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const getMonthValue = (value?: string | null) => (value ? value.slice(0, 7) : "");

const getCurrentMonthValue = () => new Date().toISOString().slice(0, 7);

const getPreviousMonthValue = () => {
  const reference = new Date();
  reference.setMonth(reference.getMonth() - 1);
  return reference.toISOString().slice(0, 7);
};

const formatMonthLabel = (value: string) =>
  new Date(`${value}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

const formatMatchDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

const escapeCsvCell = (value: string | number | null | undefined) => {
  const normalized = String(value ?? "");
  if (/[",;\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
};

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
};

const buildCsvLine = (values: Array<string | number | null | undefined>) =>
  values.map((value) => escapeCsvCell(value)).join(";");

const formatPartialPaymentLabel = (count: number) =>
  count === 1 ? "1 jogador com pagamento parcial" : `${count} jogadores com pagamento parcial`;

const directionLabels = {
  INFLOW: "Entrada",
  OUTFLOW: "Saida",
} as const;

const categoryLabels: Record<TransactionCategory, string> = {
  MONTHLY_FEE: "Mensalidade",
  EXTRA_FEE: "Taxa extra",
  FIELD_RENT: "Aluguel do campo",
  BARBECUE: "Churrasco",
  EQUIPMENT: "Equipamento",
  REFUND: "Reembolso",
  ADJUSTMENT: "Ajuste",
  OTHER: "Outro",
};

const statusLabels: Record<TransactionStatus, string> = {
  POSTED: "Lancado",
  PENDING: "Pendente",
  VOIDED: "Estornado",
};

const paymentStateLabels: Record<MonthlyFeePaymentState, string> = {
  UNPAID: "Em aberto",
  PARTIAL: "Parcial",
  PAID: "Pago",
  EXEMPT: "Sem cobranca",
};

const paymentStateOrder: Record<MonthlyFeePaymentState, number> = {
  UNPAID: 0,
  PARTIAL: 1,
  PAID: 2,
  EXEMPT: 3,
};

const defaultTransactionValues: TransactionFormValues = {
  direction: "INFLOW",
  category: "MONTHLY_FEE",
  status: "POSTED",
  amount: 0,
  description: "",
  occurredOn: new Date().toISOString().slice(0, 10),
  referenceMonth: getCurrentMonthValue(),
  relatedPlayerId: null,
  notes: "",
};

type LedgerFilterState = {
  search: string;
  category: TransactionCategory | "ALL";
  status: TransactionStatus | "ALL";
  playerId: string;
  referenceMonth: string;
};

const defaultLedgerFilters: LedgerFilterState = {
  search: "",
  category: "ALL",
  status: "ALL",
  playerId: "",
  referenceMonth: getCurrentMonthValue(),
};

function getTransactionMonth(transaction: TransactionRecord) {
  return getMonthValue(transaction.referenceMonth) || getMonthValue(transaction.occurredOn);
}

function buildMonthlyFeeDraft(
  player: PlayerSummary,
  referenceMonth: string,
  monthlyFeeStatus?: MonthlyFeeStatus,
): TransactionFormValues {
  const remainingAmount = Math.max(
    player.monthlyFeeAmount - (monthlyFeeStatus?.paidAmount ?? 0),
    0,
  );
  const amount = remainingAmount > 0 ? remainingAmount : player.monthlyFeeAmount;

  return {
    direction: "INFLOW",
    category: "MONTHLY_FEE",
    status: "POSTED",
    amount,
    description: `Mensalidade ${player.fullName} - ${formatMonthLabel(referenceMonth)}`,
    occurredOn: new Date().toISOString().slice(0, 10),
    referenceMonth,
    relatedPlayerId: player.id,
    notes: "",
  };
}

export function DashboardPage({
  summary,
  transactions,
  players,
  matches,
  guestFeeDebts,
  analyticsSnapshot,
  seasonOverview,
  presenceRanking,
  paymentRanking,
  selectedAnalyticsPeriod,
  isLoading,
  isSubmittingTransaction,
  isSubmittingGuestFee,
  canManageCash,
  onAddTransaction,
  onEditTransaction,
  onVoidTransaction,
  onMarkGuestFeePaid,
  onWaiveGuestFee,
  onAnalyticsPeriodChange,
  onOpenLedger,
}: FinanceDashboardPageProps) {
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<TransactionFormValues>(defaultTransactionValues);
  const [billingMonth, setBillingMonth] = useState(getCurrentMonthValue());
  const [ledgerFilters, setLedgerFilters] = useState<LedgerFilterState>(defaultLedgerFilters);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<DashboardAnalyticsPeriod>(
    selectedAnalyticsPeriod ?? "LAST_6_MONTHS",
  );

  useEffect(() => {
    if (selectedAnalyticsPeriod) {
      setAnalyticsPeriod(selectedAnalyticsPeriod);
    }
  }, [selectedAnalyticsPeriod]);

  const memberOptions = useMemo(
    () =>
      players
        .filter((player) => player.playerType === "MEMBER")
        .sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [players],
  );

  const transactionPlayerNames = useMemo(
    () =>
      new Map(
        players.map((player) => [
          player.id,
          player.nickname ? `${player.fullName} (${player.nickname})` : player.fullName,
        ]),
      ),
    [players],
  );

  const matchById = useMemo(
    () => new Map(matches.map((entry) => [entry.id, entry])),
    [matches],
  );

  const guestFeeDebtTotal = useMemo(
    () => guestFeeDebts.reduce((total, entry) => total + entry.guestFeeOutstanding, 0),
    [guestFeeDebts],
  );

  const filteredTransactions = useMemo(() => {
    const searchTerm = ledgerFilters.search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      if (ledgerFilters.category !== "ALL" && transaction.category !== ledgerFilters.category) {
        return false;
      }

      if (ledgerFilters.status !== "ALL" && transaction.status !== ledgerFilters.status) {
        return false;
      }

      if (ledgerFilters.playerId && transaction.relatedPlayerId !== ledgerFilters.playerId) {
        return false;
      }

      if (ledgerFilters.referenceMonth) {
        const transactionMonth = getTransactionMonth(transaction);
        if (transactionMonth !== ledgerFilters.referenceMonth) {
          return false;
        }
      }

      if (searchTerm) {
        const haystack = [
          transaction.description,
          transaction.notes,
          transaction.relatedPlayerName,
          categoryLabels[transaction.category],
          statusLabels[transaction.status],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [ledgerFilters, transactions]);

  const visibleTransactions = useMemo(
    () => (isLedgerOpen ? filteredTransactions : filteredTransactions.slice(0, 6)),
    [filteredTransactions, isLedgerOpen],
  );

  const monthlyFeeStatuses = useMemo<MonthlyFeeStatus[]>(() => {
    return memberOptions
      .filter((player) => player.isActive)
      .map((player) => {
        const playerTransactions = transactions
          .filter(
            (transaction) =>
              transaction.category === "MONTHLY_FEE" &&
              transaction.direction === "INFLOW" &&
              transaction.relatedPlayerId === player.id &&
              getTransactionMonth(transaction) === billingMonth,
          )
          .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn));

        const paidAmount = playerTransactions
          .filter((transaction) => transaction.status === "POSTED")
          .reduce((total, transaction) => total + transaction.amount, 0);

        const pendingAmount = playerTransactions
          .filter((transaction) => transaction.status === "PENDING")
          .reduce((total, transaction) => total + transaction.amount, 0);

        let paymentState: MonthlyFeePaymentState = "UNPAID";
        if (player.monthlyFeeAmount <= 0) {
          paymentState = "EXEMPT";
        } else if (paidAmount >= player.monthlyFeeAmount) {
          paymentState = "PAID";
        } else if (paidAmount > 0 || pendingAmount > 0) {
          paymentState = "PARTIAL";
        }

        return {
          playerId: player.id,
          playerName: player.fullName,
          playerNickname: player.nickname,
          referenceMonth: billingMonth,
          expectedAmount: player.monthlyFeeAmount,
          paidAmount,
          pendingAmount,
          paymentState,
          latestTransactionId: playerTransactions[0]?.id ?? null,
        };
      })
      .sort((left, right) => {
        const stateDiff = paymentStateOrder[left.paymentState] - paymentStateOrder[right.paymentState];
        if (stateDiff !== 0) {
          return stateDiff;
        }
        return left.playerName.localeCompare(right.playerName);
      });
  }, [billingMonth, memberOptions, transactions]);

  const monthlyFeeSnapshot = useMemo(() => {
    const paidCount = monthlyFeeStatuses.filter((status) => status.paymentState === "PAID").length;
    const pendingCount = monthlyFeeStatuses.filter((status) => status.paymentState === "PARTIAL").length;
    const outstandingAmount = monthlyFeeStatuses.reduce(
      (total, status) => total + Math.max(status.expectedAmount - status.paidAmount, 0),
      0,
    );

    return {
      paidCount,
      pendingCount,
      outstandingAmount,
    };
  }, [monthlyFeeStatuses]);

  const analyticsData = useMemo(
    () => analyticsSnapshot ?? computeDashboardAnalytics(transactions, analyticsPeriod),
    [analyticsSnapshot, transactions, analyticsPeriod],
  );

  const fallbackPaymentRanking = useMemo<DashboardPaymentRankingEntry[]>(
    () =>
      monthlyFeeStatuses
        .map((status) => ({
          playerId: status.playerId,
          playerName: status.playerNickname
            ? `${status.playerName} (${status.playerNickname})`
            : status.playerName,
          expectedMonthlyFee: status.expectedAmount,
          paidAmount: status.paidAmount,
          pendingAmount: status.pendingAmount,
          outstandingAmount: Math.max(status.expectedAmount - status.paidAmount, 0),
          isAdimplente: status.paymentState === "PAID" || status.paymentState === "EXEMPT",
        }))
        .sort((left, right) => right.outstandingAmount - left.outstandingAmount)
        .slice(0, 8),
    [monthlyFeeStatuses],
  );

  const paymentRankingData = paymentRanking?.length ? paymentRanking : fallbackPaymentRanking;
  const presenceRankingData = presenceRanking ?? [];

  const adimplenceRate = useMemo(() => {
    const members = paymentRankingData.filter((entry) => entry.expectedMonthlyFee > 0);
    if (!members.length) {
      return 0;
    }
    const adimplent = members.filter((entry) => entry.isAdimplente).length;
    return (adimplent / members.length) * 100;
  }, [paymentRankingData]);

  const averageAttendanceRate = useMemo(() => {
    if (!presenceRankingData.length) {
      return 0;
    }
    const total = presenceRankingData.reduce((sum, item) => sum + item.attendanceRate, 0);
    return total / presenceRankingData.length;
  }, [presenceRankingData]);

  const maxMonthlyFlow = useMemo(() => {
    const max = analyticsData.monthlySeries.reduce((highest, point) => {
      return Math.max(highest, point.inflow, point.outflow);
    }, 0);
    return max || 1;
  }, [analyticsData.monthlySeries]);

  const topOutstandingFees = useMemo(
    () =>
      monthlyFeeStatuses
        .filter((status) => status.paymentState === "UNPAID" || status.paymentState === "PARTIAL")
        .map((status) => ({
          ...status,
          outstandingAmount: Math.max(status.expectedAmount - status.paidAmount, 0),
        }))
        .sort((left, right) => right.outstandingAmount - left.outstandingAmount)
        .slice(0, 5),
    [monthlyFeeStatuses],
  );

  const resetForm = () => {
    setFormValues({
      ...defaultTransactionValues,
      occurredOn: new Date().toISOString().slice(0, 10),
      referenceMonth: billingMonth,
    });
    setEditingTransactionId(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openMonthlyFeeModal = (player: PlayerSummary) => {
    const monthlyFeeStatus = monthlyFeeStatuses.find((status) => status.playerId === player.id);
    setEditingTransactionId(null);
    setFormValues(buildMonthlyFeeDraft(player, billingMonth, monthlyFeeStatus));
    setIsModalOpen(true);
  };

  const openEditModal = (transactionId: string) => {
    const transaction = transactions.find((entry) => entry.id === transactionId);
    if (!transaction) {
      return;
    }

    setEditingTransactionId(transaction.id);
    setFormValues({
      direction: transaction.direction,
      category: transaction.category,
      status: transaction.status,
      amount: transaction.amount,
      description: transaction.description,
      occurredOn: transaction.occurredOn,
      referenceMonth: getMonthValue(transaction.referenceMonth),
      relatedPlayerId: transaction.relatedPlayerId ?? null,
      notes: transaction.notes ?? "",
    });
    setIsModalOpen(true);
  };

  const handleLedgerFilterChange =
    (field: keyof LedgerFilterState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setLedgerFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleFieldChange =
    (field: keyof TransactionFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const rawValue = event.target.value;
      const value = field === "amount" ? Number(rawValue) : rawValue;
      setFormValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleLedgerMonthFilter = (nextMonth: string) => {
    setLedgerFilters((prev) => ({
      ...prev,
      referenceMonth: nextMonth,
    }));
  };

  const handleAnalyticsPeriodChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextPeriod = event.target.value as DashboardAnalyticsPeriod;
    setAnalyticsPeriod(nextPeriod);
    onAnalyticsPeriodChange?.(nextPeriod);
  };

  const handleClearLedgerFilters = () => {
    setLedgerFilters({
      ...defaultLedgerFilters,
      referenceMonth: "",
    });
  };

  const handleVoidClick = async (transactionId: string) => {
    try {
      await onVoidTransaction(transactionId);
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleExportLedger = (format: "csv" | "json") => {
    const exportedAt = new Date();
    const monthLabel = ledgerFilters.referenceMonth || "historico-completo";
    const fileBaseName = `extrato-${monthLabel}-${exportedAt.toISOString().slice(0, 10)}`;

    if (format === "json") {
      downloadTextFile(
        `${fileBaseName}.json`,
        JSON.stringify(
          {
            exportedAt: exportedAt.toISOString(),
            filters: ledgerFilters,
            resultCount: filteredTransactions.length,
            totals: summary,
            transactions: filteredTransactions,
          },
          null,
          2,
        ),
        "application/json;charset=utf-8",
      );
      return;
    }

    const rows = [
      [
        "Descricao",
        "Direcao",
        "Categoria",
        "Status",
        "Valor",
        "Data",
        "Referencia",
        "Mensalista",
        "Registrado por",
        "Observacoes",
      ].join(";"),
      ...filteredTransactions.map((transaction) =>
        [
          transaction.description,
          directionLabels[transaction.direction],
          categoryLabels[transaction.category],
          statusLabels[transaction.status],
          transaction.amount.toFixed(2).replace(".", ","),
          transaction.occurredOn,
          getMonthValue(transaction.referenceMonth),
          transaction.relatedPlayerName ||
            transactionPlayerNames.get(transaction.relatedPlayerId ?? "") ||
            "",
          transaction.recordedByName || "",
          transaction.notes || "",
        ]
          .map((value) => escapeCsvCell(value))
          .join(";"),
      ),
    ].join("\n");

    downloadTextFile(`${fileBaseName}.csv`, rows, "text/csv;charset=utf-8");
  };

  const handleExportSeasonReport = (format: "csv" | "json") => {
    const exportedAt = new Date();
    const fileBaseName = `relatorio-temporada-${exportedAt.toISOString().slice(0, 10)}`;

    const reportPayload = {
      exportedAt: exportedAt.toISOString(),
      analyticsPeriod,
      analyticsLabel: analyticsData.periodLabel,
      summary,
      seasonOverview,
      analyticsData,
      monthlyFeeSnapshot,
      billingMonth,
      presenceRanking: presenceRankingData,
      paymentRanking: paymentRankingData,
      topOutstandingFees,
    };

    if (format === "json") {
      downloadTextFile(
        `${fileBaseName}.json`,
        JSON.stringify(reportPayload, null, 2),
        "application/json;charset=utf-8",
      );
      return;
    }

    const csvContent = [
      "Relatorio consolidado da temporada",
      buildCsvLine(["Exportado em", exportedAt.toLocaleString("pt-BR")]),
      buildCsvLine(["Periodo analitico", analyticsData.periodLabel]),
      buildCsvLine(["Mes de cobranca", billingMonth]),
      "",
      "Resumo financeiro",
      buildCsvLine(["Saldo atual", formatCurrency(summary.currentBalance)]),
      buildCsvLine(["Entradas lancadas", formatCurrency(summary.inflowTotal)]),
      buildCsvLine(["Saidas lancadas", formatCurrency(summary.outflowTotal)]),
      buildCsvLine(["Pendencias", formatCurrency(summary.pendingTotal)]),
      "",
      "Indicadores da temporada",
      buildCsvLine(["Peladas registradas", seasonOverview?.totalMatches ?? ""]),
      buildCsvLine(["Peladas abertas", seasonOverview?.matchesOpen ?? ""]),
      buildCsvLine(["Peladas fechadas", seasonOverview?.matchesClosed ?? ""]),
      buildCsvLine(["Mensalistas ativos", seasonOverview?.activeMembers ?? ""]),
      buildCsvLine(["Adimplencia media", `${adimplenceRate.toFixed(0)}%`]),
      buildCsvLine(["Presenca media", presenceRankingData.length ? `${averageAttendanceRate.toFixed(0)}%` : ""]),
      buildCsvLine(["Em aberto no mes", formatCurrency(monthlyFeeSnapshot.outstandingAmount)]),
      "",
      ["Ranking presenca", "Confirmados", "Chamadas", "Taxa"].join(";"),
      ...presenceRankingData.map((entry) =>
        buildCsvLine([
          entry.playerName,
          entry.confirmedCount,
          entry.totalCalls,
          `${entry.attendanceRate.toFixed(2)}%`,
        ]),
      ),
      "",
      ["Ranking adimplencia", "Pago", "Pendente", "Em aberto", "Status"].join(";"),
      ...paymentRankingData.map((entry) =>
        buildCsvLine([
          entry.playerName,
          formatCurrency(entry.paidAmount),
          formatCurrency(entry.pendingAmount),
          formatCurrency(entry.outstandingAmount),
          entry.isAdimplente ? "Adimplente" : "Em aberto",
        ]),
      ),
    ].join("\n");

    downloadTextFile(`${fileBaseName}.csv`, csvContent, "text/csv;charset=utf-8");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...formValues,
      referenceMonth: formValues.referenceMonth || null,
      relatedPlayerId: formValues.relatedPlayerId || null,
      notes: formValues.notes || "",
    };

    try {
      if (editingTransactionId) {
        await onEditTransaction(editingTransactionId, payload);
      } else {
        await onAddTransaction(payload);
      }

      closeModal();
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  return (
    <section className="page-section">
      <header className="section-heading">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">Financeiro</p>
            <h2 style={{ fontFamily: themeTokens.fontFamily.heading }}>Dashboard</h2>
          </div>
        </div>
        <div className="section-actions">
          {canManageCash && (
            <button type="button" className="primary-button" onClick={openCreateModal}>
              Lançar
            </button>
          )}
          <button type="button" className="ghost-button" onClick={() => handleExportSeasonReport("csv")}>
            CSV
          </button>
          <button type="button" className="ghost-button" onClick={() => handleExportSeasonReport("json")}>
            JSON
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setIsLedgerOpen((prev) => !prev);
              onOpenLedger?.();
            }}
          >
            {isLedgerOpen ? "Ocultar extrato" : "Extrato"}
          </button>
        </div>
      </header>

      <div className="card-grid dashboard-summary-grid">
        <div className="glass-card dashboard-summary-card dashboard-summary-card-wide">
          <h3>Saldo</h3>
          <p>{formatCurrency(summary.currentBalance)}</p>
          <div className="dashboard-flow-list">
            <div className="dashboard-flow-item positive">
              <span className="dashboard-flow-label">Entradas</span>
              <strong className="dashboard-flow-value">{formatCurrency(summary.inflowTotal)}</strong>
            </div>
            <div className="dashboard-flow-item negative">
              <span className="dashboard-flow-label">Saídas</span>
              <strong className="dashboard-flow-value">{formatCurrency(summary.outflowTotal)}</strong>
            </div>
          </div>
        </div>
        <div className="glass-card dashboard-summary-card">
          <h3>Pendências</h3>
          <p>{formatCurrency(summary.pendingTotal)}</p>
        </div>
        <div className="glass-card dashboard-summary-card">
          <h3>Pagas</h3>
          <p>
            {monthlyFeeSnapshot.paidCount}/{monthlyFeeStatuses.length}
          </p>
          <small className="dashboard-summary-note">{formatMonthLabel(billingMonth)}</small>
        </div>
        <div className="glass-card dashboard-summary-card">
          <h3>A receber</h3>
          <p>{formatCurrency(monthlyFeeSnapshot.outstandingAmount)}</p>
          <small className="dashboard-summary-note">{formatPartialPaymentLabel(monthlyFeeSnapshot.pendingCount)}</small>
        </div>
        <div className="glass-card dashboard-summary-card">
          <h3>Adimplência</h3>
          <p>{adimplenceRate.toFixed(0)}%</p>
          <small className="dashboard-summary-note">{paymentRankingData.length} mensalistas</small>
        </div>
        <div className="glass-card dashboard-summary-card">
          <h3>Presença</h3>
          <p>{averageAttendanceRate.toFixed(0)}%</p>
          <small className="dashboard-summary-note">{presenceRankingData.length} no ranking</small>
        </div>
      </div>

      <div className="glass-card dashboard-panel">
        <div className="ledger-heading">
          <div>
            <h3>Convidados a pagar</h3>
            <small className="muted">
              {guestFeeDebts.length} convidado(s) com taxa avulsa pendente
            </small>
          </div>
          <span className="status-chip pending">{formatCurrency(guestFeeDebtTotal)}</span>
        </div>
        {guestFeeDebts.length === 0 ? (
          <p className="empty-state">Nenhum convidado com pagamento pendente.</p>
        ) : (
          <div className="guest-fee-list">
            {guestFeeDebts.map((entry) => {
              const matchEntry = matchById.get(entry.matchId);
              const matchLocation = matchEntry?.location ? ` · ${matchEntry.location}` : "";
              const matchLabel = matchEntry
                ? `${formatMatchDateTime(matchEntry.scheduledAt)}${matchLocation}`
                : "Pelada não localizada";

              return (
                <article key={entry.id} className="guest-fee-row">
                  <div>
                    <strong>{entry.displayName}</strong>
                    <p className="muted">{matchLabel}</p>
                    <p className="muted">
                      Responsável: {entry.invitedByName ?? "Nao informado"}
                    </p>
                  </div>
                  <div className="guest-fee-actions">
                    <strong>{formatCurrency(entry.guestFeeOutstanding)}</strong>
                    {canManageCash && (
                      <>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={isSubmittingGuestFee}
                          onClick={() => void onMarkGuestFeePaid(entry.id)}
                        >
                          Marcar pago
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={isSubmittingGuestFee}
                          onClick={() => void onWaiveGuestFee(entry.id)}
                        >
                          Desconsiderar
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-card dashboard-panel dashboard-panel-hero">
        <div className="ledger-heading dashboard-evolution-heading">
          <div>
            <h3>Fluxo mensal</h3>
          </div>
          <label className="dashboard-period-select">
            <span className="sr-only">Período</span>
            <select
              className="input-field input-compact"
              value={analyticsPeriod}
              onChange={handleAnalyticsPeriodChange}
            >
              {DASHBOARD_ANALYTICS_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {analyticsData.monthlySeries.length === 0 ? (
          <p className="empty-state">Sem dados no período selecionado.</p>
        ) : (
          <div className="ledger-list dashboard-evolution-list">
            {analyticsData.monthlySeries.map((point) => (
              <article key={point.key} className="attendance-row dashboard-evolution-row">
                <div>
                  <strong>{point.label}</strong>
                  <p className="dashboard-summary-note">{formatCurrency(point.balance)} de saldo</p>
                </div>
                <div className="dashboard-evolution-bars">
                  <div className="dashboard-evolution-bar-block">
                    <div className="dashboard-evolution-bar-label">
                      <span>Entradas</span>
                      <strong>{formatCurrency(point.inflow)}</strong>
                    </div>
                    <div className="dashboard-evolution-track">
                      <div
                        className="dashboard-evolution-fill positive"
                        style={{ width: `${Math.min(100, (point.inflow / maxMonthlyFlow) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="dashboard-evolution-bar-block">
                    <div className="dashboard-evolution-bar-label">
                      <span>Saídas</span>
                      <strong>{formatCurrency(point.outflow)}</strong>
                    </div>
                    <div className="dashboard-evolution-track">
                      <div
                        className="dashboard-evolution-fill negative"
                        style={{ width: `${Math.min(100, (point.outflow / maxMonthlyFlow) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card toolbar-card dashboard-toolbar-card">
        <div className="toolbar-header">
          <div>
            <h3>Cobrança</h3>
          </div>
          <label className="month-filter">
            Referência
            <input
              className="input-field"
              type="month"
              value={billingMonth}
              onChange={(event) => setBillingMonth(event.target.value || getCurrentMonthValue())}
            />
          </label>
        </div>
        <div className="quick-actions">
          <button type="button" className="ghost-button" onClick={() => setBillingMonth(getCurrentMonthValue())}>
            Este mês
          </button>
          <button type="button" className="ghost-button" onClick={() => setBillingMonth(getPreviousMonthValue())}>
            Mês anterior
          </button>
        </div>
        <div className="monthly-fee-grid">
          {monthlyFeeStatuses.map((status) => {
            const player = memberOptions.find((entry) => entry.id === status.playerId);
            return (
              <article key={status.playerId} className="monthly-fee-card">
                <div className="monthly-fee-header">
                  <div>
                    <h4>{status.playerNickname ? `${status.playerName} (${status.playerNickname})` : status.playerName}</h4>
                  </div>
                  <span className={`status-chip ${status.paymentState.toLowerCase()}`}>
                    {paymentStateLabels[status.paymentState]}
                  </span>
                </div>
                <div className="monthly-fee-metrics">
                  <span>Mensalidade <strong>{formatCurrency(status.expectedAmount)}</strong></span>
                  <span>Pago <strong>{formatCurrency(status.paidAmount)}</strong></span>
                  <span>Pendente <strong>{formatCurrency(status.pendingAmount)}</strong></span>
                </div>
                {canManageCash && player && (
                  <div className="monthly-fee-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => openMonthlyFeeModal(player)}
                    >
                      {status.paymentState === "PARTIAL" ? "Complementar" : "Registrar"}
                    </button>
                    {status.latestTransactionId && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => openEditModal(status.latestTransactionId as string)}
                      >
                        Ajustar
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {isLedgerOpen && (
        <div className="glass-card toolbar-card dashboard-toolbar-card">
          <div className="toolbar-header">
            <h3>Filtros</h3>
            <div className="quick-actions">
              <button type="button" className="ghost-button" onClick={() => handleLedgerMonthFilter(getCurrentMonthValue())}>
                Este mês
              </button>
              <button type="button" className="ghost-button" onClick={() => handleLedgerMonthFilter(getPreviousMonthValue())}>
                Mês anterior
              </button>
              <button type="button" className="ghost-button" onClick={handleClearLedgerFilters}>
                Limpar
              </button>
            </div>
          </div>
          <div className="filter-grid">
            <label>
              Buscar
              <input
                className="input-field"
                placeholder="Mensalidade, churrasco, observação..."
                value={ledgerFilters.search}
                onChange={handleLedgerFilterChange("search")}
              />
            </label>
            <label>
              Categoria
              <select className="input-field" value={ledgerFilters.category} onChange={handleLedgerFilterChange("category")}>
                <option value="ALL">Todas</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select className="input-field" value={ledgerFilters.status} onChange={handleLedgerFilterChange("status")}>
                <option value="ALL">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mensalista
              <select className="input-field" value={ledgerFilters.playerId} onChange={handleLedgerFilterChange("playerId")}>
                <option value="">Todos</option>
                {memberOptions.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.nickname ? `${player.fullName} (${player.nickname})` : player.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Referência
              <input
                className="input-field"
                type="month"
                value={ledgerFilters.referenceMonth}
                onChange={handleLedgerFilterChange("referenceMonth")}
              />
            </label>
          </div>
        </div>
      )}

      <div className="glass-card ledger-card dashboard-ledger-card">
        <div className="ledger-heading">
          <div>
            <h3>{isLedgerOpen ? "Extrato" : "Movimentações"}</h3>
            <small className="muted">{filteredTransactions.length} registros</small>
          </div>
          <div className="section-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => handleExportLedger("csv")}
              disabled={filteredTransactions.length === 0}
            >
              Exportar CSV
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => handleExportLedger("json")}
              disabled={filteredTransactions.length === 0}
            >
              Exportar JSON
            </button>
          </div>
        </div>
        <div className="ledger-list">
          {isLoading ? (
            <p className="muted">Carregando...</p>
          ) : (
            visibleTransactions.map((transaction) => (
              <article key={transaction.id} className="transaction-item">
                <div>
                  <p>{transaction.description}</p>
                  <small className="muted">
                    {categoryLabels[transaction.category]} · {statusLabels[transaction.status]} ·{" "}
                    {new Date(transaction.occurredOn).toLocaleDateString("pt-BR")}
                  </small>
                  {(transaction.relatedPlayerName || transaction.relatedPlayerId) && (
                    <small className="muted">
                      Mensalista:{" "}
                      {transaction.relatedPlayerName ||
                        transactionPlayerNames.get(transaction.relatedPlayerId ?? "") ||
                        "Vinculo indisponivel"}
                    </small>
                  )}
                </div>
                <div className="transaction-meta">
                  <strong
                    style={{
                      color:
                        transaction.direction === "INFLOW"
                          ? themeTokens.color.success
                          : themeTokens.color.warning,
                    }}
                  >
                    {transaction.direction === "INFLOW" ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </strong>
                  {canManageCash && (
                    <div className="transaction-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => openEditModal(transaction.id)}
                        disabled={isSubmittingTransaction}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => void handleVoidClick(transaction.id)}
                        disabled={isSubmittingTransaction || transaction.status === "VOIDED"}
                      >
                        {transaction.status === "VOIDED" ? "Estornado" : "Estornar"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card">
            <div className="ledger-heading">
              <div>
                <p className="eyebrow">Caixa</p>
                <h3>{editingTransactionId ? "Editar lançamento" : "Novo lançamento"}</h3>
              </div>
              <button type="button" className="ghost-button" onClick={closeModal}>
                Fechar
              </button>
            </div>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                Direção
                <select className="input-field" value={formValues.direction} onChange={handleFieldChange("direction")}>
                  <option value="INFLOW">{directionLabels.INFLOW}</option>
                  <option value="OUTFLOW">{directionLabels.OUTFLOW}</option>
                </select>
              </label>
              <label>
                Categoria
                <select className="input-field" value={formValues.category} onChange={handleFieldChange("category")}>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select className="input-field" value={formValues.status} onChange={handleFieldChange("status")}>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Valor
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.amount}
                  onChange={handleFieldChange("amount")}
                  required
                />
              </label>
              <label className="form-span-2">
                Descrição
                <input
                  className="input-field"
                  value={formValues.description}
                  onChange={handleFieldChange("description")}
                  required
                />
              </label>
              <label>
                Data
                <input
                  className="input-field"
                  type="date"
                  value={formValues.occurredOn}
                  onChange={handleFieldChange("occurredOn")}
                  required
                />
              </label>
              <label>
                Mês de referência
                <input
                  className="input-field"
                  type="month"
                  value={formValues.referenceMonth ?? ""}
                  onChange={handleFieldChange("referenceMonth")}
                />
              </label>
              <label className="form-span-2">
                Mensalista vinculado
                <select
                  className="input-field"
                  value={formValues.relatedPlayerId ?? ""}
                  onChange={handleFieldChange("relatedPlayerId")}
                >
                  <option value="">Sem vínculo</option>
                  {memberOptions.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.nickname ? `${player.fullName} (${player.nickname})` : player.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-span-2">
                Observações
                <textarea
                  className="input-field textarea-field"
                  value={formValues.notes ?? ""}
                  onChange={handleFieldChange("notes")}
                />
              </label>
              <div className="section-actions form-span-2">
                <button type="button" className="ghost-button" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={isSubmittingTransaction}>
                  {isSubmittingTransaction
                    ? "Salvando..."
                    : editingTransactionId
                      ? "Salvar alterações"
                      : "Salvar lançamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
