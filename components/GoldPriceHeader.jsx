"use client";

import { priceFor } from "../lib/goldPricing";

// Order and length must match the .gold-weight-toggle grid and its sliding
// indicator in page.css — the indicator's width and translate steps are
// derived from this many slots.
const WEIGHTS = [
  { grams: 1, label: "1g", unit: "gram" },
  { grams: 5, label: "5g", unit: "5g" },
  { grams: 10, label: "10g", unit: "10g" },
  { grams: 20, label: "20g", unit: "20g" },
  { grams: 50, label: "50g", unit: "50g" },
  { grams: 100, label: "100g", unit: "100g" },
  { grams: 250, label: "250g", unit: "250g" },
  { grams: 1000, label: "1kg", unit: "kg" },
];

// 2dp, matching the Investment Calculator directly below. Rounding to
// whole ringgit made the scaled figures fail to reconcile — a 598.50/g
// rate displayed as "RM 599" implies RM 29,950 at 50g, not the true
// RM 29,925.
function fmtRM2(n) {
  const sign = n < 0 ? "-" : "";
  return `RM${sign}${Math.abs(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Focal "current gold price" card + weight toggle for the Price Today
 * section. Purely a display widget over the live per-bar rates —
 * selecting a weight only changes what's shown here, it never touches
 * Product Pricing's independent per-bar prices or any stored data.
 *
 * The price shown is the selected bar's OWN live price, not the 1g rate
 * multiplied out: the admin prices each bar independently, so scaling 1g
 * made this card disagree with the bar price in the table below it.
 *
 * The selected weight is controlled by the parent so this toggle and the
 * chart's weight selector are always the same choice; they previously
 * held separate state and could disagree (header on 1kg, chart on 1g).
 */
export default function GoldPriceHeader({ rates, pricePerGram, percentChange, selectedGrams = 1, onSelectWeight }) {
  const selectedWeight = WEIGHTS.find((w) => w.grams === selectedGrams) || WEIGHTS[0];

  // Fall back to scaling the 1g rate only if the selected bar has no live
  // rate at all, so the card still shows something rather than "—".
  const tierPrice = priceFor(rates, selectedWeight.grams);
  const displayPrice =
    tierPrice != null
      ? tierPrice
      : typeof pricePerGram === "number" && pricePerGram > 0
        ? pricePerGram * selectedWeight.grams
        : null;
  const hasPrice = displayPrice != null && displayPrice > 0;
  const hasChange = typeof percentChange === "number" && !isNaN(percentChange);
  const direction = !hasChange || percentChange === 0 ? "flat" : percentChange > 0 ? "up" : "down";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "—";

  return (
    <div className="gold-price-header reveal">
      <div className="gold-price-card">
        <span className="gold-price-label">Gold Price (999.9)</span>
        <div className="gold-price-value">
          <span className="gold-price-amount">{hasPrice ? fmtRM2(displayPrice) : "—"}</span>
          <span className="gold-price-unit">/ {selectedWeight.unit}</span>
        </div>
        <span className={`gold-price-change is-${direction}`}>
          {arrow} {hasChange ? `${Math.abs(percentChange).toFixed(2)}%` : "0.00%"} today
        </span>
      </div>

      <div className="gold-weight-toggle" data-active={selectedWeight.grams}>
        <div className="gold-weight-indicator"></div>
        {WEIGHTS.map((w) => (
          <button
            key={w.grams}
            type="button"
            aria-pressed={selectedWeight.grams === w.grams}
            aria-label={`Show price per ${w.label}`}
            className={`gold-weight-btn${selectedWeight.grams === w.grams ? " active" : ""}`}
            onClick={() => onSelectWeight && onSelectWeight(w.grams)}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}
