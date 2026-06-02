import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import type { AttendanceStatus, MatchPlayerRatingInput, MatchStatus } from "../domain/types";
import type {
  GuestFormValues,
  MatchFormValues,
  PreMatchPageProps,
} from "../features/pre-match/contracts";
import { themeTokens } from "../theme/tokens";

const defaultGuestForm: GuestFormValues = {
  displayName: "",
  invitedById: null,
  notes: "",
  ratings: {
    overall: 68,
  },
};

const matchStatusLabels: Record<MatchStatus, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberta",
  CLOSED: "Fechada",
  ARCHIVED: "Arquivada",
};

const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  CONFIRMED: "Confirmado",
  PENDING: "Pendente",
  DECLINED: "Nao vai",
};

const createDefaultMatchForm = (): MatchFormValues => {
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + 2);
  scheduledAt.setHours(20, 0, 0, 0);

  const localValue = new Date(scheduledAt.getTime() - scheduledAt.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return {
    scheduledAt: localValue,
    location: "",
    expectedTeamCount: 2,
    status: "OPEN",
    notes: "",
  };
};

const toDateTimeLocalValue = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
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

export function PreMatchPage({
  matches,
  match,
  activeSection = "match",
  attendance,
  availablePlayers,
  generatedTeams,
  averageOverallGap,
  isGeneratingTeams,
  isClearingTeams,
  isSubmittingRatings,
  isLoading,
  isSubmittingAttendance,
  isSubmittingMatch,
  canManageAttendance,
  canManageMatch,
  onSelectMatch,
  onCreateMatch,
  onEditMatch,
  onUpdateMatchStatus,
  onUpdateMatchResult,
  onConfirmPlayer,
  onAddGuest,
  onRemoveAttendance,
  onMarkGuestFeePaid,
  onGenerateTeams,
  onClearGeneratedTeams,
  ratingState,
  onSubmitPlayerRatings,
}: PreMatchPageProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [guestValues, setGuestValues] = useState<GuestFormValues>(defaultGuestForm);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [matchValues, setMatchValues] = useState<MatchFormValues>(createDefaultMatchForm);
  const [resultSummary, setResultSummary] = useState("");
  const [ratingDraft, setRatingDraft] = useState<Record<string, number>>({});
  const [ratingCardIndex, setRatingCardIndex] = useState(0);

  const confirmedCount = attendance.filter((entry) => entry.attendanceStatus === "CONFIRMED").length;
  const isEditableMatch = Boolean(match && (match.status === "OPEN" || match.status === "DRAFT"));
  const canEditAttendance = canManageAttendance && isEditableMatch;
  const canRunGeneration = canManageMatch && isEditableMatch && confirmedCount >= 2;
  const canClearGeneratedTeams = canRunGeneration && generatedTeams.length > 0;
  const ratingItems = ratingState?.items ?? [];
  const completedRatingCount = ratingItems.filter((item) => Boolean(ratingDraft[item.attendanceId])).length;
  const activeRatingItem = ratingItems[ratingCardIndex] ?? null;
  const activeRatingScore = activeRatingItem ? ratingDraft[activeRatingItem.attendanceId] ?? 0 : 0;
  const guestFeeDebts = attendance.filter((entry) => entry.guestFeeIsDue && entry.guestFeeOutstanding > 0);

  const matchHistory = useMemo(
    () => [...matches].sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt)),
    [matches],
  );

  useEffect(() => {
    setResultSummary(match?.resultSummary ?? "");
  }, [match]);

  useEffect(() => {
    const nextDraft: Record<string, number> = {};
    ratingState?.items.forEach((item) => {
      if (item.score) {
        nextDraft[item.attendanceId] = item.score;
      }
    });
    setRatingDraft(nextDraft);
  }, [ratingState]);

  useEffect(() => {
    setRatingCardIndex(0);
  }, [ratingState?.matchId]);

  useEffect(() => {
    if (ratingCardIndex >= ratingItems.length) {
      setRatingCardIndex(Math.max(ratingItems.length - 1, 0));
    }
  }, [ratingCardIndex, ratingItems.length]);

  const handleGuestField =
    (field: keyof GuestFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setGuestValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleGuestRating =
    (field: keyof GuestFormValues["ratings"]) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      setGuestValues((prev) => ({
        ...prev,
        ratings: {
          ...prev.ratings,
          [field]: value,
        },
      }));
    };

  const handleMatchField =
    (field: keyof MatchFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = field === "expectedTeamCount" ? Number(event.target.value) : event.target.value;
      setMatchValues((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const openCreateMatchModal = () => {
    setEditingMatchId(null);
    setMatchValues(createDefaultMatchForm());
    setIsMatchModalOpen(true);
  };

  const openEditMatchModal = () => {
    if (!match) {
      return;
    }

    setEditingMatchId(match.id);
    setMatchValues({
      scheduledAt: toDateTimeLocalValue(match.scheduledAt),
      location: match.location ?? "",
      expectedTeamCount: match.expectedTeamCount,
      status: match.status,
      notes: match.notes ?? "",
    });
    setIsMatchModalOpen(true);
  };

  const closeMatchModal = () => {
    setIsMatchModalOpen(false);
    setEditingMatchId(null);
    setMatchValues(createDefaultMatchForm());
  };

  const handleConfirmPlayer = async () => {
    if (!selectedPlayerId) {
      return;
    }

    try {
      await onConfirmPlayer(selectedPlayerId);
      setSelectedPlayerId("");
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleAddGuest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await onAddGuest(guestValues);
      setGuestValues(defaultGuestForm);
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleMatchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      if (editingMatchId) {
        await onEditMatch(editingMatchId, matchValues);
      } else {
        await onCreateMatch(matchValues);
      }

      closeMatchModal();
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleStatusAction = async (nextStatus: MatchStatus) => {
    if (!match) {
      return;
    }

    try {
      await onUpdateMatchStatus(match.id, nextStatus);
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleResultSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!match) {
      return;
    }

    try {
      await onUpdateMatchResult(match.id, resultSummary.trim());
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleRatingSubmit = async () => {
    if (!ratingState || !onSubmitPlayerRatings) {
      return;
    }

    const ratings: MatchPlayerRatingInput[] = ratingState.items.map((item) => ({
      attendanceId: item.attendanceId,
      score: ratingDraft[item.attendanceId],
    }));

    if (ratings.some((rating) => !rating.score)) {
      return;
    }

    try {
      await onSubmitPlayerRatings(ratings);
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleRatingCardStep = (direction: -1 | 1) => {
    if (ratingItems.length === 0) {
      return;
    }

    setRatingCardIndex((prev) => (prev + direction + ratingItems.length) % ratingItems.length);
  };

  const handleExportRound = (format: "csv" | "json") => {
    if (!match) {
      return;
    }

    const baseName = `pelada-${match.scheduledAt.slice(0, 10)}-${match.status.toLowerCase()}`;
    const attendanceSummary = {
      participants: attendance.filter((entry) => entry.attendanceStatus === "CONFIRMED").length,
      total: attendance.length,
    };

    if (format === "json") {
      downloadTextFile(
        `${baseName}.json`,
        JSON.stringify(
          {
            match,
            attendanceSummary,
            attendance,
            generatedTeams,
            averageOverallGap,
          },
          null,
          2,
        ),
        "application/json;charset=utf-8",
      );
      return;
    }

    const attendanceRows = attendance.map((entry) =>
      [
        entry.displayName,
        entry.isGuest ? "Convidado" : "Mensalista",
        entry.ratings.overall,
        entry.assignedTeamName || entry.assignedTeamNumber || "",
        entry.notes || "",
      ]
        .map((value) => escapeCsvCell(value))
        .join(";"),
    );

    const teamRows = generatedTeams.map((team) =>
      [
        team.name,
        team.players.length,
        team.totalOverall,
        team.averageOverall.toFixed(2),
        team.players.map((player) => player.displayName).join(" | "),
      ]
        .map((value) => escapeCsvCell(value))
        .join(";"),
    );

    const csvContent = [
      "Rodada",
      ["Data", formatDateTime(match.scheduledAt)].map(escapeCsvCell).join(";"),
      ["Local", match.location || "A definir"].map(escapeCsvCell).join(";"),
      ["Status", matchStatusLabels[match.status]].map(escapeCsvCell).join(";"),
      ["Times previstos", match.expectedTeamCount].map(escapeCsvCell).join(";"),
      ["Resultado", match.resultSummary || ""].map(escapeCsvCell).join(";"),
      averageOverallGap != null
        ? ["Gap medio", averageOverallGap.toFixed(2)].map(escapeCsvCell).join(";")
        : ["Gap medio", ""].map(escapeCsvCell).join(";"),
      "",
      "Resumo de participantes",
      ["Participantes", attendanceSummary.participants].map(escapeCsvCell).join(";"),
      ["Total", attendanceSummary.total].map(escapeCsvCell).join(";"),
      "",
      ["Participante", "Tipo", "Overall", "Time", "Observacoes"].join(";"),
      ...attendanceRows,
      "",
      ["Time", "Jogadores", "Overall total", "Media", "Escalacao"].join(";"),
      ...teamRows,
    ].join("\n");

    downloadTextFile(`${baseName}.csv`, csvContent, "text/csv;charset=utf-8");
  };

  const handleExportTeamsText = () => {
    if (!match || generatedTeams.length === 0) {
      return;
    }

    const baseName = `times-${match.scheduledAt.slice(0, 10)}`;
    const totalPlayers = generatedTeams.reduce((total, team) => total + team.players.length, 0);
    const gapLabel = averageOverallGap != null ? averageOverallGap.toFixed(2) : "0.00";
    const teamSections = generatedTeams.map((team) =>
      [
        `${team.name} (${team.players.length} jogadores)`,
        `Overall total: ${team.totalOverall} | Media: ${team.averageOverall.toFixed(1)}`,
        ...team.players.map((player, index) => `${index + 1}. ${player.displayName} - ${player.ratings.overall} OVR`),
      ].join("\n"),
    );

    const textContent = [
      "TIMES DA PELADA",
      "",
      `Data: ${formatDateTime(match.scheduledAt)}`,
      `Local: ${match.location || "A definir"}`,
      `Participantes: ${totalPlayers}`,
      `Gap medio: ${gapLabel}`,
      "",
      "Escalacoes",
      "",
      teamSections.join("\n\n"),
      "",
      "Boa pelada!",
    ].join("\n");

    downloadTextFile(`${baseName}.txt`, textContent, "text/plain;charset=utf-8");
  };

  return (
    <section className="page-section">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Pré-Jogo</p>
          <h2 style={{ fontFamily: themeTokens.fontFamily.heading }}>
            {match ? `Pelada de ${formatDateTime(match.scheduledAt)}` : "Nenhuma pelada selecionada"}
          </h2>
        </div>
        <div className="section-actions">
          {canManageMatch && (
            <button type="button" className="ghost-button" onClick={openCreateMatchModal}>
              Nova pelada
            </button>
          )}
          {canManageMatch && match && (
            <button type="button" className="ghost-button" onClick={openEditMatchModal}>
              Editar pelada
            </button>
          )}
          {canManageMatch && (
            <button
              type="button"
              className="primary-button"
              disabled={!canRunGeneration || isGeneratingTeams || isClearingTeams}
              onClick={() => void onGenerateTeams(match?.expectedTeamCount ?? 2)}
            >
              {isGeneratingTeams ? "Balanceando..." : "Gerar times equilibrados"}
            </button>
          )}
          {match && (
            <button type="button" className="ghost-button" onClick={() => handleExportRound("csv")}>
              Exportar rodada CSV
            </button>
          )}
          {match && (
            <button type="button" className="ghost-button" onClick={() => handleExportRound("json")}>
              Exportar rodada JSON
            </button>
          )}
        </div>
      </header>

      {activeSection === "match" ? (
        <>
          <div className="pre-match-grid">
        <div className="glass-card attendance-card">
          <div className="ledger-heading">
            <div>
              <h3>Pelada ativa</h3>
              {match ? (
                <small className="muted">
                  {formatDateTime(match.scheduledAt)}{match.location ? ` · ${match.location}` : ""}
                </small>
              ) : (
                <small className="muted">Crie ou selecione uma pelada para começar.</small>
              )}
            </div>
            {match && (
              <span className={`status-chip ${match.status.toLowerCase()}`}>
                {matchStatusLabels[match.status]}
              </span>
            )}
          </div>

          {match ? (
            <>
              <div className="match-meta-grid">
                <div>
                  <span className="muted">Times previstos</span>
                  <strong>{match.expectedTeamCount}</strong>
                </div>
                <div>
                  <span className="muted">Participantes</span>
                  <strong>{confirmedCount}</strong>
                </div>
                <div>
                  <span className="muted">Lista</span>
                  <strong>{isEditableMatch ? "Aberta" : "Travada"}</strong>
                </div>
              </div>
              {match.notes ? <p className="muted">{match.notes}</p> : null}
              {canManageMatch && (
                <div className="match-actions">
                  {match.status !== "OPEN" && (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={isSubmittingMatch}
                      onClick={() => void handleStatusAction("OPEN")}
                    >
                      Abrir lista
                    </button>
                  )}
                  {match.status === "OPEN" && (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={isSubmittingMatch}
                      onClick={() => void handleStatusAction("CLOSED")}
                    >
                      Fechar lista
                    </button>
                  )}
                  {match.status !== "ARCHIVED" && (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={isSubmittingMatch}
                      onClick={() => void handleStatusAction("ARCHIVED")}
                    >
                      Arquivar
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="empty-state">Nenhuma pelada cadastrada ainda.</p>
          )}
        </div>

        <div className="glass-card attendance-card">
          <div className="ledger-heading">
            <h3>Histórico de peladas</h3>
            <span className="muted">{matchHistory.length} registradas</span>
          </div>
          {matchHistory.length === 0 ? (
            <p className="empty-state">Sem histórico por enquanto.</p>
          ) : (
            <div className="match-history-list">
              {matchHistory.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`match-history-item ${match?.id === entry.id ? "active" : ""}`}
                  onClick={() => onSelectMatch(entry.id)}
                >
                  <div>
                    <strong>{formatDateTime(entry.scheduledAt)}</strong>
                    <small className="muted">
                      {entry.location || "Local a definir"} · {entry.expectedTeamCount} times
                    </small>
                  </div>
                  <span className={`status-chip ${entry.status.toLowerCase()}`}>
                    {matchStatusLabels[entry.status]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {match && !isEditableMatch && (
        <div className="glass-card attendance-card">
          <div className="ledger-heading">
            <h3>Lista travada</h3>
            <span className={`status-chip ${match.status.toLowerCase()}`}>{matchStatusLabels[match.status]}</span>
          </div>
          <p className="muted">
            Essa pelada está fechada ou arquivada. Você ainda pode consultar presença e times gerados, mas não alterar
            a lista.
          </p>
        </div>
      )}

      {match && (
        <div className="glass-card attendance-card">
          <div className="ledger-heading">
            <div>
              <h3>Resultado da rodada</h3>
              <small className="muted">
                {match.resultRecordedAt
                  ? `Registrado em ${formatDateTime(match.resultRecordedAt)}`
                  : "Ainda sem resultado salvo"}
              </small>
            </div>
            {match.teamsGeneratedAt ? (
              <span className="muted">Times gerados em {formatDateTime(match.teamsGeneratedAt)}</span>
            ) : (
              <span className="muted">Sem escalações geradas ainda</span>
            )}
          </div>
          {canManageMatch ? (
            <form className="result-form" onSubmit={handleResultSubmit}>
              <label className="form-span-2">
                Resumo final
                <textarea
                  className="input-field textarea-field"
                  value={resultSummary}
                  onChange={(event) => setResultSummary(event.target.value)}
                  placeholder="Ex.: Time Roxo 7 x 5 Time Cinza. Destaques da rodada..."
                />
              </label>
              <div className="section-actions">
                <button type="submit" className="primary-button" disabled={isSubmittingMatch}>
                  {isSubmittingMatch ? "Salvando..." : "Salvar resultado"}
                </button>
              </div>
            </form>
          ) : match.resultSummary ? (
            <p>{match.resultSummary}</p>
          ) : (
            <p className="empty-state">O resultado dessa rodada ainda não foi publicado.</p>
          )}
        </div>
      )}

      {canEditAttendance && match && (
        <div className="pre-match-grid">
          <div className="glass-card attendance-card">
            <div className="ledger-heading">
              <h3>Confirmar mensalista</h3>
              <span className="muted">{availablePlayers.length} disponíveis</span>
            </div>
            <div className="inline-form">
              <select
                className="input-field"
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
              >
                <option value="">Selecione um jogador</option>
                {availablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.fullName} · {player.ratings.overall} OVR
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="primary-button"
                disabled={!selectedPlayerId || isSubmittingAttendance}
                onClick={() => void handleConfirmPlayer()}
              >
                Confirmar presença
              </button>
            </div>
          </div>

          <form className="glass-card attendance-card" onSubmit={handleAddGuest}>
            <div className="ledger-heading">
              <h3>Adicionar convidado</h3>
              <span className="muted">Snapshot próprio</span>
            </div>
            <div className="form-grid compact-grid">
              <label className="form-span-2">
                Nome
                <input
                  className="input-field"
                  value={guestValues.displayName}
                  onChange={handleGuestField("displayName")}
                  required
                />
              </label>
              <label className="form-span-2">
                Overall
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  max="99"
                  value={guestValues.ratings.overall}
                  onChange={handleGuestRating("overall")}
                />
              </label>
              <label className="form-span-2">
                Observações
                <textarea
                  className="input-field textarea-field"
                  value={guestValues.notes ?? ""}
                  onChange={handleGuestField("notes")}
                />
              </label>
            </div>
            <div className="section-actions">
              <button type="submit" className="primary-button" disabled={isSubmittingAttendance}>
                {isSubmittingAttendance ? "Salvando..." : "Adicionar convidado"}
              </button>
            </div>
          </form>
        </div>
      )}

      {match && guestFeeDebts.length > 0 && (
        <div className="glass-card attendance-card">
          <div className="ledger-heading">
            <div>
              <h3>Pendências de convidados</h3>
              <small className="muted">
                {guestFeeDebts.length} convidado(s) com taxa avulsa pendente
              </small>
            </div>
            <span className="status-chip pending">
              {currencyFormatter.format(
                guestFeeDebts.reduce((total, entry) => total + entry.guestFeeOutstanding, 0),
              )}
            </span>
          </div>
          <div className="guest-fee-list">
            {guestFeeDebts.map((entry) => (
              <article key={entry.id} className="guest-fee-row">
                <div>
                  <strong>{entry.displayName}</strong>
                  <p className="muted">Taxa de convidado da rodada</p>
                </div>
                <div className="guest-fee-actions">
                  <strong>{currencyFormatter.format(entry.guestFeeOutstanding)}</strong>
                  {canManageMatch && (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={isSubmittingAttendance}
                      onClick={() => void onMarkGuestFeePaid(entry.id)}
                    >
                      Marcar pago
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="pre-match-grid">
        <div className="glass-card attendance-card">
          <div className="ledger-heading">
            <h3>Lista de presença</h3>
            <span className="muted">{confirmedCount} participantes</span>
          </div>
          {isLoading ? (
            <p className="muted">Sincronizando presença...</p>
          ) : attendance.length === 0 ? (
            <p className="empty-state">Nenhuma presença registrada ainda.</p>
          ) : (
            attendance.map((entry) => (
              <article key={entry.id} className="attendance-row attendance-row-rich">
                <div>
                  <strong>{entry.displayName}</strong>
                  <p className="muted">
                    {entry.isGuest ? "Convidado" : "Mensalista"} · {entry.ratings.overall} OVR
                  </p>
                  {entry.isGuest && (
                    <p className={`guest-fee-inline ${entry.guestFeeIsDue ? "warning" : entry.guestFeeStatus.toLowerCase()}`}>
                      Taxa convidado:{" "}
                      {entry.guestFeeStatus === "PAID"
                        ? "paga"
                        : entry.guestFeeIsDue
                          ? `${currencyFormatter.format(entry.guestFeeOutstanding)} pendente`
                          : `${currencyFormatter.format(entry.guestFeeAmount)} ao final da pelada`}
                    </p>
                  )}
                </div>
                <div className="attendance-controls">
                  <span className="muted">{attendanceStatusLabels[entry.attendanceStatus]}</span>
                  {canEditAttendance && (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={isSubmittingAttendance}
                      onClick={() => void onRemoveAttendance(entry.id)}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        <div className="team-board glass-card">
          <div className="ledger-heading">
            <div>
              <h3>Times sugeridos</h3>
              <span className="muted">Gap médio {averageOverallGap ?? 0}</span>
            </div>
            <div className="team-board-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={!match || generatedTeams.length === 0}
                onClick={handleExportTeamsText}
              >
                Exportar texto
              </button>
              {canManageMatch && (
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!canClearGeneratedTeams || isGeneratingTeams || isClearingTeams}
                  onClick={() => void onClearGeneratedTeams()}
                >
                  {isClearingTeams ? "Desfazendo..." : "Desfazer times"}
                </button>
              )}
            </div>
          </div>
          <div className="team-rows">
            {generatedTeams.length === 0 ? (
              <p className="empty-state">Gere os times para ver uma sugestão balanceada.</p>
            ) : (
              generatedTeams.map((team) => (
                <article key={team.name} className="team-card">
                  <header>
                    <h4>{team.name}</h4>
                    <p className="muted">{team.players.length} jogadores</p>
                  </header>
                  <ul>
                    {team.players.map((player) => (
                      <li key={player.id}>
                        {player.displayName} · {player.ratings.overall} OVR
                      </li>
                    ))}
                  </ul>
                  <footer>
                    <span>Total {team.totalOverall}</span>
                    <span>Média {team.averageOverall.toFixed(1)}</span>
                  </footer>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

        </>
      ) : (
        <div className="rating-arena glass-card">
          <div className="ledger-heading rating-arena-heading">
            <div>
              <p className="eyebrow">Pós-jogo</p>
              <h3>Notas da rodada</h3>
              <small className="muted">
                {ratingState?.ratingsFinalizedAt
                  ? `Finalizadas em ${formatDateTime(ratingState.ratingsFinalizedAt)}`
                  : ratingState?.windowClosesAt
                    ? `Janela aberta até ${formatDateTime(ratingState.windowClosesAt)}`
                    : "A votação abre por 24 horas após o arquivamento da pelada."}
              </small>
            </div>
            <div className="rating-arena-score">
              <span>
                {completedRatingCount}/{ratingItems.length}
              </span>
              <small>cards completos</small>
            </div>
          </div>

          {!match ? (
            <p className="empty-state">Selecione uma pelada para ver as notas.</p>
          ) : !ratingState ? (
            <p className="empty-state">Notas indisponíveis para esta pelada.</p>
          ) : ratingItems.length === 0 && ratingState.log.length === 0 ? (
            <p className="empty-state">{ratingState.lockedReason || "A tela de notas está vazia para esta pelada."}</p>
          ) : (
            <>
              {ratingItems.length > 0 && (
                <div className="rating-carousel-shell">
                  <button
                    type="button"
                    className="rating-carousel-control"
                    disabled={ratingItems.length < 2}
                    onClick={() => handleRatingCardStep(-1)}
                    aria-label="Jogador anterior"
                  >
                    ‹
                  </button>

                  {activeRatingItem && (
                    <article
                      className={`rating-player-card rating-carousel-card ${
                        activeRatingScore ? `rated score-${activeRatingScore}` : ""
                      }`}
                    >
                      <header>
                        <div>
                          <span className="rating-card-kicker">Player card</span>
                          <h4>{activeRatingItem.displayName}</h4>
                        </div>
                        <div className="rating-overall-badge">
                          <strong>{activeRatingItem.currentOverall}</strong>
                          <span>OVR</span>
                        </div>
                      </header>
                      <div className="rating-impact-panel" aria-live="polite">
                        <div className="rating-selected-score">
                          <span>Nota</span>
                          <strong>{activeRatingScore || "-"}</strong>
                        </div>
                        <div className="rating-card-stripes" aria-hidden="true">
                          {Array.from({ length: 10 }, (_, stripeIndex) => (
                            <span
                              key={stripeIndex}
                              className={stripeIndex < activeRatingScore ? "filled" : ""}
                            />
                          ))}
                        </div>
                      </div>
                      {ratingState.canRate ? (
                        <div className="rating-score-grid">
                          {Array.from({ length: 10 }, (_, scoreIndex) => scoreIndex + 1).map((score) => (
                            <button
                              key={score}
                              type="button"
                              className={`rating-score-button ${activeRatingScore === score ? "active" : ""}`}
                              onClick={() =>
                                setRatingDraft((prev) => ({
                                  ...prev,
                                  [activeRatingItem.attendanceId]: score,
                                }))
                              }
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-state">
                          {ratingState.lockedReason || "Você pode acompanhar o log, mas não votar nesta rodada."}
                        </p>
                      )}
                      <footer>
                        <span>{activeRatingItem.ratingCount} voto(s)</span>
                        <strong>
                          {activeRatingItem.averageScore ? `${activeRatingItem.averageScore.toFixed(1)} média` : "Sem média"}
                        </strong>
                      </footer>
                    </article>
                  )}

                  <button
                    type="button"
                    className="rating-carousel-control"
                    disabled={ratingItems.length < 2}
                    onClick={() => handleRatingCardStep(1)}
                    aria-label="Próximo jogador"
                  >
                    ›
                  </button>
                </div>
              )}

              {ratingItems.length > 1 && (
                <div className="rating-carousel-dots" aria-label="Jogadores para avaliar">
                  {ratingItems.map((item, index) => (
                    <button
                      key={item.attendanceId}
                      type="button"
                      className={index === ratingCardIndex ? "active" : ""}
                      onClick={() => setRatingCardIndex(index)}
                      aria-label={`Ir para ${item.displayName}`}
                    />
                  ))}
                </div>
              )}

              {ratingState.canRate && (
                <div className="rating-submit-row">
                  <button
                    type="button"
                    className="primary-button rating-submit-button"
                    disabled={
                      isSubmittingRatings ||
                      ratingItems.length === 0 ||
                      ratingItems.some((item) => !ratingDraft[item.attendanceId])
                    }
                    onClick={() => void handleRatingSubmit()}
                  >
                    {isSubmittingRatings ? "Enviando notas..." : ratingState.hasSubmitted ? "Atualizar notas" : "Enviar notas"}
                  </button>
                </div>
              )}

              <div className="rating-log-panel">
                <div className="ledger-heading">
                  <h3>Log de votos</h3>
                  <span className="muted">{ratingState.log.length} registro(s)</span>
                </div>
                {ratingState.log.length === 0 ? (
                  <p className="empty-state">Nenhum voto registrado ainda.</p>
                ) : (
                  <div className="rating-log-list">
                    {ratingState.log.map((entry) => (
                      <article
                        key={`${entry.raterUserId ?? "legacy"}-${entry.ratedAttendanceId}-${entry.updatedAt}`}
                        className="rating-log-row"
                      >
                        <div>
                          <strong>{entry.raterDisplayName}</strong>
                          <span className="muted">votou em {entry.ratedDisplayName}</span>
                        </div>
                        <div className="rating-log-score">
                          <strong>{entry.score}</strong>
                          <span>{formatDateTime(entry.updatedAt)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {isMatchModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card glass-card">
            <div className="ledger-heading">
              <div>
                <p className="eyebrow">Peladas</p>
                <h3>{editingMatchId ? "Editar pelada" : "Nova pelada"}</h3>
              </div>
              <button type="button" className="ghost-button" onClick={closeMatchModal}>
                Fechar
              </button>
            </div>
            <form className="form-grid" onSubmit={handleMatchSubmit}>
              <label>
                Data e hora
                <input
                  className="input-field"
                  type="datetime-local"
                  value={matchValues.scheduledAt}
                  onChange={handleMatchField("scheduledAt")}
                  required
                />
              </label>
              <label>
                Local
                <input
                  className="input-field"
                  value={matchValues.location}
                  onChange={handleMatchField("location")}
                  placeholder="Arena, bairro, quadra..."
                />
              </label>
              <label>
                Quantidade de times
                <input
                  className="input-field"
                  type="number"
                  min="2"
                  max="6"
                  value={matchValues.expectedTeamCount}
                  onChange={handleMatchField("expectedTeamCount")}
                  required
                />
              </label>
              <label>
                Status inicial
                <select
                  className="input-field"
                  value={matchValues.status}
                  onChange={handleMatchField("status")}
                >
                  <option value="DRAFT">{matchStatusLabels.DRAFT}</option>
                  <option value="OPEN">{matchStatusLabels.OPEN}</option>
                  <option value="CLOSED">{matchStatusLabels.CLOSED}</option>
                  <option value="ARCHIVED">{matchStatusLabels.ARCHIVED}</option>
                </select>
              </label>
              <label className="form-span-2">
                Observações
                <textarea
                  className="input-field textarea-field"
                  value={matchValues.notes ?? ""}
                  onChange={handleMatchField("notes")}
                />
              </label>
              <div className="section-actions form-span-2">
                <button type="button" className="ghost-button" onClick={closeMatchModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={isSubmittingMatch}>
                  {isSubmittingMatch
                    ? "Salvando..."
                    : editingMatchId
                      ? "Salvar pelada"
                      : "Criar pelada"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
