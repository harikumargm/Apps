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

from app.catalog import load_catalog, products
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


class InventoryPatch(BaseModel):
    sku: str
    qty: int = Field(ge=0)


class StudioPublishBody(BaseModel):
    product_id: str
    image_url: str = Field(min_length=8)
    section: str = Field(pattern=r"^(catalog_grid|combo_offers|home_looks|pdp_gallery|lookbook)$")
    studio_output_id: str | None = None
    preset_label: str | None = None


STORE_SECTIONS = frozenset({"catalog_grid", "combo_offers", "home_looks", "pdp_gallery", "lookbook"})


def _catalog_write_paths(primary: Path) -> list[Path]:
    paths = [primary]
    web_mirror = primary.parent.parent / "apps" / "web" / "data" / "catalog.json"
    if web_mirror.is_file() and web_mirror.resolve() != primary.resolve():
        paths.append(web_mirror)
    return paths


def _load_catalog_dict(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _save_catalog_dict(paths: list[Path], catalog: dict) -> None:
    payload = json.dumps(catalog, indent=2, ensure_ascii=False) + "\n"
    for path in paths:
        path.write_text(payload, encoding="utf-8")


def _apply_studio_image(product: dict, section: str, image_url: str) -> None:
    if section in {"catalog_grid", "home_looks"}:
        product["image"] = image_url
        return
    if section == "combo_offers":
        departments = product.setdefault("departments", [])
        if "combo_offers" not in departments:
            departments.append("combo_offers")
        product["image"] = image_url
        return
    if section == "pdp_gallery":
        gallery = product.setdefault("gallery_images", [])
        if image_url not in gallery:
            gallery.append(image_url)
        return
    if section == "lookbook":
        lookbook = product.setdefault("lookbook_images", [])
        if image_url not in lookbook:
            lookbook.append(image_url)


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

    @app.patch("/v1/admin/inventory")
    def inventory_patch(body: InventoryPatch, request: Request) -> dict:
        _require_admin(request, settings)
        hub.db.execute(
            """
            INSERT INTO stock (sku, qty) VALUES (%s, %s)
            ON CONFLICT (sku) DO UPDATE SET qty = %s
            """,
            (body.sku, body.qty, body.qty),
        )
        hub.db.execute(
            "INSERT INTO inventory_logs (id, sku, delta, reason, created_at) VALUES (%s, %s, %s, %s, %s)",
            (
                f"log_{body.sku}_{datetime.now(timezone.utc).timestamp():.0f}",
                body.sku,
                body.qty,
                "admin_adjust",
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        return {"sku": body.sku, "qty": body.qty}

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

    @app.get("/v1/admin/orders/recent")
    def recent_orders(request: Request, limit: int = 20) -> dict:
        _require_admin(request, settings)
        limit = max(1, min(limit, 50))
        rows = hub.db.query(
            "SELECT * FROM orders ORDER BY created_at DESC LIMIT %s",
            (limit,),
        )
        orders = []
        for row in rows:
            address = loads(row["address"], {})
            orders.append(
                {
                    "id": row["id"],
                    "email": row["email"],
                    "customer_name": address.get("name", ""),
                    "phone": address.get("phone", ""),
                    "total": row["total"],
                    "status": row["status"],
                    "payment_method": row["payment_method"],
                    "payment_ref": row.get("payment_ref"),
                    "items": loads(row["items"], []),
                    "created_at": row["created_at"],
                }
            )
        return {"orders": orders}

    @app.get("/v1/admin/orders/stream")
    async def admin_order_stream(request: Request) -> StreamingResponse:
        _require_admin(request, settings)

        async def events():
            existing = hub.db.query("SELECT id FROM orders", ())
            seen = {row["id"] for row in existing}
            while True:
                if await request.is_disconnected():
                    break
                rows = hub.db.query(
                    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 30",
                    (),
                )
                for row in rows:
                    oid = row["id"]
                    if oid in seen:
                        continue
                    seen.add(oid)
                    address = loads(row["address"], {})
                    payload = {
                        "type": "new_order",
                        "order": {
                            "id": oid,
                            "total": row["total"],
                            "status": row["status"],
                            "email": row["email"],
                            "customer_name": address.get("name", ""),
                            "phone": address.get("phone", ""),
                            "payment_method": row["payment_method"],
                            "payment_ref": row.get("payment_ref"),
                            "items": loads(row["items"], []),
                            "created_at": row["created_at"],
                        },
                    }
                    yield f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"
                await asyncio.sleep(2)

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

    @app.post("/v1/admin/products/ingest-images")
    async def ingest_images(
        request: Request,
        files: list[UploadFile] = File(...),
        audience_hint: str | None = None,
    ) -> dict:
        _require_admin(request, settings)
        if not files:
            raise HTTPException(400, "Choose one or more images.")
        try:
            from categorize import categorize_product_image
            from fabric_verify import verify_fabric_closeup
        except ImportError as exc:
            raise HTTPException(501, "AI pipeline package is not on PYTHONPATH.") from exc

        results: list[dict] = []
        for file in files:
            data = await file.read()
            if not data:
                continue
            cat = categorize_product_image(data, audience_hint=audience_hint, filename=file.filename or "")
            fabric = {}
            if file.filename and "fabric" in file.filename.lower():
                fabric = verify_fabric_closeup(data)
            job_id = f"ingest_{base64.urlsafe_b64encode(data[:12]).decode().strip('=')}_{len(results)}"
            hub.db.execute(
                """
                INSERT INTO product_ingest_jobs (id, status, payload, created_at)
                VALUES (%s, %s, %s, %s)
                """,
                (job_id, "succeeded", dumps({**cat, "fabric": fabric, "filename": file.filename}), datetime.now(timezone.utc).isoformat()),
            )
            results.append(
                {
                    "filename": file.filename,
                    "job_id": job_id,
                    "categorization": cat,
                    "fabric": fabric or None,
                }
            )
        return {"count": len(results), "results": results}

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
                        "sku": sku,
                        "product_id": product["id"],
                        "name": product["name"],
                        "size": size,
                        "qty": qty,
                        "out_of_stock": qty <= 0,
                        "low_stock": 0 < qty < 10,
                    }
                )
        return {"variants": out}

    @app.get("/v1/admin/catalog/products")
    def catalog_products_summary(request: Request) -> dict:
        _require_admin(request, settings)
        catalog_items = products(settings.catalog_path)
        items = [
            {
                "id": product["id"],
                "slug": product["slug"],
                "name": product["name"],
                "audience": product.get("audience", ""),
                "departments": product.get("departments", []),
                "has_image": bool(product.get("image")),
            }
            for product in catalog_items
        ]
        return {"products": items, "sections": list(STORE_SECTIONS)}

    @app.post("/v1/admin/catalog/publish-studio-image")
    def publish_studio_image(body: StudioPublishBody, request: Request) -> dict:
        _require_admin(request, settings)
        if body.section not in STORE_SECTIONS:
            raise HTTPException(400, "Unknown storefront section.")
        catalog_paths = _catalog_write_paths(settings.catalog_path)
        catalog = _load_catalog_dict(catalog_paths[0])
        target: dict | None = None
        for product in catalog.get("products", []):
            if product["id"] == body.product_id:
                target = product
                break
        if target is None:
            raise HTTPException(404, "Product not found in catalog.")
        _apply_studio_image(target, body.section, body.image_url)
        _save_catalog_dict(catalog_paths, catalog)
        load_catalog.cache_clear()
        pub_id = f"pub_{body.product_id}_{datetime.now(timezone.utc).timestamp():.0f}"
        hub.db.execute(
            """
            INSERT INTO studio_catalog_publications
            (id, product_id, section, image_url, preset_label, studio_output_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                pub_id,
                body.product_id,
                body.section,
                body.image_url,
                body.preset_label,
                body.studio_output_id,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        return {
            "publication_id": pub_id,
            "product_id": body.product_id,
            "slug": target["slug"],
            "section": body.section,
            "image_url": body.image_url,
            "storefront_paths": {
                "catalog_grid": "/catalog",
                "combo_offers": "/catalog/combo-offers",
                "home_looks": "/",
                "pdp_gallery": f"/product/{target['slug']}",
                "lookbook": f"/product/{target['slug']}",
            }.get(body.section, "/catalog"),
        }