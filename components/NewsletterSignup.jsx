"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/**
 * Homepage "Get Daily Gold Updates" signup, placed just above the footer.
 * POSTs to /api/newsletter/subscribe rather than writing to Firestore
 * directly — see lib/newsletter.js's subscribeEmail() for why the
 * subscribers collection isn't publicly writable at all.
 */
export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // { kind: "success" | "error", message }
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus({ kind: "error", message: "Please enter a valid email address." });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error || "Something went wrong. Please try again." });
        return;
      }
      setStatus({ kind: "success", message: data.message || "You're subscribed!" });
      setEmail("");
    } catch {
      setStatus({ kind: "error", message: "Network error — please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="newsletter-cta" id="newsletter">
      <div className="wrap">
        <div className="newsletter-cta-inner reveal">
          <div className="eyebrow">Stay Informed</div>
          <h2>Get Daily Gold Updates</h2>
          <p>Receive the latest GBA Gold price updates and market information directly in your inbox.</p>

          <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
            <input
              aria-label="Email address"
              disabled={submitting}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              type="email"
              value={email}
            />
            <button disabled={submitting} type="submit">
              {submitting ? "Subscribing…" : "Subscribe"}
            </button>
          </form>

          {status && (
            <p aria-live="polite" className={`newsletter-status is-${status.kind}`}>
              {status.message}
            </p>
          )}

          <p className="newsletter-consent">
            By subscribing, you agree to receive daily gold price emails from GBA Gold. Unsubscribe anytime — every
            email includes a one-click link.
          </p>
        </div>
      </div>
    </section>
  );
}
