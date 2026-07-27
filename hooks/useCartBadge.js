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

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { count, refresh };
}
