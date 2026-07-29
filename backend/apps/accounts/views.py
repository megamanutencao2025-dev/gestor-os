from django.contrib.auth import get_user_model
from django.db.models import BooleanField, Value
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from apps.common.serializers import OkSerializer

from .models import SystemModule
from .serializers import (
    ChangePasswordSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    LogoutSerializer,
    ModuleSerializer,
    PublicUserSerializer,
    RefreshSerializer,
)

User = get_user_model()


class LoginView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    @extend_schema(responses=LoginResponseSerializer)
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        return Response(serializer.create_tokens())


class MeView(GenericAPIView):
    serializer_class = PublicUserSerializer

    @extend_schema(responses=PublicUserSerializer)
    def get(self, request):
        return Response(PublicUserSerializer(request.user).data)


class RefreshView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = RefreshSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class LogoutView(GenericAPIView):
    serializer_class = LogoutSerializer

    @extend_schema(responses=OkSerializer)
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refresh_token = serializer.validated_data.get("refreshToken")
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                return Response(
                    {"message": "Refresh token invalido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return Response({"ok": True})


class ChangePasswordView(GenericAPIView):
    serializer_class = ChangePasswordSerializer

    @extend_schema(responses=OkSerializer)
    def post(self, request):
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["newPassword"])
        request.user.save(update_fields=["password"])
        return Response({"ok": True})


class MyModulesView(GenericAPIView):
    serializer_class = ModuleSerializer

    @extend_schema(responses=ModuleSerializer(many=True))
    def get(self, request):
        modules = SystemModule.objects.filter(active=True)
        if request.user.role == User.Role.ADMIN:
            modules = modules.annotate(can_access=Value(True, output_field=BooleanField()))
        else:
            modules = modules.filter(
                user_permissions__user=request.user,
                user_permissions__can_access=True,
            ).annotate(can_access=Value(True, output_field=BooleanField()))
        return Response(ModuleSerializer(modules, many=True).data)
