import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "apihub.db"))


def get_db_path():
    return DB_PATH


@contextmanager
def get_db():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                github_id INTEGER UNIQUE NOT NULL,
                username TEXT NOT NULL,
                email TEXT,
                avatar_url TEXT,
                plan TEXT NOT NULL DEFAULT 'free',
                stripe_customer_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                description TEXT,
                key_hash TEXT NOT NULL,
                key_prefix TEXT NOT NULL,
                permissions TEXT NOT NULL DEFAULT '["read"]',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_used_at TEXT
            );

            CREATE TABLE IF NOT EXISTS usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                endpoint TEXT NOT NULL,
                status_code INTEGER NOT NULL,
                latency_ms INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_usage_logs_user_date
                ON usage_logs(user_id, created_at);

            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount_cents INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'paid',
                pdf_url TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
