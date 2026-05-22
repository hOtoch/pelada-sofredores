from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Avg, Case, Count, DecimalField, F, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.teams import BalanceablePlayer, GreedyTeamBalancer, TeamBalanceConfig, TeamGenerationRequest

from .models import Match, MatchAttendance, MatchPlayerRating, Player, Role, Transaction, User
from .permissions import IsAdminOrReadOnly
from .serializers import (
    AdminResetPasswordSerializer,
    ChangePasswordSerializer,
    FinancialSummarySerializer,
    LoginSerializer,
    MatchAttendanceSerializer,
    MatchPlayerRatingStateSerializer,
    MatchPlayerRatingSubmitSerializer,
    MatchSerializer,
    PaymentRankingSerializer,
    PlayerSerializer,
    PortalOverviewSerializer,
    PresenceRankingSerializer,
    PublicSignupSerializer,
    SeasonOverviewSerializer,
    TeamGenerationInputSerializer,
    TeamGenerationResponseSerializer,
    TransactionSerializer,
    UserAccountSerializer,
    UserSerializer,
)


def month_bounds(reference_date: date) -> tuple[date, date]:
    month_start = reference_date.replace(day=1)
    if month_start.month == 12:
        month_end = date(month_start.year + 1, 1, 1)
    else:
        month_end = date(month_start.year, month_start.month + 1, 1)
    return month_start, month_end


def monthly_reference_filter(month_start: date, month_end: date) -> Q:
    return Q(reference_month__gte=month_start, reference_month__lt=month_end) | (
        Q(reference_month__isnull=True)
        & Q(occurred_on__gte=month_start)
        & Q(occurred_on__lt=month_end)
    )


def parse_reference_month(raw_reference_month: str | None) -> tuple[date, str]:
    if not raw_reference_month:
        today = timezone.localdate()
        return today.replace(day=1), today.strftime("%Y-%m")

    try:
        parsed = datetime.strptime(raw_reference_month, "%Y-%m").date().replace(day=1)
    except ValueError as exc:
        raise ValidationError({"reference_month": "Use o formato YYYY-MM."}) from exc
    return parsed, parsed.strftime("%Y-%m")


def build_player_payment_map(player_ids: list, month_start: date, month_end: date) -> dict:
    month_transactions = (
        Transaction.objects.filter(
            related_player_id__in=player_ids,
            category=Transaction.Category.MONTHLY_FEE,
            direction=Transaction.Direction.INFLOW,
        )
        .filter(monthly_reference_filter(month_start, month_end))
        .values("related_player_id")
        .annotate(
            paid_amount=Coalesce(
                Sum(
                    Case(
                        When(status=Transaction.Status.POSTED, then=F("amount")),
                        default=Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    )
                ),
                Decimal("0.00"),
            ),
            pending_amount=Coalesce(
                Sum(
                    Case(
                        When(status=Transaction.Status.PENDING, then=F("amount")),
                        default=Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    )
                ),
                Decimal("0.00"),
            ),
        )
    )
    return {
        row["related_player_id"]: {
            "paid_amount": row["paid_amount"],
            "pending_amount": row["pending_amount"],
        }
        for row in month_transactions
    }


def clamp_overall(value: int) -> int:
    return max(0, min(99, value))


def recalculate_player_overall_from_match_ratings(player: Player) -> None:
    rating_average = MatchPlayerRating.objects.filter(rated_player=player).aggregate(avg_score=Avg("score"))[
        "avg_score"
    ]
    if rating_average is None:
        return

    community_overall = Decimal(str(rating_average)) * Decimal("10")
    next_overall = (
        Decimal(player.overall) * Decimal("0.85") + community_overall * Decimal("0.15")
    ).quantize(Decimal("1"))
    player.overall = clamp_overall(int(next_overall))
    player.save(update_fields=["overall", "updated_at"])


class IsRoleAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Role.ADMIN
        )


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("linked_player").all().order_by("username")
    serializer_class = UserAccountSerializer
    permission_classes = [IsRoleAdmin]

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = AdminResetPasswordSerializer(
            data=request.data,
            context={"request": request, "target_user": user},
        )
        serializer.is_valid(raise_exception=True)

        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = True
        user.save()
        Token.objects.filter(user=user).delete()
        return Response(self.get_serializer(user).data)


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self.request.user, "role", None) == Role.ADMIN:
            return queryset
        return queryset.filter(player_type=Player.PlayerType.MEMBER, is_active=True)


