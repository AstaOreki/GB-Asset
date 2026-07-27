"use client";

import { useEffect, useState } from "react";

/**
 * Header-shrink + scroll-progress-bar behavior.
 *
 * Choice: reactive state (not the original's direct DOM mutation via
 * getElementById) — idiomatic React, and the component just spreads
 * `scrolled` into a className and `progress` into a style width, producing
 * identical visuals to the original imperative version.
 *
 * @returns {{ scrolled: boolean, progress: number }} progress is 0-100.
 */
export function useScrollProgress() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      setProgress(pct);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { scrolled, progress };
}
