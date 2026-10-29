import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { products } from "@/lib/catalog";

export default function HomePage() {
  const looks = products.filter((product) => product.image && product.audience !== "kids");
  const featured = products.filter((product) => product.featured && product.audience !== "kids").slice(0, 4);
  const active = looks.find((product) => product.slug === "mustard-quarter-zip");
  const sport = looks.find((product) => product.slug === "white-sport-tee");
  const hero = looks.find((product) => product.slug === "royal-peacock-tee") ?? looks[0];
  const banner = looks.find((product) => product.slug === "olive-peacock-tee") ?? looks[1];

  return (
    <div>
      <section className="campaign">
        <img className="campaign-photo" src={hero.image} alt={hero.name} />
        <div className="campaign-copy">
          <h1 className="serif">Cloth for the week.</h1>
          <Link href="/catalog" className="btn btn-light mt-8">
            Shop now
          </Link>
        </div>
      </section>

      <section className="rail" aria-label="New looks">
        {looks.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>

      <section className="duo">
        {active && (
          <Link href="/catalog/activewear" className="tile">
            <img src={active.image} alt={active.name} />
            <span className="btn btn-light">Shop activewear</span>
          </Link>
        )}
        {sport && (
          <Link href="/catalog/sportwear" className="tile">
            <img src={sport.image} alt={sport.name} />
            <span className="btn btn-light">Shop sportwear</span>
          </Link>
        )}
      </section>

      {banner && (
        <section className="banner">
          <img src={banner.image} alt={banner.name} />
          <div className="banner-copy">
            <h2 className="serif">New cloth, same care.</h2>
            <Link href={`/product/${banner.slug}`} className="btn btn-light mt-8">
              Shop now
            </Link>
          </div>
        </section>
      )}

      <section className="page py-14">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="serif text-5xl">New in</h2>
          <Link href="/catalog" className="nav-link">
            View all
          </Link>
        </div>
        <div className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