class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.select_related("created_by").all()
    serializer_class = MatchSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_permissions(self):
        if self.action == "player_ratings":
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self.request.user, "role", None) == Role.ADMIN:
            return queryset
        return queryset.filter(
            status__in=[Match.Status.OPEN, Match.Status.CLOSED, Match.Status.ARCHIVED]
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        validated_data = serializer.validated_data
        status_value = validated_data.get("status", serializer.instance.status)
        result_summary = validated_data.get("result_summary", serializer.instance.result_summary)

        extra_fields = {}
        if "status" in validated_data:
            extra_fields["attendance_locked_at"] = (
                timezone.now()
                if status_value in [Match.Status.CLOSED, Match.Status.ARCHIVED]
                else None
            )

        if "result_summary" in validated_data:
            extra_fields["result_recorded_at"] = timezone.now() if result_summary else None

        serializer.save(**extra_fields)

    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request):
        match = (
            self.get_queryset()
            .filter(status__in=[Match.Status.OPEN, Match.Status.DRAFT])
            .order_by("scheduled_at")
            .first()
        )
        if match is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(self.get_serializer(match).data)

    @action(detail=True, methods=["post"], url_path="generate-teams")
    def generate_teams(self, request, pk=None):
        input_serializer = TeamGenerationInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        match = self.get_object()
        team_count = input_serializer.validated_data.get("team_count", match.expected_team_count)
        attendance_entries = list(
            match.attendance_entries.filter(attendance_status=MatchAttendance.AttendanceStatus.CONFIRMED)
        )
        balancer = GreedyTeamBalancer()
        players = tuple(
            BalanceablePlayer(
                id=str(entry.id),
                display_name=entry.display_name,
                overall=entry.overall,
                preferred_position=(
                    entry.player.preferred_position if entry.player_id else "UNIVERSAL"
                ),
                is_guest=entry.is_guest,
            )
            for entry in attendance_entries
        )
        result = balancer.generate(
            TeamGenerationRequest(
                players=players,
                config=TeamBalanceConfig(team_count=team_count),
                match_id=match.id,
            )
        )

        team_payload = []
        with transaction.atomic():
            for team_index, team in enumerate(result.teams, start=1):
                for player in team.players:
                    MatchAttendance.objects.filter(id=player.id).update(
                        assigned_team_number=team_index,
                        assigned_team_name=team.name,
                    )
                team_payload.append(
                    {
                        "name": team.name,
                        "total_overall": team.total_overall,
                        "average_overall": team.average_overall.quantize(Decimal("0.01")),
                        "players": [
                            {
                                "id": str(player.id),
                                "display_name": player.display_name,
                                "is_guest": player.is_guest,
                                "overall": player.overall,
                            }
                            for player in team.players
                        ],
                    }
                )

            match.teams_generated_at = timezone.now()
            match.expected_team_count = team_count
            match.save(update_fields=["teams_generated_at", "expected_team_count", "updated_at"])

        payload = {
            "match_id": match.id,
            "average_overall_gap": result.average_overall_gap.quantize(Decimal("0.01")),
            "diagnostics": result.diagnostics,
            "teams": team_payload,
        }
        response_serializer = TeamGenerationResponseSerializer(payload)
        return Response(response_serializer.data)

    def _get_rating_lock_reason(self, match):
        if match.status not in [Match.Status.CLOSED, Match.Status.ARCHIVED]:
            return "Avaliações liberadas após o encerramento da pelada."

        return ""

    def _build_rating_state(self, match):
        locked_reason = self._get_rating_lock_reason(match)
        can_rate = bool(getattr(self.request.user, "role", None) != Role.ADMIN and not locked_reason)

        participants_queryset = match.attendance_entries.select_related("player").filter(
            attendance_status=MatchAttendance.AttendanceStatus.CONFIRMED,
            player__isnull=False,
        )
        linked_player = getattr(self.request.user, "linked_player", None)
        if linked_player:
            participants_queryset = participants_queryset.exclude(player=linked_player)

        participants = list(participants_queryset.order_by("display_name"))
        rating_by_attendance = {
            rating.rated_attendance_id: rating
            for rating in MatchPlayerRating.objects.filter(match=match, rater_user=self.request.user)
        }

        rating_stats = {
            row["rated_attendance_id"]: row
            for row in MatchPlayerRating.objects.filter(match=match)
            .values("rated_attendance_id")
            .annotate(average_score=Avg("score"), rating_count=Count("id"))
        }

        items = []
        for entry in participants:
            existing_rating = rating_by_attendance.get(entry.id)
            stats = rating_stats.get(entry.id, {})
            items.append(
                {
                    "attendance_id": entry.id,
                    "player_id": entry.player_id,
                    "display_name": entry.display_name,
                    "current_overall": entry.player.overall,
                    "score": existing_rating.score if existing_rating else None,
                    "average_score": stats.get("average_score"),
                    "rating_count": stats.get("rating_count", 0),
                }
            )

        if can_rate and not items:
            locked_reason = "Nao ha outros mensalistas confirmados para avaliar."
            can_rate = False

        payload = {
            "match_id": match.id,
            "can_rate": can_rate,
            "has_submitted": bool(rating_by_attendance),
            "locked_reason": locked_reason,
            "items": items,
        }
        return MatchPlayerRatingStateSerializer(payload).data

    @action(detail=True, methods=["get", "post"], url_path="player-ratings")
    def player_ratings(self, request, pk=None):
        match = self.get_object()
        if getattr(request.user, "role", None) == Role.ADMIN:
            return Response(self._build_rating_state(match))

        locked_reason = self._get_rating_lock_reason(match)
        if request.method == "GET":
            return Response(self._build_rating_state(match))

        if locked_reason:
            raise ValidationError({"detail": locked_reason or "Avaliação indisponível."})

        serializer = MatchPlayerRatingSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        allowed_entries_queryset = match.attendance_entries.select_related("player").filter(
            attendance_status=MatchAttendance.AttendanceStatus.CONFIRMED,
            player__isnull=False,
        )
        linked_player = getattr(request.user, "linked_player", None)
        if linked_player:
            allowed_entries_queryset = allowed_entries_queryset.exclude(player=linked_player)

        allowed_entries = {entry.id: entry for entry in allowed_entries_queryset}
        changed_players = {}
        with transaction.atomic():
            for item in serializer.validated_data["ratings"]:
                attendance_id = item["attendance_id"]
                attendance_entry = allowed_entries.get(attendance_id)
                if not attendance_entry:
                    raise ValidationError(
                        {"ratings": "Avalie apenas mensalistas confirmados desta pelada."}
                    )
                MatchPlayerRating.objects.update_or_create(
                    match=match,
                    rater_user=request.user,
                    rated_attendance=attendance_entry,
                    defaults={
                        "rater": linked_player,
                        "rated_player": attendance_entry.player,
                        "score": item["score"],
                    },
                )
                changed_players[attendance_entry.player_id] = attendance_entry.player

            for player in changed_players.values():
                recalculate_player_overall_from_match_ratings(player)

        return Response(self._build_rating_state(match))


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.select_related(
        "related_player",
        "match",
        "recorded_by",
    ).all()
    serializer_class = TransactionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self.request.user, "role", None) == Role.ADMIN:
            return queryset

        linked_player = getattr(self.request.user, "linked_player", None)
        if not linked_player:
            return queryset.none()
        return queryset.filter(related_player=linked_player)

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class MatchAttendanceViewSet(viewsets.ModelViewSet):
    queryset = MatchAttendance.objects.select_related(
        "match",
        "player",
        "invited_by",
    ).all()
    serializer_class = MatchAttendanceSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self.request.user, "role", None) != Role.ADMIN:
            queryset = queryset.filter(
                match__status__in=[Match.Status.OPEN, Match.Status.CLOSED, Match.Status.ARCHIVED]
            ).distinct()
        match_id = self.request.query_params.get("match")
        if match_id:
            queryset = queryset.filter(match_id=match_id)
        return queryset.order_by("display_name")

    def _build_attendance_payload(self, validated_data, instance=None):
        player = validated_data.get("player")
        attendance_status = validated_data.get(
            "attendance_status",
            instance.attendance_status if instance else MatchAttendance.AttendanceStatus.CONFIRMED,
        )

        if player and not validated_data.get("display_name"):
            validated_data["display_name"] = player.full_name

        if player:
            validated_data.setdefault("overall", player.overall)

        if "attendance_status" in validated_data or instance is None:
            validated_data["confirmed_at"] = (
                timezone.now()
                if attendance_status == MatchAttendance.AttendanceStatus.CONFIRMED
                else None
            )
        return validated_data

    def perform_create(self, serializer):
        serializer.save(**self._build_attendance_payload(dict(serializer.validated_data)))

    def perform_update(self, serializer):
        serializer.save(
            **self._build_attendance_payload(
                dict(serializer.validated_data),
                instance=serializer.instance,
            )
        )


class AuthLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})


class AuthSignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = Token.objects.create(user=user)
        return Response(
            {"token": token.key, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class AuthMeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class AuthLogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AuthChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.save()

        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})


class FinancialSummaryView(APIView):
    permission_classes = [IsRoleAdmin]

    def get(self, request):
        totals = Transaction.objects.aggregate(
            inflow_total=Coalesce(
                Sum(
                    Case(
                        When(
                            direction=Transaction.Direction.INFLOW,
                            status=Transaction.Status.POSTED,
                            then=F("amount"),
                        ),
                        default=Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    )
                ),
                Decimal("0.00"),
            ),
            outflow_total=Coalesce(
                Sum(
                    Case(
                        When(
                            direction=Transaction.Direction.OUTFLOW,
                            status=Transaction.Status.POSTED,
                            then=F("amount"),
                        ),
                        default=Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    )
                ),
                Decimal("0.00"),
            ),
            pending_total=Coalesce(
                Sum(
                    Case(
                        When(status=Transaction.Status.PENDING, then=F("amount")),
                        default=Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    )
                ),
                Decimal("0.00"),
            ),
        )
        payload = {
            "current_balance": totals["inflow_total"] - totals["outflow_total"],
            **totals,
        }
        serializer = FinancialSummarySerializer(payload)
        return Response(serializer.data)


