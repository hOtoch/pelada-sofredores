from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Match, MatchAttendance, Player, Role, Transaction, User


class Command(BaseCommand):
    help = "Cria massa de dados deterministica para testes E2E locais."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Limpa a massa E2E anterior antes de recriar os dados.",
        )

    def handle(self, *args, **options):
        reset = options.get("reset", False)

        if reset:
            self._reset_dataset()

        now = timezone.now()
        month_start = now.date().replace(day=1)

        admin_user, _ = User.objects.update_or_create(
            username="admin",
            defaults={
                "email": "admin@pelada.local",
                "display_name": "Administrador Pelada",
                "role": Role.ADMIN,
                "is_active": True,
                "is_staff": True,
                "is_superuser": True,
                "must_change_password": False,
            },
        )
        admin_user.set_password("admin123")
        admin_user.save(update_fields=["password"])

        member_player, _ = Player.objects.update_or_create(
            email="jogador@pelada.local",
            defaults={
                "full_name": "Joao Silva",
                "nickname": "Jota",
                "player_type": Player.PlayerType.MEMBER,
                "preferred_position": Player.PreferredPosition.MIDFIELDER,
                "monthly_fee_amount": Decimal("120.00"),
                "is_active": True,
                "overall": 74,
            },
        )

        common_user, _ = User.objects.update_or_create(
            username="jogador",
            defaults={
                "email": "jogador@pelada.local",
                "display_name": "Jogador Demo",
                "role": Role.COMMON,
                "is_active": True,
                "is_staff": False,
                "is_superuser": False,
                "linked_player": member_player,
                "must_change_password": False,
            },
        )
        common_user.set_password("jogador123")
        common_user.save(update_fields=["password"])

        teammate, _ = Player.objects.update_or_create(
            email="companheiro@pelada.local",
            defaults={
                "full_name": "Carlos Lima",
                "nickname": "Cacau",
                "player_type": Player.PlayerType.MEMBER,
                "preferred_position": Player.PreferredPosition.DEFENDER,
                "monthly_fee_amount": Decimal("120.00"),
                "is_active": True,
                "overall": 72,
            },
        )

        open_match, _ = Match.objects.update_or_create(
            location="Arena Sofredores",
            scheduled_at=(now + timedelta(days=2)).replace(minute=0, second=0, microsecond=0),
            defaults={
                "status": Match.Status.OPEN,
                "expected_team_count": 2,
                "created_by": admin_user,
                "notes": "Partida seed para E2E",
            },
        )

        MatchAttendance.objects.update_or_create(
            match=open_match,
            player=member_player,
            defaults={
                "display_name": member_player.nickname or member_player.full_name,
                "is_guest": False,
                "attendance_status": MatchAttendance.AttendanceStatus.CONFIRMED,
                "assigned_team_number": 1,
                "assigned_team_name": "Time Roxo",
                "confirmed_at": now,
                "overall": member_player.overall,
            },
        )

        MatchAttendance.objects.update_or_create(
            match=open_match,
            player=teammate,
            defaults={
                "display_name": teammate.nickname or teammate.full_name,
                "is_guest": False,
                "attendance_status": MatchAttendance.AttendanceStatus.CONFIRMED,
                "assigned_team_number": 2,
                "assigned_team_name": "Time Cinza",
                "confirmed_at": now,
                "overall": teammate.overall,
            },
        )

        Transaction.objects.update_or_create(
            description="Mensalidade Joao Silva",
            occurred_on=month_start,
            defaults={
                "direction": Transaction.Direction.INFLOW,
                "category": Transaction.Category.MONTHLY_FEE,
                "status": Transaction.Status.POSTED,
                "amount": Decimal("120.00"),
                "reference_month": month_start,
                "related_player": member_player,
                "recorded_by": admin_user,
            },
        )

        Transaction.objects.update_or_create(
            description="Aluguel da quadra",
            occurred_on=month_start + timedelta(days=1),
            defaults={
                "direction": Transaction.Direction.OUTFLOW,
                "category": Transaction.Category.FIELD_RENT,
                "status": Transaction.Status.POSTED,
                "amount": Decimal("90.00"),
                "reference_month": month_start,
                "recorded_by": admin_user,
            },
        )

        self.stdout.write(self.style.SUCCESS("Massa E2E pronta."))
        self.stdout.write("Admin: admin / admin123")
        self.stdout.write("Comum: jogador / jogador123")

    def _reset_dataset(self):
        usernames = {"admin", "jogador"}
        emails = {"jogador@pelada.local", "companheiro@pelada.local"}

        MatchAttendance.objects.all().delete()
        Transaction.objects.all().delete()
        Match.objects.all().delete()
        User.objects.filter(username__in=usernames).delete()
        Player.objects.filter(email__in=emails).delete()
