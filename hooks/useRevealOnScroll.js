"use client";

import { useEffect } from "react";

/**
 * Sets up the IntersectionObserver that adds `.is-visible` to `.reveal` /
 * `.reveal-stagger` elements as they scroll into view. Static marketing
 * sections don't change after mount, so this runs once (empty deps) and
 * queries the DOM directly, matching the original inline script.
 */
export function useRevealOnScroll() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealEls = document.querySelectorAll(".reveal, .reveal-stagger");

    if ("IntersectionObserver" in window && !reduceMotion) {
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
      return () => io.disconnect();
    }

    revealEls.forEach((el) => el.classList.add("is-visible"));
  }, []);
}
