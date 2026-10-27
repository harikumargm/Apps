from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

LETTER_SIZES = ["XS", "S", "M", "L", "XL"]
LETTER_CHEST = [("XS", 80), ("S", 88), ("M", 96), ("L", 104), ("XL", 140)]
KID_SIZES = [("2-3Y", 104), ("4-5Y", 116), ("6-7Y", 140)]


@lru_cache(maxsize=4)
def load_catalog(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text())


def products(path: Path) -> list[dict[str, Any]]:
    return list(load_catalog(str(path))["products"])


def shipping_rules(path: Path) -> tuple[int, int]:
    catalog = load_catalog(str(path))
    return int(catalog["shipping_free_above"]), int(catalog["shipping_fee"])


def get_product(path: Path, slug: str) -> dict[str, Any] | None:
    for product in products(path):
        if product["slug"] == slug or product["id"] == slug:
            return product
    return None


def suggest_size(product: dict[str, Any], measurements: dict[str, Any] | None) -> str | None:
    if not measurements:
        return None
    sizes = product["sizes"]
    if "kids" in product["departments"]:
        height = float(measurements.get("height_cm") or 0)
        if height <= 0:
            return None
        for size, limit in KID_SIZES:
            if height < limit and size in sizes:
                return size
        return sizes[-1] if sizes else None
    chest = measurements.get("chest_cm")
    if chest is None:
        return None
    chest = float(chest)
    pick = "XL"
    for size, limit in LETTER_CHEST:
        if chest < limit:
            pick = size
            break
    if pick in sizes:
        return pick
    for size in LETTER_SIZES:
        if size in sizes:
            return size
    return None


def filter_products(
    path: Path,
    *,
    audience: str | None = None,
    occasion: str | None = None,
    silhouette: str | None = None,
    fabric: list[str] | None = None,
    size: list[str] | None = None,
    color: list[str] | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    q: str | None = None,
    sort: str = "featured",
) -> dict[str, Any]:
    items = products(path)
    if audience:
        items = [p for p in items if p["audience"] == audience or audience in p["departments"]]
    if occasion:
        items = [p for p in items if p["occasion"] == occasion or occasion in p["departments"]]
    if silhouette:
        items = [p for p in items if p["silhouette"] == silhouette]
    if fabric:
        wanted = {name.lower() for name in fabric}
        items = [p for p in items if p["fabric"]["type"].lower() in wanted]
    if size:
        wanted_sizes = set(size)
        items = [p for p in items if wanted_sizes.intersection(p["sizes"])]
    if color:
        wanted_colors = {name.lower() for name in color}
        items = [
            p
            for p in items
            if wanted_colors.intersection({c["name"].lower() for c in p["colors"]})
        ]
    if min_price is not None:
        items = [p for p in items if p["price"] >= min_price]
    if max_price is not None:
        items = [p for p in items if p["price"] <= max_price]
    if q:
        needle = q.lower().strip()
        items = [
            p
            for p in items
            if needle in p["name"].lower()
            or needle in p["summary"].lower()
            or needle in p["fabric"]["type"].lower()
        ]
    if sort == "price_asc":
        items = sorted(items, key=lambda p: p["price"])
    elif sort == "price_desc":
        items = sorted(items, key=lambda p: p["price"], reverse=True)
    facets = _facets(products(path))
    return {"items": items, "total": len(items), "facets": facets, "currency": "INR"}


def _facets(items: list[dict[str, Any]]) -> dict[str, Any]:
    fabrics: dict[str, int] = {}
    colors: dict[str, int] = {}
    sizes: dict[str, int] = {}
    for product in items:
        fabrics[product["fabric"]["type"]] = fabrics.get(product["fabric"]["type"], 0) + 1
        for color in product["colors"]:
            colors[color["name"]] = colors.get(color["name"], 0) + 1
        for size in product["sizes"]:
            sizes[size] = sizes.get(size, 0) + 1
    return {"fabric": fabrics, "color": colors, "size": sizes}


def merge_cart(existing: list[dict], incoming: list[dict]) -> list[dict]:
    merged: dict[tuple, dict] = {}
    for source in (existing, incoming):
        for item in source:
            key = (item["product_id"], item["size"], item["color"])
            if key in merged:
                merged[key]["qty"] = min(8, int(merged[key]["qty"]) + int(item["qty"]))
            else:
                merged[key] = dict(item)
    return list(merged.values())
