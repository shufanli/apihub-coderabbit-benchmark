"""Seed test data on startup."""
import json
import uuid
import random
from datetime import datetime, timedelta
from hashlib import sha256

from app.database import get_db


def hash_key(key: str) -> str:
    return sha256(key.encode()).hexdigest()


def seed_data():
    with get_db() as conn:
        existing = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if existing > 0:
            return

        # Users
        users = [
            {
                "id": "user_pro_001",
                "github_id": 10001,
                "username": "alice-dev",
                "email": "alice@example.com",
                "avatar_url": "https://avatars.githubusercontent.com/u/10001",
                "plan": "pro",
                "stripe_customer_id": "cus_demo_alice",
            },
            {
                "id": "user_free_002",
                "github_id": 10002,
                "username": "bob-coder",
                "email": "bob@example.com",
                "avatar_url": "https://avatars.githubusercontent.com/u/10002",
                "plan": "free",
                "stripe_customer_id": None,
            },
        ]
        for u in users:
            conn.execute(
                "INSERT INTO users (id, github_id, username, email, avatar_url, plan, stripe_customer_id) VALUES (?,?,?,?,?,?,?)",
                (u["id"], u["github_id"], u["username"], u["email"], u["avatar_url"], u["plan"], u["stripe_customer_id"]),
            )

        # API Keys
        keys = [
            ("key_001", "user_pro_001", "Production Key", "Main production API key", "ahk_prod_1234", '["read","write","admin"]'),
            ("key_002", "user_pro_001", "Staging Key", "For staging env", "ahk_stag_5678", '["read","write"]'),
            ("key_003", "user_free_002", "Test Key", "Testing only", "ahk_test_9012", '["read"]'),
        ]
        for kid, uid, name, desc, prefix, perms in keys:
            conn.execute(
                "INSERT INTO api_keys (id, user_id, name, description, key_hash, key_prefix, permissions) VALUES (?,?,?,?,?,?,?)",
                (kid, uid, name, desc, hash_key(prefix + "_full_key"), prefix, perms),
            )

        # Usage logs - 90 days, ~120 records
        endpoints = ["/api/v1/translate", "/api/v1/summarize", "/api/v1/classify", "/api/v1/embed", "/api/v1/generate"]
        statuses = [200, 200, 200, 200, 200, 200, 200, 201, 400, 401, 404, 500]
        now = datetime.utcnow()

        for i in range(120):
            days_ago = random.randint(0, 89)
            hours = random.randint(0, 23)
            minutes = random.randint(0, 59)
            ts = now - timedelta(days=days_ago, hours=hours, minutes=minutes)
            user_id = random.choice(["user_pro_001", "user_free_002"])
            conn.execute(
                "INSERT INTO usage_logs (user_id, endpoint, status_code, latency_ms, created_at) VALUES (?,?,?,?,?)",
                (
                    user_id,
                    random.choice(endpoints),
                    random.choice(statuses),
                    random.randint(12, 850),
                    ts.strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )

        # Invoices - 12 months
        for i in range(12):
            month_date = now - timedelta(days=30 * (11 - i))
            for uid, amount in [("user_pro_001", 2900)]:
                conn.execute(
                    "INSERT INTO invoices (id, user_id, amount_cents, status, pdf_url, created_at) VALUES (?,?,?,?,?,?)",
                    (
                        f"inv_{uuid.uuid4().hex[:12]}",
                        uid,
                        amount,
                        random.choice(["paid", "paid", "paid", "pending"]) if i == 11 else "paid",
                        f"https://stripe.com/invoices/demo_{i}.pdf",
                        month_date.strftime("%Y-%m-%d %H:%M:%S"),
                    ),
                )
