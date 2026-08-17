"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGBA } from "../hooks/useGBA";

// Mirrors admin_dashboard.html's isExpired()/priority logic exactly, so the
// homepage shows the same thing the admin's "Public Landing Page Preview"
// already promises: no expiry = never expires; Critical wins over anything
// else, otherwise the most recently published active announcement.
function isExpired(a) {
  if (!a.expiry) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(a.expiry) < today;
}

function toDate(ts) {
  if (!ts) return new Date(0);
  return typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
}

function pickFeatured(list) {
  const active = list.filter((a) => !isExpired(a));
  const critical = active.find((a) => a.priority === "Critical");
  if (critical) return critical;
  return active.slice().sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt))[0] || null;
}

const DISMISS_KEY = "gba_dismissed_announcement";

// How many times the message repeats inside one ticker "copy". Purely
// decorative — it just gives the scrolling track enough width to loop
// smoothly instead of one short phrase crawling across an empty bar. The
// track is duplicated once more after this (see the JSX) for the seamless
// -50% loop technique.
const TICKER_REPEATS = 4;

// Constant reading speed regardless of message length — a fixed animation
// *duration* would make long announcements race past and short ones crawl.
// Mobile runs a little slower: less of the message is visible on screen at
// once on a narrow viewport, so the same px/s reads faster there.
const TICKER_PX_PER_SEC = { desktop: 90, mobile: 68 };
const MIN_TICKER_SECONDS = 10;

export default function AnnouncementBanner() {
  const gba = useGBA();
  const [featured, setFeatured] = useState(null);
  const [dismissedId, setDismissedId] = useState(undefined); // undefined until sessionStorage read, to avoid a one-frame flash
  const [duration, setDuration] = useState(30); // sensible default before the real width is measured
  const barRef = useRef(null);
  const groupRef = useRef(null); // one of the two (identical) ticker copies, used to measure its width

  useEffect(() => {
    if (!gba) return;
    const unsubscribe = gba.announcements.listen((list) => {
      setFeatured(pickFeatured(list));
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [gba]);

  useEffect(() => {
    try {
      setDismissedId(window.sessionStorage.getItem(DISMISS_KEY));
    } catch (e) {
      setDismissedId(null);
    }
  }, []);

  const visible = !!featured && dismissedId !== undefined && featured.docId !== dismissedId;

  // Sets --banner-offset so the fixed header/.scroll-progress (globals.css)
  // start below this banner instead of overlapping it. A ResizeObserver
  // (rather than measuring once on [visible, featured] change) keeps this
  // correct if the banner's own height changes for any other reason too —
  // e.g. the reduced-motion layout below, which lets a long message wrap
  // onto a second line instead of scrolling.
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!visible || !el) {
      document.documentElement.style.setProperty("--banner-offset", "0px");
      return;
    }
    const update = () => document.documentElement.style.setProperty("--banner-offset", `${el.offsetHeight}px`);
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => {
        ro.disconnect();
        document.documentElement.style.setProperty("--banner-offset", "0px");
      };
    }
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      document.documentElement.style.setProperty("--banner-offset", "0px");
    };
  }, [visible, featured]);

  // Ticker scroll speed: measure one copy's rendered width and convert it to
  // a duration that yields a constant px/s pace. Skipped entirely under
  // prefers-reduced-motion — the CSS media query below disables the
  // animation outright, so there is nothing useful to compute.
  useLayoutEffect(() => {
    if (!visible) return;
    const groupEl = groupRef.current;
    if (!groupEl) return;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const compute = () => {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const pxPerSec = isMobile ? TICKER_PX_PER_SEC.mobile : TICKER_PX_PER_SEC.desktop;
      const width = groupEl.scrollWidth;
      if (width > 0) setDuration(Math.max(width / pxPerSec, MIN_TICKER_SECONDS));
    };
    compute();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(compute);
      ro.observe(groupEl);
      window.addEventListener("resize", compute);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", compute);
      };
    }
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [visible, featured]);

  const tickerChips = useMemo(() => Array.from({ length: TICKER_REPEATS }, (_, i) => i), [featured]);

  function handleDismiss() {
    if (!featured) return;
    try {
      window.sessionStorage.setItem(DISMISS_KEY, featured.docId);
    } catch (e) {
      // sessionStorage unavailable (private browsing, etc.) — dismissal just
      // won't persist across reloads, which is a harmless degradation.
    }
    setDismissedId(featured.docId);
  }

  if (!visible) return null;

  const isCritical = featured.priority === "Critical";

  return (
    <div className={`announcement-banner${isCritical ? " banner-critical" : ""}`} ref={barRef}>
      <div className="announcement-ticker">
        <span className="announcement-badge">
          <svg aria-hidden="true" className="announcement-badge-icon" viewBox="0 0 24 24">
            <path d="M12 2c.6 3.8 2.2 6.7 5 8.5S22 12 22 12s-3.2.7-5 2.5-4.4 4.7-5 8.5c-.6-3.8-2.2-6.7-5-8.5S2 12 2 12s3.2-.7 5-2.5 4.4-4.7 5-8.5Z" />
          </svg>
          {isCritical ? "Urgent" : "Announcement"}
        </span>

        {/* Decorative — the real text is announced once via the .sr-only
            line below instead, so screen readers don't hear the repeated
            filler chips or the duplicated loop copy. */}
        <div aria-hidden="true" className="announcement-ticker-viewport">
          <div className="announcement-ticker-track" style={{ "--ticker-duration": `${duration}s` }}>
            <div className="announcement-ticker-group" ref={groupRef}>
              {tickerChips.map((i) => (
                <span className="announcement-ticker-chip" key={i}>
                  <span className="spark">✦</span>
                  <b>{featured.title}</b>
                  <span>{featured.content}</span>
                </span>
              ))}
            </div>
            <div className="announcement-ticker-group">
              {tickerChips.map((i) => (
                <span className="announcement-ticker-chip" key={i}>
                  <span className="spark">✦</span>
                  <b>{featured.title}</b>
                  <span>{featured.content}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="sr-only">
          {featured.title}. {featured.content}
        </p>
      </div>

      <button aria-label="Dismiss announcement" className="announcement-banner-close" onClick={handleDismiss} type="button">
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6 6 18"></path>
        </svg>
      </button>
    </div>
  );
}
