import { useRef, type ChangeEvent } from "react";

import type { MatchSummary, SportsRankingEntry, SportsRankingSnapshot } from "../domain/types";
import { themeTokens } from "../theme/tokens";

type RankingKind = "goals" | "assists" | "wins";

const rankingSections: Array<{
  key: keyof SportsRankingSnapshot;
  title: string;
  eyebrow: string;
  metric: RankingKind;
  emptyLabel: string;
}> = [
  {
    key: "topScorers",
    title: "Artilheiros",
    eyebrow: "Gols",
    metric: "goals",
    emptyLabel: "Nenhum gol importado ainda.",
  },
  {
    key: "topAssistants",
    title: "Assistentes",
    eyebrow: "Assistências",
    metric: "assists",
    emptyLabel: "Nenhuma assistência importada ainda.",
  },
  {
    key: "topWinners",
    title: "Mais vitórias",
    eyebrow: "Vitórias",
    metric: "wins",
    emptyLabel: "Nenhuma vitória importada ainda.",
  },
];

function RankingMetric({ entry, metric }: { entry: SportsRankingEntry; metric: RankingKind }) {
  const value = entry[metric];
  const suffix = metric === "goals" ? "G" : metric === "assists" ? "A" : "V";

  return (
    <div className={`ranking-metric ${metric}`}>
      <strong>{value}</strong>
      <span>{suffix}</span>
    </div>
  );
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

const matchStatusLabels: Record<MatchSummary["status"], string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberta",
  CLOSED: "Fechada",
  ARCHIVED: "Arquivada",
};

export function RankingPage({
  ranking,
  isLoading,
  matches,
  selectedMatch,
  canManageStatsSheet,
  isImportingStatsSheet,
  onSelectMatch,
  onExportStatsSheet,
  onImportStatsSheet,
}: {
  ranking: SportsRankingSnapshot | null;
  isLoading: boolean;
  matches: MatchSummary[];
  selectedMatch: MatchSummary | null;
  canManageStatsSheet: boolean;
  isImportingStatsSheet: boolean;
  onSelectMatch: (matchId: string) => void;
  onExportStatsSheet: () => Promise<void> | void;
  onImportStatsSheet: (file: File) => Promise<void> | void;
}) {
  const statsSheetInputRef = useRef<HTMLInputElement | null>(null);
  const sortedMatches = [...matches].sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt));

  const handleExportStatsSheet = async () => {
    try {
      await onExportStatsSheet();
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  const handleStatsSheetFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      await onImportStatsSheet(file);
    } catch {
      // Parent banner already surfaces the failure.
    }
  };

  return (
    <section className="page-section">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Ranking</p>
          <h2 style={{ fontFamily: themeTokens.fontFamily.heading }}>Estatísticas da temporada</h2>
        </div>
      </header>

      {canManageStatsSheet ? (
        <article className="glass-card ranking-admin-card">
          <div className="ledger-heading">
            <div>
              <p className="eyebrow">Administração</p>
              <h3>Planilha da rodada</h3>
              <small className="muted">
                Exporte a pelada, preencha gols, assistências e vitória, depois importe o CSV preenchido.
              </small>
            </div>
          </div>

          <div className="ranking-admin-actions">
            <label className="ranking-match-select">
              <span>Pelada</span>
              <select
                className="input-field"
                value={selectedMatch?.id ?? ""}
                onChange={(event) => onSelectMatch(event.target.value)}
              >
                <option value="">Selecione uma pelada</option>
                {sortedMatches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {formatDateTime(match.scheduledAt)} · {match.location || "Local a definir"} ·{" "}
                    {matchStatusLabels[match.status]}
                  </option>
                ))}
              </select>
            </label>

            <div className="section-actions ranking-sheet-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={!selectedMatch || isImportingStatsSheet}
                onClick={() => void handleExportStatsSheet()}
              >
                Exportar planilha
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!selectedMatch || isImportingStatsSheet}
                onClick={() => statsSheetInputRef.current?.click()}
              >
                {isImportingStatsSheet ? "Importando..." : "Importar planilha"}
              </button>
              <input
                ref={statsSheetInputRef}
                className="sr-only"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleStatsSheetFile(event)}
              />
            </div>
          </div>
        </article>
      ) : null}

      {isLoading ? (
        <p className="empty-state">Sincronizando ranking...</p>
      ) : (
        <div className="ranking-grid">
          {rankingSections.map((section) => {
            const entries = ranking?.[section.key] ?? [];

            return (
              <article key={section.key} className="glass-card ranking-card">
                <div className="ledger-heading">
                  <div>
                    <p className="eyebrow">{section.eyebrow}</p>
                    <h3>{section.title}</h3>
                  </div>
                  <span className="muted">{entries.length} jogador(es)</span>
                </div>

                {entries.length === 0 ? (
                  <p className="empty-state">{section.emptyLabel}</p>
                ) : (
                  <div className="ranking-list">
                    {entries.map((entry, index) => (
                      <div key={`${section.key}-${entry.playerId ?? entry.playerName}`} className="ranking-row">
                        <span className="ranking-position">{index + 1}</span>
                        <div className="ranking-player">
                          <strong>{entry.playerName}</strong>
                          <small className="muted">
                            {entry.goals} gol(s) · {entry.assists} assistência(s) · {entry.wins} vitória(s)
                          </small>
                        </div>
                        <RankingMetric entry={entry} metric={section.metric} />
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
