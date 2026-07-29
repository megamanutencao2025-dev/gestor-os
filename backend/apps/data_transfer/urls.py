from django.urls import path

from .views import CsvExportView, CsvImportView

app_name = "data-transfer"

urlpatterns = [
    path(
        "export/<str:entity_name>/",
        CsvExportView.as_view(),
        name="export-csv",
    ),
    path(
        "import/<str:entity_name>/",
        CsvImportView.as_view(),
        name="import-csv",
    ),
]
