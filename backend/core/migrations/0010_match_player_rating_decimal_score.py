from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0009_guest_fee_tracking"),
    ]

    operations = [
        migrations.AlterField(
            model_name="matchplayerrating",
            name="score",
            field=models.DecimalField(decimal_places=1, max_digits=3),
        ),
    ]
