import type { Measurements, Product } from "./types";

const LETTERS: [string, number][] = [
  ["XS", 80],
  ["S", 88],
  ["M", 96],
  ["L", 104],
  ["XL", 140],
];

const KIDS: [string, number][] = [
  ["2-3Y", 104],
  ["4-5Y", 116],
  ["6-7Y", 140],
];

export function suggestSize(product: Product, measurements?: Partial<Measurements> | null): string | null {
  if (!measurements) return null;
  if (product.departments.includes("kids")) {
    const height = Number(measurements.height_cm || 0);
    if (!height) return null;
    for (const [size, limit] of KIDS) {
      if (height < limit && product.sizes.includes(size)) return size;
    }
    return product.sizes.at(-1) ?? null;
  }
  if (measurements.chest_cm == null) return null;
  const chest = Number(measurements.chest_cm);
  let pick = "XL";
  for (const [size, limit] of LETTERS) {
    if (chest < limit) {
      pick = size;
      break;
    }
  }
  return product.sizes.includes(pick) ? pick : (product.sizes.find((size) => LETTERS.some(([letter]) => letter === size)) ?? null);
}
