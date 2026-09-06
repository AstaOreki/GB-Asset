"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useGBA } from "../../hooks/useGBA";
import PriceChart from "../PriceChart";
import PriceCompare from "../PriceCompare";
import ProfitCalculator from "../ProfitCalculator";
import GoldPriceHeader from "../GoldPriceHeader";
import { dailySeries, priceOn } from "../../lib/priceSeries";

const PRICE_RANGES = [
  { key: "1d", label: "1 Day" },
  { key: "1w", label: "1 Week" },
  { key: "1m", label: "1 Month" },
  { key: "6m", label: "6 Months" },
  { key: "1y", label: "1 Year" },
];

// How many days back each tab covers. "1d" spans yesterday -> today so the
// day's movement is actually visible. On a day the admin didn't save,
// today carries yesterday's price forward and the line still draws (flat,
// which is the truth); if today is the very first record ever, the chart
// renders it as a single point rather than refusing to draw.
const RANGE_DAYS = { "1d": 1, "1w": 6, "1m": 29, "6m": 182, "1y": 364 };

const toJsDate = (ts) => (ts && ts.toDate ? ts.toDate() : ts instanceof Date ? ts : null);

// 2dp, same format as the Gold Price card — the High/Low tiles are now
// scaled by the selected weight, and whole-ringgit rounding made the
// scaled figures fail to reconcile (a 582.35/g high shown as "RM 582"
// implies RM 582,000 at 1kg, not the true RM 582,350).
const fmtRM2 = (n) =>
  `RM${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Each bar's real recorded prices are already stored per weight in
// priceHistory (the admin sets each bar independently), so charting a
// weight is a filter over existing data — never a multiplied 1g estimate.
const CHART_WEIGHTS = [
  { grams: 1, label: "1g" },
  { grams: 5, label: "5g" },
  { grams: 10, label: "10g" },
  { grams: 20, label: "20g" },
  { grams: 50, label: "50g" },
  { grams: 100, label: "100g" },
  { grams: 250, label: "250g" },
  { grams: 1000, label: "1kg" },
];

/**
 * "Daily Gold Rate" — extracted from the homepage so the same markup/logic
 * can render both inline on "/" (id="products", anchored by the hero's
 * #products CTA) and on its own dedicated "/price-today" route.
 *
 * @param {{ showPageLink?: boolean }} props showPageLink renders a "View
 *   Price Today" link to /price-today — only passed true from the homepage.
 */
export default function PriceTodaySection({ showPageLink = false }) {
  const gba = useGBA();

  // -------- PRICE TODAY (gold rate history, from Firestore "priceHistory") --------
  const [activeRange, setActiveRange] = useState("1d");
  const [chartWeight, setChartWeight] = useState(1);
  // The table always shows exactly one row per bar (5 rows) — whichever
  // price is current, carried forward from its last update — not a growing
  // log, so it's driven by the carry-forward feed regardless of which tab
  // is selected. Same feed drives the stats row below.
  const [currentRows, setCurrentRows] = useState(null); // null = loading, [] = empty
  // Only the trend chart varies by tab — a real history of what changed
  // over the selected period.
  const [chartRows, setChartRows] = useState(null);
  const [chartError, setChartError] = useState(false);

  useEffect(() => {
    if (!gba) return;
    return gba.priceHistory.listenCurrent((rows) => setCurrentRows(rows));
  }, [gba]);

  useEffect(() => {
    if (!gba) return;
    // Don't reset chartRows to null here — switching tabs keeps the
    // previous period's line on screen (per dataviz refetch guidance: hold
    // the last frame, no flash back to a loading state) until the new
    // range's snapshot arrives.
    //
    // Fetches records up to today WITHOUT trimming to the start of the
    // period: the carry-forward walk needs the most recent record from
    // before the window, or a period with no saves of its own would render
    // empty even though a price was in force throughout it.
    setChartError(false);
    return gba.priceHistory.listenDaily(
      gba.priceHistory.todayKey(),
      gba.priceHistory.limits[activeRange] || 500,
      (rows) => setChartRows(rows),
      () => {
        setChartError(true);
        setChartRows([]);
      }
    );
  }, [gba, activeRange]);

  // One month either side of the viewed month is already covered by the
  // calendar feed's own window, so the calendar and comparison panels share
  // a single wider listener rather than opening one each.
  const [historyRows, setHistoryRows] = useState(null);
  useEffect(() => {
    if (!gba) return;
    return gba.priceHistory.listenDaily(
      gba.priceHistory.todayKey(),
      gba.priceHistory.limits.calendar,
      (rows) => setHistoryRows(rows),
      () => setHistoryRows([])
    );
  }, [gba]);

  // The immutable audit trail — every individual save. Today's High/Low read
  // from this because it is the only place several updates on the same day
  // survive; priceHistory keeps just that day's latest price.
  const [updateRows, setUpdateRows] = useState(null);
  useEffect(() => {
    if (!gba) return;
    return gba.priceHistory.listenUpdates(200, (rows) => setUpdateRows(rows), () => setUpdateRows([]));
  }, [gba]);

  // The price in force today for the selected bar, carried forward from its
  // last update if nothing was saved today.
  const chartSeriesToday = useMemo(() => {
    if (!historyRows || !gba) return null;
    return priceOn(historyRows, chartWeight, gba.priceHistory.todayKey());
  }, [historyRows, gba, chartWeight]);

  const todayRows = currentRows;
  // Today's High/Low for the SELECTED bar — the highest and lowest price the
  // admin actually set for it today.
  //
  // These used to be the best and worst per-gram rate across ALL five bars,
  // multiplied up to the selected weight. That produced figures no one ever
  // entered: at 1kg it read RM621,000 because the 1g bar happens to carry
  // the richest per-gram rate, while the card above showed the real 1kg
  // price. Now every figure here is a price the admin typed for this bar.
  const todayPricesForWeight =
    updateRows && gba
      ? updateRows
          .filter((r) => r.weight === chartWeight && r.date === gba.priceHistory.todayKey() && typeof r.sell === "number")
          .map((r) => r.sell)
      : [];
  // No save for this bar today: the price in force is the one carried
  // forward, so the day's high and low are both that single figure.
  const carriedToday = chartSeriesToday && chartSeriesToday.sell;
  const todayHigh = todayPricesForWeight.length
    ? Math.max(...todayPricesForWeight)
    : carriedToday != null
      ? carriedToday
      : null;
  const todayLow = todayPricesForWeight.length
    ? Math.min(...todayPricesForWeight)
    : carriedToday != null
      ? carriedToday
      : null;
  // The newest timestamp across all bars — rows arrive in catalogue
  // order, so the first row is just the 1kg bar, not the latest save.
  const lastUpdate =
    todayRows && todayRows.length
      ? todayRows.reduce((latest, r) => {
          const d = toJsDate(r.recordedAt);
          const l = toJsDate(latest);
          return d && (!l || d > l) ? r.recordedAt : latest;
        }, null)
      : null;
  // A bar with no Firestore doc yet falls back to the static catalogue
  // price, so "we have rows" alone doesn't mean any rate was ever set.
  const hasAnyRate = !!(todayRows && todayRows.some((r) => r.hasRecord));
  // The 1g bar's current sell rate. Both the Gold Price card and the
  // Investment Calculator quote each bar's own admin-set price; this is
  // only their fallback for a bar with no live rate of its own yet.
  const oneGramRow = currentRows && currentRows.find((r) => r.weight === 1);
  const pricePerGram = oneGramRow ? oneGramRow.sell : null;

  // Daily % change for the Gold Price header — last 7 days of the SELECTED
  // bar's history, compared against the most recent record from a
  // different calendar day than today (yesterday's/last-known price).
  // Per-bar, because the header now shows that bar's own price and each
  // bar is priced independently, so the 1g bar's movement isn't
  // necessarily the 1kg bar's.
  const [weekRows, setWeekRows] = useState(null);
  useEffect(() => {
    if (!gba) return;
    return gba.priceHistory.listen("1w", (rows) => setWeekRows(rows), () => setWeekRows([]));
  }, [gba]);
  const selectedRow = currentRows && currentRows.find((r) => r.weight === chartWeight);
  const selectedWeekRows = weekRows ? weekRows.filter((r) => r.weight === chartWeight) : null;
  // Compare against the newest record from a day BEFORE the current
  // price's own day — not simply "not today". The current price carries
  // forward from whenever it was last set, so if nothing was saved today
  // both sides used to resolve to the same record and the change always
  // read 0.00%, hiding the real movement.
  const currentPriceDay = toJsDate(selectedRow && selectedRow.recordedAt);
  const currentPriceDayStr = currentPriceDay ? currentPriceDay.toDateString() : new Date().toDateString();
  const previousDayRow =
    selectedWeekRows &&
    selectedWeekRows.find((r) => {
      const d = toJsDate(r.recordedAt);
      return d && d.toDateString() !== currentPriceDayStr && (!currentPriceDay || d < currentPriceDay);
    });
  const percentChange =
    selectedRow && previousDayRow && previousDayRow.sell > 0
      ? ((selectedRow.sell - previousDayRow.sell) / previousDayRow.sell) * 100
      : null;

  // The selected bar's applicable price for every day of the period.
  // priceHistory only stores days an admin actually saved; dailySeries
  // fills the rest by carrying the previous price forward and tags each
  // day so nothing invented can be mistaken for a real update.
  const chartWeightLabel = (CHART_WEIGHTS.find((w) => w.grams === chartWeight) || CHART_WEIGHTS[0]).label;
  // Is there any recorded price at all, for any bar? Drives whether the
  // comparison panel renders — an empty comparison card is worse than no
  // card. Not scoped to chartWeight: the comparison panel now has its own
  // independent gram selector, so a bar with no history yet shouldn't hide
  // the whole panel when other bars do have history to compare.
  const hasAnyPriceHistory = !!(historyRows && historyRows.some((r) => typeof r.sell === "number"));
  const chartSeries = useMemo(() => {
    if (!chartRows || !gba) return null;
    const today = gba.priceHistory.todayKey();
    const start = gba.priceHistory.shiftKey(today, -(RANGE_DAYS[activeRange] ?? 7));
    return dailySeries(chartRows, chartWeight, start, today);
  }, [chartRows, gba, activeRange, chartWeight]);

  return (
    <section className="price-today" id="products">
      <div className="wrap">
        <div className="section-head on-dark reveal">
          <div className="eyebrow">Price Today</div>
          <h2>Daily Gold Rate</h2>
          <p>Official Sell / Buy rates for each bar, 999.9 fine gold — updated daily and preserved as a full historical record.</p>
        </div>

        <GoldPriceHeader
          rates={currentRows}
          pricePerGram={pricePerGram}
          percentChange={percentChange}
          selectedGrams={chartWeight}
          onSelectWeight={setChartWeight}
        />

        <div className="price-stats reveal-stagger">
          <div className="pstat-tile">
            <span className="pstat-label">Today&apos;s High</span>
            <span className="pstat-value">{todayHigh != null ? fmtRM2(todayHigh) : "—"}</span>
          </div>
          <div className="pstat-tile">
            <span className="pstat-label">Today&apos;s Low</span>
            <span className="pstat-value">{todayLow != null ? fmtRM2(todayLow) : "—"}</span>
          </div>
          <div className="pstat-tile">
            <span className="pstat-label">Last Update</span>
            <span className="pstat-value pstat-value-sm">{lastUpdate ? gba.fmtDateTime(lastUpdate) : "—"}</span>
          </div>
        </div>

        <div className="chart-weight-block reveal">
          <span className="chart-weight-label">Gold Weight</span>
          <div className="chart-weight-group" role="group" aria-label="Gold weight for the price trend chart">
            {CHART_WEIGHTS.map((w) => (
              <button
                key={w.grams}
                type="button"
                aria-pressed={chartWeight === w.grams}
                className={`chart-weight-btn${chartWeight === w.grams ? " active" : ""}`}
                onClick={() => setChartWeight(w.grams)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="price-tabs reveal" data-active={activeRange}>
          <div className="price-tab-indicator"></div>
          {PRICE_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`price-tab-btn${activeRange === r.key ? " active" : ""}`}
              onClick={() => setActiveRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* One weight at a time — mixing weights into one line made the
            chart zigzag between unrelated price levels instead of showing
            a real trend. Each weight's own recorded prices are used, never
            a scaled 1g figure. */}
        {gba && !chartError && chartSeries && (
          <PriceChart series={chartSeries} weightLabel={chartWeightLabel} fmtRM={gba.fmtRM} />
        )}

        {/* Pure history — with nothing recorded at all yet there is
            nothing to show, so it stays out of the page entirely rather
            than rendering an empty shell. */}
        {gba && hasAnyPriceHistory && (
          <PriceCompare
            records={historyRows}
            weightOptions={CHART_WEIGHTS}
            defaultWeight={chartWeight}
            todayKey={gba.priceHistory.todayKey()}
            fmtRM={gba.fmtRM}
          />
        )}

        <ProfitCalculator rates={currentRows} pricePerGram={pricePerGram} />

        <h3 className="price-table-title reveal">Daily Price</h3>
        <div className="price-table reveal">
          <div className="price-table-head">
            <span>Date</span>
            <span>Weight (g)</span>
            <span>Buy Gold From GBA</span>
            <span>GBA Buys From You</span>
            <span>Margin</span>
          </div>
          <div className="price-table-body">
            {currentRows === null ? (
              <div className="price-table-empty">
                <h3>Loading rates…</h3>
              </div>
            ) : currentRows.length === 0 || !hasAnyRate ? (
              <div className="price-table-empty">
                <h3>No rates set yet</h3>
                <p>Daily gold rates are updated by our team — check back soon.</p>
              </div>
            ) : (
              [...currentRows].sort((a, b) => (b.weight || 0) - (a.weight || 0)).map((row) => (
                <div className="price-row" key={row.productId || row.docId}>
                  <span data-label="Date">{gba.fmtDateTime(row.recordedAt)}</span>
                  <span data-label="Weight (g)">{row.weight ? `${row.weight}g` : "—"}</span>
                  <span data-label="Buy Gold From GBA">{gba.fmtRM(row.sell)}</span>
                  <span data-label="GBA Buys From You">{gba.fmtRM(row.buy)}</span>
                  {/* Percentage plus the flat ringgit spread it works out
                      to — same RM formatting as the two price columns. */}
                  <span data-label="Margin">
                    {gba.fmtMarginPercent(row.sell, row.buy)}
                    {row.buy > 0 && typeof row.sell === "number" ? ` (${gba.fmtRM(row.sell - row.buy)})` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        {showPageLink && (
          <div className="section-cta reveal">
            <Link className="btn btn-outline" href="/price-today">
              View Price Today
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
