from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

from fastapi import HTTPException, Request


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(digest.hex(), digest_hex)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64d(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def sign_token(payload: dict[str, Any], secret: str, ttl_seconds: int = 60 * 60 * 24 * 14) -> str:
    body = dict(payload)
    body["exp"] = int(time.time()) + ttl_seconds
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    content = _b64(json.dumps(body, separators=(",", ":")).encode())
    sig = hmac.new(secret.encode(), f"{header}.{content}".encode(), hashlib.sha256).digest()
    return f"{header}.{content}.{_b64(sig)}"


def read_token(token: str, secret: str) -> dict[str, Any]:
    try:
        header, content, sig = token.split(".")
    except ValueError as exc:
        raise HTTPException(401, "Sign in again.") from exc
    expected = hmac.new(secret.encode(), f"{header}.{content}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(_b64(expected), sig):
        raise HTTPException(401, "Sign in again.")
    payload = json.loads(_b64d(content))
    if int(payload.get("exp", 0)) < time.time():
        raise HTTPException(401, "Your session expired. Sign in again.")
    return payload


def bearer_user_id(request: Request, secret: str) -> str | None:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    payload = read_token(header.split(" ", 1)[1].strip(), secret)
    return str(payload["sub"])


def require_user_id(request: Request, secret: str) -> str:
    user_id = bearer_user_id(request, secret)
    if not user_id:
        raise HTTPException(401, "Sign in to continue.")
    return user_id
