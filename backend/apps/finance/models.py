from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.common.models import TimestampedModel


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
    reference_month = models.DateField(
        null=True,
        blank=True,
        help_text="Use the first day of the month for mensalidades and recurring charges.",
    )
    related_player = models.ForeignKey(
        "players.Player",
        related_name="transactions",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    match = models.ForeignKey(
        "matches.Match",
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
