"""Greedy team balancing implementation for Peladinhas Sofredores."""

from __future__ import annotations

from decimal import Decimal

from .contracts import (
    BalanceablePlayer,
    BalancedTeam,
    TeamGenerationRequest,
    TeamGenerationResult,
)


class _TeamSlot:
    __slots__ = ("index", "name", "capacity", "players", "total_overall")

    def __init__(self, index: int, capacity: int) -> None:
        self.index = index
        self.name = f"Time {index + 1}"
        self.capacity = capacity
        self.players: list[BalanceablePlayer] = []
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
    """Balancer that searches for the lowest practical overall gap."""

    EXACT_SEARCH_PLAYER_LIMIT = 16
    DEFENSIVE_POSITIONS = {"GOALKEEPER", "DEFENDER"}

    def _is_defensive(self, player: BalanceablePlayer) -> bool:
        return player.preferred_position in self.DEFENSIVE_POSITIONS

    def _build_slots(self, player_count: int, team_count: int) -> list[_TeamSlot]:
        base_size = player_count // team_count
        remainder = player_count % team_count
        team_sizes = [base_size + (1 if i < remainder else 0) for i in range(team_count)]
        if player_count == 0:
            team_sizes = [0] * team_count
        return [_TeamSlot(index=i, capacity=max(size, 0)) for i, size in enumerate(team_sizes)]

    def _score(
        self,
        totals: list[int],
        sizes: list[int],
        capacities: list[int],
        defensive_counts: list[int],
    ) -> tuple[int, Decimal, Decimal, int]:
        total_gap = max(totals) - min(totals) if totals else 0
        defensive_gap = max(defensive_counts) - min(defensive_counts) if defensive_counts else 0
        averages = [
            Decimal(total) / Decimal(size)
            for total, size in zip(totals, sizes, strict=False)
            if size > 0
        ]
        average_gap = max(averages) - min(averages) if averages else Decimal("0")

        if len(set(capacities)) == 1:
            return defensive_gap, Decimal(total_gap), average_gap, max(totals, default=0)
        return defensive_gap, average_gap, Decimal(total_gap), max(totals, default=0)

    def _generate_greedy(self, players: list[BalanceablePlayer], team_count: int) -> list[_TeamSlot]:
        slots = self._build_slots(len(players), team_count)
        for player in players:
            available_slots = [slot for slot in slots if slot.can_receive()]
            if not available_slots:
                break
            slot = min(available_slots, key=lambda item: (item.total_overall, len(item.players), item.index))
            slot.add_player(player)
        return slots

    def _generate_exact(self, players: list[BalanceablePlayer], team_count: int) -> list[_TeamSlot] | None:
        if len(players) > self.EXACT_SEARCH_PLAYER_LIMIT:
            return None

        capacities = [slot.capacity for slot in self._build_slots(len(players), team_count)]
        assignments: list[list[BalanceablePlayer]] = [[] for _ in capacities]
        totals = [0 for _ in capacities]
        sizes = [0 for _ in capacities]
        defensive_counts = [0 for _ in capacities]
        best_score: tuple[int, Decimal, Decimal, int] | None = None
        best_assignments: list[list[BalanceablePlayer]] | None = None

        def backtrack(player_index: int) -> None:
            nonlocal best_score, best_assignments

            if player_index == len(players):
                score = self._score(totals, sizes, capacities, defensive_counts)
                if best_score is None or score < best_score:
                    best_score = score
                    best_assignments = [team.copy() for team in assignments]
                return

            player = players[player_index]
            seen_team_states = set()
            for team_index, capacity in enumerate(capacities):
                if sizes[team_index] >= capacity:
                    continue

                team_state = (sizes[team_index], totals[team_index])
                if team_state in seen_team_states:
                    continue
                seen_team_states.add(team_state)

                assignments[team_index].append(player)
                totals[team_index] += player.overall
                sizes[team_index] += 1
                if self._is_defensive(player):
                    defensive_counts[team_index] += 1
                backtrack(player_index + 1)
                if self._is_defensive(player):
                    defensive_counts[team_index] -= 1
                sizes[team_index] -= 1
                totals[team_index] -= player.overall
                assignments[team_index].pop()

        backtrack(0)
        if best_assignments is None:
            return None

        slots = self._build_slots(len(players), team_count)
        for slot, assigned_players in zip(slots, best_assignments, strict=False):
            for player in assigned_players:
                slot.add_player(player)
        return slots

    def _improve_with_swaps(self, slots: list[_TeamSlot]) -> list[_TeamSlot]:
        capacities = [slot.capacity for slot in slots]

        def defensive_counts() -> list[int]:
            return [
                sum(1 for player in slot.players if self._is_defensive(player))
                for slot in slots
            ]

        def current_score() -> tuple[int, Decimal, Decimal, int]:
            return self._score(
                [slot.total_overall for slot in slots],
                [len(slot.players) for slot in slots],
                capacities,
                defensive_counts(),
            )

        improved = True
        while improved:
            improved = False
            baseline = current_score()
            best_move: tuple[int, int, int, int] | None = None
            best_score = baseline
            for left_index, left_slot in enumerate(slots):
                for right_index in range(left_index + 1, len(slots)):
                    right_slot = slots[right_index]
                    for left_player_index, left_player in enumerate(left_slot.players):
                        for right_player_index, right_player in enumerate(right_slot.players):
                            next_totals = [slot.total_overall for slot in slots]
                            next_totals[left_index] += right_player.overall - left_player.overall
                            next_totals[right_index] += left_player.overall - right_player.overall
                            next_defensive_counts = defensive_counts()
                            left_delta = (
                                (1 if self._is_defensive(right_player) else 0)
                                - (1 if self._is_defensive(left_player) else 0)
                            )
                            right_delta = -left_delta
                            next_defensive_counts[left_index] += left_delta
                            next_defensive_counts[right_index] += right_delta
                            next_score = self._score(
                                next_totals,
                                [len(slot.players) for slot in slots],
                                capacities,
                                next_defensive_counts,
                            )
                            if next_score < best_score:
                                best_score = next_score
                                best_move = (left_index, left_player_index, right_index, right_player_index)

            if best_move is not None:
                left_index, left_player_index, right_index, right_player_index = best_move
                left_slot = slots[left_index]
                right_slot = slots[right_index]
                left_player = left_slot.players[left_player_index]
                right_player = right_slot.players[right_player_index]
                left_slot.players[left_player_index], right_slot.players[right_player_index] = (
                    right_player,
                    left_player,
                )
                left_slot.total_overall += right_player.overall - left_player.overall
                right_slot.total_overall += left_player.overall - right_player.overall
                improved = True
        return slots

    def generate(self, request: TeamGenerationRequest) -> TeamGenerationResult:
        players = list(request.players)
        players.sort(key=lambda player: player.overall, reverse=True)
        team_count = max(1, request.config.team_count)
        player_count = len(players)

        exact_slots = self._generate_exact(players, team_count)
        search_mode = "exact"
        if exact_slots is None:
            exact_slots = self._improve_with_swaps(self._generate_greedy(players, team_count))
            search_mode = "greedy_swap"

        slots = exact_slots
        team_sizes = [slot.capacity for slot in slots]

        balanced_teams = tuple(slot.to_balanced_team() for slot in slots)
        assigned_ids = [
            player.id
            for team in balanced_teams
            for player in team.players
        ]
        if len(assigned_ids) != len(set(assigned_ids)):
            raise ValueError("Team generation produced duplicate player assignments.")

        averages = [slot.average for slot in slots]
        gap = max(averages) - min(averages) if averages else Decimal("0")
        totals = [slot.total_overall for slot in slots]
        total_gap = max(totals) - min(totals) if totals else 0
        defensive_counts = [
            sum(1 for player in slot.players if self._is_defensive(player))
            for slot in slots
        ]
        defensive_gap = max(defensive_counts) - min(defensive_counts) if defensive_counts else 0

        diagnostics = {
            "team_size_targets": team_sizes,
            "assigned_team_sizes": [len(slot.players) for slot in slots],
            "team_total_overalls": totals,
            "total_overall_gap": total_gap,
            "defensive_counts": defensive_counts,
            "defensive_gap": defensive_gap,
            "average_gap": str(gap),
            "player_count": player_count,
            "team_count": team_count,
            "search_mode": search_mode,
            "config": request.config.__dict__,
        }

        return TeamGenerationResult(teams=balanced_teams, average_overall_gap=gap, diagnostics=diagnostics)
