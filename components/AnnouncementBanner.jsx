"use client";

import { useEffect, useRef, useState } from "react";
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

export default function AnnouncementBanner() {
  const gba = useGBA();
  const [featured, setFeatured] = useState(null);
  const [dismissedId, setDismissedId] = useState(undefined); // undefined until sessionStorage read, to avoid a one-frame flash
  const barRef = useRef(null);

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
  // start below this banner instead of overlapping it.
  useEffect(() => {
    const height = visible && barRef.current ? barRef.current.offsetHeight : 0;
    document.documentElement.style.setProperty("--banner-offset", `${height}px`);
    return () => {
      document.documentElement.style.setProperty("--banner-offset", "0px");
    };
  }, [visible, featured]);

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

  return (
    <div className={`announcement-banner${featured.priority === "Critical" ? " banner-critical" : ""}`} ref={barRef}>
      <div className="announcement-banner-inner">
        <span className="announcement-banner-title">{featured.title}</span>
        <span className="announcement-banner-content">{featured.content}</span>
      </div>
      <button aria-label="Dismiss announcement" className="announcement-banner-close" onClick={handleDismiss} type="button">
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6 6 18"></path>
        </svg>
      </button>
    </div>
  );
}
