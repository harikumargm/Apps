"""WhatsApp Cloud API client — demo mode when WHATSAPP_TOKEN is unset."""

from __future__ import annotations

import os
from typing import Any

import httpx


def send_template(phone: str, template: dict[str, Any]) -> dict[str, Any]:
    token = os.environ.get("WHATSAPP_TOKEN", "")
    phone_id = os.environ.get("WHATSAPP_PHONE_ID", "")
    if not token or not phone_id:
        return {"demo": True, "to": phone, "template": template["name"]}

    payload = {
        "messaging_product": "whatsapp",
        "to": phone.replace(" ", "").replace("+", ""),
        "type": "template",
        "template": template,
    }
    response = httpx.post(
        f"https://graph.facebook.com/v20.0/{phone_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
        timeout=15,
    )
    response.raise_for_status()
    return response.json()