"use client";

import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { FabricReading } from "@/lib/types";

export function VendorScan() {
  const [reading, setReading] = useState<FabricReading | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError("");
    try {
      const result = await api.analyze(file);
      setReading(result.reading);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The cloth could not be read.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <label className="field max-w-lg">
        <span>Garment photograph or label close-up</span>
        <input type="file" accept="image/*" onChange={(event) => void onFile(event.target.files?.[0])} />
      </label>
      {pending && <div className="skeleton h-48 max-w-xl" />}
      {error && <p className="text-[var(--madder)]">{error}</p>}
      {reading && (
        <section className="max-w-xl border border-[var(--line)] p-5">
          <p className="eyebrow">{reading.engine}</p>
          <h2 className="serif text-4xl">{reading.fabric_type}</h2>
          <dl className="spec mt-4">
            <dt>Composition</dt>
            <dd>{reading.composition.map((row) => `${row.percent}% ${row.fiber}`).join(" · ")}</dd>
            <dt>Weave</dt>
            <dd className="capitalize">{reading.weave}</dd>
            <dt>Weight</dt>
            <dd className="capitalize">
              {reading.weight} · {reading.gsm_range[0]}–{reading.gsm_range[1]} gsm
            </dd>
            <dt>Stretch</dt>
            <dd>
              {reading.stretch_index} / 100 · {reading.elasticity}
            </dd>
            <dt>Care</dt>
            <dd>{reading.care.join(" · ")}</dd>
            <dt>Confidence</dt>
            <dd>{Math.round(reading.confidence * 100)}%</dd>
          </dl>
          <p className="mt-4 text-sm text-[var(--muted)]">{reading.disclaimer}</p>
        </section>
      )}
    </div>
  );
}
