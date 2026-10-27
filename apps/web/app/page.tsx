import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { GarmentArt } from "@/components/garment-art";
import { products } from "@/lib/catalog";

const DEPARTMENTS = [
  { href: "/catalog?audience=men", label: "Men", line: "Shirts, kurtas, trousers" },
  { href: "/catalog?audience=men&silhouette=tshirt", label: "T-Shirts", line: "Peacock mark, men's cut" },
  { href: "/catalog?audience=women", label: "Women", line: "Sarees, sets, dresses" },
  { href: "/catalog?audience=kids", label: "Kids", line: "Soft cotton sets" },
  { href: "/catalog?occasion=festive", label: "Festive", line: "Silk for the evening" },
  { href: "/catalog?occasion=casual", label: "Casual", line: "Cloth for the week" },
];

export default function HomePage() {
  const featured = products.filter((product) => product.featured);
  const [lead, ...rest] = featured;
  const side = rest.slice(0, 2);
  return (
    <div>
      <section className="hero-band">
        <div className="page hero-grid">
          <div>
            <p className="eyebrow">Monsoon 2026</p>
            <h1 className="serif mt-3 text-5xl leading-[0.92] md:text-7xl">
              Cotton, cut
              <br />
              and ready.
            </h1>
            <p className="mt-5 max-w-md text-lg text-[var(--muted)]">
              Readymade clothing from Sai Cotton Vastram Store. Every piece carries its mill cloth, weave, and care — and can be tried on your measurements before you buy.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/catalog" className="btn btn-solid">
                Shop the edit
              </Link>
              <Link href="/trial" className="btn btn-line">
                Try a piece on
              </Link>
            </div>
          </div>
          <div className="hero-looks">
            <Link href={`/product/${lead.slug}`} className="art-frame">
              <GarmentArt silhouette={lead.silhouette} color={lead.colors[0].hex} weave={lead.fabric.weave} name={lead.name} />
            </Link>
            {side.map((product) => (
              <Link key={product.id} href={`/product/${product.slug}`} className="art-frame">
                <GarmentArt silhouette={product.silhouette} color={product.colors[0].hex} weave={product.fabric.weave} name={product.name} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="border-y border-[var(--line)]">
        <div className="page dept-grid">
          {DEPARTMENTS.map((item) => (
            <Link key={item.href} href={item.href} className="dept-card">
              <p className="serif text-4xl">{item.label}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.line}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="page py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The rack</p>
            <h2 className="serif text-5xl">This season</h2>
          </div>
          <Link href="/catalog" className="text-sm">
            All pieces
          </Link>
        </div>
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {featured.slice(0, 6).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
      <section className="border-t border-[var(--line)] bg-[var(--paper-2)]">
        <div className="page grid gap-10 py-16 md:grid-cols-3">
          <div>
            <p className="eyebrow">01 · Cloth</p>
            <h3 className="serif mt-2 text-3xl">Mill spec on every piece</h3>
            <p className="mt-3 text-[var(--muted)]">Fibre, weave, weight, and care sit on the product page, next to what the cloth scan can actually see.</p>
          </div>
          <div>
            <p className="eyebrow">02 · Fit</p>
            <h3 className="serif mt-2 text-3xl">Trial before you commit</h3>
            <p className="mt-3 text-[var(--muted)]">A dress form follows your measurements. A photograph is draped, then removed from the inference server.</p>
          </div>
          <div>
            <p className="eyebrow">03 · Dispatch</p>
            <h3 className="serif mt-2 text-3xl">Shipping from ₹2,500</h3>
            <p className="mt-3 text-[var(--muted)]">Orders above that travel free. Prices include GST. UPI, Razorpay, and card checkout are on the bag.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
