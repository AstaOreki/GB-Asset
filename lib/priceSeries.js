/**
 * Turning the stored price records into a value for every calendar day.
 *
 * The database only ever stores days the admin actually saved something —
 * one `priceHistory` doc per bar per Malaysia day, holding that day's
 * latest price. Carried-forward days are NOT stored; they are derived here
 * at read time. That is what keeps history honest: a gap in the data stays
 * a gap, and changing today's price can never rewrite an earlier day
 * because earlier days each have their own immutable-in-practice doc.
 *
 * Every day produced carries a `source`:
 *   "admin"   — the admin saved a price on this exact day
 *   "carried" — no save that day, showing the most recent earlier price
 * and days before the very first record produce nothing at all, rather
 * than a fabricated value.
 */

// All date maths runs on "YYYY-MM-DD" Malaysia keys through UTC, so the
// viewer's own timezone and DST can never shift a day.
export function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateToKey(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}`;
}

export function shiftKey(key, days) {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToKey(d);
}

export function eachKey(startKey, endKey) {
  const out = [];
  let cur = startKey;
  // Guard rather than trust the inputs — a reversed or malformed range
  // would otherwise spin forever.
  for (let i = 0; cur <= endKey && i < 4000; i++) {
    out.push(cur);
    cur = shiftKey(cur, 1);
  }
  return out;
}

export function formatKey(key, opts = { day: "numeric", month: "short" }) {
  return keyToDate(key).toLocaleDateString("en-MY", { ...opts, timeZone: "UTC" });
}

/**
 * Index the raw records for one bar weight by day.
 *
 * `priceHistory` already holds at most one doc per bar per day, but this
 * still resolves collisions by `recordedAt` so it stays correct if it is
 * ever pointed at the raw `priceUpdates` trail, where several saves can
 * share a date and the latest one is the day's price.
 */
export function indexByDay(records, weight) {
  const byDay = new Map();
  for (const r of records || []) {
    if (!r || r.weight !== weight || typeof r.sell !== "number" || !r.date) continue;
    const prev = byDay.get(r.date);
    if (!prev || msOf(r.recordedAt) >= msOf(prev.recordedAt)) byDay.set(r.date, r);
  }
  return byDay;
}

function msOf(ts) {
  if (!ts) return 0;
  if (ts.toDate) return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

/**
 * A value for every day from startKey to endKey inclusive.
 *
 * Returns `[{ date, source, sell, buy, weight, pricePerGram, recordedAt,
 * sourceDate }]`. `sourceDate` is the day the price was actually set, so a
 * carried day can say what it was carried from. Days before the first ever
 * record are omitted entirely — there was no price then, and inventing one
 * would be worse than showing nothing.
 */
export function dailySeries(records, weight, startKey, endKey) {
  const byDay = indexByDay(records, weight);

  // Seed from the newest record strictly before the window, otherwise a
  // month with no saves of its own would render empty even though a price
  // was in force the whole time.
  let carried = null;
  for (const [day, rec] of byDay) {
    if (day < startKey && (!carried || day > carried.date)) carried = rec;
  }

  const out = [];
  for (const key of eachKey(startKey, endKey)) {
    const hit = byDay.get(key);
    if (hit) carried = hit;
    if (!carried) continue; // before the first ever price — genuinely no value
    const rec = hit || carried;
    out.push({
      date: key,
      source: hit ? "admin" : "carried",
      sourceDate: rec.date,
      sell: rec.sell,
      buy: rec.buy,
      weight: rec.weight,
      pricePerGram: rec.weight > 0 ? rec.sell / rec.weight : null,
      recordedAt: rec.recordedAt || null,
    });
  }
  return out;
}

/** The applicable price on one specific day, carrying forward if needed. */
export function priceOn(records, weight, key) {
  const series = dailySeries(records, weight, key, key);
  return series.length ? series[0] : null;
}

/**
 * Difference between two days, for the comparison panel. Returns null if
 * either day has no applicable price yet.
 */
export function compareDays(records, weight, keyA, keyB) {
  const a = priceOn(records, weight, keyA);
  const b = priceOn(records, weight, keyB);
  if (!a || !b) return null;
  const diff = b.sell - a.sell;
  return {
    a,
    b,
    diff,
    percent: a.sell > 0 ? (diff / a.sell) * 100 : 0,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

/** Calendar grid for a month: leading blanks then every day, Monday-first. */
export function monthGrid(year, monthIndex) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // 0 = Monday
  const cells = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dateToKey(new Date(Date.UTC(year, monthIndex, d))));
  }
  return cells;
}
