from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from core.models import Match, MatchAttendance, MatchPlayerRating, Player, Role, Transaction, User


class ApiFlowTests(APITestCase):
    def setUp(self) -> None:
        self.password = "pelada-segura-123"
        self.user = User.objects.create_user(
            username="admin",
            email="admin@pelada.local",
            password=self.password,
            role=Role.ADMIN,
            display_name="Administrador",
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.common_user = User.objects.create_user(
            username="comum",
            email="comum@pelada.local",
            password=self.password,
            role=Role.COMMON,
            display_name="Jogador Comum",
        )
        self.common_token = Token.objects.create(user=self.common_user)

        self.match = Match.objects.create(
            scheduled_at=timezone.now() + timedelta(days=2),
            status=Match.Status.OPEN,
            expected_team_count=2,
            created_by=self.user,
        )

        self.players = [
            Player.objects.create(
                full_name=f"Jogador {index}",
                preferred_position=Player.PreferredPosition.UNIVERSAL,
                overall=80 - index,
            )
            for index in range(4)
        ]

        for player in self.players:
            MatchAttendance.objects.create(
                match=self.match,
                player=player,
                display_name=player.full_name,
                is_guest=False,
                attendance_status=MatchAttendance.AttendanceStatus.CONFIRMED,
                overall=player.overall,
            )

        Transaction.objects.create(
            direction=Transaction.Direction.INFLOW,
            category=Transaction.Category.MONTHLY_FEE,
            status=Transaction.Status.POSTED,
            amount=Decimal("300.00"),
            description="Mensalidade",
            occurred_on=date.today(),
            recorded_by=self.user,
        )
        Transaction.objects.create(
            direction=Transaction.Direction.OUTFLOW,
            category=Transaction.Category.FIELD_RENT,
            status=Transaction.Status.POSTED,
            amount=Decimal("120.00"),
            description="Campo",
            occurred_on=date.today(),
            recorded_by=self.user,
        )
        Transaction.objects.create(
            direction=Transaction.Direction.OUTFLOW,
            category=Transaction.Category.BARBECUE,
            status=Transaction.Status.PENDING,
            amount=Decimal("45.00"),
            description="Churrasco",
            occurred_on=date.today(),
            recorded_by=self.user,
        )

    def test_login_endpoint_returns_token_and_user(self) -> None:
        self.client.credentials()

        response = self.client.post(
            "/api/auth/login/",
            {"identifier": self.user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["username"], self.user.username)

    def test_login_with_phone_number(self) -> None:
        self.client.credentials()
        self.common_user.phone_number = "27999998888"
        self.common_user.save(update_fields=["phone_number"])

        response = self.client.post(
            "/api/auth/login/",
            {"identifier": "(27) 99999-8888", "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["username"], self.common_user.username)

    def test_public_signup_creates_common_user_without_linked_player(self) -> None:
        self.client.credentials()

        response = self.client.post(
            "/api/auth/register/",
            {
                "full_name": "Novo Jogador",
                "phone_number": "(27) 98888-7777",
                "username": "novo_jogador",
                "password": "SenhaNova123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn("token", response.data)
        created_user = User.objects.get(username="novo_jogador")
        self.assertEqual(created_user.role, Role.COMMON)
        self.assertEqual(created_user.phone_number, "27988887777")
        self.assertIsNone(created_user.linked_player)
        self.assertFalse(Player.objects.filter(full_name="Novo Jogador").exists())

    def test_public_signup_allows_phone_from_existing_player(self) -> None:
        self.client.credentials()
        self.players[0].phone_number = "27988887777"
        self.players[0].save(update_fields=["phone_number"])

        response = self.client.post(
            "/api/auth/register/",
            {
                "full_name": "Conta do Jogador",
                "phone_number": "(27) 98888-7777",
                "username": "conta_jogador",
                "password": "SenhaNova123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created_user = User.objects.get(username="conta_jogador")
        self.assertIsNone(created_user.linked_player)
        self.assertEqual(Player.objects.filter(phone_number="27988887777").count(), 1)

    def test_financial_summary_endpoint(self) -> None:
        response = self.client.get("/api/dashboard/financial-summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data["inflow_total"]), Decimal("300.00"))
        self.assertEqual(Decimal(response.data["outflow_total"]), Decimal("120.00"))
        self.assertEqual(Decimal(response.data["pending_total"]), Decimal("45.00"))
        self.assertEqual(Decimal(response.data["current_balance"]), Decimal("180.00"))

    def test_generate_teams_action_assigns_attendance(self) -> None:
        response = self.client.post(
            f"/api/matches/{self.match.id}/generate-teams/",
            {"team_count": 2},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["teams"]), 2)
        self.match.refresh_from_db()
        self.assertIsNotNone(self.match.teams_generated_at)
        self.assertTrue(
            MatchAttendance.objects.filter(match=self.match, assigned_team_number__isnull=False).exists()
        )

    def test_admin_can_create_match_via_api(self) -> None:
        response = self.client.post(
            "/api/matches/",
            {
                "scheduled_at": (timezone.now() + timedelta(days=9)).isoformat(),
                "location": "Arena Roxa",
                "status": Match.Status.DRAFT,
                "expected_team_count": 3,
                "notes": "Rodada extra do feriado",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created_match = Match.objects.get(location="Arena Roxa")
        self.assertFalse(MatchAttendance.objects.filter(match=created_match).exists())

    def test_admin_can_patch_match_status(self) -> None:
        response = self.client.patch(
            f"/api/matches/{self.match.id}/",
            {"status": Match.Status.CLOSED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.CLOSED)
        self.assertIsNotNone(self.match.attendance_locked_at)

    def test_admin_can_record_match_result(self) -> None:
        response = self.client.patch(
            f"/api/matches/{self.match.id}/",
            {"result_summary": "Time Roxo 7 x 5 Time Cinza"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.match.refresh_from_db()
        self.assertEqual(self.match.result_summary, "Time Roxo 7 x 5 Time Cinza")
        self.assertIsNotNone(self.match.result_recorded_at)

    def test_admin_can_link_user_to_player(self) -> None:
        response = self.client.patch(
            f"/api/users/{self.common_user.id}/",
            {"linked_player": str(self.players[0].id)},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.common_user.refresh_from_db()
        self.assertEqual(self.common_user.linked_player_id, self.players[0].id)

    def test_admin_can_list_users(self) -> None:
        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data), 2)

    def test_admin_can_create_user_without_password(self) -> None:
        response = self.client.post(
            "/api/users/",
            {
                "username": "novo-comum",
                "email": "novo@pelada.local",
                "display_name": "Novo Comum",
                "role": Role.COMMON,
                "linked_player": str(self.players[1].id),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created_user = User.objects.get(username="novo-comum")
        self.assertFalse(created_user.has_usable_password())
        self.assertTrue(created_user.must_change_password)
        self.assertEqual(created_user.linked_player_id, self.players[1].id)

    def test_admin_can_reset_user_password(self) -> None:
        self.common_user.must_change_password = False
        self.common_user.save(update_fields=["must_change_password"])

        response = self.client.post(
            f"/api/users/{self.common_user.id}/reset-password/",
            {"new_password": "NovaSenhaSegura@123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.common_user.refresh_from_db()
        self.assertTrue(self.common_user.check_password("NovaSenhaSegura@123"))
        self.assertTrue(self.common_user.must_change_password)

    def test_common_user_can_change_own_password(self) -> None:
        self.common_user.must_change_password = True
        self.common_user.set_password("SenhaTemporaria@123")
        self.common_user.save(update_fields=["must_change_password", "password"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        response = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": "SenhaTemporaria@123",
                "new_password": "SenhaDefinitiva@123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)
        self.common_user.refresh_from_db()
        self.assertTrue(self.common_user.check_password("SenhaDefinitiva@123"))
        self.assertFalse(self.common_user.must_change_password)

    def test_change_password_rejects_invalid_current_password(self) -> None:
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        response = self.client.post(
            "/api/auth/change-password/",
            {
                "current_password": "senha-incorreta",
                "new_password": "SenhaNova@999",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("current_password", response.data)

    def test_common_user_cannot_access_user_management(self) -> None:
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, 403)

    def test_common_user_portal_overview(self) -> None:
        self.common_user.linked_player = self.players[0]
        self.common_user.save(update_fields=["linked_player"])
        Transaction.objects.create(
            direction=Transaction.Direction.INFLOW,
            category=Transaction.Category.MONTHLY_FEE,
            status=Transaction.Status.POSTED,
            amount=Decimal("70.00"),
            description="Mensalidade jogador comum",
            occurred_on=date.today(),
            related_player=self.players[0],
            recorded_by=self.user,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        response = self.client.get("/api/portal/me/overview/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["id"], str(self.common_user.id))
        self.assertEqual(response.data["linked_player"]["id"], str(self.players[0].id))
        self.assertEqual(Decimal(response.data["financial_status"]["paid_amount"]), Decimal("70.00"))
        self.assertGreaterEqual(response.data["attendance_status"]["confirmed_count"], 1)

    def test_admin_can_access_analytics_endpoints(self) -> None:
        season_response = self.client.get("/api/analytics/season-overview/")
        presence_response = self.client.get("/api/analytics/presence-ranking/?limit=3")
        payment_response = self.client.get("/api/analytics/payment-ranking/?limit=3")

        self.assertEqual(season_response.status_code, 200)
        self.assertEqual(presence_response.status_code, 200)
        self.assertEqual(payment_response.status_code, 200)
        self.assertEqual(season_response.data["active_members"], 4)
        self.assertGreaterEqual(len(presence_response.data["ranking"]), 1)
        self.assertGreaterEqual(len(payment_response.data["ranking"]), 1)

    def test_common_user_cannot_access_admin_analytics(self) -> None:
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        response = self.client.get("/api/analytics/season-overview/")

        self.assertEqual(response.status_code, 403)

    def test_common_user_reads_only_own_extract(self) -> None:
        self.common_user.linked_player = self.players[0]
        self.common_user.save(update_fields=["linked_player"])
        own_transaction = Transaction.objects.create(
            direction=Transaction.Direction.INFLOW,
            category=Transaction.Category.MONTHLY_FEE,
            status=Transaction.Status.POSTED,
            amount=Decimal("120.00"),
            description="Mensalidade propria",
            occurred_on=date.today(),
            related_player=self.players[0],
            recorded_by=self.user,
        )
        Transaction.objects.create(
            direction=Transaction.Direction.INFLOW,
            category=Transaction.Category.MONTHLY_FEE,
            status=Transaction.Status.POSTED,
            amount=Decimal("120.00"),
            description="Mensalidade outro jogador",
            occurred_on=date.today(),
            related_player=self.players[1],
            recorded_by=self.user,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        response = self.client.get("/api/transactions/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [str(own_transaction.id)])

    def test_common_user_reads_active_roster_and_non_draft_matches(self) -> None:
        self.players[1].is_active = False
        self.players[1].save(update_fields=["is_active"])
        closed_match = Match.objects.create(
            scheduled_at=timezone.now() + timedelta(days=4),
            status=Match.Status.CLOSED,
            expected_team_count=2,
            created_by=self.user,
        )
        Match.objects.create(
            scheduled_at=timezone.now() + timedelta(days=6),
            status=Match.Status.DRAFT,
            expected_team_count=2,
            created_by=self.user,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        players_response = self.client.get("/api/players/")
        matches_response = self.client.get("/api/matches/")
        summary_response = self.client.get("/api/dashboard/financial-summary/")

        self.assertEqual(players_response.status_code, 200)
        self.assertEqual(matches_response.status_code, 200)
        self.assertEqual(summary_response.status_code, 403)
        self.assertNotIn(str(self.players[1].id), [item["id"] for item in players_response.data])
        self.assertIn(str(closed_match.id), [item["id"] for item in matches_response.data])
        self.assertTrue(all(item["status"] != Match.Status.DRAFT for item in matches_response.data))

    def test_common_user_can_rate_archived_match_without_linked_player_and_keep_overall_pending(self) -> None:
        self.match.status = Match.Status.ARCHIVED
        self.match.archived_at = timezone.now()
        self.match.save(update_fields=["status", "archived_at"])
        target_attendance = MatchAttendance.objects.get(match=self.match, player=self.players[1])
        original_overall = self.players[1].overall
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        state_response = self.client.get(f"/api/matches/{self.match.id}/player-ratings/")
        submit_response = self.client.post(
            f"/api/matches/{self.match.id}/player-ratings/",
            {"ratings": [{"attendance_id": str(target_attendance.id), "score": 10}]},
            format="json",
        )

        self.assertEqual(state_response.status_code, 200)
        self.assertTrue(state_response.data["can_rate"])
        self.assertIn(str(self.players[0].id), [item["player_id"] for item in state_response.data["items"]])
        self.assertEqual(submit_response.status_code, 200)
        self.assertTrue(submit_response.data["has_submitted"])
        self.assertEqual(submit_response.data["log"][0]["rater_user_id"], str(self.common_user.id))
        self.assertEqual(submit_response.data["log"][0]["rater_display_name"], self.common_user.display_name)
        self.assertEqual(submit_response.data["log"][0]["rated_display_name"], target_attendance.display_name)
        self.assertEqual(submit_response.data["log"][0]["score"], 10)
        self.assertEqual(MatchPlayerRating.objects.filter(match=self.match, rater_user=self.common_user).count(), 1)
        self.players[1].refresh_from_db()
        self.assertEqual(self.players[1].overall, original_overall)

    def test_common_user_can_rate_finished_match_without_participation(self) -> None:
        other_match = Match.objects.create(
            scheduled_at=timezone.now() - timedelta(days=1),
            status=Match.Status.ARCHIVED,
            archived_at=timezone.now(),
            expected_team_count=2,
            created_by=self.user,
        )
        other_attendance = MatchAttendance.objects.create(
            match=other_match,
            player=self.players[1],
            display_name=self.players[1].full_name,
            is_guest=False,
            attendance_status=MatchAttendance.AttendanceStatus.CONFIRMED,
            overall=self.players[1].overall,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        response = self.client.post(
            f"/api/matches/{other_match.id}/player-ratings/",
            {"ratings": [{"attendance_id": str(other_attendance.id), "score": 10}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(MatchPlayerRating.objects.filter(match=other_match, rater_user=self.common_user).count(), 1)

    def test_rating_window_finalizes_overall_and_returns_empty_state_after_24_hours(self) -> None:
        self.match.status = Match.Status.ARCHIVED
        self.match.archived_at = timezone.now() - timedelta(hours=25)
        self.match.save(update_fields=["status", "archived_at"])
        target_attendance = MatchAttendance.objects.get(match=self.match, player=self.players[1])
        original_overall = self.players[1].overall
        MatchPlayerRating.objects.create(
            match=self.match,
            rater_user=self.common_user,
            rated_attendance=target_attendance,
            rated_player=self.players[1],
            score=10,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.common_token.key}")

        response = self.client.get(f"/api/matches/{self.match.id}/player-ratings/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["can_rate"])
        self.assertEqual(response.data["items"], [])
        self.assertEqual(response.data["log"], [])
        self.assertIsNotNone(response.data["ratings_finalized_at"])
        self.players[1].refresh_from_db()
        self.assertGreater(self.players[1].overall, original_overall)

    def test_admin_can_create_transaction_via_api(self) -> None:
        response = self.client.post(
            "/api/transactions/",
            {
                "direction": Transaction.Direction.INFLOW,
                "category": Transaction.Category.EXTRA_FEE,
                "status": Transaction.Status.POSTED,
                "amount": "99.90",
                "description": "Taxa extra dos coletes",
                "occurred_on": date.today().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Transaction.objects.filter(description="Taxa extra dos coletes").count(), 1)

    def test_admin_can_create_player_with_manual_overall(self) -> None:
        response = self.client.post(
            "/api/players/",
            {
                "full_name": "Novo Linha",
                "preferred_position": Player.PreferredPosition.FORWARD,
                "monthly_fee_amount": "120.00",
                "overall": 82,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created_player = Player.objects.get(full_name="Novo Linha")
        self.assertEqual(created_player.overall, 82)

    def test_admin_can_update_position_and_overall(self) -> None:
        player = self.players[0]

        response = self.client.put(
            f"/api/players/{player.id}/",
            {
                "full_name": player.full_name,
                "nickname": player.nickname,
                "player_type": player.player_type,
                "preferred_position": Player.PreferredPosition.GOALKEEPER,
                "email": player.email,
                "phone_number": player.phone_number,
                "shirt_number": player.shirt_number,
                "monthly_fee_amount": str(player.monthly_fee_amount),
                "joined_on": player.joined_on,
                "is_active": player.is_active,
                "notes": player.notes,
                "overall": 87,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        player.refresh_from_db()
        self.assertEqual(player.preferred_position, Player.PreferredPosition.GOALKEEPER)
        self.assertEqual(player.overall, 87)

    def test_admin_can_update_transaction_and_link_player(self) -> None:
        transaction = Transaction.objects.filter(category=Transaction.Category.MONTHLY_FEE).first()
        assert transaction is not None

        response = self.client.put(
            f"/api/transactions/{transaction.id}/",
            {
                "direction": Transaction.Direction.INFLOW,
                "category": Transaction.Category.MONTHLY_FEE,
                "status": Transaction.Status.POSTED,
                "amount": "70.00",
                "description": "Mensalidade do Jogador 0",
                "occurred_on": date.today().isoformat(),
                "reference_month": date.today().replace(day=1).isoformat(),
                "related_player": str(self.players[0].id),
                "notes": "Pagamento confirmado no pix",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        transaction.refresh_from_db()
        self.assertEqual(transaction.related_player_id, self.players[0].id)
        self.assertEqual(transaction.amount, Decimal("70.00"))

    def test_admin_can_void_transaction_via_api(self) -> None:
        transaction = Transaction.objects.filter(category=Transaction.Category.FIELD_RENT).first()
        assert transaction is not None

        response = self.client.patch(
            f"/api/transactions/{transaction.id}/",
            {"status": Transaction.Status.VOIDED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        transaction.refresh_from_db()
        self.assertEqual(transaction.status, Transaction.Status.VOIDED)
