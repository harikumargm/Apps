import type { Fabric } from "@/lib/types";

export function FabricPanel({ fabric }: { fabric: Fabric }) {
  const composition = fabric.composition.map((row) => `${row.percent}% ${row.fiber}`).join(" · ");
  return (
    <section className="border border-[var(--line)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Trust note</p>
          <h2 className="serif mt-1 text-3xl">{fabric.ai_verified ? "AI Verified Fabric Breakdown" : "Fabric breakdown"}</h2>
        </div>
        <span className="border border-[var(--good)] px-2 py-1 text-xs text-[var(--good)]">
          {Math.round(fabric.confidence * 100)}%
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{fabric.mill_note}</p>
      <dl className="spec mt-5">
        <dt>Cloth</dt>
        <dd>{fabric.type}</dd>
        <dt>Composition</dt>
        <dd>{composition}</dd>
        <dt>Weave</dt>
        <dd className="capitalize">{fabric.weave}</dd>
        <dt>Weight</dt>
        <dd className="capitalize">
          {fabric.weight} · about {fabric.gsm} gsm
        </dd>
        <dt>Stretch</dt>
        <dd>{fabric.stretch_index} / 100</dd>
        <dt>Care</dt>
        <dd>{fabric.care.join(" · ")}</dd>
        <dt>Engine</dt>
        <dd>{fabric.engine}</dd>
      </dl>
    </section>
  );
}
