"use client";

import { useEffect } from "react";
import { api, ensureSession } from "@/lib/api";
import { useStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useStore((state) => state.theme);
  const hydrated = useStore((state) => state.hydrated);
  const dirty = useStore((state) => state.dirty);
  const items = useStore((state) => state.items);
  const sessionId = useStore((state) => state.sessionId);

  useEffect(() => {
    const dark =
      theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => document.documentElement.classList.toggle("dark", media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    if (!hydrated) return;
    ensureSession();
    let cancelled = false;
    void (async () => {
      try {
        const cart = await api.cart();
        if (cancelled) return;
        const local = useStore.getState();
        if (local.dirty) return;
        if (local.items.length > 0 && cart.items.length === 0 && cart.version === 0) {
          local.markDirty();
          return;
        }
        local.replaceFromServer(cart.items, cart.version);
      } catch {
        // Browsing still works from the local catalogue when the API is down.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !dirty) return;
    const snapshot = JSON.stringify(items.map((item) => ({ product_id: item.product_id, size: item.size, color: item.color, qty: item.qty })));
    const timer = window.setTimeout(() => {
      void api
        .saveCart(JSON.parse(snapshot))
        .then((cart) => {
          const current = JSON.stringify(
            useStore.getState().items.map((item) => ({
              product_id: item.product_id,
              size: item.size,
              color: item.color,
              qty: item.qty,
            })),
          );
          if (current === snapshot) useStore.getState().replaceFromServer(cart.items, cart.version);
        })
        .catch(() => undefined);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [dirty, hydrated, items]);

  useEffect(() => {
    if (!hydrated || !sessionId) return;
    let source: EventSource | null = null;
    let timer: number | undefined;
    let stopped = false;

    const connect = () => {
      source = new EventSource(`/api/v1/cart/stream?session_id=${encodeURIComponent(sessionId)}`);
      source.onmessage = (event) => {
        const cart = JSON.parse(event.data);
        const state = useStore.getState();
        if (state.dirty || cart.version === state.version) return;
        state.replaceFromServer(cart.items, cart.version);
      };
      source.onerror = () => {
        source?.close();
        if (!stopped) timer = window.setTimeout(connect, 4000);
      };
    };
    connect();
    return () => {
      stopped = true;
      source?.close();
      if (timer) window.clearTimeout(timer);
    };
  }, [hydrated, sessionId]);

  return children;
}
