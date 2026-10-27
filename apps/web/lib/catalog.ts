import raw from "../data/catalog.json";
import type { Catalog, Product } from "./types";

export const catalog = raw as unknown as Catalog;
export const products = catalog.products;

export function productBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function relatedTo(product: Product): Product[] {
  return products.filter((item) => item.id !== product.id && item.audience === product.audience).slice(0, 4);
}
