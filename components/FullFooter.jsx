"use client";

import Link from "next/link";

/**
 * Three-column footer used on index ("/"), /cart and /checkout.
 * Takes no props.
 *
 * Quick Links use cross-page `/#anchor` hrefs so they work from any route;
 * About Us and Services point at their own routes.
 * The Privacy Policy link points to `/privacy-policy` (a real Next.js
 * route) — this fixes the pre-existing dead `href="#"` bug that
 * cart.html/checkout.html had, per the approved migration plan. The
 * "Terms & Conditions" link has no destination in this plan's scope and is
 * left as `href="#"`, matching the original.
 */
export default function FullFooter() {
  return (
    <footer>
      <div className="wrap footer-grid">
        <div>
          <div className="footer-logo">
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
          </div>
          <p>
            Your trusted partner in global bullion trading. Providing the best value today, securing your future
            tomorrow.
          </p>
          <div className="socials">
            <a aria-label="Facebook" href="#">
              <svg viewBox="0 0 24 24">
                <path d="M15 8.5h2.5V5.2c-.43-.06-1.9-.2-3.62-.2-3.58 0-6.03 2.25-6.03 6.4v3.1H4.4v3.7h3.45V22h3.8v-3.8h3.32l.53-3.7h-3.85v-2.7c0-1.07.29-1.8 1.75-1.8Z"></path>
              </svg>
            </a>
            <a aria-label="Instagram" href="#">
              <svg viewBox="0 0 24 24">
                <rect height="17" rx="5" width="17" x="3.5" y="3.5"></rect>
                <circle cx="12" cy="12" r="4.2"></circle>
                <circle cx="17" cy="7" fill="currentColor" r="1" stroke="none"></circle>
              </svg>
            </a>
            <a aria-label="WhatsApp" href="#">
              <svg viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M6.3 17.7 4.5 21.5l3.9-1.7A8.5 8.5 0 1 0 5.2 13a8.4 8.4 0 0 0 1.1 4.7ZM8.7 8.7c.2-.5.4-.5.6-.5h.5c.15 0 .35 0 .5.4.2.4.6 1.5.65 1.6.05.15.1.3 0 .5-.1.2-.15.3-.3.45-.15.2-.3.3-.4.45-.15.15-.3.3-.1.6.15.3.7 1.2 1.5 1.9 1.05 1 1.9 1.3 2.2 1.45.3.15.5.1.65-.05.2-.2.7-.8.9-1.1.2-.3.4-.25.65-.15.3.1 1.5.7 1.75.85.25.15.4.2.45.35.1.15.1.85-.2 1.65-.3.8-1.7 1.55-2.35 1.6-.6.1-1.35.15-4.3-1.35C6.5 15.65 5 12.2 4.9 12c-.1-.2-.85-1.15-.85-2.2 0-1.05.55-1.55.75-1.8.2-.2.45-.25.6-.25Z"
                ></path>
              </svg>
            </a>
          </div>
        </div>
        <div>
          <h4>Quick Links</h4>
          <ul>
            <li>
              <Link href="/#top">Home</Link>
            </li>
            <li>
              <Link href="/#pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/about">About Us</Link>
            </li>
            <li>
              <Link href="/services">Services</Link>
            </li>
            <li>
              <Link href="/#products">Price Today</Link>
            </li>
            <li>
              <Link href="/#contact">Contact Us</Link>
            </li>
            <li>
              <Link href="/#location">Location</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4>Contact Us</h4>
          <div className="contact-line">
            <span className="ic">☎</span> +60 12-240 0600
          </div>
          <div className="contact-line">
            <span className="ic">✉</span> sales@gbagold.my
          </div>
          <div className="contact-line">
            <span className="ic">◎</span> Kuala Lumpur, Malaysia
          </div>
          <div className="contact-line">
            <span className="ic">◯</span> Mon – Sat : 9:00 AM – 6:00 PM
          </div>
        </div>
      </div>
      <div className="footer-bottom wrap">
        <div>© 2026 GB Asset. All rights reserved.</div>
        <div>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <a href="#">Terms &amp; Conditions</a>
        </div>
      </div>
    </footer>
  );
}
