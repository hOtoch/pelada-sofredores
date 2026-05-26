"""Concrete Django models for the initial monolithic delivery."""

from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q

from apps.common.models import RatingSnapshotMixin, TimestampedModel


class Role(models.TextChoices):
    ADMIN = "ADMIN", "Administrador"
    COMMON = "COMMON", "Comum"


class User(AbstractUser, TimestampedModel):
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.COMMON)
    display_name = models.CharField(max_length=120, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    linked_player = models.OneToOneField(
        "Player",
        related_name="account",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    must_change_password = models.BooleanField(default=True)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        db_table = "users"
        ordering = ("username",)
        indexes = [
            models.Index(fields=("role",)),
            models.Index(fields=("is_active",)),
            models.Index(fields=("phone_number",)),
        ]

    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN

    def __str__(self) -> str:
        return self.display_name or self.get_full_name() or self.username


class Player(TimestampedModel, RatingSnapshotMixin):
    class PlayerType(models.TextChoices):
        MEMBER = "MEMBER", "Mensalista"
        GUEST = "GUEST", "Convidado"

    class PreferredPosition(models.TextChoices):
        GOALKEEPER = "GOALKEEPER", "Goleiro"
        DEFENDER = "DEFENDER", "Defensor"
        MIDFIELDER = "MIDFIELDER", "Meio-campo"
        FORWARD = "FORWARD", "Atacante"
        UNIVERSAL = "UNIVERSAL", "Coringa"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=120)
    nickname = models.CharField(max_length=60, blank=True)
    player_type = models.CharField(
        max_length=16,
        choices=PlayerType.choices,
        default=PlayerType.MEMBER,
    )
    preferred_position = models.CharField(
        max_length=16,
        choices=PreferredPosition.choices,
        default=PreferredPosition.UNIVERSAL,
    )
    email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    shirt_number = models.PositiveSmallIntegerField(null=True, blank=True)
    monthly_fee_amount = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    joined_on = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "players"
        ordering = ("full_name",)
        indexes = [
            models.Index(fields=("full_name",)),
            models.Index(fields=("player_type",)),
            models.Index(fields=("is_active",)),
        ]

    def __str__(self) -> str:
        return self.nickname or self.full_name


class Match(TimestampedModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Rascunho"
        OPEN = "OPEN", "Aberta"
        CLOSED = "CLOSED", "Fechada"
        ARCHIVED = "ARCHIVED", "Arquivada"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheduled_at = models.DateTimeField()
    location = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    expected_team_count = models.PositiveSmallIntegerField(default=2)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_matches",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    attendance_locked_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    teams_generated_at = models.DateTimeField(null=True, blank=True)
    result_summary = models.TextField(blank=True)
    result_recorded_at = models.DateTimeField(null=True, blank=True)
    ratings_finalized_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "matches"
        ordering = ("-scheduled_at",)
        indexes = [
            models.Index(fields=("scheduled_at",)),
            models.Index(fields=("status",)),
        ]

    def __str__(self) -> str:
        return self.scheduled_at.strftime("%Y-%m-%d %H:%M")


class Transaction(TimestampedModel):
    class Direction(models.TextChoices):
        INFLOW = "INFLOW", "Entrada"
        OUTFLOW = "OUTFLOW", "Saida"

    class Category(models.TextChoices):
        MONTHLY_FEE = "MONTHLY_FEE", "Mensalidade"
        EXTRA_FEE = "EXTRA_FEE", "Taxa Extra"
        FIELD_RENT = "FIELD_RENT", "Aluguel de Campo"
        BARBECUE = "BARBECUE", "Churrasco"
        EQUIPMENT = "EQUIPMENT", "Equipamento"
        REFUND = "REFUND", "Reembolso"
        ADJUSTMENT = "ADJUSTMENT", "Ajuste"
        OTHER = "OTHER", "Outro"

    class Status(models.TextChoices):
        POSTED = "POSTED", "Lancado"
        PENDING = "PENDING", "Pendente"
        VOIDED = "VOIDED", "Estornado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    direction = models.CharField(max_length=8, choices=Direction.choices)
    category = models.CharField(max_length=24, choices=Category.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.POSTED)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    description = models.CharField(max_length=255)
    occurred_on = models.DateField()
    reference_month = models.DateField(null=True, blank=True)
    related_player = models.ForeignKey(
        Player,
        related_name="transactions",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    match = models.ForeignKey(
        Match,
        related_name="transactions",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="recorded_transactions",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    external_reference = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "transactions"
        ordering = ("-occurred_on", "-created_at")
        indexes = [
            models.Index(fields=("direction", "status")),
            models.Index(fields=("category",)),
            models.Index(fields=("occurred_on",)),
        ]

    def __str__(self) -> str:
        return f"{self.get_direction_display()} - {self.description}"


class MatchAttendance(TimestampedModel, RatingSnapshotMixin):
    class AttendanceStatus(models.TextChoices):
        CONFIRMED = "CONFIRMED", "Confirmado"
        PENDING = "PENDING", "Pendente"
        DECLINED = "DECLINED", "Nao vai"

    class GuestFeeStatus(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        PAID = "PAID", "Pago"
        WAIVED = "WAIVED", "Dispensado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(
        Match,
        related_name="attendance_entries",
        on_delete=models.CASCADE,
    )
    player = models.ForeignKey(
        Player,
        related_name="attendance_entries",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    display_name = models.CharField(max_length=120)
    is_guest = models.BooleanField(default=False)
    attendance_status = models.CharField(
        max_length=16,
        choices=AttendanceStatus.choices,
        default=AttendanceStatus.CONFIRMED,
    )
    invited_by = models.ForeignKey(
        Player,
        related_name="invited_guests",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    assigned_team_number = models.PositiveSmallIntegerField(null=True, blank=True)
    assigned_team_name = models.CharField(max_length=32, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    guest_fee_amount = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    guest_fee_status = models.CharField(
        max_length=16,
        choices=GuestFeeStatus.choices,
        default=GuestFeeStatus.WAIVED,
    )
    guest_fee_paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "match_attendances"
        ordering = ("match_id", "display_name")
        constraints = [
            models.UniqueConstraint(
                fields=("match", "player"),
                condition=Q(player__isnull=False),
                name="unique_member_attendance_per_match",
            ),
        ]
        indexes = [
            models.Index(fields=("attendance_status",)),
            models.Index(fields=("is_guest",)),
        ]

    def __str__(self) -> str:
        return f"{self.match} - {self.display_name}"


class MatchPlayerRating(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(
        Match,
        related_name="player_ratings",
        on_delete=models.CASCADE,
    )
    rater = models.ForeignKey(
        Player,
        related_name="legacy_given_match_ratings",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    rater_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="given_match_ratings",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    rated_attendance = models.ForeignKey(
        MatchAttendance,
        related_name="received_ratings",
        on_delete=models.CASCADE,
    )
    rated_player = models.ForeignKey(
        Player,
        related_name="received_match_ratings",
        on_delete=models.CASCADE,
    )
    score = models.PositiveSmallIntegerField()

    class Meta:
        db_table = "match_player_ratings"
        ordering = ("match_id", "rated_attendance__display_name")
        constraints = [
            models.UniqueConstraint(
                fields=("match", "rater_user", "rated_attendance"),
                name="unique_rating_per_user_attendance",
            ),
            models.CheckConstraint(
                check=Q(score__gte=1) & Q(score__lte=10),
                name="match_player_rating_score_1_10",
            ),
        ]
        indexes = [
            models.Index(fields=("match", "rater")),
            models.Index(fields=("match", "rater_user")),
            models.Index(fields=("rated_player",)),
        ]

    def __str__(self) -> str:
        return f"{self.match} - {self.rater_user or self.rater} -> {self.rated_attendance}: {self.score}"
