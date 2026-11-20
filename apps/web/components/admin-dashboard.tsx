"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, Package, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { inr } from "@/lib/format";

type Analytics = {
  revenue_paise: number;
  order_count: number;
  low_stock_skus: number;
  cart_abandonment_estimate: number;
  return_rate: number;
};

type StockRow = {
  sku: string;
  product_id: string;
  name: string;
  size: string;
  qty: number;
  out_of_stock: boolean;
  low_stock: boolean;
};

type OrderItem = {
  name: string;
  size: string;
  color: string;
  qty: number;
  line_total?: number;
};

type LiveOrder = {
  id: string;
  email: string;
  customer_name?: string;
  phone?: string;
  total: number;
  status: string;
  payment_method: string;
  payment_ref?: string | null;
  items: OrderItem[];
  created_at: string;
};

type IngestResult = {
  filename?: string;
  job_id: string;
  categorization: {
    seo_title?: string;
    suggested_slug?: string;
    silhouette?: string;
    audience?: string;
  };
};

const TOKEN_KEY = "scv-admin-token";
const ALERT_SOUND =
  "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleR8CQJ7Z5YR5HgU+ltrykH4fBUKh3OaRfyAHRKrZ6JOEHwtJrt3plYsgC0uw4euZiyYOT7Xh7ZyMJhFOuOHubUYaD1C37+uajSMOUbjp8HA7GRA+TLzq7oI6IPk2/8+rhmIg+TcCy7eCbj0E9T8Kv5+OekEc+UcO17+Wi";

