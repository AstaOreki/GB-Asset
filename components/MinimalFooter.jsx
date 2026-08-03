"use client";

/**
 * Copyright-only footer used on /login and /privacy-policy. Takes no
 * props. Uses the `.minimal-footer` class (see globals.css) rather than a
 * bare `<footer>` tag selector so its styling can't collide with
 * FullFooter's bare `footer{}` rules elsewhere in the same global sheet.
 */
export default function MinimalFooter() {
  return <footer className="minimal-footer">© 2026 GB Asset. All rights reserved.</footer>;
}
