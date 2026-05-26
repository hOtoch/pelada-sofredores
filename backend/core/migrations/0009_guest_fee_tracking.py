from decimal import Decimal

from django.db import migrations, models


def seed_guest_fees(apps, schema_editor):
    match_attendance = apps.get_model("core", "MatchAttendance")
    match_attendance.objects.filter(is_guest=True).update(
        guest_fee_amount=Decimal("14.00"),
        guest_fee_status="PENDING",
    )
    match_attendance.objects.filter(is_guest=False).update(
        guest_fee_amount=Decimal("0.00"),
        guest_fee_status="WAIVED",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0008_match_rating_window"),
    ]

    operations = [
        migrations.AddField(
            model_name="matchattendance",
            name="guest_fee_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=8),
        ),
        migrations.AddField(
            model_name="matchattendance",
            name="guest_fee_status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pendente"),
                    ("PAID", "Pago"),
                    ("WAIVED", "Dispensado"),
                ],
                default="WAIVED",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="matchattendance",
            name="guest_fee_paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(seed_guest_fees, migrations.RunPython.noop),
    ]
