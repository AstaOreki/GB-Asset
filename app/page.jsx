"use client";

import { useEffect, useRef, useState } from "react";
import StorefrontHeader from "../components/StorefrontHeader";
import FullFooter from "../components/FullFooter";
import { useGBA } from "../hooks/useGBA";
import { useAuthAwareNav } from "../hooks/useAuthAwareNav";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useButtonRipple } from "../hooks/useButtonRipple";
import { useCartBadge } from "../hooks/useCartBadge";
import AnnouncementBanner from "../components/AnnouncementBanner";
import "./page.css";

/**
 * Static catalogue backing the 5 pricing cards. `staticPrice` is the
 * server-rendered fallback text (byte-identical to the original
 * index.html) shown until GBA.getProducts() resolves and replaces it via
 * GBA.fmtRM(price) — this avoids a hydration mismatch (no top-level GBA
 * access) while preserving the exact "LIVE PRICES" behavior.
 */
const PRICE_CARDS = [
  { id: "bar-1kg", weight: "1 Kilo", alt: "1 Kilo Gold Bar", img: "image/gold_1kg.png", staticPrice: "RM 537,893" },
  { id: "bar-100g", weight: "100 GM", alt: "100 GM Gold Bar", img: "image/gold_100g.png", staticPrice: "RM 53,832" },
  { id: "bar-50g", weight: "50 GM", alt: "50 GM Gold Bar", img: "image/gold_50g.png", staticPrice: "RM 26,929" },
  { id: "bar-10g", weight: "10 GM", alt: "10 GM Gold Bar", img: "image/gold_10g.png", staticPrice: "RM 5,579", containerStyle: { width: "65px" } },
  { id: "bar-1g", weight: "1 GM", alt: "1 GM Gold Bar", img: "image/gold_1g.png", staticPrice: "RM 559", containerStyle: { width: "65px" } },
];

