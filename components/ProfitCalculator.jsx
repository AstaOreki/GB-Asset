"use client";

import { useState } from "react";

function fmtRM(n) {
  const sign = n < 0 ? "-" : "";
  return `RM${sign}${Math.abs(n).toFixed(2)}`;
}

// Rejects negative values at entry time (rather than clamping after the
// fact) so the field simply never accepts a "-" keystroke in the first
// place — a blank value is still allowed while the user is mid-typing.
function handleNonNegativeChange(setter) {
  return (e) => {
    const value = e.target.value;
    if (value === "" || parseFloat(value) >= 0) setter(value);
  };
}

/**
 * Standalone "what if" calculator — purely client-side arithmetic, not
 * wired to live product/rate data. Purchase/Selling Price and Margin %
 * are hypothetical numbers a visitor types in to estimate an outcome,
 * distinct from the site's real Product Pricing / Price Today figures.
 */
export default function ProfitCalculator() {
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [marginPercent, setMarginPercent] = useState("");

  const purchase = parseFloat(purchasePrice);
  const selling = parseFloat(sellingPrice);
  const margin = parseFloat(marginPercent);
  const hasValidInputs =
    purchasePrice !== "" && sellingPrice !== "" && marginPercent !== "" && !isNaN(purchase) && !isNaN(selling) && !isNaN(margin);

  const priceDifference = hasValidInputs ? selling - purchase : null;
  const marginAmount = hasValidInputs ? purchase * (margin / 100) : null;
  const estimatedProfit = hasValidInputs ? priceDifference + marginAmount : null;
  const isLoss = estimatedProfit != null && estimatedProfit < 0;

  return (
    <section className="profit-calc" id="profit-calculator">
      <div className="wrap">
        <div className="section-head on-dark reveal">
          <div className="eyebrow">Plan Ahead</div>
          <h2>Gold Profit Prediction Calculator</h2>
          <p>Estimate your potential profit or loss on a gold trade before you commit.</p>
        </div>

        <div className="profit-calc-grid reveal">
          <div className="profit-calc-inputs glass-card">
            <div className="field">
              <input
                inputMode="decimal"
                min="0"
                placeholder=" "
                step="0.01"
                type="number"
                value={purchasePrice}
                onChange={handleNonNegativeChange(setPurchasePrice)}
              />
              <label>Gold Purchase Price (RM)</label>
            </div>
            <div className="field">
              <input
                inputMode="decimal"
                min="0"
                placeholder=" "
                step="0.01"
                type="number"
                value={sellingPrice}
                onChange={handleNonNegativeChange(setSellingPrice)}
              />
              <label>Gold Selling Price (RM)</label>
            </div>
            <div className="field">
              <input
                inputMode="decimal"
                min="0"
                placeholder=" "
                step="0.01"
                type="number"
                value={marginPercent}
                onChange={handleNonNegativeChange(setMarginPercent)}
              />
              <label>Margin Percentage (%)</label>
            </div>
          </div>

          <div className="profit-calc-results">
            <div className="profit-result-row">
              <span>Purchase Price</span>
              <span>{hasValidInputs ? fmtRM(purchase) : "—"}</span>
            </div>
            <div className="profit-result-row">
              <span>Selling Price</span>
              <span>{hasValidInputs ? fmtRM(selling) : "—"}</span>
            </div>
            <div className="profit-result-row">
              <span>Margin Percentage</span>
              <span>{hasValidInputs ? `${margin.toFixed(2)}%` : "—"}</span>
            </div>
            <div className="profit-result-row">
              <span>Margin Amount</span>
              <span>{hasValidInputs ? fmtRM(marginAmount) : "—"}</span>
            </div>
            <div className={`profit-result-row profit-result-final${hasValidInputs ? (isLoss ? " is-loss" : " is-profit") : ""}`}>
              <span>Estimated {isLoss ? "Loss" : "Profit"}</span>
              <span>{hasValidInputs ? fmtRM(estimatedProfit) : "—"}</span>
            </div>
            <p className="profit-calc-disclaimer">
              An estimate for planning purposes only — actual outcomes depend on real-time gold prices and fees.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
