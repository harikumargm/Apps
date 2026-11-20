"use client";

import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  MessageSquare,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import { AdminStudioPanel } from "@/components/admin-studio-panel";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { products } from "@/lib/catalog";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/types";

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
};

type LiveOrder = {
  id: string;
  email: string;
  customer_name?: string;
  phone?: string;
  total: number;
  status: string;
  payment_method: string;
  items: OrderItem[];
  created_at: string;
};

type InventoryRow = {
  id: string;
  name: string;
  gender: string;
  category: string;
  color: string;
  size: string;
  stock: number;
  price: number;
  cottonVerified: boolean;
  gsm: string;
  image: string;
};

type UploadQueueItem = {
  tempId: string;
  fileName: string;
  previewUrl: string;
  status: "analyzing" | "ready" | "error";
  detectedName: string;
  gender: string;
  category: string;
  cottonConfidence: string;
  estimatedGsm: string;
  suggestedPrice: number;
  color: string;
  initialStock: number;
  size: string;
};

const TOKEN_KEY = "scv-admin-token";
const ALERT_SOUND =
  "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleR8CQJ7Z5YR5HgU+ltrykH4fBUKh3OaRfyAHRKrZ6JOEHwtJrt3plYsgC0uw4euZiyYOT7Xh7ZyMJhFOuOHubUYaD1C37+uajSMOUbjp8HA7GRA+TLzq7oI6IPk2/8+rhmIg+TcCy7eCbj0E9T8Kv5+OekEc+UcO17+Wi";

