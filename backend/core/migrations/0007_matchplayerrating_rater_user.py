from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def copy_legacy_raters(apps, schema_editor):
    match_player_rating = apps.get_model("core", "MatchPlayerRating")
    user = apps.get_model("core", "User")

    for rating in match_player_rating.objects.filter(
        rater_user__isnull=True,
        rater_id__isnull=False,
    ).iterator():
        rater_user = user.objects.filter(linked_player_id=rating.rater_id).order_by("id").first()
        if rater_user:
            rating.rater_user_id = rater_user.id
            rating.save(update_fields=["rater_user"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0006_user_phone_number_user_users_phone_n_a3b1c5_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="matchplayerrating",
            name="rater_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="given_match_ratings",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="matchplayerrating",
            name="rater",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="legacy_given_match_ratings",
                to="core.player",
            ),
        ),
        migrations.RunPython(copy_legacy_raters, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="matchplayerrating",
            name="unique_rating_per_rater_attendance",
        ),
        migrations.AddConstraint(
            model_name="matchplayerrating",
            constraint=models.UniqueConstraint(
                fields=("match", "rater_user", "rated_attendance"),
                name="unique_rating_per_user_attendance",
            ),
        ),
        migrations.AddIndex(
            model_name="matchplayerrating",
            index=models.Index(
                fields=["match", "rater_user"],
                name="match_playe_match_i_b22529_idx",
            ),
        ),
    ]
