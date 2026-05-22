"""Greedy team balancing implementation for Peladinhas Sofredores."""

from __future__ import annotations

import heapq
from decimal import Decimal
from typing import List, Tuple

from .contracts import (
    BalanceablePlayer,
    TeamGenerationRequest,
    TeamGenerationResult,
    BalancedTeam,
)


class _TeamSlot:
    __slots__ = ("index", "name", "capacity", "players", "total_overall")

    def __init__(self, index: int, capacity: int) -> None:
        self.index = index
        self.name = f"Time {index + 1}"
        self.capacity = capacity
        self.players: List[BalanceablePlayer] = []
        self.total_overall = 0

    def can_receive(self) -> bool:
        return len(self.players) < self.capacity

    def add_player(self, player: BalanceablePlayer) -> None:
        self.players.append(player)
        self.total_overall += player.overall

    @property
    def average(self) -> Decimal:
        if not self.players:
            return Decimal("0")
        return Decimal(self.total_overall) / Decimal(len(self.players))

    def to_balanced_team(self) -> BalancedTeam:
        return BalancedTeam(name=self.name, players=tuple(self.players))


class GreedyTeamBalancer:
    """Simple balancer that keeps team averages close while honoring capacity."""

    def generate(self, request: TeamGenerationRequest) -> TeamGenerationResult:
        players = list(request.players)
        players.sort(key=lambda player: player.overall, reverse=True)
        team_count = max(1, request.config.team_count)
        player_count = len(players)

        base_size = player_count // team_count
        remainder = player_count % team_count

        team_sizes = [base_size + (1 if i < remainder else 0) for i in range(team_count)]
        if player_count == 0:
            team_sizes = [0] * team_count

        slots = [_TeamSlot(index=i, capacity=max(size, 0)) for i, size in enumerate(team_sizes)]

        heap: List[Tuple[Decimal, int, int]] = []
        for slot in slots:
            if slot.can_receive():
                heapq.heappush(heap, (slot.average, len(slot.players), slot.index))

        for player in players:
            if not heap:
                break
            _, _, slot_index = heapq.heappop(heap)
            slot = slots[slot_index]
            slot.add_player(player)
            if slot.can_receive():
                heapq.heappush(heap, (slot.average, len(slot.players), slot.index))

        balanced_teams = tuple(slot.to_balanced_team() for slot in slots)

        averages = [slot.average for slot in slots]
        gap = max(averages) - min(averages) if averages else Decimal("0")

        diagnostics = {
            "team_size_targets": team_sizes,
            "assigned_team_sizes": [len(slot.players) for slot in slots],
            "average_gap": str(gap),
            "player_count": player_count,
            "team_count": team_count,
            "config": request.config.__dict__,
        }

        return TeamGenerationResult(teams=balanced_teams, average_overall_gap=gap, diagnostics=diagnostics)
