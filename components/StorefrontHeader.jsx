"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuthAwareNav } from "../hooks/useAuthAwareNav";
import { useCartBadge } from "../hooks/useCartBadge";
import { useScrollProgress } from "../hooks/useScrollProgress";

/**
 * `href` = its own route, always a <Link> and highlighted when you are on
 * it. `hash` = a section of the homepage, so it is an in-page anchor on "/"
 * and a cross-page "/#anchor" link everywhere else.
 *
 * Ordered so the three destinations that are real pages come first, then
 * the homepage sections in the order you meet them scrolling down. Pricing
 * and Price Today used to be split apart by About Us and Services, which
 * put the two price links at opposite ends of the bar.
 */
const NAV_ITEMS = [
  // Both: on "/" it scrolls back to the hero, from anywhere else it
  // navigates home. Route-only made it a no-op on the homepage itself.
  { label: "Home", href: "/", hash: "#top" },
  { label: "About Us", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Pricing", hash: "#pricing" },
  { label: "Price Today", hash: "#products" },
  { label: "Contact Us", hash: "#contact" },
  { label: "Location", hash: "#location" },
];

/**
 * Storefront header: logo + nav-links + cart badge + auth button.
 *
 * @param {{ variant?: "home" | string }} props
 *   variant === "home"  -> in-page `#anchor` hrefs. Use on "/" only.
 *   any other value     -> cross-page `/#anchor` hrefs.
 *                          Use on /about, /services, /cart, /checkout, etc.
 *
 * The `.active` link is derived from the current pathname, so Home, About Us
 * and Services each highlight on their own page without the caller having
 * to say which one it is.
 *
 * Renders its own `.scroll-progress` bar (driven by useScrollProgress),
 * a cart badge (driven by useCartBadge), and a login/logout button
 * (driven by useAuthAwareNav). All three render neutral SSR-safe
 * defaults (not-scrolled, badge hidden/0, logged-out) until mounted.
 */
export default function StorefrontHeader({ variant }) {
  const isHome = variant === "home";
  const pathname = usePathname();
  const { scrolled, progress } = useScrollProgress();
  const { count } = useCartBadge();
  const { isAuthed, user } = useAuthAwareNav();
  const [menuOpen, setMenuOpen] = useState(false);

  // One place decides how a nav item renders, so the desktop bar and the
  // mobile drawer can never drift apart.
  const renderNav = (item) => {
    const active = item.href && pathname === item.href ? "active" : undefined;
    // An item with a hash points at a homepage section, so while we are on
    // the homepage it stays a plain anchor and scrolls. This is checked
    // first so Home — which has both — scrolls here and routes elsewhere.
    if (item.hash && isHome) {
      return (
        <a key={item.label} className={active} href={item.hash}>
          {item.label}
        </a>
      );
    }
    if (item.href) {
      return (
        <Link key={item.label} className={active} href={item.href}>
          {item.label}
        </Link>
      );
    }
    return (
      <Link key={item.label} href={`/${item.hash}`}>
        {item.label}
      </Link>
    );
  };

  const authLabel = isAuthed
    ? `Hi, ${user?.displayName || (user?.email ? user.email.split("@")[0] : "")}`
    : "Login / Register";
  const authHref = isAuthed ? "/profile" : "/login";

  return (
    <>
      <div className="scroll-progress" id="scrollProgress" style={{ width: `${progress}%` }} />
      <header id="siteHeader" className={scrolled ? "scrolled" : ""}>
        <div className="nav-inner">
          <Link className="logo" href="/">
            <div className="logo-mark">
              <div aria-hidden="true" className="brand-emblem">
                <img
                  alt="GB ASSET"
                  className="brand-emblem-img"
                  loading="lazy"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAcYG8dNuU9Clu2ePHfM94yE26B1YRH0yjMbpqLABwDF3Np1f8MgdF2x-KmJUnBwd2i5IpO8q-fpU9KSHgAlEHUvHn8dYfHasLfYuOGa6MfgZpDzoYb5f3uKSsndATyT2NwH3kNH_twIxnW90EZZ0OFk1kGCvLjHRGyAVt6O5iP6mzVga6D1LPjNgYkbC8gG8TQqiyOkyWpuy4F1psuw43JsHyP_AK6OwqfDMjwe3Q64BYpnbaADnPZ2iUqeftjJBUjuApKD3_QPt9O"
                />
              </div>
            </div>
            <div className="logo-text">
              GB <span>ASSET</span>
            </div>
          </Link>
          <nav className="nav-links">{NAV_ITEMS.map(renderNav)}</nav>
          <div className="nav-right">
            <Link className="cart-link" href="/cart" aria-label="View cart">
              <svg viewBox="0 0 24 24">
                <path d="M3 4h2l2.2 12.2a2 2 0 002 1.8h8.6a2 2 0 002-1.7L21 8H6"></path>
                <circle cx="9.5" cy="20" r="1.4"></circle>
                <circle cx="17.5" cy="20" r="1.4"></circle>
              </svg>
              <span className="cart-badge" id="cartBadge" style={{ display: count > 0 ? "flex" : "none" }}>
                {count}
              </span>
            </Link>
            <a className="login-btn" id="authNavBtn" href={authHref}>
              {authLabel}
            </a>
            <button
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
              className="mobile-menu-btn"
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? (
                <svg viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6 6 18"></path>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M4 7h16M4 12h16M4 17h16"></path>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>
      <div className={`mobile-nav-drawer${menuOpen ? " open" : ""}`}>
        <nav onClick={() => setMenuOpen(false)}>
          {NAV_ITEMS.map(renderNav)}
          <a className="drawer-auth-link" href={authHref}>
            {authLabel}
          </a>
        </nav>
      </div>
    </>
  );
}
