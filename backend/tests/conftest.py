"""Test configuration and fixtures."""
import os
import tempfile

import pytest
from fastapi.testclient import TestClient

# Set test DB before importing app
_test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DB_PATH"] = _test_db.name
os.environ["JWT_SECRET"] = "test_secret"
os.environ["GITHUB_CLIENT_ID"] = "test_client_id"
os.environ["GITHUB_CLIENT_SECRET"] = "test_client_secret"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake"

from app.main import app
from app.database import init_db, get_db
from app.auth import create_token
from app.seed import seed_data


@pytest.fixture(autouse=True)
def reset_db():
    """Reset database for each test."""
    # Drop and recreate
    with get_db() as conn:
        conn.executescript("""
            DROP TABLE IF EXISTS invoices;
            DROP TABLE IF EXISTS usage_logs;
            DROP TABLE IF EXISTS api_keys;
            DROP TABLE IF EXISTS users;
        """)
    init_db()
    seed_data()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Auth headers for the Pro test user."""
    token = create_token("user_pro_001")
    return {"Cookie": f"session_token={token}"}


@pytest.fixture
def free_auth_headers():
    """Auth headers for the Free test user."""
    token = create_token("user_free_002")
    return {"Cookie": f"session_token={token}"}
