"use client";

import Link from "next/link";
import { inr } from "@/lib/format";
import { lineKey, useStore } from "@/lib/store";
import { ProductVisual } from "@/components/product-card";
import { products } from "@/lib/catalog";

export default function CartPage() {
  const items = useStore((state) => state.items);
  const setQty = useStore((state) => state.setQty);
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
  const shipping = subtotal === 0 || subtotal >= 2500 ? 0 : 149;
  return (
    <div className="page py-10">
      <h1 className="serif text-6xl">Bag</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-[var(--muted)]">
          Empty. <Link href="/catalog">Return to the edit.</Link>
        </p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <ul className="grid gap-5">
            {items.map((item) => (
              <li key={lineKey(item)} className="grid grid-cols-[120px_1fr] gap-4 border-b border-[var(--line)] pb-5">
                <div className="art-frame">
                  <ProductVisual
                    silhouette={item.silhouette}
                    color={item.hex}
                    weave="plain"
                    name={item.name}
                    image={products.find((product) => product.slug === item.slug)?.image}
                  />
                </div>
                <div>
                  <Link href={`/product/${item.slug}`} className="serif text-3xl">
                    {item.name}
                  </Link>
                  <p className="text-sm text-[var(--muted)]">
                    {item.color} / {item.size}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button aria-label="Decrease" onClick={() => setQty(lineKey(item), item.qty - 1)}>
                      −
                    </button>
                    <span>{item.qty}</span>
                    <button aria-label="Increase" onClick={() => setQty(lineKey(item), item.qty + 1)}>
                      +
                    </button>
                    <span className="ml-auto">{inr(item.unit_price * item.qty)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="h-fit border border-[var(--line)] p-5">
            <p className="flex justify-between">
              <span>Subtotal</span>
              <span>{inr(subtotal)}</span>
            </p>
            <p className="mt-2 flex justify-between">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Complimentary" : inr(shipping)}</span>
            </p>
            <p className="mt-2 flex justify-between text-lg">
              <span>Total</span>
              <span>{inr(subtotal + shipping)}</span>
            </p>
            <Link href="/checkout" className="btn btn-solid mt-5 w-full">
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