export function AdminDashboard() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [recentOrders, setRecentOrders] = useState<LiveOrder[]>([]);
  const [alerts, setAlerts] = useState<LiveOrder[]>([]);
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [draftQty, setDraftQty] = useState("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState("");
  const [uploadLog, setUploadLog] = useState<IngestResult[]>([]);
  const [audienceHint, setAudienceHint] = useState("");
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    audio.current = new Audio(ALERT_SOUND);
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  const headers = useCallback(
    () => ({
      "X-Admin-Token": token,
      "Content-Type": "application/json",
    }),
    [token],
  );

  const loadAll = useCallback(async () => {
    setError("");
    setBusy("refresh");
    try {
      const h = headers();
      const [a, s, o] = await Promise.all([
        fetch("/api/v1/admin/analytics", { headers: h }),
        fetch("/api/v1/admin/catalog/stock-status", { headers: h }),
        fetch("/api/v1/admin/orders/recent?limit=15", { headers: h }),
      ]);
      if (!a.ok) throw new Error("Invalid admin token.");
      const analyticsJson = await a.json();
      const stockJson = await s.json();
      const ordersJson = await o.json();
      setAnalytics(analyticsJson);
      setStock(stockJson.variants ?? []);
      setRecentOrders(ordersJson.orders ?? []);
      setAuthed(true);
      localStorage.setItem(TOKEN_KEY, token);
    } catch (caught) {
      setAuthed(false);
      setError(caught instanceof Error ? caught.message : "Could not reach admin API.");
    } finally {
      setBusy("");
    }
  }, [headers, token]);

  useEffect(() => {
    if (!authed || !token) return;
    const es = new EventSource(`/api/v1/admin/orders/stream?admin_token=${encodeURIComponent(token)}`);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data) as { type: string; order: LiveOrder };
      if (data.type !== "new_order") return;
      setRecentOrders((prev) => [data.order, ...prev].slice(0, 20));
      setAlerts((prev) => [data.order, ...prev].slice(0, 5));
      audio.current?.play().catch(() => undefined);
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [authed, token]);

  const visibleStock = useMemo(() => {
    return stock.filter((row) => {
      if (stockFilter === "low") return row.low_stock;
      if (stockFilter === "out") return row.out_of_stock;
      return true;
    });
  }, [stock, stockFilter]);

  async function saveSku(row: StockRow) {
    const qty = Number(draftQty);
    if (!Number.isFinite(qty) || qty < 0) return;
    setBusy(row.sku);
    try {
      const res = await fetch("/api/v1/admin/inventory", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ sku: row.sku, qty }),
      });
      if (!res.ok) throw new Error("Stock update failed.");
      setStock((prev) =>
        prev.map((item) =>
          item.sku === row.sku
            ? {
                ...item,
                qty,
                out_of_stock: qty <= 0,
                low_stock: qty > 0 && qty < 10,
              }
            : item,
        ),
      );
      setEditingSku(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stock update failed.");
    } finally {
      setBusy("");
    }
  }

  async function importCsv() {
    const lines = csv
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const rows = lines
      .map((line) => {
        const [sku, qtyRaw] = line.split(/[,;\t]/).map((part) => part.trim());
        const qty = Number(qtyRaw);
        if (!sku || !Number.isFinite(qty)) return null;
        return { sku, qty };
      })
      .filter(Boolean) as { sku: string; qty: number }[];
    if (!rows.length) {
      setError("Paste CSV as sku,qty per line.");
      return;
    }
    setBusy("csv");
    try {
      const res = await fetch("/api/v1/admin/inventory/import", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error("Import failed.");
      await loadAll();
      setCsv("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setBusy("");
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setError("");
    const body = new FormData();
    Array.from(files).forEach((file) => body.append("files", file));
    if (audienceHint) body.append("audience_hint", audienceHint);
    try {
      const res = await fetch("/api/v1/admin/products/ingest-images", {
        method: "POST",
        headers: { "X-Admin-Token": token },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed.");
      setUploadLog((prev) => [...(data.results as IngestResult[]), ...prev].slice(0, 12));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="admin-shell pb-16">
      <header className="admin-top">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="serif text-4xl md:text-5xl">Studio control</h1>
        </div>
        <div className="admin-auth">
          <label className="field min-w-[220px] flex-1">
            <span>Admin token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="scv-admin-dev"
              onKeyDown={(e) => e.key === "Enter" && void loadAll()}
            />
          </label>
          <button className="btn btn-solid" disabled={!token || busy === "refresh"} onClick={() => void loadAll()}>
            {authed ? "Refresh" : "Connect"}
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-4 border border-[var(--campaign)] p-3 text-sm text-[var(--campaign)]" role="alert">
          {error}
        </p>
      )}

      <AnimatePresence>
        {alerts.map((order) => (
          <motion.div
            key={order.id}
            className="admin-toast"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 40 }}
            role="status"
          >
            <Bell size={18} />
            <div>
              <p className="font-medium">New online order · {inr(order.total)}</p>
              <p className="text-sm text-[var(--muted)]">
                {order.customer_name || order.email} · {order.payment_method} · {order.status}
              </p>
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => setAlerts((prev) => prev.filter((o) => o.id !== order.id))}>
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {analytics && (
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Revenue" value={inr(analytics.revenue_paise)} />
          <Kpi label="Orders" value={String(analytics.order_count)} />
          <Kpi label="Low stock SKUs" value={String(analytics.low_stock_skus)} accent={analytics.low_stock_skus > 0} />
          <Kpi label="Cart abandonment" value={`${Math.round(analytics.cart_abandonment_estimate * 100)}%`} />
        </section>
      )}

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="admin-panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="serif text-2xl">Live purchase alerts</h2>
            <span className="admin-live-pill">{authed ? "Streaming" : "Offline"}</span>
          </div>
          <ul className="grid gap-3">
            {recentOrders.length === 0 && <li className="text-sm text-[var(--muted)]">No orders yet. Alerts appear when checkout completes.</li>}
            {recentOrders.map((order) => (
              <li key={order.id} className="admin-order-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{order.customer_name || order.email}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {order.phone ? `${order.phone} · ` : ""}
                      {order.payment_method} · {order.status}
                    </p>
                  </div>
                  <p className="serif text-xl">{inr(order.total)}</p>
                </div>
                <ul className="mt-2 grid gap-1 text-sm text-[var(--muted)]">
                  {order.items.map((item, index) => (
                    <li key={`${order.id}-${index}`}>
                      {item.qty}× {item.name} ({item.color}/{item.size})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-panel">
          <h2 className="serif mb-4 text-2xl">Bulk image upload</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">AI categorizes garment type, colour, and SEO copy per file.</p>
          <label className="field mb-3">
            <span>Audience hint (optional)</span>
            <select value={audienceHint} onChange={(e) => setAudienceHint(e.target.value)}>
              <option value="">Auto</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>
          </label>
          <button
            type="button"
            className="admin-dropzone"
            disabled={!authed || busy === "upload"}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void uploadImages(e.dataTransfer.files);
            }}
          >
            <Upload size={22} />
            <span>{busy === "upload" ? "Processing…" : "Drop photos or click to upload"}</span>
            <span className="text-xs text-[var(--muted)]">JPG / PNG · multiple files</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => void uploadImages(e.target.files)}
          />
          {uploadLog.length > 0 && (
            <ul className="mt-4 grid gap-2 text-sm">
              {uploadLog.map((entry) => (
                <li key={entry.job_id} className="border border-[var(--line)] p-2">
                  <p className="font-medium">{entry.filename}</p>
                  <p className="text-[var(--muted)]">
                    {entry.categorization.audience} · {entry.categorization.silhouette} · {entry.categorization.suggested_slug}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="admin-panel mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="serif flex items-center gap-2 text-2xl">
            <Package size={22} />
            SKU stock
          </h2>
          <div className="flex flex-wrap gap-2">
            {(["all", "low", "out"] as const).map((key) => (
              <button key={key} className={`chip capitalize ${stockFilter === key ? "active" : ""}`} onClick={() => setStockFilter(key)}>
                {key === "out" ? "Out of stock" : key}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="field">
            <span>Bulk CSV (sku,qty per line)</span>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="p_olive_tee|L,12" rows={3} />
          </label>
          <button className="btn btn-line self-end" disabled={!authed || busy === "csv"} onClick={() => void importCsv()}>
            Import stock
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Size</th>
                <th>Qty</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleStock.map((row) => (
                <tr key={row.sku}>
                  <td className="font-mono text-xs">{row.sku}</td>
                  <td>{row.name}</td>
                  <td>{row.size}</td>
                  <td>
                    {editingSku === row.sku ? (
                      <input
                        className="admin-qty-input"
                        value={draftQty}
                        inputMode="numeric"
                        onChange={(e) => setDraftQty(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void saveSku(row)}
                      />
                    ) : (
                      row.qty
                    )}
                  </td>
                  <td>
                    <span className={`admin-badge ${row.out_of_stock ? "admin-badge-out" : row.low_stock ? "admin-badge-low" : "admin-badge-ok"}`}>
                      {row.out_of_stock ? "Out of stock" : row.low_stock ? "Low" : "In stock"}
                    </span>
                  </td>
                  <td className="text-right">
                    {editingSku === row.sku ? (
                      <button className="chip active" disabled={busy === row.sku} onClick={() => void saveSku(row)}>
                        Save
                      </button>
                    ) : (
                      <button
                        className="chip"
                        disabled={!authed}
                        onClick={() => {
                          setEditingSku(row.sku);
                          setDraftQty(String(row.qty));
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`admin-kpi ${accent ? "admin-kpi-alert" : ""}`}>
      <p className="eyebrow">{label}</p>
      <p className="serif text-3xl">{value}</p>
    </div>
  );
}
