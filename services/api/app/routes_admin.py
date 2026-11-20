"""Admin dashboard: inventory, analytics, AI ingest, live order SSE."""

from __future__ import annotations

import asyncio
import base64
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.catalog import products
from app.db import dumps, loads

if TYPE_CHECKING:
    from fastapi import FastAPI

ROOT = Path(__file__).resolve().parents[3]
AI_PIPELINE = ROOT / "services" / "ai-pipeline"
if AI_PIPELINE.is_dir() and str(AI_PIPELINE) not in sys.path:
    sys.path.insert(0, str(AI_PIPELINE))


def _require_admin(request: Request, settings) -> None:
    token = request.headers.get("x-admin-token") or request.query_params.get("admin_token", "")
    if token != settings.admin_token:
        raise HTTPException(401, "Admin token required.")


class InventoryRow(BaseModel):
    sku: str
    qty: int = Field(ge=0)


class InventoryImport(BaseModel):
    rows: list[InventoryRow]


def register_admin_routes(app: FastAPI, hub, settings) -> None:
    @app.get("/v1/admin/analytics")
    def analytics(request: Request) -> dict:
        _require_admin(request, settings)
        rows = hub.db.query("SELECT total, status, created_at FROM orders", ())
        paid = [r for r in rows if r["status"] in ("paid", "confirmed", "packed", "shipped", "delivered")]
        revenue = sum(int(r["total"]) for r in paid)
        stock = hub.db.query("SELECT sku, qty FROM stock", ())
        low = [row for row in stock if int(row["qty"]) < 10]
        return {
            "revenue_paise": revenue,
            "order_count": len(rows),
            "low_stock_skus": len(low),
            "cart_abandonment_estimate": 0.12,
            "return_rate": 0.04,
        }

    @app.get("/v1/admin/inventory")
    def inventory(request: Request) -> dict:
        _require_admin(request, settings)
        return {"items": hub.db.query("SELECT sku, qty FROM stock ORDER BY sku", ())}

    @app.post("/v1/admin/inventory/import")
    def inventory_import(body: InventoryImport, request: Request) -> dict:
        _require_admin(request, settings)
        for row in body.rows:
            hub.db.execute(
                """
                INSERT INTO stock (sku, qty) VALUES (%s, %s)
                ON CONFLICT (sku) DO UPDATE SET qty = %s
                """,
                (row.sku, row.qty, row.qty),
            )
            hub.db.execute(
                "INSERT INTO inventory_logs (id, sku, delta, reason, created_at) VALUES (%s, %s, %s, %s, %s)",
                (f"log_{row.sku}", row.sku, row.qty, "import", datetime.now(timezone.utc).isoformat()),
            )
        return {"imported": len(body.rows)}

    @app.get("/v1/admin/orders/stream")
    async def admin_order_stream(request: Request) -> StreamingResponse:
        _require_admin(request, settings)
        seen: set[str] = set()

        async def events():
            while True:
                if await request.is_disconnected():
                    break
                rows = hub.db.query(
                    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 20",
                    (),
                )
                for row in rows:
                    oid = row["id"]
                    if oid in seen:
                        continue
                    seen.add(oid)
                    yield f"data: {json.dumps({'type': 'new_order', 'order': {'id': oid, 'total': row['total'], 'status': row['status'], 'email': row['email']}}, separators=(',', ':'))}\n\n"
                await asyncio.sleep(3)

        return StreamingResponse(events(), media_type="text/event-stream")

    @app.post("/v1/admin/products/ingest-image")
    async def ingest_image(
        request: Request,
        file: UploadFile = File(...),
        audience_hint: str | None = None,
    ) -> dict:
        _require_admin(request, settings)
        data = await file.read()
        if not data:
            raise HTTPException(400, "Upload a product photograph.")
        try:
            from categorize import categorize_product_image
            from fabric_verify import verify_fabric_closeup
        except ImportError as exc:
            raise HTTPException(501, "AI pipeline package is not on PYTHONPATH.") from exc

        cat = categorize_product_image(data, audience_hint=audience_hint, filename=file.filename or "")
        fabric = {}
        if file.filename and "fabric" in file.filename.lower():
            fabric = verify_fabric_closeup(data)
        hub.db.execute(
            """
            INSERT INTO product_ingest_jobs (id, status, payload, created_at)
            VALUES (%s, %s, %s, %s)
            """,
            (
                f"ingest_{base64.urlsafe_b64encode(data[:12]).decode().strip('=')}",
                "succeeded",
                dumps({**cat, "fabric": fabric}),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        return {"categorization": cat, "fabric": fabric or None, "note": "Persist to Prisma Product tables in production."}

    @app.get("/v1/admin/catalog/stock-status")
    def stock_status(request: Request) -> dict:
        _require_admin(request, settings)
        catalog_items = products(settings.catalog_path)
        stock_rows = {r["sku"]: int(r["qty"]) for r in hub.db.query("SELECT sku, qty FROM stock", ())}
        out: list[dict] = []
        for product in catalog_items:
            for size in product["sizes"]:
                sku = f"{product['id']}|{size}"
                qty = stock_rows.get(sku, product["inventory"].get(size, 0))
                out.append(
                    {
                        "product_id": product["id"],
                        "name": product["name"],
                        "size": size,
                        "qty": qty,
                        "out_of_stock": qty <= 0,
                        "low_stock": 0 < qty < 10,
                    }
                )
        return {"variants": out}