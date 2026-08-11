"use client";

import { useState } from "react";
import { ratePerGramFor, tierFor } from "../lib/goldPricing";

const PERCENT_PRESETS = [5, 10, 15, 20];

function fmtRM(n) {
  const sign = n < 0 ? "-" : "";
  return `RM${sign}${Math.abs(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Rejects negative values at entry time rather than clamping after the
// fact, so a "-" keystroke is simply never accepted; a blank value is
// still allowed while the user is mid-typing.
function handleNonNegativeChange(setter) {
  return (e) => {
    const value = e.target.value;
    if (value === "" || parseFloat(value) >= 0) setter(value);
  };
}

/**
 * Gold Investment Calculator — what a given gold quantity (grams) is
 * worth at today's live rates, and what that could be worth at an assumed
 * future % change. `rates` is the live per-bar current-rates feed from the
 * Price Today section, so this never fetches/derives/hardcodes its own
 * price — it always reflects whatever the admin has entered for today.
 *
 * The rate used is the one for the bar tier the entered quantity actually
 * qualifies for, NOT a flat 1g rate multiplied out: the admin prices each
 * bar independently, so 1,000 g at the 1g rate quoted a number that
 * contradicted the 1kg bar's own price shown in the table below.
 */
export default function ProfitCalculator({ rates, pricePerGram }) {
  const [gramsInput, setGramsInput] = useState("");
  const [selectedPercent, setSelectedPercent] = useState(10);
  const [isCustom, setIsCustom] = useState(false);
  const [customPercent, setCustomPercent] = useState("");

  const grams = parseFloat(gramsInput);
  const percent = isCustom ? parseFloat(customPercent) : selectedPercent;
  // The tier rate for what was actually entered; before anything is typed
  // the headline quotes the smallest bar's rate.
  const appliedRate = ratePerGramFor(rates, grams > 0 ? grams : 1) ?? (typeof pricePerGram === "number" ? pricePerGram : null);
  const headlineRate = ratePerGramFor(rates, 1) ?? (typeof pricePerGram === "number" ? pricePerGram : null);
  const hasPrice = typeof appliedRate === "number" && appliedRate > 0;
  const hasValidInputs =
    gramsInput !== "" && !isNaN(grams) && grams > 0 && !isNaN(percent) && (!isCustom || customPercent !== "") && hasPrice;

  // The admin's own margin on the bar this quantity is priced from, shown
  // for information only — it is deliberately NOT subtracted from the
  // projection, which stays a straight Sell-price-times-growth figure.
  // Same % markup over Buy that Product Pricing and the table below show.
  const tier = tierFor(rates, grams > 0 ? grams : 1);
  const marginPercent = tier && tier.buy > 0 ? ((tier.sell - tier.buy) / tier.buy) * 100 : null;

  const currentValue = hasValidInputs ? grams * appliedRate : null;
  const futureValue = hasValidInputs ? currentValue * (1 + percent / 100) : null;
  const estimatedProfit = hasValidInputs ? futureValue - currentValue : null;
  const isLoss = estimatedProfit != null && estimatedProfit < 0;

  function selectPreset(p) {
    setSelectedPercent(p);
    setIsCustom(false);
  }

  return (
    <div className="invest-calc reveal">
      <div className="invest-calc-head">
        <h3>Gold Investment Calculator</h3>
        <p>
          See what your gold is worth at today&apos;s live rate
          {/* 2dp, not whole ringgit — a 537.893/g rate shown as "RM538"
              implies RM538,000 at 1kg instead of the true RM537,893. */}
          {hasPrice ? ` (${fmtRM(hasValidInputs ? appliedRate : headlineRate)}/g)` : ""}, and what it could be worth later.
        </p>
      </div>

      <div className="invest-calc-body">
        <div className="invest-calc-inputs">
          <div className="field">
            <input
              inputMode="decimal"
              min="0"
              placeholder=" "
              step="0.01"
              type="number"
              value={gramsInput}
              onChange={handleNonNegativeChange(setGramsInput)}
            />
            <label>Gold Quantity (g)</label>
          </div>

          <div className="invest-percent-block">
            <span className="invest-percent-label">If gold value grows by</span>
            <div className="invest-percent-group">
              {PERCENT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`invest-percent-btn${!isCustom && selectedPercent === p ? " active" : ""}`}
                  onClick={() => selectPreset(p)}
                >
                  {p}%
                </button>
              ))}
              <button type="button" className={`invest-percent-btn${isCustom ? " active" : ""}`} onClick={() => setIsCustom(true)}>
                Custom
              </button>
            </div>
            {isCustom && (
              <div className="field invest-custom-field">
                <input inputMode="decimal" placeholder=" " step="0.01" type="number" value={customPercent} onChange={(e) => setCustomPercent(e.target.value)} />
                <label>Custom Percentage (%)</label>
              </div>
            )}
          </div>
        </div>

        <div className="invest-calc-results">
          <div className="profit-result-row">
            <span>Gold Purchased</span>
            <span>{hasValidInputs ? `${grams.toLocaleString("en-MY")} g` : "—"}</span>
          </div>
          <div className="profit-result-row">
            <span>Current Gold Value</span>
            <span>{hasValidInputs ? fmtRM(currentValue) : "—"}</span>
          </div>
          <div className="profit-result-row">
            <span>Projected Future Value</span>
            <span>{hasValidInputs ? fmtRM(futureValue) : "—"}</span>
          </div>
          <div className="profit-result-row">
            <span>GBA Margin</span>
            <span>{hasValidInputs && marginPercent != null ? `${marginPercent.toFixed(2)}%` : "—"}</span>
          </div>
          <div className={`profit-result-row profit-result-final${hasValidInputs ? (isLoss ? " is-loss" : " is-profit") : ""}`}>
            <span>Estimated {isLoss ? "Loss" : "Profit"}</span>
            <span>{hasValidInputs ? fmtRM(estimatedProfit) : "—"}</span>
          </div>
          {!hasPrice && <p className="invest-calc-note">Live gold price unavailable right now — please check back shortly.</p>}
        </div>
      </div>
    </div>
  );
}
