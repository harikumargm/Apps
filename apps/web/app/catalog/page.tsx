import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog-browser";

export const metadata = { title: "The edit" };

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="page py-10"><div className="skeleton h-[70vh] w-full" /></div>}>
      <CatalogBrowser />
    </Suspense>
  );
}