function productFor(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

function categoryLabel(product: Product | undefined, silhouette: string) {
  if (!product) return silhouette;
  const dept = product.departments.find((d) => !["men", "women", "combo_offers"].includes(d));
  return dept ?? product.silhouette;
}

function enrichInventory(rows: StockRow[]): InventoryRow[] {
  return rows.map((row) => {
    const product = productFor(row.product_id);
    const color = product?.colors[0]?.name ?? "—";
    const gsm = product?.fabric.gsm ? `${product.fabric.gsm} GSM` : "—";
    return {
      id: row.sku,
      name: row.name,
      gender: product?.audience === "women" ? "Women" : "Men",
      category: categoryLabel(product, product?.silhouette ?? "Apparel"),
      color,
      size: row.size,
      stock: row.qty,
      price: product?.price ?? 0,
      cottonVerified: Boolean(product?.fabric.ai_verified),
      gsm,
      image: product?.image ?? "/brand/vastram-mark.jpg",
    };
  });
}

function timeAgo(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hrs ago`;
  return new Date(iso).toLocaleString();
}

function paymentLabel(method: string) {
  if (method === "razorpay") return "Razorpay";
  if (method === "stripe") return "Stripe Card";
  if (method === "upi") return "UPI";
  if (method === "cod") return "COD (OTP Verified)";
  return method;
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"studio" | "inventory" | "upload" | "orders">("studio");
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "Men" | "Women">("All");
  const [liveToast, setLiveToast] = useState<LiveOrder | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [uploadedQueue, setUploadedQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

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

  const inventory = useMemo(() => enrichInventory(stock), [stock]);

  const loadAll = useCallback(async () => {
    setError("");
    setBusy("refresh");
    try {
      const h = headers();
      const [a, s, o] = await Promise.all([
        fetch("/api/v1/admin/analytics", { headers: h }),
        fetch("/api/v1/admin/catalog/stock-status", { headers: h }),
        fetch("/api/v1/admin/orders/recent?limit=20", { headers: h }),
      ]);
      if (!a.ok) {
        if (a.status === 401) {
          throw new Error(
            "Admin token rejected. It must match SCV_ADMIN_TOKEN on the API process (default after copying .env.example: scv-admin-dev).",
          );
        }
        if (a.status === 502 || a.status === 503 || a.status === 504) {
          throw new Error("Admin API is not reachable. Start the API on port 8000, then Connect again.");
        }
        throw new Error(`Admin API error (${a.status}). Check Vite proxy and API logs.`);
      }
      setAnalytics(await a.json());
      const stockJson = await s.json();
      setStock(stockJson.variants ?? []);
      setOrders((await o.json()).orders ?? []);
      setAuthed(true);
      localStorage.setItem(TOKEN_KEY, token);
    } catch (caught) {
      setAuthed(false);
      if (caught instanceof TypeError && /fetch/i.test(caught.message)) {
        setError("Could not reach /api — is the API running on port 8000 and is npm run dev proxying?");
      } else {
        setError(caught instanceof Error ? caught.message : "Could not reach admin API.");
      }
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
      setOrders((prev) => [data.order, ...prev]);
      setUnreadAlerts((n) => n + 1);
      setLiveToast(data.order);
      audio.current?.play().catch(() => undefined);
      window.setTimeout(() => setLiveToast(null), 6000);
    };
    return () => es.close();
  }, [authed, token]);

  const filteredInventory = useMemo(
    () =>
      inventory.filter((item) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q);
        const matchesCategory = categoryFilter === "All" || item.gender === categoryFilter;
        return matchesSearch && matchesCategory;
      }),
    [inventory, searchQuery, categoryFilter],
  );

  const lowStockCount = inventory.filter((i) => i.stock > 0 && i.stock < 10).length;
  const outOfStockCount = inventory.filter((i) => i.stock === 0).length;
  const todayRevenue = analytics?.revenue_paise ?? orders.reduce((acc, o) => acc + o.total, 0);
  const defaultStudioSource =
    products.find((p) => p.image)?.image ?? "/catalog/olive-peacock-tee.jpg";

  async function patchStock(sku: string, qty: number) {
    setBusy(sku);
    try {
      const res = await fetch("/api/v1/admin/inventory", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ sku, qty }),
      });
      if (!res.ok) throw new Error("Stock update failed.");
      setStock((prev) =>
        prev.map((row) =>
          row.sku === sku
            ? { ...row, qty, out_of_stock: qty <= 0, low_stock: qty > 0 && qty < 10 }
            : row,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stock update failed.");
    } finally {
      setBusy("");
    }
  }

  function updateStock(id: string, delta: number) {
    const row = stock.find((r) => r.sku === id);
    if (!row || !authed) return;
    void patchStock(id, Math.max(0, row.qty + delta));
  }

  async function importCsv() {
    const rows = csv
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [sku, qtyRaw] = line.split(/[,;\t]/).map((p) => p.trim());
        const qty = Number(qtyRaw);
        return sku && Number.isFinite(qty) ? { sku, qty } : null;
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

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length || !authed) return;
    const fileArray = Array.from(files);
    const pending: UploadQueueItem[] = fileArray.map((file, idx) => ({
      tempId: `TMP-${Date.now()}-${idx}`,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "analyzing",
      detectedName: file.name.replace(/\.[^.]+$/, ""),
      gender: "Men",
      category: "Apparel",
      cottonConfidence: "Scanning…",
      estimatedGsm: "—",
      suggestedPrice: 999,
      color: "—",
      initialStock: 25,
      size: "M",
    }));
    setUploadedQueue((prev) => [...pending, ...prev]);

    const body = new FormData();
    fileArray.forEach((file) => body.append("files", file));
    try {
      const res = await fetch("/api/v1/admin/products/ingest-images", {
        method: "POST",
        headers: { "X-Admin-Token": token },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed.");
      setUploadedQueue((prev) =>
        prev.map((item) => {
          const hit = (data.results as Array<{ filename: string; categorization: Record<string, unknown>; fabric?: Record<string, unknown> }>).find(
            (r) => r.filename === item.fileName,
          );
          if (!pending.some((p) => p.tempId === item.tempId)) return item;
          if (!hit) return { ...item, status: "error" as const };
          const cat = hit.categorization;
          const fabric = hit.fabric ?? {};
          return {
            ...item,
            status: "ready" as const,
            detectedName: String(cat.seo_title ?? cat.suggested_slug ?? item.detectedName),
            gender: String(cat.audience ?? "men") === "women" ? "Women" : "Men",
            category: String(cat.silhouette ?? "Apparel"),
            cottonConfidence: fabric.fabric_badge ? String(fabric.fabric_badge) : "Cotton blend",
            estimatedGsm: fabric.estimated_gsm ? `${fabric.estimated_gsm} GSM` : item.estimatedGsm,
            suggestedPrice: 1299,
            color: String((cat.dominant_color as { name?: string })?.name ?? "Detected"),
          };
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setUploadedQueue((prev) =>
        prev.map((item) => (pending.some((p) => p.tempId === item.tempId) ? { ...item, status: "error" } : item)),
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function publishUploadToCatalog(tempId: string) {
    setUploadedQueue((prev) => prev.filter((u) => u.tempId !== tempId));
  }

  function publishAllReady() {
    setUploadedQueue((prev) => prev.filter((u) => u.status !== "ready"));
  }

  function orderItemsSummary(order: LiveOrder) {
    return order.items.map((i) => `${i.name} (${i.size}) x ${i.qty}`).join(", ");
  }

  function simulateDemoOrder() {
    const demo: LiveOrder = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      email: "demo@scv.test",
      customer_name: "Priya Nair",
      phone: "+91 99887 76655",
      total: 139900,
      status: "paid",
      payment_method: "razorpay",
      created_at: new Date().toISOString(),
      items: [{ name: "Cotton kurta", size: "M", color: "Ivory", qty: 1 }],
    };
    setOrders((prev) => [demo, ...prev]);
    setUnreadAlerts((n) => n + 1);
    setLiveToast(demo);
    audio.current?.play().catch(() => undefined);
    window.setTimeout(() => setLiveToast(null), 6000);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 w-96 max-w-[calc(100vw-2rem)] bg-slate-900 text-white rounded-xl shadow-2xl border border-emerald-500/40 p-4 animate-bounce">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">New online purchase · {liveToast.id}</span>
            </div>
            <button type="button" onClick={() => setLiveToast(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 font-semibold text-sm">{liveToast.customer_name || liveToast.email}</p>
          <p className="text-xs text-slate-300 mt-0.5">{orderItemsSummary(liveToast)}</p>
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-400">
              {inr(liveToast.total)} ({paymentLabel(liveToast.payment_method)})
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              WhatsApp receipt queued
            </span>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Vastram Cotton Admin</h1>
              <p className="text-xs text-slate-500">100% cotton apparel · web & mobile catalog sync</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs text-slate-500 min-w-[200px] flex-1">
              Admin token
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900"
                placeholder="scv-admin-dev"
                autoComplete="off"
              />
              <span className="text-[10px] text-slate-400">
                Same value as <code className="font-mono">SCV_ADMIN_TOKEN</code> in repo <code className="font-mono">.env</code> (see{" "}
                <code className="font-mono">.env.example</code>).
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                setToken("scv-admin-dev");
                localStorage.removeItem(TOKEN_KEY);
              }}
              className="h-10 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Use dev default
            </button>
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={!token || busy === "refresh"}
              className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50"
            >
              {authed ? "Reconnect" : "Connect"}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("orders");
                setUnreadAlerts(0);
              }}
              className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Bell className="w-5 h-5" />
              {unreadAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadAlerts}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi label="Today's revenue" value={inr(todayRevenue)} hint="Razorpay & Stripe webhooks" icon={<TrendingUp className="w-4 h-4 text-emerald-600" />} />
          <Kpi label="Active cotton SKUs" value={`${inventory.length} variants`} hint="Live catalog sync" icon={<Package className="w-4 h-4 text-blue-600" />} />
          <Kpi
            label="Low / out of stock"
            value={`${lowStockCount} low · ${outOfStockCount} out`}
            hint="Storefront badges auto-sync"
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          />
          <Kpi
            label="Orders tracked"
            value={`${analytics?.order_count ?? orders.length}`}
            hint={`Cart abandonment ${Math.round((analytics?.cart_abandonment_estimate ?? 0.12) * 100)}%`}
            icon={<MessageSquare className="w-4 h-4 text-emerald-600" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 mb-6">
          <TabButton active={activeTab === "studio"} onClick={() => setActiveTab("studio")} icon={<Wand2 className="w-4 h-4 text-violet-500" />}>
            Display studio
          </TabButton>
          <TabButton active={activeTab === "inventory"} onClick={() => setActiveTab("inventory")} icon={<Package className="w-4 h-4" />}>
            SKU stock management
          </TabButton>
          <TabButton active={activeTab === "upload"} onClick={() => setActiveTab("upload")} icon={<Sparkles className="w-4 h-4 text-emerald-500" />}>
            Bulk AI image upload
          </TabButton>
          <TabButton
            active={activeTab === "orders"}
            onClick={() => {
              setActiveTab("orders");
              setUnreadAlerts(0);
            }}
            icon={<Bell className="w-4 h-4" />}
          >
            Live purchase feed ({orders.length})
          </TabButton>
        </div>

        {activeTab === "studio" && (
          <AdminStudioPanel
            defaultSource={defaultStudioSource}
            adminToken={token}
            catalogProducts={products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, audience: p.audience }))}
          />
        )}

        {activeTab === "inventory" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search SKU, tees, palazzos, cargos…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                {(["All", "Men", "Women"] as const).map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => setCategoryFilter(gender)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      categoryFilter === gender ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-b border-slate-100 grid gap-2 lg:grid-cols-[1fr_auto]">
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={2}
                placeholder="Bulk CSV: p_olive_tee|L,12"
                className="text-sm border border-slate-200 rounded-lg p-2 w-full"
              />
              <button type="button" disabled={!authed} onClick={() => void importCsv()} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold self-end">
                Import stock CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Product & SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">AI fabric check</th>
                    <th className="py-3 px-4">Variant</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4 text-right">Quick adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInventory.map((item) => {
                    const isLow = item.stock > 0 && item.stock < 10;
                    const isOut = item.stock === 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img src={item.image} alt="" className="w-11 h-11 rounded-lg object-cover border border-slate-200" />
                            <div>
                              <p className="font-semibold">{item.name}</p>
                              <p className="text-xs font-mono text-slate-500">{item.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100">
                            <Tag className="w-3 h-3" />
                            {item.gender} · {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {item.cottonVerified ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Verified cotton ({item.gsm})
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Pending scan</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          Size <strong>{item.size}</strong> · {item.color}
                        </td>
                        <td className="py-3 px-4 font-semibold">{inr(item.price)}</td>
                        <td className="py-3 px-4">
                          {isOut ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">Out ({item.stock})</span>
                          ) : isLow ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Low ({item.stock})</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">In stock ({item.stock})</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button type="button" disabled={!authed || busy === item.id} onClick={() => updateStock(item.id, -1)} className="p-1 hover:bg-white rounded">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-mono text-xs font-bold">{item.stock}</span>
                            <button type="button" disabled={!authed || busy === item.id} onClick={() => updateStock(item.id, 1)} className="p-1 hover:bg-white rounded">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "upload" && (
          <div className="space-y-6">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={() => undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer ${
                isDragging ? "border-emerald-500 bg-emerald-50/60" : "border-slate-300 bg-white hover:border-emerald-400"
              }`}
            >
              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => void handleFilesSelected(e.target.files)} />
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold">Drop raw clothing photos or click to browse</h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1.5">
                AI verifies cotton weave/GSM, extracts colour, and routes into Men&apos;s or Women&apos;s categories.
              </p>
            </div>

            {uploadedQueue.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    AI categorization queue
                  </h4>
                  <button type="button" onClick={publishAllReady} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg">
                    Clear all ready
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uploadedQueue.map((item) => (
                    <div key={item.tempId} className="border border-slate-200 rounded-xl p-4 flex gap-4 bg-slate-50/50">
                      <img src={item.previewUrl} alt="" className="w-20 h-24 rounded-lg object-cover border shrink-0" />
                      <div className="flex-1 min-w-0">
                        {item.status === "analyzing" ? (
                          <div className="py-4 space-y-2 text-xs font-bold text-emerald-600">
                            <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                            Scanning weave & silhouette…
                          </div>
                        ) : item.status === "error" ? (
                          <p className="text-sm text-rose-600">Ingest failed. Retry upload.</p>
                        ) : (
                          <>
                            <div className="flex justify-between gap-2 text-xs">
                              <span className="font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                {item.cottonConfidence} · {item.estimatedGsm}
                              </span>
                              <span className="font-bold">{inr(item.suggestedPrice)}</span>
                            </div>
                            <input
                              type="text"
                              value={item.detectedName}
                              onChange={(e) =>
                                setUploadedQueue((prev) =>
                                  prev.map((u) => (u.tempId === item.tempId ? { ...u, detectedName: e.target.value } : u)),
                                )
                              }
                              className="mt-2 w-full text-sm font-bold border border-slate-200 rounded px-2 py-1"
                            />
                            <p className="text-xs mt-1">
                              {item.gender} · {item.category} · stock {item.initialStock}
                            </p>
                            <button
                              type="button"
                              onClick={() => publishUploadToCatalog(item.tempId)}
                              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve ingest job
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Real-time purchase stream</h3>
                <p className="text-xs text-slate-500">SSE when admin token is valid — or trigger a demo alert.</p>
              </div>
              <button
                type="button"
                onClick={simulateDemoOrder}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg"
              >
                + Trigger test order
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {orders.length === 0 && <p className="p-4 text-sm text-slate-500">No orders yet.</p>}
              {orders.map((order) => (
                <div key={order.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">{order.id}</span>
                      <span className="font-bold text-sm">{order.customer_name || order.email}</span>
                      {order.phone && <span className="text-xs text-slate-500">{order.phone}</span>}
                      <span className="text-xs text-emerald-600">· {timeAgo(order.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">{orderItemsSummary(order)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold">{inr(order.total)}</p>
                      <p className="text-xs text-slate-500">{paymentLabel(order.payment_method)} · {order.status}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp queued
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
        <span className="uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
        active ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}