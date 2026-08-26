"""Unit tests for the team balancing implementation."""

import unittest
from decimal import Decimal

from apps.teams.balancer import GreedyTeamBalancer
from apps.teams.contracts import BalanceablePlayer, TeamBalanceConfig, TeamGenerationRequest


def _fake_player(player_id: str, overall: int) -> BalanceablePlayer:
    return BalanceablePlayer(
        id=player_id,
        display_name=f"Jogador {player_id}",
        overall=overall,
    )


def _fake_positioned_player(player_id: str, overall: int, position: str) -> BalanceablePlayer:
    return BalanceablePlayer(
        id=player_id,
        display_name=f"Jogador {player_id}",
        overall=overall,
        preferred_position=position,
    )


class TestGreedyTeamBalancer(unittest.TestCase):
    def setUp(self) -> None:
        self.balancer = GreedyTeamBalancer()

    def test_even_distribution(self) -> None:
        players = [_fake_player(str(i), 90 - i * 5) for i in range(4)]
        request = TeamGenerationRequest(
            players=tuple(players), config=TeamBalanceConfig(team_count=2)
        )
        result = self.balancer.generate(request)
        self.assertEqual(len(result.teams), 2)
        self.assertEqual(sum(len(team.players) for team in result.teams), len(players))
        self.assertLessEqual(result.average_overall_gap, Decimal("15"))

    def test_odd_number_of_players(self) -> None:
        players = [_fake_player(str(i), 95 - i * 7) for i in range(5)]
        request = TeamGenerationRequest(
            players=tuple(players), config=TeamBalanceConfig(team_count=2)
        )
        result = self.balancer.generate(request)
        sizes = [len(team.players) for team in result.teams]
        self.assertEqual(sum(sizes), len(players))
        self.assertLessEqual(abs(sizes[0] - sizes[1]), 1)

    def test_three_teams_case(self) -> None:
        players = [_fake_player(str(i), 80 + i * 2) for i in range(6)]
        request = TeamGenerationRequest(
            players=tuple(players), config=TeamBalanceConfig(team_count=3)
        )
        result = self.balancer.generate(request)
        self.assertEqual(len(result.teams), 3)
        self.assertLessEqual(result.average_overall_gap, Decimal("10"))
        sizes = [len(team.players) for team in result.teams]
        self.assertTrue(all(size == 2 for size in sizes))

    def test_finds_exact_total_balance_when_possible(self) -> None:
        overalls = [100, 95, 90, 85, 80, 75, 70, 65, 60]
        players = [_fake_player(str(index), overall) for index, overall in enumerate(overalls)]
        request = TeamGenerationRequest(
            players=tuple(players), config=TeamBalanceConfig(team_count=3)
        )

        result = self.balancer.generate(request)

        totals = [team.total_overall for team in result.teams]
        self.assertEqual(max(totals) - min(totals), 0)
        self.assertEqual(result.diagnostics["search_mode"], "exact")

    def test_fallback_swap_mode_never_duplicates_players(self) -> None:
        overalls = [99, 97, 96, 94, 92, 91, 89, 87, 85, 83, 81, 79, 78, 76, 74, 73, 71, 69]
        players = [_fake_player(str(index), overall) for index, overall in enumerate(overalls)]
        request = TeamGenerationRequest(
            players=tuple(players), config=TeamBalanceConfig(team_count=3)
        )

        result = self.balancer.generate(request)

        assigned_ids = [player.id for team in result.teams for player in team.players]
        self.assertEqual(len(assigned_ids), len(players))
        self.assertEqual(len(assigned_ids), len(set(assigned_ids)))
        self.assertEqual(result.diagnostics["search_mode"], "greedy_swap")

    def test_balances_defenders_and_goalkeepers_first(self) -> None:
        players = [
            _fake_positioned_player("gk-1", 99, "GOALKEEPER"),
            _fake_positioned_player("gk-2", 98, "GOALKEEPER"),
            _fake_positioned_player("def-1", 97, "DEFENDER"),
            _fake_positioned_player("def-2", 72, "DEFENDER"),
            _fake_positioned_player("mid-1", 95, "MIDFIELDER"),
            _fake_positioned_player("mid-2", 94, "MIDFIELDER"),
            _fake_positioned_player("mid-3", 93, "MIDFIELDER"),
            _fake_positioned_player("mid-4", 92, "MIDFIELDER"),
            _fake_positioned_player("atk-1", 91, "FORWARD"),
        ]
        request = TeamGenerationRequest(
            players=tuple(players), config=TeamBalanceConfig(team_count=3)
        )

        result = self.balancer.generate(request)

        self.assertEqual(result.diagnostics["defensive_gap"], 1)
        self.assertEqual(sorted(result.diagnostics["defensive_counts"]), [1, 1, 2])


if __name__ == "__main__":
    unittest.main()
