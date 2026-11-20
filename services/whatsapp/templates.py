"""WhatsApp Business template payloads (Meta Cloud API shape)."""

from __future__ import annotations

from typing import Any


def order_confirmation(order_id: str, total_inr: int) -> dict[str, Any]:
    return {
        "name": "order_confirmation",
        "language": {"code": "en"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": order_id},
                    {"type": "text", "text": f"₹{total_inr:,}"},
                ],
            }
        ],
    }


def shipping_update(tracking_url: str) -> dict[str, Any]:
    return {
        "name": "shipping_update",
        "language": {"code": "en"},
        "components": [{"type": "body", "parameters": [{"type": "text", "text": tracking_url}]}],
    }


def abandoned_cart(checkout_url: str) -> dict[str, Any]:
    return {
        "name": "abandoned_cart",
        "language": {"code": "en"},
        "components": [
            {
                "type": "body",
                "parameters": [{"type": "text", "text": checkout_url}],
            },
            {
                "type": "button",
                "sub_type": "url",
                "index": 0,
                "parameters": [{"type": "text", "text": "checkout"}],
            },
        ],
    }


def campaign_new_collection(collection_name: str, shop_url: str) -> dict[str, Any]:
    return {
        "name": "new_cotton_collection",
        "language": {"code": "en"},
        "components": [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": collection_name},
                    {"type": "text", "text": shop_url},
                ],
            }
        ],
    }