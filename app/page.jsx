"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StorefrontHeader from "../components/StorefrontHeader";
import FullFooter from "../components/FullFooter";
import { useGBA } from "../hooks/useGBA";
import { useAuthAwareNav } from "../hooks/useAuthAwareNav";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";
import { useButtonRipple } from "../hooks/useButtonRipple";
import { useCartBadge } from "../hooks/useCartBadge";
import AnnouncementBanner from "../components/AnnouncementBanner";
import PriceChart from "../components/PriceChart";
import PriceCompare from "../components/PriceCompare";
import ProfitCalculator from "../components/ProfitCalculator";
import GoldPriceHeader from "../components/GoldPriceHeader";
import { dailySeries, priceOn } from "../lib/priceSeries";
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

const PRICE_RANGES = [
  { key: "1d", label: "1 Day" },
  { key: "1w", label: "1 Week" },
  { key: "1m", label: "1 Month" },
  { key: "6m", label: "6 Months" },
  { key: "1y", label: "1 Year" },
];

// How many days back each tab covers. "1d" spans yesterday -> today so the
// day's movement is actually visible. On a day the admin didn't save,
// today carries yesterday's price forward and the line still draws (flat,
// which is the truth); if today is the very first record ever, the chart
// renders it as a single point rather than refusing to draw.
const RANGE_DAYS = { "1d": 1, "1w": 6, "1m": 29, "6m": 182, "1y": 364 };

/**
 * Direct contact lines, shown in the Contact section and the footer.
 *
 * `href` is the deep link; `value` is what the reader sees. wa.me wants the
 * number in international form with no +, spaces or leading 0, so the
 * displayed 0-prefixed number and the link digits are kept as separate
 * fields rather than derived from each other by string surgery.
 */
const CONTACT_METHODS = [
  { kind: "whatsapp", label: "Support Line", value: "012-213 6051", href: "https://wa.me/60122136051" },
  { kind: "whatsapp", label: "Zety", value: "012-333 3774", href: "https://wa.me/60123333774" },
  { kind: "whatsapp", label: "Izuddin", value: "012-240 600", href: "https://wa.me/6012240600" },
  { kind: "instagram", label: "Instagram", value: "@gbagold.my", href: "https://www.instagram.com/gbagold.my" },
];

const toJsDate = (ts) => (ts && ts.toDate ? ts.toDate() : ts instanceof Date ? ts : null);

