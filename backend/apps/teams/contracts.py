from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Protocol
from uuid import UUID


@dataclass(frozen=True)
class BalanceablePlayer:
    id: UUID | str
    display_name: str
    overall: int
    preferred_position: str = "UNIVERSAL"
    is_guest: bool = False


@dataclass(frozen=True)
class TeamBalanceConfig:
    team_count: int = 2
    max_team_size_delta: int = 1
    keep_goalkeepers_separated: bool = True
    random_seed: int | None = None


@dataclass(frozen=True)
class TeamGenerationRequest:
    players: tuple[BalanceablePlayer, ...]
    config: TeamBalanceConfig = field(default_factory=TeamBalanceConfig)
    match_id: UUID | None = None


@dataclass(frozen=True)
class BalancedTeam:
    name: str
    players: tuple[BalanceablePlayer, ...]

    @property
    def total_overall(self) -> int:
        return sum(player.overall for player in self.players)

    @property
    def average_overall(self) -> Decimal:
        if not self.players:
            return Decimal("0")
        return Decimal(self.total_overall) / Decimal(len(self.players))


@dataclass(frozen=True)
class TeamGenerationResult:
    teams: tuple[BalancedTeam, ...]
    average_overall_gap: Decimal
    diagnostics: dict[str, Any] = field(default_factory=dict)


class TeamBalancer(Protocol):
    def generate(self, request: TeamGenerationRequest) -> TeamGenerationResult:
        ...
