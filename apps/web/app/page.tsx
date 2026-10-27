import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { GarmentArt } from "@/components/garment-art";
import { products } from "@/lib/catalog";

const DEPARTMENTS = [
  { href: "/catalog?audience=men", label: "Men", line: "Shirts, kurtas, trousers." },
  { href: "/catalog?audience=women", label: "Women", line: "Sarees, sets, slips." },
  { href: "/catalog?audience=kids", label: "Kids", line: "Soft cotton and linen." },
  { href: "/catalog?occasion=festive", label: "Festive", line: "Silk for the evening." },
  { href: "/catalog?occasion=casual", label: "Casual", line: "Cloth for the week." },
];

export default function HomePage() {
  const featured = products.filter((product) => product.featured);
  const hero = featured[0];
  return (
    <div>
      <section className="page grid items-end gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
        <div>
          <p className="eyebrow">Monsoon 2026</p>
          <h1 className="serif mt-4 text-6xl leading-[0.92] md:text-8xl">
            The cloth,
            <br />
            after the loom.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[var(--muted)]">
            Readymade clothing with a fabric reading on every piece — fibre, weave, weight, and care — and a trial view that drapes it on your measurements before you buy.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/catalog" className="btn btn-solid">
              Shop the edit
            </Link>
            <Link href="/trial" className="btn btn-line">
              Open Trial-View
            </Link>
          </div>
        </div>
        <Link href={`/product/${hero.slug}`} className="art-frame">
          <GarmentArt silhouette={hero.silhouette} color={hero.colors[0].hex} weave={hero.fabric.weave} name={hero.name} />
        </Link>
      </section>
      <section className="border-y border-[var(--line)]">
        <div className="page grid md:grid-cols-5">
          {DEPARTMENTS.map((item) => (
            <Link key={item.href} href={item.href} className="border-[var(--line)] px-4 py-8 md:border-l first:md:border-l-0">
              <p className="serif text-3xl">{item.label}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.line}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="page py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="serif text-5xl">From the rack</h2>
          <Link href="/catalog" className="text-sm">
            All pieces
          </Link>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {featured.slice(0, 6).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
      <section className="bg-[var(--paper-2)]">
        <div className="page grid gap-10 py-16 md:grid-cols-3">
          <div>
            <p className="eyebrow">01</p>
            <h3 className="serif mt-2 text-3xl">Mill spec</h3>
            <p className="mt-3 text-[var(--muted)]">Composition on the product page is the mill’s declaration. A photograph cannot assay an 80/20 blend.</p>
          </div>
          <div>
            <p className="eyebrow">02</p>
            <h3 className="serif mt-2 text-3xl">Swatch reading</h3>
            <p className="mt-3 text-[var(--muted)]">Weave, weight, and sheen are read from the cloth. Vendors can scan a close-up in the fabric studio.</p>
          </div>
          <div>
            <p className="eyebrow">03</p>
            <h3 className="serif mt-2 text-3xl">Trial, then gone</h3>
            <p className="mt-3 text-[var(--muted)]">A dress form or your photograph. The inference scratch is deleted when the preview returns, and swept if anything is older than a day.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