class PortalOverviewView(APIView):
    def get(self, request):
        user = request.user
        linked_player = user.linked_player
        month_start, month_end = month_bounds(timezone.localdate())
        reference_month = month_start.strftime("%Y-%m")

        financial_status = {
            "reference_month": reference_month,
            "expected_monthly_fee": Decimal("0.00"),
            "paid_amount": Decimal("0.00"),
            "pending_amount": Decimal("0.00"),
            "outstanding_amount": Decimal("0.00"),
            "is_adimplente": False,
        }
        attendance_status = {
            "confirmed_count": 0,
            "pending_count": 0,
            "declined_count": 0,
            "total_count": 0,
        }
        recent_attendance = []

        if linked_player:
            monthly_map = build_player_payment_map([linked_player.id], month_start, month_end)
            paid_amount = monthly_map.get(linked_player.id, {}).get("paid_amount", Decimal("0.00"))
            pending_amount = monthly_map.get(linked_player.id, {}).get("pending_amount", Decimal("0.00"))
            expected_monthly_fee = linked_player.monthly_fee_amount
            outstanding_amount = expected_monthly_fee - paid_amount
            if outstanding_amount < Decimal("0.00"):
                outstanding_amount = Decimal("0.00")

            financial_status = {
                "reference_month": reference_month,
                "expected_monthly_fee": expected_monthly_fee,
                "paid_amount": paid_amount,
                "pending_amount": pending_amount,
                "outstanding_amount": outstanding_amount,
                "is_adimplente": outstanding_amount == Decimal("0.00"),
            }

            attendance_counts = MatchAttendance.objects.filter(player=linked_player).aggregate(
                confirmed_count=Count(
                    "id",
                    filter=Q(attendance_status=MatchAttendance.AttendanceStatus.CONFIRMED),
                ),
                pending_count=Count(
                    "id",
                    filter=Q(attendance_status=MatchAttendance.AttendanceStatus.PENDING),
                ),
                declined_count=Count(
                    "id",
                    filter=Q(attendance_status=MatchAttendance.AttendanceStatus.DECLINED),
                ),
                total_count=Count("id"),
            )
            attendance_status = {
                "confirmed_count": attendance_counts["confirmed_count"],
                "pending_count": attendance_counts["pending_count"],
                "declined_count": attendance_counts["declined_count"],
                "total_count": attendance_counts["total_count"],
            }

            attendance_entries = (
                MatchAttendance.objects.select_related("match")
                .filter(player=linked_player)
                .order_by("-match__scheduled_at")[:5]
            )
            recent_attendance = [
                {
                    "match_id": entry.match_id,
                    "scheduled_at": entry.match.scheduled_at,
                    "match_status": entry.match.status,
                    "attendance_status": entry.attendance_status,
                    "assigned_team_name": entry.assigned_team_name,
                }
                for entry in attendance_entries
            ]

        upcoming_matches_qs = (
            Match.objects.filter(status__in=[Match.Status.OPEN, Match.Status.DRAFT], scheduled_at__gte=timezone.now())
            .order_by("scheduled_at")[:5]
        )
        upcoming_matches = list(upcoming_matches_qs)
        attendance_by_match = {}
        if linked_player and upcoming_matches:
            attendance_by_match = {
                row["match_id"]: row["attendance_status"]
                for row in MatchAttendance.objects.filter(
                    player=linked_player,
                    match_id__in=[match.id for match in upcoming_matches],
                ).values("match_id", "attendance_status")
            }

        upcoming_payload = [
            {
                "match_id": match.id,
                "scheduled_at": match.scheduled_at,
                "location": match.location,
                "status": match.status,
                "expected_team_count": match.expected_team_count,
                "attendance_status": attendance_by_match.get(match.id),
            }
            for match in upcoming_matches
        ]

        payload = {
            "user": user,
            "linked_player": linked_player,
            "financial_status": financial_status,
            "attendance_status": attendance_status,
            "recent_attendance": recent_attendance,
            "upcoming_matches": upcoming_payload,
        }
        serializer = PortalOverviewSerializer(payload)
        return Response(serializer.data)


