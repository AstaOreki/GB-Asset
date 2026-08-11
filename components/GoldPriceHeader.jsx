"use client";

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
 * section. Purely a display widget over the 1g bar's live rate —
 * selecting a weight only changes what's shown here, it never touches
 * Product Pricing's independent per-bar prices or any stored data.
 *
 * The selected weight is controlled by the parent so this toggle and the
 * chart's weight selector are always the same choice; they previously
 * held separate state and could disagree (header on 1kg, chart on 1g).
 */
export default function GoldPriceHeader({ pricePerGram, percentChange, selectedGrams = 1, onSelectWeight }) {
  const selectedWeight = WEIGHTS.find((w) => w.grams === selectedGrams) || WEIGHTS[0];

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
