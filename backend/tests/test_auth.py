"""Tests for authentication endpoints."""


def test_me_unauthenticated(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"] is None


def test_me_authenticated(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"] is not None
    assert data["user"]["username"] == "alice-dev"
    assert data["user"]["plan"] == "pro"


def test_me_invalid_token(client):
    resp = client.get("/api/auth/me", headers={"Cookie": "session_token=invalid_token"})
    assert resp.status_code == 200
    assert resp.json()["user"] is None


def test_logout(client, auth_headers):
    resp = client.post("/api/auth/logout", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_login_redirect(client):
    resp = client.get("/api/auth/login", follow_redirects=False)
    assert resp.status_code == 307
    assert "github.com/login/oauth/authorize" in resp.headers["location"]


def test_callback_missing_code(client):
    resp = client.get("/api/auth/callback")
    assert resp.status_code == 400