class SeasonOverviewView(APIView):
    permission_classes = [IsRoleAdmin]

    def get(self, request):
        month_start, month_end = month_bounds(timezone.localdate())
        reference_month = month_start.strftime("%Y-%m")

        match_counts = Match.objects.aggregate(
            total_matches=Count("id"),
            matches_open=Count("id", filter=Q(status=Match.Status.OPEN)),
            matches_closed=Count("id", filter=Q(status=Match.Status.CLOSED)),
            matches_archived=Count("id", filter=Q(status=Match.Status.ARCHIVED)),
        )

        attendance_counts = MatchAttendance.objects.aggregate(
            attendance_confirmed=Count(
                "id",
                filter=Q(attendance_status=MatchAttendance.AttendanceStatus.CONFIRMED),
            ),
            attendance_pending=Count(
                "id",
                filter=Q(attendance_status=MatchAttendance.AttendanceStatus.PENDING),
            ),
            attendance_declined=Count(
                "id",
                filter=Q(attendance_status=MatchAttendance.AttendanceStatus.DECLINED),
            ),
            attendance_total=Count("id"),
        )

        finance_totals = Transaction.objects.aggregate(
            inflow_total=Coalesce(
                Sum(
                    Case(
                        When(
                            direction=Transaction.Direction.INFLOW,
                            status=Transaction.Status.POSTED,
                            then=F("amount"),
                        ),
                        default=Value(0),
                        output_field=DecimalField(max_digits=12, decimal_places=2),
                    )
                ),
                Decimal("0.00"),
            ),
            outflow_total=Coalesce(
                Sum(
                    Case(
                        When(
                            direction=Transaction.Direction.OUTFLOW,
                            status=Transaction.Status.POSTED,
                            then=F("amount"),
                        ),
                        default=Value(0),
                        output_field=DecimalField(max_digits=12, decimal_places=2),
                    )
                ),
                Decimal("0.00"),
            ),
            pending_total=Coalesce(
                Sum(
                    Case(
                        When(status=Transaction.Status.PENDING, then=F("amount")),
                        default=Value(0),
                        output_field=DecimalField(max_digits=12, decimal_places=2),
                    )
                ),
                Decimal("0.00"),
            ),
        )

        active_members = list(
            Player.objects.filter(
                player_type=Player.PlayerType.MEMBER,
                is_active=True,
            ).only("id", "monthly_fee_amount")
        )
        payment_map = build_player_payment_map(
            [player.id for player in active_members],
            month_start,
            month_end,
        )

        adimplent_members = 0
        for player in active_members:
            paid_amount = payment_map.get(player.id, {}).get("paid_amount", Decimal("0.00"))
            outstanding = player.monthly_fee_amount - paid_amount
            if outstanding <= Decimal("0.00"):
                adimplent_members += 1

        payload = {
            "reference_month": reference_month,
            **match_counts,
            "active_members": len(active_members),
            **attendance_counts,
            **finance_totals,
            "current_balance": finance_totals["inflow_total"] - finance_totals["outflow_total"],
            "adimplent_members": adimplent_members,
            "delinquent_members": len(active_members) - adimplent_members,
        }
        serializer = SeasonOverviewSerializer(payload)
        return Response(serializer.data)


