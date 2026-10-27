"use client";

import { useState } from "react";
import { products } from "@/lib/catalog";
import { TryOn } from "@/components/try-on";

export default function TrialPage() {
  const [slug, setSlug] = useState(products[0].slug);
  const product = products.find((item) => item.slug === slug) ?? products[0];
  return (
    <div className="page py-10">
      <p className="eyebrow">Trial-View</p>
      <h1 className="serif max-w-3xl text-6xl">Drape it before you commit.</h1>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        Pick a piece. The dress form follows your height and circumferences. A photograph is an alternative, processed and then dropped from the inference server.
      </p>
      <label className="field mt-8 max-w-md">
        <span>Piece</span>
        <select value={slug} onChange={(event) => setSlug(event.target.value)}>
          {products.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-8 max-w-3xl">
        <TryOn product={product} />
      </div>
    </div>
  );
}
