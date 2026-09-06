"use client";

import { useEffect } from "react";
import StorefrontHeader from "../components/StorefrontHeader";
import FullFooter from "../components/FullFooter";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useButtonRipple } from "../hooks/useButtonRipple";
import AnnouncementBanner from "../components/AnnouncementBanner";
import LatestNews from "../components/LatestNews";
import PricingSection from "../components/sections/PricingSection";
import PriceTodaySection from "../components/sections/PriceTodaySection";
import ContactSection from "../components/sections/ContactSection";
import LocationSection from "../components/sections/LocationSection";
import "./page.css";

export default function HomePage() {
  useRevealOnScroll();
  useButtonRipple();

  // ============ SMOOTH IN-PAGE NAV ============
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function handleClick(e) {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      if (id.length > 1) {
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        }
      }
    }
    document.addEventListener("click", handleClick);
    return function () {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  // ============ LOGO SHIMMER (mousemove) ============
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const emblems = document.querySelectorAll(".brand-emblem");
    function handleMove(e) {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", ((e.clientX - rect.left) / rect.width) * 100 + "%");
      el.style.setProperty("--my", ((e.clientY - rect.top) / rect.height) * 100 + "%");
    }
    emblems.forEach(function (el) {
      el.addEventListener("mousemove", handleMove);
    });
    return function () {
      emblems.forEach(function (el) {
        el.removeEventListener("mousemove", handleMove);
      });
    };
  }, []);

  // ============ HERO GLOW PARALLAX ============
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const heroGlowEl = document.querySelector(".hero-glow");
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          const y = window.scrollY;
          if (heroGlowEl) heroGlowEl.style.transform = "translateY(" + Math.min(y * 0.1, 80) + "px)";
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return function () {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // ============ MAGNETIC BUTTON HOVER ============
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
    const els = document.querySelectorAll(".btn, .login-btn, .buy-btn, .submit-btn");
    function handleMove(e) {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const mx = (e.clientX - rect.left - rect.width / 2) * 0.18;
      const my = (e.clientY - rect.top - rect.height / 2) * 0.28;
      el.style.transform = "translate(" + mx + "px," + my + "px) scale(1.03)";
    }
    function handleLeave(e) {
      e.currentTarget.style.transform = "";
    }
    els.forEach(function (el) {
      el.addEventListener("mousemove", handleMove);
      el.addEventListener("mouseleave", handleLeave);
    });
    return function () {
      els.forEach(function (el) {
        el.removeEventListener("mousemove", handleMove);
        el.removeEventListener("mouseleave", handleLeave);
      });
    };
  }, []);

  // ============ COUNT-UP NUMBERS ============
  // No `.countup` elements exist in this page's markup today (same
  // dead-but-harmless status as the original inline script — ported
  // faithfully in case a future stat block adds the class/data-* attrs).
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const countEls = document.querySelectorAll(".countup");
    if (!countEls.length) return;

    function animateCount(el) {
      const target = parseFloat(el.getAttribute("data-target"));
      const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      const prefix = el.getAttribute("data-prefix") || "";
      const suffix = el.getAttribute("data-suffix") || "";
      if (reduceMotion) {
        el.textContent =
          prefix + target.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
        return;
      }
      let start = null;
      const duration = 1700;
      function step(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = target * eased;
        el.textContent =
          prefix + val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if ("IntersectionObserver" in window) {
      const countIO = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              countIO.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      countEls.forEach(function (el) {
        countIO.observe(el);
      });
      return function () {
        countIO.disconnect();
      };
    }
    countEls.forEach(animateCount);
  }, []);

  // ============ ANIMATED CHART LINE (dashboard backdrop) ============
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const chartPath = document.getElementById("chartLinePath");
    if (!chartPath || !("IntersectionObserver" in window)) return;
    const len = chartPath.getTotalLength();
    chartPath.style.strokeDasharray = String(len);
    chartPath.style.strokeDashoffset = String(len);
    const chartIO = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            chartPath.style.transition = "stroke-dashoffset 2.4s " + (reduceMotion ? "linear" : "cubic-bezier(.22,.61,.36,1)");
            chartPath.style.strokeDashoffset = "0";
            chartIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    chartIO.observe(chartPath);
    return function () {
      chartIO.disconnect();
    };
  }, []);

  return (
    <>
      <AnnouncementBanner />
      <StorefrontHeader />

      <section className="hero" id="top">
        <div className="hero-glow"></div>
        <div className="hero-content">
          <div className="eyebrow">Malaysia · Bullion &amp; Wholesale Gold</div>
          <h1>
            Invest in
            <br />
            <em>Timeless Value</em>
          </h1>
          <p className="sub">Malaysia&apos;s trusted bullion and wholesale gold platform.</p>
          <div className="hero-actions">
            <a className="btn btn-primary" data-ripple="" href="#pricing">
              View Live Prices
            </a>
            <a className="btn btn-outline" data-ripple="" href="#products">
              Explore Gold
            </a>
          </div>
          <div className="hero-badges">
            <div className="hbadge">
              <div className="hbadge-icon">
                <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24">
                  <polyline points="2,16 8,10.5 12,13.5 16,7 22,10"></polyline>
                  <circle cx="22" cy="10" fill="currentColor" r="1.5" stroke="none"></circle>
                </svg>
              </div>
              <b>Live Market Price</b>
              <span>Real-time updates</span>
            </div>
            <div className="hbadge">
              <div className="hbadge-icon">
                <svg fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3" viewBox="0 0 24 24">
                  <path d="M3.5 3.5H11L20.5 13 13 20.5 3.5 11V3.5Z"></path>
                  <circle cx="7.7" cy="7.7" fill="currentColor" r="1.3" stroke="none"></circle>
                </svg>
              </div>
              <b>Wholesaler Discount</b>
              <span>Best price for bulk buyers</span>
            </div>
            <div className="hbadge">
              <div className="hbadge-icon">
                <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" viewBox="0 0 24 24">
                  <path d="M12 3l7 3v6c0 5-3.3 7.6-7 9-3.7-1.4-7-4-7-9V6l7-3Z"></path>
                  <path d="M9 12.2l2.1 2.1L15.3 10"></path>
                </svg>
              </div>
              <b>Trusted &amp; Secure</b>
              <span>100% authentic gold</span>
            </div>
          </div>
          {/* Scrolls to the consultation form (id="consultation-form" on
              ContactSection's heading block) rather than opening WhatsApp —
              reuses the existing document-level smooth-scroll handler above
              (any a[href^="#"] click), no new JS needed. */}
          <a className="hero-whatsapp-cta" data-ripple="" href="#consultation-form">
            <span aria-hidden="true" className="hero-whatsapp-icon">
              <svg viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M6.3 17.7 4.5 21.5l3.9-1.7A8.5 8.5 0 1 0 5.2 13a8.4 8.4 0 0 0 1.1 4.7Zm2.4-9c.2-.5.4-.5.6-.5h.5c.15 0 .35 0 .5.4.2.4.6 1.5.65 1.6.05.15.1.3 0 .5-.1.2-.15.3-.3.45-.15.2-.3.3-.4.45-.15.15-.3.3-.1.6.15.3.7 1.2 1.5 1.9 1.05 1 1.9 1.3 2.2 1.45.3.15.5.1.65-.05.2-.2.7-.8.9-1.1.2-.3.4-.25.65-.15.3.1 1.5.7 1.75.85.25.15.4.2.45.35.1.15.1.85-.2 1.65-.3.8-1.7 1.55-2.35 1.6-.6.1-1.35.15-4.3-1.35C6.5 15.65 5 12.2 4.9 12c-.1-.2-.85-1.15-.85-2.2 0-1.05.55-1.55.75-1.8.2-.2.45-.25.6-.25Z"
                ></path>
              </svg>
            </span>
            <span className="hero-whatsapp-label">Talk with us for more info</span>
          </a>
        </div>
        <div className="scroll-cue">
          <span>SCROLL</span>
          <span className="line"></span>
        </div>
      </section>

      <PricingSection showPageLink />

      <section className="why-choose" id="why-us">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">Why Choose Us</div>
            <h2>Why Choose GBA Gold?</h2>
            <p>Every asset deserves a fair valuation. Every customer deserves professional service.</p>
          </div>
          <div className="why-grid reveal-stagger">
            <div className="why-item">
              <span className="check">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l5 5L20 6"></path>
                </svg>
              </span>
              Professional precious metals valuation
            </div>
            <div className="why-item">
              <span className="check">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l5 5L20 6"></path>
                </svg>
              </span>
              Competitive market pricing
            </div>
            <div className="why-item">
              <span className="check">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l5 5L20 6"></path>
                </svg>
              </span>
              Transparent transaction process
            </div>
            <div className="why-item">
              <span className="check">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l5 5L20 6"></path>
                </svg>
              </span>
              Fast and efficient service
            </div>
            <div className="why-item">
              <span className="check">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l5 5L20 6"></path>
                </svg>
              </span>
              Customer-first approach
            </div>
            <div className="why-item">
              <span className="check">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l5 5L20 6"></path>
                </svg>
              </span>
              Experienced team
            </div>
            <div className="why-item">
              <span className="check">
                <svg viewBox="0 0 24 24">
                  <path d="M4 12l5 5L20 6"></path>
                </svg>
              </span>
              Secure and confidential dealings
            </div>
          </div>
        </div>
      </section>

      <PriceTodaySection showPageLink />

      <section className="benefits">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">Why Gold</div>
            <h2>Gold Benefits</h2>
            <p>Four timeless reasons collectors and investors alike return to gold, generation after generation.</p>
          </div>
          <div className="benefits-grid reveal-stagger">
            <div className="benefit-item">
              <div className="benefit-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M3 17l6-6 4 4 8-8"></path>
                  <path d="M15 7h6v6"></path>
                </svg>
              </div>
              <h4>Inflation Hedge</h4>
              <p>Gold preserves purchasing power when currencies weaken.</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M4 9l3-4h10l3 4-8 11-8-11z" strokeLinejoin="round"></path>
                  <path d="M4 9h16"></path>
                  <path d="M9 5l3 15 3-15"></path>
                </svg>
              </div>
              <h4>Tangible Asset</h4>
              <p>Physical ownership, free from counterparty risk.</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"></path>
                </svg>
              </div>
              <h4>Global Liquidity</h4>
              <p>Traded and recognised in every major market worldwide.</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v18M7 21h10"></path>
                  <path d="M12 6l-6 2 6 2 6-2-6-2z" strokeLinejoin="round"></path>
                  <path d="M6 8l-3 6a3 3 0 006 0l-3-6zM18 8l-3 6a3 3 0 006 0l-3-6z" strokeLinejoin="round"></path>
                </svg>
              </div>
              <h4>Portfolio Balance</h4>
              <p>A time-tested hedge against market volatility.</p>
            </div>
          </div>
          <div className="benefits-crest reveal">
            <span className="line"></span>
            <span className="crest-mark">
              <div aria-hidden="true" className="brand-emblem">
                <img
                  alt="Crest"
                  className="brand-emblem-img"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAcYG8dNuU9Clu2ePHfM94yE26B1YRH0yjMbpqLABwDF3Np1f8MgdF2x-KmJUnBwd2i5IpO8q-fpU9KSHgAlEHUvHn8dYfHasLfYuOGa6MfgZpDzoYb5f3uKSsndATyT2NwH3kNH_twIxnW90EZZ0OFk1kGCvLjHRGyAVt6O5iP6mzVga6D1LPjNgYkbC8gG8TQqiyOkyWpuy4F1psuw43JsHyP_AK6OwqfDMjwe3Q64BYpnbaADnPZ2iUqeftjJBUjuApKD3_QPt9O"
                />
              </div>
            </span>
            <span className="line right"></span>
          </div>
        </div>
      </section>

      <section className="promise-banner reveal">
        <div className="wrap">
          <div className="hairline"></div>
          <h3>
            Every asset deserves a fair valuation.
            <br />
            Every customer deserves professional service.
          </h3>
          <p>
            At GBA Gold, we are committed to creating a trusted environment where customers can buy and sell precious
            metals with confidence. Through professionalism, integrity and transparent business practices, we aim to
            build lasting relationships while helping customers realise the true value of every asset they bring to
            us.
          </p>
        </div>
      </section>

      <ContactSection showPageLink />

      <section className="strip">
        <div className="wrap">
          <div className="trust-strip-inner reveal">
            <div className="trust-mark">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l7 3v6c0 5-3.3 7.6-7 9-3.7-1.4-7-4-7-9V6l7-3Z"></path>
                  <path d="M9 12.2l2.1 2.1L15.3 10"></path>
                </svg>
              </div>
              <div>
                <b>100% Authentic</b>
                <span>Certified &amp; genuine</span>
              </div>
            </div>
            <span className="ts-divider"></span>
            <div className="trust-mark">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M4 9l3-4h10l3 4-8 11-8-11z" strokeLinejoin="round"></path>
                  <path d="M4 9h16"></path>
                  <path d="M9 5l3 15 3-15"></path>
                </svg>
              </div>
              <div>
                <b>999.9 Fine Gold</b>
                <span>LBMA-aligned sourcing</span>
              </div>
            </div>
            <span className="ts-divider"></span>
            <div className="trust-mark">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <rect height="9" rx="1.5" width="14" x="5" y="11"></rect>
                  <path d="M8 11V7a4 4 0 018 0v4"></path>
                </svg>
              </div>
              <div>
                <b>Secure Transaction</b>
                <span>Safe &amp; reliable</span>
              </div>
            </div>
            <span className="ts-divider"></span>
            <div className="trust-mark">
              <div className="ic">
                <svg viewBox="0 0 24 24">
                  <path d="M3 7h11v9H3z"></path>
                  <path d="M14 11h4l3 3v2h-7z"></path>
                  <circle cx="7.5" cy="18" r="1.6"></circle>
                  <circle cx="17.5" cy="18" r="1.6"></circle>
                </svg>
              </div>
              <div>
                <b>Nationwide Delivery</b>
                <span>Insured &amp; secure</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LocationSection showPageLink />

      <LatestNews />

      <FullFooter />
    </>
  );
}
