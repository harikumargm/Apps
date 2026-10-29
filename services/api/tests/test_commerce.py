import io
import os
import time

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.catalog import suggest_size
from app.main import create_app
from app.settings import Settings
from sutra_vision.fabric import analyze_image
from sutra_vision.privacy import InferenceScratch
from sutra_vision.tryon import render_tryon


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'sutra.db'}")
    monkeypatch.setenv("SUTRA_DEMO", "1")
    monkeypatch.setenv("SUTRA_SECRET", "test-secret")
    monkeypatch.setenv("SUTRA_ADMIN_TOKEN", "admin-test")
    monkeypatch.setenv("SUTRA_INFERENCE_TMP", str(tmp_path / "inference"))
    monkeypatch.setenv("SUTRA_MEDIA_DIR", str(tmp_path / "media"))
    monkeypatch.setenv("VISION_URL", "")
    monkeypatch.setenv("REDIS_URL", "")
    app = create_app(Settings.load())
    with TestClient(app) as test_client:
        yield test_client


def _session(client: TestClient) -> dict:
    return {"X-Session-Id": "sess-test"}


def test_catalog_filters_by_fabric_and_occasion(client):
    response = client.get("/v1/products", params={"fabric": "Silk", "occasion": "festive"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 2
    assert all(item["fabric"]["type"] == "Silk" for item in body["items"])
    assert all(item["occasion"] == "festive" for item in body["items"])


def test_size_suggestion_uses_chest():
    product = {"departments": ["women"], "sizes": ["XS", "S", "M", "L"]}
    assert suggest_size(product, {"chest_cm": 90}) == "M"
    kids = {"departments": ["kids"], "sizes": ["2-3Y", "4-5Y", "6-7Y"]}
    assert suggest_size(kids, {"height_cm": 100}) == "2-3Y"


def test_register_login_measurements_and_delete(client):
    headers = _session(client)
    created = client.post(
        "/v1/auth/register",
        headers=headers,
        json={"name": "Asha", "email": "asha@sutra.test", "password": "cloth-loom"},
    )
    assert created.status_code == 200
    token = created.json()["token"]
    auth = {**headers, "Authorization": f"Bearer {token}"}
    updated = client.patch(
        "/v1/me/measurements",
        headers=auth,
        json={"height_cm": 162, "chest_cm": 86, "waist_cm": 70, "hips_cm": 94, "preferred_fit": "ease"},
    )
    assert updated.status_code == 200
    assert updated.json()["measurements"]["chest_cm"] == 86
    logged = client.post(
        "/v1/auth/login",
        headers=headers,
        json={"email": "asha@sutra.test", "password": "cloth-loom"},
    )
    assert logged.status_code == 200
    removed = client.delete("/v1/me", headers=auth)
    assert removed.status_code == 200
    assert client.get("/v1/me", headers=auth).status_code == 401


def test_demo_login_and_phone_otp(client):
    headers = _session(client)
    logged = client.post(
        "/v1/auth/login",
        headers=headers,
        json={"email": "mira@sutra.test", "password": "loom-and-line"},
    )
    assert logged.status_code == 200
    assert logged.json()["user"]["name"] == "Mira Sen"
    otp = client.post("/v1/auth/otp/request", json={"phone": "+919800000000"})
    assert otp.json()["demo_code"] == "240126"
    verified = client.post(
        "/v1/auth/otp/verify",
        headers=headers,
        json={"phone": "+919800000000", "code": "240126"},
    )
    assert verified.status_code == 200


def test_cart_checkout_shipping_and_stock(client):
    headers = _session(client)
    login = client.post(
        "/v1/auth/login",
        headers=headers,
        json={"email": "mira@sutra.test", "password": "loom-and-line"},
    )
    auth = {**headers, "Authorization": f"Bearer {login.json()['token']}"}
    product = client.get("/v1/products/sky-linen-playset").json()
    before = product["stock"]["4-5Y"]
    cart = client.put(
        "/v1/cart",
        headers=auth,
        json={"items": [{"product_id": product["id"], "size": "4-5Y", "color": "Sky", "qty": 2}]},
    )
    assert cart.status_code == 200
    body = cart.json()
    assert body["subtotal"] == 3980
    assert body["shipping"] == 0
    order = client.post(
        "/v1/checkout",
        headers=auth,
        json={
            "email": "mira@sutra.test",
            "method": "upi",
            "address": {
                "name": "Mira Sen",
                "phone": "+919800000000",
                "line1": "12 Cloth Lane",
                "city": "Kochi",
                "region": "Kerala",
                "postal_code": "682001",
            },
        },
    )
    assert order.status_code == 200
    order_id = order.json()["order"]["id"]
    assert order.json()["payment"]["upi_uri"].startswith("upi://")
    confirmed = client.post(f"/v1/orders/{order_id}/confirm", headers=auth, json={})
    assert confirmed.status_code == 200
    assert confirmed.json()["order"]["status"] == "confirmed"
    after = client.get("/v1/products/sky-linen-playset").json()["stock"]["4-5Y"]
    assert after == before - 2
    assert client.get("/v1/cart", headers=auth).json()["items"] == []
    advanced = client.post(
        f"/v1/orders/{order_id}/tracking",
        headers={"X-Admin-Token": "admin-test"},
        json={"status": "shipped"},
    )
    assert advanced.json()["order"]["status"] == "shipped"
    cheap = client.put(
        "/v1/cart",
        headers=auth,
        json={"items": [{"product_id": product["id"], "size": "2-3Y", "color": "Sand", "qty": 1}]},
    )
    assert cheap.json()["shipping"] == 149


def test_tryon_requires_consent_and_finishes_quickly(client):
    headers = _session(client)
    refused = client.post(
        "/v1/tryon/twin",
        headers=headers,
        json={
            "product_slug": "indigo-poplin-shirt",
            "height_cm": 168,
            "chest_cm": 88,
            "waist_cm": 72,
            "hips_cm": 96,
            "consent": False,
        },
    )
    assert refused.status_code == 400
    started = time.perf_counter()
    rendered = client.post(
        "/v1/tryon/twin",
        headers=headers,
        json={
            "product_slug": "indigo-poplin-shirt",
            "height_cm": 168,
            "chest_cm": 88,
            "waist_cm": 72,
            "hips_cm": 96,
            "consent": True,
        },
    )
    assert rendered.status_code == 200
    body = rendered.json()
    assert time.perf_counter() - started < 2
    assert body["within_budget"] is True
    assert body["engine"] == "physics-drape-v1"
    assert body["privacy"]["used_for_training"] is False
    assert body["stages"]["garment_parser_ms"] >= 0
    assert "shoulder_l" in body["pose"]["joints"]
    assert body["image_base64"]


def test_fabric_reading_orders_texture():
    smooth = _image(lambda draw, w, h: draw.rectangle([0, 0, w, h], fill=(220, 220, 230)))
    noisy = _image(lambda draw, w, h: _noise(draw, w, h))
    diagonal = _image(lambda draw, w, h: _diagonals(draw, w, h))
    smooth_read = analyze_image(smooth)
    noisy_read = analyze_image(noisy)
    diagonal_read = analyze_image(diagonal)
    assert noisy_read["signals"]["texture_std"] > smooth_read["signals"]["texture_std"]
    for reading in (smooth_read, noisy_read, diagonal_read):
        assert sum(row["percent"] for row in reading["composition"]) == 100
        assert reading["weave"] in {"plain", "twill", "satin"}
        assert reading["weight"] in {"lightweight", "medium", "heavy"}
        assert 0 <= reading["stretch_index"] <= 100
        assert reading["care"]
    assert diagonal_read["weave"] == "twill"


def test_photo_tryon_purges_inference_scratch(client, tmp_path):
    headers = _session(client)
    photo = _image(lambda draw, w, h: draw.ellipse([40, 20, 120, 220], fill=(40, 70, 120)))
    response = client.post(
        "/v1/tryon/photo",
        headers=headers,
        data={
            "product_slug": "black-satin-slip",
            "consent": "true",
            "height_cm": "170",
            "chest_cm": "90",
            "waist_cm": "74",
            "hips_cm": "98",
        },
        files={"photo": ("person.jpg", photo, "image/jpeg")},
    )
    assert response.status_code == 200
    scratch = Path_inference(client)
    assert list(scratch.iterdir()) == []


def test_purge_removes_day_old_spill(tmp_path):
    scratch = InferenceScratch(tmp_path)
    old = scratch.spill(b"pixels", ".img")
    os.utime(old, (time.time() - 90000, time.time() - 90000))
    fresh = scratch.spill(b"new", ".img")
    removed = scratch.purge()
    assert removed == 1
    assert not old.exists()
    assert fresh.exists()


def test_heavy_cloth_sags_more_than_light():
    light = render_tryon(
        silhouette="dress",
        color_hex="#111111",
        fabric={"weight": "lightweight", "stretch_index": 4, "weave": "satin"},
        measurements={"height_cm": 168, "chest_cm": 88, "waist_cm": 70, "hips_cm": 96},
    )
    heavy = render_tryon(
        silhouette="dress",
        color_hex="#111111",
        fabric={"weight": "heavy", "stretch_index": 4, "weave": "twill"},
        measurements={"height_cm": 168, "chest_cm": 88, "waist_cm": 70, "hips_cm": 96},
    )
    assert heavy["physics"]["hem_sag_px"] > light["physics"]["hem_sag_px"]
    assert heavy["physics"]["fold_count"] > light["physics"]["fold_count"]
    assert light["latency_ms"] < 2000


def test_google_and_apple_fail_closed_without_client_ids(client):
    assert client.post("/v1/auth/oauth/google", json={"id_token": "x"}).status_code == 501
    assert client.post("/v1/auth/oauth/apple", json={"id_token": "a.b.c"}).status_code == 501


def test_catalog_copies_match():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    source = open(os.path.join(root, "data", "catalog.json"), encoding="utf-8").read()
    web = os.path.join(root, "apps", "web", "data", "catalog.json")
    if os.path.exists(web):
        assert open(web, encoding="utf-8").read() == source


def _image(painter) -> bytes:
    image = Image.new("RGB", (160, 200), (250, 248, 244))
    painter(ImageDraw.Draw(image), 160, 200)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def _noise(draw, w, h):
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            shade = (x * 13 + y * 29) % 255
            draw.point((x, y), fill=(shade, shade // 2, 40))


def _diagonals(draw, w, h):
    for offset in range(-h, w, 6):
        draw.line([(offset, 0), (offset + h, h)], fill=(20, 20, 20), width=2)


def Path_inference(client: TestClient):
    from pathlib import Path

    return Path(client.app.state.hub.settings.inference_tmp)
