"use client";

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { inr } from "@/lib/format";
import type { Order } from "@/lib/types";

export function OrderView({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .order(id)
      .then((result) => setOrder(result.order))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Order not found."));
  }, [id]);

  if (error) return <p className="text-[var(--madder)]">{error}</p>;
  if (!order) return <div className="skeleton h-64 w-full" />;

  const upi = typeof order.payment.upi_uri === "string" ? order.payment.upi_uri : "";

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="eyebrow">Order {order.id}</p>
        <h1 className="serif text-5xl capitalize">{order.status.replaceAll("_", " ")}</h1>
        <ol className="mt-6 grid gap-3">
          {order.timeline.map((event) => (
            <li key={`${event.status}${event.at}`} className="border-l border-[var(--line)] pl-4">
              <p>{event.label}</p>
              <p className="text-sm text-[var(--muted)]">{new Date(event.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
            </li>
          ))}
        </ol>
        {upi && (
          <p className="mt-6 text-sm">
            UPI reference <span className="break-all">{upi}</span>
          </p>
        )}
        <p className="mt-4 text-sm text-[var(--muted)]">
          Payment reference {order.payment_ref}. This demo confirms the intent locally; Stripe and Razorpay are not charged.
        </p>
      </div>
      <aside className="border border-[var(--line)] p-5">
        <ul className="grid gap-3">
          {order.items.map((item) => (
            <li key={`${item.product_id}${item.size}${item.color}`} className="flex justify-between gap-3">
              <span>
                {item.name}
                <span className="block text-sm text-[var(--muted)]">
                  {item.color} / {item.size} × {item.qty}
                </span>
              </span>
              <span>{inr(item.line_total)}</span>
            </li>
          ))}
        </ul>
        <hr className="rule my-4" />
        <p className="flex justify-between">
          <span>Total</span>
          <span>{inr(order.total)}</span>
        </p>
      </aside>
    </div>
  );
}
