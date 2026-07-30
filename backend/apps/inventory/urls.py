from django.urls import path

from .views import NfeMaterialConfirmView, NfeMaterialPreviewView

app_name = "inventory"

urlpatterns = [
    path(
        "nfe/preview/",
        NfeMaterialPreviewView.as_view(),
        name="nfe-material-preview",
    ),
    path(
        "nfe/confirm/",
        NfeMaterialConfirmView.as_view(),
        name="nfe-material-confirm",
    ),
]
