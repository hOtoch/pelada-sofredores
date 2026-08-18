from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0011_match_player_stat"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="winning_team_number",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
