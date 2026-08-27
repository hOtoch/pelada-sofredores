import { useEffect, useMemo, useState } from "react";

import type { OverallHistorySnapshot } from "../../domain/types";

const compactQuery = "(max-width: 640px)";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

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

/**
 * Grafico de evolucao de overall por pelada. Com `focusPlayerId` mostra so um
 * jogador — e o modo usado no painel do usuario comum.
 */
export function OverallHistoryPanel({
  overallHistory,
  focusPlayerId,
  eyebrow = "Histórico",
  title = "Evolução dos overalls",
}: {
  overallHistory?: OverallHistorySnapshot | null;
  focusPlayerId?: string | null;
  eyebrow?: string | null;
  title?: string;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<OverallHistoryHoverPoint | null>(null);
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia(compactQuery).matches,
  );
  const [hoveredLegendPlayerId, setHoveredLegendPlayerId] = useState<string | null>(null);
  useEffect(() => {
    const query = window.matchMedia(compactQuery);
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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
        const rawValues = matches.map(
          (historyMatch) =>
            overallByMatchAndPlayer.get(`${historyMatch.matchId}:${player.playerId}`) ?? null,
        );
        let lastKnownOverall: number | null = null;
        const values = rawValues.map((value) => {
          if (value !== null) {
            lastKnownOverall = value;
            return value;
          }

          return lastKnownOverall;
        });
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
      .filter((player) => player.presentValues.length > 0)
      .filter((player) => !focusPlayerId || player.playerId === focusPlayerId);

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
  }, [focusPlayerId, overallHistory]);

  const width = 960;
  // No modo de um jogador so o grafico e mais baixo, mas no celular a tela e
  // estreita demais para isso: la ele volta a proporcao normal.
  const height = focusPlayerId && !isCompact ? 330 : 520;
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
    ? Math.min(Math.max(hoveredPoint.x + 16, margin.left + 6), width - margin.right - tooltipWidth)
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
    <div
      className={`overall-history-panel glass-card${focusPlayerId ? " overall-history-panel--focused" : ""}`}
    >
      <div className="ledger-heading">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
          <small className="muted">
            {focusPlayerId
              ? `${matches.length} pelada(s) registrada(s)`
              : `${series.length} mensalista(s) em ${matches.length} pelada(s) registrada(s) desde 26/05`}
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
                    {hoveredPoint.location
                      ? ` · ${truncateTooltipText(hoveredPoint.location, 18)}`
                      : ""}
                  </text>
                  <text x="18" y="76" className="overall-history-tooltip-overall">
                    {hoveredPoint.overall} OVR
                  </text>
                  {hoveredPoint.delta !== null ? (
                    <text
                      x="118"
                      y="76"
                      className={`overall-history-tooltip-delta ${
                        hoveredPoint.delta > 0
                          ? "positive"
                          : hoveredPoint.delta < 0
                            ? "negative"
                            : ""
                      }`}
                    >
                      {hoveredPoint.delta > 0 ? `+${hoveredPoint.delta}` : hoveredPoint.delta} desde
                      anterior
                    </text>
                  ) : null}
                </g>
              ) : null}
            </svg>
          </div>

          {focusPlayerId ? null : (
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
          )}
        </>
      )}
    </div>
  );
}
