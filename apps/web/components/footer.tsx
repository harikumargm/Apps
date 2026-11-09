import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--line)]">
      <div className="page grid gap-10 py-14 md:grid-cols-4">
        <div>
          <Link to="/" className="brand-lockup" aria-label="Vastram home">
            <img src="/brand/vastram-mark.jpg" alt="" width={48} height={48} className="brand-mark footer-mark" />
            <span className="logo-mark text-[40px]">Vastram</span>
          </Link>
          <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">Premium quality clothing</p>
          <p className="mt-3 max-w-xs text-sm text-[var(--muted)]">Complimentary shipping above ₹2,500.</p>
          <Link to="/account" className="nav-link mt-6 inline-block">
            Sign up
          </Link>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <span className="eyebrow">Shop</span>
          <Link to="/catalog?audience=men">Men</Link>
          <Link to="/catalog?audience=women">Women</Link>
          <Link to="/catalog/activewear">Activewear</Link>
          <Link to="/catalog/sportwear">Sportwear</Link>
          <Link to="/catalog">All clothing</Link>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <span className="eyebrow">Help</span>
          <Link to="/trial">Trial-View</Link>
          <Link to="/account">My account</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/vendor">Fabric scan</Link>
        </div>
        <div className="text-sm text-[var(--muted)]">
          <span className="eyebrow">Visit</span>
          <p className="mt-2">Sai Cotton Vastram Store</p>
          <p className="mt-2">Orders above ₹2,500 travel free.</p>
        </div>
      </div>
    </footer>
  );
}
