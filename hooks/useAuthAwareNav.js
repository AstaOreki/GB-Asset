"use client";

import { useEffect, useState } from "react";
import { useGBA } from "./useGBA";

/**
 * Subscribes to GBA.onAuthChange and exposes the current auth state for
 * the header's login/logout button. Neutral SSR-safe default is
 * `user: null` (logged-out) until the subscription resolves.
 *
 * @returns {{ user: import("firebase/compat/app").User|null, isAuthed: boolean, authReady: boolean }}
 *   authReady - true once the first GBA.onAuthChange callback has fired
 *               (whether or not a user is present). Lets callers that need
 *               to gate on "definitely logged out" avoid acting before the
 *               real auth state is known.
 */
export function useAuthAwareNav() {
  const gba = useGBA();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!gba) return;
    const unsubscribe = gba.onAuthChange((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [gba]);

  return { user, isAuthed: !!user, authReady };
}
