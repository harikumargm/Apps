"""SQLite by default, PostgreSQL when DATABASE_URL starts with postgres."""

from __future__ import annotations

import json
import sqlite3
import threading
from typing import Any

from app.settings import Settings


class Database:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.kind = "postgres" if settings.db_url.startswith("postgres") else "sqlite"
        self._lock = threading.Lock()
        if self.kind == "sqlite":
            path = settings.db_url.removeprefix("sqlite:///")
            if path != ":memory:":
                from pathlib import Path

                Path(path).parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        else:
            import psycopg
            from psycopg.rows import dict_row

            self._pg = psycopg.connect(settings.db_url, row_factory=dict_row)

    def _sql(self, sql: str) -> str:
        if self.kind == "sqlite":
            return sql.replace("%s", "?")
        return sql

    def execute(self, sql: str, params: tuple = ()) -> None:
        with self._lock:
            if self.kind == "sqlite":
                self._conn.execute(self._sql(sql), params)
                self._conn.commit()
            else:
                self._pg.execute(self._sql(sql), params)
                self._pg.commit()

    def query(self, sql: str, params: tuple = ()) -> list[dict[str, Any]]:
        with self._lock:
            if self.kind == "sqlite":
                rows = self._conn.execute(self._sql(sql), params).fetchall()
                return [dict(row) for row in rows]
            cur = self._pg.execute(self._sql(sql), params)
            return list(cur.fetchall())

    def query_one(self, sql: str, params: tuple = ()) -> dict[str, Any] | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None

    def migrate(self) -> None:
        statements = [
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                phone TEXT,
                name TEXT,
                password_hash TEXT,
                oauth_provider TEXT,
                measurements TEXT NOT NULL DEFAULT '{}',
                consent_training INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS carts (
                session_id TEXT PRIMARY KEY,
                user_id TEXT,
                items TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                session_id TEXT,
                email TEXT,
                items TEXT NOT NULL,
                subtotal INTEGER NOT NULL,
                shipping INTEGER NOT NULL,
                total INTEGER NOT NULL,
                currency TEXT NOT NULL,
                status TEXT NOT NULL,
                payment_method TEXT NOT NULL,
                payment_ref TEXT,
                payment_payload TEXT,
                address TEXT NOT NULL,
                timeline TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS stock (
                sku TEXT PRIMARY KEY,
                qty INTEGER NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS profile_media (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                session_id TEXT,
                path TEXT NOT NULL,
                purpose TEXT NOT NULL,
                consent_training INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS otp_codes (
                phone TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                expires_at REAL NOT NULL
            )
            """,
        ]
        for statement in statements:
            self.execute(statement)

    def close(self) -> None:
        if self.kind == "sqlite":
            self._conn.close()
        else:
            self._pg.close()


def dumps(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"))


def loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    return json.loads(value)
