"use client";

import { useState } from "react";
import { ratePerGramFor } from "../lib/goldPricing";

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
 *
 * Layout reads as one story rather than a results table: what you hold →
 * what it's worth now → what it becomes → the payoff. The two middle
 * figures sit either side of an arrow because they ARE the progression;
 * repeating them under it would just be the same numbers twice.
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

  const currentValue = hasValidInputs ? grams * appliedRate : null;
  const futureValue = hasValidInputs ? currentValue * (1 + percent / 100) : null;
  const estimatedProfit = hasValidInputs ? futureValue - currentValue : null;
  const isLoss = estimatedProfit != null && estimatedProfit < 0;
  // Signed on the payoff figure only — the sign is the point of the number
  // there, whereas the rows above are plain values.
  const payoff =
    estimatedProfit == null
      ? "—"
      : `${estimatedProfit > 0 ? "+" : estimatedProfit < 0 ? "-" : ""}${fmtRM(Math.abs(estimatedProfit))}`;

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
          <div className="invest-qty">
            <label className="invest-input-label" htmlFor="investGrams">
              Gold Quantity (g)
            </label>
            {/* Underline only, no box — the unit sits inside the same rule
                so the figure and its "g" read as one value. */}
            <div className="invest-input-line">
              <input
                className="invest-qty-input"
                id="investGrams"
                inputMode="decimal"
                min="0"
                placeholder=" "
                step="0.01"
                type="number"
                value={gramsInput}
                onChange={handleNonNegativeChange(setGramsInput)}
              />
              <span className="invest-input-unit" aria-hidden="true">g</span>
            </div>
          </div>

          <div className="invest-percent-block">
            <span className="invest-percent-label" id="investGrowthLabel">
              If gold value grows by
            </span>
            <div className="invest-percent-group" role="group" aria-labelledby="investGrowthLabel">
              {PERCENT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={!isCustom && selectedPercent === p}
                  className={`invest-percent-btn${!isCustom && selectedPercent === p ? " active" : ""}`}
                  onClick={() => selectPreset(p)}
                >
                  {p}%
                </button>
              ))}
              <button
                type="button"
                aria-pressed={isCustom}
                className={`invest-percent-btn${isCustom ? " active" : ""}`}
                onClick={() => setIsCustom(true)}
              >
                Custom
              </button>
            </div>
            {isCustom && (
              <div className="invest-qty invest-custom-field">
                <label className="invest-input-label" htmlFor="investCustomPercent">
                  Custom Percentage (%)
                </label>
                <div className="invest-input-line">
                  <input
                    className="invest-qty-input is-compact"
                    id="investCustomPercent"
                    inputMode="decimal"
                    placeholder=" "
                    step="0.01"
                    type="number"
                    value={customPercent}
                    onChange={(e) => setCustomPercent(e.target.value)}
                  />
                  <span className="invest-input-unit" aria-hidden="true">%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="invest-calc-results">
          <div className="invest-stat">
            <span className="invest-stat-label">Gold Purchased</span>
            <span className="invest-stat-value">{hasValidInputs ? `${grams.toLocaleString("en-MY")} g` : "—"}</span>
          </div>

          <div className="invest-progression">
            <div className="invest-stat">
              <span className="invest-stat-label">Current Gold Value</span>
              <span className="invest-stat-value">{hasValidInputs ? fmtRM(currentValue) : "—"}</span>
            </div>
            <span className="invest-progression-arrow" aria-hidden="true">→</span>
            <div className="invest-stat">
              <span className="invest-stat-label">Projected Future Value</span>
              <span className="invest-stat-value">{hasValidInputs ? fmtRM(futureValue) : "—"}</span>
            </div>
          </div>

          <div className={`invest-payoff${hasValidInputs ? (isLoss ? " is-loss" : " is-profit") : ""}`}>
            <span className="invest-payoff-label">Estimated {isLoss ? "Loss" : "Profit"}</span>
            <span className="invest-payoff-value">{payoff}</span>
          </div>

          <p className="invest-calc-footnote">Projection based on your selected annual growth rate.</p>
          {!hasPrice && <p className="invest-calc-note">Live gold price unavailable right now — please check back shortly.</p>}
        </div>
      </div>
    </div>
  );
}
