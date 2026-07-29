from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SystemModule

User = get_user_model()


class PublicUserSerializer(serializers.ModelSerializer):
    active = serializers.BooleanField(source="is_active", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "full_name",
            "role",
            "active",
            "date_joined",
            "last_login",
        ]


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        identifier = attrs["username"].strip()
        user = User.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()

        if user is None or not user.check_password(attrs["password"]):
            raise serializers.ValidationError("Usuario ou senha invalidos.")
        if not user.is_active:
            raise serializers.ValidationError("Usuario inativo.")

        attrs["user"] = user
        return attrs

    def create_tokens(self):
        user = self.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        return {
            "accessToken": str(refresh.access_token),
            "refreshToken": str(refresh),
            "user": PublicUserSerializer(user).data,
        }


class LoginResponseSerializer(serializers.Serializer):
    accessToken = serializers.CharField()
    refreshToken = serializers.CharField()
    user = PublicUserSerializer()


class LogoutSerializer(serializers.Serializer):
    refreshToken = serializers.CharField(required=False, allow_blank=False)


class RefreshSerializer(serializers.Serializer):
    refreshToken = serializers.CharField()

    def validate(self, attrs):
        serializer = TokenRefreshSerializer(data={"refresh": attrs["refreshToken"]})
        serializer.is_valid(raise_exception=True)
        return {
            "accessToken": serializer.validated_data["access"],
            "refreshToken": serializer.validated_data.get(
                "refresh",
                attrs["refreshToken"],
            ),
        }


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(trim_whitespace=False, write_only=True)
    newPassword = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate_currentPassword(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Senha atual invalida.")
        return value

    def validate_newPassword(self, value):
        from django.contrib.auth.password_validation import validate_password

        validate_password(value, self.context["request"].user)
        return value


class ModuleSerializer(serializers.ModelSerializer):
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
