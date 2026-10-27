"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { suggestSize } from "@/lib/fit";
import { inr } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { FabricPanel } from "./fabric-panel";
import { GarmentArt } from "./garment-art";
import { ProductCard } from "./product-card";
import { TryOn } from "./try-on";

export function Pdp({ product, related }: { product: Product; related: Product[] }) {
  const [color, setColor] = useState(product.colors[0]);
  const user = useStore((state) => state.user);
  const suggested = suggestSize(product, user?.measurements);
  const [size, setSize] = useState(suggested || product.sizes[0]);
  const [tryOpen, setTryOpen] = useState(false);
  const [note, setNote] = useState("");
  const add = useStore((state) => state.add);
  const stock = product.stock?.[size] ?? product.inventory[size] ?? 0;

  return (
    <article className="page grid gap-10 py-8 lg:grid-cols-2">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="art-frame">
          <GarmentArt silhouette={product.silhouette} color={color.hex} weave={product.fabric.weave} name={product.name} />
        </div>
      </div>
      <div>
        <p className="eyebrow">
          {product.edition} · {product.audience} · {product.occasion}
        </p>
        <h1 className="serif mt-2 text-5xl md:text-6xl">{product.name}</h1>
        <p className="mt-4 text-xl">{inr(product.price)}</p>
        <p className="mt-4 max-w-xl text-[var(--muted)]">{product.summary}</p>
        <p className="mt-4 max-w-xl">{product.story}</p>
        <div className="mt-8">
          <p className="eyebrow mb-2">Colour · {color.name}</p>
          <div className="flex gap-2">
            {product.colors.map((entry) => (
              <button
                key={entry.name}
                aria-label={entry.name}
                aria-pressed={color.name === entry.name}
                className="h-10 w-10 border border-[var(--line)]"
                style={{ background: entry.hex, outline: color.name === entry.name ? "2px solid var(--ink)" : undefined, outlineOffset: 3 }}
                onClick={() => setColor(entry)}
              />
            ))}
          </div>
        </div>
        <div className="mt-6">
          <p className="eyebrow mb-2">Size {suggested ? `· suggested ${suggested} from your profile` : ""}</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((entry) => (
              <button key={entry} className="chip" aria-pressed={size === entry} onClick={() => setSize(entry)}>
                {entry}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">{stock > 0 ? `${stock} in the studio` : "Cut is waiting on the next batch"}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            className="btn btn-solid"
            disabled={stock <= 0}
            onClick={() => {
              add({
                product_id: product.id,
                slug: product.slug,
                name: product.name,
                size,
                color: color.name,
                hex: color.hex,
                silhouette: product.silhouette,
                qty: 1,
                unit_price: product.price,
                line_total: product.price,
              });
              setNote("Added to your bag");
            }}
          >
            Add to bag
          </button>
          <button className="btn btn-madder" onClick={() => setTryOpen(true)}>
            Try it on me
          </button>
        </div>
        {note && <p className="mt-3 text-sm">{note}</p>}
        <div className="mt-10">
          <FabricPanel fabric={product.fabric} />
        </div>
      </div>
      {related.length > 0 && (
        <div className="lg:col-span-2">
          <h2 className="serif mb-6 text-4xl">Worn nearby</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </div>
      )}
      <AnimatePresence>
        {tryOpen && (
          <motion.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTryOpen(false)}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Trial view"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-auto border border-[var(--line)] bg-[var(--paper)] p-5 md:inset-8"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Trial-View</p>
                  <h2 className="serif text-4xl">{product.name}</h2>
                </div>
                <button aria-label="Close trial view" onClick={() => setTryOpen(false)}>
                  <X />
                </button>
              </div>
              <TryOn product={product} initialColor={color.name} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
