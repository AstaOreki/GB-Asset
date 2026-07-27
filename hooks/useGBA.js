"use client";

import { useEffect, useState } from "react";

/**
 * Returns window.GBA once the beforeInteractive Firebase scripts have
 * populated it. Returns `undefined` on the server and on first client
 * render (SSR-safe neutral default), then polls every 30ms until
 * window.GBA exists — a safety net since gba-firebase.js cannot be edited
 * to dispatch a "ready" event, and beforeInteractive scripts *should*
 * already have run by the time this effect fires, but may not have on slow
 * connections.
 *
 * @returns {object|undefined} window.GBA, or undefined until ready.
 */
export function useGBA() {
  const [gba, setGba] = useState(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.GBA) {
      setGba(window.GBA);
      return;
    }

    const interval = setInterval(() => {
      if (window.GBA) {
        setGba(window.GBA);
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, []);

  return gba;
}
