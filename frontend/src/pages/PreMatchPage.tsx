import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import type {
  AttendanceStatus,
  MatchPlayerRatingLogEntry,
  MatchPlayerOverallSummary,
  MatchPlayerRatingInput,
  MatchStatus,
  OverallHistorySnapshot,
} from "../domain/types";
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

const toDateInputValue = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const ratingWindowDurationMs = 24 * 60 * 60 * 1000;
const ratingLogPageSize = 8;

const getRatingLogRaterFilterValue = (entry: MatchPlayerRatingLogEntry) =>
  entry.raterUserId ?? `legacy:${entry.raterDisplayName}`;

const formatRatingScore = (score: number) => score.toFixed(1);
const overallHistoryPalette = [
  "#34d399",
  "#60a5fa",
  "#f97316",
  "#f472b6",
  "#facc15",
  "#a78bfa",
  "#22d3ee",
  "#fb7185",
  "#84cc16",
  "#e879f9",
  "#38bdf8",
  "#f59e0b",
];

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

const downloadCanvasImage = (filename: string, canvas: HTMLCanvasElement) => {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
};

const drawOverallDeltaIcon = (
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  delta: number,
) => {
  if (delta > 0) {
    context.fillStyle = "#34d399";
    context.beginPath();
    context.moveTo(centerX, centerY - 7);
    context.lineTo(centerX - 7, centerY + 7);
    context.lineTo(centerX + 7, centerY + 7);
    context.closePath();
    context.fill();
    return;
  }

  if (delta < 0) {
    context.fillStyle = "#fb7185";
    context.beginPath();
    context.moveTo(centerX, centerY + 7);
    context.lineTo(centerX - 7, centerY - 7);
    context.lineTo(centerX + 7, centerY - 7);
    context.closePath();
    context.fill();
    return;
  }

  context.strokeStyle = "#94a3b8";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(centerX - 7, centerY);
  context.lineTo(centerX + 7, centerY);
  context.stroke();
};

