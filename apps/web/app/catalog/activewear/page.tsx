import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog-browser";

export const metadata = { title: "Activewear" };

export default function ActivewearPage() {
  return (
    <Suspense fallback={<div className="page py-10"><div className="skeleton h-[70vh] w-full" /></div>}>
      <CatalogBrowser collection="activewear" />
    </Suspense>
  );
}
