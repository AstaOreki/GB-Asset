"use client";

import { useCallback, useEffect, useState } from "react";
import { useGBA } from "./useGBA";

/**
 * Module-level store shared by every useCartBadge() call site. The original
 * site had one shared #cartBadge DOM node that any page's script could
 * mutate directly; React components don't share DOM like that, so calling
 * refresh() from e.g. the cart page must also update StorefrontHeader's own
 * badge instance. A tiny pub-sub gives every mounted instance the same
 * count without needing a Context provider wired into the root layout.
 */
let sharedCount = 0;
const listeners = new Set();

function setSharedCount(next) {
  sharedCount = next;
  listeners.forEach((listener) => listener(next));
}

/**
 * Current cart count, driven by GBA.cart.read() + GBA.cart.count().
 * Neutral SSR-safe default is 0 until GBA is ready and the first read
 * resolves. Shared across every component using this hook (see above).
 *
 * @returns {{ count: number, refresh: () => void }}
 *   count   - current cart item count (0 until resolved).
 *   refresh - re-reads the cart; call after any cart mutation
 *             (add/changeQty/remove/clear) so every badge stays in sync.
 */
export function useCartBadge() {
  const gba = useGBA();
  const [count, setCount] = useState(sharedCount);

  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  const refresh = useCallback(() => {
    if (!gba) return;
    gba.cart.read().then((cart) => {
      setSharedCount(gba.cart.count(cart));
    });
  }, [gba]);

  // Re-read on auth changes, not just once on mount: on a fresh page load,
  // GBA is ready (and this hook's mount-effect fires) before Firebase Auth
  // has restored the signed-in session, so an early refresh() reads the
  // guest cart (0/localStorage) and — with no auth-change subscription —
  // never re-reads once the real user's cart is known. onAuthChange fires
  // immediately with the current state plus every future change, so this
  // one subscription covers both the initial read and later sign-in/out.
  useEffect(() => {
    if (!gba) return;
    const unsubscribe = gba.onAuthChange(() => {
      refresh();
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [gba, refresh]);

  return { count, refresh };
}
