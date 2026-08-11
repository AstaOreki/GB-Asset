"use client";

import { useMemo, useRef, useState } from "react";

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

function toDate(ts) {
  return ts && ts.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
}

function niceTicks(min, max, count) {
  if (min === max) {
    min -= 1;
    max += 1;
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

// Every range now plots at most one point per calendar day (one upserted
// record per bar per day), so dates read correctly across all of them —
// "1d" used to format as clock times, which showed two near-identical
// timestamps once it started spanning yesterday -> today.
function axisLabel(date) {
  return date.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

/**
 * Sell/Buy rate trend line chart for the given (already weight- and
 * range-filtered) `rows` — newest-first, same shape as the Price Today
 * table's rows ({ sell, buy, recordedAt }). `weightLabel` is the selected
 * bar ("1g", "10g", …) and only labels the title/tooltip; the values
 * plotted are that bar's own recorded prices, never a scaled figure.
 */
export default function PriceChart({ rows, weightLabel = "1g", fmtRM }) {
  const svgRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const points = useMemo(() => {
    if (!rows) return [];
    return rows
      .map((r) => ({ ...r, date: toDate(r.recordedAt) }))
      .filter((r) => r.date)
      .sort((a, b) => a.date - b.date);
  }, [rows]);

  // Fewer than 2 points can't form a line — show why rather than
  // vanishing, since a weight/period combination may legitimately have no
  // recorded prices yet.
  if (points.length < 2) {
    return (
      <div className="price-chart">
        <div className="price-chart-legend">
          <span className="price-chart-title">{weightLabel} Gold Price Trend</span>
        </div>
        <div className="price-chart-empty">
          <p>
            {points.length === 0
              ? `No ${weightLabel} price records for this period yet.`
              : `Not enough ${weightLabel} data yet to plot a trend for this period — check back after the next update.`}
          </p>
        </div>
      </div>
    );
  }

  const minX = points[0].date.getTime();
  const maxX = points[points.length - 1].date.getTime();
  const values = points.flatMap((p) => [p.sell, p.buy]);
  const yTicks = niceTicks(Math.min(...values), Math.max(...values), 4);
  const minY = yTicks[0];
  const maxY = yTicks[yTicks.length - 1];

  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const xFor = (t) => PAD.left + (maxX === minX ? innerW / 2 : ((t - minX) / (maxX - minX)) * innerW);
  const yFor = (v) => PAD.top + innerH - ((v - minY) / (maxY - minY)) * innerH;

  const linePath = (key) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.date.getTime())} ${yFor(p[key])}`).join(" ");

  function handleMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CHART_W;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xFor(p.date.getTime()) - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const last = points[points.length - 1];
  const first = points[0];
  const tooltipLeft = hovered ? (xFor(hovered.date.getTime()) / CHART_W) * 100 : null;
  const tooltipAlignEnd = tooltipLeft != null && tooltipLeft > 65;
  const trendSummary = `${weightLabel} gold price trend: opened at ${fmtRM(first.sell)}, now ${fmtRM(last.sell)}.`;

  return (
    <div className="price-chart">
      <div className="price-chart-legend">
        <span className="price-chart-title">{weightLabel} Gold Price Trend</span>
        <span className="price-chart-keys">
          <span className="price-chart-key"><i style={{ background: SELL_COLOR }} />{SELL_LABEL}</span>
          <span className="price-chart-key"><i style={{ background: BUY_COLOR }} />{BUY_LABEL}</span>
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

          <path d={linePath("buy")} className="price-chart-line" style={{ stroke: BUY_COLOR }} vectorEffect="non-scaling-stroke" />
          <path d={linePath("sell")} className="price-chart-line" style={{ stroke: SELL_COLOR }} vectorEffect="non-scaling-stroke" />

          <circle cx={xFor(last.date.getTime())} cy={yFor(last.buy)} r="4" fill={BUY_COLOR} className="price-chart-end-dot" />
          <circle cx={xFor(last.date.getTime())} cy={yFor(last.sell)} r="4" fill={SELL_COLOR} className="price-chart-end-dot" />

          {points.length <= 14 &&
            [0, points.length - 1].map((i) => (
              <text key={i} x={xFor(points[i].date.getTime())} y={CHART_H - 10} className="price-chart-axis-label" textAnchor={i === 0 ? "start" : "end"}>
                {axisLabel(points[i].date)}
              </text>
            ))}

          {hovered && (
            <line
              x1={xFor(hovered.date.getTime())}
              x2={xFor(hovered.date.getTime())}
              y1={PAD.top}
              y2={CHART_H - PAD.bottom}
              className="price-chart-crosshair"
            />
          )}
        </svg>

        {hovered && (
          <div
            className={`price-chart-tooltip${tooltipAlignEnd ? " align-end" : ""}`}
            style={{ left: `${tooltipLeft}%` }}
          >
            <div className="price-chart-tooltip-date">
              {weightLabel} · {hovered.date.toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="price-chart-tooltip-row"><span className="price-chart-key"><i style={{ background: SELL_COLOR }} />{SELL_LABEL}</span><b>{fmtRM(hovered.sell)}</b></div>
            <div className="price-chart-tooltip-row"><span className="price-chart-key"><i style={{ background: BUY_COLOR }} />{BUY_LABEL}</span><b>{fmtRM(hovered.buy)}</b></div>
          </div>
        )}
      </div>
    </div>
  );
}
