from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from apps.teams.contracts import TeamGenerationResult


@dataclass(frozen=True)
class SessionUser:
    id: UUID
    username: str
    email: str
    role: str
    display_name: str


@dataclass(frozen=True)
class PlayerUpsertInput:
    full_name: str
    nickname: str = ""
    player_type: str = "MEMBER"
    preferred_position: str = "UNIVERSAL"
    monthly_fee_amount: Decimal = Decimal("0.00")
    overall: int = 70
    is_active: bool = True
    notes: str = ""


@dataclass(frozen=True)
class TransactionCreateInput:
    direction: str
    category: str
    amount: Decimal
    description: str
    occurred_on: date
    reference_month: date | None = None
    related_player_id: UUID | None = None
    match_id: UUID | None = None
    notes: str = ""


@dataclass(frozen=True)
class MatchCreateInput:
    scheduled_at: datetime
    location: str = ""
    expected_team_count: int = 2
    notes: str = ""


@dataclass(frozen=True)
class AttendanceUpsertInput:
    match_id: UUID
    player_id: UUID | None
    display_name: str
    is_guest: bool
    attendance_status: str = "CONFIRMED"
    invited_by_id: UUID | None = None
    overall: int = 70


@dataclass(frozen=True)
class CashFlowSnapshot:
    current_balance: Decimal
    inflow_total: Decimal
    outflow_total: Decimal
    pending_total: Decimal


class AuthService(Protocol):
    def authenticate(self, identifier: str, password: str) -> SessionUser | None:
        ...

    def can_manage_finance(self, user: SessionUser) -> bool:
        ...


class PlayerService(Protocol):
    def list_players(self, active_only: bool = True) -> Sequence[object]:
        ...

    def upsert_player(self, payload: PlayerUpsertInput, player_id: UUID | None = None) -> UUID:
        ...


class FinanceService(Protocol):
    def create_transaction(self, payload: TransactionCreateInput, user: SessionUser) -> UUID:
        ...

    def get_cash_flow(self) -> CashFlowSnapshot:
        ...


class MatchService(Protocol):
    def create_match(self, payload: MatchCreateInput, user: SessionUser) -> UUID:
        ...

    def register_attendance(self, payload: AttendanceUpsertInput, user: SessionUser) -> UUID:
        ...


class TeamGenerationService(Protocol):
    def generate_teams(self, match_id: UUID, user: SessionUser) -> TeamGenerationResult:
        ...
