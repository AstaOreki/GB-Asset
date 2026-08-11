/**
 * Pricing a quantity of gold against the admin's live bar prices.
 *
 * Each bar's Sell price is set independently in Product Pricing (bulk
 * bars deliberately carry a smaller per-gram margin than small ones), so
 * a gram is NOT worth the same inside a 1kg bar as inside a 1g bar.
 * Anything quoting a price for a weight therefore has to price it off
 * the bar tier that weight actually qualifies for — multiplying the 1g
 * rate instead produced figures that contradicted the bar prices shown
 * in the table, the cards and the chart on the very same page.
 *
 * `rates` is the live current-rates feed (gba.priceHistory.listenCurrent
 * rows: { weight, sell, buy, ... }).
 */

// The largest bar the quantity reaches. Below the smallest bar the
// smallest bar's rate still applies — there is no cheaper tier.
export function tierFor(rates, grams) {
  if (!rates || !rates.length || !(grams > 0)) return null;
  const bars = rates
    .filter((r) => r.weight > 0 && typeof r.sell === "number" && r.sell > 0)
    .sort((a, b) => a.weight - b.weight);
  if (!bars.length) return null;
  let tier = bars[0];
  for (const bar of bars) if (bar.weight <= grams) tier = bar;
  return tier;
}

export function ratePerGramFor(rates, grams) {
  const tier = tierFor(rates, grams);
  return tier ? tier.sell / tier.weight : null;
}

// Price for `grams` at its tier's rate. For a quantity that matches a bar
// exactly this returns that bar's own price, to the cent.
export function priceFor(rates, grams) {
  const rate = ratePerGramFor(rates, grams);
  return rate == null ? null : rate * grams;
}
