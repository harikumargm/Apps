import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--line)]">
      <div className="page grid gap-10 py-12 md:grid-cols-4">
        <div>
          <p className="serif text-3xl leading-tight">Sai Cotton Vastram Store</p>
          <p className="mt-3 max-w-xs text-sm text-[var(--muted)]">
            Readymade clothing. Cloth is declared by the mill, then checked. Trial photos leave the inference server when the preview returns.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <span className="eyebrow">Shop</span>
          <Link href="/catalog?audience=men">Men</Link>
          <Link href="/catalog?audience=women">Women</Link>
          <Link href="/catalog?audience=kids">Kids</Link>
          <Link href="/catalog?occasion=festive">Festive</Link>
        </div>
        <div className="grid gap-2 text-sm">
          <span className="eyebrow">Studio</span>
          <Link href="/trial">Trial-View</Link>
          <Link href="/vendor">Fabric scan</Link>
          <Link href="/account">Account</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
        <div className="text-sm text-[var(--muted)]">
          <p>Complimentary shipping above ₹2,500.</p>
          <p className="mt-2">Prices include GST.</p>
        </div>
      </div>
    </footer>
  );
}
