"use client";

import { useState } from "react";

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
 * Gold Investment Calculator — how many grams a given RM amount buys at
 * today's live 1g rate, and what that could be worth at an assumed future
 * % change. `pricePerGram` is the 1g bar's current Sell rate (what a
 * customer pays to buy), passed down from the Price Today section so this
 * never fetches/derives its own price.
 */
export default function ProfitCalculator({ pricePerGram, fmtRM: fmtLivePrice }) {
  const [amount, setAmount] = useState("");
  const [selectedPercent, setSelectedPercent] = useState(10);
  const [isCustom, setIsCustom] = useState(false);
  const [customPercent, setCustomPercent] = useState("");

  const investment = parseFloat(amount);
  const percent = isCustom ? parseFloat(customPercent) : selectedPercent;
  const hasPrice = typeof pricePerGram === "number" && pricePerGram > 0;
  const hasValidInputs =
    amount !== "" && !isNaN(investment) && investment > 0 && !isNaN(percent) && (!isCustom || customPercent !== "") && hasPrice;

  const grams = hasValidInputs ? investment / pricePerGram : null;
  const currentValue = hasValidInputs ? investment : null;
  const futureValue = hasValidInputs ? investment * (1 + percent / 100) : null;
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
          See how many grams your investment buys at today&apos;s live rate
          {hasPrice ? ` (${fmtLivePrice ? fmtLivePrice(pricePerGram) : fmtRM(pricePerGram)}/g)` : ""}, and what it could be worth later.
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
              value={amount}
              onChange={handleNonNegativeChange(setAmount)}
            />
            <label>Investment Amount (RM)</label>
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
            <span>{hasValidInputs ? `${grams.toFixed(3)} g` : "—"}</span>
          </div>
          <div className="profit-result-row">
            <span>Current Gold Value</span>
            <span>{hasValidInputs ? fmtRM(currentValue) : "—"}</span>
          </div>
          <div className="profit-result-row">
            <span>Projected Future Value</span>
            <span>{hasValidInputs ? fmtRM(futureValue) : "—"}</span>
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
