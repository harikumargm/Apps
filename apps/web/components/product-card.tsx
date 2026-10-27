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

export function discountOff(price: number, mrp?: number) {
  if (!mrp || mrp <= price) return 0;
  return Math.round((1 - price / mrp) * 100);
}

export function PriceLine({ price, mrp }: { price: number; mrp?: number }) {
  const off = discountOff(price, mrp);
  return (
    <p className="deal-price">
      <span className="deal-now">{inr(price)}</span>
      {off > 0 && mrp ? <span className="deal-mrp">{inr(mrp)}</span> : null}
      {off > 0 ? <span className="deal-off">{off}% off</span> : null}
    </p>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.slug}`} className="deal-card">
      <div className="deal-photo">
        <ProductVisual
          silhouette={product.silhouette}
          color={product.colors[0].hex}
          weave={product.fabric.weave}
          name={product.name}
          image={product.image}
        />
      </div>
      <div className="deal-body">
        <h3 className="deal-title">{product.name}</h3>
        <PriceLine price={product.price} mrp={product.mrp} />
        {product.rating ? (
          <p className="deal-rate">
            <span className="deal-star">★</span>
            {product.rating.toFixed(1)}/5 ({product.reviews ?? 0})
          </p>
        ) : null}
      </div>
    </Link>
  );
}
