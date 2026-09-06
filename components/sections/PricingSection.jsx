"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGBA } from "../../hooks/useGBA";
import { useAuthAwareNav } from "../../hooks/useAuthAwareNav";
import { useCartBadge } from "../../hooks/useCartBadge";

/**
 * Static catalogue backing the 5 pricing cards. `staticPrice` is the
 * server-rendered fallback text (byte-identical to the original
 * index.html) shown until GBA.getProducts() resolves and replaces it via
 * GBA.fmtRM(price) — this avoids a hydration mismatch (no top-level GBA
 * access) while preserving the exact "LIVE PRICES" behavior.
 */
const PRICE_CARDS = [
  { id: "bar-1kg", weight: "1 Kilo", alt: "1 Kilo Gold Bar", img: "image/gold_1kg.png", staticPrice: "RM 537,893" },
  { id: "bar-250g", weight: "250 GM", alt: "250 GM Gold Bar", img: "image/gold_100g.png", staticPrice: "RM 134,525" },
  { id: "bar-100g", weight: "100 GM", alt: "100 GM Gold Bar", img: "image/gold_100g.png", staticPrice: "RM 53,832" },
  { id: "bar-50g", weight: "50 GM", alt: "50 GM Gold Bar", img: "image/gold_50g.png", staticPrice: "RM 26,929" },
  { id: "bar-20g", weight: "20 GM", alt: "20 GM Gold Bar", img: "image/gold_50g.png", staticPrice: "RM 11,040" },
  { id: "bar-10g", weight: "10 GM", alt: "10 GM Gold Bar", img: "image/gold_10g.png", staticPrice: "RM 5,579", containerStyle: { width: "65px" } },
  { id: "bar-5g", weight: "5 GM", alt: "5 GM Gold Bar", img: "image/gold_10g.png", staticPrice: "RM 2,792", containerStyle: { width: "65px" } },
  { id: "bar-1g", weight: "1 GM", alt: "1 GM Gold Bar", img: "image/gold_1g.png", staticPrice: "RM 559", containerStyle: { width: "65px" } },
];

/**
 * "Wholesaler Factory Price" grid — extracted from the homepage so the same
 * markup/logic can render both inline on "/" (id="pricing", anchored by the
 * hero's #pricing CTA) and on its own dedicated "/pricing" route.
 *
 * @param {{ showPageLink?: boolean }} props showPageLink renders a "View
 *   Pricing" link to /pricing — only passed true from the homepage, since a
 *   visitor already on /pricing doesn't need a link back to itself.
 */
export default function PricingSection({ showPageLink = false }) {
  const gba = useGBA();
  const { isAuthed, authReady } = useAuthAwareNav();
  const { refresh: refreshCartBadge } = useCartBadge();

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

  return (
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
        {showPageLink && (
          <div className="section-cta reveal">
            <Link className="btn btn-outline" href="/pricing">
              View Pricing
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
