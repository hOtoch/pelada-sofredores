from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_matchplayerrating_rater_user"),
    ]

    operations = [
        migrations.AddField(
            model_name="match",
            name="archived_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="match",
            name="ratings_finalized_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
