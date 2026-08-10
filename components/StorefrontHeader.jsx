"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthAwareNav } from "../hooks/useAuthAwareNav";
import { useCartBadge } from "../hooks/useCartBadge";
import { useScrollProgress } from "../hooks/useScrollProgress";

const NAV_ITEMS = [
  { label: "Home", hash: "#top" },
  { label: "Pricing", hash: "#pricing" },
  { label: "About Us", hash: "#heritage" },
  { label: "Services", hash: "#services" },
  { label: "Price Today", hash: "#products" },
  { label: "Contact Us", hash: "#contact" },
  { label: "Location", hash: "#location" },
];

/**
 * Storefront header: logo + nav-links + cart badge + auth button.
 *
 * @param {{ variant?: "home" | string }} props
 *   variant === "home"  -> in-page `#anchor` hrefs, "Home" link gets
 *                          `.active`. Use on "/" only.
 *   any other value     -> cross-page `/#anchor` hrefs, no `.active` link.
 *                          Use on /cart, /checkout, etc.
 *
 * Renders its own `.scroll-progress` bar (driven by useScrollProgress),
 * a cart badge (driven by useCartBadge), and a login/logout button
 * (driven by useAuthAwareNav). All three render neutral SSR-safe
 * defaults (not-scrolled, badge hidden/0, logged-out) until mounted.
 */
export default function StorefrontHeader({ variant }) {
  const isHome = variant === "home";
  const { scrolled, progress } = useScrollProgress();
  const { count } = useCartBadge();
  const { isAuthed, user } = useAuthAwareNav();
  const [menuOpen, setMenuOpen] = useState(false);

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
          <nav className="nav-links">
            {NAV_ITEMS.map((item) =>
              isHome ? (
                <a key={item.hash} className={item.label === "Home" ? "active" : undefined} href={item.hash}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.hash} href={`/${item.hash}`}>
                  {item.label}
                </Link>
              )
            )}
          </nav>
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
          {NAV_ITEMS.map((item) =>
            isHome ? (
              <a key={item.hash} className={item.label === "Home" ? "active" : undefined} href={item.hash}>
                {item.label}
              </a>
            ) : (
              <Link key={item.hash} href={`/${item.hash}`}>
                {item.label}
              </Link>
            )
          )}
          <a className="drawer-auth-link" href={authHref}>
            {authLabel}
          </a>
        </nav>
      </div>
    </>
  );
}
