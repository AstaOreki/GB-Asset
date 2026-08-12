"use client";

import { useRevealOnScroll } from "../hooks/useRevealOnScroll";

/**
 * Arms the reveal-on-scroll effect for pages that are otherwise server
 * components. The homepage calls useRevealOnScroll() directly because it is
 * already a client component; /about and /services stay server components
 * so they can export their own `metadata`, and mount this instead.
 *
 * Renders nothing — it exists purely to run the hook inside a client
 * boundary.
 */
export default function RevealOnScroll() {
  useRevealOnScroll();
  return null;
}
