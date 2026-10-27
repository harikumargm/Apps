"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, User } from "./types";

export function lineKey(item: Pick<CartLine, "product_id" | "size" | "color">): string {
  return `${item.product_id}|${item.size}|${item.color}`;
}

type State = {
  items: CartLine[];
  version: number;
  dirty: boolean;
  token: string | null;
  user: User | null;
  sessionId: string;
  theme: "light" | "dark" | "system";
  cartOpen: boolean;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setSessionId: (id: string) => void;
  setCartOpen: (open: boolean) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  add: (item: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  replaceFromServer: (items: CartLine[], version: number) => void;
  markDirty: () => void;
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      items: [],
      version: 0,
      dirty: false,
      token: null,
      user: null,
      sessionId: "",
      theme: "system",
      cartOpen: false,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      setSessionId: (sessionId) => set({ sessionId }),
      setCartOpen: (cartOpen) => set({ cartOpen }),
      setTheme: (theme) => set({ theme }),
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      add: (item) =>
        set((state) => {
          const key = lineKey(item);
          const existing = state.items.find((line) => lineKey(line) === key);
          const items = existing
            ? state.items.map((line) => {
                if (lineKey(line) !== key) return line;
                const qty = Math.min(8, line.qty + item.qty);
                return { ...line, qty, line_total: line.unit_price * qty };
              })
            : [...state.items, item];
          return { items, dirty: true, cartOpen: true };
        }),
      setQty: (key, qty) =>
        set((state) => ({
          dirty: true,
          items:
            qty <= 0
              ? state.items.filter((line) => lineKey(line) !== key)
              : state.items.map((line) =>
                  lineKey(line) === key ? { ...line, qty, line_total: line.unit_price * qty } : line,
                ),
        })),
      remove: (key) =>
        set((state) => ({
          dirty: true,
          items: state.items.filter((line) => lineKey(line) !== key),
        })),
      replaceFromServer: (items, version) => set({ items, version, dirty: false }),
      markDirty: () => set({ dirty: true }),
    }),
    {
      name: "sutra-atelier",
      partialize: (state) => ({
        items: state.items,
        version: state.version,
        token: state.token,
        user: state.user,
        sessionId: state.sessionId,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
