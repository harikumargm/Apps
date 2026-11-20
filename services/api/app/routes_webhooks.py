"""Payment and WhatsApp webhook receivers."""

from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request

from app.db import dumps

if TYPE_CHECKING:
    from fastapi import FastAPI

ROOT = Path(__file__).resolve().parents[3]
WHATSAPP_DIR = ROOT / "services" / "whatsapp"
if WHATSAPP_DIR.is_dir() and str(WHATSAPP_DIR) not in sys.path:
    sys.path.insert(0, str(WHATSAPP_DIR))


def _store_event(hub, provider: str, event_type: str, payload: dict) -> str:
    event_id = f"wh_{uuid.uuid4().hex[:12]}"
    hub.db.execute(
        """
        INSERT INTO webhook_events (id, provider, event_type, payload, processed, created_at)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (event_id, provider, event_type, dumps(payload), 0, datetime.now(timezone.utc).isoformat()),
    )
    return event_id


def register_webhook_routes(app: FastAPI, hub, settings) -> None:
    @app.post("/v1/webhooks/stripe")
    async def stripe_webhook(request: Request) -> dict:
        body = await request.body()
        try:
            payload = json.loads(body.decode() or "{}")
        except json.JSONDecodeError as exc:
            raise HTTPException(400, "Invalid JSON") from exc
        event_type = payload.get("type", "unknown")
        _store_event(hub, "stripe", event_type, payload)
        if event_type == "payment_intent.succeeded":
            ref = payload.get("data", {}).get("object", {}).get("id")
            if ref:
                hub.db.execute(
                    "UPDATE orders SET status = %s WHERE payment_ref = %s",
                    ("paid", ref),
                )
        return {"received": True}

    @app.post("/v1/webhooks/razorpay")
    async def razorpay_webhook(request: Request) -> dict:
        payload = await request.json()
        event_type = payload.get("event", "unknown")
        _store_event(hub, "razorpay", event_type, payload)
        if event_type == "payment.captured":
            ref = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id")
            if ref:
                hub.db.execute("UPDATE orders SET status = %s WHERE payment_ref = %s", ("paid", ref))
        return {"received": True}

    @app.post("/v1/webhooks/whatsapp")
    async def whatsapp_webhook(request: Request) -> dict:
        payload = await request.json()
        _store_event(hub, "whatsapp", payload.get("entry", [{}])[0].get("id", "message"), payload)
        return {"received": True}

    @app.post("/v1/internal/whatsapp/abandoned-cart")
    async def trigger_abandoned_cart(request: Request) -> dict:
        token = request.headers.get("x-admin-token", "")
        if token != settings.admin_token:
            raise HTTPException(401, "Admin token required.")
        try:
            from client import send_template
            from templates import abandoned_cart
        except ImportError as exc:
            raise HTTPException(501, "WhatsApp service not available.") from exc
        body = await request.json()
        session_id = body.get("session_id", "")
        row = hub.db.query_one("SELECT * FROM carts WHERE session_id = %s", (session_id,))
        if not row:
            raise HTTPException(404, "Cart not found.")
        phone = body.get("phone", "")
        if not phone:
            raise HTTPException(400, "phone required for WhatsApp recovery.")
        message = abandoned_cart(checkout_url=f"https://vastram.store/checkout?session={session_id}")
        result = send_template(phone, message)
        return {"sent": result.get("demo", True), "template": message["name"]}