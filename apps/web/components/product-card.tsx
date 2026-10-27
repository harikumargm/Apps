import Link from "next/link";
import { inr } from "@/lib/format";
import type { Product } from "@/lib/types";
import { GarmentArt } from "./garment-art";

export function ProductVisual({
  silhouette,
  color,
  weave,
  name,
  image,
}: {
  silhouette: string;
  color: string;
  weave: string;
  name: string;
  image?: string;
}) {
  if (image) {
    return <img src={image} alt={name} className="product-photo" />;
  }
  return <GarmentArt silhouette={silhouette} color={color} weave={weave} name={name} />;
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="art-frame transition duration-500 group-hover:scale-[1.01]">
        <ProductVisual
          silhouette={product.silhouette}
          color={product.colors[0].hex}
          weave={product.fabric.weave}
          name={product.name}
          image={product.image}
        />
      </div>
      <div className="mt-3">
        <h3 className="product-meta">{product.name}</h3>
        <p className="product-meta">{inr(product.price)}</p>
      </div>
    </Link>
  );
}
