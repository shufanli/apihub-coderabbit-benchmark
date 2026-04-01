"""Tests for billing endpoints."""


def test_current_plan_unauthenticated(client):
    resp = client.get("/api/billing/current")
    assert resp.status_code == 401


def test_current_plan(client, auth_headers):
    resp = client.get("/api/billing/current", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"] == "pro"
    assert data["price_cents"] == 2900
    assert data["limit"] == 50000


def test_current_plan_free_user(client, free_auth_headers):
    resp = client.get("/api/billing/current", headers=free_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"] == "free"
    assert data["price_cents"] == 0


def test_downgrade_pro_to_free(client, auth_headers):
    resp = client.post(
        "/api/billing/downgrade",
        headers=auth_headers,
        json={"plan": "free"},
    )
    assert resp.status_code == 200
    assert resp.json()["new_plan"] == "free"

    # Verify plan changed
    resp = client.get("/api/billing/current", headers=auth_headers)
    assert resp.json()["plan"] == "free"


def test_downgrade_invalid_upgrade(client, free_auth_headers):
    resp = client.post(
        "/api/billing/downgrade",
        headers=free_auth_headers,
        json={"plan": "pro"},
    )
    assert resp.status_code == 400


def test_downgrade_invalid_plan(client, auth_headers):
    resp = client.post(
        "/api/billing/downgrade",
        headers=auth_headers,
        json={"plan": "invalid"},
    )
    assert resp.status_code == 400


def test_invoices_unauthenticated(client):
    resp = client.get("/api/billing/invoices")
    assert resp.status_code == 401


def test_invoices(client, auth_headers):
    resp = client.get("/api/billing/invoices", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "invoices" in data
    assert "total" in data
    assert data["per_page"] == 10
    assert len(data["invoices"]) <= 10


def test_invoices_pagination(client, auth_headers):
    resp = client.get("/api/billing/invoices?page=2", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 2


def test_invoices_free_user(client, free_auth_headers):
    resp = client.get("/api/billing/invoices", headers=free_auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


def test_checkout_invalid_plan(client, auth_headers):
    resp = client.post(
        "/api/billing/checkout",
        headers=auth_headers,
        json={"plan": "invalid"},
    )
    assert resp.status_code == 400


def test_webhook_invalid_signature(client):
    resp = client.post(
        "/api/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "invalid"},
    )
    assert resp.status_code == 400
