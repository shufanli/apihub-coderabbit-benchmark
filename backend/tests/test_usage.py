"""Tests for usage endpoints."""


def test_usage_summary_unauthenticated(client):
    resp = client.get("/api/usage/summary")
    assert resp.status_code == 401


def test_usage_summary(client, auth_headers):
    resp = client.get("/api/usage/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "today_count" in data
    assert "month_count" in data
    assert "month_limit" in data
    assert "plan" in data
    assert data["plan"] == "pro"
    assert data["month_limit"] == 50000


def test_usage_chart_7d(client, auth_headers):
    resp = client.get("/api/usage/chart?range=7d", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["data"]) == 7
    assert data["range"] == "7d"


def test_usage_chart_30d(client, auth_headers):
    resp = client.get("/api/usage/chart?range=30d", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 30


def test_usage_chart_90d(client, auth_headers):
    resp = client.get("/api/usage/chart?range=90d", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 90


def test_usage_chart_invalid_range(client, auth_headers):
    resp = client.get("/api/usage/chart?range=999d", headers=auth_headers)
    assert resp.status_code == 422


def test_usage_logs(client, auth_headers):
    resp = client.get("/api/usage/logs", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "logs" in data
    assert "total" in data
    assert "page" in data
    assert data["per_page"] == 20


def test_usage_logs_pagination(client, auth_headers):
    resp = client.get("/api/usage/logs?page=1", headers=auth_headers)
    data = resp.json()
    assert data["page"] == 1
    assert len(data["logs"]) <= 20


def test_usage_logs_status_filter(client, auth_headers):
    resp = client.get("/api/usage/logs?status=2xx", headers=auth_headers)
    assert resp.status_code == 200
    for log in resp.json()["logs"]:
        assert 200 <= log["status_code"] < 300


def test_usage_logs_search(client, auth_headers):
    resp = client.get("/api/usage/logs?search=translate", headers=auth_headers)
    assert resp.status_code == 200
    for log in resp.json()["logs"]:
        assert "translate" in log["endpoint"]


def test_usage_summary_free_user(client, free_auth_headers):
    resp = client.get("/api/usage/summary", headers=free_auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"] == "free"
    assert data["month_limit"] == 1000
