from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0010_match_player_rating_decimal_score"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MatchPlayerStat",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("display_name", models.CharField(max_length=120)),
                ("team_number", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("team_name", models.CharField(blank=True, max_length=32)),
                ("goals", models.PositiveSmallIntegerField(default=0)),
                ("assists", models.PositiveSmallIntegerField(default=0)),
                ("team_won", models.BooleanField(default=False)),
                ("source_label", models.CharField(blank=True, max_length=120)),
                (
                    "attendance",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="player_stats",
                        to="core.matchattendance",
                    ),
                ),
                (
                    "imported_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="imported_match_stats",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "match",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="player_stats",
                        to="core.match",
                    ),
                ),
                (
                    "player",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="match_stats",
                        to="core.player",
                    ),
                ),
            ],
            options={
                "db_table": "match_player_stats",
                "ordering": ("match_id", "team_number", "display_name"),
            },
        ),
        migrations.AddConstraint(
            model_name="matchplayerstat",
            constraint=models.UniqueConstraint(
                fields=("match", "attendance"),
                name="unique_stat_per_match_attendance",
            ),
        ),
        migrations.AddIndex(
            model_name="matchplayerstat",
            index=models.Index(fields=("match", "team_number"), name="match_playe_match_i_5a8267_idx"),
        ),
        migrations.AddIndex(
            model_name="matchplayerstat",
            index=models.Index(fields=("player",), name="match_playe_player__1c429f_idx"),
        ),
        migrations.AddIndex(
            model_name="matchplayerstat",
            index=models.Index(fields=("team_won",), name="match_playe_team_wo_996c8d_idx"),
        ),
    ]
