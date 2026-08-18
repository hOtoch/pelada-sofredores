from django.db import migrations, models


def collapse_statuses(apps, schema_editor):
    Match = apps.get_model("core", "Match")
    Match.objects.filter(status="DRAFT").update(status="OPEN")
    Match.objects.filter(status="CLOSED").update(status="ARCHIVED")


def restore_statuses(apps, schema_editor):
    """Best-effort reversal: the original DRAFT/CLOSED values cannot be recovered."""


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_match_winning_team_number"),
    ]

    operations = [
        migrations.RunPython(collapse_statuses, restore_statuses),
        migrations.AlterField(
            model_name="match",
            name="status",
            field=models.CharField(
                choices=[("OPEN", "Aberta"), ("ARCHIVED", "Finalizada")],
                default="OPEN",
                max_length=16,
            ),
        ),
    ]
