from django.urls import path

from .views import ChangePasswordView, LoginView, LogoutView, MeView, RefreshView

urlpatterns = [
    path("login", LoginView.as_view(), name="login"),
    path("me", MeView.as_view(), name="me"),
    path("refresh", RefreshView.as_view(), name="refresh"),
    path("logout", LogoutView.as_view(), name="logout"),
    path("change-password", ChangePasswordView.as_view(), name="change-password"),
]
