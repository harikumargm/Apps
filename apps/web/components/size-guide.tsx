"use client";

import { useMemo, useState } from "react";
import { BOTTOMS, COTTON_SHRINK_NOTE, MEN_TOPS, WOMEN_TOPS } from "@/lib/size-guide-data";

export function SizeGuide({ audience, silhouette }: { audience: string; silhouette: string }) {
  const isBottom = ["jogger", "palazzo", "culotte", "cargo", "set"].includes(silhouette);
  const [tab, setTab] = useState<"chart" | "shrink" | "measure">(isBottom ? "chart" : "chart");

  const rows = useMemo(() => {
    if (isBottom) return BOTTOMS;
    return audience === "women" ? WOMEN_TOPS : MEN_TOPS;
  }, [audience, isBottom]);

  return (
    <div className="mt-6 border border-[var(--line)] p-5">
      <div className="flex flex-wrap gap-2">
        <button className={`chip ${tab === "chart" ? "active" : ""}`} onClick={() => setTab("chart")}>
          Size chart
        </button>
        <button className={`chip ${tab === "shrink" ? "active" : ""}`} onClick={() => setTab("shrink")}>
          Cotton shrinkage
        </button>
        <button className={`chip ${tab === "measure" ? "active" : ""}`} onClick={() => setTab("measure")}>
          How to measure
        </button>
      </div>
      {tab === "chart" && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-2 pr-3">Size</th>
                <th className="py-2 pr-3">Chest</th>
                <th className="py-2 pr-3">Waist</th>
                <th className="py-2 pr-3">Hip</th>
                <th className="py-2">Length</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.size} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-2 pr-3 font-medium">{row.size}</td>
                  <td className="py-2 pr-3">{row.chest}</td>
                  <td className="py-2 pr-3">{row.waist}</td>
                  <td className="py-2 pr-3">{row.hip}</td>
                  <td className="py-2">{row.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "shrink" && <p className="mt-4 max-w-xl text-sm text-[var(--muted)]">{COTTON_SHRINK_NOTE}</p>}
      {tab === "measure" && (
        <ol className="mt-4 grid max-w-xl gap-2 text-sm text-[var(--muted)]">
          <li>1. Chest — tape under arms, fullest part.</li>
          <li>2. Waist — natural waist; keep tape level.</li>
          <li>3. Hip — fullest seat, feet together.</li>
          <li>4. Length — shoulder to hem for tops; waist to ankle for bottoms.</li>
        </ol>
      )}
    </div>
  );
}