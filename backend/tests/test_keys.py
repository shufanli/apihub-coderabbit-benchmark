"""Tests for API Keys endpoints."""
import json


def test_list_keys_unauthenticated(client):
    resp = client.get("/api/keys")
    assert resp.status_code == 401


def test_list_keys(client, auth_headers):
    resp = client.get("/api/keys", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "keys" in data
    assert len(data["keys"]) == 2  # alice has 2 keys from seed


def test_create_key(client, auth_headers):
    resp = client.post(
        "/api/keys",
        headers=auth_headers,
        json={"name": "New Key", "description": "test", "permissions": ["read", "write"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Key"
    assert "key" in data
    assert data["key"].startswith("ahk_")
    assert len(data["permissions"]) == 2


def test_create_key_empty_name(client, auth_headers):
    resp = client.post(
        "/api/keys",
        headers=auth_headers,
        json={"name": "", "permissions": ["read"]},
    )
    assert resp.status_code == 422


def test_create_key_no_permissions(client, auth_headers):
    resp = client.post(
        "/api/keys",
        headers=auth_headers,
        json={"name": "Test", "permissions": []},
    )
    assert resp.status_code == 422


def test_create_key_invalid_permission(client, auth_headers):
    resp = client.post(
        "/api/keys",
        headers=auth_headers,
        json={"name": "Test", "permissions": ["invalid"]},
    )
    assert resp.status_code == 400


def test_delete_key(client, auth_headers):
    resp = client.delete("/api/keys/key_001", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # Verify deleted
    resp = client.get("/api/keys", headers=auth_headers)
    keys = resp.json()["keys"]
    assert all(k["id"] != "key_001" for k in keys)


def test_delete_key_not_found(client, auth_headers):
    resp = client.delete("/api/keys/nonexistent", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_other_users_key(client, auth_headers):
    # alice trying to delete bob's key
    resp = client.delete("/api/keys/key_003", headers=auth_headers)
    assert resp.status_code == 404


def test_list_keys_free_user(client, free_auth_headers):
    resp = client.get("/api/keys", headers=free_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["keys"]) == 1  # bob has 1 key
