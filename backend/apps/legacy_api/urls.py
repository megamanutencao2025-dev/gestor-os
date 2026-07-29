from django.urls import path

from .admin_views import (
    AdminModuleListView,
    AdminUserCollectionView,
    AdminUserDetailView,
    AdminUserModulesView,
    AdminUserPasswordView,
    AdminUserStatusView,
    AdminUserTemporaryPasswordView,
    AdminWorkOrderApprovalView,
    AdminWorkOrderSolicitationsView,
)
from .entity_views import (
    LegacyEntityBulkView,
    LegacyEntityCollectionView,
    LegacyEntityDetailView,
)
from .file_views import LegacyFileUploadView
from .integration_views import ExtractUploadedFileView, InvokeLlmView
from .public_views import (
    PublicNotificationView,
    PublicReferenceView,
    PublicWorkOrderView,
)

urlpatterns = [
    path("api/users", AdminUserCollectionView.as_view(), name="legacy-users"),
    path(
        "api/users/<uuid:user_id>",
        AdminUserDetailView.as_view(),
        name="legacy-user-detail",
    ),
    path(
        "api/users/<uuid:user_id>/password",
        AdminUserPasswordView.as_view(),
        name="legacy-user-password",
    ),
    path(
        "api/users/<uuid:user_id>/temporary-password",
        AdminUserTemporaryPasswordView.as_view(),
        name="legacy-user-temporary-password",
    ),
    path(
        "api/users/<uuid:user_id>/status",
        AdminUserStatusView.as_view(),
        name="legacy-user-status",
    ),
    path(
        "api/users/<uuid:user_id>/modules",
        AdminUserModulesView.as_view(),
        name="legacy-user-modules",
    ),
    path("api/modules", AdminModuleListView.as_view(), name="legacy-modules"),
    path(
        "api/ordens-servico/solicitacoes-pendentes",
        AdminWorkOrderSolicitationsView.as_view(),
        name="legacy-pending-work-orders",
    ),
    path(
        "api/ordens-servico/<str:identifier>/aprovacao",
        AdminWorkOrderApprovalView.as_view(),
        name="legacy-work-order-approval",
    ),
    path(
        "api/public/solicitar-os/reference",
        PublicReferenceView.as_view(),
        name="public-work-order-reference",
    ),
    path(
        "api/public/solicitar-os/ordens",
        PublicWorkOrderView.as_view(),
        name="public-work-orders",
    ),
    path(
        "api/public/solicitar-os/notificacoes",
        PublicNotificationView.as_view(),
        name="public-notifications",
    ),
    path("files", LegacyFileUploadView.as_view(), name="legacy-file-upload"),
    path(
        "integrations/extract",
        ExtractUploadedFileView.as_view(),
        name="legacy-extract",
    ),
    path("integrations/llm", InvokeLlmView.as_view(), name="legacy-llm"),
    path(
        "api/<str:route>/bulk",
        LegacyEntityBulkView.as_view(),
        name="legacy-entity-bulk",
    ),
    path(
        "api/<str:route>/<str:identifier>",
        LegacyEntityDetailView.as_view(),
        name="legacy-entity-detail",
    ),
    path(
        "api/<str:route>",
        LegacyEntityCollectionView.as_view(),
        name="legacy-entity-collection",
    ),
]
