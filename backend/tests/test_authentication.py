import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_login_me_and_modules_contract():
    user = get_user_model().objects.create_user(
        username="admin",
        email="admin@example.com",
        password="a-secure-test-password",
        role="admin",
    )
    client = APIClient()

    login = client.post(
        "/auth/login",
        {"username": "admin", "password": "a-secure-test-password"},
        format="json",
    )

    assert login.status_code == 200
    assert login.json()["user"]["id"] == str(user.id)
    assert login.json()["user"]["role"] == "admin"
    assert login.json()["accessToken"]
    assert login.json()["refreshToken"]

    refresh = client.post(
        "/auth/refresh",
        {"refreshToken": login.json()["refreshToken"]},
        format="json",
    )
    assert refresh.status_code == 200
    assert refresh.json()["accessToken"]
    assert refresh.json()["refreshToken"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['accessToken']}")
    me = client.get("/auth/me")
    modules = client.get("/api/me/modules")

    assert me.status_code == 200
    assert me.json()["username"] == "admin"
    assert modules.status_code == 200
    assert modules.json()
    assert all(module["canAccess"] is True for module in modules.json())


@pytest.mark.django_db
def test_public_registration_is_not_available():
    response = APIClient().post(
        "/auth/register",
        {"username": "unexpected", "password": "password"},
        format="json",
    )

    assert response.status_code == 404
