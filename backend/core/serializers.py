"""REST serializers aligned with the initial domain model."""
import re

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Match, MatchAttendance, MatchPlayerRating, Player, Role, Transaction, User

UserModel = get_user_model()


def normalize_phone(value: str) -> str:
    return re.sub(r"\D", "", value or "")


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "display_name",
            "phone_number",
            "role",
            "linked_player",
            "must_change_password",
            "is_active",
        )


class UserAccountSerializer(serializers.ModelSerializer):
    linked_player_name = serializers.CharField(source="linked_player.full_name", read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "display_name",
            "phone_number",
            "role",
            "is_active",
            "must_change_password",
            "linked_player",
            "linked_player_name",
            "password",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {
            "must_change_password": {"required": False},
        }

    def create(self, validated_data):
        password = validated_data.pop("password", "")
        user = User(**validated_data)
        if password:
            user.set_password(password)
            user.must_change_password = False
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
            instance.must_change_password = False
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs):
        identifier = attrs["identifier"]
        password = attrs["password"]
        username = identifier

        if "@" in identifier:
            try:
                username = UserModel.objects.get(email__iexact=identifier).username
            except UserModel.DoesNotExist as exc:
                raise serializers.ValidationError("Usuário ou senha inválidos.") from exc
        elif normalize_phone(identifier):
            phone_digits = normalize_phone(identifier)
            try:
                username = UserModel.objects.get(phone_number=phone_digits).username
            except UserModel.DoesNotExist:
                username = identifier
            except UserModel.MultipleObjectsReturned as exc:
                raise serializers.ValidationError("Celular vinculado a mais de uma conta.") from exc

        user = authenticate(username=username, password=password)
        if user is None:
            raise serializers.ValidationError("Usuário ou senha inválidos.")
        if not user.is_active:
            raise serializers.ValidationError("Conta desativada.")

        attrs["user"] = user
        return attrs


class PublicSignupSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=120)
    phone_number = serializers.CharField(max_length=32)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False, min_length=8)

    def validate_phone_number(self, value):
        normalized = normalize_phone(value)
        if len(normalized) < 10:
            raise serializers.ValidationError("Informe um celular válido.")
        if User.objects.filter(phone_number=normalized).exists():
            raise serializers.ValidationError("Este celular já está em uso.")
        return normalized

    def validate_username(self, value):
        normalized = value.strip()
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError("Este usuário já está em uso.")
        return normalized

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        full_name = validated_data["full_name"].strip()
        phone_number = validated_data["phone_number"]
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            display_name=full_name,
            phone_number=phone_number,
            role=Role.COMMON,
            must_change_password=False,
            is_active=True,
        )
        return user


class AdminResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(trim_whitespace=False, min_length=8)

    def validate_new_password(self, value):
        user = self.context.get("target_user")
        validate_password(value, user=user)
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(trim_whitespace=False, min_length=8)

    def validate(self, attrs):
        user = self.context["request"].user
        current_password = attrs["current_password"]
        new_password = attrs["new_password"]

        if not user.check_password(current_password):
            raise serializers.ValidationError({"current_password": "Senha atual inválida."})
        if current_password == new_password:
            raise serializers.ValidationError({"new_password": "A nova senha deve ser diferente da atual."})

        validate_password(new_password, user=user)
        return attrs


class PlayerSerializer(serializers.ModelSerializer):
    account_id = serializers.UUIDField(source="account.id", read_only=True)

    class Meta:
        model = Player
        fields = (
            "id",
            "full_name",
            "nickname",
            "player_type",
            "preferred_position",
            "email",
            "phone_number",
            "shirt_number",
            "monthly_fee_amount",
            "joined_on",
            "is_active",
            "notes",
            "overall",
            "account_id",
            "created_at",
            "updated_at",
        )


class MatchSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Match
        fields = (
            "id",
            "scheduled_at",
            "location",
            "status",
            "expected_team_count",
            "attendance_locked_at",
            "teams_generated_at",
            "result_summary",
            "result_recorded_at",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )


class TransactionSerializer(serializers.ModelSerializer):
    related_player_name = serializers.CharField(source="related_player.full_name", read_only=True)
    recorded_by_name = serializers.CharField(source="recorded_by.username", read_only=True)

    class Meta:
        model = Transaction
        fields = (
            "id",
            "direction",
            "category",
            "status",
            "amount",
            "description",
            "occurred_on",
            "reference_month",
            "related_player",
            "related_player_name",
            "match",
            "recorded_by",
            "recorded_by_name",
            "external_reference",
            "notes",
            "created_at",
            "updated_at",
        )


class MatchAttendanceSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source="player.full_name", read_only=True)

    class Meta:
        model = MatchAttendance
        fields = (
            "id",
            "match",
            "player",
            "player_name",
            "display_name",
            "is_guest",
            "attendance_status",
            "invited_by",
            "assigned_team_number",
            "assigned_team_name",
            "confirmed_at",
            "notes",
            "overall",
            "created_at",
            "updated_at",
        )


class FinancialSummarySerializer(serializers.Serializer):
    current_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    inflow_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    outflow_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    pending_total = serializers.DecimalField(max_digits=10, decimal_places=2)


