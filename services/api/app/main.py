"""Sutra API gateway.

Commerce, profiles, and the two vision features share one FastAPI process
in local development. Set VISION_URL to split fabric analysis and trial
view onto the vision service.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.catalog import filter_products, get_product, merge_cart, shipping_rules, suggest_size
from app.db import Database, dumps, loads
from app.payments import create_intent
from app.security import bearer_user_id, hash_password, require_user_id, sign_token, verify_password
from app.settings import Settings
from app.vision_client import analyze as vision_analyze
from app.vision_client import tryon as vision_tryon
from sutra_vision.fabric import EngineNotMounted as FabricMissing
from sutra_vision.privacy import InferenceScratch
from sutra_vision.tryon import EngineNotMounted as TryOnMissing

DEMO_EMAIL = "mira@sutra.test"
DEMO_PASSWORD = "loom-and-line"
DEMO_PHONE = "+919800000000"
DEMO_OTP = "240126"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str
    password: str = Field(min_length=8, max_length=200)
    phone: str | None = None


class LoginIn(BaseModel):
    email: str
    password: str


class OtpRequest(BaseModel):
    phone: str


class OtpVerify(BaseModel):
    phone: str
    code: str


class GoogleIn(BaseModel):
    id_token: str


class AppleIn(BaseModel):
    id_token: str


class MeasurementsIn(BaseModel):
    height_cm: float = Field(ge=80, le=230)
    chest_cm: float = Field(ge=40, le=160)
    waist_cm: float = Field(ge=40, le=160)
    hips_cm: float = Field(ge=40, le=180)
    preferred_fit: str = "regular"
    size: str | None = None


class CartItemIn(BaseModel):
    product_id: str
    size: str
    color: str
    qty: int = Field(ge=1, le=8)


class CartIn(BaseModel):
    items: list[CartItemIn]


class AddressIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: str
    line1: str
    city: str
    region: str
    postal_code: str


class CheckoutIn(BaseModel):
    email: str
    method: str
    address: AddressIn
    items: list[CartItemIn] | None = None


class ConfirmIn(BaseModel):
    reference: str | None = None


class TwinIn(BaseModel):
    product_slug: str
    color: str | None = None
    height_cm: float = Field(ge=90, le=220)
    chest_cm: float = Field(ge=40, le=160)
    waist_cm: float = Field(ge=40, le=160)
    hips_cm: float = Field(ge=40, le=180)
    consent: bool
    consent_training: bool = False
    save_to_profile: bool = False


class TrackingIn(BaseModel):
    status: str


class Hub:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.db = Database(settings)
        self.db.migrate()
        self.scratch = InferenceScratch(settings.inference_tmp)
        self.redis = _redis(settings.redis_url)
        settings.media_dir.mkdir(parents=True, exist_ok=True)
        self._seed()

    def _seed(self) -> None:
        for product in filter_products(self.settings.catalog_path)["items"]:
            for size, qty in product["inventory"].items():
                sku = f"{product['id']}|{size}"
                self.db.execute(
                    "INSERT INTO stock (sku, qty) VALUES (%s, %s) ON CONFLICT (sku) DO NOTHING",
                    (sku, int(qty)),
                )
        if not self.db.query_one("SELECT id FROM users WHERE email = %s", (DEMO_EMAIL,)):
            self.db.execute(
                """
                INSERT INTO users (id, email, phone, name, password_hash, oauth_provider, measurements, consent_training, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    "user_mira",
                    DEMO_EMAIL,
                    DEMO_PHONE,
                    "Mira Sen",
                    hash_password(DEMO_PASSWORD),
                    None,
                    dumps({"height_cm": 168, "chest_cm": 88, "waist_cm": 72, "hips_cm": 96, "preferred_fit": "regular", "size": "M"}),
                    0,
                    now_iso(),
                ),
            )

    def session_id(self, request: Request) -> str:
        sid = request.headers.get("x-session-id") or request.query_params.get("session_id")
        if not sid or len(sid) > 80:
            raise HTTPException(400, "Send an X-Session-Id.")
        return sid

    def public_user(self, row: dict) -> dict:
        return {
            "id": row["id"],
            "email": row["email"],
            "phone": row["phone"],
            "name": row["name"],
            "oauth_provider": row["oauth_provider"],
            "measurements": loads(row["measurements"], {}),
            "consent_training": bool(row["consent_training"]),
        }

    def issue(self, user_id: str) -> str:
        return sign_token({"sub": user_id}, self.settings.secret)

    def user_by_id(self, user_id: str) -> dict:
        row = self.db.query_one("SELECT * FROM users WHERE id = %s", (user_id,))
        if not row:
            raise HTTPException(401, "Sign in again.")
        return row

    def optional_user(self, request: Request) -> dict | None:
        user_id = bearer_user_id(request, self.settings.secret)
        if not user_id:
            return None
        return self.user_by_id(user_id)

    def stock_map(self, product_id: str) -> dict[str, int]:
        rows = self.db.query("SELECT sku, qty FROM stock WHERE sku LIKE %s", (f"{product_id}|%",))
        return {row["sku"].split("|", 1)[1]: int(row["qty"]) for row in rows}

    def enrich_cart(self, items: list[dict]) -> dict:
        lines = []
        subtotal = 0
        for item in items:
            product = get_product(self.settings.catalog_path, item["product_id"])
            if not product:
                continue
            qty = max(1, min(8, int(item["qty"])))
            line_total = product["price"] * qty
            subtotal += line_total
            lines.append(
                {
                    "product_id": product["id"],
                    "slug": product["slug"],
                    "name": product["name"],
                    "size": item["size"],
                    "color": item["color"],
                    "hex": _color_hex(product, item["color"]),
                    "silhouette": product["silhouette"],
                    "qty": qty,
                    "unit_price": product["price"],
                    "line_total": line_total,
                }
            )
        free_above, fee = shipping_rules(self.settings.catalog_path)
        shipping = 0 if subtotal >= free_above or subtotal == 0 else fee
        return {
            "items": lines,
            "subtotal": subtotal,
            "shipping": shipping,
            "total": subtotal + shipping,
            "currency": "INR",
            "free_shipping_above": free_above,
        }

    def read_cart(self, session_id: str) -> dict:
        cached = _cache_get(self.redis, f"cart:{session_id}")
        if cached:
            payload = json.loads(cached)
        else:
            row = self.db.query_one("SELECT * FROM carts WHERE session_id = %s", (session_id,))
            if not row:
                payload = {"items": [], "version": 0, "updated_at": now_iso()}
            else:
                payload = {
                    "items": loads(row["items"], []),
                    "version": int(row["version"]),
                    "updated_at": row["updated_at"],
                }
            _cache_set(self.redis, f"cart:{session_id}", json.dumps(payload))
        view = self.enrich_cart(payload["items"])
        view["version"] = payload["version"]
        view["updated_at"] = payload["updated_at"]
        view["session_id"] = session_id
        return view

    def write_cart(self, session_id: str, items: list[dict], user_id: str | None) -> dict:
        raw = [item.model_dump() if isinstance(item, CartItemIn) else item for item in items]
        for item in raw:
            product = get_product(self.settings.catalog_path, item["product_id"])
            if not product:
                raise HTTPException(400, "One of the pieces is no longer in the edit.")
            if item["size"] not in product["sizes"]:
                raise HTTPException(400, f"{product['name']} is not cut in size {item['size']}.")
        current = self.db.query_one("SELECT version FROM carts WHERE session_id = %s", (session_id,))
        version = (int(current["version"]) if current else 0) + 1
        stamp = now_iso()
        stored = dumps(raw)
        if current:
            self.db.execute(
                "UPDATE carts SET items = %s, version = %s, updated_at = %s, user_id = %s WHERE session_id = %s",
                (stored, version, stamp, user_id, session_id),
            )
        else:
            self.db.execute(
                "INSERT INTO carts (session_id, user_id, items, version, updated_at) VALUES (%s, %s, %s, %s, %s)",
                (session_id, user_id, stored, version, stamp),
            )
        _cache_set(
            self.redis,
            f"cart:{session_id}",
            json.dumps({"items": raw, "version": version, "updated_at": stamp}),
        )
        return self.read_cart(session_id)

    def attach_cart(self, session_id: str, user_id: str) -> None:
        row = self.db.query_one("SELECT * FROM carts WHERE session_id = %s", (session_id,))
        others = self.db.query(
            "SELECT * FROM carts WHERE user_id = %s AND session_id != %s",
            (user_id, session_id),
        )
        base = loads(row["items"], []) if row else []
        for other in others:
            base = merge_cart(base, loads(other["items"], []))
        self.write_cart(session_id, base, user_id)


