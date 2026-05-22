from __future__ import annotations

import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.common.models import TimestampedModel


class User(AbstractUser, TimestampedModel):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        COMMON = "COMMON", "Common User"

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.COMMON)
    display_name = models.CharField(max_length=120, blank=True)
    linked_player = models.OneToOneField(
        "players.Player",
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
        ]

    def __str__(self) -> str:
        return self.display_name or self.get_full_name() or self.username
