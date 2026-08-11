"use client";

import { useState } from "react";

const WEIGHTS = [
  { grams: 1, label: "1g", unit: "gram" },
  { grams: 10, label: "10g", unit: "10g" },
  { grams: 50, label: "50g", unit: "50g" },
  { grams: 100, label: "100g", unit: "100g" },
  { grams: 1000, label: "1kg", unit: "kg" },
];

// The one calculation everything here derives from — never store or fetch
// a separate price per weight, always scale the live 1g rate.
export function calculateGoldPrice(pricePerGram, weightInGrams) {
  return pricePerGram * weightInGrams;
}

/**
 * Focal "current gold price" card + 1g/10g/100g/1kg weight toggle for the
 * Price Today section. Purely a display widget over the 1g bar's live
 * rate — selecting a weight only changes what's shown here, it never
 * touches Product Pricing's independent per-bar prices or any stored data.
 */
export default function GoldPriceHeader({ pricePerGram, percentChange, fmtRM }) {
  const [selectedWeight, setSelectedWeight] = useState(WEIGHTS[0]);

  const hasPrice = typeof pricePerGram === "number" && pricePerGram > 0;
  const displayPrice = hasPrice ? calculateGoldPrice(pricePerGram, selectedWeight.grams) : null;
  const hasChange = typeof percentChange === "number" && !isNaN(percentChange);
  const direction = !hasChange || percentChange === 0 ? "flat" : percentChange > 0 ? "up" : "down";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "—";

  return (
    <div className="gold-price-header reveal">
      <div className="gold-price-card">
        <span className="gold-price-label">Gold Price (999.9)</span>
        <div className="gold-price-value">
          <span className="gold-price-amount">{hasPrice && fmtRM ? fmtRM(displayPrice) : "—"}</span>
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
            onClick={() => setSelectedWeight(w)}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}
