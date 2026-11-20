"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";

const STEPS = ["created", "paid", "confirmed", "packed", "shipped", "delivered"] as const;

export function OrderTracker({ orderId, initial }: { orderId: string; initial?: Order }) {
  const [order, setOrder] = useState<Order | undefined>(initial);

  useEffect(() => {
    const source = new EventSource(`/api/v1/orders/${encodeURIComponent(orderId)}/stream`);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.error) return;
      setOrder((prev) =>
        prev
          ? { ...prev, status: payload.status, timeline: payload.timeline ?? prev.timeline }
          : ({
              id: payload.id,
              status: payload.status,
              timeline: payload.timeline ?? [],
            } as Order),
      );
    };
    return () => source.close();
  }, [orderId]);

  if (!order) return <p className="text-sm text-[var(--muted)]">Connecting to live tracking…</p>;

  const index = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <div className="mt-6 grid gap-3">
      <p className="eyebrow">Live tracking</p>
      <ol className="grid gap-2">
        {STEPS.map((step, i) => (
          <li key={step} className={`text-sm ${i <= index ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
            {i <= index ? "●" : "○"} {step}
          </li>
        ))}
      </ol>
      <ul className="mt-2 grid gap-1 text-sm text-[var(--muted)]">
        {order.timeline?.map((entry, i) => (
          <li key={`${entry.status}-${i}`}>
            {entry.label} — {new Date(entry.at).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}