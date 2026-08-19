"use client";

import { useMemo, useState } from "react";
import { compareDays, shiftKey, formatKey } from "../lib/priceSeries";

// Quick comparisons, each expressed as "how many days back from today".
const PRESETS = [
  { label: "Yesterday", days: 1 },
  { label: "7 days ago", days: 7 },
  { label: "30 days ago", days: 30 },
  { label: "1 year ago", days: 365 },
];

/**
 * Compare the gold price on any two dates, for any gram option.
 *
 * The gram selector here is its own state, independent of the "Gold
 * Weight" toggle above the chart — changing it only affects this card, so
 * a customer can compare a different bar than the one the chart/header is
 * currently showing without those jumping around underneath them. It
 * starts pre-matched to whatever that toggle shows (defaultWeight) purely
 * for continuity, then never syncs again after the first render.
 *
 * `weightOptions` is passed in from the same CHART_WEIGHTS list the page's
 * own weight toggle uses — this component never defines its own gram list,
 * so there is exactly one source of truth for "which bars exist."
 *
 * Reads the same derived daily series as the calendar and the chart, so a
 * date with no admin update compares at its carried-forward price rather
 * than being unavailable. Whether each side was set that day or carried is
 * stated, so a "no change" result can be read correctly as "nothing was
 * updated between these dates".
 */
export default function PriceCompare({ records, weightOptions, defaultWeight, todayKey, fmtRM }) {
  const [selectedWeight, setSelectedWeight] = useState(defaultWeight);
  const [from, setFrom] = useState(shiftKey(todayKey, -7));
  const [to, setTo] = useState(todayKey);

  const selectedOption = weightOptions.find((w) => w.grams === selectedWeight) || weightOptions[0];

  const result = useMemo(
    () => compareDays(records, selectedWeight, from, to),
    [records, selectedWeight, from, to]
  );

  function applyPreset(days) {
    setFrom(shiftKey(todayKey, -days));
    setTo(todayKey);
  }

  // Each bar is priced independently (the admin doesn't scale a 1g rate up),
  // so anything above 1g is shown as that bar's own package price, not a
  // per-gram figure — matching how the price card above already treats it.
  const unitSuffix = selectedOption.grams === 1 ? "/g" : ` / ${selectedOption.label}`;
  const pctText = result ? `${Math.abs(result.percent).toFixed(2)}%` : "—";
  const arrow = result ? (result.direction === "up" ? "▲" : result.direction === "down" ? "▼" : "—") : "—";

  return (
    /* No `reveal` class here on purpose. useRevealOnScroll collects
       ".reveal" elements once, on mount, and never rescans — this panel
       only renders after the Firestore history arrives, so it was never
       observed and stayed at opacity 0 forever. Everything else carrying
       `reveal` is in the initial tree, so it is unaffected. */
    <div className="price-compare">
      <div className="pcmp-head">
        <h3>Compare Two Dates</h3>
        <p>How the {selectedOption.label} price moved between any two days on record.</p>
      </div>

      <div className="pcmp-presets" role="group" aria-label="Quick comparisons against today">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            className={`pcmp-preset-btn${from === shiftKey(todayKey, -p.days) && to === todayKey ? " active" : ""}`}
            onClick={() => applyPreset(p.days)}
          >
            Today vs {p.label}
          </button>
        ))}
      </div>

      <div className="pcmp-body">
        <div className="pcmp-inputs">
          <label className="pcmp-field">
            <span>Gold Gram</span>
            <select value={selectedOption.grams} onChange={(e) => setSelectedWeight(Number(e.target.value))}>
              {weightOptions.map((w) => (
                <option key={w.grams} value={w.grams}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <label className="pcmp-field">
            <span>From</span>
            <input type="date" max={todayKey} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label className="pcmp-field">
            <span>To</span>
            <input type="date" max={todayKey} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>

        <div className="pcmp-result">
          {!result ? (
            <p className="pcmp-none">
              No recorded price for one of these dates yet. Pick a date on or after the first recorded price.
            </p>
          ) : (
            <>
              <div className="pcmp-sides">
                <div className="pcmp-side">
                  <span className="pcmp-side-date">{formatKey(result.a.date, { day: "numeric", month: "short", year: "numeric" })}</span>
                  <b>{fmtRM(result.a.sell)}<i>{unitSuffix}</i></b>
                  <em className={result.a.source === "admin" ? "is-admin" : "is-carried"}>
                    {result.a.source === "admin" ? "Admin updated" : "Carried forward"}
                  </em>
                </div>
                <span className="pcmp-arrow" aria-hidden="true">→</span>
                <div className="pcmp-side">
                  <span className="pcmp-side-date">{formatKey(result.b.date, { day: "numeric", month: "short", year: "numeric" })}</span>
                  <b>{fmtRM(result.b.sell)}<i>{unitSuffix}</i></b>
                  <em className={result.b.source === "admin" ? "is-admin" : "is-carried"}>
                    {result.b.source === "admin" ? "Admin updated" : "Carried forward"}
                  </em>
                </div>
              </div>

              <div className={`pcmp-delta is-${result.direction}`}>
                <span className="pcmp-delta-label">
                  {result.direction === "up" ? "Increase" : result.direction === "down" ? "Decrease" : "No change"}
                </span>
                <b>
                  {arrow} {fmtRM(Math.abs(result.diff))}<i>{unitSuffix}</i>
                </b>
                <span className="pcmp-delta-pct">{pctText}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
