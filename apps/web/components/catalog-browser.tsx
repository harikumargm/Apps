"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { products } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";

const AUDIENCES = ["men", "women", "kids"];
const OCCASIONS = ["festive", "casual", "work"];
const FABRICS = ["Cotton", "Silk", "Linen", "Synthetic blend"];

export function CatalogBrowser() {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const audience = params.get("audience") || "";
  const occasion = params.get("occasion") || "";
  const silhouette = params.get("silhouette") || "";
  const fabric = params.get("fabric")?.split(",").filter(Boolean) || [];
  const size = params.get("size") || "";
  const color = params.get("color") || "";
  const q = params.get("q") || "";
  const sort = params.get("sort") || "featured";
  const minPrice = Number(params.get("min") || 0);
  const maxPrice = Number(params.get("max") || 0);

  function update(next: Record<string, string>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) query.delete(key);
      else query.set(key, value);
    }
    router.replace(`/catalog?${query.toString()}`, { scroll: false });
  }

  const sizes = useMemo(() => Array.from(new Set(products.flatMap((product) => product.sizes))), []);
  const colors = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((product) => product.colors.forEach((entry) => map.set(entry.name, entry.hex)));
    return Array.from(map.entries());
  }, []);

  const visible = useMemo(() => {
    let items = products.slice();
    if (audience) items = items.filter((product) => product.audience === audience);
    if (occasion) items = items.filter((product) => product.occasion === occasion);
    if (silhouette) items = items.filter((product) => product.silhouette === silhouette);
    if (fabric.length) items = items.filter((product) => fabric.includes(product.fabric.type));
    if (size) items = items.filter((product) => product.sizes.includes(size));
    if (color) items = items.filter((product) => product.colors.some((entry) => entry.name === color));
    if (minPrice) items = items.filter((product) => product.price >= minPrice);
    if (maxPrice) items = items.filter((product) => product.price <= maxPrice);
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter(
        (product) =>
          product.name.toLowerCase().includes(needle) ||
          product.summary.toLowerCase().includes(needle) ||
          product.fabric.type.toLowerCase().includes(needle),
      );
    }
    if (sort === "price_asc") items.sort((a, b) => a.price - b.price);
    if (sort === "price_desc") items.sort((a, b) => b.price - a.price);
    return items;
  }, [audience, occasion, silhouette, fabric, size, color, q, sort, minPrice, maxPrice]);

  function toggleFabric(name: string) {
    const next = fabric.includes(name) ? fabric.filter((item) => item !== name) : [...fabric, name];
    update({ fabric: next.join(",") });
  }

  const filters = (
    <div className="grid gap-6">
      <FilterGroup label="Who">
        <button className={`chip ${audience === "" ? "active" : ""}`} onClick={() => update({ audience: "" })}>
          All
        </button>
        {AUDIENCES.map((item) => (
          <button key={item} className={`chip capitalize ${audience === item ? "active" : ""}`} onClick={() => update({ audience: item })}>
            {item}
          </button>
        ))}
      </FilterGroup>
      <FilterGroup label="Cut">
        <button className={`chip ${silhouette === "" ? "active" : ""}`} onClick={() => update({ silhouette: "" })}>
          All
        </button>
        <button className={`chip ${silhouette === "tshirt" ? "active" : ""}`} onClick={() => update({ silhouette: "tshirt" })}>
          T-Shirts
        </button>
      </FilterGroup>
      <FilterGroup label="Occasion">
        <button className={`chip ${occasion === "" ? "active" : ""}`} onClick={() => update({ occasion: "" })}>
          All
        </button>
        {OCCASIONS.map((item) => (
          <button key={item} className={`chip capitalize ${occasion === item ? "active" : ""}`} onClick={() => update({ occasion: item })}>
            {item}
          </button>
        ))}
      </FilterGroup>
      <FilterGroup label="AI fabric">
        {FABRICS.map((item) => (
          <button key={item} className="chip" aria-pressed={fabric.includes(item)} onClick={() => toggleFabric(item)}>
            {item}
          </button>
        ))}
      </FilterGroup>
      <FilterGroup label="Size">
        <button className={`chip ${size === "" ? "active" : ""}`} onClick={() => update({ size: "" })}>
          All
        </button>
        {sizes.map((item) => (
          <button key={item} className={`chip ${size === item ? "active" : ""}`} onClick={() => update({ size: item })}>
            {item}
          </button>
        ))}
      </FilterGroup>
      <div>
        <p className="eyebrow mb-2">Colour</p>
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${color === "" ? "active" : ""}`} onClick={() => update({ color: "" })}>
            All
          </button>
          {colors.map(([name, hex]) => (
            <button
              key={name}
              aria-label={name}
              aria-pressed={color === name}
              title={name}
              onClick={() => update({ color: name })}
              className="h-8 w-8 border border-[var(--line)]"
              style={{ background: hex, outline: color === name ? "2px solid var(--ink)" : undefined, outlineOffset: 2 }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">
          <span>Min ₹</span>
          <input
            inputMode="numeric"
            value={minPrice || ""}
            onChange={(event) => update({ min: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Max ₹</span>
          <input
            inputMode="numeric"
            value={maxPrice || ""}
            onChange={(event) => update({ max: event.target.value })}
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">The edit</p>
          <h1 className="serif text-5xl md:text-6xl">Catalog</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-line md:hidden" onClick={() => setOpen((value) => !value)}>
            Filters
          </button>
          <label className="field">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(event) => update({ sort: event.target.value })} aria-label="Sort">
              <option value="featured">Featured</option>
              <option value="price_asc">Price, low</option>
              <option value="price_desc">Price, high</option>
            </select>
          </label>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {visible.length} piece{visible.length === 1 ? "" : "s"}
        {q ? ` for “${q}”` : ""}
      </p>
      <div className="mt-8 grid gap-10 md:grid-cols-[240px_1fr]">
        <aside className={`${open ? "block" : "hidden"} md:block`}>{filters}</aside>
        {visible.length === 0 ? (
          <p className="text-[var(--muted)]">Nothing matches those filters. Clear one and the cloth comes back.</p>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function catalogFallback(): Product[] {
  return products;
}
