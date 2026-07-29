from django.urls import path

from .views import MyModulesView

urlpatterns = [
    path("me/modules", MyModulesView.as_view(), name="my-modules"),
]
