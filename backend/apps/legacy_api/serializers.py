from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import (
    MinimumLengthValidator,
    get_default_password_validators,
    validate_password,
)
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import SystemModule

User = get_user_model()


class LegacyPayloadSerializer(serializers.Serializer):
    pass


class LegacyUserSerializer(serializers.ModelSerializer):
    active = serializers.BooleanField(source="is_active")
    created_date = serializers.DateTimeField(source="date_joined", read_only=True)
    updated_date = serializers.DateTimeField(source="date_joined", read_only=True)
    created_by_id = serializers.UUIDField(read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "full_name",
            "role",
            "active",
            "created_date",
            "updated_date",
            "created_by_id",
        ]


def validate_role_password(password, user):
    """Keep strong admin passwords while allowing shorter operator credentials."""
    if getattr(user, "role", None) == User.Role.ADMIN:
        validate_password(password, user)
        return

    errors = []
    if len(password) < 6:
        errors.append("A senha de usuario comum deve ter pelo menos 6 caracteres.")

    for validator in get_default_password_validators():
        if isinstance(validator, MinimumLengthValidator):
            continue
        try:
            validator.validate(password, user)
        except DjangoValidationError as exc:
            errors.extend(exc.messages)

    if errors:
        raise serializers.ValidationError(errors)


class AdminUserWriteSerializer(serializers.ModelSerializer):
    active = serializers.BooleanField(source="is_active", required=False)
    password = serializers.CharField(write_only=True, required=False)
    full_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ["username", "email", "full_name", "role", "active", "password"]

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "A senha inicial e obrigatoria."})
        if attrs.get("password"):
            validation_user = self.instance or User(
                username=attrs.get("username", ""),
                email=attrs.get("email"),
                role=attrs.get("role", User.Role.USER),
            )
            if self.instance is not None:
                validation_user.role = attrs.get("role", self.instance.role)
            validate_role_password(attrs["password"], validation_user)
        return attrs

    def validate_full_name(self, value):
        return value or ""

    def create(self, validated_data):
        password = validated_data.pop("password")
        request = self.context.get("request")
        created_by = (
            request.user
            if request is not None and request.user.is_authenticated
            else None
        )
        return User.objects.create_user(
            password=password,
            created_by=created_by,
            **validated_data,
        )

    def update(self, instance, validated_data):
        validated_data.pop("password", None)
        return super().update(instance, validated_data)


class AdminPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        validate_role_password(value, self.context.get("user"))
        return value


class TemporaryPasswordResponseSerializer(serializers.Serializer):
    username = serializers.CharField()
    temporaryPassword = serializers.CharField()


class AdminStatusSerializer(serializers.Serializer):
    active = serializers.BooleanField()


class WorkOrderApprovalSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("approve", "reject"))
    reason = serializers.CharField(required=False, allow_blank=True)


class ModuleKeysSerializer(serializers.Serializer):
    moduleKeys = serializers.ListField(
        child=serializers.SlugField(),
        allow_empty=True,
    )


class LegacyModuleSerializer(serializers.ModelSerializer):
    canAccess = serializers.BooleanField(source="can_access", read_only=True)

    class Meta:
        model = SystemModule
        fields = [
            "id",
            "key",
            "name",
            "path",
            "description",
            "order",
            "active",
            "canAccess",
        ]
