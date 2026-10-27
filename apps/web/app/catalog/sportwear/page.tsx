import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog-browser";

export const metadata = { title: "Sportwear" };

export default function SportwearPage() {
  return (
    <Suspense fallback={<div className="page py-10"><div className="skeleton h-[70vh] w-full" /></div>}>
      <CatalogBrowser collection="sportwear" />
    </Suspense>
  );
}