export default function HomePage() {
  const gba = useGBA();
  const { isAuthed, authReady } = useAuthAwareNav();
  const { refresh: refreshCartBadge } = useCartBadge();

  useRevealOnScroll();
  useButtonRipple();

  // -------- LIVE PRICES (reads admin-set prices from Firestore "products") --------
  const [prices, setPrices] = useState({});
  useEffect(() => {
    if (!gba) return;
    gba.getProducts().then((products) => {
      const next = {};
      PRICE_CARDS.forEach((card) => {
        const p = products[card.id];
        if (p) next[card.id] = gba.fmtRM(p.price);
      });
      setPrices(next);
    });
  }, [gba]);

  // -------- ADD TO CART (requires an account — redirects to /login otherwise) --------
  const [cartStatus, setCartStatus] = useState({});
  // If a click lands before gba/authReady resolve (e.g. slow connection),
  // it used to be silently dropped — button looked interactive but nothing
  // happened. Queue the click instead and run it once auth is known.
  const [pendingAddId, setPendingAddId] = useState(null);

  function performAddToCart(id) {
    if (!isAuthed) {
      window.location.href = "/login";
      return;
    }
    setCartStatus((s) => ({ ...s, [id]: "pending" }));
    gba.cart
      .add(id, 1)
      .then(() => {
        refreshCartBadge();
        setCartStatus((s) => ({ ...s, [id]: "added" }));
        setTimeout(() => {
          setCartStatus((s) => ({ ...s, [id]: "idle" }));
        }, 1200);
      })
      .catch(() => {
        setCartStatus((s) => ({ ...s, [id]: "idle" }));
      });
  }

  function handleAddToCart(id) {
    if (!gba || !authReady) {
      setPendingAddId(id);
      return;
    }
    performAddToCart(id);
  }

  useEffect(() => {
    if (!gba || !authReady || !pendingAddId) return;
    const id = pendingAddId;
    setPendingAddId(null);
    performAddToCart(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gba, authReady, pendingAddId]);

  // -------- CONSULTATION / ENQUIRY FORM → Firestore --------
  const formRef = useRef(null);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const emailRef = useRef(null);
  const messageRef = useRef(null);
  const [consultState, setConsultState] = useState("");
  const [consultStatus, setConsultStatus] = useState("We will get back to you as soon as possible.");
  const [consultSubmitting, setConsultSubmitting] = useState(false);

  function handleConsultSubmit(e) {
    e.preventDefault();
    const name = nameRef.current.value.trim();
    const phone = phoneRef.current.value.trim();
    const email = emailRef.current.value.trim();
    const message = messageRef.current.value.trim();
    if (!name || !phone) {
      setConsultStatus("Please provide your full name and phone number.");
      return;
    }
    if (!gba) return;
    setConsultSubmitting(true);
    gba.consultations
      .submit({ name: name, phone: phone, email: email, location: consultState, org: "", message: message })
      .then(() => {
        setConsultStatus("Thank you — a bullion specialist will be in touch shortly.");
        formRef.current.reset();
        setConsultState("");
        setConsultSubmitting(false);
      })
      .catch(() => {
        setConsultStatus("Something went wrong sending your enquiry. Please try again.");
        setConsultSubmitting(false);
      });
  }

  // ============ ACTIVE NAV LINK ON SCROLL ============
  // StorefrontHeader (variant="home") only statically marks "Home" active,
  // it has no section-tracking prop — so this queries `nav.nav-links a`
  // directly from the DOM (same approach the original inline script used)
  // and toggles `.active` imperatively as the user scrolls past sections.
  useEffect(() => {
    const header = document.getElementById("siteHeader");
    const navLinks = Array.prototype.slice.call(document.querySelectorAll('nav.nav-links a[href^="#"]'));
    const navSections = navLinks.map(function (a) {
      return document.querySelector(a.getAttribute("href"));
    });
    function onNavScroll() {
      if (!header) return;
      const headerH = header.offsetHeight;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const pos = atBottom ? Infinity : window.scrollY + headerH + 4;
      let bestIndex = 0;
      let bestTop = -Infinity;
      navSections.forEach(function (sec, i) {
        if (sec && sec.offsetTop <= pos && sec.offsetTop > bestTop) {
          bestTop = sec.offsetTop;
          bestIndex = i;
        }
      });
      navLinks.forEach(function (a, i) {
        a.classList.toggle("active", i === bestIndex);
      });
    }
    window.addEventListener("scroll", onNavScroll, { passive: true });
    onNavScroll();
    return function () {
      window.removeEventListener("scroll", onNavScroll);
    };
  }, []);

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
      <StorefrontHeader variant="home" />

      <section className="hero" id="top">
        <div className="hero-glow"></div>
        <div className="hero-content">
          <div className="eyebrow">Malaysia · Bullion &amp; Wholesale Gold</div>
          <h1>
            Invest in
            <br />
            <em>Timeless Value</em>
          </h1>
          <p className="sub">Malaysia&apos;s trusted bullion and wholesale gold investment platform.</p>
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
        </div>
        <div className="scroll-cue">
          <span>SCROLL</span>
          <span className="line"></span>
        </div>
      </section>

      <section className="dashboard" id="pricing">
        <svg className="dashboard-chartline" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0,170 L90,150 L180,175 L270,120 L360,140 L450,90 L540,110 L630,70 L720,95 L810,55 L900,75 L990,40 L1080,58 L1200,20"
            fill="none"
            id="chartLinePath"
            stroke="url(#chartLineGrad)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          ></path>
          <defs>
            <linearGradient id="chartLineGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0"></stop>
              <stop offset="50%" stopColor="#F0CD6B" stopOpacity=".9"></stop>
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0"></stop>
            </linearGradient>
          </defs>
        </svg>
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">Today&apos;s Rate</div>
            <h2>Wholesaler Factory Price</h2>
            <p>All bars are 999.9 (24K) fine gold, certified and sealed.</p>
          </div>
          <div className="price-grid reveal-stagger">
            {PRICE_CARDS.map((card) => {
              const status = cartStatus[card.id] || "idle";
              return (
                <div className="price-card" key={card.id}>
                  <div className="live-badge">
                    <span className="live-dot"></span>LIVE
                  </div>
                  <div className="gold-bar-container" style={card.containerStyle}>
                    <div className="glint-overlay"></div>
                    <img alt={card.alt} className="gold-bar-img" src={card.img} />
                  </div>
                  <div className="weight">{card.weight}</div>
                  <div className="purity">Purity 999.9</div>
                  <div className="price">
                    {prices[card.id] || card.staticPrice}
                    <small>per unit</small>
                  </div>
                  <button
                    className="buy-btn"
                    data-product-id={card.id}
                    disabled={status !== "idle"}
                    onClick={() => handleAddToCart(card.id)}
                  >
                    {status === "added" ? "Added ✓" : "Add to Cart"}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="dashboard-note reveal">ⓘ Actual product design may vary. All gold bars are certified and sealed.</div>
        </div>
      </section>

      <section className="heritage" id="heritage">
        <div className="wrap heritage-grid">
          <div className="heritage-visual reveal">
            <img alt="Premium Bullion Collection" className="heritage-photo" src="image/gold_bars_group.png" />
          </div>
          <div className="heritage-text reveal">
            <div className="eyebrow">About Us</div>
            <h2>GBA Gold</h2>
            <p>
              GBA Gold is a trusted precious metals trading brand under GB Asset Trading, specialising in the buying and
              selling of gold and silver with a commitment to transparency, fair valuation and professional service.
            </p>
            <p>
              We provide reliable solutions for individuals who wish to sell used jewellery, damaged gold, unwanted
              precious metals or monetise their valuable assets through a secure and straightforward process.
            </p>
            <p>
              Our experienced team focuses on accurate evaluation, competitive pricing and ethical business practices
              to ensure every customer enjoys a smooth and trusted experience.
            </p>
            <p className="promise-line">
              At GBA Gold, we believe every gram has value, and every customer deserves honesty, respect and confidence
              in every transaction.
            </p>
          </div>
        </div>
      </section>

      <section className="services" id="services">
        <div className="wrap">
          <div className="section-head on-dark reveal">
            <div className="eyebrow">What We Offer</div>
            <h2>Our Services</h2>
            <p>Complete, transparent precious metals solutions — from valuation to trading.</p>
          </div>
          <div className="services-grid reveal-stagger">
            <div className="service-card">
              <div className="service-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M4 8h13M17 8l-4-4M20 16H7M7 16l4 4"></path>
                </svg>
              </div>
              <h4>Buying &amp; Selling</h4>
              <p>Gold and silver trading with fair, competitive pricing on every transaction.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2l2.5 5.5L20 9l-4.2 3.8L17 19l-5-3.2L7 19l1.2-6.2L4 9l5.5-1.5z"></path>
                </svg>
              </div>
              <h4>Jewellery Purchase</h4>
              <p>We purchase used, damaged and unwanted jewellery at honest, accurate valuations.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v18M5 7h14M5 7l-3 6a3 3 0 006 0l-3-6zM19 7l-3 6a3 3 0 006 0l-3-6z"></path>
                </svg>
              </div>
              <h4>Gold Valuation</h4>
              <p>Precise, professional evaluation of gold and precious metal assets.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M3 17l6-6 4 4 8-8M15 7h6v6"></path>
                </svg>
              </div>
              <h4>Precious Metals Trading</h4>
              <p>Secure, market-aligned trading across gold and silver assets.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.4-4 8-9 8-1.5 0-2.9-.3-4.1-.9L3 20l1-4.2C3.4 14.6 3 13.3 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"></path>
                </svg>
              </div>
              <h4>Asset Consultation</h4>
              <p>Guidance on monetising your valuable precious metal assets, tailored to you.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l7 3v6c0 5-3.3 7.6-7 9-3.7-1.4-7-4-7-9V6l7-3Z"></path>
                  <path d="M9 12.2l2.1 2.1L15.3 10"></path>
                </svg>
              </div>
              <h4>Redemption &amp; Resale</h4>
              <p>Assistance with eligible gold redemption and resale processes, where applicable.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="pvm">
        <div className="wrap pvm-grid">
          <div className="pvm-col reveal">
            <div className="eyebrow">Our Promise</div>
            <h3>
              Fair Value.
              <br />
              Trusted Service.
              <br />
              Lasting Relationships.
            </h3>
          </div>
          <div className="pvm-col reveal">
            <div className="eyebrow">Company Vision</div>
            <h3>Our Vision</h3>
            <p>
              To become one of Malaysia&apos;s most trusted precious metals trading companies, delivering secure,
              transparent and value-driven solutions for every customer.
            </p>
          </div>
          <div className="pvm-col reveal">
            <div className="eyebrow">Our Mission</div>
            <h3>What Drives Us</h3>
            <ul className="mission-list">
              <li>
                <b>*</b>Deliver fair and transparent pricing.
              </li>
              <li>
                <b>*</b>Build long-term customer trust.
              </li>
              <li>
                <b>*</b>Promote responsible precious metals trading.
              </li>
              <li>
                <b>*</b>Provide professional asset valuation services.
              </li>
              <li>
                <b>*</b>Continuously improve customer experience.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="core-values" id="values">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">Core Values</div>
            <h2>T.R.U.S.T</h2>
            <p>The five principles that guide every transaction at GBA Gold.</p>
          </div>
          <div className="trust-word reveal-stagger">
            <div className="trust-letter">
              <span className="lg">T</span>
              <b>Transparency</b>
              <span>Open, honest dealings</span>
            </div>
            <div className="trust-letter">
              <span className="lg">R</span>
              <b>Respect</b>
              <span>Every customer valued</span>
            </div>
            <div className="trust-letter">
              <span className="lg">U</span>
              <b>Unity</b>
              <span>One team, one purpose</span>
            </div>
            <div className="trust-letter">
              <span className="lg">S</span>
              <b>Service Excellence</b>
              <span>Professional, every time</span>
            </div>
            <div className="trust-letter">
              <span className="lg">T</span>
              <b>Trust</b>
              <span>Earned in every gram</span>
            </div>
          </div>
        </div>
      </section>

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

      <section className="showcase" id="products">
        <div className="wrap">
          <div className="section-head on-dark reveal">
            <div className="eyebrow">Featured Products</div>
            <h2>The Bullion Collection</h2>
            <p>Precision-cast gold bars, each individually certified for weight and purity.</p>
          </div>
          <div className="showcase-grid reveal-stagger">
            <div className="show-card">
              <div className="show-media">
                <div className="gold-bar-container" style={{ width: "90px" }}>
                  <div className="glint-overlay"></div>
                  <img alt="1 Kilo Bar" className="gold-bar-img" src="image/gold_1kg.png" />
                </div>
              </div>
              <div className="show-body">
                <div className="tag">Signature Bar</div>
                <h3>1 Kilo Investment Bar</h3>
                <p>Our most sought-after bar for serious investors and institutions.</p>
                <div className="sprice">RM 537,893</div>
              </div>
            </div>
            <div className="show-card">
              <div className="show-media">
                <div className="gold-bar-container" style={{ width: "113px" }}>
                  <div className="glint-overlay"></div>
                  <img alt="100 GM Bar" className="gold-bar-img" src="image/gold_100g.png" />
                </div>
              </div>
              <div className="show-body">
                <div className="tag">Best Seller</div>
                <h3>100 GM Wholesale Bar</h3>
                <p>The balanced choice — accessible entry into serious gold ownership.</p>
                <div className="sprice">RM 53,832</div>
              </div>
            </div>
            <div className="show-card">
              <div className="show-media">
                <div className="gold-bar-container" style={{ width: "110px" }}>
                  <div className="glint-overlay"></div>
                  <img alt="10 GM Bar" className="gold-bar-img" src="image/gold_10g.png" />
                </div>
              </div>
              <div className="show-body">
                <div className="tag">Starter Collection</div>
                <h3>10 GM Gift Bar</h3>
                <p>A refined introduction to gold — ideal for milestone gifting.</p>
                <div className="sprice">RM 5,579</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="benefits">
        <div className="wrap">
          <div className="section-head reveal">
            <div className="eyebrow">Why Gold</div>
            <h2>Investment Benefits</h2>
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

      <section className="consult" id="contact">
        <div className="wrap consult-inner">
          <div className="consult-intro reveal">
            <div className="eyebrow">We Buy Your Gold</div>
            <h2>Request a Private Consultation</h2>
            <p>
              Speak with our bullion specialists for a confidential valuation and offer, or any enquiry regarding our
              gold products.
            </p>
          </div>
          <form className="glass-card reveal" id="consultForm" ref={formRef} onSubmit={handleConsultSubmit}>
            <div className="field">
              <input id="consultName" ref={nameRef} placeholder=" " required type="text" />
              <label>Full Name *</label>
            </div>
            <div className="field">
              <input id="consultPhone" ref={phoneRef} placeholder=" " required type="text" />
              <label>Phone Number *</label>
            </div>
            <div className="field">
              <input id="consultEmail" ref={emailRef} placeholder=" " type="email" />
              <label>Email Address</label>
            </div>
            <div className="field">
              <select
                id="consultState"
                data-empty={consultState === "" ? "true" : "false"}
                value={consultState}
                onChange={(e) => setConsultState(e.target.value)}
              >
                <option value=""></option>
                <option>Johor</option>
                <option>Kedah</option>
                <option>Kelantan</option>
                <option>Kuala Lumpur</option>
                <option>Labuan</option>
                <option>Malacca</option>
                <option>Negeri Sembilan</option>
                <option>Pahang</option>
                <option>Penang</option>
                <option>Perak</option>
                <option>Perlis</option>
                <option>Putrajaya</option>
                <option>Sabah</option>
                <option>Sarawak</option>
                <option>Selangor</option>
                <option>Terengganu</option>
                <option>Other</option>
              </select>
              <label>State</label>
            </div>
            <div className="field">
              <textarea id="consultMessage" ref={messageRef} placeholder=" "></textarea>
              <label>Message</label>
            </div>
            <button className="submit-btn" data-ripple="" type="submit" disabled={consultSubmitting}>
              Submit Enquiry
            </button>
            <div className="submit-sub" id="consultStatus">
              {consultStatus}
            </div>
          </form>
        </div>
      </section>

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

      <section className="store-location" id="location">
        <div className="wrap store-grid">
          <div className="store-info reveal">
            <div className="eyebrow">Visit Us</div>
            <h2>Our Store Location</h2>
            <p>
              Step into our showroom to view our bullion collection in person, get an in-store valuation, or speak
              directly with our precious metals specialists.
            </p>
            <div className="store-details">
              <div className="store-detail">
                <div className="ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12Z"></path>
                    <circle cx="12" cy="9" r="2.5"></circle>
                  </svg>
                </div>
                <div>
                  <b>S. Ameer Jewelers</b>
                  <span>George Town, Penang, Malaysia</span>
                </div>
              </div>
              <div className="store-detail">
                <div className="ic">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 7v5l3.5 2"></path>
                  </svg>
                </div>
                <div>
                  <b>Opening Hours</b>
                  <span>Mon – Sat : 9:00 AM – 6:00 PM</span>
                </div>
              </div>
              <div className="store-detail">
                <div className="ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M6.3 17.7 4.5 21.5l3.9-1.7A8.5 8.5 0 1 0 5.2 13a8.4 8.4 0 0 0 1.1 4.7Z"></path>
                  </svg>
                </div>
                <div>
                  <b>Contact</b>
                  <span>+60 12-345 6789</span>
                </div>
              </div>
            </div>
            <a
              className="btn btn-primary store-directions-btn"
              data-ripple=""
              href="https://www.google.com/maps/place/S.+Ameer+Jewelers/@5.416198,100.3350901,17z/data=!3m1!4b1!4m6!3m5!1s0x304ac391e9325c1b:0x68ecf1497a1cf128!8m2!3d5.416198!4d100.337665!16s%2Fg%2F11bccgg66m"
              rel="noopener"
              target="_blank"
            >
              Get Directions
            </a>
          </div>
          <div className="store-map reveal">
            <iframe
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src="https://www.google.com/maps?q=S.+Ameer+Jewelers,5.416198,100.337665&z=17&output=embed"
              title="S. Ameer Jewelers store location map"
            ></iframe>
          </div>
        </div>
      </section>

      <FullFooter />
    </>
  );
}
