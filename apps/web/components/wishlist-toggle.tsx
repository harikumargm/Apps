"use client";

import { Heart } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { useStore } from "@/lib/store";

export function WishlistToggle({ productId, colorName }: { productId: string; colorName: string }) {
  const token = useStore((state) => state.token);
  const wishlist = useStore((state) => state.wishlist);
  const toggleLocal = useStore((state) => state.toggleWishlist);
  const active = wishlist.some((item) => item.product_id === productId && item.color_name === colorName);

  async function toggle() {
    toggleLocal(productId, colorName);
    if (!token) return;
    try {
      if (active) await api.removeWishlist(productId, colorName);
      else await api.addWishlist(productId, colorName);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) return;
    }
  }

  return (
    <button
      type="button"
      className="btn btn-line inline-flex items-center gap-2"
      aria-pressed={active}
      onClick={() => void toggle()}
    >
      <Heart size={16} fill={active ? "currentColor" : "none"} />
      {active ? "Saved" : "Wishlist"}
    </button>
  );
}