class TeamGenerationInputSerializer(serializers.Serializer):
    team_count = serializers.IntegerField(min_value=2, max_value=6, required=False)


class TeamPlayerSerializer(serializers.Serializer):
    id = serializers.CharField()
    display_name = serializers.CharField()
    is_guest = serializers.BooleanField()
    overall = serializers.IntegerField()


class GeneratedTeamSerializer(serializers.Serializer):
    name = serializers.CharField()
    total_overall = serializers.IntegerField()
    average_overall = serializers.DecimalField(max_digits=8, decimal_places=2)
    players = TeamPlayerSerializer(many=True)


class TeamGenerationResponseSerializer(serializers.Serializer):
    match_id = serializers.UUIDField()
    average_overall_gap = serializers.DecimalField(max_digits=8, decimal_places=2)
    diagnostics = serializers.JSONField()
    teams = GeneratedTeamSerializer(many=True)


class MatchPlayerRatingItemSerializer(serializers.Serializer):
    attendance_id = serializers.UUIDField()
    player_id = serializers.UUIDField()
    display_name = serializers.CharField()
    current_overall = serializers.IntegerField()
    score = serializers.IntegerField(allow_null=True)
    average_score = serializers.DecimalField(max_digits=4, decimal_places=2, allow_null=True)
    rating_count = serializers.IntegerField()


class MatchPlayerRatingStateSerializer(serializers.Serializer):
    match_id = serializers.UUIDField()
    can_rate = serializers.BooleanField()
    has_submitted = serializers.BooleanField()
    locked_reason = serializers.CharField(allow_blank=True)
    items = MatchPlayerRatingItemSerializer(many=True)


class MatchPlayerRatingInputItemSerializer(serializers.Serializer):
    attendance_id = serializers.UUIDField()
    score = serializers.IntegerField(min_value=1, max_value=10)


class MatchPlayerRatingSubmitSerializer(serializers.Serializer):
    ratings = MatchPlayerRatingInputItemSerializer(many=True, allow_empty=False)


class PortalFinancialStatusSerializer(serializers.Serializer):
    reference_month = serializers.CharField()
    expected_monthly_fee = serializers.DecimalField(max_digits=10, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    pending_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    outstanding_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    is_adimplente = serializers.BooleanField()


class PortalAttendanceStatusSerializer(serializers.Serializer):
    confirmed_count = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    declined_count = serializers.IntegerField()
    total_count = serializers.IntegerField()


class PortalRecentAttendanceItemSerializer(serializers.Serializer):
    match_id = serializers.UUIDField()
    scheduled_at = serializers.DateTimeField()
    match_status = serializers.CharField()
    attendance_status = serializers.CharField()
    assigned_team_name = serializers.CharField(allow_blank=True)


class PortalUpcomingMatchItemSerializer(serializers.Serializer):
    match_id = serializers.UUIDField()
    scheduled_at = serializers.DateTimeField()
    location = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    expected_team_count = serializers.IntegerField()
    attendance_status = serializers.CharField(allow_null=True)


class PortalOverviewSerializer(serializers.Serializer):
    user = UserSerializer()
    linked_player = PlayerSerializer(allow_null=True)
    financial_status = PortalFinancialStatusSerializer()
    attendance_status = PortalAttendanceStatusSerializer()
    recent_attendance = PortalRecentAttendanceItemSerializer(many=True)
    upcoming_matches = PortalUpcomingMatchItemSerializer(many=True)


class SeasonOverviewSerializer(serializers.Serializer):
    reference_month = serializers.CharField()
    total_matches = serializers.IntegerField()
    matches_open = serializers.IntegerField()
    matches_closed = serializers.IntegerField()
    matches_archived = serializers.IntegerField()
    active_members = serializers.IntegerField()
    attendance_confirmed = serializers.IntegerField()
    attendance_pending = serializers.IntegerField()
    attendance_declined = serializers.IntegerField()
    attendance_total = serializers.IntegerField()
    inflow_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    outflow_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    current_balance = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_total = serializers.DecimalField(max_digits=12, decimal_places=2)
    adimplent_members = serializers.IntegerField()
    delinquent_members = serializers.IntegerField()


class PresenceRankingItemSerializer(serializers.Serializer):
    player_id = serializers.UUIDField()
    player_name = serializers.CharField()
    confirmed_count = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    declined_count = serializers.IntegerField()
    total_calls = serializers.IntegerField()
    attendance_rate = serializers.DecimalField(max_digits=6, decimal_places=2)


class PresenceRankingSerializer(serializers.Serializer):
    ranking = PresenceRankingItemSerializer(many=True)


class PaymentRankingItemSerializer(serializers.Serializer):
    player_id = serializers.UUIDField()
    player_name = serializers.CharField()
    expected_monthly_fee = serializers.DecimalField(max_digits=10, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    pending_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    outstanding_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    is_adimplente = serializers.BooleanField()


class PaymentRankingSerializer(serializers.Serializer):
    reference_month = serializers.CharField()
    ranking = PaymentRankingItemSerializer(many=True)
