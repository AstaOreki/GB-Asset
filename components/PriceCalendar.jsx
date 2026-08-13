"use client";

import { useMemo, useState } from "react";
import { dailySeries, monthGrid, keyToDate, dateToKey, formatKey } from "../lib/priceSeries";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Month-by-month record of the applicable gold price for every calendar
 * day, for the selected bar weight.
 *
 * Every day in the month gets a value, including weekends, holidays and
 * days nobody touched the system — those carry the most recent earlier
 * price forward and are marked as such. Days before the very first
 * recorded price show nothing rather than a made-up number.
 *
 * `records` is the raw daily history; the carry-forward walk happens in
 * lib/priceSeries so the calendar, the chart and the comparison panel can
 * never disagree about what a given day's price was.
 */
export default function PriceCalendar({ records, weight, weightLabel, todayKey, fmtRM }) {
  const today = keyToDate(todayKey);
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [selected, setSelected] = useState(null);

  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const dayKeys = cells.filter(Boolean);

  const byDay = useMemo(() => {
    if (!dayKeys.length) return new Map();
    // Stop at today. Carrying a price forward across a day that has already
    // happened is a statement about the past and is safe; doing it into
    // tomorrow would be a forecast, which this system does not make.
    const last = dayKeys[dayKeys.length - 1];
    const end = last > todayKey ? todayKey : last;
    if (dayKeys[0] > end) return new Map();
    const series = dailySeries(records, weight, dayKeys[0], end);
    return new Map(series.map((d) => [d.date, d]));
  }, [records, weight, dayKeys, todayKey]);

  function step(delta) {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
    setSelected(null);
  }

  const adminCount = dayKeys.filter((k) => byDay.get(k)?.source === "admin").length;
  const withPrice = dayKeys.filter((k) => byDay.has(k)).length;
  const detail = selected ? byDay.get(selected) : null;

  return (
    <div className="price-calendar reveal">
      <div className="pcal-head">
        <div>
          <h3>Gold Price Calendar</h3>
          <p>The {weightLabel} price that applied on every day of the month.</p>
        </div>
        <div className="pcal-nav">
          <button type="button" className="pcal-nav-btn" aria-label="Previous month" onClick={() => step(-1)}>‹</button>
          <span className="pcal-month" aria-live="polite">{MONTHS[month]} {year}</span>
          <button type="button" className="pcal-nav-btn" aria-label="Next month" onClick={() => step(1)}>›</button>
        </div>
      </div>

      <div className="pcal-legend">
        <span className="pcal-key"><i className="is-admin" />Admin updated</span>
        <span className="pcal-key"><i className="is-carried" />Carried forward</span>
        {withPrice > 0 && (
          <span className="pcal-count">{adminCount} of {withPrice} days set by an admin</span>
        )}
      </div>

      <div className="pcal-grid" role="grid" aria-label={`Gold prices for ${MONTHS[month]} ${year}`}>
        {WEEKDAYS.map((d) => (
          <span key={d} className="pcal-weekday" role="columnheader">{d}</span>
        ))}
        {cells.map((key, i) => {
          if (!key) return <span key={`pad-${i}`} className="pcal-cell is-pad" aria-hidden="true" />;
          const day = byDay.get(key);
          const num = keyToDate(key).getUTCDate();
          const isToday = key === todayKey;
          const isFuture = key > todayKey;
          if (!day) {
            return (
              <span key={key} className={`pcal-cell is-empty${isToday ? " is-today" : ""}`} role="gridcell">
                <b>{num}</b>
                <em>{isFuture ? "—" : "No price"}</em>
              </span>
            );
          }
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-pressed={selected === key}
              className={`pcal-cell is-${day.source}${isToday ? " is-today" : ""}${selected === key ? " is-selected" : ""}`}
              onClick={() => setSelected(selected === key ? null : key)}
            >
              <b>{num}</b>
              <em>{fmtRM(day.pricePerGram)}</em>
            </button>
          );
        })}
      </div>

      {detail ? (
        <div className="pcal-detail" role="status">
          <div className="pcal-detail-date">{formatKey(detail.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          <div className="pcal-detail-rows">
            <div><span>Price per gram</span><b>{fmtRM(detail.pricePerGram)}</b></div>
            <div><span>{weightLabel} bar price</span><b>{fmtRM(detail.sell)}</b></div>
            <div><span>GBA buys from you</span><b>{fmtRM(detail.buy)}</b></div>
            <div>
              <span>Status</span>
              <b className={detail.source === "admin" ? "is-admin" : "is-carried"}>
                {detail.source === "admin" ? "Updated by admin" : `Carried forward from ${formatKey(detail.sourceDate, { day: "numeric", month: "short", year: "numeric" })}`}
              </b>
            </div>
          </div>
        </div>
      ) : (
        <p className="pcal-hint">Select a day to see its full rate.</p>
      )}
    </div>
  );
}
