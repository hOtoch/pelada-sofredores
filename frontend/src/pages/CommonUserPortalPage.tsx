import { useEffect, useMemo, useState } from "react";

import type {
  AttendanceStatus,
  MatchStatus,
  TransactionCategory,
  TransactionDirection,
  TransactionStatus,
} from "../domain/types";
import type { CommonUserPortalPageProps } from "../features/profile/contracts";
import { themeTokens } from "../theme/tokens";
import "../components/profile/profile-portal.css";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const directionLabels: Record<TransactionDirection, string> = {
  INFLOW: "Entrada",
  OUTFLOW: "Saida",
};

const categoryLabels: Record<TransactionCategory, string> = {
  MONTHLY_FEE: "Mensalidade",
  EXTRA_FEE: "Taxa extra",
  FIELD_RENT: "Campo",
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

const attendanceStatusLabel: Record<AttendanceStatus, string> = {
  CONFIRMED: "Confirmado",
  PENDING: "Pendente",
  DECLINED: "Nao vai",
};

const matchStatusLabel: Record<MatchStatus, string> = {
  OPEN: "Aberta",
  ARCHIVED: "Finalizada",
};

function formatDateTime(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatMonth(value: string) {
  return monthFormatter.format(new Date(`${value}-01T12:00:00`));
}

function getMonthValue(value?: string | null) {
  return value ? value.slice(0, 7) : "";
}

export function CommonUserPortalPage({
  currentUser,
  linkedPlayer,
  finance,
  transactions,
  players,
  matches,
  recentAttendance,
  isLoading,
  onRefresh,
}: CommonUserPortalPageProps) {
  const [selectedMonth, setSelectedMonth] = useState(finance.referenceMonth);

  useEffect(() => {
    setSelectedMonth(finance.referenceMonth);
  }, [finance.referenceMonth]);

  const monthOptions = useMemo(() => {
    const months = new Set([finance.referenceMonth]);
    transactions.forEach((transaction) => {
      months.add(
        getMonthValue(transaction.referenceMonth) || getMonthValue(transaction.occurredOn),
      );
    });
    return Array.from(months)
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left));
  }, [finance.referenceMonth, transactions]);

  const monthlyTransactions = useMemo(
    () =>
      transactions
        .filter((transaction) => {
          const transactionMonth =
            getMonthValue(transaction.referenceMonth) || getMonthValue(transaction.occurredOn);
          return transactionMonth === selectedMonth;
        })
        .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn)),
    [selectedMonth, transactions],
  );

  const monthlySummary = useMemo(() => {
    const paidAmount = monthlyTransactions
      .filter(
        (transaction) =>
          transaction.direction === "INFLOW" &&
          transaction.status === "POSTED" &&
          transaction.category === "MONTHLY_FEE",
      )
      .reduce((total, transaction) => total + transaction.amount, 0);
    const pendingAmount = monthlyTransactions
      .filter((transaction) => transaction.status === "PENDING")
      .reduce((total, transaction) => total + transaction.amount, 0);
    const expectedAmount = linkedPlayer?.monthlyFeeAmount ?? finance.monthlyFeeAmount;

    return {
      expectedAmount,
      paidAmount,
      pendingAmount,
      outstandingAmount: Math.max(expectedAmount - paidAmount, 0),
    };
  }, [finance.monthlyFeeAmount, linkedPlayer?.monthlyFeeAmount, monthlyTransactions]);

  const activePlayers = useMemo(
    () =>
      players
        .filter((player) => player.isActive && player.playerType === "MEMBER")
        .sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [players],
  );

  const attendanceByMatch = useMemo(
    () => new Map(recentAttendance.map((entry) => [entry.matchId, entry.attendanceStatus])),
    [recentAttendance],
  );

  return (
    <section className="page-section common-profile-shell">
      <header className="common-profile-header">
        <div>
          <p className="eyebrow">Jogador</p>
          <h2 style={{ fontFamily: themeTokens.fontFamily.heading }}>
            {linkedPlayer?.nickname || linkedPlayer?.fullName || currentUser.displayName}
          </h2>
          <div className="common-profile-tags">
            <span className="common-profile-tag">@{currentUser.username}</span>
            {linkedPlayer?.preferredPosition ? (
              <span className="common-profile-tag">{linkedPlayer.preferredPosition}</span>
            ) : null}
          </div>
        </div>
        {onRefresh ? (
          <button type="button" className="ghost-button" onClick={() => void onRefresh()}>
            Atualizar
          </button>
        ) : null}
      </header>

      {isLoading ? <p className="empty-state">Sincronizando...</p> : null}

      <div className="glass-card common-extract-card">
        <div className="common-section-heading">
          <div>
            <p className="eyebrow">Extrato</p>
            <h3>{formatMonth(selectedMonth)}</h3>
          </div>
          <select
            className="input-field input-compact"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </div>

        <div className="common-profile-grid">
          <div className="common-mini-stat">
            <span>Mensalidade</span>
            <strong>{currencyFormatter.format(monthlySummary.expectedAmount)}</strong>
          </div>
          <div className="common-mini-stat positive">
            <span>Pago</span>
            <strong>{currencyFormatter.format(monthlySummary.paidAmount)}</strong>
          </div>
          <div className="common-mini-stat warning">
            <span>Pendente</span>
            <strong>{currencyFormatter.format(monthlySummary.pendingAmount)}</strong>
          </div>
          <div
            className={`common-mini-stat ${monthlySummary.outstandingAmount > 0 ? "warning" : "positive"}`}
          >
            <span>Em aberto</span>
            <strong>{currencyFormatter.format(monthlySummary.outstandingAmount)}</strong>
          </div>
        </div>

        <div className="common-extract-list">
          {monthlyTransactions.length === 0 ? (
            <p className="empty-state">Sem lançamentos neste mês.</p>
          ) : (
            monthlyTransactions.map((transaction) => (
              <article key={transaction.id} className="common-extract-row">
                <div>
                  <strong>{transaction.description}</strong>
                  <small>
                    {categoryLabels[transaction.category]} · {statusLabels[transaction.status]} ·{" "}
                    {new Date(transaction.occurredOn).toLocaleDateString("pt-BR")}
                  </small>
                </div>
                <span className={transaction.direction === "INFLOW" ? "positive" : "warning"}>
                  {directionLabels[transaction.direction]}{" "}
                  {currencyFormatter.format(transaction.amount)}
                </span>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="common-profile-panels">
        <section className="glass-card common-profile-section">
          <div className="common-section-heading">
            <h3>Elenco</h3>
            <span className="muted">{activePlayers.length} jogadores</span>
          </div>
          <div className="common-roster-list">
            {activePlayers.map((player) => (
              <article key={player.id} className="common-roster-row">
                <div>
                  <strong>{player.nickname || player.fullName}</strong>
                  <small>{player.fullName}</small>
                </div>
                <div className="common-roster-meta">
                  <span>{player.preferredPosition}</span>
                  <strong>{player.ratings.overall} OVR</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="glass-card common-profile-section">
          <div className="common-section-heading">
            <h3>Peladas</h3>
            <span className="muted">{matches.length} disponíveis</span>
          </div>
          <div className="common-open-match-list">
            {matches.length === 0 ? (
              <p className="empty-state">Nenhuma pelada disponível.</p>
            ) : (
              matches.map((match) => {
                const attendanceStatus = attendanceByMatch.get(match.id);
                return (
                  <article key={match.id} className="common-open-match-row">
                    <div>
                      <strong>{formatDateTime(match.scheduledAt)}</strong>
                      <small>{match.location || "Local a definir"}</small>
                    </div>
                    <div className="common-roster-meta">
                      <span>{matchStatusLabel[match.status]}</span>
                      {attendanceStatus ? (
                        <strong>{attendanceStatusLabel[attendanceStatus]}</strong>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
