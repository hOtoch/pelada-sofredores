from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.common.models import RatingSnapshotMixin, TimestampedModel


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
    teams_generated_at = models.DateTimeField(null=True, blank=True)
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


class MatchAttendance(TimestampedModel, RatingSnapshotMixin):
    class AttendanceStatus(models.TextChoices):
        CONFIRMED = "CONFIRMED", "Confirmado"
        PENDING = "PENDING", "Pendente"
        DECLINED = "DECLINED", "Nao vai"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    match = models.ForeignKey(
        Match,
        related_name="attendance_entries",
        on_delete=models.CASCADE,
    )
    player = models.ForeignKey(
        "players.Player",
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
        "players.Player",
        related_name="invited_guests",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    assigned_team_number = models.PositiveSmallIntegerField(null=True, blank=True)
    assigned_team_name = models.CharField(max_length=32, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
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
