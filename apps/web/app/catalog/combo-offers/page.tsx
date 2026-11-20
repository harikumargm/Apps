import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog-browser";

export default function ComboOffersPage() {
  return (
    <Suspense fallback={<div className="page py-10"><div className="skeleton h-[70vh] w-full" /></div>}>
      <section className="page pt-8">
        <div className="grid gap-4 md:grid-cols-2">
          <img
            src="/catalog/combos/banner-classic-trio.jpg"
            alt="Three classic track combos"
            className="w-full border border-[var(--line)] object-cover"
          />
          <img
            src="/catalog/combos/banner-athletic-trio.jpg"
            alt="Three athletic track combos"
            className="w-full border border-[var(--line)] object-cover"
          />
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">Tee and jogger sets at bundle pricing. GST included.</p>
      </section>
      <CatalogBrowser collection="combo_offers" />
    </Suspense>
  );
}