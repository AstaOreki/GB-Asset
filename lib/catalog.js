// Server-side mirror of the product catalog (STATIC_PRODUCTS in
// public/js/gba-firebase.js) and delivery fees (DELIVERY_FEES in
// app/checkout/page.jsx). Duplicated deliberately — same reasoning as
// ADMIN_EMAILS being duplicated into firestore.rules: this is what
// app/api/create-order uses to recompute an order's real price
// server-side, so it can't be a shared import across the client-compat-SDK
// code and this server-only module. If either list changes, update both
// copies.
export const STATIC_PRODUCTS = {
  "bar-1kg": { name: "1 Kilo Investment Bar", price: 537893 },
  "bar-100g": { name: "100 GM Wholesale Bar", price: 53832 },
  "bar-50g": { name: "50 GM Gold Bar", price: 26929 },
  "bar-10g": { name: "10 GM Gift Bar", price: 5579 },
  "bar-1g": { name: "1 GM Gold Bar", price: 559 },
};

export const DELIVERY_FEES = { self: 0, standard: 150, express: 280 };

// Mirrors GBA.getProducts()'s merge logic: Firestore's products/{id} docs
// can override price (set from the admin dashboard's pricing table); any
// product without a Firestore doc yet falls back to the static default.
export async function getServerProducts(db) {
  const merged = {};
  Object.keys(STATIC_PRODUCTS).forEach((id) => {
    merged[id] = { ...STATIC_PRODUCTS[id] };
  });
  const snap = await db.collection("products").get();
  snap.forEach((doc) => {
    if (merged[doc.id]) Object.assign(merged[doc.id], doc.data());
  });
  return merged;
}
