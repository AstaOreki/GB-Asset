"use client";

import Link from "next/link";
import { useState } from "react";
import { useScrollProgress } from "../hooks/useScrollProgress";

const NAV_ITEMS = [
  { label: "Home", hash: "#top" },
  { label: "Pricing", hash: "#pricing" },
  { label: "About Us", hash: "#heritage" },
  { label: "Services", hash: "#services" },
  { label: "Featured Products", hash: "#products" },
  { label: "Contact Us", hash: "#contact" },
  { label: "Location", hash: "#location" },
];

/**
 * Minimal header for /login and /privacy-policy: logo + nav (cross-page
 * `/#anchor` hrefs, no active state) + "Back to Site" link. No cart badge,
 * no auth button. Takes no props.
 */
export default function MinimalHeader() {
  const { scrolled, progress } = useScrollProgress();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="scroll-progress" id="scrollProgress" style={{ width: `${progress}%` }} />
      <header id="siteHeader" className={scrolled ? "scrolled" : ""}>
        <div className="nav-inner">
          <Link className="logo" href="/">
            <div className="logo-mark">
              <div aria-hidden="true" className="brand-emblem">
                <img
                  alt="GB Asset Logo"
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
            {NAV_ITEMS.map((item) => (
              <Link key={item.hash} href={`/${item.hash}`}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link className="back-link" href="/">
            <svg viewBox="0 0 24 24">
              <path d="M15 5 8 12l7 7"></path>
            </svg>
            Back to Site
          </Link>
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
      </header>
      <div className={`mobile-nav-drawer${menuOpen ? " open" : ""}`}>
        <nav onClick={() => setMenuOpen(false)}>
          {NAV_ITEMS.map((item) => (
            <Link key={item.hash} href={`/${item.hash}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
