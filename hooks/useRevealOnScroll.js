"use client";

import { useEffect } from "react";

/**
 * Sets up the IntersectionObserver that adds `.is-visible` to `.reveal` /
 * `.reveal-stagger` elements as they scroll into view. Static marketing
 * sections don't change after mount, so this runs once (empty deps) and
 * queries the DOM directly, matching the original inline script.
 *
 * `.reveal` is visible by default in CSS (see globals.css) — this hook only
 * *arms* the hide-until-scrolled-into-view effect by adding `reveal-armed`
 * to `<html>`, so a page that never runs this effect (JS disabled, a script
 * error before it mounts, a crawler that doesn't execute JS) still renders
 * fully visible content instead of the permanently-blank page a
 * hide-by-default approach produces. A 2.5s safety-net timeout also force-
 * reveals anything that armed but never intersected (e.g. a tool that loads
 * the page once without scrolling), so nothing depends on scroll forever.
 */
export function useRevealOnScroll() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealEls = document.querySelectorAll(".reveal, .reveal-stagger");

    if ("IntersectionObserver" in window && !reduceMotion) {
      document.documentElement.classList.add("reveal-armed");

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      revealEls.forEach((el) => io.observe(el));

      const safetyNet = setTimeout(() => {
        revealEls.forEach((el) => el.classList.add("is-visible"));
        io.disconnect();
      }, 2500);

      return () => {
        clearTimeout(safetyNet);
        io.disconnect();
      };
    }

    revealEls.forEach((el) => el.classList.add("is-visible"));
  }, []);
}