// 2dp, same format as the Gold Price card — the High/Low tiles are now
// scaled by the selected weight, and whole-ringgit rounding made the
// scaled figures fail to reconcile (a 582.35/g high shown as "RM 582"
// implies RM 582,000 at 1kg, not the true RM 582,350).
const fmtRM2 = (n) =>
  `RM${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Each bar's real recorded prices are already stored per weight in
// priceHistory (the admin sets each bar independently), so charting a
// weight is a filter over existing data — never a multiplied 1g estimate.
const CHART_WEIGHTS = [
  { grams: 1, label: "1g" },
  { grams: 10, label: "10g" },
  { grams: 50, label: "50g" },
  { grams: 100, label: "100g" },
  { grams: 1000, label: "1kg" },
];

export default function HomePage() {
  const gba = useGBA();
  const { isAuthed, authReady } = useAuthAwareNav();
  const { refresh: refreshCartBadge } = useCartBadge();

  useRevealOnScroll();
  useButtonRipple();

  // -------- LIVE PRICES (realtime from Firestore "products", so an admin's --------
  // -------- per-gram rate update shows up here without a page refresh) --------
  const [prices, setPrices] = useState({});
  useEffect(() => {
    if (!gba) return;
    return gba.listenProducts((products) => {
      const next = {};
      PRICE_CARDS.forEach((card) => {
        const p = products[card.id];
        if (p) next[card.id] = gba.fmtRM(p.price);
      });
      setPrices(next);
    });
  }, [gba]);

  // -------- PRICE TODAY (gold rate history, from Firestore "priceHistory") --------
  const [activeRange, setActiveRange] = useState("1d");
  const [chartWeight, setChartWeight] = useState(1);
  // The table always shows exactly one row per bar (5 rows) — whichever
  // price is current, carried forward from its last update — not a growing
  // log, so it's driven by the carry-forward feed regardless of which tab
  // is selected. Same feed drives the stats row below.
  const [currentRows, setCurrentRows] = useState(null); // null = loading, [] = empty
  // Only the trend chart varies by tab — a real history of what changed
  // over the selected period.
  const [chartRows, setChartRows] = useState(null);
  const [chartError, setChartError] = useState(false);

  useEffect(() => {
    if (!gba) return;
    return gba.priceHistory.listenCurrent((rows) => setCurrentRows(rows));
  }, [gba]);

  useEffect(() => {
    if (!gba) return;
    // Don't reset chartRows to null here — switching tabs keeps the
    // previous period's line on screen (per dataviz refetch guidance: hold
    // the last frame, no flash back to a loading state) until the new
    // range's snapshot arrives.
    //
    // Fetches records up to today WITHOUT trimming to the start of the
    // period: the carry-forward walk needs the most recent record from
    // before the window, or a period with no saves of its own would render
    // empty even though a price was in force throughout it.
    setChartError(false);
    return gba.priceHistory.listenDaily(
      gba.priceHistory.todayKey(),
      gba.priceHistory.limits[activeRange] || 500,
      (rows) => setChartRows(rows),
      () => {
        setChartError(true);
        setChartRows([]);
      }
    );
  }, [gba, activeRange]);

  // One month either side of the viewed month is already covered by the
  // calendar feed's own window, so the calendar and comparison panels share
  // a single wider listener rather than opening one each.
  const [historyRows, setHistoryRows] = useState(null);
  useEffect(() => {
    if (!gba) return;
    return gba.priceHistory.listenDaily(
      gba.priceHistory.todayKey(),
      gba.priceHistory.limits.calendar,
      (rows) => setHistoryRows(rows),
      () => setHistoryRows([])
    );
  }, [gba]);

  // The immutable audit trail — every individual save. Today's High/Low read
  // from this because it is the only place several updates on the same day
  // survive; priceHistory keeps just that day's latest price.
  const [updateRows, setUpdateRows] = useState(null);
  useEffect(() => {
    if (!gba) return;
    return gba.priceHistory.listenUpdates(200, (rows) => setUpdateRows(rows), () => setUpdateRows([]));
  }, [gba]);

  // The price in force today for the selected bar, carried forward from its
  // last update if nothing was saved today.
  const chartSeriesToday = useMemo(() => {
    if (!historyRows || !gba) return null;
    return priceOn(historyRows, chartWeight, gba.priceHistory.todayKey());
  }, [historyRows, gba, chartWeight]);

  const todayRows = currentRows;
  // Today's High/Low for the SELECTED bar — the highest and lowest price the
  // admin actually set for it today.
  //
  // These used to be the best and worst per-gram rate across ALL five bars,
  // multiplied up to the selected weight. That produced figures no one ever
  // entered: at 1kg it read RM621,000 because the 1g bar happens to carry
  // the richest per-gram rate, while the card above showed the real 1kg
  // price. Now every figure here is a price the admin typed for this bar.
  const todayPricesForWeight =
    updateRows && gba
      ? updateRows
          .filter((r) => r.weight === chartWeight && r.date === gba.priceHistory.todayKey() && typeof r.sell === "number")
          .map((r) => r.sell)
      : [];
  // No save for this bar today: the price in force is the one carried
  // forward, so the day's high and low are both that single figure.
  const carriedToday = chartSeriesToday && chartSeriesToday.sell;
  const todayHigh = todayPricesForWeight.length
    ? Math.max(...todayPricesForWeight)
    : carriedToday != null
      ? carriedToday
      : null;
  const todayLow = todayPricesForWeight.length
    ? Math.min(...todayPricesForWeight)
    : carriedToday != null
      ? carriedToday
      : null;
  // The newest timestamp across all bars — rows arrive in catalogue
  // order, so the first row is just the 1kg bar, not the latest save.
  const lastUpdate =
    todayRows && todayRows.length
      ? todayRows.reduce((latest, r) => {
          const d = toJsDate(r.recordedAt);
          const l = toJsDate(latest);
          return d && (!l || d > l) ? r.recordedAt : latest;
        }, null)
      : null;
  // A bar with no Firestore doc yet falls back to the static catalogue
  // price, so "we have rows" alone doesn't mean any rate was ever set.
  const hasAnyRate = !!(todayRows && todayRows.some((r) => r.hasRecord));
  // The 1g bar's current sell rate. Both the Gold Price card and the
  // Investment Calculator quote each bar's own admin-set price; this is
  // only their fallback for a bar with no live rate of its own yet.
  const oneGramRow = currentRows && currentRows.find((r) => r.weight === 1);
  const pricePerGram = oneGramRow ? oneGramRow.sell : null;

  // Daily % change for the Gold Price header — last 7 days of the SELECTED
  // bar's history, compared against the most recent record from a
  // different calendar day than today (yesterday's/last-known price).
  // Per-bar, because the header now shows that bar's own price and each
  // bar is priced independently, so the 1g bar's movement isn't
  // necessarily the 1kg bar's.
  const [weekRows, setWeekRows] = useState(null);
  useEffect(() => {
    if (!gba) return;
    return gba.priceHistory.listen("1w", (rows) => setWeekRows(rows), () => setWeekRows([]));
  }, [gba]);
  const selectedRow = currentRows && currentRows.find((r) => r.weight === chartWeight);
  const selectedWeekRows = weekRows ? weekRows.filter((r) => r.weight === chartWeight) : null;
  // Compare against the newest record from a day BEFORE the current
  // price's own day — not simply "not today". The current price carries
  // forward from whenever it was last set, so if nothing was saved today
  // both sides used to resolve to the same record and the change always
  // read 0.00%, hiding the real movement.
  const currentPriceDay = toJsDate(selectedRow && selectedRow.recordedAt);
  const currentPriceDayStr = currentPriceDay ? currentPriceDay.toDateString() : new Date().toDateString();
  const previousDayRow =
    selectedWeekRows &&
    selectedWeekRows.find((r) => {
      const d = toJsDate(r.recordedAt);
      return d && d.toDateString() !== currentPriceDayStr && (!currentPriceDay || d < currentPriceDay);
    });
  const percentChange =
    selectedRow && previousDayRow && previousDayRow.sell > 0
      ? ((selectedRow.sell - previousDayRow.sell) / previousDayRow.sell) * 100
      : null;

  // The selected bar's applicable price for every day of the period.
  // priceHistory only stores days an admin actually saved; dailySeries
  // fills the rest by carrying the previous price forward and tags each
  // day so nothing invented can be mistaken for a real update.
  const chartWeightLabel = (CHART_WEIGHTS.find((w) => w.grams === chartWeight) || CHART_WEIGHTS[0]).label;
  // Is there any recorded price at all for the selected bar? Drives whether
  // the calendar and comparison panels render — an empty calendar is worse
  // than no calendar.
  const hasHistoryForWeight = !!(
    historyRows && historyRows.some((r) => r.weight === chartWeight && typeof r.sell === "number")
  );
  const chartSeries = useMemo(() => {
    if (!chartRows || !gba) return null;
    const today = gba.priceHistory.todayKey();
    const start = gba.priceHistory.shiftKey(today, -(RANGE_DAYS[activeRange] ?? 7));
    return dailySeries(chartRows, chartWeight, start, today);
  }, [chartRows, gba, activeRange, chartWeight]);

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

      <section className="price-today" id="products">
        <div className="wrap">
          <div className="section-head on-dark reveal">
            <div className="eyebrow">Price Today</div>
            <h2>Daily Gold Rate</h2>
            <p>Official Sell / Buy rates for each bar, 999.9 fine gold — updated daily and preserved as a full historical record.</p>
          </div>

          <GoldPriceHeader
            rates={currentRows}
            pricePerGram={pricePerGram}
            percentChange={percentChange}
            selectedGrams={chartWeight}
            onSelectWeight={setChartWeight}
          />

          <div className="price-stats reveal-stagger">
            <div className="pstat-tile">
              <span className="pstat-label">Today&apos;s High</span>
              <span className="pstat-value">{todayHigh != null ? fmtRM2(todayHigh) : "—"}</span>
            </div>
            <div className="pstat-tile">
              <span className="pstat-label">Today&apos;s Low</span>
              <span className="pstat-value">{todayLow != null ? fmtRM2(todayLow) : "—"}</span>
            </div>
            <div className="pstat-tile">
              <span className="pstat-label">Last Update</span>
              <span className="pstat-value pstat-value-sm">{lastUpdate ? gba.fmtDateTime(lastUpdate) : "—"}</span>
            </div>
          </div>

          <div className="chart-weight-block reveal">
            <span className="chart-weight-label">Gold Weight</span>
            <div className="chart-weight-group" role="group" aria-label="Gold weight for the price trend chart">
              {CHART_WEIGHTS.map((w) => (
                <button
                  key={w.grams}
                  type="button"
                  aria-pressed={chartWeight === w.grams}
                  className={`chart-weight-btn${chartWeight === w.grams ? " active" : ""}`}
                  onClick={() => setChartWeight(w.grams)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div className="price-tabs reveal" data-active={activeRange}>
            <div className="price-tab-indicator"></div>
            {PRICE_RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`price-tab-btn${activeRange === r.key ? " active" : ""}`}
                onClick={() => setActiveRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* One weight at a time — mixing weights into one line made the
              chart zigzag between unrelated price levels instead of showing
              a real trend. Each weight's own recorded prices are used, never
              a scaled 1g figure. */}
          {gba && !chartError && chartSeries && (
            <PriceChart series={chartSeries} weightLabel={chartWeightLabel} fmtRM={gba.fmtRM} />
          )}

          {/* Pure history — with nothing recorded for this bar there is
              nothing to show, so it stays out of the page entirely rather
              than rendering an empty shell. */}
          {gba && hasHistoryForWeight && (
            <PriceCompare
              records={historyRows}
              weight={chartWeight}
              weightLabel={chartWeightLabel}
              todayKey={gba.priceHistory.todayKey()}
              fmtRM={gba.fmtRM}
            />
          )}

          <ProfitCalculator rates={currentRows} pricePerGram={pricePerGram} />

          <h3 className="price-table-title reveal">Daily Price</h3>
          <div className="price-table reveal">
            <div className="price-table-head">
              <span>Date</span>
              <span>Weight (g)</span>
              <span>Buy Gold From GBA</span>
              <span>GBA Buys From You</span>
              <span>Margin</span>
            </div>
            <div className="price-table-body">
              {currentRows === null ? (
                <div className="price-table-empty">
                  <h3>Loading rates…</h3>
                </div>
              ) : currentRows.length === 0 || !hasAnyRate ? (
                <div className="price-table-empty">
                  <h3>No rates set yet</h3>
                  <p>Daily gold rates are updated by our team — check back soon.</p>
                </div>
              ) : (
                [...currentRows].sort((a, b) => (b.weight || 0) - (a.weight || 0)).map((row) => (
                  <div className="price-row" key={row.productId || row.docId}>
                    <span data-label="Date">{gba.fmtDateTime(row.recordedAt)}</span>
                    <span data-label="Weight (g)">{row.weight ? `${row.weight}g` : "—"}</span>
                    <span data-label="Buy Gold From GBA">{gba.fmtRM(row.sell)}</span>
                    <span data-label="GBA Buys From You">{gba.fmtRM(row.buy)}</span>
                    {/* Percentage plus the flat ringgit spread it works out
                        to — same RM formatting as the two price columns. */}
                    <span data-label="Margin">
                      {gba.fmtMarginPercent(row.sell, row.buy)}
                      {row.buy > 0 && typeof row.sell === "number" ? ` (${gba.fmtRM(row.sell - row.buy)})` : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

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

          {/* Direct lines, above the form — most people would rather message
              than fill in a form. Each opens the app directly. */}
          <div className="contact-methods reveal">
            {CONTACT_METHODS.map((c) => (
              <a
                key={c.href}
                className={`contact-method is-${c.kind}`}
                href={c.href}
                rel="noopener noreferrer"
                target="_blank"
                aria-label={`${c.label} on ${c.kind === "whatsapp" ? "WhatsApp" : "Instagram"}: ${c.value}`}
              >
                <span aria-hidden="true" className="contact-method-ic">
                  {c.kind === "whatsapp" ? (
                    <svg viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        d="M6.3 17.7 4.5 21.5l3.9-1.7A8.5 8.5 0 1 0 5.2 13a8.4 8.4 0 0 0 1.1 4.7Zm2.4-9c.2-.5.4-.5.6-.5h.5c.15 0 .35 0 .5.4.2.4.6 1.5.65 1.6.05.15.1.3 0 .5-.1.2-.15.3-.3.45-.15.2-.3.3-.4.45-.15.15-.3.3-.1.6.15.3.7 1.2 1.5 1.9 1.05 1 1.9 1.3 2.2 1.45.3.15.5.1.65-.05.2-.2.7-.8.9-1.1.2-.3.4-.25.65-.15.3.1 1.5.7 1.75.85.25.15.4.2.45.35.1.15.1.85-.2 1.65-.3.8-1.7 1.55-2.35 1.6-.6.1-1.35.15-4.3-1.35C6.5 15.65 5 12.2 4.9 12c-.1-.2-.85-1.15-.85-2.2 0-1.05.55-1.55.75-1.8.2-.2.45-.25.6-.25Z"
                      ></path>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24">
                      <rect height="17" rx="5" width="17" x="3.5" y="3.5"></rect>
                      <circle cx="12" cy="12" r="4.2"></circle>
                      <circle cx="17" cy="7" fill="currentColor" r="1" stroke="none"></circle>
                    </svg>
                  )}
                </span>
                <span className="contact-method-text">
                  <b>{c.label}</b>
                  <span>{c.value}</span>
                </span>
              </a>
            ))}
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
            <div className="eyebrow location-tag">Kuala Lumpur</div>
            <div className="store-details">
              <div className="store-detail">
                <div className="ic">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12Z"></path>
                    <circle cx="12" cy="9" r="2.5"></circle>
                  </svg>
                </div>
                <div>
                  <b>GB Asset</b>
                  <span>No. 7, Binjai 8 Premium Soho, Unit 8, Lorong Binjai, KLCC, Kuala Lumpur</span>
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
                  <span>+60 12-240 0600</span>
                </div>
              </div>
            </div>
            <a
              className="btn btn-primary store-directions-btn"
              data-ripple=""
              href="https://www.google.com/maps/search/?api=1&query=Binjai+8+Premium+Soho,3.15868,101.71742"
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
              src="https://www.google.com/maps?q=Binjai+8+Premium+Soho,3.15868,101.71742&z=17&output=embed"
              title="GB Asset Kuala Lumpur showroom location map"
            ></iframe>
          </div>
        </div>
      </section>

      <FullFooter />
    </>
  );
}