class PresenceRankingView(APIView):
    permission_classes = [IsRoleAdmin]

    def get(self, request):
        try:
            limit = int(request.query_params.get("limit", "20"))
        except ValueError as exc:
            raise ValidationError({"limit": "Forneca um numero inteiro."}) from exc

        ranked_players = (
            Player.objects.filter(player_type=Player.PlayerType.MEMBER, is_active=True)
            .annotate(
                confirmed_count=Count(
                    "attendance_entries",
                    filter=Q(
                        attendance_entries__attendance_status=MatchAttendance.AttendanceStatus.CONFIRMED
                    ),
                ),
                pending_count=Count(
                    "attendance_entries",
                    filter=Q(
                        attendance_entries__attendance_status=MatchAttendance.AttendanceStatus.PENDING
                    ),
                ),
                declined_count=Count(
                    "attendance_entries",
                    filter=Q(
                        attendance_entries__attendance_status=MatchAttendance.AttendanceStatus.DECLINED
                    ),
                ),
                total_calls=Count("attendance_entries"),
            )
            .order_by("-confirmed_count", "full_name")[: max(limit, 1)]
        )

        ranking = []
        for player in ranked_players:
            attendance_rate = Decimal("0.00")
            if player.total_calls:
                attendance_rate = (
                    Decimal(player.confirmed_count) * Decimal("100.00") / Decimal(player.total_calls)
                ).quantize(Decimal("0.01"))

            ranking.append(
                {
                    "player_id": player.id,
                    "player_name": player.full_name,
                    "confirmed_count": player.confirmed_count,
                    "pending_count": player.pending_count,
                    "declined_count": player.declined_count,
                    "total_calls": player.total_calls,
                    "attendance_rate": attendance_rate,
                }
            )

        serializer = PresenceRankingSerializer({"ranking": ranking})
        return Response(serializer.data)


class PaymentRankingView(APIView):
    permission_classes = [IsRoleAdmin]

    def get(self, request):
        month_start, reference_month = parse_reference_month(request.query_params.get("reference_month"))
        _, month_end = month_bounds(month_start)

        try:
            limit = int(request.query_params.get("limit", "20"))
        except ValueError as exc:
            raise ValidationError({"limit": "Forneca um numero inteiro."}) from exc

        members = list(
            Player.objects.filter(player_type=Player.PlayerType.MEMBER, is_active=True).only(
                "id",
                "full_name",
                "monthly_fee_amount",
            )
        )
        payment_map = build_player_payment_map(
            [player.id for player in members],
            month_start,
            month_end,
        )

        ranking = []
        for player in members:
            paid_amount = payment_map.get(player.id, {}).get("paid_amount", Decimal("0.00"))
            pending_amount = payment_map.get(player.id, {}).get("pending_amount", Decimal("0.00"))
            outstanding_amount = player.monthly_fee_amount - paid_amount
            if outstanding_amount < Decimal("0.00"):
                outstanding_amount = Decimal("0.00")

            ranking.append(
                {
                    "player_id": player.id,
                    "player_name": player.full_name,
                    "expected_monthly_fee": player.monthly_fee_amount,
                    "paid_amount": paid_amount,
                    "pending_amount": pending_amount,
                    "outstanding_amount": outstanding_amount,
                    "is_adimplente": outstanding_amount == Decimal("0.00"),
                }
            )

        ranking.sort(key=lambda item: (item["outstanding_amount"], item["pending_amount"], item["player_name"]))
        payload = {
            "reference_month": reference_month,
            "ranking": ranking[: max(limit, 1)],
        }
        serializer = PaymentRankingSerializer(payload)
        return Response(serializer.data)