def _redis(url: str):
    if not url:
        return None
    try:
        import redis

        client = redis.Redis.from_url(url, socket_timeout=0.4)
        client.ping()
        return client
    except Exception:
        return None


def _cache_get(client, key: str) -> str | None:
    if not client:
        return None
    try:
        value = client.get(key)
        return value.decode() if value else None
    except Exception:
        return None


def _cache_set(client, key: str, value: str) -> None:
    if not client:
        return
    try:
        client.setex(key, 60 * 30, value)
    except Exception:
        return


def _color_hex(product: dict, name: str) -> str:
    for color in product["colors"]:
        if color["name"].lower() == name.lower():
            return color["hex"]
    return product["colors"][0]["hex"]


def _valid_email(value: str) -> bool:
    parts = value.split("@")
    return len(parts) == 2 and "." in parts[1] and " " not in value and len(value) < 200


def _valid_phone(value: str) -> bool:
    digits = value.replace("+", "").replace(" ", "")
    return digits.isdigit() and 8 <= len(digits) <= 15


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.load()
    hub = Hub(settings)
    app = FastAPI(
        title="Sutra",
        version="1.0.0",
        summary="Readymade clothing commerce, fabric reading, and trial view.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.hub = hub

    @app.get("/health")
    def health() -> dict:
        purged = hub.scratch.purge()
        return {
            "status": "ok",
            "db": hub.db.kind,
            "vision": "remote" if settings.vision_url else "in-process",
            "redis": bool(hub.redis),
            "inference_purged": purged,
        }

    @app.post("/v1/auth/register")
    def register(body: RegisterIn) -> dict:
        if not _valid_email(body.email):
            raise HTTPException(400, "Enter a valid email.")
        if body.phone and not _valid_phone(body.phone):
            raise HTTPException(400, "Enter a phone number with country code.")
        if hub.db.query_one("SELECT id FROM users WHERE email = %s", (body.email.lower(),)):
            raise HTTPException(409, "An account already uses that email.")
        user_id = "user_" + uuid.uuid4().hex[:12]
        hub.db.execute(
            """
            INSERT INTO users (id, email, phone, name, password_hash, oauth_provider, measurements, consent_training, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (user_id, body.email.lower(), body.phone, body.name.strip(), hash_password(body.password), None, "{}", 0, now_iso()),
        )
        return {"token": hub.issue(user_id), "user": hub.public_user(hub.user_by_id(user_id))}

    @app.post("/v1/auth/login")
    def login(body: LoginIn, request: Request) -> dict:
        row = hub.db.query_one("SELECT * FROM users WHERE email = %s", (body.email.lower(),))
        if not row or not row["password_hash"] or not verify_password(body.password, row["password_hash"]):
            raise HTTPException(401, "Email or password is incorrect.")
        sid = request.headers.get("x-session-id")
        if sid:
            hub.attach_cart(sid, row["id"])
        return {"token": hub.issue(row["id"]), "user": hub.public_user(row)}

    @app.post("/v1/auth/otp/request")
    def otp_request(body: OtpRequest) -> dict:
        if not _valid_phone(body.phone):
            raise HTTPException(400, "Enter a phone number with country code.")
        phone = body.phone.replace(" ", "")
        if settings.demo and phone == DEMO_PHONE:
            code = DEMO_OTP
        else:
            code = f"{secrets.randbelow(1000000):06d}"
        hub.db.execute(
            """
            INSERT INTO otp_codes (phone, code, expires_at) VALUES (%s, %s, %s)
            ON CONFLICT (phone) DO UPDATE SET code = %s, expires_at = %s
            """,
            (phone, code, time.time() + 600, code, time.time() + 600),
        )
        payload: dict[str, Any] = {
            "sent": True,
            "sms": "console" if settings.demo else "provider",
            "detail": "A sign-in code was issued.",
        }
        if settings.demo:
            payload["demo_code"] = code
            payload["detail"] = "Demo mode has no SMS provider, so the code is returned with the response."
        return payload

    @app.post("/v1/auth/otp/verify")
    def otp_verify(body: OtpVerify, request: Request) -> dict:
        phone = body.phone.replace(" ", "")
        row = hub.db.query_one("SELECT * FROM otp_codes WHERE phone = %s", (phone,))
        if not row or row["code"] != body.code or float(row["expires_at"]) < time.time():
            raise HTTPException(401, "That code is not valid.")
        hub.db.execute("DELETE FROM otp_codes WHERE phone = %s", (phone,))
        user = hub.db.query_one("SELECT * FROM users WHERE phone = %s", (phone,))
        if not user:
            user_id = "user_" + uuid.uuid4().hex[:12]
            hub.db.execute(
                """
                INSERT INTO users (id, email, phone, name, password_hash, oauth_provider, measurements, consent_training, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, None, phone, "Sutra customer", None, None, "{}", 0, now_iso()),
            )
            user = hub.user_by_id(user_id)
        sid = request.headers.get("x-session-id")
        if sid:
            hub.attach_cart(sid, user["id"])
        return {"token": hub.issue(user["id"]), "user": hub.public_user(user)}

    @app.post("/v1/auth/oauth/google")
    def google(body: GoogleIn, request: Request) -> dict:
        if not settings.google_client_id:
            raise HTTPException(501, "Set GOOGLE_CLIENT_ID before accepting Google sign-in.")
        response = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.id_token},
            timeout=10,
        )
        if response.status_code != 200:
            raise HTTPException(401, "Google rejected that token.")
        data = response.json()
        if data.get("aud") != settings.google_client_id:
            raise HTTPException(401, "Google token was issued for a different app.")
        email = data.get("email")
        if not email:
            raise HTTPException(400, "Google account has no email.")
        return _oauth_login(hub, request, email=email.lower(), name=data.get("name") or email, provider="google")

    @app.post("/v1/auth/oauth/apple")
    def apple(body: AppleIn, request: Request) -> dict:
        if not settings.apple_client_id:
            raise HTTPException(501, "Set APPLE_CLIENT_ID before accepting Apple sign-in.")
        profile = _verify_apple(body.id_token, settings.apple_client_id)
        return _oauth_login(hub, request, email=profile["email"], name=profile["name"], provider="apple")

    @app.get("/v1/me")
    def me(request: Request) -> dict:
        user_id = require_user_id(request, settings.secret)
        return hub.public_user(hub.user_by_id(user_id))

    @app.patch("/v1/me/measurements")
    def measurements(body: MeasurementsIn, request: Request) -> dict:
        user_id = require_user_id(request, settings.secret)
        hub.db.execute(
            "UPDATE users SET measurements = %s WHERE id = %s",
            (dumps(body.model_dump()), user_id),
        )
        return hub.public_user(hub.user_by_id(user_id))

    @app.delete("/v1/me")
    def delete_me(request: Request) -> dict:
        user_id = require_user_id(request, settings.secret)
        media = hub.db.query("SELECT path FROM profile_media WHERE user_id = %s", (user_id,))
        for row in media:
            Path(row["path"]).unlink(missing_ok=True)
        hub.db.execute("DELETE FROM profile_media WHERE user_id = %s", (user_id,))
        hub.db.execute(
            "UPDATE orders SET email = %s, user_id = NULL, address = %s WHERE user_id = %s",
            ("erased@sutra.invalid", dumps({"erased": True}), user_id),
        )
        hub.db.execute("DELETE FROM users WHERE id = %s", (user_id,))
        return {"deleted": True}

    @app.get("/v1/products")
    def list_products(
        audience: str | None = None,
        occasion: str | None = None,
        fabric: str | None = None,
        size: str | None = None,
        color: str | None = None,
        min_price: int | None = None,
        max_price: int | None = None,
        q: str | None = None,
        sort: str = "featured",
    ) -> dict:
        result = filter_products(
            settings.catalog_path,
            audience=audience,
            occasion=occasion,
            fabric=_split(fabric),
            size=_split(size),
            color=_split(color),
            min_price=min_price,
            max_price=max_price,
            q=q,
            sort=sort,
        )
        result["items"] = [{**product, "stock": hub.stock_map(product["id"])} for product in result["items"]]
        return result

    @app.get("/v1/products/{slug}")
    def product_detail(slug: str, request: Request) -> dict:
        product = get_product(settings.catalog_path, slug)
        if not product:
            raise HTTPException(404, "That piece is not in the edit.")
        body = dict(product)
        body["stock"] = hub.stock_map(product["id"])
        user = hub.optional_user(request)
        measurements_doc = loads(user["measurements"], {}) if user else None
        body["suggested_size"] = suggest_size(product, measurements_doc)
        related = [
            item
            for item in filter_products(settings.catalog_path, audience=product["audience"])["items"]
            if item["id"] != product["id"]
        ][:4]
        body["related"] = related
        return body

    @app.get("/v1/cart")
    def get_cart(request: Request) -> dict:
        return hub.read_cart(hub.session_id(request))

    @app.put("/v1/cart")
    def put_cart(body: CartIn, request: Request) -> dict:
        user = hub.optional_user(request)
        return hub.write_cart(hub.session_id(request), [item.model_dump() for item in body.items], user["id"] if user else None)

    @app.get("/v1/cart/stream")
    async def cart_stream(request: Request) -> StreamingResponse:
        session_id = hub.session_id(request)

        async def gen():
            last = None
            while True:
                if await request.is_disconnected():
                    break
                payload = json.dumps(hub.read_cart(session_id), separators=(",", ":"))
                if payload != last:
                    yield f"data: {payload}\n\n"
                    last = payload
                await asyncio.sleep(1)

        return StreamingResponse(gen(), media_type="text/event-stream")

    @app.post("/v1/checkout")
    def checkout(body: CheckoutIn, request: Request) -> dict:
        if body.method not in {"stripe", "razorpay", "upi"}:
            raise HTTPException(400, "Choose stripe, razorpay, or upi.")
        if not _valid_email(body.email):
            raise HTTPException(400, "Enter a valid email.")
        session_id = hub.session_id(request)
        user = hub.optional_user(request)
        raw_items = [item.model_dump() for item in body.items] if body.items else None
        cart = hub.read_cart(session_id)
        if raw_items is not None:
            cart = hub.write_cart(session_id, raw_items, user["id"] if user else None)
        if not cart["items"]:
            raise HTTPException(400, "Your bag is empty.")
        order_id = "ord_" + uuid.uuid4().hex[:10]
        try:
            intent = create_intent(body.method, cart["total"], order_id)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        timeline = [
            {"status": "placed", "at": now_iso(), "label": "Order placed"},
            {"status": "payment_pending", "at": now_iso(), "label": "Waiting for payment"},
        ]
        hub.db.execute(
            """
            INSERT INTO orders (
                id, user_id, session_id, email, items, subtotal, shipping, total, currency,
                status, payment_method, payment_ref, payment_payload, address, timeline, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                order_id,
                user["id"] if user else None,
                session_id,
                body.email.lower(),
                dumps(cart["items"]),
                cart["subtotal"],
                cart["shipping"],
                cart["total"],
                "INR",
                "payment_pending",
                body.method,
                intent.reference,
                dumps(intent.payload),
                dumps(body.address.model_dump()),
                dumps(timeline),
                now_iso(),
            ),
        )
        return {"order": _public_order(hub, order_id), "payment": intent.payload}

    @app.post("/v1/orders/{order_id}/confirm")
    def confirm(order_id: str, body: ConfirmIn, request: Request) -> dict:
        order = _owned_order(hub, request, order_id)
        if order["status"] != "payment_pending":
            return {"order": _shape_order(order)}
        items = loads(order["items"], [])
        for item in items:
            sku = f"{item['product_id']}|{item['size']}"
            row = hub.db.query_one("SELECT qty FROM stock WHERE sku = %s", (sku,))
            available = int(row["qty"]) if row else 0
            if available < item["qty"]:
                raise HTTPException(409, f"Only {available} left in {item['size']} for {item['name']}.")
        for item in items:
            sku = f"{item['product_id']}|{item['size']}"
            hub.db.execute("UPDATE stock SET qty = qty - %s WHERE sku = %s", (item["qty"], sku))
            _cache_set(hub.redis, f"stock:{sku}", "")
        timeline = loads(order["timeline"], [])
        timeline.append({"status": "paid", "at": now_iso(), "label": "Payment confirmed"})
        timeline.append({"status": "confirmed", "at": now_iso(), "label": "With the studio"})
        hub.db.execute(
            "UPDATE orders SET status = %s, timeline = %s, payment_ref = %s WHERE id = %s",
            ("confirmed", dumps(timeline), body.reference or order["payment_ref"], order_id),
        )
        hub.write_cart(order["session_id"], [], order["user_id"])
        return {"order": _public_order(hub, order_id)}

    @app.get("/v1/orders/{order_id}")
    def get_order(order_id: str, request: Request) -> dict:
        return {"order": _shape_order(_owned_order(hub, request, order_id))}

    @app.get("/v1/orders")
    def list_orders(request: Request) -> dict:
        user_id = require_user_id(request, settings.secret)
        rows = hub.db.query("SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        return {"orders": [_shape_order(row) for row in rows]}

    @app.post("/v1/orders/{order_id}/tracking")
    def tracking(order_id: str, body: TrackingIn, request: Request) -> dict:
        token = request.headers.get("x-admin-token", "")
        if not settings.demo and token != settings.admin_token:
            raise HTTPException(404, "Not found")
        if settings.demo and token != settings.admin_token:
            raise HTTPException(401, "Admin token required.")
        allowed = {"packed", "shipped", "delivered"}
        if body.status not in allowed:
            raise HTTPException(400, "Status must be packed, shipped, or delivered.")
        row = hub.db.query_one("SELECT * FROM orders WHERE id = %s", (order_id,))
        if not row:
            raise HTTPException(404, "Order not found.")
        labels = {"packed": "Packed in the studio", "shipped": "Handed to the courier", "delivered": "Delivered"}
        timeline = loads(row["timeline"], [])
        timeline.append({"status": body.status, "at": now_iso(), "label": labels[body.status]})
        hub.db.execute(
            "UPDATE orders SET status = %s, timeline = %s WHERE id = %s",
            (body.status, dumps(timeline), order_id),
        )
        return {"order": _public_order(hub, order_id)}

    @app.post("/v1/fabric/analyze")
    async def analyze(file: UploadFile = File(...)) -> dict:
        hub.scratch.purge()
        data = await file.read()
        if not data:
            raise HTTPException(400, "Upload a cloth photograph or label close-up.")
        spilled = hub.scratch.spill(data, ".img")
        try:
            reading = vision_analyze(settings, data)
        except FabricMissing as exc:
            raise HTTPException(503, str(exc)) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(502, "The fabric service did not answer.") from exc
        finally:
            hub.scratch.release(spilled)
        return {"reading": reading, "privacy": {"inference_retained": False, "purge_within_hours": 24}}

    @app.post("/v1/tryon/twin")
    def tryon_twin(body: TwinIn, request: Request) -> dict:
        if not body.consent:
            raise HTTPException(400, "Body imagery needs explicit consent before processing.")
        product = get_product(settings.catalog_path, body.product_slug)
        if not product:
            raise HTTPException(404, "That piece is not in the edit.")
        color = body.color or product["colors"][0]["name"]
        return _run_tryon(
            hub,
            request,
            product=product,
            color=color,
            measurements={
                "height_cm": body.height_cm,
                "chest_cm": body.chest_cm,
                "waist_cm": body.waist_cm,
                "hips_cm": body.hips_cm,
            },
            photo=None,
            consent_training=body.consent_training,
            save_to_profile=body.save_to_profile,
        )

    @app.post("/v1/tryon/photo")
    async def tryon_photo(
        request: Request,
        photo: UploadFile = File(...),
        product_slug: str = Form(...),
        consent: bool = Form(False),
        consent_training: bool = Form(False),
        save_to_profile: bool = Form(False),
        color: str | None = Form(None),
        height_cm: float = Form(168),
        chest_cm: float = Form(92),
        waist_cm: float = Form(76),
        hips_cm: float = Form(98),
    ) -> dict:
        if not consent:
            raise HTTPException(400, "Body imagery needs explicit consent before processing.")
        product = get_product(settings.catalog_path, product_slug)
        if not product:
            raise HTTPException(404, "That piece is not in the edit.")
        data = await photo.read()
        if not data:
            raise HTTPException(400, "Upload a full-length photograph.")
        return _run_tryon(
            hub,
            request,
            product=product,
            color=color or product["colors"][0]["name"],
            measurements={
                "height_cm": height_cm,
                "chest_cm": chest_cm,
                "waist_cm": waist_cm,
                "hips_cm": hips_cm,
            },
            photo=data,
            consent_training=consent_training,
            save_to_profile=save_to_profile,
        )

    @app.get("/v1/me/tryon")
    def list_tryon(request: Request) -> dict:
        user_id = require_user_id(request, settings.secret)
        rows = hub.db.query(
            "SELECT id, purpose, consent_training, created_at FROM profile_media WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
        return {"photos": rows, "note": "Profile copies stay until you delete them. Inference scratch is wiped when the preview returns."}

    @app.delete("/v1/me/tryon/{media_id}")
    def delete_tryon(media_id: str, request: Request) -> dict:
        user_id = require_user_id(request, settings.secret)
        row = hub.db.query_one(
            "SELECT * FROM profile_media WHERE id = %s AND user_id = %s",
            (media_id, user_id),
        )
        if not row:
            raise HTTPException(404, "That preview is already gone.")
        Path(row["path"]).unlink(missing_ok=True)
        hub.db.execute("DELETE FROM profile_media WHERE id = %s", (media_id,))
        return {"deleted": True}

    return app


def _split(value: str | None) -> list[str] | None:
    if not value:
        return None
    parts = [part.strip() for part in value.split(",") if part.strip()]
    return parts or None


def _oauth_login(hub: Hub, request: Request, *, email: str, name: str, provider: str) -> dict:
    row = hub.db.query_one("SELECT * FROM users WHERE email = %s", (email,))
    if not row:
        user_id = "user_" + uuid.uuid4().hex[:12]
        hub.db.execute(
            """
            INSERT INTO users (id, email, phone, name, password_hash, oauth_provider, measurements, consent_training, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (user_id, email, None, name, None, provider, "{}", 0, now_iso()),
        )
        row = hub.user_by_id(user_id)
    sid = request.headers.get("x-session-id")
    if sid:
        hub.attach_cart(sid, row["id"])
    return {"token": hub.issue(row["id"]), "user": hub.public_user(row)}


def _verify_apple(id_token: str, client_id: str) -> dict:
    try:
        header_b64, payload_b64, sig_b64 = id_token.split(".")
    except ValueError as exc:
        raise HTTPException(401, "Apple token is malformed.") from exc
    header = json.loads(_b64d(header_b64))
    payload = json.loads(_b64d(payload_b64))
    if payload.get("iss") != "https://appleid.apple.com":
        raise HTTPException(401, "Apple token issuer is unexpected.")
    if payload.get("aud") != client_id:
        raise HTTPException(401, "Apple token was issued for a different app.")
    if int(payload.get("exp", 0)) < time.time():
        raise HTTPException(401, "Apple token has expired.")
    try:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
    except ImportError as exc:
        raise HTTPException(501, "Install cryptography to verify Apple tokens.") from exc
    keys = httpx.get("https://appleid.apple.com/auth/keys", timeout=10).json()["keys"]
    key = next((item for item in keys if item.get("kid") == header.get("kid")), None)
    if not key:
        raise HTTPException(401, "Apple signing key was not found.")
    numbers = RSAPublicNumbers(
        int.from_bytes(_b64d(key["e"]), "big"),
        int.from_bytes(_b64d(key["n"]), "big"),
    )
    public_key = numbers.public_key()
    try:
        public_key.verify(
            _b64d(sig_b64),
            f"{header_b64}.{payload_b64}".encode(),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
    except Exception as exc:
        raise HTTPException(401, "Apple token signature did not verify.") from exc
    email = payload.get("email")
    if not email:
        raise HTTPException(400, "Apple account did not share an email.")
    return {"email": email.lower(), "name": payload.get("name") or "Apple customer"}


def _b64d(data: str) -> bytes:
    import base64

    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _owned_order(hub: Hub, request: Request, order_id: str) -> dict:
    row = hub.db.query_one("SELECT * FROM orders WHERE id = %s", (order_id,))
    if not row:
        raise HTTPException(404, "Order not found.")
    user = hub.optional_user(request)
    session_id = request.headers.get("x-session-id")
    if user and row["user_id"] == user["id"]:
        return row
    if session_id and row["session_id"] == session_id:
        return row
    raise HTTPException(404, "Order not found.")


def _public_order(hub: Hub, order_id: str) -> dict:
    row = hub.db.query_one("SELECT * FROM orders WHERE id = %s", (order_id,))
    assert row
    return _shape_order(row)


def _shape_order(row: dict) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "items": loads(row["items"], []),
        "subtotal": row["subtotal"],
        "shipping": row["shipping"],
        "total": row["total"],
        "currency": row["currency"],
        "status": row["status"],
        "payment_method": row["payment_method"],
        "payment_ref": row["payment_ref"],
        "payment": loads(row["payment_payload"], {}),
        "address": loads(row["address"], {}),
        "timeline": loads(row["timeline"], []),
        "created_at": row["created_at"],
    }


def _run_tryon(
    hub: Hub,
    request: Request,
    *,
    product: dict,
    color: str,
    measurements: dict,
    photo: bytes | None,
    consent_training: bool,
    save_to_profile: bool,
) -> dict:
    hub.scratch.purge()
    spilled = hub.scratch.spill(photo, ".img") if photo else None
    try:
        result = vision_tryon(
            hub.settings,
            silhouette=product["silhouette"],
            color_hex=_color_hex(product, color),
            fabric=product["fabric"],
            measurements=measurements,
            photo=photo,
        )
    except TryOnMissing as exc:
        raise HTTPException(503, str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(502, "The trial-view service did not answer.") from exc
    finally:
        hub.scratch.release(spilled)
    image_bytes = result.pop("image_bytes")
    user = hub.optional_user(request)
    saved_id = None
    if save_to_profile and user:
        saved_id = "media_" + uuid.uuid4().hex[:12]
        path = hub.settings.media_dir / f"{saved_id}.jpg"
        path.write_bytes(image_bytes)
        hub.db.execute(
            """
            INSERT INTO profile_media (id, user_id, session_id, path, purpose, consent_training, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                saved_id,
                user["id"],
                request.headers.get("x-session-id"),
                str(path),
                "tryon-preview",
                1 if consent_training else 0,
                now_iso(),
            ),
        )
        if consent_training:
            hub.db.execute("UPDATE users SET consent_training = 1 WHERE id = %s", (user["id"],))
    result["image_base64"] = base64.b64encode(image_bytes).decode()
    result["product_slug"] = product["slug"]
    result["color"] = color
    result["privacy"] = {
        "inference_retained": False,
        "purge_within_hours": 24,
        "used_for_training": False,
        "training_preference_stored": bool(consent_training and user),
        "training_note": (
            "Nothing from this preview is added to a training set. "
            "A training export does not exist in this build."
        ),
        "saved_to_profile": saved_id,
    }
    return result


# Uvicorn loads this object. Tests set SUTRA_EAGER=0 and call create_app()
# against a temporary database instead.
app = create_app() if os.getenv("SUTRA_EAGER", "1") == "1" else None