const buildOverallHistoryPath = (points: Array<{ x: number; y: number } | null>) => {
  let path = "";
  let isDrawing = false;

  points.forEach((point) => {
    if (!point) {
      isDrawing = false;
      return;
    }

    path += `${isDrawing ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
    isDrawing = true;
  });

  return path.trim();
};

const getRatingWindowStartedAt = (match: { archivedAt?: string | null; updatedAt?: string; scheduledAt: string }) => {
  const timestamp = Date.parse(match.archivedAt ?? match.updatedAt ?? match.scheduledAt);
  return Number.isFinite(timestamp) ? timestamp : null;
};

type OverallHistoryHoverPoint = {
  playerId: string;
  matchId: string;
  displayName: string;
  overall: number;
  color: string;
  scheduledAt: string;
  location?: string;
  x: number;
  y: number;
  delta: number | null;
};

const truncateTooltipText = (value: string, maxLength = 28) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;

function OverallHistoryPanel({
  overallHistory,
}: {
  overallHistory?: OverallHistorySnapshot | null;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<OverallHistoryHoverPoint | null>(null);
  const [hoveredLegendPlayerId, setHoveredLegendPlayerId] = useState<string | null>(null);
  const chartData = useMemo(() => {
    const matches = [...(overallHistory?.matches ?? [])].sort((left, right) =>
      left.scheduledAt.localeCompare(right.scheduledAt),
    );
    const players = overallHistory?.players ?? [];
    const overallByMatchAndPlayer = new Map<string, number>();

    matches.forEach((historyMatch) => {
      historyMatch.points.forEach((point) => {
        overallByMatchAndPlayer.set(`${historyMatch.matchId}:${point.playerId}`, point.overall);
      });
    });

    const series = players
      .map((player, playerIndex) => {
        const values = matches.map(
          (historyMatch) =>
            overallByMatchAndPlayer.get(`${historyMatch.matchId}:${player.playerId}`) ?? null,
        );
        const presentValues = values.filter((value): value is number => value !== null);
        const lastOverall = presentValues[presentValues.length - 1] ?? null;

        return {
          ...player,
          color: overallHistoryPalette[playerIndex % overallHistoryPalette.length],
          values,
          presentValues,
          lastOverall,
        };
      })
      .filter((player) => player.presentValues.length > 0);

    const allValues = series.flatMap((player) => player.presentValues);
    if (matches.length === 0 || allValues.length === 0) {
      return { matches, series, yMin: 0, yMax: 99, yTicks: [] as number[] };
    }

    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const valueRange = rawMax - rawMin;
    const yPadding = valueRange <= 10 ? 2 : 3;
    const minimumRange = valueRange <= 10 ? 8 : 14;
    let yMin = Math.max(0, Math.floor(rawMin - yPadding));
    let yMax = Math.min(99, Math.ceil(rawMax + yPadding));

    if (yMax - yMin < minimumRange) {
      const padding = Math.ceil((minimumRange - (yMax - yMin)) / 2);
      yMin = Math.max(0, yMin - padding);
      yMax = Math.min(99, yMax + padding);
    }

    if (yMax <= yMin) {
      yMax = Math.min(99, yMin + 10);
    }

    const yTicks = Array.from({ length: 6 }, (_, index) =>
      Math.round(yMin + ((yMax - yMin) * index) / 5),
    ).reverse();

    return { matches, series, yMin, yMax, yTicks };
  }, [overallHistory]);

  const width = 960;
  const height = 520;
  const margin = { top: 34, right: 28, bottom: 68, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const { matches, series, yMin, yMax, yTicks } = chartData;
  const xForIndex = (index: number) =>
    matches.length === 1
      ? margin.left + plotWidth / 2
      : margin.left + (plotWidth * index) / Math.max(matches.length - 1, 1);
  const yForOverall = (overall: number) =>
    margin.top + ((yMax - overall) / Math.max(yMax - yMin, 1)) * plotHeight;
  const labelStep = Math.max(1, Math.ceil(matches.length / 6));
  const tooltipWidth = 236;
  const tooltipHeight = 92;
  const tooltipX = hoveredPoint
    ? Math.min(
        Math.max(hoveredPoint.x + 16, margin.left + 6),
        width - margin.right - tooltipWidth,
      )
    : 0;
  const tooltipY = hoveredPoint
    ? Math.min(
        Math.max(
          hoveredPoint.y - tooltipHeight - 14 < margin.top
            ? hoveredPoint.y + 18
            : hoveredPoint.y - tooltipHeight - 14,
          margin.top + 6,
        ),
        height - margin.bottom - tooltipHeight,
      )
    : 0;
  const activePlayerId = hoveredPoint?.playerId ?? hoveredLegendPlayerId;

  return (
    <div className="overall-history-panel glass-card">
      <div className="ledger-heading">
        <div>
          <p className="eyebrow">Histórico</p>
          <h3>Evolução dos overalls</h3>
          <small className="muted">
            {series.length} mensalista(s) em {matches.length} pelada(s) registrada(s) desde 26/05
          </small>
        </div>
      </div>

      {series.length === 0 ? (
        <p className="empty-state">Ainda não há histórico de overall em peladas registradas.</p>
      ) : (
        <>
          <div className="overall-history-chart-shell">
            <svg
              className="overall-history-chart"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Histórico de overall dos mensalistas por pelada"
            >
              <rect
                x={margin.left}
                y={margin.top}
                width={plotWidth}
                height={plotHeight}
                className="overall-history-plot"
              />
              {yTicks.map((tick) => {
                const y = yForOverall(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={margin.left}
                      x2={width - margin.right}
                      y1={y}
                      y2={y}
                      className="overall-history-grid-line"
                    />
                    <text
                      x={margin.left - 12}
                      y={y + 4}
                      textAnchor="end"
                      className="overall-history-grid-label"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}
              {matches.map((historyMatch, index) => {
                const x = xForIndex(index);
                const shouldShowLabel =
                  matches.length <= 6 ||
                  index === 0 ||
                  index === matches.length - 1 ||
                  index % labelStep === 0;

                return (
                  <g key={historyMatch.matchId}>
                    <line
                      x1={x}
                      x2={x}
                      y1={margin.top}
                      y2={height - margin.bottom}
                      className="overall-history-vertical-line"
                    />
                    {shouldShowLabel ? (
                      <text
                        x={x}
                        y={height - 25}
                        textAnchor="end"
                        transform={`rotate(-35 ${x} ${height - 25})`}
                        className="overall-history-axis-label"
                      >
                        {new Date(historyMatch.scheduledAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {series.map((player) => {
                const points = player.values.map((overall, index) =>
                  overall === null ? null : { x: xForIndex(index), y: yForOverall(overall) },
                );
                const path = buildOverallHistoryPath(points);
                const isHoveredSeries = activePlayerId === player.playerId;
                const isDimmedSeries = Boolean(activePlayerId && !isHoveredSeries);

                return (
                  <g key={player.playerId}>
                    {path ? (
                      <path
                        d={path}
                        className={`overall-history-line ${
                          isHoveredSeries ? "hovered" : isDimmedSeries ? "dimmed" : ""
                        }`}
                        style={{ stroke: player.color }}
                      />
                    ) : null}
                    {player.values.map((overall, index) => {
                      if (overall === null) {
                        return null;
                      }

                      const historyMatch = matches[index];
                      const x = xForIndex(index);
                      const y = yForOverall(overall);
                      const previousValues = player.values
                        .slice(0, index)
                        .filter((value): value is number => value !== null);
                      const previousOverall = previousValues[previousValues.length - 1] ?? null;
                      const delta = previousOverall === null ? null : overall - previousOverall;
                      const isHoveredPoint =
                        hoveredPoint?.playerId === player.playerId &&
                        hoveredPoint.matchId === historyMatch.matchId;
                      const nextHoverPoint = {
                        playerId: player.playerId,
                        matchId: historyMatch.matchId,
                        displayName: player.displayName,
                        overall,
                        color: player.color,
                        scheduledAt: historyMatch.scheduledAt,
                        location: historyMatch.location,
                        x,
                        y,
                        delta,
                      };

                      return (
                        <g key={`${player.playerId}-${historyMatch.matchId}`}>
                          <circle
                            cx={x}
                            cy={y}
                            r={isHoveredPoint ? "7.2" : "4.6"}
                            className={`overall-history-point ${isHoveredPoint ? "hovered" : ""}`}
                            style={{ fill: player.color }}
                          />
                          <circle
                            cx={x}
                            cy={y}
                            r="15"
                            className="overall-history-hit-point"
                            tabIndex={0}
                            aria-label={`${player.displayName}, ${overall} overall em ${formatDateTime(
                              historyMatch.scheduledAt,
                            )}`}
                            onPointerEnter={() => setHoveredPoint(nextHoverPoint)}
                            onPointerMove={() => setHoveredPoint(nextHoverPoint)}
                            onPointerLeave={() => setHoveredPoint(null)}
                            onFocus={() => setHoveredPoint(nextHoverPoint)}
                            onBlur={() => setHoveredPoint(null)}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
              {hoveredPoint ? (
                <g
                  className="overall-history-tooltip"
                  transform={`translate(${tooltipX.toFixed(2)} ${tooltipY.toFixed(2)})`}
                  pointerEvents="none"
                >
                  <rect
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx="8"
                    className="overall-history-tooltip-box"
                  />
                  <circle
                    cx="18"
                    cy="22"
                    r="5"
                    style={{ fill: hoveredPoint.color }}
                    className="overall-history-tooltip-swatch"
                  />
                  <text x="31" y="26" className="overall-history-tooltip-name">
                    {truncateTooltipText(hoveredPoint.displayName)}
                  </text>
                  <text x="18" y="50" className="overall-history-tooltip-meta">
                    {new Date(hoveredPoint.scheduledAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {hoveredPoint.location ? ` · ${truncateTooltipText(hoveredPoint.location, 18)}` : ""}
                  </text>
                  <text x="18" y="76" className="overall-history-tooltip-overall">
                    {hoveredPoint.overall} OVR
                  </text>
                  {hoveredPoint.delta !== null ? (
                    <text
                      x="118"
                      y="76"
                      className={`overall-history-tooltip-delta ${
                        hoveredPoint.delta > 0 ? "positive" : hoveredPoint.delta < 0 ? "negative" : ""
                      }`}
                    >
                      {hoveredPoint.delta > 0 ? `+${hoveredPoint.delta}` : hoveredPoint.delta} desde anterior
                    </text>
                  ) : null}
                </g>
              ) : null}
            </svg>
          </div>

          <div className="overall-history-legend" aria-label="Mensalistas no histórico">
            {series.map((player) => (
              <div
                key={player.playerId}
                className={`overall-history-legend-item ${
                  activePlayerId === player.playerId ? "active" : activePlayerId ? "dimmed" : ""
                }`}
                tabIndex={0}
                onPointerEnter={() => setHoveredLegendPlayerId(player.playerId)}
                onPointerLeave={() => setHoveredLegendPlayerId(null)}
                onFocus={() => setHoveredLegendPlayerId(player.playerId)}
                onBlur={() => setHoveredLegendPlayerId(null)}
              >
                <span
                  className="overall-history-swatch"
                  style={{ backgroundColor: player.color }}
                  aria-hidden="true"
                />
                <strong>{player.displayName}</strong>
                <span>{player.lastOverall} OVR</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
  isFinalizingRatings,
  isRecalculatingRatings,
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
  overallHistory,
  onFinalizeRatings,
  onRecalculateRatings,
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
  const [ratingLogRaterFilter, setRatingLogRaterFilter] = useState("");
  const [ratingLogRatedFilter, setRatingLogRatedFilter] = useState("");
  const [ratingLogDateFilter, setRatingLogDateFilter] = useState("");
  const [ratingLogPage, setRatingLogPage] = useState(1);

  const confirmedCount = attendance.filter((entry) => entry.attendanceStatus === "CONFIRMED").length;
  const isEditableMatch = Boolean(match && (match.status === "OPEN" || match.status === "DRAFT"));
  const canEditAttendance = canManageAttendance && isEditableMatch;
  const canRunGeneration = canManageMatch && isEditableMatch && confirmedCount >= 2;
  const canClearGeneratedTeams = canRunGeneration && generatedTeams.length > 0;
  const overallSummary = ratingState?.overallSummary ?? [];
  const canFinalizeRatings = Boolean(
    canManageMatch &&
      match?.status === "ARCHIVED" &&
      ratingState &&
      !ratingState.ratingsFinalizedAt &&
      onFinalizeRatings,
  );
  const canRecalculateRatings = Boolean(
    canManageMatch &&
      ratingState?.ratingsFinalizedAt &&
      overallSummary.some((item) => item.ratingCount > 0) &&
      onRecalculateRatings,
  );
  const canExportOverallImage = Boolean(ratingState?.ratingsFinalizedAt && overallSummary.length > 0);
  const ratingItems = ratingState?.items ?? [];
  const ratingLogEntries = ratingState?.log ?? [];
  const completedRatingCount = ratingItems.filter((item) => Boolean(ratingDraft[item.attendanceId])).length;
  const activeRatingItem = ratingItems[ratingCardIndex] ?? null;
  const activeRatingScore = activeRatingItem ? ratingDraft[activeRatingItem.attendanceId] ?? 0 : 0;
  const activeRatingFinalScore = Math.ceil(activeRatingScore);
  const guestFeeDebts = attendance.filter((entry) => entry.guestFeeIsDue && entry.guestFeeOutstanding > 0);

  const matchHistory = useMemo(
    () => [...matches].sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt)),
    [matches],
  );
  const hasOpenRatingWindow = useMemo(
    () =>
      matches.some((entry) => {
        if (entry.status !== "ARCHIVED" || entry.ratingsFinalizedAt) {
          return false;
        }

        const startedAt = getRatingWindowStartedAt(entry);
        return startedAt !== null && Date.now() < startedAt + ratingWindowDurationMs;
      }),
    [matches],
  );
  const selectedRatingWindowIsClosed = Boolean(
    activeSection === "ratings" &&
      match?.status === "ARCHIVED" &&
      ratingState?.ratingsFinalizedAt &&
      ratingItems.length === 0,
  );
  const shouldShowOverallHistory =
    activeSection === "ratings" && (!hasOpenRatingWindow || selectedRatingWindowIsClosed);
  const ratingLogRaterOptions = useMemo(() => {
    const options = new Map<string, string>();
    ratingLogEntries.forEach((entry) => {
      options.set(getRatingLogRaterFilterValue(entry), entry.raterDisplayName);
    });
    return Array.from(options, ([value, label]) => ({ value, label })).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [ratingLogEntries]);
  const ratingLogRatedOptions = useMemo(() => {
    const options = new Map<string, string>();
    ratingLogEntries.forEach((entry) => {
      options.set(entry.ratedAttendanceId, entry.ratedDisplayName);
    });
    return Array.from(options, ([value, label]) => ({ value, label })).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [ratingLogEntries]);
  const filteredRatingLog = useMemo(
    () =>
      ratingLogEntries.filter((entry) => {
        const matchesRater =
          !ratingLogRaterFilter || getRatingLogRaterFilterValue(entry) === ratingLogRaterFilter;
        const matchesRated = !ratingLogRatedFilter || entry.ratedAttendanceId === ratingLogRatedFilter;
        const matchesDate = !ratingLogDateFilter || toDateInputValue(entry.updatedAt) === ratingLogDateFilter;
        return matchesRater && matchesRated && matchesDate;
      }),
    [ratingLogDateFilter, ratingLogEntries, ratingLogRatedFilter, ratingLogRaterFilter],
  );
  const ratingLogPageCount = Math.max(1, Math.ceil(filteredRatingLog.length / ratingLogPageSize));
  const currentRatingLogPage = Math.min(ratingLogPage, ratingLogPageCount);
  const paginatedRatingLog = filteredRatingLog.slice(
    (currentRatingLogPage - 1) * ratingLogPageSize,
    currentRatingLogPage * ratingLogPageSize,
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
    setRatingLogRaterFilter("");
    setRatingLogRatedFilter("");
    setRatingLogDateFilter("");
    setRatingLogPage(1);
  }, [ratingState?.matchId]);

  useEffect(() => {
    if (ratingCardIndex >= ratingItems.length) {
      setRatingCardIndex(Math.max(ratingItems.length - 1, 0));
    }
  }, [ratingCardIndex, ratingItems.length]);

  useEffect(() => {
    setRatingLogPage(1);
  }, [ratingLogDateFilter, ratingLogRatedFilter, ratingLogRaterFilter]);

  useEffect(() => {
    if (ratingLogPage > ratingLogPageCount) {
      setRatingLogPage(ratingLogPageCount);
    }
  }, [ratingLogPage, ratingLogPageCount]);

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

  const handleFinalizeRatings = async () => {
    if (!onFinalizeRatings) {
      return;
    }

    try {
      await onFinalizeRatings();
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleRecalculateRatings = async () => {
    if (!onRecalculateRatings) {
      return;
    }

    try {
      await onRecalculateRatings();
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleExportOverallImage = () => {
    if (!match || !ratingState?.ratingsFinalizedAt || overallSummary.length === 0) {
      return;
    }

    const sortedSummary: MatchPlayerOverallSummary[] = [...overallSummary];
    const scale = Math.max(window.devicePixelRatio || 1, 1);
    const width = 900;
    const rowHeight = 58;
    const tableTop = 230;
    const height = tableTop + sortedSummary.length * rowHeight + 64;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.scale(scale, scale);
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#08070d");
    background.addColorStop(1, "#191125");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "#f8f7ff";
    context.font = "700 34px Arial";
    context.fillText("RESUMO DOS OVERALLS", 42, 58);

    context.fillStyle = "#c4b5fd";
    context.font = "500 18px Arial";
    context.fillText(`Pelada de ${formatDateTime(match.scheduledAt)}`, 42, 90);
    context.fillStyle = "#a8a29e";
    context.font = "400 16px Arial";
    context.fillText(`Local: ${match.location || "A definir"}`, 42, 118);
    context.fillText(`Finalizadas em ${formatDateTime(ratingState.ratingsFinalizedAt)}`, 42, 144);

    const increasedCount = sortedSummary.filter((item) => item.delta > 0).length;
    const decreasedCount = sortedSummary.filter((item) => item.delta < 0).length;
    const sameCount = sortedSummary.length - increasedCount - decreasedCount;
    const drawPill = (label: string, value: number, x: number, color: string) => {
      context.fillStyle = "rgba(255,255,255,0.07)";
      context.fillRect(x, 166, 150, 36);
      context.fillStyle = color;
      context.font = "700 18px Arial";
      context.fillText(String(value), x + 18, 190);
      context.fillStyle = "#e7e5e4";
      context.font = "500 14px Arial";
      context.fillText(label, x + 48, 190);
    };
    drawPill("subiram", increasedCount, 42, "#34d399");
    drawPill("cairam", decreasedCount, 208, "#fb7185");
    drawPill("iguais", sameCount, 374, "#94a3b8");

    context.fillStyle = "rgba(255,255,255,0.09)";
    context.fillRect(42, tableTop - 36, width - 84, 36);
    context.fillStyle = "#ddd6fe";
    context.font = "700 14px Arial";
    context.fillText("Jogador", 58, tableTop - 13);
    context.fillText("Antes", 540, tableTop - 13);
    context.fillText("Agora", 650, tableTop - 13);
    context.fillText("Variacao", 760, tableTop - 13);

    const fitText = (text: string, x: number, y: number, maxWidth: number) => {
      if (context.measureText(text).width <= maxWidth) {
        context.fillText(text, x, y);
        return;
      }

      let clipped = text;
      while (clipped.length > 3 && context.measureText(`${clipped}...`).width > maxWidth) {
        clipped = clipped.slice(0, -1);
      }
      context.fillText(`${clipped}...`, x, y);
    };

    sortedSummary.forEach((item, index) => {
      const rowY = tableTop + index * rowHeight;
      context.fillStyle = index % 2 === 0 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.025)";
      context.fillRect(42, rowY, width - 84, rowHeight - 6);

      context.fillStyle = "#f5f3ff";
      context.font = "700 17px Arial";
      fitText(item.displayName, 58, rowY + 22, 400);
      context.fillStyle = "#a8a29e";
      context.font = "400 13px Arial";
      const scoreLabel =
        item.averageScore == null
          ? "Sem votos"
          : `Nota media ${item.averageScore.toFixed(1)} (${item.ratingCount} voto${item.ratingCount === 1 ? "" : "s"})`;
      fitText(scoreLabel, 58, rowY + 43, 400);

      context.fillStyle = "#e7e5e4";
      context.font = "700 18px Arial";
      context.fillText(String(item.previousOverall), 552, rowY + 34);
      context.fillText(String(item.currentOverall), 662, rowY + 34);

      drawOverallDeltaIcon(context, 774, rowY + 28, item.delta);
      context.fillStyle = item.delta > 0 ? "#34d399" : item.delta < 0 ? "#fb7185" : "#94a3b8";
      context.font = "700 18px Arial";
      context.fillText(item.delta > 0 ? `+${item.delta}` : String(item.delta), 798, rowY + 34);
    });

    context.fillStyle = "#78716c";
    context.font = "400 13px Arial";
    context.fillText("Gerado pelo Peladinhas Sofredores", 42, height - 26);

    downloadCanvasImage(`overalls-${match.scheduledAt.slice(0, 10)}.png`, canvas);
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
        <>
          <div className="rating-fixed-actions">
            <div>
              <p className="eyebrow">Pós-jogo</p>
              <strong>Overalls atualizados</strong>
              <small className="muted">
                {ratingState?.ratingsFinalizedAt
                  ? `Finalizadas em ${formatDateTime(ratingState.ratingsFinalizedAt)}`
                  : "A exportação fica disponível após finalizar a janela."}
              </small>
            </div>
            <button
              type="button"
              className="ghost-button"
              disabled={!canExportOverallImage || isRecalculatingRatings}
              onClick={handleExportOverallImage}
            >
              Exportar imagem
            </button>
          </div>

          {shouldShowOverallHistory ? (
            <OverallHistoryPanel overallHistory={overallHistory} />
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
            <div className="rating-arena-actions">
              <div className="rating-arena-score">
                <span>
                  {completedRatingCount}/{ratingItems.length}
                </span>
                <small>cards completos</small>
              </div>
              {canManageMatch && (
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!canFinalizeRatings || isFinalizingRatings || isRecalculatingRatings}
                  onClick={() => void handleFinalizeRatings()}
                >
                  {isFinalizingRatings ? "Finalizando..." : "Finalizar janela"}
                </button>
              )}
              {canManageMatch && ratingState?.ratingsFinalizedAt && (
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!canRecalculateRatings || isRecalculatingRatings || isFinalizingRatings}
                  onClick={() => void handleRecalculateRatings()}
                >
                  {isRecalculatingRatings ? "Recalculando..." : "Recalcular overalls"}
                </button>
              )}
            </div>
          </div>

          {!match ? (
            <p className="empty-state">Selecione uma pelada para ver as notas.</p>
          ) : !ratingState ? (
            <p className="empty-state">Notas indisponíveis para esta pelada.</p>
          ) : ratingItems.length === 0 && ratingLogEntries.length === 0 ? (
            <p className="empty-state">
              {ratingState.ratingsFinalizedAt && overallSummary.length > 0
                ? "Janela finalizada. Exporte a imagem para compartilhar os overalls atualizados."
                : ratingState.lockedReason || "A tela de notas está vazia para esta pelada."}
            </p>
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
                        activeRatingScore ? `rated score-${activeRatingFinalScore}` : ""
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
                          <strong>{activeRatingScore ? activeRatingScore.toFixed(1) : "-"}</strong>
                        </div>
                        <div className="rating-card-stripes" aria-hidden="true">
                          {Array.from({ length: 10 }, (_, stripeIndex) => (
                            <span
                              key={stripeIndex}
                              className={stripeIndex < activeRatingFinalScore ? "filled" : ""}
                            />
                          ))}
                        </div>
                      </div>
                      {ratingState.canRate ? (
                        <div className="rating-score-grid">
                          <div className="rating-score-input">
                            <input
                              aria-label="Nota do jogador"
                              type="number"
                              min="1"
                              max="10"
                              step="0.1"
                              inputMode="decimal"
                              value={activeRatingScore || ""}
                              onChange={(event) => {
                                const nextScore = Number(event.target.value);
                                setRatingDraft((prev) => ({
                                  ...prev,
                                  [activeRatingItem.attendanceId]:
                                    Number.isFinite(nextScore) && nextScore >= 1 && nextScore <= 10
                                      ? nextScore
                                      : 0,
                                }));
                              }}
                            />
                          </div>
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
                  <span className="muted">
                    {filteredRatingLog.length}/{ratingLogEntries.length} registro(s)
                  </span>
                </div>
                {ratingLogEntries.length > 0 && (
                  <div className="rating-log-filters">
                    <label>
                      <span>Quem votou</span>
                      <select
                        value={ratingLogRaterFilter}
                        onChange={(event) => setRatingLogRaterFilter(event.target.value)}
                      >
                        <option value="">Todos</option>
                        {ratingLogRaterOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Quem recebeu</span>
                      <select
                        value={ratingLogRatedFilter}
                        onChange={(event) => setRatingLogRatedFilter(event.target.value)}
                      >
                        <option value="">Todos</option>
                        {ratingLogRatedOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Data do voto</span>
                      <input
                        type="date"
                        value={ratingLogDateFilter}
                        onChange={(event) => setRatingLogDateFilter(event.target.value)}
                      />
                    </label>
                  </div>
                )}
                {ratingLogEntries.length === 0 ? (
                  <p className="empty-state">Nenhum voto registrado ainda.</p>
                ) : filteredRatingLog.length === 0 ? (
                  <p className="empty-state">Nenhum voto encontrado para os filtros selecionados.</p>
                ) : (
                  <>
                    <div className="rating-log-list">
                      {paginatedRatingLog.map((entry) => (
                        <article
                          key={`${entry.raterUserId ?? "legacy"}-${entry.ratedAttendanceId}-${entry.updatedAt}`}
                          className="rating-log-row"
                        >
                          <div>
                            <strong>{entry.raterDisplayName}</strong>
                            <span className="muted">votou em {entry.ratedDisplayName}</span>
                          </div>
                          <div className="rating-log-score">
                            <strong>{formatRatingScore(entry.score)}</strong>
                            <span>{formatDateTime(entry.updatedAt)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                    {ratingLogPageCount > 1 && (
                      <div className="rating-log-pagination">
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={currentRatingLogPage <= 1}
                          onClick={() => setRatingLogPage((page) => Math.max(1, page - 1))}
                        >
                          ‹
                        </button>
                        <span>
                          Página {currentRatingLogPage} de {ratingLogPageCount}
                        </span>
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={currentRatingLogPage >= ratingLogPageCount}
                          onClick={() => setRatingLogPage((page) => Math.min(ratingLogPageCount, page + 1))}
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
            </div>
          )}
        </>
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
