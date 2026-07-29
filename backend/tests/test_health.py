import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_and_readiness_endpoints():
    client = APIClient()

    health = client.get(reverse("health"))
    readiness = client.get(reverse("readiness"))

    assert health.status_code == 200
    assert health.json() == {"ok": True, "service": "MaintenancePro API v2"}
    assert readiness.status_code == 200
    assert readiness.json() == {"ok": True, "database": "available"}
