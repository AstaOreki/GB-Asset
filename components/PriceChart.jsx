"use client";

import { useMemo, useRef, useState } from "react";
import { formatKey } from "../lib/priceSeries";

// Chart-specific series steps (not the site's text/UI gold token) — chosen
// because they clear the dataviz skill's dark-mode categorical checks
// (lightness band + CVD separation) against this site's near-black
// surface; #F0CD6B/--gold read fine as text but are too light to pass the
// mark lightness band. Sell = warm gold, Buy = cool teal so the two lines
// stay easy to tell apart under color-blindness simulation too.
const SELL_COLOR = "#c98500";
const BUY_COLOR = "#199e70";

// "Sell"/"Buy" alone read ambiguous (sell to whom?) — spell out the
// direction of the transaction, matching the table headers above.
const SELL_LABEL = "Buy Gold From GBA";
const BUY_LABEL = "GBA Buys From You";

const CHART_W = 800;
const CHART_H = 300;
const PAD = { top: 20, right: 20, bottom: 34, left: 64 };

function niceTicks(min, max, count) {
  if (min === max) {
    // A flat series (one point, or a price that never moved) still needs a
    // readable axis around the value rather than a zero-height range.
    const pad = Math.max(Math.abs(min) * 0.01, 1);
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const rawStep = span / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/**
 * Sell/Buy trend for one bar weight over the selected period.
 *
 * `series` comes from lib/priceSeries.dailySeries — one entry per calendar
 * day, already carried forward across days the admin didn't save, each
 * tagged `source: "admin" | "carried"`. Days the admin actually set a price
 * get a visible marker; carried days are just part of the line, so the
 * shape of the chart never implies a price movement that didn't happen.
 *
 * A single day renders as a labelled point, not an error — one real price
 * is a legitimate answer for "what is the price today", and demanding two
 * before showing anything is what made the 1 Day view look broken.
 */
export default function PriceChart({ series, weightLabel = "1g", fmtRM }) {
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const points = useMemo(() => (series || []).filter((p) => p && typeof p.sell === "number"), [series]);

  if (points.length === 0) {
    return (
      <div className="price-chart">
        <div className="price-chart-legend">
          <span className="price-chart-title">{weightLabel} Gold Price Trend</span>
        </div>
        <div className="price-chart-empty">
          <p>No {weightLabel} price has been recorded yet — the trend starts once the first price is set.</p>
        </div>
      </div>
    );
  }

  const single = points.length === 1;
  const values = points.flatMap((p) => [p.sell, p.buy]);
  const yTicks = niceTicks(Math.min(...values), Math.max(...values), 4);
  const minY = yTicks[0];
  const maxY = yTicks[yTicks.length - 1];

  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const xAt = (i) => (single ? PAD.left + innerW / 2 : PAD.left + (i / (points.length - 1)) * innerW);
  const yFor = (v) => PAD.top + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const linePath = (key) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yFor(p[key])}`).join(" ");

  function handleMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CHART_W;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xAt(i) - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const hoveredX = hoverIndex != null ? xAt(hoverIndex) : null;
  const last = points[points.length - 1];
  const first = points[0];
  const tooltipLeft = hoveredX != null ? (hoveredX / CHART_W) * 100 : null;
  const tooltipAlignEnd = tooltipLeft != null && tooltipLeft > 65;
  const adminDays = points.filter((p) => p.source === "admin").length;
  const trendSummary = single
    ? `${weightLabel} gold price on ${formatKey(first.date)}: ${fmtRM(first.sell)}.`
    : `${weightLabel} gold price trend: opened at ${fmtRM(first.sell)} on ${formatKey(first.date)}, now ${fmtRM(last.sell)}. ${adminDays} of ${points.length} days were set by an admin; the rest carry the previous price forward.`;

  return (
    <div className="price-chart">
      <div className="price-chart-legend">
        <span className="price-chart-title">{weightLabel} Gold Price Trend</span>
        <span className="price-chart-keys">
          <span className="price-chart-key"><i style={{ background: SELL_COLOR }} />{SELL_LABEL}</span>
          <span className="price-chart-key"><i style={{ background: BUY_COLOR }} />{BUY_LABEL}</span>
          <span className="price-chart-key"><i className="is-hollow" />Carried forward</span>
        </span>
      </div>
      <p className="sr-only" id="price-chart-summary">{trendSummary}</p>
      <div className="price-chart-canvas">
        <svg
          ref={svgRef}
          role="img"
          aria-labelledby="price-chart-summary"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={CHART_W - PAD.right} y1={yFor(t)} y2={yFor(t)} className="price-chart-grid" />
              <text x={PAD.left - 10} y={yFor(t)} className="price-chart-axis-label" textAnchor="end" dominantBaseline="middle">
                {Math.round(t).toLocaleString("en-MY")}
              </text>
            </g>
          ))}

          {!single && (
            <>
              <path d={linePath("buy")} className="price-chart-line" style={{ stroke: BUY_COLOR }} vectorEffect="non-scaling-stroke" />
              <path d={linePath("sell")} className="price-chart-line" style={{ stroke: SELL_COLOR }} vectorEffect="non-scaling-stroke" />
            </>
          )}

          {/* Admin-set days get a filled marker so the line never implies a
              movement on a day that only carried the previous price. Capped
              because a year of daily saves would be 365 dots of mush. */}
          {points.length <= 60 &&
            points.map((p, i) =>
              p.source === "admin" ? (
                <g key={p.date}>
                  <circle cx={xAt(i)} cy={yFor(p.sell)} r="3" fill={SELL_COLOR} />
                  <circle cx={xAt(i)} cy={yFor(p.buy)} r="3" fill={BUY_COLOR} />
                </g>
              ) : null
            )}

          <circle cx={xAt(points.length - 1)} cy={yFor(last.buy)} r={single ? 6 : 4} fill={BUY_COLOR} className="price-chart-end-dot" />
          <circle cx={xAt(points.length - 1)} cy={yFor(last.sell)} r={single ? 6 : 4} fill={SELL_COLOR} className="price-chart-end-dot" />

          {/* One point has no trend to read off the shape, so label it. */}
          {single && (
            <text x={xAt(0)} y={yFor(last.sell) - 16} className="price-chart-point-label" textAnchor="middle">
              {fmtRM(last.sell)}
            </text>
          )}

          {points.length <= 14 &&
            [...new Set([0, points.length - 1])].map((i) => (
              <text
                key={i}
                x={xAt(i)}
                y={CHART_H - 10}
                className="price-chart-axis-label"
                textAnchor={single ? "middle" : i === 0 ? "start" : "end"}
              >
                {formatKey(points[i].date)}
              </text>
            ))}

          {hovered && !single && (
            <line x1={hoveredX} x2={hoveredX} y1={PAD.top} y2={CHART_H - PAD.bottom} className="price-chart-crosshair" />
          )}
        </svg>

        {hovered && (
          <div className={`price-chart-tooltip${tooltipAlignEnd ? " align-end" : ""}`} style={{ left: `${tooltipLeft}%` }}>
            <div className="price-chart-tooltip-date">
              {weightLabel} · {formatKey(hovered.date, { day: "2-digit", month: "short", year: "numeric" })}
            </div>
            <div className="price-chart-tooltip-row"><span className="price-chart-key"><i style={{ background: SELL_COLOR }} />{SELL_LABEL}</span><b>{fmtRM(hovered.sell)}</b></div>
            <div className="price-chart-tooltip-row"><span className="price-chart-key"><i style={{ background: BUY_COLOR }} />{BUY_LABEL}</span><b>{fmtRM(hovered.buy)}</b></div>
            <div className="price-chart-tooltip-note">
              {hovered.source === "admin" ? "Set by admin this day" : `Carried forward from ${formatKey(hovered.sourceDate)}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
