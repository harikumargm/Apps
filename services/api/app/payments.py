from __future__ import annotations

import secrets
from dataclasses import dataclass


@dataclass
class PaymentIntent:
    provider: str
    reference: str
    payload: dict


def create_intent(method: str, amount_inr: int, order_id: str) -> PaymentIntent:
    if method == "stripe":
        reference = "pi_" + secrets.token_hex(8)
        return PaymentIntent(
            "stripe",
            reference,
            {
                "client_secret": reference + "_secret_demo",
                "amount": amount_inr * 100,
                "currency": "inr",
                "mode": "demo",
            },
        )
    if method == "razorpay":
        reference = "order_" + secrets.token_hex(8)
        return PaymentIntent(
            "razorpay",
            reference,
            {
                "key_id": "rzp_test_sutra",
                "order_id": reference,
                "amount": amount_inr * 100,
                "currency": "INR",
                "mode": "demo",
            },
        )
    if method == "upi":
        reference = "upi_" + secrets.token_hex(6)
        uri = (
            f"upi://pay?pa=saicotton@okbank&pn=Sai%20Cotton%20Vastram%20Store&am={amount_inr}"
            f"&cu=INR&tn={order_id}&tr={reference}"
        )
        return PaymentIntent("upi", reference, {"upi_uri": uri, "reference": reference, "mode": "demo"})
    raise ValueError("Choose stripe, razorpay, or upi.")
