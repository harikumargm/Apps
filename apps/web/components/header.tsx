"use client";

import { Menu, Moon, Search, ShoppingBag, Sun, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { inr } from "@/lib/format";
import { lineKey, useStore } from "@/lib/store";
import { GarmentArt } from "./garment-art";

const LINKS = [
  { href: "/catalog?audience=men", label: "Men" },
  { href: "/catalog?audience=women", label: "Women" },
  { href: "/catalog?audience=kids", label: "Kids" },
  { href: "/catalog?occasion=festive", label: "Festive" },
  { href: "/catalog?occasion=casual", label: "Casual" },
  { href: "/trial", label: "Trial-View" },
];

export function Header() {
  const router = useRouter();
  const items = useStore((state) => state.items);
  const hydrated = useStore((state) => state.hydrated);
  const cartOpen = useStore((state) => state.cartOpen);
  const setCartOpen = useStore((state) => state.setCartOpen);
  const setQty = useStore((state) => state.setQty);
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const count = hydrated ? items.reduce((sum, item) => sum + item.qty, 0) : 0;
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.qty, 0);

  useEffect(() => {
    document.body.style.overflow = cartOpen || menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen, menu]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/92 backdrop-blur">
      <div className="announce">Cotton house · Complimentary shipping above ₹2,500</div>
      <div className="page flex h-[76px] items-center gap-6">
        <button className="md:hidden" aria-label="Open menu" onClick={() => setMenu(true)}>
          <Menu size={20} />
        </button>
        <Link href="/" className="shrink-0">
          <span className="logo-mark">Sai Cotton</span>
          <span className="logo-sub">Vastram Store</span>
        </Link>
        <nav className="hidden items-center gap-5 md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <form
          className="ml-auto hidden min-w-[220px] items-center gap-2 border border-[var(--line)] px-3 md:flex"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(query ? `/catalog?q=${encodeURIComponent(query)}` : "/catalog");
          }}
        >
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cloth"
            aria-label="Search cloth"
            className="h-10 w-full bg-transparent outline-none"
          />
        </form>
        <button
          aria-label="Toggle colour mode"
          className="grid h-10 w-10 place-items-center"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="relative grid h-10 w-10 place-items-center" aria-label="Open bag" onClick={() => setCartOpen(true)}>
          <ShoppingBag size={18} />
          <span className="absolute right-1 top-1 min-w-4 text-center text-[11px]">{count || ""}</span>
        </button>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)}>
            <motion.div
              className="drawer drawer-left"
              initial={{ x: -40 }}
              animate={{ x: 0 }}
              exit={{ x: -40 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5">
                <span>
                  <span className="logo-mark">Sai Cotton</span>
                  <span className="logo-sub">Vastram Store</span>
                </span>
                <button aria-label="Close menu" onClick={() => setMenu(false)}>
                  <X />
                </button>
              </div>
              <div className="grid gap-4 px-5">
                {LINKS.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMenu(false)} className="serif text-4xl">
                    {link.label}
                  </Link>
                ))}
                <Link href="/account" onClick={() => setMenu(false)}>
                  Account
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
        {cartOpen && (
          <motion.div className="drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)}>
            <motion.aside
              className="drawer"
              initial={{ x: 40 }}
              animate={{ x: 0 }}
              exit={{ x: 40 }}
              onClick={(event) => event.stopPropagation()}
              aria-label="Bag"
            >
              <div className="flex items-center justify-between border-b border-[var(--line)] p-5">
                <h2 className="serif text-3xl">Bag</h2>
                <button aria-label="Close bag" onClick={() => setCartOpen(false)}>
                  <X />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-5">
                {items.length === 0 && <p className="text-[var(--muted)]">Nothing here yet. The edit is open.</p>}
                <ul className="grid gap-4">
                  {items.map((item) => (
                    <li key={lineKey(item)} className="grid grid-cols-[84px_1fr] gap-3">
                      <div className="art-frame">
                        <GarmentArt silhouette={item.silhouette} color={item.hex} weave="plain" name={item.name} />
                      </div>
                      <div>
                        <Link href={`/product/${item.slug}`} onClick={() => setCartOpen(false)} className="serif text-xl">
                          {item.name}
                        </Link>
                        <p className="text-sm text-[var(--muted)]">
                          {item.color} / {item.size}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-sm">
                          <button aria-label="Decrease quantity" onClick={() => setQty(lineKey(item), item.qty - 1)}>
                            −
                          </button>
                          <span>{item.qty}</span>
                          <button aria-label="Increase quantity" onClick={() => setQty(lineKey(item), item.qty + 1)}>
                            +
                          </button>
                          <span className="ml-auto">{inr(item.unit_price * item.qty)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-[var(--line)] p-5">
                <div className="mb-3 flex justify-between">
                  <span>Subtotal</span>
                  <span>{inr(subtotal)}</span>
                </div>
                <Link href="/checkout" onClick={() => setCartOpen(false)} className="btn btn-solid w-full">
                  Checkout
                </Link>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
