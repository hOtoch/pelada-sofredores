from django.contrib import admin

from .models import (
    Match,
    MatchAttendance,
    MatchPlayerRating,
    MatchPlayerStat,
    Player,
    Transaction,
    User,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("username", "email", "role", "linked_player", "is_active")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("username", "email", "display_name")


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "nickname",
        "player_type",
        "preferred_position",
        "overall",
        "monthly_fee_amount",
        "is_active",
    )
    list_filter = ("player_type", "preferred_position", "is_active")
    search_fields = ("full_name", "nickname", "email")


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ("scheduled_at", "location", "status", "expected_team_count")
    list_filter = ("status",)
    search_fields = ("location",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("description", "direction", "category", "amount", "occurred_on", "status")
    list_filter = ("direction", "category", "status")
    search_fields = ("description", "external_reference")


@admin.register(MatchAttendance)
class MatchAttendanceAdmin(admin.ModelAdmin):
    list_display = (
        "display_name",
        "match",
        "attendance_status",
        "is_guest",
        "assigned_team_number",
    )
    list_filter = ("attendance_status", "is_guest")
    search_fields = ("display_name",)


@admin.register(MatchPlayerRating)
class MatchPlayerRatingAdmin(admin.ModelAdmin):
    list_display = ("match", "rater_user", "rated_attendance", "rated_player", "score")
    list_filter = ("score",)
    search_fields = (
        "rater_user__username",
        "rater_user__display_name",
        "rated_attendance__display_name",
        "rated_player__full_name",
    )


@admin.register(MatchPlayerStat)
class MatchPlayerStatAdmin(admin.ModelAdmin):
    list_display = (
        "match",
        "display_name",
        "team_name",
        "goals",
        "assists",
        "team_won",
        "imported_by",
    )
    list_filter = ("team_won", "team_name")
    search_fields = ("display_name", "player__full_name", "match__location")
