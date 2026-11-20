"""Storefront extensions: wishlist, live order tracking stream, guest helpers."""

from __future__ import annotations

import asyncio
import json
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from datetime import datetime, timezone

from app.catalog import get_product
from app.db import loads
from app.security import bearer_user_id, require_user_id

if TYPE_CHECKING:
    from fastapi import FastAPI


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class WishlistIn(BaseModel):
    product_id: str
    color_name: str = ""


def register_storefront_routes(app: FastAPI, hub, settings) -> None:
    @app.get("/v1/wishlist")
    def list_wishlist(request: Request) -> dict:
        user_id = require_user_id(request, settings.secret)
        rows = hub.db.query(
            "SELECT product_id, color_name, created_at FROM wishlists WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
        return {"items": rows}

    @app.put("/v1/wishlist")
    def add_wishlist(body: WishlistIn, request: Request) -> dict:
        user_id = require_user_id(request, settings.secret)
        if not get_product(settings.catalog_path, body.product_id):
            raise HTTPException(404, "Product not in catalog.")
        color = body.color_name or ""
        hub.db.execute(
            """
            INSERT INTO wishlists (user_id, product_id, color_name, created_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, product_id, color_name) DO NOTHING
            """,
            (user_id, body.product_id, color, now_iso()),
        )
        return {"added": True}

    @app.delete("/v1/wishlist/{product_id}")
    def remove_wishlist(product_id: str, request: Request, color_name: str = "") -> dict:
        user_id = require_user_id(request, settings.secret)
        hub.db.execute(
            "DELETE FROM wishlists WHERE user_id = %s AND product_id = %s AND color_name = %s",
            (user_id, product_id, color_name),
        )
        return {"removed": True}

    @app.get("/v1/orders/{order_id}/stream")
    async def order_stream(order_id: str, request: Request) -> StreamingResponse:
        user_id = bearer_user_id(request, settings.secret)
        session_id = request.headers.get("x-session-id", "")

        async def events():
            last = ""
            while True:
                if await request.is_disconnected():
                    break
                row = hub.db.query_one("SELECT * FROM orders WHERE id = %s", (order_id,))
                if not row:
                    yield f"data: {json.dumps({'error': 'not_found'})}\n\n"
                    break
                if user_id and row.get("user_id") != user_id:
                    if not session_id or row.get("session_id") != session_id:
                        yield f"data: {json.dumps({'error': 'forbidden'})}\n\n"
                        break
                elif not user_id and row.get("session_id") != session_id:
                    yield f"data: {json.dumps({'error': 'forbidden'})}\n\n"
                    break
                payload = json.dumps(
                    {
                        "id": row["id"],
                        "status": row["status"],
                        "timeline": loads(row["timeline"], []),
                        "tracking_code": row.get("tracking_code"),
                    },
                    separators=(",", ":"),
                )
                if payload != last:
                    last = payload
                    yield f"data: {payload}\n\n"
                await asyncio.sleep(2)

        return StreamingResponse(events(), media_type="text/event-stream")

    @app.post("/v1/orders/{order_id}/verify-cod")
    def verify_cod(order_id: str, body: dict, request: Request) -> dict:
        code = str(body.get("code", ""))
        row = hub.db.query_one("SELECT * FROM orders WHERE id = %s", (order_id,))
        if not row:
            raise HTTPException(404, "Order not found.")
        if row.get("payment_method") != "cod":
            raise HTTPException(400, "Order is not cash on delivery.")
        address = loads(row["address"], {})
        phone = address.get("phone", "")
        otp_row = hub.db.query_one("SELECT * FROM otp_codes WHERE phone = %s", (phone,))
        if not otp_row or otp_row["code"] != code:
            raise HTTPException(401, "COD verification code is incorrect.")
        hub.db.execute("UPDATE orders SET cod_otp_verified = 1 WHERE id = %s", (order_id,))
        return {"verified": True}