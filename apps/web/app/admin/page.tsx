"use client";

import { useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";

type Analytics = {
  revenue_paise: number;
  order_count: number;
  low_stock_skus: number;
  cart_abandonment_estimate: number;
  return_rate: number;
};

type StockRow = {
  product_id: string;
  name: string;
  size: string;
  qty: number;
  out_of_stock: boolean;
  low_stock: boolean;
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [toast, setToast] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audio.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleR8CQJ7Z5YR5HgU+ltrykH4fBUKh3OaRfyAHRKrZ6JOEHwtJrt3plYsgC0uw4euZiyYOT7Xh7ZyMJhFOuOHubUYaD1C37+uajSMOUbjp8HA7GRA+TLzq7oI6IPk2/8+rhmIg+TcCy7eCbj0E9T8Kv5+OekEc+UcO17+Wi");
  }, []);

  async function headers() {
    return { "X-Admin-Token": token, "Content-Type": "application/json" };
  }

  async function load() {
    const [a, s] = await Promise.all([
      fetch("/api/v1/admin/analytics", { headers: await headers() }).then((r) => r.json()),
      fetch("/api/v1/admin/catalog/stock-status", { headers: await headers() }).then((r) => r.json()),
    ]);
    setAnalytics(a);
    setStock(s.variants ?? []);
  }

  useEffect(() => {
    if (!token) return;
    void load();
    const es = new EventSource(`/api/v1/admin/orders/stream?admin_token=${encodeURIComponent(token)}`);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_order") {
        setToast(`New order ${data.order.id} · ${inr(data.order.total)}`);
        audio.current?.play().catch(() => undefined);
      }
    };
    return () => es.close();
  }, [token]);

  return (
    <div className="page py-10">
      <p className="eyebrow">Admin</p>
      <h1 className="serif text-5xl">Studio control</h1>
      <label className="field mt-6 max-w-md">
        <span>Admin token</span>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <button className="btn btn-solid mt-3" onClick={() => void load()} disabled={!token}>
        Refresh
      </button>
      {toast && (
        <p className="mt-4 border border-[var(--ink)] bg-[var(--paper)] p-3 text-sm" role="status">
          {toast}
        </p>
      )}
      {analytics && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="border border-[var(--line)] p-4">
            <p className="eyebrow">Revenue</p>
            <p className="serif text-3xl">{inr(analytics.revenue_paise)}</p>
          </div>
          <div className="border border-[var(--line)] p-4">
            <p className="eyebrow">Orders</p>
            <p className="serif text-3xl">{analytics.order_count}</p>
          </div>
          <div className="border border-[var(--line)] p-4">
            <p className="eyebrow">Low stock SKUs</p>
            <p className="serif text-3xl">{analytics.low_stock_skus}</p>
          </div>
        </div>
      )}
      <div className="mt-10 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-[var(--muted)]">
              <th className="py-2">Product</th>
              <th className="py-2">Size</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {stock.slice(0, 40).map((row) => (
              <tr key={`${row.product_id}-${row.size}`} className="border-b border-[var(--line)]">
                <td className="py-2">{row.name}</td>
                <td className="py-2">{row.size}</td>
                <td className="py-2">{row.qty}</td>
                <td className="py-2">{row.out_of_stock ? "Out of stock" : row.low_stock ? "Low" : "OK"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}