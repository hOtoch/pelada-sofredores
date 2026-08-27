import { useEffect, useMemo, useState } from "react";

import type { TransactionCategory } from "../domain/types";
import type { CommonUserPortalPageProps } from "../features/profile/contracts";
import { OverallHistoryPanel } from "../features/ratings/OverallHistoryPanel";
import "../features/profile/panel.css";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

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

function formatMonth(value: string) {
  return monthFormatter.format(new Date(`${value}-01T12:00:00`));
}

function getMonthValue(value?: string | null) {
  return value ? value.slice(0, 7) : "";
}

/** Faixa do overall, usada so para colorir o numero. */
function getOverallTier(overall: number) {
  if (overall <= 50) {
    return "bronze";
  }
  if (overall <= 70) {
    return "prata";
  }
  if (overall <= 85) {
    return "ouro";
  }
  return "diamante";
}

export function CommonUserPortalPage({
  currentUser,
  linkedPlayer,
  finance,
  cash,
  overallHistory,
  guestDebts,
  transactions,
  matches,
  isLoading,
}: CommonUserPortalPageProps) {
  const [selectedMonth, setSelectedMonth] = useState(finance.referenceMonth);

  useEffect(() => {
    setSelectedMonth(finance.referenceMonth);
  }, [finance.referenceMonth]);

  // Variacao do overall entre as duas ultimas peladas com nota registrada.
  const overallDelta = useMemo(() => {
    if (!linkedPlayer || !overallHistory) {
      return null;
    }

    const values = [...overallHistory.matches]
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
      .map((entry) => entry.points.find((point) => point.playerId === linkedPlayer.id)?.overall)
      .filter((value): value is number => typeof value === "number");

    if (values.length < 2) {
      return null;
    }

    return values[values.length - 1] - values[values.length - 2];
  }, [linkedPlayer, overallHistory]);

  const pendingGuests = useMemo(() => {
    if (!linkedPlayer) {
      return [];
    }

    const matchById = new Map(matches.map((match) => [match.id, match]));

    return guestDebts
      .filter((guest) => guest.invitedById === linkedPlayer.id)
      .map((guest) => ({
        id: guest.id,
        displayName: guest.displayName,
        amount: guest.guestFeeOutstanding || guest.guestFeeAmount,
        scheduledAt: matchById.get(guest.matchId)?.scheduledAt ?? null,
      }))
      .sort((left, right) => (right.scheduledAt ?? "").localeCompare(left.scheduledAt ?? ""));
  }, [guestDebts, linkedPlayer, matches]);

  const guestTotal = pendingGuests.reduce((total, guest) => total + guest.amount, 0);
  const isMonthlyFeeSettled = finance.outstandingBalance <= 0;
  const hasPendencies = !isMonthlyFeeSettled || pendingGuests.length > 0;
  const paidRatio =
    finance.monthlyFeeAmount > 0
      ? Math.min(finance.paidInReferenceMonth / finance.monthlyFeeAmount, 1)
      : 1;

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

  const playerName = linkedPlayer?.nickname || linkedPlayer?.fullName || currentUser.displayName;
  const overall = linkedPlayer?.ratings.overall ?? null;

  return (
    <section className="page-section panel-shell">
      <header className="panel-hero">
        <div className="panel-hero-identity">
          <p className="eyebrow">Painel</p>
          <h2>{playerName}</h2>
        </div>

        <div className="panel-overall">
          <span
            className={`panel-overall-value ${overall === null ? "" : getOverallTier(overall)}`}
          >
            {overall ?? "--"}
          </span>
          <span className="panel-overall-label">Overall</span>
          {overallDelta === null ? null : (
            <span
              className={`panel-delta ${
                overallDelta > 0 ? "up" : overallDelta < 0 ? "down" : "flat"
              }`}
            >
              <span aria-hidden="true">
                {overallDelta > 0 ? "▲" : overallDelta < 0 ? "▼" : "■"}
              </span>
              {overallDelta > 0 ? "+" : ""}
              {overallDelta} na última
            </span>
          )}
        </div>
      </header>

      {isLoading ? <p className="empty-state">Sincronizando...</p> : null}

      <OverallHistoryPanel
        overallHistory={overallHistory}
        focusPlayerId={linkedPlayer?.id}
        eyebrow={null}
        title="Histórico do seu Overall"
      />

      <section className="glass-card panel-block">
        <div className="panel-block-heading">
          <h3>Pendências</h3>
          <span className={`panel-status ${hasPendencies ? "warning" : "ok"}`}>
            <span className="panel-status-dot" aria-hidden="true" />
            {hasPendencies ? "Tem conta aberta" : "Tudo em dia"}
          </span>
        </div>

        <div className="panel-pendency">
          <div className="panel-pendency-top">
            <div>
              <strong>Mensalidade</strong>
              <small>{formatMonth(finance.referenceMonth)}</small>
            </div>
            <span className={isMonthlyFeeSettled ? "panel-amount ok" : "panel-amount warning"}>
              {isMonthlyFeeSettled ? "Paga" : currencyFormatter.format(finance.outstandingBalance)}
            </span>
          </div>
          <div
            className="panel-progress"
            role="img"
            aria-label={`${Math.round(paidRatio * 100)}% da mensalidade paga`}
          >
            <span
              className={isMonthlyFeeSettled ? "ok" : "warning"}
              style={{ width: `${Math.round(paidRatio * 100)}%` }}
            />
          </div>
        </div>

        <div className="panel-guest-list">
          {pendingGuests.length === 0 ? (
            <p className="panel-muted">Nenhum convidado seu com taxa em aberto.</p>
          ) : (
            <>
              <div className="panel-guest-heading">
                <span>Convidados seus</span>
                <strong className="panel-amount warning">
                  {currencyFormatter.format(guestTotal)}
                </strong>
              </div>
              {pendingGuests.map((guest) => (
                <article key={guest.id} className="panel-guest-row">
                  <div>
                    <strong>{guest.displayName}</strong>
                    <small>
                      {guest.scheduledAt
                        ? `Pelada de ${dayFormatter.format(new Date(guest.scheduledAt))}`
                        : "Pelada não identificada"}
                    </small>
                  </div>
                  <span className="panel-amount warning">
                    {currencyFormatter.format(guest.amount)}
                  </span>
                </article>
              ))}
            </>
          )}
        </div>
      </section>

      <section className="glass-card panel-block">
        <div className="panel-block-heading">
          <h3>Caixa</h3>
          <select
            className="input-field input-compact"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            aria-label="Mês do extrato"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </div>

        <div className="panel-cash">
          <div className="panel-cash-main">
            <span>Saldo do grupo</span>
            <strong className={cash.currentBalance >= 0 ? "ok" : "warning"}>
              {currencyFormatter.format(cash.currentBalance)}
            </strong>
          </div>
          <div className="panel-cash-side">
            <span>A receber</span>
            <strong>{currencyFormatter.format(cash.pendingTotal)}</strong>
          </div>
        </div>

        <div className="panel-extract">
          {monthlyTransactions.length === 0 ? (
            <p className="panel-muted">Sem lançamentos seus neste mês.</p>
          ) : (
            monthlyTransactions.map((transaction) => (
              <article key={transaction.id} className="panel-extract-row">
                <span
                  className={`panel-flow ${transaction.direction === "INFLOW" ? "in" : "out"}`}
                  aria-hidden="true"
                />
                <div>
                  <strong>{transaction.description}</strong>
                  <small>
                    {categoryLabels[transaction.category]} ·{" "}
                    {dayFormatter.format(new Date(transaction.occurredOn))}
                    {transaction.status === "PENDING" ? " · pendente" : ""}
                    {transaction.status === "VOIDED" ? " · estornado" : ""}
                  </small>
                </div>
                <span
                  className={`panel-amount ${transaction.direction === "INFLOW" ? "ok" : "warning"}`}
                >
                  {transaction.direction === "INFLOW" ? "+" : "−"}
                  {currencyFormatter.format(transaction.amount)}
                </span>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
