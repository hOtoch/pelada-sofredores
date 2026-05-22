from __future__ import annotations

import uuid
from decimal import Decimal

from django.db import models

from apps.common.models import RatingSnapshotMixin, TimestampedModel


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
