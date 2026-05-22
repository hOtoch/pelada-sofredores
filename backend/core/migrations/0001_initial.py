from __future__ import annotations

import uuid
from decimal import Decimal

import django.contrib.auth.models
import django.contrib.auth.validators
import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


RATING_VALIDATORS = [
    django.core.validators.MinValueValidator(0),
    django.core.validators.MaxValueValidator(99),
]


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="Player",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "overall",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "attack",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "defense",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "speed",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "dribble",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "tackle",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "passing",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "stamina",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "shooting",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "goalkeeping",
                    models.PositiveSmallIntegerField(default=30, validators=RATING_VALIDATORS),
                ),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("full_name", models.CharField(max_length=120)),
                ("nickname", models.CharField(blank=True, max_length=60)),
                (
                    "player_type",
                    models.CharField(
                        choices=[("MEMBER", "Mensalista"), ("GUEST", "Convidado")],
                        default="MEMBER",
                        max_length=16,
                    ),
                ),
                (
                    "preferred_position",
                    models.CharField(
                        choices=[
                            ("GOALKEEPER", "Goleiro"),
                            ("DEFENDER", "Defensor"),
                            ("MIDFIELDER", "Meio-campo"),
                            ("FORWARD", "Atacante"),
                            ("UNIVERSAL", "Coringa"),
                        ],
                        default="UNIVERSAL",
                        max_length=16,
                    ),
                ),
                (
                    "dominant_foot",
                    models.CharField(
                        choices=[("RIGHT", "Destro"), ("LEFT", "Canhoto"), ("BOTH", "Ambidestro")],
                        default="RIGHT",
                        max_length=8,
                    ),
                ),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("phone_number", models.CharField(blank=True, max_length=32)),
                ("shirt_number", models.PositiveSmallIntegerField(blank=True, null=True)),
                (
                    "monthly_fee_amount",
                    models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=8),
                ),
                ("joined_on", models.DateField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("notes", models.TextField(blank=True)),
            ],
            options={
                "db_table": "players",
                "ordering": ("full_name",),
            },
        ),
        migrations.CreateModel(
            name="User",
            fields=[
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                (
                    "is_superuser",
                    models.BooleanField(
                        default=False,
                        help_text="Designates that this user has all permissions without explicitly assigning them.",
                        verbose_name="superuser status",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "username",
                    models.CharField(
                        error_messages={"unique": "A user with that username already exists."},
                        help_text="Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.",
                        max_length=150,
                        unique=True,
                        validators=[django.contrib.auth.validators.UnicodeUsernameValidator()],
                        verbose_name="username",
                    ),
                ),
                ("first_name", models.CharField(blank=True, max_length=150, verbose_name="first name")),
                ("last_name", models.CharField(blank=True, max_length=150, verbose_name="last name")),
                ("email", models.EmailField(blank=True, max_length=254, verbose_name="email address")),
                (
                    "is_staff",
                    models.BooleanField(
                        default=False,
                        help_text="Designates whether the user can log into this admin site.",
                        verbose_name="staff status",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(
                        default=True,
                        help_text="Designates whether this user should be treated as active. Unselect this instead of deleting accounts.",
                        verbose_name="active",
                    ),
                ),
                (
                    "date_joined",
                    models.DateTimeField(default=django.utils.timezone.now, verbose_name="date joined"),
                ),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "role",
                    models.CharField(
                        choices=[("ADMIN", "Administrador"), ("COMMON", "Comum")],
                        default="COMMON",
                        max_length=16,
                    ),
                ),
                ("display_name", models.CharField(blank=True, max_length=120)),
                ("must_change_password", models.BooleanField(default=True)),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.group",
                        verbose_name="groups",
                    ),
                ),
                (
                    "linked_player",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="account",
                        to="core.player",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Specific permissions for this user.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.permission",
                        verbose_name="user permissions",
                    ),
                ),
            ],
            options={
                "db_table": "users",
                "ordering": ("username",),
            },
            managers=[
                ("objects", django.contrib.auth.models.UserManager()),
            ],
        ),
        migrations.CreateModel(
            name="Match",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("scheduled_at", models.DateTimeField()),
                ("location", models.CharField(blank=True, max_length=120)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("DRAFT", "Rascunho"),
                            ("OPEN", "Aberta"),
                            ("CLOSED", "Fechada"),
                            ("ARCHIVED", "Arquivada"),
                        ],
                        default="DRAFT",
                        max_length=16,
                    ),
                ),
                ("expected_team_count", models.PositiveSmallIntegerField(default=2)),
                ("attendance_locked_at", models.DateTimeField(blank=True, null=True)),
                ("teams_generated_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_matches",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "matches",
                "ordering": ("-scheduled_at",),
            },
        ),
        migrations.CreateModel(
            name="Transaction",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "direction",
                    models.CharField(
                        choices=[("INFLOW", "Entrada"), ("OUTFLOW", "Saida")],
                        max_length=8,
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("MONTHLY_FEE", "Mensalidade"),
                            ("EXTRA_FEE", "Taxa Extra"),
                            ("FIELD_RENT", "Aluguel de Campo"),
                            ("BARBECUE", "Churrasco"),
                            ("EQUIPMENT", "Equipamento"),
                            ("REFUND", "Reembolso"),
                            ("ADJUSTMENT", "Ajuste"),
                            ("OTHER", "Outro"),
                        ],
                        max_length=24,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("POSTED", "Lancado"),
                            ("PENDING", "Pendente"),
                            ("VOIDED", "Estornado"),
                        ],
                        default="POSTED",
                        max_length=16,
                    ),
                ),
                (
                    "amount",
                    models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
                ),
                ("description", models.CharField(max_length=255)),
                ("occurred_on", models.DateField()),
                ("reference_month", models.DateField(blank=True, null=True)),
                ("external_reference", models.CharField(blank=True, max_length=120)),
                ("notes", models.TextField(blank=True)),
                (
                    "match",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="transactions",
                        to="core.match",
                    ),
                ),
                (
                    "recorded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recorded_transactions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "related_player",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="transactions",
                        to="core.player",
                    ),
                ),
            ],
            options={
                "db_table": "transactions",
                "ordering": ("-occurred_on", "-created_at"),
            },
        ),
        migrations.CreateModel(
            name="MatchAttendance",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "overall",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "attack",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "defense",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "speed",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "dribble",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "tackle",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "passing",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "stamina",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "shooting",
                    models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS),
                ),
                (
                    "goalkeeping",
                    models.PositiveSmallIntegerField(default=30, validators=RATING_VALIDATORS),
                ),
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("display_name", models.CharField(max_length=120)),
                ("is_guest", models.BooleanField(default=False)),
                (
                    "attendance_status",
                    models.CharField(
                        choices=[
                            ("CONFIRMED", "Confirmado"),
                            ("PENDING", "Pendente"),
                            ("DECLINED", "Nao vai"),
                        ],
                        default="CONFIRMED",
                        max_length=16,
                    ),
                ),
                ("assigned_team_number", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("assigned_team_name", models.CharField(blank=True, max_length=32)),
                ("confirmed_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                (
                    "invited_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="invited_guests",
                        to="core.player",
                    ),
                ),
                (
                    "match",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attendance_entries",
                        to="core.match",
                    ),
                ),
                (
                    "player",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="attendance_entries",
                        to="core.player",
                    ),
                ),
            ],
            options={
                "db_table": "match_attendances",
                "ordering": ("match_id", "display_name"),
            },
        ),
        migrations.AddIndex(
            model_name="player",
            index=models.Index(fields=["full_name"], name="players_full_name_ee3668_idx"),
        ),
        migrations.AddIndex(
            model_name="player",
            index=models.Index(fields=["player_type"], name="players_player_type_6ec9c2_idx"),
        ),
        migrations.AddIndex(
            model_name="player",
            index=models.Index(fields=["is_active"], name="players_is_active_0caad8_idx"),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["role"], name="users_role_4f1c1e_idx"),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["is_active"], name="users_is_active_0d2dc2_idx"),
        ),
        migrations.AddIndex(
            model_name="match",
            index=models.Index(fields=["scheduled_at"], name="matches_scheduled_at_a21724_idx"),
        ),
        migrations.AddIndex(
            model_name="match",
            index=models.Index(fields=["status"], name="matches_status_62959e_idx"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["direction", "status"], name="transactions_direction_status_1bc8e5_idx"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["category"], name="transactions_category_440df5_idx"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["occurred_on"], name="transactions_occurred_on_435456_idx"),
        ),
        migrations.AddIndex(
            model_name="matchattendance",
            index=models.Index(fields=["attendance_status"], name="attendance_status_029c7d_idx"),
        ),
        migrations.AddIndex(
            model_name="matchattendance",
            index=models.Index(fields=["is_guest"], name="attendance_is_guest_18bafa_idx"),
        ),
        migrations.AddConstraint(
            model_name="matchattendance",
            constraint=models.UniqueConstraint(
                condition=models.Q(player__isnull=False),
                fields=("match", "player"),
                name="unique_member_attendance_per_match",
            ),
        ),
    ]
