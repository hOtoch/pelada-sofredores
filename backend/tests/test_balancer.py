"""Unit tests for the team balancing implementation."""

from decimal import Decimal
import unittest

from apps.teams.balancer import GreedyTeamBalancer
from apps.teams.contracts import BalanceablePlayer, TeamGenerationRequest, TeamBalanceConfig


def _fake_player(player_id: str, overall: int) -> BalanceablePlayer:
    return BalanceablePlayer(
        id=player_id,
        display_name=f"Jogador {player_id}",
        overall=overall,
    )


class TestGreedyTeamBalancer(unittest.TestCase):
    def setUp(self) -> None:
        self.balancer = GreedyTeamBalancer()

    def test_even_distribution(self) -> None:
        players = [_fake_player(str(i), 90 - i * 5) for i in range(4)]
        request = TeamGenerationRequest(players=tuple(players), config=TeamBalanceConfig(team_count=2))
        result = self.balancer.generate(request)
        self.assertEqual(len(result.teams), 2)
        self.assertEqual(sum(len(team.players) for team in result.teams), len(players))
        self.assertLessEqual(result.average_overall_gap, Decimal("15"))

    def test_odd_number_of_players(self) -> None:
        players = [_fake_player(str(i), 95 - i * 7) for i in range(5)]
        request = TeamGenerationRequest(players=tuple(players), config=TeamBalanceConfig(team_count=2))
        result = self.balancer.generate(request)
        sizes = [len(team.players) for team in result.teams]
        self.assertEqual(sum(sizes), len(players))
        self.assertLessEqual(abs(sizes[0] - sizes[1]), 1)

    def test_three_teams_case(self) -> None:
        players = [_fake_player(str(i), 80 + i * 2) for i in range(6)]
        request = TeamGenerationRequest(players=tuple(players), config=TeamBalanceConfig(team_count=3))
        result = self.balancer.generate(request)
        self.assertEqual(len(result.teams), 3)
        self.assertLessEqual(result.average_overall_gap, Decimal("10"))
        sizes = [len(team.players) for team in result.teams]
        self.assertTrue(all(size == 2 for size in sizes))


if __name__ == "__main__":
    unittest.main()
