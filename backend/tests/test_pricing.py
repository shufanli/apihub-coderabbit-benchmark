"""Tests for pricing endpoint."""


def test_get_pricing(client):
    resp = client.get("/api/pricing")
    assert resp.status_code == 200
    data = resp.json()
    assert "plans" in data
    assert len(data["plans"]) == 3

    plans = {p["id"]: p for p in data["plans"]}
    assert plans["free"]["monthly_price"] == 0
    assert plans["pro"]["monthly_price"] == 2900
    assert plans["enterprise"]["monthly_price"] == 19900
    assert plans["pro"]["popular"] is True
    assert plans["free"]["popular"] is False


def test_pricing_plan_features(client):
    resp = client.get("/api/pricing")
    plans = {p["id"]: p for p in resp.json()["plans"]}
    assert len(plans["free"]["features"]) >= 3
    assert len(plans["pro"]["features"]) >= 4
    assert len(plans["enterprise"]["features"]) >= 5


def test_pricing_yearly_prices(client):
    resp = client.get("/api/pricing")
    plans = {p["id"]: p for p in resp.json()["plans"]}
    assert plans["pro"]["yearly_price"] < plans["pro"]["monthly_price"] * 12
    assert plans["enterprise"]["yearly_price"] < plans["enterprise"]["monthly_price"] * 12


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
