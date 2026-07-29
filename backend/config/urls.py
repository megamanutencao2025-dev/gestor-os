from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.common.views import HealthView, ReadinessView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", HealthView.as_view(), name="health"),
    path("ready", ReadinessView.as_view(), name="readiness"),
    path("auth/", include("apps.accounts.urls")),
    path("api/", include("apps.accounts.api_urls")),
    path("api/v1/", include("apps.maintenance.urls")),
    path("api/v1/data-transfer/", include("apps.data_transfer.urls")),
    path("", include("apps.legacy_api.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="api-schema"),
        name="api-docs",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
